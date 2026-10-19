# Lagani API v0.1

Base: `http://127.0.0.1:4000/api`. OpenAPI routes: `/api/docs` and `/api/docs-json`. Auth: `Authorization: Bearer <accessToken>`. JSON errors: `{error:{code,message,requestId}}`. Money and share quantities are decimal **strings**; 100 paisa = NPR 1. All timestamps are UTC ISO strings. Display Nepal time in clients.

`GET /businesses?q=&sector=&location=&status=&sort=name&cursor=0` returns `{items:Business[],nextCursor,lastUpdated,ordering}`. Default stable order is newest fictional business, never success probability. `GET /businesses/:id` returns Business. Business: `{id,name,tagline,sector,location,story,founderName,status,stage,illustration,color,risks:string[],fundingUse:string[],financials,round,report,updates,simulation:true}`. Financials: `{id,period,revenuePaisa,variableCostPaisa,operatingCostPaisa,openingCashPaisa,source,confirmed}`. Round: `{id,businessId,status,targetPaisa,committedPaisa,sharePricePaisa,existingShares,preMoneyPaisa,targetShares,minPaisa,incrementPaisa,termsVersion,deadline,closedAt}`. Reports include `executiveSummary,materialRisks,missingData,reviewerQuestions,evidence,scenarios,assumptions,formulas,provider,model,calculationVersion,status,version,approvedAt`. Each scenario has 12 monthly rows with profit and opening/closing cash in paisa.

## Auth and profile

- `POST /auth/register {email,password,name}`; minimum password 10 characters. Returns `verificationRequired:true`. Local development uses **actual persisted mail tokens** accessible at `GET /dev/mail?email=...` -> `{messages:[{kind,token,createdAt,expiresAt}]}`. `POST /auth/verify {token}` consumes a verification token. Both local mail and local auth fail outside loopback development.
- `POST /auth/login {email,password}` -> `{accessToken,expiresIn,user}`. New users must verify email. Supabase mode uses official `getUser` server verification.
- `POST /auth/reset-request {email}`, `POST /auth/reset {token,password}`, `POST /auth/logout`. Reset revokes local sessions. Supabase reset email is supported; hosted recovery callback needs client wiring.
- `GET /me` -> `{id,email,name,role,adultConfirmed,termsAccepted,preferences,availablePaisa,simulation}`. `PATCH /me {name?,adultConfirmed?,termsAccepted?,preferences?:{theme:'light'|'dark'|'system',language:'en'|'ne',motion:'full'|'reduced'|'system',notifications:boolean}}`. Unknown fields, including role, are rejected.
- `GET /me/export`. `POST /me/deletion {confirm:true}` -> `{id,status,message}`. `GET /deletion/:id` returns processing status. Public deletion page must verify by sign-in, then call this same route.
- `GET /saved` -> `{businessIds:[]}`; `POST /saved/:id` toggles -> `{saved:boolean}`.

## Investor transactions

- `POST /rounds/:id/quote {amountPaisa}` -> `{id,roundId,amountPaisa,shares,totalShares,ownershipPercent,postMoneyPaisa,newInvestorPercent,feesPaisa:'0',termsVersion,expiresAt,availablePaisa,notice}`. Adult profile and terms required. Quote expires after 5 minutes. Ownership is indicative at successful full close.
- `POST /commitments {quoteId,riskAcknowledged:true,idempotencyKey}` -> `{id,userId,roundId,businessId?,businessName?,amountPaisa,shares,termsVersion,status,createdAt,simulation:true}`. Keys are scoped to caller; identical retry returns original; changed content conflicts.
- `POST /commitments/:id/cancel` permits cancellation until successful close; restores funds and capacity atomically. `GET /commitments/:id/receipt` returns a visibly nonbinding receipt/certificate payload with immutable report/terms reference.
- `GET /portfolio` -> `{availablePaisa,committedPaisa,investedPaisa,holdings:[{id,commitmentId,businessId,businessName,shares,costPaisa,totalShares,ownershipPercent,issuedAt,color,illustration}],commitments:[],valuationBasis,simulation}`.
- `GET /activity` -> `{items:[{id,type,title,amountPaisa,createdAt,reversalOf}]}`. Signed amount distinguishes debit/credit.
- `GET /notifications` -> `{items:[{id,title,body,link,readAt,createdAt}]}`; `POST /notifications/:id/read`.

## Owner

- `GET /owner/businesses` -> `{items:Business[]}` with `privateDetails,timeline,documents,checks`.
- `POST /owner/businesses {name,sector,location,tagline?,story?,founderName?}` creates membership on server. `PATCH /owner/businesses/:id` updates draft content, `privateDetails:{registration,pan,controllers,bankOwnership}`, `risks`, `fundingUse`, optional `round:{targetPaisa,sharePricePaisa,existingShares,preMoneyPaisa,minPaisa,incrementPaisa}`. Terms freeze on submission/publication.
- `GET /financials/template` -> `{csv,units}`. `POST /owner/businesses/:id/financials {csv,confirm:false}` previews validated rows/errors; `confirm:true` atomically imports only valid data. Columns: `period,revenuePaisa,variableCostPaisa,operatingCostPaisa,openingCashPaisa`.
- `POST /owner/businesses/:id/documents {name,mimeType,contentBase64,fictionalAcknowledged:true}` limits to 5MB PDF/PNG/JPEG/plain text with content validation. Quarantined until ClamAV clean. Scanner outage returns `scanner-unavailable` and blocks access.
- `POST /owner/businesses/:id/documents/sample` creates a fixed server-generated plain text sample. Status is **controlled-sample**, integrity validated; no claim of antivirus scan.
- `POST /documents/:id/link` -> `{url,expiresIn:120}`. Fetch returned URL with **Bearer header**; authorization checked again and download not cached.
- `POST /owner/businesses/:id/submit`; needs story, financial record and allowed document. `POST /owner/businesses/:id/updates {title,body,guidelinesAccepted:true}` queues moderation.

## Reviewer/admin

- `GET /admin/queue` -> `{businesses,reports,jobs,deletions,moderation,support}`.
- Assigned reviewer only: `POST /admin/businesses/:id/review {decision:'under-review'|'needs-information'|'approved'|'rejected',notes,checks?:[{kind:'registration'|'pan'|'ownership'|'bank'|'financials',outcome:'passed'|'needs-information'|'failed',notes}]}`. First reviewer claims assignment. Final approval requires all five explicit fictional checks; no provider claim.
- Assigned reviewer: `POST /admin/businesses/:id/analysis {provider:'fixture'|'configured'}` -> draft report. Configured provider fails clearly on absent credentials/output failure; no silent fallback.
- Separate admin: `POST /admin/reports/:id/approve {notes}`; `POST /admin/businesses/:id/publish {confirm:true}` requires reviewer approval plus approved report.
- `POST /admin/rounds/:id/close {confirm:true}` succeeds only at full target or fails/refunds after deadline. `POST /admin/rounds/:id/cancel {confirm:true,reason}` explicitly refunds before close. Both are retry safe and conflict-of-interest checked.
- `POST /admin/updates/:id/approve`; `POST /admin/documents/:id/rescan`; `POST /admin/jobs/:id/retry`; `GET /admin/reconciliation`.
- `POST /support {subject,body}`; `POST /businesses/:id/report {reason}`; `POST /admin/moderation/:id {decision:'dismissed'|'removed',notes}`.

Browser clients use bearer headers rather than privileged cookies, so financial mutations have no ambient-cookie CSRF capability. Keep tokens out of logs and URLs. Production auth/storage/MFA are separate configured boundaries; local mode cannot bind publicly.
