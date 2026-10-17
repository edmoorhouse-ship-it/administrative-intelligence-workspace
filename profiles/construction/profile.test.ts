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

test("generic branding, roles, and quick starts: no employer, project, or person names", () => {
  const text = JSON.stringify(construction);
  assert.doesNotMatch(text, /greystar|nona|doral|marlowe|sandlake|moorhouse/i);
  assert.ok("monogram" in construction.logo && construction.logo.monogram.length <= 3);
});

test("roles fill the slots the workspace relies on, with no school-only slot", () => {
  const ids = construction.roles.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
  // "principal" is who the first sign-in becomes; "office" and "dean" are form defaults on the Brain and Onboarding pages.
  for (const id of ["principal", "office", "dean"] as const) assert.ok(ids.includes(id), id);
  assert.ok(!ids.includes("ese"));
  assert.equal(construction.roles[0].id, "principal");
  for (const r of construction.roles) assert.ok(r.initials.length === 2 && r.lens.length > 80, r.id);
});

test("area names are distinct, so a calendar suggestion maps back to one area", () => {
  const names = Object.values(construction.areaLabels ?? {}).map((n) => n.toLowerCase());
  assert.equal(names.length, 4);
  assert.equal(new Set(names).size, 4);
});

test("no school tools or school pages; leveling on", () => {
  assert.deepEqual(construction.tools, []);
  assert.deepEqual(construction.features, { leveling: true, schoolSections: false, manny: false });
});

test("quick starts: unique, short chips, and every email is a draft the user sends", () => {
  const ids = construction.starters.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const s of construction.starters) {
    assert.ok(s.chip.length <= 24, s.chip);
    if (/email|reminder/i.test(s.title)) assert.match(s.prompt, /draft for me to send/i, s.id);
    assert.doesNotMatch(s.prompt, /\b(send it|has been sent|mark (it )?as entered)\b/i, s.id);
  }
});
