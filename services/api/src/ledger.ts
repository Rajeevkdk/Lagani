import { randomUUID } from "node:crypto";
import { ConflictException } from "@nestjs/common";
import { DbClient, one } from "./db";
export async function balance(c: DbClient, account: string) {
  return BigInt(
    (
      await one(
        c,
        "SELECT COALESCE(sum(amount_paisa),0)::text AS amount FROM app.entries WHERE account_id=$1",
        [account],
      )
    ).amount,
  );
}
export async function journal(
  c: DbClient,
  key: string,
  kind: string,
  from: string,
  to: string,
  amount: bigint,
  reversalOf?: string,
) {
  if (amount <= 0n) throw new ConflictException("Transfer must be positive");
  const id = randomUUID();
  await c.query(
    "INSERT INTO app.journals(id,operation_key,kind,reversal_of) VALUES($1,$2,$3,$4)",
    [id, key, kind, reversalOf ?? null],
  );
  await c.query(
    "INSERT INTO app.entries(journal_id,account_id,amount_paisa) VALUES($1,$2,$3),($1,$4,$5)",
    [id, from, (-amount).toString(), to, amount.toString()],
  );
  return id;
}
export async function issueInitial(c: DbClient, userId: string) {
  await c.query(
    "INSERT INTO app.accounts(id,kind,normal_balance) VALUES('demo-issuance','issuance','debit') ON CONFLICT DO NOTHING",
  );
  await c.query(
    "INSERT INTO app.accounts(id,kind,user_id,normal_balance) VALUES($1,'available',$2,'credit') ON CONFLICT DO NOTHING",
    [`user:${userId}`, userId],
  );
  if (
    !(await one(c, "SELECT id FROM app.journals WHERE operation_key=$1", [
      `initial:${userId}`,
    ]))
  )
    await journal(
      c,
      `initial:${userId}`,
      "demo-issuance",
      "demo-issuance",
      `user:${userId}`,
      100000000n,
    );
}
export async function createRoundAccounts(c: DbClient, roundId: string) {
  await c.query(
    "INSERT INTO app.accounts(id,kind,round_id,normal_balance) VALUES($1,'escrow',$2,'credit'),($3,'proceeds',$2,'credit') ON CONFLICT DO NOTHING",
    [`escrow:${roundId}`, roundId, `proceeds:${roundId}`],
  );
}
