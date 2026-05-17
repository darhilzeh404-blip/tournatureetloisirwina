import * as React from "react";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  allowDecimal?: boolean;
  /** Treat 0 as an empty input (default true) */
  emptyAsZero?: boolean;
};

/**
 * Mobile-friendly numeric input.
 * - Fully editable & clearable (no aggressive min-clamping while typing)
 * - Selects content on focus to avoid "1 → 14" concatenation bugs
 * - Numeric mobile keyboard (inputMode + pattern)
 * - Min/Max are enforced on blur, not on every keystroke
 */
export const NumberInput = React.forwardRef<HTMLInputElement, Props>(function NumberInput(
  {
    value,
    onChange,
    min,
    max,
    allowDecimal = false,
    emptyAsZero = true,
    onFocus,
    onBlur,
    ...rest
  },
  ref,
) {
  const toText = React.useCallback(
    (v: number) => (emptyAsZero && v === 0 ? "" : Number.isFinite(v) ? String(v) : ""),
    [emptyAsZero],
  );

  const [text, setText] = React.useState<string>(() => toText(value));
  const focusedRef = React.useRef(false);

  // Sync from parent only when not focused, to avoid clobbering typing.
  React.useEffect(() => {
    if (focusedRef.current) return;
    const parsed = text === "" ? 0 : Number(text);
    if (parsed !== value) setText(toText(value));
  }, [value, text, toText]);

  const sanitize = (s: string) => {
    const cleaned = allowDecimal ? s.replace(/,/g, ".").replace(/[^\d.]/g, "") : s.replace(/[^\d]/g, "");
    if (!allowDecimal) return cleaned;
    const i = cleaned.indexOf(".");
    return i === -1 ? cleaned : cleaned.slice(0, i + 1) + cleaned.slice(i + 1).replace(/\./g, "");
  };

  return (
    <input
      ref={ref}
      type="text"
      inputMode={allowDecimal ? "decimal" : "numeric"}
      pattern={allowDecimal ? "[0-9.]*" : "[0-9]*"}
      autoComplete="off"
      {...rest}
      value={text}
      onFocus={(e) => {
        focusedRef.current = true;
        // Select all so any keystroke replaces the default value cleanly.
        requestAnimationFrame(() => {
          try {
            e.target.select();
          } catch {}
        });
        onFocus?.(e);
      }}
      onChange={(e) => {
        const s = sanitize(e.target.value);
        setText(s);
        if (s === "" || s === ".") {
          onChange(0);
          return;
        }
        const n = Number(s);
        if (Number.isFinite(n)) onChange(n);
      }}
      onBlur={(e) => {
        focusedRef.current = false;
        if (text === "") {
          onChange(emptyAsZero ? 0 : (min ?? 0));
          if (!emptyAsZero && min !== undefined) setText(String(min));
          onBlur?.(e);
          return;
        }
        let n = Number(text);
        if (!Number.isFinite(n)) {
          setText("");
          onChange(0);
          onBlur?.(e);
          return;
        }
        if (min !== undefined && n < min) n = min;
        if (max !== undefined && n > max) n = max;
        setText(String(n));
        onChange(n);
        onBlur?.(e);
      }}
    />
  );
});
