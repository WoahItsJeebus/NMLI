#!/usr/bin/env python3
"""Build extension icons and web-store promotional artwork from the icon master."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageOps


ICON_SPECS = {
    16: 0.875,
    32: 0.875,
    48: 0.875,
    64: 0.875,
    128: 0.75,
    256: 0.75,
    512: 0.75,
}


def alpha_crop(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    bounds = rgba.getchannel("A").getbbox()
    if not bounds:
        raise ValueError("Icon master has no visible pixels")
    return rgba.crop(bounds)


def fit_on_canvas(subject: Image.Image, width: int, height: int, fraction: float) -> Image.Image:
    target_width = max(1, round(width * fraction))
    target_height = max(1, round(height * fraction))
    scale = min(target_width / subject.width, target_height / subject.height)
    resized = subject.resize(
        (max(1, round(subject.width * scale)), max(1, round(subject.height * scale))),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    canvas.alpha_composite(resized, ((width - resized.width) // 2, (height - resized.height) // 2))
    return canvas


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "PNG", optimize=True, compress_level=9)


def gradient_background(width: int, height: int) -> Image.Image:
    image = Image.new("RGBA", (width, height))
    pixels = image.load()
    for y in range(height):
        vertical = y / max(1, height - 1)
        for x in range(width):
            horizontal = x / max(1, width - 1)
            glow = max(0.0, 1.0 - abs(horizontal - 0.53) * 1.8)
            red = round(8 + 11 * vertical + 7 * glow)
            green = round(14 + 18 * vertical + 12 * glow)
            blue = round(22 + 26 * vertical + 25 * glow)
            pixels[x, y] = (red, green, blue, 255)
    return image


def promo_tile(subject: Image.Image, width: int, height: int) -> Image.Image:
    canvas = gradient_background(width, height)
    draw = ImageDraw.Draw(canvas, "RGBA")

    # Abstract library cards make the purpose legible without third-party branding.
    card_width = max(22, round(width * 0.065))
    card_height = max(60, round(height * 0.58))
    gap = max(8, round(card_width * 0.42))
    row_width = 7 * card_width + 6 * gap
    start_x = (width - row_width) // 2
    top = (height - card_height) // 2
    for index in range(7):
        left = start_x + index * (card_width + gap)
        color = (55, 100 + index * 4, 132 + index * 6, 50)
        draw.rounded_rectangle(
            (left, top, left + card_width, top + card_height),
            radius=max(4, card_width // 5),
            fill=color,
            outline=(112, 166, 198, 38),
            width=max(1, width // 700),
        )

    draw.polygon(
        [(0, height), (0, round(height * 0.77)), (round(width * 0.35), height)],
        fill=(242, 105, 14, 58),
    )
    draw.polygon(
        [(width, 0), (round(width * 0.74), 0), (width, round(height * 0.46))],
        fill=(75, 135, 170, 48),
    )

    icon_fraction = 0.59 if width / height < 2 else 0.72
    fitted = fit_on_canvas(subject, width, height, icon_fraction)
    alpha = fitted.getchannel("A")
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    shadow.putalpha(alpha.filter(ImageFilter.GaussianBlur(max(3, width // 110))))
    shadow_color = Image.new("RGBA", canvas.size, (0, 0, 0, 125))
    shadow_color.putalpha(shadow.getchannel("A"))
    canvas.alpha_composite(shadow_color, (0, max(2, height // 60)))
    canvas.alpha_composite(fitted)
    return canvas.convert("RGB")


def normalize_screenshot(path: Path, width: int, height: int) -> None:
    if not path.exists():
        return
    image = Image.open(path).convert("RGB")
    fitted = image if image.size == (width, height) else ImageOps.fit(
        image, (width, height), method=Image.Resampling.LANCZOS, centering=(0.5, 0.5)
    )
    save_png(fitted, path)


def build_screenshot_variants(source: Path, chrome_path: Path, opera_path: Path) -> None:
    image = Image.open(source).convert("RGB")
    chrome = ImageOps.fit(
        image, (1280, 800), method=Image.Resampling.LANCZOS, centering=(0.5, 0.5)
    )
    save_png(chrome, chrome_path)

    opera_content = chrome.resize((800, 500), Image.Resampling.LANCZOS)
    opera = Image.new("RGB", (800, 600), (7, 9, 12))
    opera.paste(opera_content, (0, 50))
    save_png(opera, opera_path)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--chooser-source", type=Path)
    parser.add_argument("--progress-source", type=Path)
    args = parser.parse_args()

    project = args.project.resolve()
    master_path = project / "assets" / "icon-transparent-master.png"
    subject = alpha_crop(Image.open(master_path))

    icon_dir = project / "icons"
    for size, fraction in ICON_SPECS.items():
        save_png(fit_on_canvas(subject, size, size, fraction), icon_dir / f"icon-{size}.png")

    chrome_dir = project / "store-assets" / "chrome"
    opera_dir = project / "store-assets" / "opera"
    save_png(Image.open(icon_dir / "icon-128.png").convert("RGBA"), chrome_dir / "icon-128.png")
    save_png(Image.open(icon_dir / "icon-64.png").convert("RGBA"), opera_dir / "icon-64.png")
    save_png(Image.open(icon_dir / "icon-128.png").convert("RGBA"), opera_dir / "icon-128.png")
    save_png(promo_tile(subject, 440, 280), chrome_dir / "small-promo-440x280.png")
    save_png(promo_tile(subject, 1400, 560), chrome_dir / "marquee-promo-1400x560.png")
    if args.chooser_source:
        build_screenshot_variants(
            args.chooser_source,
            chrome_dir / "01-platform-chooser-1280x800.png",
            opera_dir / "01-platform-chooser-800x600.png",
        )
    if args.progress_source:
        build_screenshot_variants(
            args.progress_source,
            chrome_dir / "02-import-progress-1280x800.png",
            opera_dir / "02-import-progress-800x600.png",
        )
    normalize_screenshot(chrome_dir / "01-platform-chooser-1280x800.png", 1280, 800)
    normalize_screenshot(chrome_dir / "02-import-progress-1280x800.png", 1280, 800)
    normalize_screenshot(opera_dir / "01-platform-chooser-800x600.png", 800, 600)
    normalize_screenshot(opera_dir / "02-import-progress-800x600.png", 800, 600)

    print(f"Built {len(ICON_SPECS)} manifest icons and Chrome/Opera store artwork.")


if __name__ == "__main__":
    main()
