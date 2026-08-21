import * as React from "react";
import { Input } from "@/components/ui/input";

const sanitize = (raw: string, allowDecimal: boolean) => {
  const cleaned = allowDecimal
    ? raw.replace(/,/g, ".").replace(/[^\d.]/g, "")
    : raw.replace(/[^\d]/g, "");
  if (!allowDecimal) return cleaned;
  const i = cleaned.indexOf(".");
  return i === -1 ? cleaned : cleaned.slice(0, i + 1) + cleaned.slice(i + 1).replace(/\./g, "");
};

type TextProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  /** Text state (may be empty) */
  value: string;
  onChange: (v: string) => void;
  allowDecimal?: boolean;
};

/**
 * Numeric input backed by a *string* state.
 * The user can always erase everything (iOS/Android/desktop) — nothing is re-injected.
 */
export const NumericTextField = React.forwardRef<HTMLInputElement, TextProps>(
  function NumericTextField({ value, onChange, allowDecimal = false, ...rest }, ref) {
    return (
      <Input
        ref={ref}
        type="text"
        inputMode={allowDecimal ? "decimal" : "numeric"}
        pattern={allowDecimal ? "[0-9.]*" : "[0-9]*"}
        autoComplete="off"
        {...rest}
        value={value}
        onChange={(e) => onChange(sanitize(e.target.value, allowDecimal))}
      />
    );
  },
);

type BlurProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type" | "defaultValue" | "onBlur"
> & {
  /** Initial numeric value (uncontrolled) */
  defaultValue: number | null | undefined;
  /** Called on blur when the value changed */
  onCommit: (v: number | null) => void;
  /** Allow committing null when the field is left empty */
  allowEmpty?: boolean;
  allowDecimal?: boolean;
  min?: number;
  max?: number;
};

/**
 * Uncontrolled numeric input that commits on blur (admin "patch" tables).
 * Erasing is always allowed while typing; min/max are applied on blur only.
 */
export const NumericBlurField = React.forwardRef<HTMLInputElement, BlurProps>(
  function NumericBlurField(
    { defaultValue, onCommit, allowEmpty = false, allowDecimal = false, min, max, ...rest },
    ref,
  ) {
    const initial = defaultValue === null || defaultValue === undefined ? "" : String(defaultValue);
    const [text, setText] = React.useState(initial);

    React.useEffect(() => setText(initial), [initial]);

    return (
      <Input
        ref={ref}
        type="text"
        inputMode={allowDecimal ? "decimal" : "numeric"}
        pattern={allowDecimal ? "[0-9.]*" : "[0-9]*"}
        autoComplete="off"
        {...rest}
        value={text}
        onChange={(e) => setText(sanitize(e.target.value, allowDecimal))}
        onBlur={() => {
          if (text === "" || text === ".") {
            if (allowEmpty) {
              if (initial !== "") onCommit(null);
              else setText("");
            } else {
              setText(initial);
            }
            return;
          }
          let n = Number(text);
          if (!Number.isFinite(n)) return setText(initial);
          if (min !== undefined && n < min) n = min;
          if (max !== undefined && n > max) n = max;
          setText(String(n));
          if (String(n) !== initial) onCommit(n);
        }}
      />
    );
  },
);
