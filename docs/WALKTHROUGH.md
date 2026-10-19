# Reproducible local walkthrough

Run the setup in the root README. Only synthetic data is permitted. The initial issuance is **NPR 1,000,000 virtual funds per account**, recorded once through the ledger. No purchase or withdrawal exists.

## Investor

1. Open the home page without signing in. Browse Paila Parcel Collective and Sajha Millet Pantry; read the simulation label.
2. Create an account, open **Read local development mail**, and submit its verification token. Sign in. This consumes a real, persisted, expiring local verification message.
3. Open Profile, affirm adulthood and accept the simulation terms. The checkboxes are not preselected for a new account.
4. Explore by sector/location, bookmark a business and add up to three to the comparison tray. Default discovery order follows the seeded editorial collection, never a success prediction.
5. Open Paila, read Research, switch scenarios and expand the accessible projection table. The evidence is visibly fictional.
6. Enter NPR 100,000. The server quote shows 10,000 simulated shares and **1.000000%** ownership at successful full close. Read the terms version and risk acknowledgment; deliberately confirm.
7. Reload Portfolio. The amount remains reserved and the shares remain pending. Open the nonbinding receipt. Cancel before close to release virtual funds; inspect Activity and Inbox.

## Owner → reviewer → separate admin

1. From Profile or the sidebar, open Owner workspace. Any ordinary user can create a fictional business; they cannot assign platform privileges.
2. Create a draft and save its story, sample registration, controllers and fixed share terms. Leave the workspace and return to verify persistence.
3. Paste the supplied synthetic financial CSV. Validate and inspect the preview before confirming the import. Invalid rows block import; discarding a preview does not change persisted financials.
4. Attach the **controlled fictional sample**. This is allowlisted plain text with a distinct integrity status. For arbitrary sample uploads, start ClamAV using `docker compose --profile scanner up -d clamav`; scanner unavailability must keep uploads quarantined and prevent download.
5. Submit for human review. Sign in separately as the seeded reviewer using the locally generated password. Open the application, begin review, request missing information, and record why.
6. Return as owner, amend the requested information and resubmit. The assigned reviewer inspects each of five fictional checks, records notes, approves the checks and explicitly runs fixture analysis.
7. Sign in as the separate admin. Approve the report, then publish the approved opportunity. Self-approval and owner self-investment are rejected server-side.
8. The owner can submit a fictional update; an admin separately approves it before it becomes public.

## Close and refund scenarios

| Fictional business | Seeded scenario | What to inspect |
| --- | --- | --- |
| Paila Parcel Collective | Open, NPR 1,240,000 committed of NPR 2,000,000 | Quote, reserve, cancel |
| Sajha Millet Pantry | Open, NPR 280,000 committed | A second discovery/commitment example |
| Punar Repair Works | Full target, awaiting close | Admin all-or-nothing close issues shares once |
| Akshar Learning Studio | Successfully closed | Historical share allocations and proceeds |
| Hariyo Terrace Growers | Failed/refunded | Investor activity shows reservation and reversal |
| Dhago Loom Studio | Needs information | Owner response and private sample evidence |
| Ujyalo Solar Care | Under review | Reviewer workflow |
| Setu Cool Routes | Rejected | Useful missing-cost explanation |

The last three are private applications, not public opportunities. Use the owner/reviewer accounts to inspect them. Do not expose a rejected application merely to inflate the public business count.

On admin close, a fully subscribed round issues simulated shares; an underfunded expired round refunds. An open underfunded round cannot be successfully closed. Explicit admin cancellation also refunds. Repeated close/refund operations cannot duplicate shares or funds. Reconciliation should report total signed ledger entries of zero, with no unbalanced journals, negative non-issuance accounts or escrow mismatches.

## Preferences and deletion

Change theme, language and motion in Profile and reload. Use Export to retrieve your own simulation data. Both Profile deletion and `/delete-account` verify the requester through authentication. Deletion revokes sessions and anonymizes the profile; see the privacy draft for retained pseudonymous accounting and hosting limitations.

## Reset and recovery

Re-running the seed does not overwrite history. To replay a pristine scenario, create a separate local database and set `DATABASE_URL`, then migrate/seed it. Never erase another user's scenario through the public UI. Back up the database and private storage together; restore into an isolated local environment and run reconciliation before allowing writes. No public hosting or paid resources are provisioned here.
