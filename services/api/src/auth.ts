import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { hash, compare } from "bcryptjs";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { query, tx, one, pool } from "./db";
import { balance, issueInitial } from "./ledger";
import { validate } from "./domain";
export const digest = (s: string) =>
  createHash("sha256").update(s).digest("hex");
export type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  adult_confirmed: boolean;
  terms_accepted: boolean;
  preferences: any;
  verified: boolean;
  auth_at?: Date | string;
};
export const localMode = () => process.env.AUTH_MODE !== "supabase";
export function requireLocal() {
  if (
    !localMode() ||
    process.env.NODE_ENV === "production" ||
    !["127.0.0.1", "localhost", "::1"].includes(process.env.HOST || "127.0.0.1")
  )
    throw new ForbiddenException(
      "Local development authentication is unavailable.",
    );
}
export const supabase = () => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY)
    throw new BadRequestException("Supabase authentication is not configured");
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};
export const supabaseAdmin = () => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new BadRequestException("Supabase administration is not configured");
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
};
@Injectable()
export class AuthService {
  async user(authorization?: string) {
    if (!authorization?.startsWith("Bearer "))
      throw new UnauthorizedException("Sign in to continue.");
    const token = authorization.slice(7);
    if (
      (
        await query(
          "SELECT 1 FROM app.revoked_tokens WHERE token_hash=$1 AND expires_at>now()",
          [digest(token)],
        )
      ).length
    )
      throw new UnauthorizedException(
        "This session has been revoked. Sign in again.",
      );
    if (!localMode()) {
      const { data, error } = await supabase().auth.getUser(token);
      if (error || !data.user || !data.user.email_confirmed_at)
        throw new UnauthorizedException("Your verified session has expired.");
      const u = (
        await query("SELECT * FROM app.users WHERE id=$1", [data.user.id])
      )[0];
      if (u?.deleted_at)
        throw new UnauthorizedException("This account was deleted.");
      if (u) {
        const claims = JSON.parse(
          Buffer.from(token.split(".")[1], "base64url").toString(),
        );
        if (
          ["reviewer", "admin", "superadmin"].includes(u.role) &&
          claims.aal !== "aal2"
        )
          throw new ForbiddenException(
            "Privileged Supabase access requires MFA assurance level 2.",
          );
        u.auth_at = new Date((claims.iat || 0) * 1000);
        return u as User;
      }
      return tx(async (c) => {
        const created = await one(
          c,
          "INSERT INTO app.users(id,email,name,verified) VALUES($1,$2,$3,true) RETURNING *",
          [
            data.user.id,
            data.user.email,
            data.user.user_metadata.name || "Investor",
          ],
        );
        await issueInitial(c, created.id);
        return created as User;
      });
    }
    requireLocal();
    const u = (
      await query(
        "SELECT u.*,s.created_at AS auth_at FROM app.users u JOIN app.sessions s ON s.user_id=u.id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.deleted_at IS NULL",
        [digest(token)],
      )
    )[0];
    if (!u)
      throw new UnauthorizedException(
        "Your session has expired. Sign in again.",
      );
    return u as User;
  }
  async register(body: unknown) {
    const v = validate(
      z
        .object({
          email: z.email().max(200),
          password: z.string().min(10).max(100),
          name: z.string().min(2).max(80),
        })
        .strict(),
      body,
    );
    if (!localMode()) {
      const { data, error } = await supabase().auth.signUp({
        email: v.email,
        password: v.password,
        options: { data: { name: v.name } },
      });
      if (error) throw new BadRequestException(error.message);
      return { verificationRequired: true, userId: data.user?.id };
    }
    requireLocal();
    const id = randomUUID(),
      password = await hash(v.password, 12);
    try {
      await tx(async (c) => {
        await c.query(
          "INSERT INTO app.users(id,email,name,password_hash) VALUES($1,$2,$3,$4)",
          [id, v.email.toLowerCase(), v.name, password],
        );
        await issueInitial(c, id);
      });
    } catch (error: any) {
      if (error.code === "23505")
        throw new ConflictException(
          "An account already exists. Sign in or reset your password.",
        );
      throw error;
    }
    await this.sendMail(id, "verification");
    return {
      verificationRequired: true,
      message:
        "Open the local development inbox and follow the verification link.",
    };
  }
  async sendMail(userId: string, kind: string) {
    const token = randomBytes(32).toString("hex");
    await query(
      "INSERT INTO app.mail(id,user_id,kind,token_hash,local_token,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '30 minutes')",
      [randomUUID(), userId, kind, digest(token), token],
    );
  }
  async verify(body: unknown) {
    requireLocal();
    const v = validate(z.object({ token: z.string().min(20) }), body);
    return tx(async (c) => {
      const mail = await one(
        c,
        "SELECT * FROM app.mail WHERE token_hash=$1 AND kind='verification' AND consumed_at IS NULL AND expires_at>now() FOR UPDATE",
        [digest(v.token)],
      );
      if (!mail)
        throw new BadRequestException(
          "This verification link is invalid or expired.",
        );
      await c.query("UPDATE app.users SET verified=true WHERE id=$1", [
        mail.user_id,
      ]);
      await c.query(
        "UPDATE app.mail SET consumed_at=now(),local_token=NULL WHERE id=$1",
        [mail.id],
      );
      return { verified: true };
    });
  }
  async login(body: unknown) {
    const v = validate(
      z.object({ email: z.email(), password: z.string().max(100) }),
      body,
    );
    if (!localMode()) {
      const { data, error } = await supabase().auth.signInWithPassword(v);
      if (error || !data.session)
        throw new UnauthorizedException("Email or password is incorrect.");
      return {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        user: await this.profile(
          await this.user(`Bearer ${data.session.access_token}`),
        ),
      };
    }
    requireLocal();
    const u = (
      await query(
        "SELECT * FROM app.users WHERE email=$1 AND deleted_at IS NULL",
        [v.email.toLowerCase()],
      )
    )[0];
    if (!u || !u.password_hash || !(await compare(v.password, u.password_hash)))
      throw new UnauthorizedException("Email or password is incorrect.");
    if (!u.verified)
      throw new ForbiddenException(
        "Verify your email before signing in. Open the local development inbox.",
      );
    const token = randomBytes(48).toString("hex");
    await query(
      "INSERT INTO app.sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '12 hours')",
      [digest(token), u.id],
    );
    return {
      accessToken: token,
      expiresIn: 43200,
      user: await this.profile(u),
    };
  }
  async profile(u: User) {
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      adultConfirmed: u.adult_confirmed,
      termsAccepted: u.terms_accepted,
      preferences: u.preferences,
      availablePaisa: (await balance(pool, `user:${u.id}`)).toString(),
      simulation: true,
    };
  }
  async resetRequest(body: unknown) {
    const v = validate(z.object({ email: z.email() }), body);
    if (!localMode()) {
      await supabase().auth.resetPasswordForEmail(v.email);
      return { sent: true };
    }
    requireLocal();
    const u = (
      await query(
        "SELECT id FROM app.users WHERE email=$1 AND deleted_at IS NULL",
        [v.email.toLowerCase()],
      )
    )[0];
    if (u) await this.sendMail(u.id, "password-reset");
    return {
      sent: true,
      message: "If the account exists, a reset message has been sent.",
    };
  }
  async reset(body: unknown) {
    requireLocal();
    const v = validate(
      z.object({
        token: z.string().min(20),
        password: z.string().min(10).max(100),
      }),
      body,
    );
    const password = await hash(v.password, 12);
    return tx(async (c) => {
      const mail = await one(
        c,
        "SELECT * FROM app.mail WHERE token_hash=$1 AND kind='password-reset' AND consumed_at IS NULL AND expires_at>now() FOR UPDATE",
        [digest(v.token)],
      );
      if (!mail)
        throw new BadRequestException("The reset link is invalid or expired.");
      await c.query("UPDATE app.users SET password_hash=$1 WHERE id=$2", [
        password,
        mail.user_id,
      ]);
      await c.query("DELETE FROM app.sessions WHERE user_id=$1", [
        mail.user_id,
      ]);
      await c.query(
        "UPDATE app.mail SET consumed_at=now(),local_token=NULL WHERE id=$1",
        [mail.id],
      );
      return { reset: true };
    });
  }
  recent(u: User) {
    if (
      u.auth_at &&
      Date.now() - new Date(u.auth_at).getTime() > 15 * 60 * 1000
    )
      throw new ForbiddenException(
        "Reauthenticate before this high-impact action. Sign in again.",
      );
  }
  role(u: User, ...roles: string[]) {
    if (!roles.includes(u.role))
      throw new ForbiddenException(
        "This action needs an authorized platform role.",
      );
  }
  async owner(u: User, businessId: string) {
    if (
      !(
        await query(
          "SELECT 1 FROM app.memberships WHERE user_id=$1 AND business_id=$2",
          [u.id, businessId],
        )
      ).length
    )
      throw new ForbiddenException("You do not own this business.");
  }
  async independent(u: User, businessId: string) {
    if (
      (
        await query(
          "SELECT 1 FROM app.memberships WHERE user_id=$1 AND business_id=$2",
          [u.id, businessId],
        )
      ).length
    )
      throw new ForbiddenException(
        "A business owner cannot review or approve their own business.",
      );
  }
  async documentAccess(u: User, businessId: string) {
    const b = (
      await query("SELECT reviewer_id FROM app.businesses WHERE id=$1", [
        businessId,
      ])
    )[0];
    const membership = (
      await query(
        "SELECT 1 FROM app.memberships WHERE user_id=$1 AND business_id=$2",
        [u.id, businessId],
      )
    ).length;
    if (
      !membership &&
      !["admin", "superadmin"].includes(u.role) &&
      !(u.role === "reviewer" && b?.reviewer_id === u.id)
    )
      throw new ForbiddenException("This document is private.");
  }
}
