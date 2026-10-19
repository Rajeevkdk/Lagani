# Android and Play release handoff

This is a working local simulation under development. No Play Console submission, public hosting or signed release has been performed.

## Current-source check — 19 October 2026

- [Target API policy](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en): ordinary new apps/updates must target API 36 from 31 August 2026. This project targets 36. Recheck at submission.
- [16 KB compatibility](https://developer.android.com/guide/practices/page-sizes): inspect every native library and the final bundle; configuration alone is not evidence. Exercise a 16 KB emulator/device and archive the alignment and runtime results.
- [Personal-account testing](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en): account-specific closed-testing and production-access requirements must be completed in the owner's Console; no testers or elapsed test period are claimed here.
- [Account deletion](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en): both app and web request paths are needed. Local routes work; the public HTTPS deletion and privacy URLs still need an operator and hosting.
- [Financial declaration](https://support.google.com/googleplay/android-developer/answer/13849271?hl=en) and [financial services policy](https://support.google.com/googleplay/android-developer/answer/9876821?hl=en): accurately disclose the educational equity simulation. No banking, actual investing, lending, crypto or payment functionality exists. Do not infer an exemption or regulatory approval.

## Release checklist

- [x] Temporary ID, version, Lagani label/vector icon, bundled fonts and API 36 configuration.
- [x] No payment gateway, real securities, ads, paid virtual currency or hidden live mode.
- [x] Optional upload signing; no release fallback to debug signature.
- [x] HTTPS-only release requests; debug-only local cleartext permission.
- [x] Source includes investor app, owner workspace, deletion/support paths and localized core navigation/forms.
- [ ] Permanent application ID and operator legal/contact details approved by owner.
- [ ] Hosted Supabase identity/storage, recovery redirects, privileged MFA and full deletion verified.
- [ ] Real scanner enabled; live-provider data handling reviewed if enabled.
- [ ] Signed AAB and release smoke on physical or emulated Android.
- [ ] 64-bit/16 KB alignment, merged manifest, lifecycle recovery, crash/ANR and TalkBack checks.
- [ ] Frame timing/memory measured on an identified midrange device; no 60 fps claim is made.
- [ ] Store screenshots captured from the actual Android artifact. Repository screenshots currently show the web companion.
- [ ] Data safety, Financial features, content rating, app access and account-specific testing completed in Console.
- [ ] Fluent Nepali review of financial/legal terminology and backend error translations.
- [ ] Stable limited investor reviewer account provisioned for hosted review; never a public admin bypass.

## Draft listing

**Title:** Lagani — Equity Practice

**Short description:** Explore fictional Nepali businesses and practice equity with virtual money.

**Full description:** Learn how business ownership works through fictional Nepal-based SMEs. Discover business stories, inspect reviewed sample evidence, compare conditional financial scenarios, and practice a simulated equity commitment. Follow pending commitments and issued simulated shares, explore a portfolio recorded at cost, and learn about dilution, risk and illiquidity. Owners can prepare fictional business submissions for human review.

Lagani is a free educational simulation for adults. Virtual funds cannot be purchased, withdrawn, redeemed or converted into actual securities. Receipts are nonbinding. Reports illustrate assumptions using synthetic evidence; they are not investment advice, guarantees or success probabilities. There are no real payments, loans, secondary trades or crypto assets.

**Support email:** OWNER TO PROVIDE. **Operator/legal name:** OWNER TO PROVIDE. **Privacy URL:** HOST TO PROVIDE /privacy. **Deletion URL:** HOST TO PROVIDE /delete-account. Do not submit placeholder values.

## Data safety preparation

| Data / SDK | Actual purpose and treatment |
| --- | --- |
| Email, name, adult/terms flags | Account access and simulation eligibility; local passwords hashed. Hosted Auth needs separate verification. |
| Preferences and saves | Personalization, secure sessions, public cache. No advertising ID or location permission. |
| Virtual ledger, commitments, report snapshots | Simulation history and reconciliation; deletion anonymizes personal profile while preserving pseudonymous accounting history. Operator must set a justified retention schedule. |
| Fictional owner evidence | Private/quarantined upload; scanner fail-closed; no real identity/banking records permitted. |
| Support/moderation/inbox | Service requests and durable status notifications. No push SDK configured. |
| Flutter secure storage/shared preferences/http/file picker | Session protection, settings/public cache, API transport and user-selected files. Recheck merged permissions and platform data behavior in final artifact. |
| Supabase/OpenAI server adapters | Unconfigured in tested local mode. Enabling providers changes processing/sharing disclosures; review contracts, retention and deletion before use. |

No analytics/crash-reporting/advertising SDK is included. Do not mark every Data safety field “not collected”: account and app activity data are transmitted to the API. Console answers must reflect the deployed configuration.

## Reviewer access

For local review use the random ignored seed credentials and WALKTHROUGH.md. For hosted review create a dedicated verified investor account with limited owner capability, no privileged platform role, stable access and fictional-only records. Supply credentials securely through Play's App access form, along with the actual login and simulation steps. Public signup must never allow reviewer/admin self-assignment.

## Artifact inspection commands

After a successful release build, inspect the AAB with bundletool and Android APK Analyzer, enumerate merged permissions, validate ARM64 libraries with the Android 16 KB guide, install generated APKs on the identified device, run the integration test and capture frame timings. Record artifact SHA-256, SDK/NDK/Flutter versions, device/API/page size, commands and outputs in TEST-RESULTS.md. A signed artifact requires owner-supplied credentials.
