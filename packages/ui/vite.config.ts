import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, join, normalize } from "node:path";
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "../..");

/** Dev-serves gitignored Scryfall images and accepts fixtures-inbox flags (ADR-040). */
function shandalarDev(): Plugin {
  return {
    name: "shandalar-dev",
    configureServer(server) {
      server.middlewares.use("/real-art", (req, res, next) => {
        const rel = normalize(decodeURIComponent((req.url ?? "/").split("?")[0]!)).replace(/^([/\\])+/, "");
        const file = join(repo, "data/art/real", rel);
        if (!file.startsWith(join(repo, "data/art/real")) || !existsSync(file)) return next();
        res.setHeader("Content-Type", file.endsWith(".json") ? "application/json" : "image/jpeg");
        createReadStream(file).pipe(res);
      });
      // S23 audio scaffolding (ADR-083/084): serve the gitignored local audio mount. Absent files
      // 404 → the audio manager stays silent (the deploy's natural state).
      server.middlewares.use("/audio", (req, res, next) => {
        const rel = normalize(decodeURIComponent((req.url ?? "/").split("?")[0]!)).replace(/^([/\\])+/, "");
        const file = join(repo, "assets/audio", rel);
        if (!file.startsWith(join(repo, "assets/audio")) || !existsSync(file)) return next();
        const type = file.endsWith(".flac") ? "audio/flac" : file.endsWith(".ogg") ? "audio/ogg" : file.endsWith(".wav") ? "audio/wav" : "audio/mpeg";
        res.setHeader("Content-Type", type);
        createReadStream(file).pipe(res);
      });
      // Gallery (ADR-046): the pool registry is the gallery's source of truth.
      server.middlewares.use("/__registry", (_req, res) => {
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.end(readFileSync(join(repo, "docs/registries/pool-registry.md"), "utf8"));
      });
      // Gallery art notes (ADR-046): append {cardId, note, date} to docs/art/art-notes.md,
      // one bullet per note under a per-card heading. Same pattern as /__flag.
      server.middlewares.use("/__art-note", (req, res, next) => {
        if (req.method !== "POST") return next();
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          try {
            const { cardId, note } = JSON.parse(body) as { cardId: string; note: string };
            if (!cardId || !note) throw new Error("cardId and note required");
            const file = join(repo, "docs/art/art-notes.md");
            const HEADER = `# Art notes

Per-card art/frame notes from gallery browsing (ADR-046). Lifecycle: Chris
writes notes via the gallery's note button; the planner converts them into
\`docs/art/printings.md\` overrides or frame fixes; entries are struck
through (\`~~...~~\`) when resolved. Newest note last within each card.
`;
            let text = existsSync(file) ? readFileSync(file, "utf8") : HEADER;
            const date = new Date().toISOString().slice(0, 10);
            const bullet = `- ${date}: ${note.replace(/\r?\n/g, " ").trim()}`;
            const heading = `## ${cardId}`;
            const idx = text.indexOf(`\n${heading}\n`);
            if (idx === -1) {
              text = text.trimEnd() + `\n\n${heading}\n\n${bullet}\n`;
            } else {
              // Append the bullet at the end of this card's section (before the next heading).
              const sectionStart = idx + 1 + heading.length;
              const nextHeading = text.indexOf("\n## ", sectionStart);
              const head = nextHeading === -1 ? text : text.slice(0, nextHeading);
              const tail = nextHeading === -1 ? "" : text.slice(nextHeading + 1);
              text = head.trimEnd() + `\n${bullet}\n` + (tail ? `\n${tail}` : "");
            }
            writeFileSync(file, text.endsWith("\n") ? text : text + "\n");
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true, file: "docs/art/art-notes.md" }));
          } catch (e) {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: String(e) }));
          }
        });
      });
      // S21 map-art round: pixel-true snapshots from the page (SVG → canvas → PNG dataURL)
      // land in docs/art/snapshots/ — the before/after ledger for art rounds.
      server.middlewares.use("/__snapshot", (req, res, next) => {
        if (req.method !== "POST") return next();
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          try {
            const { name, dataUrl } = JSON.parse(body) as { name: string; dataUrl: string };
            if (!/^[a-z0-9-]+$/.test(name)) throw new Error("name must be kebab-case");
            const b64 = dataUrl.replace(/^data:image\/png;base64,/, "");
            const dir = join(repo, "docs/art/snapshots");
            mkdirSync(dir, { recursive: true });
            writeFileSync(join(dir, `${name}.png`), Buffer.from(b64, "base64"));
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true, file: `docs/art/snapshots/${name}.png` }));
          } catch (e) {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: String(e) }));
          }
        });
      });
      server.middlewares.use("/__flag", (req, res, next) => {
        if (req.method !== "POST") return next();
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          try {
            const entry = JSON.parse(body);
            const dir = join(repo, "fixtures-inbox");
            mkdirSync(dir, { recursive: true });
            const name = `${entry.matchSpec?.seed ?? "unknown"}-t${entry.turn}-a${entry.actionIndex}.json`;
            writeFileSync(join(dir, name), JSON.stringify(entry, null, 2) + "\n");
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true, file: `fixtures-inbox/${name}` }));
          } catch (e) {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: String(e) }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  root: here,
  plugins: [react(), shandalarDev()],
  resolve: {
    alias: {
      "@shandalar/core": join(repo, "packages/core/src/index.ts"),
      "@shandalar/cards": join(repo, "packages/cards/src/index.ts"),
      "@shandalar/engine": join(repo, "packages/engine/src/index.ts"),
      "@shandalar/agents": join(repo, "packages/agents/src/index.ts"),
      // Browser-safe subpath only — the sim root exports pull in node:fs.
      "@shandalar/sim/decks": join(repo, "packages/sim/src/slice-decks.ts"),
    },
  },
  server: { fs: { allow: [repo] }, port: Number(process.env.PORT) || 5173 },
})
