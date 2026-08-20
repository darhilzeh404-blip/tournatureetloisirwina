import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { describe, it, expect } from "vitest";
import { NumberInput } from "@/components/ui/number-input";

function Harness() {
  const [v, setV] = useState(10);
  return <NumberInput value={v} onChange={setV} min={1} max={50} aria-label="n" />;
}

describe("NumberInput", () => {
  it("permet d'effacer complètement la valeur puis de resaisir", () => {
    render(<Harness />);
    const input = screen.getByLabelText("n") as HTMLInputElement;
    expect(input.value).toBe("10");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "1" } });
    expect(input.value).toBe("1");
    fireEvent.change(input, { target: { value: "" } });
    expect(input.value).toBe("");
    fireEvent.change(input, { target: { value: "25" } });
    expect(input.value).toBe("25");
    fireEvent.blur(input);
    expect(input.value).toBe("25");
  });

  it("applique min sur blur si le champ reste vide", () => {
    render(<Harness />);
    const input = screen.getByLabelText("n") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(input.value).toBe("");
  });
});
