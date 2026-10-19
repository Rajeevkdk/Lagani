# Architecture and invariants

Lagani is a simulation. Virtual funds cannot be purchased, withdrawn, redeemed or converted to securities. Its only share model is a fixed-price primary issue of ordinary simulated shares with an all-or-nothing target and zero fees.

## Components

- `apps/mobile`: Flutter investor experience, using the same API as the browser. Dart formats integer strings but does not own equity or projection calculations.
- `apps/admin`: React/Vite investor companion, owner workspace and scoped reviewer/admin tools. TanStack Query manages server state.
- `services/api`: NestJS modular server, validated request bodies, application permissions, financial model and PostgreSQL access.
- `supabase/migrations`: versioned application SQL; API migrator is the single migration owner. Supabase auth/storage remain outside the private `app` schema.
- `packages/design-tokens`: branding, theme, spacing and motion reference.

## Deliberate departures from the suggested defaults

Explicit SQL through `pg` replaces Prisma to keep row locks, deferred balanced-journal triggers and append-only constraints visible and testable. This is one PostgreSQL database, not an in-memory replacement. A local credential adapter with verifiable development mail provides loopback development when the Supabase stack is unavailable. Hosted identity uses the configured Supabase adapter; local development credentials must never be enabled on an internet-facing deployment.

Windows can run native PostgreSQL through the pinned npm binary distribution when Docker Desktop is unavailable. Docker remains the cross-platform local option. The initial environment's container engine failed to start; this is recorded separately from native database verification.

## Exact arithmetic

Money crosses JSON as decimal strings of integer paisa. NPR 1 = 100 paisa. Shares are whole integers. The server uses BigInt for transfers and decimal arithmetic for projections/percentages. No daily portfolio price or predicted investment return is invented. Holdings are recorded at cost.

For 800,000 existing shares at NPR 10 and an NPR 2,000,000 raise, a successful close creates 200,000 new shares. NPR 100,000 purchases 10,000 shares, or 1% of the 1,000,000 post-close total. Founder ownership becomes 80%; the new investor group owns 20%.

## Ledger and concurrency

Each transfer writes equal opposite signed entries in one journal. Issuance is a debit-normal account; available, escrow and proceeds are credit-normal accounts. A deferred database constraint checks balance at commit. UPDATE/DELETE triggers protect posted entries and journals. Reversals reference the original journal. Read balances are ledger sums, never client-owned fields.

Commitment transactions lock the investor and round, recheck terms, deadline, profile, balance, membership and capacity, reserve virtual funds, and persist an outbox job atomically. Caller-scoped idempotency keys return the original commitment and reject changed payloads. Successful close uniquely allocates shares and transfers escrow; failed/cancelled rounds reverse reservations. Published terms are frozen.

## Evidence and claims

Reports separate fictional evidence, deterministic calculations, explanatory text and human approval. Fixture output is always labeled synthetic. Configured provider results must pass schema/citation/unsafe-claim checks and separate approval. No probability of business success is displayed. Quotes preserve terms and report references; a new report does not rewrite an earlier receipt.

## Boundaries

Public business responses exclude private documents and internal profile fields. Owner membership is separate from platform role. Owners cannot self-approve or invest in their own business. Reviewers prepare; a separate admin approves publication. Private uploads remain unavailable if scanning fails. A controlled built-in fictional sample is explicitly distinguished from an antivirus-scanned upload.

See TEST-RESULTS.md for actual checks and gaps. Architecture intent is not a certification of complete security coverage.
