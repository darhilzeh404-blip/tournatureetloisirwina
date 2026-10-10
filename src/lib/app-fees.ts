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

/**
 * Admin view of a reservation: amounts expressed without application fees and
 * fee details stripped, so fees never appear as a line nor in totals.
 */
export function toAdminReservation<T extends { total_amount?: any; paid_amount?: any; service_amount?: any; details?: any }>(r: T): T {
  const total = Number(r.total_amount ?? 0);
  const service = serviceAmount(r);
  if (!total || service >= total) return r;
  const paid = Number(r.paid_amount ?? 0);
  const { app_fees, app_fees_total, base_amount, ...details } = (r.details ?? {}) as Record<string, unknown>;
  return {
    ...r,
    total_amount: service,
    paid_amount: Math.min(Math.round((paid * service) / total), service),
    details,
  };
}
