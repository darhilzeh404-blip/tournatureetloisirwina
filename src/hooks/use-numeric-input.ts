import * as React from "react";

export type NumericInputOptions = {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  allowDecimal?: boolean;
  /** Show an empty field when the value is 0 (default true) */
  emptyAsZero?: boolean;
};

/**
 * Shared logic for every numeric field of the app.
 *
 * Key rules:
 * - The field keeps its own *text* state, so the user can freely erase digits
 *   (backspace, select-all + delete) and stay on an empty value.
 * - The parent value is never re-injected into the field while it is focused.
 * - min/max are only enforced on blur, never while typing.
 */
export function useNumericInput({
  value,
  onChange,
  min,
  max,
  allowDecimal = false,
  emptyAsZero = true,
}: NumericInputOptions) {
  const toText = React.useCallback(
    (v: number) => {
      if (!Number.isFinite(v)) return "";
      if (emptyAsZero && v === 0) return "";
      return String(v);
    },
    [emptyAsZero],
  );

  const [text, setText] = React.useState<string>(() => toText(value));
  const focusedRef = React.useRef(false);

  // Sync from the parent only when the field is not being edited.
  React.useEffect(() => {
    if (focusedRef.current) return;
    const parsed = text === "" ? (emptyAsZero ? 0 : NaN) : Number(text);
    if (parsed !== value) setText(toText(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, toText]);

  const sanitize = React.useCallback(
    (s: string) => {
      const cleaned = allowDecimal
        ? s.replace(/,/g, ".").replace(/[^\d.]/g, "")
        : s.replace(/[^\d]/g, "");
      if (!allowDecimal) return cleaned;
      const i = cleaned.indexOf(".");
      return i === -1 ? cleaned : cleaned.slice(0, i + 1) + cleaned.slice(i + 1).replace(/\./g, "");
    },
    [allowDecimal],
  );

  const handleFocus = React.useCallback(() => {
    focusedRef.current = true;
  }, []);

  const handleChange = React.useCallback(
    (raw: string) => {
      const s = sanitize(raw);
      setText(s);
      if (s === "" || s === ".") {
        // Empty stays empty on screen; parent gets a neutral 0 for computations.
        onChange(0);
        return;
      }
      const n = Number(s);
      if (Number.isFinite(n)) onChange(n);
    },
    [onChange, sanitize],
  );

  const handleBlur = React.useCallback(() => {
    focusedRef.current = false;
    if (text === "") {
      const fallback = emptyAsZero ? 0 : (min ?? 0);
      setText(toText(fallback));
      onChange(fallback);
      return;
    }
    let n = Number(text);
    if (!Number.isFinite(n)) {
      const fallback = emptyAsZero ? 0 : (min ?? 0);
      setText(toText(fallback));
      onChange(fallback);
      return;
    }
    if (min !== undefined && n < min) n = min;
    if (max !== undefined && n > max) n = max;
    setText(String(n));
    onChange(n);
  }, [text, min, max, emptyAsZero, onChange, toText]);

  return {
    text,
    inputMode: (allowDecimal ? "decimal" : "numeric") as "decimal" | "numeric",
    pattern: allowDecimal ? "[0-9.]*" : "[0-9]*",
    handleFocus,
    handleChange,
    handleBlur,
  };
}
