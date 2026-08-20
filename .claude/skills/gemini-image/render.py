#!/usr/bin/env python3
"""Gemini image render pipeline for the Holodeck project.

Contract (see CLAUDE.md Phase 0):
  - stdout carries EXACTLY ONE LINE: the path to the full-resolution image.
    This holds for fresh renders and cache hits alike. All status, progress,
    and error text goes to stderr. Base64 never touches stdout.
  - Cache: if the manifest already has this entity+variant and the entity's
    locked visual descriptor hasn't changed, the cached path is returned with
    zero API calls. A changed descriptor invalidates the cache (that is what
    makes the descriptor "locked": editing it visibly orphans every asset
    built on it).
  - Conditioning: any entity with a canonical render passes that image as a
    reference on subsequent renders, so appearance holds across variants.
  - Refusals/errors exit nonzero and append a structured line to
    meta/render-refusals.jsonl. The caller degrades to prose description.

Usage:
  render.py --entity-file canon/entities/vex.md
  render.py --entity-file canon/entities/vex.md \
            --variant torchlit --variant-prompt "torchlit, wounded, low angle"
  render.py --entity-file ... --force          # re-render despite cache hit

Exit codes: 0 ok (rendered or cache hit), 2 model refusal, 1 anything else.
"""

import argparse
import base64
import hashlib
import json
import re
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[3]
MANIFEST = PROJECT_ROOT / "assets" / "manifest.json"
STYLE = PROJECT_ROOT / "assets" / "style.md"
REFUSAL_LOG = PROJECT_ROOT / "meta" / "render-refusals.jsonl"
DEFAULT_MODEL = "gemini-3.1-flash-image"
API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
THUMB_MAX_PX = "512"


def log(msg: str) -> None:
    print(msg, file=sys.stderr)


def die(msg: str, code: int = 1) -> "NoReturn":
    log(f"error: {msg}")
    sys.exit(code)


def load_env() -> None:
    """Load KEY=VALUE lines from the project .env without clobbering real env."""
    env_file = PROJECT_ROOT / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())


def extract_descriptor(entity_text: str, entity_path: Path) -> str:
    """Pull the locked visual descriptor block: the first fenced code block
    following a heading that contains 'visual descriptor'. Used verbatim."""
    heading = re.search(
        r"^#{1,6}[^\n]*visual descriptor[^\n]*$", entity_text, re.I | re.M
    )
    if not heading:
        die(f"no 'visual descriptor' heading in {entity_path}")
    fenced = re.search(r"```[^\n]*\n(.*?)```", entity_text[heading.end():], re.S)
    if not fenced:
        die(f"no fenced descriptor block under the visual-descriptor heading in {entity_path}")
    descriptor = fenced.group(1).strip()
    if not descriptor:
        die(f"visual descriptor block in {entity_path} is empty")
    return descriptor


def extract_style_block(style_text: str) -> str:
    """The house style block: first fenced-free section between the two ---
    rules in style.md. Falls back to the whole file if the markers move."""
    parts = style_text.split("\n---\n")
    if len(parts) >= 3:
        block = re.sub(r"^#+ .*$", "", parts[1], flags=re.M).strip()
        if block:
            return block
    return style_text.strip()


def sha256_text(text: str) -> str:
    return "sha256:" + hashlib.sha256(text.encode()).hexdigest()


def load_manifest() -> dict:
    if MANIFEST.exists():
        return json.loads(MANIFEST.read_text())
    return {"entities": {}}


def save_manifest(manifest: dict) -> None:
    MANIFEST.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")


def log_refusal(entity: str, variant: str, reason: str, detail: str) -> None:
    REFUSAL_LOG.parent.mkdir(parents=True, exist_ok=True)
    entry = {
        "at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "entity": entity,
        "variant": variant,
        "reason": reason,
        "detail": detail[:500],
    }
    with REFUSAL_LOG.open("a") as f:
        f.write(json.dumps(entry) + "\n")


