import { BadRequestException, ConflictException } from "@nestjs/common";
import Decimal from "decimal.js";
import { z } from "zod";
export const money = z
  .string()
  .regex(/^[1-9]\d{0,14}$/, "Use positive integer paisa");
export const uuid = z.string().uuid();
export const iso = (d: Date | string) => new Date(d).toISOString();
export function validate<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success)
    throw new BadRequestException({
      code: "INVALID_INPUT",
      message: "Please check the entered fields.",
      fields: result.error.flatten(),
    });
  return result.data;
}
export function equity(
  terms: {
    existingShares: string;
    sharePricePaisa: string;
    targetPaisa: string;
    preMoneyPaisa: string;
  },
  amountPaisa: string,
) {
  const existing = BigInt(terms.existingShares),
    price = BigInt(terms.sharePricePaisa),
    target = BigInt(terms.targetPaisa),
    amount = BigInt(amountPaisa);
  if (
    price <= 0n ||
    existing <= 0n ||
    target <= 0n ||
    existing * price !== BigInt(terms.preMoneyPaisa) ||
    target % price !== 0n
  )
    throw new BadRequestException("Inconsistent round terms");
  if (amount <= 0n || amount % price !== 0n)
    throw new BadRequestException("Amount must purchase whole shares");
  const shares = amount / price,
    total = existing + target / price;
  return {
    shares: shares.toString(),
    totalShares: total.toString(),
    ownershipPercent: new Decimal(shares.toString())
      .mul(100)
      .div(total.toString())
      .toFixed(6),
    postMoneyPaisa: (BigInt(terms.preMoneyPaisa) + target).toString(),
    newInvestorPercent: new Decimal((target / price).toString())
      .mul(100)
      .div(total.toString())
      .toFixed(6),
    feesPaisa: "0",
  };
}
export function ensureOpen(round: any, now = new Date()) {
  if (!["open", "funded-awaiting-close"].includes(round.status))
    throw new ConflictException("This round no longer accepts commitments.");
  if (new Date(round.deadline) <= now)
    throw new ConflictException("The round deadline has passed.");
}
export type Assumptions = {
  revenuePaisa: string | null;
  variableCostPaisa: string | null;
  operatingCostPaisa: string | null;
  openingCashPaisa: string | null;
  growthBps: number;
  capexPaisa: string;
  workingCapitalBps: number;
  taxBps: number;
  debtServicePaisa: string;
  financingPaisa: string;
};
export function project(a: Assumptions) {
  if (
    [
      a.revenuePaisa,
      a.variableCostPaisa,
      a.operatingCostPaisa,
      a.openingCashPaisa,
    ].some((x) => x === null)
  )
    return {
      months: [],
      missingData: ["Revenue, costs and opening cash must be provided."],
      breakEvenRevenuePaisa: null,
      cashRunwayMonths: null,
    };
  const revenue0 = new Decimal(a.revenuePaisa!),
    vcRatio = new Decimal(a.variableCostPaisa!).div(revenue0),
    opex = new Decimal(a.operatingCostPaisa!);
  let cash = new Decimal(a.openingCashPaisa!),
    prevRevenue = revenue0;
  const months = [];
  for (let month = 1; month <= 12; month++) {
    const revenue = revenue0
      .mul(new Decimal(1).add(new Decimal(a.growthBps).div(10000)).pow(month))
      .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
    const variableCost = revenue
        .mul(vcRatio)
        .toDecimalPlaces(0, Decimal.ROUND_HALF_UP),
      operatingProfit = revenue.sub(variableCost).sub(opex),
      tax = Decimal.max(0, operatingProfit)
        .mul(a.taxBps)
        .div(10000)
        .toDecimalPlaces(0),
      profit = operatingProfit.sub(tax),
      workingCapitalChange = revenue
        .sub(prevRevenue)
        .mul(a.workingCapitalBps)
        .div(10000)
        .toDecimalPlaces(0);
    const capex = month === 1 ? new Decimal(a.capexPaisa) : new Decimal(0),
      financing = month === 1 ? new Decimal(a.financingPaisa) : new Decimal(0),
      cashMovement = profit
        .sub(workingCapitalChange)
        .sub(capex)
        .sub(a.debtServicePaisa)
        .add(financing);
    const opening = cash;
    cash = cash.add(cashMovement);
    months.push({
      month,
      revenuePaisa: revenue.toFixed(0),
      variableCostPaisa: variableCost.toFixed(0),
      operatingCostPaisa: opex.toFixed(0),
      profitPaisa: profit.toFixed(0),
      taxPaisa: tax.toFixed(0),
      workingCapitalChangePaisa: workingCapitalChange.toFixed(0),
      capexPaisa: capex.toFixed(0),
      debtServicePaisa: a.debtServicePaisa,
      financingPaisa: financing.toFixed(0),
      openingCashPaisa: opening.toFixed(0),
      cashMovementPaisa: cashMovement.toFixed(0),
      closingCashPaisa: cash.toFixed(0),
    });
    prevRevenue = revenue;
  }
  return {
    months,
    missingData: [],
    breakEvenRevenuePaisa: vcRatio.lt(1)
      ? opex.div(new Decimal(1).sub(vcRatio)).toFixed(0)
      : null,
    cashRunwayMonths:
      months.find((m) => new Decimal(m.closingCashPaisa).lt(0))?.month ?? null,
  };
}
export const reportSchema = z.object({
  executiveSummary: z.string().min(20).max(4000),
  materialRisks: z.array(z.string()).min(2),
  missingData: z.array(z.string()),
  reviewerQuestions: z.array(z.string()),
  evidenceReferences: z.array(z.string()),
  claims: z.array(
    z.object({
      text: z.string(),
      kind: z.enum(["reported", "calculated", "inferred"]),
      evidenceId: z.string(),
    }),
  ),
});
export function checkReportOutput(output: unknown, evidenceIds: string[]) {
  const report = validate(reportSchema, output);
  if (
    report.evidenceReferences.some((id) => !evidenceIds.includes(id)) ||
    report.claims.some((c) => !evidenceIds.includes(c.evidenceId))
  )
    throw new BadRequestException("Unsupported evidence citation");
  if (
    /guaranteed\s+(profit|return)|\d+%\s+(success|accurate)|risk.free/i.test(
      JSON.stringify(report),
    )
  )
    throw new BadRequestException("Unsupported investment assurance");
  return report;
}
