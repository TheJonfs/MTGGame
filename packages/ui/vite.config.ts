import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, join, normalize } from "node:path";
import { createReadStream, existsSync, mkdirSync, writeFileSync } from "node:fs";

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
    },
  },
  server: { fs: { allow: [repo] }, port: Number(process.env.PORT) || 5173 },
})