def call_gemini(api_key: str, model: str, prompt: str, ref_paths: list, aspect: str):
    """Returns decoded image bytes, or raises RefusalError/RuntimeError."""
    parts = [{"text": prompt}]
    for ref in ref_paths:
        parts.append({
            "inline_data": {
                "mime_type": "image/png",
                "data": base64.b64encode(ref.read_bytes()).decode(),
            }
        })
    body = {
        "contents": [{"parts": parts}],
        "generationConfig": {"responseModalities": ["TEXT", "IMAGE"]},
    }
    if aspect:
        body["generationConfig"]["imageConfig"] = {"aspectRatio": aspect}
    req = urllib.request.Request(
        f"{API_BASE}/{model}:generateContent",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            payload = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")
        raise RuntimeError(f"HTTP {e.code} from Gemini API: {detail[:500]}")
    except urllib.error.URLError as e:
        raise RuntimeError(f"network error reaching Gemini API: {e.reason}")

    feedback = payload.get("promptFeedback", {})
    if feedback.get("blockReason"):
        raise RefusalError(f"prompt blocked: {feedback['blockReason']}", payload)

    candidates = payload.get("candidates") or []
    if not candidates:
        raise RefusalError("no candidates in response", payload)
    for part in candidates[0].get("content", {}).get("parts", []):
        inline = part.get("inlineData") or part.get("inline_data")
        if inline and inline.get("data"):
            return base64.b64decode(inline["data"])
    text_bits = " ".join(
        p.get("text", "") for p in candidates[0].get("content", {}).get("parts", [])
    ).strip()
    finish = candidates[0].get("finishReason", "unknown")
    raise RefusalError(
        f"no image in response (finishReason={finish}) {text_bits[:300]}", payload
    )


class RefusalError(Exception):
    def __init__(self, message: str, payload: dict):
        super().__init__(message)
        self.payload = payload


RETRYABLE = ("HTTP 500", "HTTP 503", "HTTP 504", "network error")
BACKOFF_SECONDS = (5, 15, 30)


def call_with_retries(api_key: str, model: str, prompt: str, ref_paths: list, aspect: str):
    """Retry transient API failures with backoff. Refusals and hard errors
    (auth, quota, bad request) propagate immediately."""
    for attempt, delay in enumerate(BACKOFF_SECONDS + (None,)):
        try:
            return call_gemini(api_key, model, prompt, ref_paths, aspect)
        except RuntimeError as e:
            if delay is None or not any(tag in str(e) for tag in RETRYABLE):
                raise
            log(f"transient failure (attempt {attempt + 1}): {str(e)[:120]}... "
                f"retrying in {delay}s")
            time.sleep(delay)


def make_thumb(full_path: Path, thumb_path: Path) -> None:
    thumb_path.parent.mkdir(parents=True, exist_ok=True)
    result = subprocess.run(
        ["sips", "-Z", THUMB_MAX_PX, str(full_path), "--out", str(thumb_path)],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        log(f"warning: thumbnail generation failed: {result.stderr.strip()}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--entity-file", required=True,
                    help="entity markdown file containing the locked visual descriptor")
    ap.add_argument("--variant", default="canonical",
                    help="variant slug (default: canonical)")
    ap.add_argument("--variant-prompt", default="",
                    help="mood/lighting/framing text for this variant")
    ap.add_argument("--aspect", default="",
                    help="optional aspect ratio, e.g. 1:1, 16:9, 3:4")
    ap.add_argument("--force", action="store_true",
                    help="re-render even on a cache hit")
    ap.add_argument("--no-style", action="store_true",
                    help="skip the style-bible preamble (card illustrations, ADR-052)")
    args = ap.parse_args()

    entity_path = Path(args.entity_file)
    if not entity_path.is_absolute():
        entity_path = PROJECT_ROOT / entity_path
    if not entity_path.exists():
        die(f"entity file not found: {entity_path}")

    slug = re.sub(r"[^a-z0-9]+", "-", entity_path.stem.lower()).strip("-")
    variant = re.sub(r"[^a-z0-9]+", "-", args.variant.lower()).strip("-") or "canonical"

    descriptor = extract_descriptor(entity_path.read_text(), entity_path)
    descriptor_hash = sha256_text(descriptor)

    manifest = load_manifest()
    entity_entry = manifest["entities"].get(slug, {})
    cached = entity_entry.get("renders", {}).get(variant)
    if cached and not args.force:
        cached_path = PROJECT_ROOT / cached["path"]
        if cached["descriptor_hash"] == descriptor_hash and cached_path.exists():
            log(f"cache hit: {slug}/{variant} (0 API calls)")
            print(cached["path"])
            return
        if cached["descriptor_hash"] != descriptor_hash:
            log(f"descriptor changed for {slug}; cached {variant} is stale, re-rendering")

    load_env()
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        die("GEMINI_API_KEY is not set (checked environment and project .env)")
    model = os.environ.get("GEMINI_IMAGE_MODEL", DEFAULT_MODEL)

    style_block = "" if args.no_style else (extract_style_block(STYLE.read_text()) if STYLE.exists() else "")
    prompt_sections = [style_block, "Subject:\n" + descriptor]
    if args.variant_prompt:
        prompt_sections.append("Scene/mood for this rendering:\n" + args.variant_prompt)
    prompt = "\n\n".join(s for s in prompt_sections if s)

    # Conditioning: pass the canonical portrait for identity consistency on
    # every render after the first.
    ref_paths = []
    canonical_variant = entity_entry.get("canonical")
    if canonical_variant and canonical_variant in entity_entry.get("renders", {}):
        canonical_path = PROJECT_ROOT / entity_entry["renders"][canonical_variant]["path"]
        if canonical_path.exists() and not (variant == canonical_variant and args.force):
            ref_paths.append(canonical_path)
            prompt += (
                "\n\nThe attached image is the canonical reference for this "
                "subject. Preserve its exact appearance, features, and design; "
                "change only the lighting, framing, pose, and mood as described."
            )

    log(f"rendering {slug}/{variant} via {model}"
        + (f" (conditioned on {ref_paths[0].name})" if ref_paths else ""))
    try:
        image_bytes = call_with_retries(api_key, model, prompt, ref_paths, args.aspect)
    except RefusalError as e:
        log_refusal(slug, variant, "model_refusal", str(e))
        die(f"model refused: {e} — degrade to prose description; logged to meta/render-refusals.jsonl", 2)
    except RuntimeError as e:
        log_refusal(slug, variant, "api_error", str(e))
        die(str(e))

    rel_full = Path("assets/images") / slug / f"{variant}.png"
    rel_thumb = Path("assets/thumbs") / slug / f"{variant}.png"
    full_path = PROJECT_ROOT / rel_full
    full_path.parent.mkdir(parents=True, exist_ok=True)
    full_path.write_bytes(image_bytes)
    make_thumb(full_path, PROJECT_ROOT / rel_thumb)

    entity_entry.setdefault("renders", {})[variant] = {
        "path": str(rel_full),
        "thumb": str(rel_thumb),
        "descriptor_hash": descriptor_hash,
        "conditioned_on": str(ref_paths[0].relative_to(PROJECT_ROOT)) if ref_paths else None,
        "variant_prompt": args.variant_prompt or None,
        "model": model,
        "rendered_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    entity_entry.setdefault("canonical", variant)
    entity_entry["descriptor_hash"] = descriptor_hash
    manifest["entities"][slug] = entity_entry
    save_manifest(manifest)

    log(f"rendered {slug}/{variant} -> {rel_full} (thumb: {rel_thumb})")
    print(str(rel_full))


if __name__ == "__main__":
    main()
