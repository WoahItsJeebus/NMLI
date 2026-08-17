#!/usr/bin/env python3
"""Normalize official website artwork captured from each provider into UI icons."""

from __future__ import annotations

import argparse
from pathlib import Path
import xml.etree.ElementTree as ET

from PIL import Image, ImageChops, ImageDraw, ImageOps


OUTPUT_SIZE = 256


def scale(value: int) -> int:
    return round(value * OUTPUT_SIZE / 128)


def content_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    rgb = image.convert("RGB")
    background = Image.new("RGB", rgb.size, rgb.getpixel((0, 0)))
    bbox = ImageChops.difference(rgb, background).getbbox()
    if not bbox:
        raise ValueError("Source image contains no artwork")
    return bbox


def remove_flat_background(
    image: Image.Image,
    background: tuple[int, int, int],
    tolerance: int = 12,
) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            red, green, blue, _alpha = pixels[x, y]
            difference = max(
                abs(red - background[0]),
                abs(green - background[1]),
                abs(blue - background[2]),
            )
            alpha = 0 if difference < tolerance else min(255, difference * 4)
            pixels[x, y] = (red, green, blue, alpha)
    return rgba


def fit_transparent(subject: Image.Image, fraction: float = 0.82) -> Image.Image:
    canvas = Image.new("RGBA", (OUTPUT_SIZE, OUTPUT_SIZE), (0, 0, 0, 0))
    limit = round(OUTPUT_SIZE * fraction)
    fitted = ImageOps.contain(subject, (limit, limit), Image.Resampling.LANCZOS)
    canvas.alpha_composite(fitted, ((OUTPUT_SIZE - fitted.width) // 2, (OUTPUT_SIZE - fitted.height) // 2))
    return canvas


def direct_icon(source: Path, white_badge: bool = False) -> Image.Image:
    subject = Image.open(source).convert("RGBA")
    if not white_badge:
        return fit_transparent(subject, 0.84)
    badge = Image.new("RGBA", (OUTPUT_SIZE, OUTPUT_SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(badge)
    draw.rounded_rectangle(
        (scale(9), scale(9), scale(119), scale(119)),
        radius=scale(24),
        fill=(255, 255, 255, 255),
    )
    fitted = ImageOps.contain(subject, (scale(88), scale(88)), Image.Resampling.LANCZOS)
    badge.alpha_composite(fitted, ((OUTPUT_SIZE - fitted.width) // 2, (OUTPUT_SIZE - fitted.height) // 2))
    return badge


def recolor_alpha(subject: Image.Image, color: tuple[int, int, int]) -> Image.Image:
    rgba = subject.convert("RGBA")
    recolored = Image.new("RGBA", rgba.size, (*color, 255))
    recolored.putalpha(rgba.getchannel("A"))
    return recolored


def gog_icon(source: Path) -> Image.Image:
    image = Image.open(source).convert("RGBA")
    bbox = image.getchannel("A").getbbox()
    if not bbox:
        raise ValueError("GOG source image contains no artwork")
    subject = image.crop(bbox)
    return fit_transparent(recolor_alpha(subject, (91, 53, 196)), 0.84)


def ubisoft_icon(source: Path) -> Image.Image:
    image = Image.open(source).convert("RGBA")
    alpha = image.getchannel("A")

    # The official stacked press logo places the standalone swirl above the
    # UBISOFT wordmark. Find the transparent separator instead of baking in
    # source-specific pixel coordinates.
    minimum_gap = max(8, image.height // 100)
    gap_start = None
    empty_run = 0
    for y in range(image.height // 2, image.height):
        row_is_empty = alpha.crop((0, y, image.width, y + 1)).getbbox() is None
        if row_is_empty:
            empty_run += 1
        else:
            if empty_run >= minimum_gap:
                gap_start = y - empty_run
                break
            empty_run = 0
    if gap_start is None:
        raise ValueError("Could not separate the Ubisoft swirl from its wordmark")

    swirl = image.crop((0, 0, image.width, gap_start))
    bbox = swirl.getchannel("A").getbbox()
    if not bbox:
        raise ValueError("Ubisoft source image contains no swirl artwork")
    return direct_icon_from_image(swirl.crop(bbox), white_badge=True)


def direct_icon_from_image(subject: Image.Image, white_badge: bool = False) -> Image.Image:
    if not white_badge:
        return fit_transparent(subject.convert("RGBA"), 0.84)
    badge = Image.new("RGBA", (OUTPUT_SIZE, OUTPUT_SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(badge)
    draw.rounded_rectangle(
        (scale(9), scale(9), scale(119), scale(119)),
        radius=scale(24),
        fill=(255, 255, 255, 255),
    )
    fitted = ImageOps.contain(
        subject.convert("RGBA"),
        (scale(88), scale(88)),
        Image.Resampling.LANCZOS,
    )
    badge.alpha_composite(fitted, ((OUTPUT_SIZE - fitted.width) // 2, (OUTPUT_SIZE - fitted.height) // 2))
    return badge


def steam_icon(source: Path) -> Image.Image:
    image = Image.open(source).convert("RGB")
    left, top, _right, bottom = content_bbox(image)
    height = bottom - top
    subject = image.crop((left, top, left + height, bottom))
    return fit_transparent(remove_flat_background(subject, image.getpixel((0, 0))), 0.84)


def favicon_icon(source: Path, white_badge: bool = False) -> Image.Image:
    image = Image.open(source).convert("RGB")
    bbox = content_bbox(image)
    subject = image.crop(bbox)
    background = image.getpixel((0, 0))
    if white_badge:
        badge = Image.new("RGBA", (OUTPUT_SIZE, OUTPUT_SIZE), (0, 0, 0, 0))
        draw = ImageDraw.Draw(badge)
        draw.rounded_rectangle(
            (scale(9), scale(9), scale(119), scale(119)),
            radius=scale(24),
            fill=(255, 255, 255, 255),
        )
        transparent_subject = remove_flat_background(subject, background, 8)
        fitted = ImageOps.contain(
            transparent_subject,
            (scale(88), scale(88)),
            Image.Resampling.LANCZOS,
        )
        badge.alpha_composite(fitted.convert("RGBA"), ((OUTPUT_SIZE - fitted.width) // 2, (OUTPUT_SIZE - fitted.height) // 2))
        return badge
    return fit_transparent(remove_flat_background(subject, background, 20), 0.84)


def ea_icon_svg(source: Path) -> str:
    root = ET.parse(source).getroot()
    path = next(element for element in root.iter() if element.tag.endswith("path"))
    icon_commands = path.attrib["d"].split("M1370.89", 1)[0]
    return (
        '<svg width="128" height="128" viewBox="0 0 399 399" fill="none" '
        'xmlns="http://www.w3.org/2000/svg">\n'
        f'  <path fill-rule="evenodd" clip-rule="evenodd" d="{icon_commands}" fill="#255AF6"/>\n'
        '</svg>\n'
    )


def save(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "PNG", optimize=True, compress_level=9)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--steam-source", type=Path, required=True)
    parser.add_argument("--gog-source", type=Path, required=True)
    parser.add_argument("--ubisoft-source", type=Path, required=True)
    parser.add_argument("--ea-source", type=Path, required=True)
    args = parser.parse_args()

    output = args.project.resolve() / "provider-icons"
    save(direct_icon(args.steam_source), output / "steam.png")
    save(gog_icon(args.gog_source), output / "gog.png")
    save(ubisoft_icon(args.ubisoft_source), output / "ubisoft.png")
    (output / "ea.svg").write_text(ea_icon_svg(args.ea_source), encoding="utf-8")
    print(f"Built four official website provider icons in {output}")


if __name__ == "__main__":
    main()
