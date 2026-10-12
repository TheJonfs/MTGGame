# The deployment's size — a scoped note (S61, Part 4; not built)

**The problem.** Vercel's Hobby plan caps Deployment Storage at 10 GB across the account and keeps at least three
deployments a project whatever the retention policy says. This project's built site (`packages/ui/dist`) is **399 MB**,
so it holds about 1.2 GB of the cap however rarely it is pushed, and every push uploads the lot again.

**Where the 399 MB is** (measured 2026-10-12):

| directory | files | size | format |
|---|---|---|---|
| `custom-art/` | 82 | 144 MB | PNG, 1024 px, 1.5–2.2 MB each |
| `portraits/` | 113 | 83 MB | PNG |
| `real-art/` | 781 | 56 MB | JPEG (Scryfall) |
| `audio/` | 168 | 51 MB | 76 WAV (16 MB), 71 FLAC (25 MB), 20 OGG (10 MB) |
| `printed-art/` | 66 | 15 MB | JPEG |
| everything else | | ~50 MB | loose images at the top level (menus, towns, boards), map textures and sprites, gate plates, fonts; the code is 2.4 MB |

## Option A — recompress in place (recommended first; half a session)

Nothing moves; the files get smaller. Measured on four files with `cwebp -q 85`: the custom art comes to **15%** of
its PNG size (2.2 MB → 0.34 MB) and a portrait to 13%. Projected: custom art 144 → ~22 MB, portraits 83 → ~11 MB;
the WAV and FLAC to OGG at the quality of the twenty that already are, 41 → ~8 MB. **399 MB → about 170 MB**, and the
site loads faster for it.

- The work: a `scripts/` step that writes `.webp` beside each source PNG (the PNGs stay in the repo as the masters —
  `assets/generated/` and `MANIFEST.md` are untouched), the build copying only the WebP; every `/custom-art/*.png` and
  `/portraits/*.png` reference changed to `.webp` (61 card definitions carry an art path, plus `data/cards/laws`,
  `tokens`, and about fifteen UI call sites); the audio manifest's extensions. One function for "the URL of an art file"
  would make the next change a one-line one — there is none today.
- The risk: a missed reference is a broken image, not a build failure. The gallery route shows every card; a script
  that checks each referenced file exists in `dist` would close it.
- Needs `ffmpeg` or `oggenc` on the build machine for the audio (neither is installed here); the images need only
  `cwebp` (installed) and could be done first.

## Option B — the art and audio outside the deployment

The site keeps its code (a few MB a deployment) and loads media from somewhere that is uploaded once.

- **Where:** Cloudflare R2 (10 GB free, no egress fee) or a second Vercel project that holds only the media and is
  redeployed only when the media changes (it still keeps three deployments — the same 1.2 GB unless it has been
  deployed fewer than three times; so R2 is the one that frees the space). Serving them from GitHub (raw files, or a
  CDN over the repo such as jsDelivr) was not checked: such services have size limits a 350 MB media tree may exceed.
- **The work:** one `ASSET_BASE` (Vite's `import.meta.env`, in the UI package only — the engine, world and sim
  packages never read the environment) put in front of every media URL — the same "one function for an art URL" as
  Option A; an upload script that syncs the five directories; the dev server keeps serving them locally.
- **The cost:** a second service and its credentials; a deploy is no longer one push (new art must be uploaded before
  the code that names it); the browser's cache and CORS headers for audio need a check.

## Recommendation

A, images first. It needs no account, no credentials and no change to how a push works, and it takes the project from
1.2 GB of the cap to about 0.5 GB. B is worth doing only if several projects keep the account near the cap after A.
Until then: batch pushes (Chris is doing this), and delete projects that are no longer needed — each idle project
holds its own three deployments.
