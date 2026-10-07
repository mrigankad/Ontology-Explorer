"""
Turn Google Flow icon exports (rendered on pure white) into transparent,
trimmed, centred PNGs the explorer can use.

    python scripts/icons_cutout.py            # process icons-raw/ -> public/icons/
    python scripts/icons_cutout.py --missing  # list icon keys not generated yet

Name each export after its key (see docs/icon-prompts.md), e.g. `wayameye.png`,
and drop it in `icons-raw/`. The background is removed by flood-filling from the
image border only, so white parts *inside* an object are kept.
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "icons-raw"
OUT = ROOT / "public" / "icons"
SIZE = 256          # output canvas
PAD = 0.08          # transparent margin around the trimmed object
WHITE_TOLERANCE = 28  # how far from pure white still counts as background
KEY = (255, 0, 255)

FAMILIES = ["company", "product", "capability", "technology", "data", "solution", "industry", "client", "stakeholder"]
ENTITIES = [
    "wayam", "wayameye", "vakyam", "pariksha", "sutradhar", "arjuna",
    "computer-vision", "nlp", "agentic-ai", "data-analytics", "automation", "security-compliance", "spatial-ai",
    "object-detection", "ppe-detection", "ocr", "speech-to-text", "summarization",
    "llms", "cv-models", "vector-db", "cloud-platforms", "data-apis",
    "images", "audio", "documents", "structured-data", "sensor-iot",
    "safety-surveillance", "quality-inspection", "itsm", "regulatory-compliance", "call-analytics",
    "document-intelligence", "process-automation",
    "mining", "manufacturing", "healthcare", "it-enterprise", "bfsi", "retail", "government",
    "business-user", "operations-team", "it-team", "compliance-team", "data-scientist", "developer", "end-customer",
]
RECORDS = ["document-passage", "transcript-segment", "image-region", "table-row", "sensor-interval"]
ALL_KEYS = [f"family-{f}" for f in FAMILIES] + ENTITIES + [f"record-{r}" for r in RECORDS]


def cut_out(src: Path) -> Image.Image:
    img = Image.open(src).convert("RGB")
    w, h = img.size
    marked = img.copy()
    # Seed the flood fill from every near-white border pixel (every 4th, which is plenty).
    for x in range(0, w, 4):
        for y in (0, h - 1):
            if min(marked.getpixel((x, y))) >= 255 - WHITE_TOLERANCE:
                ImageDraw.floodfill(marked, (x, y), KEY, thresh=WHITE_TOLERANCE)
    for y in range(0, h, 4):
        for x in (0, w - 1):
            if min(marked.getpixel((x, y))) >= 255 - WHITE_TOLERANCE:
                ImageDraw.floodfill(marked, (x, y), KEY, thresh=WHITE_TOLERANCE)

    # Background mask -> alpha, feathered by a pixel so edges aren't jagged.
    bg = Image.new("L", (w, h), 0)
    pixels = marked.get_flattened_data() if hasattr(marked, "get_flattened_data") else marked.getdata()
    bg.putdata([255 if p == KEY else 0 for p in pixels])
    alpha = Image.eval(bg.filter(ImageFilter.GaussianBlur(0.8)), lambda v: 255 - v)
    out = img.convert("RGBA")
    out.putalpha(alpha)

    box = alpha.point(lambda v: 255 if v > 12 else 0).getbbox()
    if box:
        out = out.crop(box)
    # Fit into a square canvas with padding, centred.
    inner = int(SIZE * (1 - 2 * PAD))
    out.thumbnail((inner, inner), Image.LANCZOS)
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    canvas.paste(out, ((SIZE - out.width) // 2, (SIZE - out.height) // 2), out)
    return canvas


def main() -> None:
    if "--missing" in sys.argv:
        have = {p.stem for p in OUT.glob("*.png")}
        missing = [k for k in ALL_KEYS if k not in have]
        print(f"{len(ALL_KEYS) - len(missing)} of {len(ALL_KEYS)} icons done.")
        for k in missing:
            print("  missing:", k)
        return

    RAW.mkdir(exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    files = sorted(p for p in RAW.iterdir() if p.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"})
    if not files:
        print(f"No images in {RAW}. Export from Google Flow, name each file after its key, and put it there.")
        return
    for src in files:
        key = src.stem.strip().lower().replace(" ", "-")
        if key not in ALL_KEYS:
            print(f"  skip {src.name}: '{key}' is not an icon key (see docs/icon-prompts.md)")
            continue
        cut_out(src).save(OUT / f"{key}.png", optimize=True)
        print(f"  ok   {key}.png")
    print("Done. Reload the explorer; it picks up new icons automatically.")


if __name__ == "__main__":
    main()
