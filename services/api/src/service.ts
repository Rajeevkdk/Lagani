import {
  Injectable,
  Inject,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID, randomBytes } from "node:crypto";
import { z } from "zod";
import { parse } from "csv-parse/sync";
import { pool, query, tx, one, DbClient } from "./db";
import { AuthService, User, digest, localMode } from "./auth";
import { balance, journal, createRoundAccounts } from "./ledger";
import { equity, ensureOpen, validate, money } from "./domain";
import { buildReport, reportDto } from "./research";
import { removeBytes } from "./storage";
export const roundDto = (r: any) =>
  r
    ? {
        id: r.id,
        businessId: r.business_id,
        status: r.status,
        targetPaisa: r.target_paisa,
        committedPaisa: r.committed_paisa,
        sharePricePaisa: r.share_price_paisa,
        existingShares: r.existing_shares,
        preMoneyPaisa: r.pre_money_paisa,
        targetShares: (
          BigInt(r.target_paisa) / BigInt(r.share_price_paisa)
        ).toString(),
        minPaisa: r.min_paisa,
        incrementPaisa: r.increment_paisa,
        termsVersion: r.terms_version,
        deadline: r.deadline,
        closedAt: r.closed_at,
      }
    : null;
export const commitmentDto = (c: any) => ({
  id: c.id,
  userId: c.user_id,
  roundId: c.round_id,
  businessId: c.business_id,
  businessName: c.business_name,
  amountPaisa: c.amount_paisa,
  shares: c.shares,
  termsVersion: c.terms_version,
  status: c.status,
  createdAt: c.created_at,
  simulation: true,
});
export async function audit(
  c: DbClient,
  u: string,
  action: string,
  target: string,
  details: any = {},
) {
  await c.query(
    "INSERT INTO app.audit(actor_id,action,target,details) VALUES($1,$2,$3,$4)",
    [u, action, target, details],
  );
}
export async function notify(
  c: DbClient,
  userId: string,
  key: string,
  title: string,
  body: string,
  link: string,
) {
  await c.query(
    "INSERT INTO app.jobs(id,kind,event_key,payload) VALUES($1,'notification',$2,$3) ON CONFLICT(event_key) DO NOTHING",
    [randomUUID(), key, { userId, title, body, link }],
  );
}
@Injectable()
export class AppService {
  constructor(@Inject(AuthService) private auth: AuthService) {}
  async businesses(q: any = {}) {
    const params: any[] = [];
    let where = "WHERE b.status='published'";
    for (const [key, column] of [
      ["sector", "sector"],
      ["location", "location"],
    ] as const) {
      if (q[key]) {
        params.push(q[key]);
        where += ` AND b.${column}=$${params.length}`;
      }
    }
    if (q.q) {
      params.push(`%${String(q.q).slice(0, 100)}%`);
      where += ` AND (b.name ILIKE $${params.length} OR b.tagline ILIKE $${params.length})`;
    }
    if (q.status) {
      params.push(q.status);
      where += ` AND EXISTS(SELECT 1 FROM app.rounds r WHERE r.business_id=b.id AND r.status=$${params.length})`;
    }
    const offset = Math.max(0, Math.min(10000, Number(q.cursor) || 0));
    const rows = await query(
      `SELECT b.* FROM app.businesses b ${where} ORDER BY ${q.sort === "name" ? "b.name ASC" : "b.created_at DESC,b.id"} LIMIT 20 OFFSET ${offset}`,
      params,
    );
    return {
      items: await Promise.all(rows.map((b) => this.businessDto(b))),
      nextCursor: rows.length === 20 ? String(offset + 20) : null,
      ordering: "Recently published fictional businesses; no success ranking.",
      lastUpdated: new Date().toISOString(),
    };
  }
  async businessDto(b: any, privileged = false) {
    const [rounds, financials, reports, updates] = await Promise.all([
      query(
        "SELECT * FROM app.rounds WHERE business_id=$1 ORDER BY terms_version DESC LIMIT 1",
        [b.id],
      ),
      query(
        "SELECT * FROM app.financials WHERE business_id=$1 ORDER BY period",
        [b.id],
      ),
      query(
        `SELECT * FROM app.reports WHERE business_id=$1 ${privileged ? "" : "AND status='published'"} ORDER BY version DESC LIMIT 1`,
        [b.id],
      ),
      query(
        `SELECT * FROM app.updates WHERE business_id=$1 ${privileged ? "" : "AND status='published'"} ORDER BY created_at DESC`,
        [b.id],
      ),
    ]);
    const result: any = {
      id: b.id,
      name: b.name,
      tagline: b.tagline,
      sector: b.sector,
      location: b.location,
      story: b.story,
      founderName: b.founder_name,
      status: b.status,
      stage: b.stage,
      illustration: b.illustration,
      color: b.color,
      risks: b.risks,
      fundingUse: b.funding_use,
      legalEntity: `${b.name} Pvt. Ltd. — Fictional demonstration entity`,
      verificationScope:
        "Review of fictional sample records only. No real KYC, registry or bank verification.",
      round: roundDto(rounds[0]),
      financials: financials.map((f) => ({
        id: f.id,
        period: f.period,
        revenuePaisa: f.revenue_paisa,
        variableCostPaisa: f.variable_cost_paisa,
        operatingCostPaisa: f.operating_cost_paisa,
        openingCashPaisa: f.opening_cash_paisa,
        source: f.source,
        confirmed: f.confirmed,
      })),
      report: reportDto(reports[0]),
      updates: updates.map((v) => ({
        id: v.id,
        title: v.title,
        body: v.body,
        status: v.status,
        createdAt: v.created_at,
      })),
      simulation: true,
    };
    if (privileged) {
      result.privateDetails = b.private_details;
      result.timeline = await query(
        'SELECT decision,notes,created_at AS "createdAt" FROM app.review_events WHERE business_id=$1 ORDER BY created_at',
        [b.id],
      );
      result.documents = await query(
        'SELECT id,name,mime_type AS "mimeType",version,status,scan_engine AS "scanEngine",created_at AS "createdAt" FROM app.documents WHERE business_id=$1 ORDER BY created_at DESC',
        [b.id],
      );
      result.checks = await query(
        'SELECT kind,outcome,notes,created_at AS "createdAt" FROM app.verification_checks WHERE business_id=$1',
        [b.id],
      );
    }
    return result;
  }
  async business(id: string, u?: User) {
    const b = (
      await query("SELECT * FROM app.businesses WHERE id=$1", [id])
    )[0];
    if (!b) throw new NotFoundException("Business not found.");
    if (b.status !== "published") {
      if (!u) throw new NotFoundException("Business not found.");
      await this.auth.documentAccess(u, id);
    }
    return this.businessDto(b, !!u && b.status !== "published");
  }
  async preferences(u: User, body: unknown) {
    const v = validate(
      z
        .object({
          name: z.string().min(2).max(80).optional(),
          adultConfirmed: z.boolean().optional(),
          termsAccepted: z.boolean().optional(),
          preferences: z
            .object({
              theme: z.enum(["light", "dark", "system"]).optional(),
              language: z.enum(["en", "ne"]).optional(),
              motion: z.enum(["full", "reduced", "system"]).optional(),
              notifications: z.boolean().optional(),
            })
            .strict()
            .optional(),
        })
        .strict(),
      body,
    );
    const row = (
      await query(
        "UPDATE app.users SET name=COALESCE($2,name),adult_confirmed=COALESCE($3,adult_confirmed),terms_accepted=COALESCE($4,terms_accepted),preferences=preferences||$5::jsonb WHERE id=$1 RETURNING *",
        [
          u.id,
          v.name,
          v.adultConfirmed,
          v.termsAccepted,
          JSON.stringify(v.preferences || {}),
        ],
      )
    )[0];
    return this.auth.profile(row);
  }
  async saved(u: User) {
    return {
      businessIds: (
        await query(
          "SELECT business_id FROM app.saved WHERE user_id=$1 ORDER BY created_at DESC",
          [u.id],
        )
      ).map((s) => s.business_id),
    };
  }
  async save(u: User, businessId: string) {
    await this.business(businessId);
    return tx(async (c) => {
      await c.query("SELECT id FROM app.users WHERE id=$1 FOR UPDATE", [u.id]);
      const existing = await one(
        c,
        "DELETE FROM app.saved WHERE user_id=$1 AND business_id=$2 RETURNING business_id",
        [u.id, businessId],
      );
      if (existing) return { saved: false };
      await c.query(
        "INSERT INTO app.saved(user_id,business_id) VALUES($1,$2)",
        [u.id, businessId],
      );
      return { saved: true };
    });
  }
  async quote(u: User, roundId: string, body: unknown) {
    const v = validate(z.object({ amountPaisa: money }).strict(), body);
    const r = (
      await query(
        "SELECT r.* FROM app.rounds r JOIN app.businesses b ON b.id=r.business_id WHERE r.id=$1 AND b.status='published'",
        [roundId],
      )
    )[0];
    if (!r) throw new NotFoundException("Round not found");
    ensureOpen(r);
    await this.auth.independent(u, r.business_id);
    if (!u.adult_confirmed || !u.terms_accepted)
      throw new ForbiddenException(
        "Complete your adult simulation profile and accept the demo terms.",
      );
    const amount = BigInt(v.amountPaisa);
    if (
      amount < BigInt(r.min_paisa) ||
      amount % BigInt(r.increment_paisa) !== 0n
    )
      throw new BadRequestException(
        `Minimum ${r.min_paisa} paisa; increment ${r.increment_paisa} paisa.`,
      );
    if (amount > BigInt(r.target_paisa) - BigInt(r.committed_paisa))
      throw new ConflictException("That amount exceeds remaining capacity.");
    const available = await balance(pool, `user:${u.id}`);
    if (amount > available)
      throw new ConflictException("Insufficient virtual balance.");
    const calculations = equity(
      {
        existingShares: r.existing_shares,
        sharePricePaisa: r.share_price_paisa,
        targetPaisa: r.target_paisa,
        preMoneyPaisa: r.pre_money_paisa,
      },
      v.amountPaisa,
    );
    const id = randomUUID();
    const q = (
      await query(
        "INSERT INTO app.quotes(id,user_id,round_id,amount_paisa,shares,terms_version,expires_at) VALUES($1,$2,$3,$4,$5,$6,now()+interval '5 minutes') RETURNING *",
        [id, u.id, r.id, v.amountPaisa, calculations.shares, r.terms_version],
      )
    )[0];
    return {
      id,
      roundId: r.id,
      amountPaisa: v.amountPaisa,
      ...calculations,
      termsVersion: r.terms_version,
      expiresAt: q.expires_at,
      availablePaisa: available.toString(),
      notice:
        "Simulation · No real money. Virtual funds cannot be bought, withdrawn, redeemed or converted into securities.",
    };
  }
  async commit(u: User, body: unknown) {
    const v = validate(
      z
        .object({
          quoteId: z.string().uuid(),
          riskAcknowledged: z.literal(true),
          idempotencyKey: z.string().min(8).max(100),
        })
        .strict(),
      body,
    );
    const requestHash = digest(
      JSON.stringify({
        quoteId: v.quoteId,
        riskAcknowledged: v.riskAcknowledged,
      }),
    );
    return tx(async (c) => {
      await c.query("SELECT id FROM app.users WHERE id=$1 FOR UPDATE", [u.id]);
      const existing = await one(
        c,
        "SELECT * FROM app.commitments WHERE user_id=$1 AND idempotency_key=$2",
        [u.id, v.idempotencyKey],
      );
      if (existing) {
        if (existing.request_hash !== requestHash)
          throw new ConflictException(
            "This request key was used for different content.",
          );
        return commitmentDto(existing);
      }
      const q = await one(
        c,
        "SELECT * FROM app.quotes WHERE id=$1 AND user_id=$2",
        [v.quoteId, u.id],
      );
      if (!q) throw new NotFoundException("Quote not found");
      if (new Date(q.expires_at) <= new Date())
        throw new ConflictException(
          "The quote expired. Request a fresh quote.",
        );
      const r = await one(
        c,
        "SELECT * FROM app.rounds WHERE id=$1 FOR UPDATE",
        [q.round_id],
      );
      ensureOpen(r);
      if (
        await one(
          c,
          "SELECT 1 FROM app.memberships WHERE business_id=$1 AND user_id=$2",
          [r.business_id, u.id],
        )
      )
        throw new ForbiddenException(
          "Owners cannot invest in their own business.",
        );
      const profile = await one(c, "SELECT * FROM app.users WHERE id=$1", [
        u.id,
      ]);
      if (!profile.adult_confirmed || !profile.terms_accepted)
        throw new ForbiddenException("Complete the simulation profile first.");
      if (q.terms_version !== r.terms_version)
        throw new ConflictException(
          "Round terms changed. Request a fresh quote.",
        );
      const amount = BigInt(q.amount_paisa);
      if (amount > BigInt(r.target_paisa) - BigInt(r.committed_paisa))
        throw new ConflictException(
          "Round capacity changed. Request a fresh quote.",
        );
      if ((await balance(c, `user:${u.id}`)) < amount)
        throw new ConflictException("Insufficient virtual balance.");
      const id = randomUUID(),
        journalId = await journal(
          c,
          `commit:${id}`,
          "commitment",
          `user:${u.id}`,
          `escrow:${r.id}`,
          amount,
        );
      const report = await one(
        c,
        "SELECT id FROM app.reports WHERE business_id=$1 AND status='published' ORDER BY version DESC LIMIT 1",
        [r.business_id],
      );
      const result = await one(
        c,
        "INSERT INTO app.commitments(id,user_id,round_id,quote_id,amount_paisa,shares,terms_version,report_id,status,idempotency_key,request_hash,journal_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'committed',$9,$10,$11) RETURNING *",
        [
          id,
          u.id,
          r.id,
          q.id,
          q.amount_paisa,
          q.shares,
          q.terms_version,
          report?.id ?? null,
          v.idempotencyKey,
          requestHash,
          journalId,
        ],
      );
      await c.query(
        "UPDATE app.rounds SET committed_paisa=committed_paisa+$2,status=CASE WHEN committed_paisa+$2=target_paisa THEN 'funded-awaiting-close' ELSE 'open' END WHERE id=$1",
        [r.id, q.amount_paisa],
      );
      await notify(
        c,
        u.id,
        `commit:${id}`,
        "Virtual commitment recorded",
        "Your funds are reserved. Shares are issued only after an authorized successful close.",
        `/portfolio`,
      );
      await audit(c, u.id, "commitment.create", id, {
        amountPaisa: q.amount_paisa,
        termsVersion: q.terms_version,
      });
      return commitmentDto(result);
    });
  }
  async cancelCommitment(u: User, id: string) {
    return tx(async (c) => {
      await c.query("SELECT id FROM app.users WHERE id=$1 FOR UPDATE", [u.id]);
      const initial = await one(
        c,
        "SELECT * FROM app.commitments WHERE id=$1 AND user_id=$2",
        [id, u.id],
      );
      if (!initial) throw new NotFoundException("Commitment not found");
      const r = await one(
        c,
        "SELECT * FROM app.rounds WHERE id=$1 FOR UPDATE",
        [initial.round_id],
      );
      const cm = await one(
        c,
        "SELECT * FROM app.commitments WHERE id=$1 FOR UPDATE",
        [id],
      );
      if (["cancelled", "refunded"].includes(cm.status))
        return commitmentDto(cm);
      if (
        !["open", "funded-awaiting-close"].includes(r.status) ||
        cm.status !== "committed"
      )
        throw new ConflictException(
          "Cancellation is available until successful close.",
        );
      await journal(
        c,
        `cancel:${id}`,
        "commitment-cancellation",
        `escrow:${r.id}`,
        `user:${u.id}`,
        BigInt(cm.amount_paisa),
        cm.journal_id,
      );
      await c.query(
        "UPDATE app.rounds SET committed_paisa=committed_paisa-$2,status='open' WHERE id=$1",
        [r.id, cm.amount_paisa],
      );
      const result = await one(
        c,
        "UPDATE app.commitments SET status='cancelled' WHERE id=$1 RETURNING *",
        [id],
      );
      await notify(
        c,
        u.id,
        `cancel:${id}`,
        "Virtual funds released",
        "Your commitment was cancelled and its full virtual amount is available again.",
        "/activity",
      );
      return commitmentDto(result);
    });
  }
  async close(u: User, roundId: string, body: unknown, action = "close") {
    this.auth.role(u, "admin", "superadmin");
    this.auth.recent(u);
    const v = validate(
      z
        .object({
          confirm: z.literal(true),
          reason: z.string().min(4).max(1000).optional(),
        })
        .strict(),
      body,
    );
    const initial = (
      await query("SELECT * FROM app.rounds WHERE id=$1", [roundId])
    )[0];
    if (!initial) throw new NotFoundException("Round not found");
    await this.auth.independent(u, initial.business_id);
    return tx(async (c) => {
      const r = await one(
        c,
        "SELECT * FROM app.rounds WHERE id=$1 FOR UPDATE",
        [roundId],
      );
      if (["closed-successfully", "failed", "cancelled"].includes(r.status))
        return roundDto(r);
      if (!["open", "funded-awaiting-close"].includes(r.status))
        throw new ConflictException("Round is not open");
      const success =
        action === "close" && r.committed_paisa === r.target_paisa;
      if (action === "close" && !success && new Date(r.deadline) > new Date())
        throw new ConflictException(
          "An underfunded round can fail only after its deadline; use explicit cancellation before then.",
        );
      const commitments = (
        await c.query(
          "SELECT * FROM app.commitments WHERE round_id=$1 AND status='committed' ORDER BY id FOR UPDATE",
          [r.id],
        )
      ).rows;
      if (success) {
        const total =
          BigInt(r.existing_shares) +
          BigInt(r.target_paisa) / BigInt(r.share_price_paisa);
        for (const cm of commitments) {
          await c.query(
            "INSERT INTO app.allocations(id,commitment_id,user_id,round_id,shares,cost_paisa,total_shares) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(commitment_id) DO NOTHING",
            [
              randomUUID(),
              cm.id,
              cm.user_id,
              r.id,
              cm.shares,
              cm.amount_paisa,
              total.toString(),
            ],
          );
          await c.query(
            "UPDATE app.commitments SET status='issued' WHERE id=$1",
            [cm.id],
          );
          await notify(
            c,
            cm.user_id,
            `issued:${cm.id}`,
            "Simulated shares issued",
            "The round closed successfully. Your nonbinding demo certificate is ready.",
            "/portfolio",
          );
        }
        await journal(
          c,
          `close:${r.id}`,
          "round-proceeds",
          `escrow:${r.id}`,
          `proceeds:${r.id}`,
          BigInt(r.committed_paisa),
        );
        await c.query(
          "INSERT INTO app.cap_table_events(id,round_id,new_shares,founder_shares,total_shares) VALUES($1,$2,$3,$4,$5)",
          [
            randomUUID(),
            r.id,
            (BigInt(r.target_paisa) / BigInt(r.share_price_paisa)).toString(),
            r.existing_shares,
            total.toString(),
          ],
        );
      } else {
        for (const cm of commitments) {
          await journal(
            c,
            `refund:${cm.id}`,
            "round-refund",
            `escrow:${r.id}`,
            `user:${cm.user_id}`,
            BigInt(cm.amount_paisa),
            cm.journal_id,
          );
          await c.query(
            "UPDATE app.commitments SET status='refunded' WHERE id=$1",
            [cm.id],
          );
          await notify(
            c,
            cm.user_id,
            `refund:${cm.id}`,
            "Virtual funds refunded",
            "The round did not close. Your entire reserved virtual amount has been returned.",
            "/activity",
          );
        }
      }
      const status = success
        ? "closed-successfully"
        : action === "cancel"
          ? "cancelled"
          : "failed";
      const result = await one(
        c,
        "UPDATE app.rounds SET status=$2,closed_at=now(),committed_paisa=CASE WHEN $2='closed-successfully' THEN committed_paisa ELSE 0 END WHERE id=$1 RETURNING *",
        [r.id, status],
      );
      await audit(c, u.id, `round.${status}`, r.id, {
        reason: v.reason ?? "Authorized all-or-nothing close",
      });
      return roundDto(result);
    });
  }
  async portfolio(u: User) {
    const commitments = await query(
      "SELECT c.*,b.id AS business_id,b.name AS business_name FROM app.commitments c JOIN app.rounds r ON r.id=c.round_id JOIN app.businesses b ON b.id=r.business_id WHERE c.user_id=$1 ORDER BY c.created_at DESC",
      [u.id],
    );
    const holdings = await query(
      "SELECT a.*,b.id AS business_id,b.name AS business_name,b.color,b.illustration FROM app.allocations a JOIN app.rounds r ON r.id=a.round_id JOIN app.businesses b ON b.id=r.business_id WHERE a.user_id=$1 ORDER BY a.issued_at DESC",
      [u.id],
    );
    return {
      availablePaisa: (await balance(pool, `user:${u.id}`)).toString(),
      committedPaisa: commitments
        .filter((c) => c.status === "committed")
        .reduce((n, c) => n + BigInt(c.amount_paisa), 0n)
        .toString(),
      investedPaisa: holdings
        .reduce((n, h) => n + BigInt(h.cost_paisa), 0n)
        .toString(),
      holdings: holdings.map((h) => ({
        id: h.id,
        commitmentId: h.commitment_id,
        businessId: h.business_id,
        businessName: h.business_name,
        shares: h.shares,
        costPaisa: h.cost_paisa,
        totalShares: h.total_shares,
        ownershipPercent: equity(
          {
            existingShares: (
              BigInt(h.total_shares) - BigInt(h.shares)
            ).toString(),
            sharePricePaisa: "1",
            targetPaisa: h.shares,
            preMoneyPaisa: (
              BigInt(h.total_shares) - BigInt(h.shares)
            ).toString(),
          },
          h.shares,
        ).ownershipPercent,
        issuedAt: h.issued_at,
        color: h.color,
        illustration: h.illustration,
      })),
      commitments: commitments.map(commitmentDto),
      valuationBasis: "Historical cost only. No daily market price.",
      simulation: true,
    };
  }
  async activity(u: User) {
    const rows = await query(
      "SELECT j.id,j.kind,j.created_at,e.amount_paisa,j.reversal_of FROM app.entries e JOIN app.journals j ON j.id=e.journal_id WHERE e.account_id=$1 ORDER BY j.created_at DESC LIMIT 100",
      [`user:${u.id}`],
    );
    return {
      items: rows.map((a) => ({
        id: a.id,
        type: a.kind,
        title: a.kind.replaceAll("-", " "),
        amountPaisa: a.amount_paisa,
        createdAt: a.created_at,
        reversalOf: a.reversal_of,
      })),
    };
  }
  async ownerBusinesses(u: User) {
    const rows = await query(
      "SELECT b.* FROM app.businesses b JOIN app.memberships m ON m.business_id=b.id WHERE m.user_id=$1 ORDER BY b.created_at DESC",
      [u.id],
    );
    return {
      items: await Promise.all(rows.map((b) => this.businessDto(b, true))),
    };
  }
  async createBusiness(u: User, body: unknown) {
    const v = validate(
      z
        .object({
          name: z.string().min(3).max(80),
          sector: z.string().min(2).max(50),
          location: z.string().min(2).max(80),
          tagline: z.string().max(180).default(""),
          story: z.string().max(8000).default(""),
          founderName: z.string().max(100).default("Fictional founder"),
        })
        .strict(),
      body,
    );
    const id = `${v.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 50)}-${randomBytes(3).toString("hex")}`;
    await tx(async (c) => {
      await c.query(
        "INSERT INTO app.businesses(id,name,sector,location,tagline,story,founder_name,risks,funding_use) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [
          id,
          v.name,
          v.sector,
          v.location,
          v.tagline,
          v.story,
          v.founderName,
          JSON.stringify([
            "Business failure may result in losing the simulated investment.",
            "No ready resale market or guaranteed dividends.",
          ]),
          JSON.stringify(["Equipment", "Working capital"]),
        ],
      );
      await c.query(
        "INSERT INTO app.memberships(business_id,user_id) VALUES($1,$2)",
        [id, u.id],
      );
      const roundId = `${id}-round-1`;
      await c.query(
        "INSERT INTO app.rounds(id,business_id,target_paisa,share_price_paisa,existing_shares,pre_money_paisa,min_paisa,increment_paisa,deadline) VALUES($1,$2,200000000,1000,800000,800000000,100000,100000,now()+interval '60 days')",
        [roundId, id],
      );
      await createRoundAccounts(c, roundId);
      await audit(c, u.id, "business.create", id);
    });
    return this.business(id, u);
  }
  async editBusiness(u: User, id: string, body: unknown) {
    await this.auth.owner(u, id);
    const v = validate(
      z
        .object({
          name: z.string().min(3).max(80).optional(),
          tagline: z.string().max(180).optional(),
          story: z.string().max(8000).optional(),
          sector: z.string().max(50).optional(),
          location: z.string().max(80).optional(),
          founderName: z.string().max(100).optional(),
          privateDetails: z
            .object({
              registration: z.string().max(100).optional(),
              pan: z.string().max(100).optional(),
              controllers: z.string().max(1000).optional(),
              bankOwnership: z.string().max(1000).optional(),
            })
            .strict()
            .optional(),
          risks: z.array(z.string().max(500)).max(20).optional(),
          fundingUse: z.array(z.string().max(500)).max(20).optional(),
          round: z
            .object({
              targetPaisa: money,
              sharePricePaisa: money,
              existingShares: money,
              preMoneyPaisa: money,
              minPaisa: money,
              incrementPaisa: money,
            })
            .optional(),
        })
        .strict(),
      body,
    );
    await tx(async (c) => {
      const b = await one(
        c,
        "SELECT * FROM app.businesses WHERE id=$1 FOR UPDATE",
        [id],
      );
      if (!["draft", "needs-information", "rejected"].includes(b.status))
        throw new ConflictException(
          "Submitted and published terms are frozen. Request information or cancel the round before replacing terms.",
        );
      await c.query(
        "UPDATE app.businesses SET name=COALESCE($2,name),tagline=COALESCE($3,tagline),story=COALESCE($4,story),sector=COALESCE($5,sector),location=COALESCE($6,location),founder_name=COALESCE($7,founder_name),private_details=private_details||$8::jsonb,risks=COALESCE($9::jsonb,risks),funding_use=COALESCE($10::jsonb,funding_use),updated_at=now() WHERE id=$1",
        [
          id,
          v.name,
          v.tagline,
          v.story,
          v.sector,
          v.location,
          v.founderName,
          JSON.stringify(v.privateDetails || {}),
          v.risks ? JSON.stringify(v.risks) : null,
          v.fundingUse ? JSON.stringify(v.fundingUse) : null,
        ],
      );
      if (v.round) {
        equity(v.round, v.round.minPaisa);
        await c.query(
          "UPDATE app.rounds SET target_paisa=$2,share_price_paisa=$3,existing_shares=$4,pre_money_paisa=$5,min_paisa=$6,increment_paisa=$7 WHERE business_id=$1 AND status='draft'",
          [
            id,
            v.round.targetPaisa,
            v.round.sharePricePaisa,
            v.round.existingShares,
            v.round.preMoneyPaisa,
            v.round.minPaisa,
            v.round.incrementPaisa,
          ],
        );
      }
    });
    return this.business(id, u);
  }
  async importFinancials(u: User, id: string, body: unknown) {
    await this.auth.owner(u, id);
    const v = validate(
      z
        .object({
          csv: z.string().max(100000),
          confirm: z.boolean().default(false),
        })
        .strict(),
      body,
    );
    let rows: any[];
    try {
      rows = parse(v.csv, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
      });
    } catch {
      throw new BadRequestException(
        "CSV could not be parsed. Use the provided template.",
      );
    }
    if (rows.length > 120)
      throw new BadRequestException("Maximum 120 monthly records");
    const errors: any[] = [];
    const clean: any[] = [];
    rows.forEach((r, i) => {
      const parsed = z
        .object({
          period: z.string().regex(/^20\d\d-(0[1-9]|1[0-2])$/),
          revenuePaisa: money,
          variableCostPaisa: z.string().regex(/^\d{1,15}$/),
          operatingCostPaisa: z.string().regex(/^\d{1,15}$/),
          openingCashPaisa: z.string().regex(/^\d{1,15}$/),
        })
        .strict()
        .safeParse(r);
      if (parsed.success) clean.push(parsed.data);
      else
        errors.push({
          row: i + 2,
          issues: parsed.error.issues.map(
            (e) => `${e.path.join(".")}: ${e.message}`,
          ),
        });
    });
    if (new Set(clean.map((r) => r.period)).size !== clean.length)
      errors.push({ row: 0, issues: ["Duplicate periods are not allowed."] });
    if (v.confirm && errors.length)
      throw new BadRequestException({
        message: "Fix errors before importing.",
        errors,
      });
    if (v.confirm)
      await tx(async (c) => {
        const b = await one(
          c,
          "SELECT status FROM app.businesses WHERE id=$1 FOR UPDATE",
          [id],
        );
        if (!["draft", "needs-information", "rejected"].includes(b.status))
          throw new ConflictException(
            "Financial records are frozen during review and after publication.",
          );
        for (const r of clean)
          await c.query(
            "INSERT INTO app.financials(id,business_id,period,revenue_paisa,variable_cost_paisa,operating_cost_paisa,opening_cash_paisa,source) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(business_id,period) DO UPDATE SET revenue_paisa=EXCLUDED.revenue_paisa,variable_cost_paisa=EXCLUDED.variable_cost_paisa,operating_cost_paisa=EXCLUDED.operating_cost_paisa,opening_cash_paisa=EXCLUDED.opening_cash_paisa,source=EXCLUDED.source,confirmed=false",
            [
              randomUUID(),
              id,
              r.period,
              r.revenuePaisa,
              r.variableCostPaisa,
              r.operatingCostPaisa,
              r.openingCashPaisa,
              "Owner CSV · fictional records",
            ],
          );
      });
    return { preview: clean, errors, imported: v.confirm ? clean.length : 0 };
  }
  async submit(u: User, id: string) {
    await this.auth.owner(u, id);
    await tx(async (c) => {
      const b = await one(
        c,
        "SELECT * FROM app.businesses WHERE id=$1 FOR UPDATE",
        [id],
      );
      if (!["draft", "needs-information", "rejected"].includes(b.status))
        throw new ConflictException("This application is already submitted.");
      if (b.story.length < 20)
        throw new BadRequestException(
          "Add a business story before submitting.",
        );
      if (
        !(await one(
          c,
          "SELECT id FROM app.documents WHERE business_id=$1 AND status IN ('clean','controlled-sample')",
          [id],
        ))
      )
        throw new BadRequestException(
          "Add a scanned fictional document or the built-in controlled sample.",
        );
      if (
        !(await one(c, "SELECT id FROM app.financials WHERE business_id=$1", [
          id,
        ]))
      )
        throw new BadRequestException(
          "Import at least one monthly financial record before submitting.",
        );
      await c.query(
        "UPDATE app.businesses SET status='submitted',updated_at=now() WHERE id=$1",
        [id],
      );
      await c.query(
        "INSERT INTO app.review_events(id,business_id,actor_id,decision,notes) VALUES($1,$2,$3,'submitted','Owner submitted fictional records for human review.')",
        [randomUUID(), id, u.id],
      );
    });
    return this.business(id, u);
  }
  async review(u: User, id: string, body: unknown) {
    this.auth.role(u, "reviewer");
    await this.auth.independent(u, id);
    const v = validate(
      z
        .object({
          decision: z.enum([
            "needs-information",
            "under-review",
            "approved",
            "rejected",
          ]),
          notes: z.string().min(8).max(4000),
          checks: z
            .array(
              z.object({
                kind: z.enum([
                  "registration",
                  "pan",
                  "ownership",
                  "bank",
                  "financials",
                ]),
                outcome: z.enum(["passed", "needs-information", "failed"]),
                notes: z.string().min(4).max(1000),
              }),
            )
            .optional(),
        })
        .strict(),
      body,
    );
    await tx(async (c) => {
      const b = await one(
        c,
        "SELECT * FROM app.businesses WHERE id=$1 FOR UPDATE",
        [id],
      );
      if (!b) throw new NotFoundException();
      if (
        !["submitted", "under-review", "needs-information"].includes(b.status)
      )
        throw new ConflictException("This application is not in review.");
      if (b.reviewer_id && b.reviewer_id !== u.id)
        throw new ForbiddenException(
          "Another reviewer is assigned to this application.",
        );
      for (const check of v.checks || [])
        await c.query(
          "INSERT INTO app.verification_checks(business_id,kind,outcome,reviewer_id,notes) VALUES($1,$2,$3,$4,$5) ON CONFLICT(business_id,kind) DO UPDATE SET outcome=EXCLUDED.outcome,reviewer_id=EXCLUDED.reviewer_id,notes=EXCLUDED.notes,created_at=now()",
          [id, check.kind, check.outcome, u.id, check.notes],
        );
      if (v.decision === "approved") {
        const checks = (
          await c.query(
            "SELECT kind FROM app.verification_checks WHERE business_id=$1 AND outcome='passed'",
            [id],
          )
        ).rows;
        if (checks.length < 5)
          throw new BadRequestException(
            "Complete all five fictional verification checks before approval.",
          );
      }
      await c.query(
        "UPDATE app.businesses SET status=$2,reviewer_id=$3,updated_at=now() WHERE id=$1",
        [id, v.decision, u.id],
      );
      if (
        v.checks?.some((k) => k.kind === "financials" && k.outcome === "passed")
      )
        await c.query(
          "UPDATE app.financials SET confirmed=true WHERE business_id=$1",
          [id],
        );
      await c.query(
        "INSERT INTO app.review_events(id,business_id,actor_id,decision,notes) VALUES($1,$2,$3,$4,$5)",
        [randomUUID(), id, u.id, v.decision, v.notes],
      );
      await audit(c, u.id, `review.${v.decision}`, id, { notes: v.notes });
    });
    return this.businessDto(
      (await query("SELECT * FROM app.businesses WHERE id=$1", [id]))[0],
      true,
    );
  }
  async analyze(u: User, id: string, body: unknown) {
    this.auth.role(u, "reviewer");
    await this.auth.independent(u, id);
    const v = validate(
      z
        .object({
          provider: z.enum(["fixture", "configured"]).default("fixture"),
        })
        .strict(),
      body || {},
    );
    const b = (
      await query("SELECT * FROM app.businesses WHERE id=$1", [id])
    )[0];
    if (!b || b.reviewer_id !== u.id)
      throw new ForbiddenException(
        "Only the assigned reviewer can prepare analysis.",
      );
    const jobId = randomUUID();
    await query(
      "INSERT INTO app.jobs(id,kind,event_key,payload,status,attempts,leased_until) VALUES($1,'analysis',$2,$3,'running',1,now()+interval '1 minute')",
      [
        jobId,
        `analysis:${jobId}`,
        { businessId: id, preparedBy: u.id, provider: v.provider },
      ],
    );
    try {
      const report = await buildReport(id, u.id, v.provider, jobId);
      await query(
        "UPDATE app.jobs SET status='complete',leased_until=NULL WHERE id=$1",
        [jobId],
      );
      return report;
    } catch (e: any) {
      await query(
        "UPDATE app.jobs SET status='failed',last_error=$2,leased_until=NULL WHERE id=$1",
        [jobId, String(e.message).slice(0, 500)],
      );
      throw e;
    }
  }
  async approveReport(u: User, id: string, body: unknown) {
    this.auth.role(u, "admin", "superadmin");
    this.auth.recent(u);
    const v = validate(
      z.object({ notes: z.string().min(8).max(2000) }).strict(),
      body,
    );
    return tx(async (c) => {
      const r = await one(
        c,
        "SELECT * FROM app.reports WHERE id=$1 FOR UPDATE",
        [id],
      );
      if (!r) throw new NotFoundException();
      if (r.prepared_by === u.id)
        throw new ForbiddenException(
          "A different authorized person must approve this report.",
        );
      await this.auth.independent(u, r.business_id);
      if (r.status === "published") return reportDto(r);
      if (r.status !== "draft")
        throw new ConflictException("Only a draft report may be approved.");
      const result = await one(
        c,
        "UPDATE app.reports SET status='published',approved_by=$2,approved_at=now(),data=jsonb_set(data,'{approvalNotes}',to_jsonb($3::text)) WHERE id=$1 RETURNING *",
        [id, u.id, v.notes],
      );
      await audit(c, u.id, "report.approve", id, {
        version: r.version,
        notes: v.notes,
      });
      return reportDto(result);
    });
  }
  async publish(u: User, id: string, body: unknown) {
    this.auth.role(u, "admin", "superadmin");
    this.auth.recent(u);
    await this.auth.independent(u, id);
    validate(z.object({ confirm: z.literal(true) }).strict(), body);
    await tx(async (c) => {
      const b = await one(
        c,
        "SELECT * FROM app.businesses WHERE id=$1 FOR UPDATE",
        [id],
      );
      if (b.status === "published") return;
      if (b.status !== "approved")
        throw new ConflictException(
          "A reviewer must approve the business first.",
        );
      if (b.reviewer_id === u.id)
        throw new ForbiddenException(
          "Publication requires a separate approver.",
        );
      if (
        !(await one(
          c,
          "SELECT id FROM app.reports WHERE business_id=$1 AND status='published'",
          [id],
        ))
      )
        throw new ConflictException(
          "Approve a reviewed report before publishing.",
        );
      const r = await one(
        c,
        "SELECT * FROM app.rounds WHERE business_id=$1 AND status='draft' FOR UPDATE",
        [id],
      );
      if (!r) throw new ConflictException("A draft round is required.");
      equity(
        {
          existingShares: r.existing_shares,
          sharePricePaisa: r.share_price_paisa,
          targetPaisa: r.target_paisa,
          preMoneyPaisa: r.pre_money_paisa,
        },
        r.min_paisa,
      );
      await c.query(
        "UPDATE app.businesses SET status='published',updated_at=now() WHERE id=$1",
        [id],
      );
      await c.query("UPDATE app.rounds SET status='open' WHERE id=$1", [r.id]);
      await c.query(
        "INSERT INTO app.term_versions(round_id,version,snapshot) VALUES($1,$2,$3)",
        [r.id, r.terms_version, roundDto({ ...r, status: "open" })],
      );
      await audit(c, u.id, "business.publish", id);
    });
    return this.business(id);
  }
  async queue(u: User) {
    this.auth.role(u, "reviewer", "admin", "superadmin");
    const businesses = await query(
      "SELECT * FROM app.businesses WHERE status<>'draft' ORDER BY updated_at DESC LIMIT 100",
    );
    return {
      businesses: await Promise.all(
        businesses.map((b) =>
          this.businessDto(
            b,
            ["admin", "superadmin"].includes(u.role) || b.reviewer_id === u.id,
          ),
        ),
      ),
      reports: (
        await query(
          "SELECT * FROM app.reports WHERE $1::boolean OR prepared_by=$2 OR status='published' ORDER BY created_at DESC LIMIT 100",
          [["admin", "superadmin"].includes(u.role), u.id],
        )
      ).map(reportDto),
      jobs: await query(
        'SELECT id,kind,status,attempts,last_error AS "lastError",created_at AS "createdAt" FROM app.jobs ORDER BY created_at DESC LIMIT 100',
      ),
      deletions: await query(
        'SELECT id,status,details,created_at AS "createdAt" FROM app.deletion_requests ORDER BY created_at DESC LIMIT 100',
      ),
      moderation: await query(
        "SELECT * FROM app.moderation ORDER BY created_at DESC LIMIT 100",
      ),
      support: await query(
        'SELECT id,subject,body,status,created_at AS "createdAt" FROM app.support_requests ORDER BY created_at DESC LIMIT 100',
      ),
    };
  }
  async update(u: User, id: string, body: unknown) {
    await this.auth.owner(u, id);
    const v = validate(
      z
        .object({
          title: z.string().min(4).max(120),
          body: z.string().min(12).max(4000),
          guidelinesAccepted: z.literal(true),
        })
        .strict(),
      body,
    );
    const result = (
      await query(
        "INSERT INTO app.updates(id,business_id,author_id,title,body) VALUES($1,$2,$3,$4,$5) RETURNING id,status",
        [randomUUID(), id, u.id, v.title, v.body],
      )
    )[0];
    return result;
  }
  async approveUpdate(u: User, id: string) {
    this.auth.role(u, "admin", "superadmin");
    this.auth.recent(u);
    const row = (await query("SELECT * FROM app.updates WHERE id=$1", [id]))[0];
    if (!row) throw new NotFoundException();
    await this.auth.independent(u, row.business_id);
    await query("UPDATE app.updates SET status='published' WHERE id=$1", [id]);
    await audit(pool, u.id, "update.publish", id);
    return { published: true };
  }
  async deletion(u: User, body: unknown) {
    validate(z.object({ confirm: z.literal(true) }).strict(), body);
    const id = randomUUID();
    const privateFiles = await query(
      "SELECT storage_path FROM app.documents WHERE uploader_id=$1",
      [u.id],
    );
    for (const file of privateFiles) await removeBytes(file.storage_path);
    await tx(async (c) => {
      await c.query("SELECT id FROM app.users WHERE id=$1 FOR UPDATE", [u.id]);
      const pending = (
        await c.query(
          "SELECT c.* FROM app.commitments c WHERE c.user_id=$1 AND c.status='committed' ORDER BY round_id",
          [u.id],
        )
      ).rows;
      for (const cm of pending) {
        const r = await one(
          c,
          "SELECT * FROM app.rounds WHERE id=$1 FOR UPDATE",
          [cm.round_id],
        );
        const locked = await one(
          c,
          "SELECT * FROM app.commitments WHERE id=$1 FOR UPDATE",
          [cm.id],
        );
        if (locked.status !== "committed") continue;
        await journal(
          c,
          `delete-cancel:${cm.id}`,
          "deletion-cancellation",
          `escrow:${r.id}`,
          `user:${u.id}`,
          BigInt(cm.amount_paisa),
          cm.journal_id,
        );
        await c.query(
          "UPDATE app.commitments SET status='cancelled' WHERE id=$1",
          [cm.id],
        );
        await c.query(
          "UPDATE app.rounds SET committed_paisa=committed_paisa-$2,status='open' WHERE id=$1",
          [r.id, cm.amount_paisa],
        );
      }
      await c.query(
        "DELETE FROM app.document_links WHERE document_id IN (SELECT id FROM app.documents WHERE uploader_id=$1) OR user_id=$1",
        [u.id],
      );
      await c.query("DELETE FROM app.documents WHERE uploader_id=$1", [u.id]);
      await c.query(
        "UPDATE app.businesses SET private_details='{}',founder_name='Former fictional owner' WHERE id IN (SELECT business_id FROM app.memberships WHERE user_id=$1)",
        [u.id],
      );
      await c.query("DELETE FROM app.sessions WHERE user_id=$1", [u.id]);
      await c.query("DELETE FROM app.mail WHERE user_id=$1", [u.id]);
      await c.query("DELETE FROM app.saved WHERE user_id=$1", [u.id]);
      await c.query("DELETE FROM app.notifications WHERE user_id=$1", [u.id]);
      await c.query(
        "UPDATE app.users SET email=$2,name='Deleted user',password_hash=NULL,preferences='{}',deleted_at=now() WHERE id=$1",
        [u.id, `deleted-${u.id}@invalid.local`],
      );
      await c.query(
        "INSERT INTO app.deletion_requests(id,user_id,status,details,completed_at) VALUES($1,$2,'completed','Profile anonymized and local sessions revoked. Pseudonymous simulation ledger retained for reconciliation until this local demo database is reset.',now())",
        [id, u.id],
      );
      if (!localMode()) {
        await c.query(
          "UPDATE app.deletion_requests SET status='processing',completed_at=NULL WHERE id=$1",
          [id],
        );
        await c.query(
          "INSERT INTO app.jobs(id,kind,event_key,payload) VALUES($1,'auth-deletion',$2,$3)",
          [
            randomUUID(),
            `auth-deletion:${u.id}`,
            { userId: u.id, deletionId: id },
          ],
        );
      }
      await audit(c, u.id, "account.delete", id);
    });
    return {
      id,
      status: localMode() ? "completed" : "processing",
      message:
        "Profile anonymized, pending commitments cancelled, and sessions revoked. Pseudonymous simulation accounting history remains for reconciliation.",
    };
  }
  async receipt(u: User, id: string) {
    const cm = (
      await query(
        "SELECT c.*,b.name AS business_name,b.id AS business_id FROM app.commitments c JOIN app.rounds r ON r.id=c.round_id JOIN app.businesses b ON b.id=r.business_id WHERE c.id=$1 AND c.user_id=$2",
        [id, u.id],
      )
    )[0];
    if (!cm) throw new NotFoundException("Receipt not found");
    return {
      ...commitmentDto(cm),
      title:
        cm.status === "issued"
          ? "Nonbinding simulated share certificate"
          : "Nonbinding demo commitment receipt",
      notice:
        "SIMULATION · NO REAL MONEY · NOT A SECURITY · NO LEGAL OWNERSHIP",
      feesPaisa: "0",
      reportId: cm.report_id,
    };
  }
  async reconciliation(u: User) {
    this.auth.role(u, "admin", "superadmin");
    this.auth.recent(u);
    return {
      totalPaisa: (
        await query(
          "SELECT COALESCE(sum(amount_paisa),0)::text AS total FROM app.entries",
        )
      )[0].total,
      unbalancedJournals: await query(
        "SELECT journal_id,sum(amount_paisa)::text AS balance FROM app.entries GROUP BY journal_id HAVING sum(amount_paisa)<>0",
      ),
      negativeAccounts: await query(
        "SELECT a.id,sum(e.amount_paisa)::text AS balance FROM app.accounts a JOIN app.entries e ON e.account_id=a.id WHERE a.kind<>'issuance' GROUP BY a.id HAVING sum(e.amount_paisa)<0",
      ),
      escrowMismatches: await query(
        "SELECT r.id,r.committed_paisa,COALESCE(sum(e.amount_paisa),0)::text AS escrow FROM app.rounds r LEFT JOIN app.entries e ON e.account_id='escrow:'||r.id WHERE r.status IN ('open','funded-awaiting-close') GROUP BY r.id HAVING r.committed_paisa<>COALESCE(sum(e.amount_paisa),0)",
      ),
    };
  }
}
