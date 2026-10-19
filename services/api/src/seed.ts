import { randomUUID, randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hash } from "bcryptjs";
import { query, tx, one, pool } from "./db";
import { issueInitial, createRoundAccounts } from "./ledger";
import { AuthService, requireLocal } from "./auth";
import { AppService, roundDto } from "./service";
import { DocumentService } from "./documents";
import { buildReport } from "./research";
export const seedBusinesses = [
  {
    id: "paila-logistics",
    name: "Paila Parcel Collective",
    sector: "Logistics",
    location: "Lalitpur",
    tagline: "A smaller footprint for the last mile.",
    story:
      "Fictional sisters Maya and Nila built a neighborhood delivery cooperative with electric cargo cycles. Paila brings independent shops onto predictable delivery routes, with repairable equipment and fair scheduling. This invented business seeks simulated funding for a second neighborhood depot and six new cargo cycles.",
    founder: "Maya Kiran (fictional)",
    illustration: "logistics",
    color: "#FFD166",
    status: "published",
    stage: "Growing",
    risks: [
      "Delivery demand varies by season.",
      "Battery replacement and road access can interrupt operations.",
      "There is no ready resale market for simulated shares.",
    ],
  },
  {
    id: "sajha-pantry",
    name: "Sajha Millet Pantry",
    sector: "Food",
    location: "Pokhara",
    tagline: "Good grains. Shared possibilities.",
    story:
      "An invented kitchen collective transforms locally inspired millet recipes into ready-to-cook breakfasts. Its fictional team works with small growers and tests reusable distribution containers. The proposed expansion adds a packaging station and food-safety training.",
    founder: "Rupa Simal (fictional)",
    illustration: "food",
    color: "#FF8B73",
    status: "published",
    stage: "Established",
    risks: [
      "Food spoilage and changing input costs affect margins.",
      "Demand estimates have not been independently checked.",
      "Dividends and returns are never guaranteed.",
    ],
  },
  {
    id: "punar-repair",
    name: "Punar Repair Works",
    sector: "Repair & manufacturing",
    location: "Bhaktapur",
    tagline: "A second life for everyday things.",
    story:
      "This fictional workshop repairs appliances and remanufactures durable components. Its apprenticeship program pairs experienced repairers with new technicians. Simulated proceeds would fund safer benches, shared tools, and a small parts inventory.",
    founder: "Arun Dhara (fictional)",
    illustration: "repair",
    color: "#B8DFFC",
    status: "published",
    stage: "Growing",
    risks: [
      "Parts supply and skilled staff availability are uncertain.",
      "Warranty claims may exceed assumptions.",
      "The simulated round has no actual legal ownership effect.",
    ],
  },
  {
    id: "hariyo-growers",
    name: "Hariyo Terrace Growers",
    sector: "Agriculture",
    location: "Dhulikhel",
    tagline: "Small terraces, patient growth.",
    story:
      "A fictional grower group tests protected cultivation and careful water use on hillside terraces. The business focuses on short supply chains and recorded harvest quality. This scenario demonstrates an unsuccessful all-or-nothing round and a complete virtual refund.",
    founder: "Sita Jun (fictional)",
    illustration: "agriculture",
    color: "#BCE9D8",
    status: "published",
    stage: "Early",
    risks: [
      "Weather, crop disease and transport disruption may reduce yields.",
      "Farm-gate prices are variable.",
      "This demonstration round failed and all reserved funds were returned.",
    ],
  },
  {
    id: "akshar-learning",
    name: "Akshar Learning Studio",
    sector: "Education",
    location: "Biratnagar",
    tagline: "Practical skills, closer to home.",
    story:
      "A fictional learning studio combines small-group skills classes with low-bandwidth digital materials. The demonstration already completed a successful round. Issued simulated shares and virtual proceeds are recorded as historical events, not fabricated market gains.",
    founder: "Nima Aakar (fictional)",
    illustration: "education",
    color: "#C6B9FF",
    status: "published",
    stage: "Established",
    risks: [
      "Enrollment and teacher retention affect revenue.",
      "No independent learning-outcome study is available.",
      "The shares have no resale market or guaranteed dividends.",
    ],
  },
  {
    id: "dhago-textiles",
    name: "Dhago Loom Studio",
    sector: "Craft & textiles",
    location: "Kirtipur",
    tagline: "Every thread has a beginning.",
    story:
      "An invented textile studio needs additional fictional supplier and ownership documents before its application can proceed. This scenario demonstrates a clear request for information rather than a premature verification badge.",
    founder: "Lila Taara (fictional)",
    illustration: "textiles",
    color: "#F7C5E0",
    status: "needs-information",
    stage: "Early",
    risks: [
      "Material supply is concentrated.",
      "Ownership documentation remains incomplete.",
    ],
  },
  {
    id: "ujyalo-services",
    name: "Ujyalo Solar Care",
    sector: "Energy services",
    location: "Butwal",
    tagline: "Keeping small solar systems working.",
    story:
      "This invented maintenance team provides solar inspection and repair services to small businesses. Its fictional application is under human review; financial inputs and supporting records must be checked before publication.",
    founder: "Dev Tara (fictional)",
    illustration: "energy",
    color: "#FFD166",
    status: "under-review",
    stage: "Growing",
    risks: [
      "Service contracts may not renew.",
      "Replacement-component availability is uncertain.",
    ],
  },
  {
    id: "setu-coldchain",
    name: "Setu Cool Routes",
    sector: "Logistics",
    location: "Hetauda",
    tagline: "A careful pause before expansion.",
    story:
      "This fictional cold-chain application was rejected because its cost assumptions omit required energy and maintenance expenses. The useful reason is retained so an owner can revise a future submission. It is not publicly investable.",
    founder: "Bina Aakash (fictional)",
    illustration: "logistics",
    color: "#B8DFFC",
    status: "rejected",
    stage: "Early",
    risks: [
      "Operating costs omit refrigeration energy and maintenance.",
      "Financial records require correction before reconsideration.",
    ],
  },
];
export async function seed() {
  requireLocal();
  const credentialsPath = resolve(".local/demo-accounts.json");
  if (
    (await query("SELECT 1 FROM app.businesses WHERE id='paila-logistics'"))
      .length
  ) {
    console.log("Seed already exists. Local credentials:", credentialsPath);
    return;
  }
  const password = randomBytes(15).toString("base64url");
  const identities = [
    ["investor", "Asha Demo", "investor"],
    ["owner", "Kiran Owner", "investor"],
    ["reviewer", "Mira Reviewer", "reviewer"],
    ["admin", "Anil Approver", "admin"],
    ["superadmin", "Platform Operator", "superadmin"],
    ["scenario1", "Scenario Investor One", "investor"],
    ["scenario2", "Scenario Investor Two", "investor"],
    ["scenario3", "Scenario Investor Three", "investor"],
    ["scenario4", "Scenario Investor Four", "investor"],
    ["scenario5", "Scenario Investor Five", "investor"],
    ["scenario6", "Scenario Investor Six", "investor"],
  ];
  const users: Record<string, any> = {};
  await tx(async (c) => {
    for (const [key, name, role] of identities) {
      const id = randomUUID();
      users[key] = await one(
        c,
        "INSERT INTO app.users(id,email,name,password_hash,verified,role,adult_confirmed,terms_accepted) VALUES($1,$2,$3,$4,true,$5,true,true) RETURNING *",
        [id, `${key}@lagani.local`, name, await hash(password, 12), role],
      );
      await issueInitial(c, id);
    }
    for (let i = 0; i < seedBusinesses.length; i++) {
      const b = seedBusinesses[i];
      await c.query(
        "INSERT INTO app.businesses(id,name,tagline,sector,location,story,founder_name,status,stage,illustration,color,risks,funding_use,private_details,reviewer_id,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,now()-($16::integer)*interval '1 day')",
        [
          b.id,
          b.name,
          b.tagline,
          b.sector,
          b.location,
          b.story,
          b.founder,
          b.status,
          b.stage,
          b.illustration,
          b.color,
          JSON.stringify(b.risks),
          JSON.stringify([
            "45% equipment and tools",
            "35% working capital",
            "20% training and operations",
          ]),
          JSON.stringify({
            registration: `FICTIONAL-${100 + i}`,
            pan: "SAMPLE-NOT-A-REAL-PAN",
            controllers: `${b.founder} — fictional majority owner`,
            bankOwnership: "No bank connected. Human review simulation only.",
          }),
          users.reviewer.id,
          i,
        ],
      );
      await c.query(
        "INSERT INTO app.memberships(business_id,user_id) VALUES($1,$2)",
        [b.id, users.owner.id],
      );
      for (let m = 1; m <= 6; m++)
        await c.query(
          "INSERT INTO app.financials(id,business_id,period,revenue_paisa,variable_cost_paisa,operating_cost_paisa,opening_cash_paisa,source,confirmed) VALUES($1,$2,$3,$4,$5,$6,$7,$8,true)",
          [
            randomUUID(),
            b.id,
            `2026-${String(m + 3).padStart(2, "0")}`,
            String(20000000 + i * 2300000 + m * 700000),
            String(10000000 + i * 1100000 + m * 300000),
            String(6500000 + i * 500000),
            "30000000",
            "Synthetic monthly owner record · fictional evidence pack",
          ],
        );
      const rid = `${b.id}-round-1`,
        status = b.status === "published" ? "open" : "draft";
      await c.query(
        "INSERT INTO app.rounds(id,business_id,status,target_paisa,share_price_paisa,existing_shares,pre_money_paisa,min_paisa,increment_paisa,deadline) VALUES($1,$2,$3,200000000,1000,800000,800000000,100000,100000,now()+interval '45 days')",
        [rid, b.id, status],
      );
      await createRoundAccounts(c, rid);
      if (status === "open") {
        const r = await one(c, "SELECT * FROM app.rounds WHERE id=$1", [rid]);
        await c.query(
          "INSERT INTO app.term_versions(round_id,version,snapshot) VALUES($1,1,$2)",
          [rid, roundDto(r)],
        );
      }
      await c.query(
        "INSERT INTO app.review_events(id,business_id,actor_id,decision,notes) VALUES($1,$2,$3,$4,$5)",
        [
          randomUUID(),
          b.id,
          users.reviewer.id,
          b.status,
          b.status === "rejected"
            ? "Revise energy and maintenance expenses before resubmission."
            : b.status === "needs-information"
              ? "Please provide a fictional supplier agreement and beneficial ownership sample."
              : "Fictional records reviewed as a seeded demonstration history. No government or bank checks occurred.",
        ],
      );
      for (const kind of [
        "registration",
        "pan",
        "ownership",
        "bank",
        "financials",
      ])
        await c.query(
          "INSERT INTO app.verification_checks(business_id,kind,outcome,reviewer_id,notes) VALUES($1,$2,$3,$4,$5)",
          [
            b.id,
            kind,
            b.status === "published" ? "passed" : "needs-information",
            users.reviewer.id,
            "Fictional record review only; no external provider verification.",
          ],
        );
    }
  });
  const auth = new AuthService(),
    app = new AppService(auth),
    docs = new DocumentService(auth);
  for (const b of seedBusinesses) {
    const r = await buildReport(b.id, users.reviewer.id);
    if (b.status === "published")
      await app.approveReport(users.admin, r.id, {
        notes:
          "Approved seeded fictional report after a separate simulated human review.",
      });
  }
  const invest = async (key: string, business: string, amount: string) => {
    const q = await app.quote(users[key], `${business}-round-1`, {
      amountPaisa: amount,
    });
    return app.commit(users[key], {
      quoteId: q.id,
      riskAcknowledged: true,
      idempotencyKey: `seed-${key}-${business}`,
    });
  };
  await invest("scenario1", "paila-logistics", "100000000");
  await invest("scenario2", "paila-logistics", "24000000");
  await invest("scenario2", "sajha-pantry", "28000000");
  await invest("scenario3", "punar-repair", "100000000");
  await invest("scenario4", "punar-repair", "100000000");
  await invest("scenario5", "akshar-learning", "100000000");
  await invest("scenario6", "akshar-learning", "100000000");
  await app.close(users.admin, "akshar-learning-round-1", { confirm: true });
  await invest("investor", "hariyo-growers", "10000000");
  await query(
    "UPDATE app.rounds SET deadline=now()-interval '1 day' WHERE id='hariyo-growers-round-1'",
  );
  await app.close(users.admin, "hariyo-growers-round-1", { confirm: true });
  await docs.upload(users.owner, "dhago-textiles", {}, true);
  await query(
    "INSERT INTO app.updates(id,business_id,author_id,title,body,status) VALUES($1,'paila-logistics',$2,'The next neighborhood route','Our fictional team completed a route-planning workshop. This is a synthetic owner update for the simulation.','published')",
    [randomUUID(), users.owner.id],
  );
  mkdirSync(resolve(".local"), { recursive: true });
  writeFileSync(
    credentialsPath,
    JSON.stringify(
      {
        notice:
          "LOCAL DEVELOPMENT ONLY. Randomly generated per seed. Do not publish this file or reuse hosted.",
        password,
        accounts: identities.map(([key, name, role]) => ({
          email: `${key}@lagani.local`,
          name,
          role,
        })),
      },
      null,
      2,
    ),
  );
  console.log(
    "Eight fictional businesses seeded. Random local demo credentials written to",
    credentialsPath,
  );
}
