# Backend implementation and operations

Lagani is a local equity simulation. The backend never handles payments, real balances, redemption or actual securities. All eight seeded SMEs, identity samples and financial evidence are fictional. New investors receive NPR 1,000,000 of virtual funds through one idempotent, balanced issuance journal.

## Run

Requires Node 24.13.1 (22.12+ supported), PostgreSQL 18.4 verified, and a loopback development host. From the repository:

```powershell
npm --prefix services/api ci
npm --prefix services/api run db:migrate
npm --prefix services/api run db:seed
npm --prefix services/api run dev
```

Run commands from `services/api` if using an `.env` there; dotenv resolves against the process working directory. Default database URL is the local-only URL in `.env.example`. API listens at `127.0.0.1:4000/api`. `/health`, `/ready`, `/docs`, and `/docs-json` are available below that prefix. Native PostgreSQL or the repository compose service can be used; tests require an actual PostgreSQL server, not an in-memory replacement.

Seed creates random local passwords and writes `services/api/.local/demo-accounts.json` when invoked with that working directory. The file is ignored by Git and must never be published. Accounts are `investor@lagani.local`, `owner@lagani.local`, `reviewer@lagani.local`, `admin@lagani.local`, and `superadmin@lagani.local`. Reviewer and administrator are different people for the review/approval demonstration. Seed identities are explicitly preverified development fixtures; new registrations must consume their actual local verification mail token. `GET /dev/mail?email=...` is the loopback mail interface. Local mode refuses public binding and production startup.

The initial ledger grant is fixed and cannot be changed via an API. Scenario investors fund the seeded histories. Paila is partially funded, Punar is fully subscribed and awaits authorized closure, Akshar has issued simulated shares, and Hariyo failed and refunded. Dhago needs information, Ujyalo is under review, and Setu is rejected with a reason. Seed is idempotent and does not reset a used database. To start another clean scenario, create a **new isolated database**, migrate, and seed it; do not erase history from the running demonstration.

## Architecture and calculation rules

NestJS modules share domain services with the in-process durable worker. `pg` and versioned SQL are the **single migration owner of the private `app` schema**. This departs from Prisma to keep deferred balanced-journal constraints, PostgreSQL row locks and append-only triggers explicit and reviewable. Supabase-managed `auth` and `storage` schemas are never migrated by application scripts. Application schema access is revoked from PUBLIC. A hosted deployment should use a restricted runtime database role and separate migration role rather than the development database owner.

Every monetary value is integer paisa encoded as a decimal string across HTTP. 100 paisa = NPR 1. Commitments use whole shares. The published minimum and increment are enforced server-side. Demo fees are zero and stored in the quote/receipt view. Example: 800,000 founder shares × NPR 10 = NPR 8,000,000 pre-money; NPR 2,000,000 target creates 200,000 shares; NPR 100,000 buys 10,000 shares and 1% of 1,000,000 post-close shares. Pending commitments never appear as issued holdings. Holdings retain historical cost.

Ledger accounts are issuance (debit-normal), investor available (credit-normal), round escrow (credit-normal), and business proceeds (credit-normal). A transfer records equal signed outflow/inflow entries; a deferred PostgreSQL trigger rejects unbalanced journals. Entries/journals cannot be updated or deleted. Reversals reference original journals. User locks serialize spending; round locks serialize capacity and closure. Idempotency keys are scoped to a user; payload changes conflict. Successful close, issuance, cap-table event and proceeds transfer share one transaction. Cancellation/refund writes new reversal entries. A round can be cancelled before close; an underfunded round fails only at/after its deadline. An investor can cancel until successful close; target fulfillment then reopens.

Notification outbox jobs are committed in the same transaction as financial actions. The worker uses `FOR UPDATE SKIP LOCKED`, one-minute leases, bounded retries and quadratic delay, with an authorized retry route. Notification event keys prevent duplicate delivery. Report jobs carry a unique report source-job ID so a crash/redelivery cannot create another report version. Terminal failures retain a non-secret error summary.

