# Verification record

Measured locally on Windows and in GitHub Actions on Ubuntu, 20 October 2026. This is a working local web/API/PostgreSQL simulation with Flutter source and passing widget checks. It is not a verified hosted or Play release.

## Executed checks

| Check | Result | Evidence / boundary |
| --- | --- | --- |
| API + React production builds | PASS | TypeScript compile and Vite production bundle completed. |
| TypeScript checks | PASS | API and browser checks. |
| Backend unit tests | 9/9 PASS | Exact equity example, large integers, invalid terms/deadlines, projection cash/profit, provider claim validation, file signatures. |
| PostgreSQL integration | 18/18 PASS | Real PostgreSQL 18.4; transaction races, append-only ledger, no overspend/overfill, idempotency, close/cancel races, retry-safe allocation/refund, scopes, private links, deletion bytes, report job deduplication, outbox and reconciliation, real HTTP investor flow. |
| Browser end-to-end | 3/3 PASS | Chromium via Playwright 1.56.1, actual React → NestJS → PostgreSQL. GitHub Actions completed all three journeys in 33.8 seconds, including draft report editing and cross-user content moderation. |
| Design token contrast | 14/14 PASS | Specified foreground/background pairs exceed 4.5:1. This is not a full accessibility audit. |
| Flutter unit/widget | 9/9 PASS | Exact money/time, language-key parity, intro, navigation/auth gate, Nepali dark 200% text, deliberate quote acknowledgment and single submission. Fake API in widget tests. |
| Flutter analysis | PASS | No issues found after fixes. |
| Flutter formatting | PASS | lib, test and integration_test formatted. |
| Android native integration | NOT RUN | adb reports no attached devices. Native smoke source is supplied. |
| Android packaging | DEBUG APK PASS | assembleDebug completed: 242 tasks, 2m 48s. Debug-only APK; no signed production AAB or device-install claim. |
| Remote CI | PASS | [Run 39432822301](https://github.com/Rajeevkdk/Lagani/actions/runs/39432822301), source commit 633a9a4: type checks, production builds, 14 contrast pairs, 9 unit tests, migrations/seed, 18 PostgreSQL tests and all 3 browser journeys passed. Both jobs completed successfully: API/browser in 2m 3s; Flutter formatting, analysis, 9 tests and unsigned app-bundle build in 5m 37s. |

## Browser stories and evidence

1. Guest discovers fictional businesses, uses empty search and comparison, opens a reviewed projection table, views a 390 px layout and recovers from an intentionally aborted API request.
2. New user registers, retrieves local verification mail, verifies, logs in, accepts adult/simulation profile terms, saves a business, obtains the server's 1% quote for NPR 100,000, explicitly acknowledges, commits, reloads persistent portfolio, views a nonbinding receipt, cancels, persists dark/Nepali/reduced-motion settings and deletes the account through the public route.
3. Owner creates/saves a fictional draft, previews/imports financial CSV, attaches a controlled sample and submits. Reviewer requests information; owner amends and resubmits; reviewer records checks and prepares an explicitly synthetic report. A separate admin approves and publishes. The reviewer edits draft findings before separate approval. Owner update moderation, zero-sum ledger reconciliation, user content reporting and admin removal from discovery complete the journey.

Actual web captures are in screenshots/01-home.png through 11-admin.png. They are web-companion captures, not claimed Android Play screenshots. Tests add synthetic accounts/businesses to the local demonstration DB. Traces and generated passwords are ignored by Git.

## Fixes discovered during verification

- Restarted an obsolete Vite process after dependency replacement.
- Connected an unfinished reviewer report editor and corrected the account-deletion route.
- Added explicit table header scope for accessible projection headers.
- Raised small web label text and touch targets; verified no horizontal overflow at 390 px.
- Fixed Flutter loading-card overflow on short screens.
- Corrected widget-test asset loading outside the fake async clock and scrolled lazily rendered controls into view.
- Fixed local Android SDK selection and isolated tooling/cache paths from protected directories.

- Fixed Linux integration teardown by using the API module cache consistently and closing database pools before dropping the isolated database. Background worker shutdown now drains its active operation.
- Fixed stale cross-user moderation results by refetching the admin queue when switching workspace tabs. The regression is exercised by the full browser journey.

## Android CI build evidence

[Run 39432822301](https://github.com/Rajeevkdk/Lagani/actions/runs/39432822301) passed Flutter formatting, analysis, all 9 tests and the release app-bundle build. Its `unsigned-build-check-only` artifact uses `https://example.invalid/api`: it proves compilation only, not signing, installation, hosting or a working release backend.

## Remaining implementation and environment gaps

These are visible limitations, not completed phases disguised as configuration:

- Hosted Supabase auth recovery/MFA/revocation/deletion and private storage have not been exercised. The local verified-email adapter is loopback-only and is not a public-hosting fallback.
- No running ClamAV daemon in this environment. Arbitrary uploads stay quarantined or fail closed; the controlled fictional sample is explicitly a separate source. No antivirus success claim.
- Upload retry sends the complete small file again. Byte-range/TUS resumption and native byte-level upload progress are not implemented.
- Native device integration, 16 KB/64-bit artifact inspection, screen-reader/lifecycle/performance/crash checks and Android screenshots remain unverified. No measured frame-rate claim.
- Core mobile resources are bilingual; dynamic server errors/statuses and owner-provided narratives are not fully localized. The web admin workspace is primarily English. Financial/legal Nepali copy needs fluent review.
- Public list pagination exists at the API, but clients currently load the first page; large-catalog paging UX needs completion.
- Owner forecast-versus-reported dashboard, richer milestones and per-update reporting are limited; business-level moderation and approved updates exist.
- External AI and push credentials are absent. Fixture reports and durable in-app notifications work; configured-provider outcomes and push delivery were not tested.
- Public HTTPS hosting, permanent app ID, operator details, signing key, Play account/testing/declarations and a human security review remain required before distribution.

See PLAY-RELEASE.md for the release handoff and backend.md for backend invariants. No real money or real shares are supported.
