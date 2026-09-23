import { describe, expect, it } from "vitest";
import { parsePositiveIntParam } from "./routeParams";

describe("parsePositiveIntParam", () => {
  it("accepts positive integer route values", () => {
    expect(parsePositiveIntParam("42")).toBe(42);
  });

  it.each([undefined, "", "NaN", "1.5", "-2", "0", "12abc"])("rejects %s", (value) => {
    expect(parsePositiveIntParam(value)).toBeNull();
  });
});
