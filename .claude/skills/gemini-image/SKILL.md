---
name: gemini-image
description: Render portraits, scenes, surfaces, and ornament via the Gemini image API with manifest caching and identity conditioning. Use whenever a styled image of a described subject (a portrait, location, object, or surface) is needed — the /render command routes here.
---

# Gemini image rendering

All image generation goes through one script:

```
python3 .claude/skills/gemini-image/render.py --entity-file <path> \
    [--variant <slug> --variant-prompt "<mood/lighting/framing>"] \
    [--aspect 1:1|3:4|16:9] [--force]
```

Run it from the project root. The script handles everything: cache lookup,
descriptor extraction, style-bible injection (`assets/style.md`, which
mirrors `docs/prompts/style.md` — the project's canonical style source),
conditioning on the canonical render, thumbnail generation, and manifest
update (`assets/manifest.json`).

## Hard rules

- **Never call the Gemini API any other way.** No inline curl, no ad-hoc
  scripts. The cache check and the base64 hygiene live in this script;
  bypassing it bypasses both.
- **stdout is the full-res image path — nothing else.** Both on fresh
  render and cache hit. Never read the full-res image into context;
  inspect the thumbnail at `assets/thumbs/<slug>/<variant>.png` instead.
- **Never paraphrase a descriptor.** The script extracts the locked
  visual descriptor block from the subject's file itself; do not pass
  appearance text around by hand.
- Exit code 2 means the model refused. Do not retry with a reworded
  prompt more than once; the refusal is logged to
  `meta/render-refusals.jsonl`.

## Subject file requirements

The file passed as `--entity-file` must contain a heading with "visual
descriptor" in it, followed by a fenced code block. That block is the
locked descriptor, used verbatim; its hash keys the cache, so editing a
descriptor automatically invalidates that subject's cached renders:

```markdown
## Visual descriptor (locked)

\```text
A weathered brass astrolabe on parchment ...
\```
```

Subject files can live anywhere (e.g. `docs/art/`); the script takes a
path, not a location convention.

## Variants

- Bare render (no `--variant`) is the canonical image; the first-ever
  render of a subject becomes canonical automatically.
- Named variants (`--variant night --variant-prompt "lantern-lit, seen
  from below"`) are conditioned on the canonical image so the subject
  stays visually consistent. Mood, lighting, and framing go in
  `--variant-prompt`; the subject's appearance stays in the descriptor.
- API key: `GEMINI_API_KEY` in the project-root `.env` (gitignored) or
  the environment. Optional `GEMINI_IMAGE_MODEL` overrides the default
  (gemini-3.1-flash-image).
- `--no-style` skips the style-bible preamble. Use it **only** for card
  illustrations (ADR-052 exempts them from style.md); everything
  interface- or world-facing keeps the house style.