Monthly projections use decimal arithmetic and half-up paisa rounding. Revenue is driven by explicit growth; variable cost uses the last observed ratio; operating costs, working capital, capex, tax, debt service and financing are explicit. Profit and cash movement are distinct. Missing financial records return missing outputs, never invented zeros. Scenarios are conditional illustrations, not confidence intervals. Reports retain source snapshots, evidence identifiers, assumptions, model/prompt/calculation versions and separate approval identity. No success probability is produced.

## Private files and research boundaries

Uploads are restricted to 5 MB, supported extension/MIME and matching content signatures, saved under random identifiers, then quarantined. ClamAV `INSTREAM` runs before ordinary uploads become reviewable. Scanner error/outage remains `scanner-unavailable`, with download blocked. A built-in **controlled sample** is fixed server-generated plain text with a distinct integrity-checked status. It is never described as antivirus-scanned. Production scanning and scanner signature updates need an operated ClamAV service. Retry scanner action is available to administrators.

Private download tokens expire in two minutes and require the authorized Bearer user again. Reviewers may open only assigned business documents. Queue rows for unassigned applications omit private details/documents. Local files reside in ignored `.local/documents`. With `AUTH_MODE=supabase`, the server uses official Supabase private Storage APIs and the server-only service key; create a private `fictional-documents` bucket before use. There are no public storage URLs or keys in clients.

Fixture research is deterministic, labeled as demo analysis with fictional evidence, and fully usable without credentials. The optional OpenAI official SDK adapter sends only bounded synthetic business/financial records, validates schema and evidence IDs, rejects unsupported guarantees, sets a timeout/output-token budget and daily job limit, and retains provider failure rather than silently replacing it. No arbitrary URL fetcher or live web-research claim exists. Provider credentials and actual live calls were not available during local verification.

## Identity, privacy and remaining hosted work

Local passwords use bcrypt; opaque sessions and one-use mail tokens are persisted as SHA-256 hashes, with raw mail tokens confined to the loopback inbox until consumed. Sessions expire after 12 hours. Password reset revokes sessions. Privileged financial/publication actions require a session less than 15 minutes old; sign in again when requested. Roles cannot be self-assigned. Supabase mode verifies tokens through official `auth.getUser` and requires `aal2` MFA assurance for privileged roles. Hosted operator enrollment and recovery need deliberate Supabase configuration and live verification before use; there is no public privilege grant route.

Account deletion cancels pending commitments, revokes local sessions, deletes private uploaded bytes and document links/metadata, clears private business details, anonymizes email/name, and records completion. Pseudonymous accounting and audit identifiers remain until the isolated local demo database is retired, for reconciliation; this is a product policy, not an invented legal retention duty. Old notification jobs do not recreate a deleted person's inbox. A hosted deployment must choose a concrete retention period and operate backup expiry before collecting actual personal data.

Hosted Supabase reset/recovery callbacks, MFA enrollment UI, global token revocation/deletion against a configured Supabase project, real provider calls, resumable object uploads and distributed API throttling are **not verified local journeys**. The local loopback flow, fixed sample flow and full PostgreSQL simulation are the verified scope. Do not publish the loopback mail interface or local demo credentials. Native scanner installation and Android networking are documented separately by the repository setup/release material.

## Verification

Commands: `npm test`, `npm run test:integration`, `npm run typecheck`, `npm run build`, `npm audit`. Integration tests create/drop an isolated `lagani_test_<timestamp>` database, leaving the interactive demo untouched; the test database user needs CREATE DATABASE permission. The suite covers real PostgreSQL transactions, locks, balancing, races, duplicate keys, refunds, issuance, privacy and role boundaries, owner review/publication, notification redelivery, and a real HTTP investor journey. See `TEST-RESULTS.md` for the recorded result rather than treating this description as execution evidence.

Official references checked during implementation: [NestJS](https://docs.nestjs.com/), [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html), [Supabase server user verification](https://supabase.com/docs/reference/javascript/auth-getuser), [OpenAI Responses](https://platform.openai.com/docs/api-reference/responses).
