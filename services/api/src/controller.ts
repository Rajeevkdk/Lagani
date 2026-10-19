import {
  Controller,
  Inject,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Headers,
  Res,
  ForbiddenException,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import type { Response } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  AuthService,
  digest,
  requireLocal,
  localMode,
  supabase,
  supabaseAdmin,
} from "./auth";
import { AppService, audit } from "./service";
import { DocumentService } from "./documents";
import { query, pool, tx } from "./db";
import { validate } from "./domain";
import { researchStatus } from "./research";
@ApiTags("Lagani simulation")
@ApiBearerAuth()
@Controller()
export class AppController {
  constructor(
    @Inject(AuthService) private auth: AuthService,
    @Inject(AppService) private app: AppService,
    @Inject(DocumentService) private docs: DocumentService,
  ) {}
  @Get("health") async health() {
    await query("SELECT 1");
    return {
      status: "ok",
      database: "PostgreSQL",
      simulation: true,
      auth: localMode() ? "loopback-development" : "supabase",
      research: researchStatus(),
      push: "unconfigured",
      scanner: {
        hostConfigured: !!process.env.CLAMAV_HOST,
        policy:
          "Fail closed; controlled generated sample has separate integrity status.",
      },
      time: new Date().toISOString(),
    };
  }
  @Get("ready") ready() {
    return this.health();
  }
  @Post("auth/register") register(@Body() b: unknown) {
    return this.auth.register(b);
  }
  @Post("auth/login") login(@Body() b: unknown) {
    return this.auth.login(b);
  }
  @Post("auth/verify") verify(@Body() b: unknown) {
    return this.auth.verify(b);
  }
  @Post("auth/reset-request") resetRequest(@Body() b: unknown) {
    return this.auth.resetRequest(b);
  }
  @Post("auth/reset") reset(@Body() b: unknown) {
    return this.auth.reset(b);
  }
  @Post("auth/refresh") async refresh(@Body() b: unknown) {
    const v = validate(z.object({ refreshToken: z.string() }), b);
    if (localMode())
      return {
        message: "Local sessions last 12 hours. Sign in again when expired.",
      };
    const { data, error } = await supabase().auth.refreshSession({
      refresh_token: v.refreshToken,
    });
    if (error) throw error;
    return {
      accessToken: data.session?.access_token,
      refreshToken: data.session?.refresh_token,
    };
  }
  @Post("auth/logout") async logout(@Headers("authorization") h: string) {
    const user = await this.auth.user(h);
    await query(
      "INSERT INTO app.revoked_tokens(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 day') ON CONFLICT DO NOTHING",
      [digest(h.slice(7)), user.id],
    );
    if (!localMode()) {
      const { error } = await supabaseAdmin().auth.admin.signOut(
        h.slice(7),
        "global",
      );
      if (error) throw error;
    }
    await query("DELETE FROM app.sessions WHERE token_hash=$1", [
      digest(h.slice(7)),
    ]);
    return { signedOut: true };
  }
  @Get("dev/mail") async mail(@Query("email") email: string) {
    requireLocal();
    return {
      messages: await query(
        'SELECT m.kind,m.local_token AS token,m.created_at AS "createdAt",m.expires_at AS "expiresAt" FROM app.mail m JOIN app.users u ON u.id=m.user_id WHERE u.email=$1 AND m.consumed_at IS NULL AND m.expires_at>now() ORDER BY m.created_at DESC LIMIT 10',
        [email?.toLowerCase()],
      ),
    };
  }
  @Get("me") async me(@Headers("authorization") h: string) {
    return this.auth.profile(await this.auth.user(h));
  }
  @Patch("me") async preferences(
    @Headers("authorization") h: string,
    @Body() b: unknown,
  ) {
    return this.app.preferences(await this.auth.user(h), b);
  }
  @Get("me/export") async export(@Headers("authorization") h: string) {
    const u = await this.auth.user(h);
    return {
      profile: await this.auth.profile(u),
      portfolio: await this.app.portfolio(u),
      activity: await this.app.activity(u),
      saved: await this.app.saved(u),
      businesses: await this.app.ownerBusinesses(u),
    };
  }
  @Post("me/deletion") async deletion(
    @Headers("authorization") h: string,
    @Body() b: unknown,
  ) {
    return this.app.deletion(await this.auth.user(h), b);
  }
  @Get("deletion/:id") async deletionStatus(@Param("id") id: string) {
    return (
      (
        await query(
          'SELECT id,status,details,completed_at AS "completedAt" FROM app.deletion_requests WHERE id=$1',
          [id],
        )
      )[0] || { status: "unknown" }
    );
  }
  @Get("businesses") businesses(@Query() q: any) {
    return this.app.businesses(q);
  }
  @Get("businesses/:id") async business(
    @Param("id") id: string,
    @Headers("authorization") h?: string,
  ) {
    return this.app.business(id, h ? await this.auth.user(h) : undefined);
  }
  @Get("saved") async saved(@Headers("authorization") h: string) {
    return this.app.saved(await this.auth.user(h));
  }
  @Post("saved/:id") async save(
    @Headers("authorization") h: string,
    @Param("id") id: string,
  ) {
    return this.app.save(await this.auth.user(h), id);
  }
  @Post("rounds/:id/quote") async quote(
    @Headers("authorization") h: string,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.app.quote(await this.auth.user(h), id, b);
  }
  @Post("commitments") async commitment(
    @Headers("authorization") h: string,
    @Body() b: unknown,
  ) {
    return this.app.commit(await this.auth.user(h), b);
  }
  @Post("commitments/:id/cancel") async cancel(
    @Headers("authorization") h: string,
    @Param("id") id: string,
  ) {
    return this.app.cancelCommitment(await this.auth.user(h), id);
  }
  @Get("commitments/:id/receipt") async receipt(
    @Headers("authorization") h: string,
    @Param("id") id: string,
  ) {
    return this.app.receipt(await this.auth.user(h), id);
  }
  @Get("portfolio") async portfolio(@Headers("authorization") h: string) {
    return this.app.portfolio(await this.auth.user(h));
  }
  @Get("activity") async activity(@Headers("authorization") h: string) {
    return this.app.activity(await this.auth.user(h));
  }
  @Get("notifications") async notifications(
    @Headers("authorization") h: string,
  ) {
    const u = await this.auth.user(h);
    return {
      items: await query(
        'SELECT id,title,body,link,read_at AS "readAt",created_at AS "createdAt" FROM app.notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100',
        [u.id],
      ),
    };
  }
  @Post("notifications/:id/read") async read(
    @Headers("authorization") h: string,
    @Param("id") id: string,
  ) {
    const u = await this.auth.user(h);
    await query(
      "UPDATE app.notifications SET read_at=now() WHERE id=$1 AND user_id=$2",
      [id, u.id],
    );
    return { read: true };
  }
  @Get("owner/businesses") async ownerBusinesses(
    @Headers("authorization") h: string,
  ) {
    return this.app.ownerBusinesses(await this.auth.user(h));
  }
  @Post("owner/businesses") async create(
    @Headers("authorization") h: string,
    @Body() b: unknown,
  ) {
    return this.app.createBusiness(await this.auth.user(h), b);
  }
  @Patch("owner/businesses/:id") async edit(
    @Headers("authorization") h: string,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.app.editBusiness(await this.auth.user(h), id, b);
  }
  @Post("owner/businesses/:id/financials") async financials(
    @Headers("authorization") h: string,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.app.importFinancials(await this.auth.user(h), id, b);
  }
  @Get("financials/template") template() {
    return {
      csv: "period,revenuePaisa,variableCostPaisa,operatingCostPaisa,openingCashPaisa\n2026-09,25000000,12500000,7000000,30000000\n",
      units:
        "NPR paisa, integer strings. 100 paisa = NPR 1. Preview before confirming import.",
    };
  }
  @Post("owner/businesses/:id/documents") async upload(
    @Headers("authorization") h: string,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.docs.upload(await this.auth.user(h), id, b);
  }
  @Post("owner/businesses/:id/documents/sample") async sample(
    @Headers("authorization") h: string,
    @Param("id") id: string,
  ) {
    return this.docs.upload(await this.auth.user(h), id, {}, true);
  }
  @Post("owner/businesses/:id/submit") async submit(
    @Headers("authorization") h: string,
    @Param("id") id: string,
  ) {
    return this.app.submit(await this.auth.user(h), id);
  }
  @Post("owner/businesses/:id/updates") async update(
    @Headers("authorization") h: string,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.app.update(await this.auth.user(h), id, b);
  }
  @Post("documents/:id/link") async link(
    @Headers("authorization") h: string,
    @Param("id") id: string,
  ) {
    return this.docs.link(await this.auth.user(h), id);
  }
  @Get("documents/:id/download") async download(
    @Headers("authorization") h: string,
    @Param("id") id: string,
    @Query("token") token: string,
    @Res() res: Response,
  ) {
    const d = await this.docs.download(await this.auth.user(h), id, token);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Disposition", `attachment; filename="${d.name}"`);
    res.type(d.mime).send(d.bytes);
  }
  @Get("admin/queue") async queue(@Headers("authorization") h: string) {
    return this.app.queue(await this.auth.user(h));
  }
  @Post("admin/businesses/:id/review") async review(
    @Headers("authorization") h: string,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.app.review(await this.auth.user(h), id, b);
  }
  @Post("admin/businesses/:id/analysis") async analysis(
    @Headers("authorization") h: string,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.app.analyze(await this.auth.user(h), id, b);
  }
  @Post("admin/reports/:id/approve") async approve(
    @Headers("authorization") h: string,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.app.approveReport(await this.auth.user(h), id, b);
  }
  @Patch("admin/reports/:id") async editReport(
    @Headers("authorization") h: string,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    const u = await this.auth.user(h);
    this.auth.role(u, "reviewer");
    const v = validate(
      z
        .object({
          executiveSummary: z.string().min(20).max(4000).optional(),
          materialRisks: z
            .array(z.string().min(5).max(800))
            .min(2)
            .max(20)
            .optional(),
          missingData: z.array(z.string().max(500)).max(20).optional(),
          reviewerQuestions: z.array(z.string().max(500)).max(20).optional(),
          notes: z.string().min(8).max(2000),
        })
        .strict(),
      b,
    );
    return tx(async (c) => {
      const r = (
        await c.query(
          "SELECT * FROM app.reports WHERE id=$1 AND prepared_by=$2 AND status='draft' FOR UPDATE",
          [id, u.id],
        )
      ).rows[0];
      if (!r)
        throw new ForbiddenException(
          "Only the preparing reviewer may edit their own draft report.",
        );
      const { notes, ...changes } = v;
      const result = (
        await c.query(
          "UPDATE app.reports SET data=data||$2::jsonb WHERE id=$1 RETURNING id,version,status,data",
          [id, JSON.stringify(changes)],
        )
      ).rows[0];
      await audit(c, u.id, "report.edit", id, { version: r.version, notes });
      return {
        id: result.id,
        version: result.version,
        status: result.status,
        ...result.data,
      };
    });
  }
  @Post("admin/businesses/:id/publish") async publish(
    @Headers("authorization") h: string,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.app.publish(await this.auth.user(h), id, b);
  }
  @Post("admin/rounds/:id/close") async close(
    @Headers("authorization") h: string,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.app.close(await this.auth.user(h), id, b);
  }
  @Post("admin/rounds/:id/cancel") async cancelRound(
    @Headers("authorization") h: string,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.app.close(await this.auth.user(h), id, b, "cancel");
  }
  @Post("admin/updates/:id/approve") async approveUpdate(
    @Headers("authorization") h: string,
    @Param("id") id: string,
  ) {
    return this.app.approveUpdate(await this.auth.user(h), id);
  }
  @Post("admin/documents/:id/rescan") async rescan(
    @Headers("authorization") h: string,
    @Param("id") id: string,
  ) {
    return this.docs.rescan(await this.auth.user(h), id);
  }
  @Get("admin/reconciliation") async reconcile(
    @Headers("authorization") h: string,
  ) {
    return this.app.reconciliation(await this.auth.user(h));
  }
  @Post("admin/jobs/:id/retry") async retry(
    @Headers("authorization") h: string,
    @Param("id") id: string,
  ) {
    const u = await this.auth.user(h);
    this.auth.role(u, "admin", "superadmin");
    await query(
      "UPDATE app.jobs SET status='pending',attempts=0,run_at=now() WHERE id=$1 AND status='failed'",
      [id],
    );
    await audit(pool, u.id, "job.retry", id);
    return { queued: true };
  }
  @Post("support") async support(
    @Headers("authorization") h: string,
    @Body() b: unknown,
  ) {
    const u = await this.auth.user(h),
      v = validate(
        z
          .object({
            subject: z.string().min(4).max(150),
            body: z.string().min(10).max(4000),
          })
          .strict(),
        b,
      );
    return (
      await query(
        "INSERT INTO app.support_requests(id,user_id,subject,body) VALUES($1,$2,$3,$4) RETURNING id,status",
        [randomUUID(), u.id, v.subject, v.body],
      )
    )[0];
  }
  @Post("businesses/:id/report") async report(
    @Headers("authorization") h: string,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    const u = await this.auth.user(h),
      v = validate(
        z.object({ reason: z.string().min(10).max(2000) }).strict(),
        b,
      );
    return (
      await query(
        "INSERT INTO app.moderation(id,reporter_id,business_id,reason) VALUES($1,$2,$3,$4) RETURNING id,status",
        [randomUUID(), u.id, id, v.reason],
      )
    )[0];
  }
  @Post("admin/moderation/:id") async moderate(
    @Headers("authorization") h: string,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    const u = await this.auth.user(h);
    this.auth.role(u, "admin", "superadmin");
    const v = validate(
      z
        .object({
          decision: z.enum(["dismissed", "removed"]),
          notes: z.string().min(8).max(2000),
        })
        .strict(),
      b,
    );
    return tx(async (c) => {
      const row = (
        await c.query(
          "UPDATE app.moderation SET status=$2,decision_by=$3,decision_notes=$4 WHERE id=$1 RETURNING *",
          [id, v.decision, u.id, v.notes],
        )
      ).rows[0];
      if (row && v.decision === "removed")
        await c.query(
          "UPDATE app.businesses SET status='rejected' WHERE id=$1",
          [row.business_id],
        );
      await audit(c, u.id, "moderation.decide", id, v);
      return row;
    });
  }
}
