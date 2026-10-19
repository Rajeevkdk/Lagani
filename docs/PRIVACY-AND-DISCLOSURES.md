# Simulation, privacy and data inventory — draft

This draft describes the local simulation. Before hosting, the operator must supply its legal name, contact address, support email, deletion URL and retention schedule. Those values are intentionally not invented.

## What Lagani does

Lagani lets adults practice reading fictional business evidence, comparing equity terms and recording virtual commitments. It does not accept deposits, process payments, issue real shares, provide a resale market or guarantee dividends. Virtual funds have no monetary value and cannot be bought, withdrawn or redeemed. Every receipt and certificate is nonbinding. All seeded SMEs, people and records are fictional.

## Data inventory

| Data | Purpose | Location and access | Sharing |
| --- | --- | --- | --- |
| Email, display name, adult/terms confirmations | Account access and simulation eligibility | Private app schema; user and authorized operations | Configured Supabase Auth when enabled |
| Password hash and expiring session/token hashes | Local development authentication | Private database; never client responses | None in local mode |
| Theme, language, motion, notifications preference | Personalization | Account and necessary local preference storage | None |
| Saved businesses, commitments, virtual ledger and share allocations | Simulation state and reconciliation | User-specific API and scoped admin operations | None by default |
| Fictional owner records and uploads | Practice review workflow | Private server storage, authorized owner/assigned reviewer/admin | No identity documents sent to AI |
| Public fictional stories, reviewed financials/reports, approved updates | Discovery and education | Public API after approval | Public within the simulation |
| Support, moderation and deletion requests | Support and privacy workflow | Scoped operations records | None by default |
| Audit events and job status | Authorization trace and recovery | Private database; do not log document content, tokens or URLs | None by default |
| Approved synthetic financial evidence and report prompt | Optional configured explanation provider | Server-side provider request only when deliberately enabled | Configured AI provider; account holder must review processing terms |

No ad SDK, analytics SDK, payment SDK, tracking identifier, contacts, SMS, call logs or location collection is needed. The dependency manifest and actual merged Android manifest must be reviewed before release; this table is not a substitute for artifact inspection.

## Deletion and export

Export and account-deletion controls are available in Profile; the browser deletion route asks the requester to sign in. Deletion revokes local sessions and anonymizes account data, with pending simulation reservations released. Pseudonymous ledger history may remain to preserve double-entry reconciliation in a local scenario; it is not a claim of legally mandated retention. See test results and backend limitations for any remaining cleanup work. Do not host until the implemented cleanup matches the final policy and configured authentication/storage providers.

There is no public production deletion URL yet. A GitHub repository link is not an operational account-deletion service.

## Fictional uploads

Upload only fictional/sample records. Do not upload real citizenship cards, PAN certificates, bank statements or personal identity evidence. Original uploads are quarantined and unavailable for review when malware scanning is unavailable. The built-in generated sample carries a separate controlled-sample label and is never represented as externally verified or antivirus scanned.

## Draft terms

Use the simulation for learning, with fictional information. No simulated allocation creates legal ownership or an investment entitlement. Scenario outputs are conditional calculations based on listed assumptions; they are not probabilities, investment advice or promised returns. Business failure, dilution, illiquidity and the absence of dividends are possible in real equity investing. Accepting demo terms does not establish a real securities contract.

Business stories and updates must avoid personal information, impersonation, harassment, misleading financial claims and unlicensed assets. Reports and approved updates remain subject to human review and moderation. Use the in-app support/report controls for concerns.

## Hosting prerequisites

Use HTTPS, configured production identity with privileged MFA, private storage, scanner availability, bounded logs, backups and tested restoration. Publish an operator-specific privacy policy and define removal/backup expiry periods. Reconcile store Data safety answers against the actual SDKs and deployment. Do not publish local mail access or locally generated demo admin credentials.
