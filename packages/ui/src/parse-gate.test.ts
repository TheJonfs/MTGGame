/**
 * ADR-081 gate hardening (S21 concern 7): tsc is not a JSX gate — a missing `}` after a JSX `&&`
 * fragment typechecked clean but broke Vite's Babel transform on the live dev server. This test
 * runs the same parser class over every UI source file so the break is caught by `pnpm test`
 * instead of by the browser. Parse-only (no transform): syntax gate, not a semantics gate — tsc
 * still owns types.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "@babel/parser";
import { describe, it } from "vitest";

const SRC = join(import.meta.dirname, ".");

function* walk(dir: string): Generator<string> {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (/\.(ts|tsx)$/.test(e.name)) yield p;
  }
}

describe("UI parse gate (Babel, the Vite-transform parser class)", () => {
  it("every packages/ui/src file parses", () => {
    const failures: string[] = [];
    for (const file of walk(SRC)) {
      try {
        parse(readFileSync(file, "utf8"), {
          sourceType: "module",
          plugins: file.endsWith(".tsx") ? ["typescript", "jsx"] : ["typescript"],
        });
      } catch (err) {
        failures.push(`${file}: ${(err as Error).message}`);
      }
    }
    if (failures.length) throw new Error(`Babel parse failures:\n${failures.join("\n")}`);
  });
});
