export type Preferences = {theme?:'system'|'light'|'dark';language?:'en'|'ne';motion?:'system'|'reduced'|'full';notifications?:boolean};
export type User = {id:string;name:string;email:string;role:string;adultConfirmed:boolean;termsAccepted:boolean;preferences:Preferences;availablePaisa:string};
export type Round = {id:string;status:string;targetPaisa:string;committedPaisa:string;preMoneyPaisa:string;sharePricePaisa:string;existingShares:string;targetShares:string;minPaisa:string;incrementPaisa:string;termsVersion:number;deadline:string};
export type Financial = {month?:string;period?:string;revenuePaisa?:string;variableCostsPaisa?:string;operatingExpensesPaisa?:string;netProfitPaisa?:string;[key:string]:unknown};
export type Report = {id:string;version:number;status:string;summary?:string;executiveSummary?:string;provider?:string;modelVersion?:string;createdAt?:string;evidence?:unknown[];evidenceReferences?:unknown[];assumptions?:Record<string,unknown>;scenarios?:Record<string,unknown>;risks?:string[];missingData?:string[];reviewerQuestions?:string[];[key:string]:unknown};
export type Business = {id:string;name:string;tagline:string;sector:string;location:string;story:string;founderName:string;status:string;stage:string;illustration?:string;color?:string;risks:string[];fundingUse:string[];financials:Financial[];round?:Round;report?:Report;updates:{id:string;title:string;body:string;status?:string;createdAt?:string}[];reviewNotes?:string;[key:string]:unknown};
export type Quote = {id:string;roundId:string;amountPaisa:string;shares:string;ownershipPercent:string;feesPaisa:string;termsVersion:number;expiresAt:string;availablePaisa:string};
export type Commitment = {id:string;businessId:string;businessName?:string;roundId:string;amountPaisa:string;shares:string;status:string;createdAt:string;ownershipPercent?:string;[key:string]:unknown};
export type Portfolio = {availablePaisa:string;committedPaisa:string;investedPaisa:string;holdings:Commitment[];commitments:Commitment[]};
export type ActivityItem = {id:string;kind?:string;type?:string;title?:string;description?:string;amountPaisa?:string;createdAt:string;status?:string;businessName?:string;[key:string]:unknown};
export type Notification = {id:string;title:string;body:string;readAt?:string;read?:boolean;businessId?:string;createdAt:string};

