/**
 * Service routing classification.
 *
 * Each reservation stays in its own module after payment validation.
 * Trips (driver-routed courses) are only created for transport services
 * that actually require a driver. Circuits are routed to a gérant only.
 * Tickets and activities have no operational routing — only status changes.
 */

export type ServiceType =
  | "VTC"
  | "TRANSPORT_SCOLAIRE"
  | "LOCATION_BUS"
  | "CIRCUIT_TOURISTIQUE"
  | "BILLET"
  | "ACTIVITE"
  | string;

/** Services that require a chauffeur assignment (appear in "Courses GPS"). */
const DRIVER_SERVICES = new Set<string>([
  "VTC",
  "TRANSPORT_SCOLAIRE",
  "LOCATION_BUS",
]);

/** Services routed to a gérant (no chauffeur). */
const GERANT_SERVICES = new Set<string>(["CIRCUIT_TOURISTIQUE"]);

/** Services with no operational routing (status-only). */
const STATUS_ONLY_SERVICES = new Set<string>(["BILLET", "ACTIVITE"]);

export function requiresDriver(serviceType: string): boolean {
  return DRIVER_SERVICES.has(serviceType);
}

export function requiresGerant(serviceType: string): boolean {
  return GERANT_SERVICES.has(serviceType);
}

export function isStatusOnlyService(serviceType: string): boolean {
  return STATUS_ONLY_SERVICES.has(serviceType);
}

/** Should an admin be able to assign anyone (driver or gérant) to this reservation? */
export function canAssignTrip(serviceType: string): boolean {
  return requiresDriver(serviceType) || requiresGerant(serviceType);
}

export const DRIVER_SERVICE_LIST = Array.from(DRIVER_SERVICES);
