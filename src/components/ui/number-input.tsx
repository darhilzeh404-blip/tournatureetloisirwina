import * as React from "react";
import { useNumericInput } from "@/hooks/use-numeric-input";

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
 * Mobile-friendly numeric input (plain <input>).
 * - Fully editable & clearable (backspace / select-all delete work)
 * - Never re-injects the previous value while typing
 * - Numeric mobile keyboard (inputMode + pattern)
 * - Min/Max enforced on blur only
 */
export const NumberInput = React.forwardRef<HTMLInputElement, Props>(function NumberInput(
  { value, onChange, min, max, allowDecimal = false, emptyAsZero = true, onFocus, onBlur, ...rest },
  ref,
) {
  const n = useNumericInput({ value, onChange, min, max, allowDecimal, emptyAsZero });

  return (
    <input
      ref={ref}
      type="text"
      inputMode={n.inputMode}
      pattern={n.pattern}
      autoComplete="off"
      {...rest}
      value={n.text}
      onFocus={(e) => {
        n.handleFocus();
        onFocus?.(e);
      }}
      onChange={(e) => n.handleChange(e.target.value)}
      onBlur={(e) => {
        n.handleBlur();
        onBlur?.(e);
      }}
    />
  );
});
