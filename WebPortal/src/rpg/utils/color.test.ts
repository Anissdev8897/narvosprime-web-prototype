import { describe, it, expect } from "vitest";
import { isValidHexColor, sanitizeHexColor } from "./color";

describe("sanitizeHexColor", () => {
  it("accepte #rrggbb (normalisé minuscule)", () => {
    expect(sanitizeHexColor("#AA44FF")).toBe("#aa44ff");
  });
  it("normalise #rgb → #rrggbb", () => {
    expect(sanitizeHexColor("#f0a")).toBe("#ff00aa");
  });
  it("rejette les hex PARTIELS (la cause du bug '#d')", () => {
    expect(sanitizeHexColor("#d")).toBe("#ffffff");
    expect(sanitizeHexColor("#d8")).toBe("#ffffff");
    expect(sanitizeHexColor("#d8f4")).toBe("#ffffff");
  });
  it("rejette non-string / vide / bruit, avec fallback custom", () => {
    expect(sanitizeHexColor(undefined, "#123456")).toBe("#123456");
    expect(sanitizeHexColor("rouge")).toBe("#ffffff");
    expect(sanitizeHexColor("")).toBe("#ffffff");
  });
  it("isValidHexColor", () => {
    expect(isValidHexColor("#aabbcc")).toBe(true);
    expect(isValidHexColor("#abc")).toBe(true);
    expect(isValidHexColor("#d")).toBe(false);
  });
});
