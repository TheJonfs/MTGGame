---
description: Render (or fetch from cache) a styled image of a described subject
argument-hint: <subject> [variant description]
---

Render an image for: $ARGUMENTS

Follow the gemini-image skill (.claude/skills/gemini-image/SKILL.md). Steps:

1. Resolve the subject to a markdown file containing a "Visual
   descriptor" block (check `docs/art/` first, then wherever this
   project keeps subject files). If no such file exists yet, write one
   first — descriptor blocks are the contract, and they get locked by
   hash.
2. If only a subject was given, render the canonical image:
   `python3 .claude/skills/gemini-image/render.py --entity-file <path> --aspect 1:1`
   (square is the project default per assets/style.md).
3. If a variant description was given, derive a short slug and pass the
   description verbatim:
   `... --variant <slug> --variant-prompt "<description as given>"`
4. The script prints the image path (cache hits included, zero API
   calls — trust it; do not second-guess the cache).
5. Inspect and show results via the **thumbnail**
   (`assets/thumbs/...`), never the full-resolution file.
6. On exit code 2 (refusal): adjust the request once at most; otherwise
   report the refusal — it's already logged to meta/render-refusals.jsonl.
