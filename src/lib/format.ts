// Centralized formatting / normalization helpers
// Used to avoid duplicates in DB caused by varying user inputs.

export const PHONE_RE = /^\+241\d{8,9}$/;
// Plate stockée en forme compacte ex: "AB123GA"
export const PLATE_RE = /^[A-Z0-9]{5,10}$/;

/**
 * Normalize Gabon phone number to canonical "+241XXXXXXXX".
 * Accepts formats: "+241 0X XX XX XX", "0X XX XX XX", "241XXXXXXXX", etc.
 */
export function normalizePhone(input: string): string {
  if (!input) return "";
  let v = input.trim().replace(/[\s\-().]/g, "");
  if (v.startsWith("00")) v = "+" + v.slice(2);
  if (v.startsWith("241")) v = "+" + v;
  if (/^0\d+/.test(v)) v = "+241" + v.slice(1);
  if (/^\d{8,9}$/.test(v)) v = "+241" + v;
  if (!v.startsWith("+")) v = "+" + v.replace(/[^\d]/g, "");
  // Keep only + and digits
  v = "+" + v.replace(/[^\d]/g, "");
  return v;
}

/** Live (per keystroke) sanitizer for phone inputs — keeps + and digits only. */
export function sanitizePhoneInput(input: string): string {
  if (!input) return "";
  const hasPlus = input.trim().startsWith("+");
  const digits = input.replace(/[^\d]/g, "");
  return (hasPlus ? "+" : "") + digits;
}

export function validatePhone(v: string): string {
  if (!v) return "";
  return PHONE_RE.test(normalizePhone(v))
    ? ""
    : "Format: +241XXXXXXXX ou 0XXXXXXXX";
}

/** Canonical plate: uppercase, no spaces/dashes. */
export function normalizePlate(input: string): string {
  if (!input) return "";
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Live sanitizer (per keystroke) for plate inputs. */
export function sanitizePlateInput(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9\s-]/g, "");
}

export function validatePlate(v: string): string {
  if (!v) return "";
  return PLATE_RE.test(normalizePlate(v))
    ? ""
    : "Format invalide (ex: AB123GA)";
}

/** Strip everything except digits — for numeric text inputs. */
export function digitsOnly(input: string): string {
  return (input ?? "").replace(/\D/g, "");
}

/** Strip everything except digits and a single decimal separator. */
export function decimalOnly(input: string): string {
  if (!input) return "";
  const cleaned = input.replace(/,/g, ".").replace(/[^\d.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) return cleaned;
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
}

/** Parse a numeric string to integer, treating empty as 0. */
export function toInt(v: string | number): number {
  if (typeof v === "number") return Number.isFinite(v) ? Math.trunc(v) : 0;
  const n = parseInt(digitsOnly(v), 10);
  return Number.isFinite(n) ? n : 0;
}

/** Parse a numeric string to float, treating empty as 0. */
export function toFloat(v: string | number): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = parseFloat(decimalOnly(v));
  return Number.isFinite(n) ? n : 0;
}
