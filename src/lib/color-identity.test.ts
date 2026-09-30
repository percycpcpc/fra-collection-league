import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  parseIdentity,
  serializeIdentity,
  isSubsetIdentity,
  unionIdentity,
  WUBRG_ORDER,
  type WUBRG,
} from "./color-identity";

const WUBRG = ["W", "U", "B", "R", "G"] as const;
const RUNS = { numRuns: 100 };

// Arbitrary color-identity set built from a subset of WUBRG.
const identityArb = () =>
  fc
    .subarray([...WUBRG] as WUBRG[])
    .map((arr) => new Set<WUBRG>(arr));

// Arbitrary raw string possibly containing WUBRG letters (any case) and noise.
const rawStringArb = () =>
  fc.stringOf(
    fc.constantFrom(
      "W", "U", "B", "R", "G",
      "w", "u", "b", "r", "g",
      "x", "1", " ", "-", "z",
    ),
    { maxLength: 12 },
  );

describe("color-identity", () => {
  // Feature: commander-color-identity-filter, Property 1: For any input value, parseIdentity returns a set that contains only colors from {W,U,B,R,G}, contains a color at most once, has size at most 5, and includes a color exactly when that letter (any case) occurs in the input.
  it("Property 1: parse yields only distinct WUBRG colors", () => {
    fc.assert(
      fc.property(fc.oneof(rawStringArb(), fc.anything()), (value) => {
        const set = parseIdentity(value);
        for (const c of set) expect(WUBRG).toContain(c);
        expect(set.size).toBeLessThanOrEqual(5);
        if (typeof value === "string") {
          const upper = value.toUpperCase();
          for (const c of WUBRG) {
            expect(set.has(c)).toBe(upper.includes(c));
          }
        } else {
          expect(set.size).toBe(0);
        }
      }),
      RUNS,
    );
  });

  // Feature: commander-color-identity-filter, Property 2: For any string, parseIdentity(s) equals parseIdentity(s.toUpperCase()).
  it("Property 2: parsing is case-insensitive", () => {
    fc.assert(
      fc.property(rawStringArb(), (s) => {
        const a = parseIdentity(s);
        const b = parseIdentity(s.toUpperCase());
        expect([...a].sort()).toEqual([...b].sort());
      }),
      RUNS,
    );
  });

  // Feature: commander-color-identity-filter, Property 3: For any color-identity set, serializeIdentity produces a string whose characters are a subset of {W,U,B,R,G}, no repeats, ordered W->U->B->R->G; the empty set serializes to "".
  it("Property 3: serialization is canonical", () => {
    fc.assert(
      fc.property(identityArb(), (id) => {
        const s = serializeIdentity(id);
        for (const ch of s) expect(WUBRG).toContain(ch);
        expect(new Set(s).size).toBe(s.length); // no repeats
        const positions = [...s].map((ch) => WUBRG_ORDER.indexOf(ch as WUBRG));
        const sorted = [...positions].sort((x, y) => x - y);
        expect(positions).toEqual(sorted); // canonical order
        if (id.size === 0) expect(s).toBe("");
      }),
      RUNS,
    );
  });

  // Feature: commander-color-identity-filter, Property 4: For any input value, parseIdentity(serializeIdentity(parseIdentity(x))) is set-equal to parseIdentity(x).
  it("Property 4: parse/serialize round-trip", () => {
    fc.assert(
      fc.property(fc.oneof(rawStringArb(), fc.anything()), (x) => {
        const once = parseIdentity(x);
        const round = parseIdentity(serializeIdentity(once));
        expect([...round].sort()).toEqual([...once].sort());
      }),
      RUNS,
    );
  });

  // Feature: commander-color-identity-filter, Property 5: For any commander color-identity set K, isSubsetIdentity(emptySet, K) is true.
  it("Property 5: empty identity is a subset of every identity", () => {
    fc.assert(
      fc.property(identityArb(), (k) => {
        expect(isSubsetIdentity(new Set(), k)).toBe(true);
      }),
      RUNS,
    );
  });

  // Feature: commander-color-identity-filter, Property 6: For any sets A and B, unionIdentity(A,B) equals unionIdentity(B,A), and both A and B are subsets of unionIdentity(A,B).
  it("Property 6: union is commutative and monotonic", () => {
    fc.assert(
      fc.property(identityArb(), identityArb(), (a, b) => {
        const ab = unionIdentity(a, b);
        const ba = unionIdentity(b, a);
        expect([...ab].sort()).toEqual([...ba].sort());
        expect(isSubsetIdentity(a, ab)).toBe(true);
        expect(isSubsetIdentity(b, ab)).toBe(true);
      }),
      RUNS,
    );
  });
});
