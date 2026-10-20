import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { query, tx, one } from "./db";
import { buildReport } from "./research";
import { supabaseAdmin } from "./auth";
@Injectable()
export class JobWorker implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private inFlight?: Promise<void>;
  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), 700);
    this.timer.unref();
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.inFlight;
  }
  tick(): Promise<void> {
    return (this.inFlight ??= this.runTick().finally(() => {
      this.inFlight = undefined;
    }));
  }
  private async runTick() {
    try {
      const job = await tx(async (c) => {
        const j = await one(
          c,
          "SELECT * FROM app.jobs WHERE ((status='pending' AND run_at<=now()) OR (status='running' AND leased_until<now())) AND attempts<4 ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1",
        );
        if (!j) return null;
        await c.query(
          "UPDATE app.jobs SET status='running',attempts=attempts+1,leased_until=now()+interval '1 minute' WHERE id=$1",
          [j.id],
        );
        return j;
      });
      if (!job) return;
      try {
        if (job.kind === "notification") {
          const p = job.payload;
          await query(
            "INSERT INTO app.notifications(id,user_id,event_key,title,body,link) SELECT $1,$2,$3,$4,$5,$6 WHERE EXISTS(SELECT 1 FROM app.users WHERE id=$2 AND deleted_at IS NULL) ON CONFLICT(event_key) DO NOTHING",
            [randomUUID(), p.userId, job.event_key, p.title, p.body, p.link],
          );
        } else if (job.kind === "auth-deletion") {
          const { error } = await supabaseAdmin().auth.admin.deleteUser(
            job.payload.userId,
          );
          if (error && error.status !== 404) throw error;
          await query(
            "UPDATE app.deletion_requests SET status='completed',completed_at=now() WHERE id=$1",
            [job.payload.deletionId],
          );
        } else if (job.kind === "analysis") {
          await buildReport(
            job.payload.businessId,
            job.payload.preparedBy,
            job.payload.provider,
            job.id,
          );
        } else throw new Error("Unknown durable job kind");
        await query(
          "UPDATE app.jobs SET status='complete',leased_until=NULL,last_error=NULL WHERE id=$1",
          [job.id],
        );
      } catch (e: any) {
        await query(
          "UPDATE app.jobs SET status=CASE WHEN attempts>=4 THEN 'failed' ELSE 'pending' END,leased_until=NULL,run_at=now()+(attempts*attempts)*interval '5 seconds',last_error=$2 WHERE id=$1",
          [job.id, String(e.message).slice(0, 300)],
        );
      }
    } catch (error) {
      console.error("Durable worker unavailable; jobs remain persisted.");
    }
  }
}
