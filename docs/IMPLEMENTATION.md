# Implementation status

Last audited 19 October 2026. Checked source/features and measured runtime evidence are separate. See TEST-RESULTS.md for exact coverage and known gaps.

| Phase | Implemented | Verification and remaining work |
| --- | --- | --- |
| Foundation | Flutter/React/NestJS/PostgreSQL layout; pinned lock files; migrations; eight fictional businesses; original art/fonts/tokens | Native PostgreSQL works. Docker engine unavailable; hosted Supabase unverified. |
| Public discovery | Investor home/explore/detail, search/filter, saves, compare, reviewed reports and projection tables | Browser discovery/offline/mobile-width flow passes. Client paging beyond first API page remains. |
| Accounts | Local registration/verification/reset/logout, adult profile, preferences, export, deletion | Backend and browser flows pass. Hosted recovery/MFA/deletion needs full integration verification. |
| Owner/review | Saved drafts, financial CSV preview/import, sample/quarantine evidence, information/resubmission, checks, editable draft report, separate approval/publication | Full browser workflow passes. TUS/byte-range uploads and forecast-vs-actual dashboard remain. |
| Exact simulation | Integer paisa, share math, quotes, row locks, idempotency, balanced immutable journals, close/issuance/refund, receipts | 9 unit + 18 real PostgreSQL tests pass. Browser commitment/cancel/deletion passes. |
| Experience/operations | Themes, core mobile English/Nepali resources, reduced motion, inbox, learning, owner updates, moderation, jobs/reconciliation | Browser preference/reconciliation checks and 9 Flutter tests pass. Dynamic localization and full native accessibility/performance review remain. |
| Handoff/release | CI, API contracts, walkthrough, privacy/store/data-safety drafts, screenshots, Android source/signing config | See TEST-RESULTS.md and PLAY-RELEASE.md. Device, hosting, signing and Console tasks are not complete. |
| GitHub | Repository created at Rajeevkdk/Lagani with requested description | Source publication being completed and verified. |

## Decisions

SQL with pg replaces Prisma to expose lock/ledger invariants. A durable PostgreSQL outbox/lease worker uses the same domain service. Loopback local credentials allow reproducible testing without paid hosting. These departures are documented in ARCHITECTURE.md and backend.md. This implementation contains no switch to real money.
