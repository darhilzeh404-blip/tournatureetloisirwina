/**
 * Application fees are paid by the client but are NEVER WINA TOUR revenue.
 * These helpers return the commercial (service) share of an amount.
 */
type ResAmounts = { total_amount?: number | null; service_amount?: number | null } | null | undefined;

/** Service amount of a reservation (total minus application fees). */
export function serviceAmount(r: ResAmounts & { details?: any }): number {
  if (!r) return 0;
  if (r.service_amount != null) return Number(r.service_amount);
  const fees = Number(r.details?.app_fees_total ?? 0);
  return Math.max(Number(r.total_amount ?? 0) - fees, 0);
}

/** Share of a payment amount that is commercial revenue (proportional to fees excluded). */
export function paymentRevenue(amount: number, res: ResAmounts): number {
  const total = Number(res?.total_amount ?? 0);
  const service = res?.service_amount != null ? Number(res.service_amount) : total;
  if (!total || service >= total) return Number(amount ?? 0);
  return Math.round((Number(amount ?? 0) * service) / total);
}
