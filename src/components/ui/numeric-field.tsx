import * as React from "react";
import { Input } from "@/components/ui/input";
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
 * Same behaviour as NumberInput, but rendered with the shadcn <Input> styling.
 * Use it as a drop-in replacement for `<Input type="number" />`.
 */
export const NumericField = React.forwardRef<HTMLInputElement, Props>(function NumericField(
  { value, onChange, min, max, allowDecimal = false, emptyAsZero = true, onFocus, onBlur, ...rest },
  ref,
) {
  const n = useNumericInput({ value, onChange, min, max, allowDecimal, emptyAsZero });

  return (
    <Input
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
