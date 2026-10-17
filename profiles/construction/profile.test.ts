// The construction profile's colors stay readable, and nothing names a real employer.
import { test } from "node:test";
import assert from "node:assert/strict";
import { construction } from "./profile.ts";

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test("white text on the brand card and badge reads in both themes (WCAG AA, 4.5:1)", () => {
  for (const theme of ["light", "dark"] as const) {
    assert.ok(contrast("#ffffff", construction.colors[theme].deep) >= 4.5, theme);
  }
});

test("the tagline on the brand card is at least as readable as the MACS gold (4.1:1)", () => {
  for (const theme of ["light", "dark"] as const) {
    assert.ok(contrast(construction.colors[theme].accent, construction.colors[theme].deep) >= 4.1, theme);
  }
});

test("generic branding: no employer, project, or person names", () => {
  const text = JSON.stringify(construction);
  assert.doesNotMatch(text, /greystar|nona|doral|marlowe|sandlake|moorhouse/i);
  assert.ok("monogram" in construction.logo && construction.logo.monogram.length <= 3);
});
