#!/usr/bin/env python3
"""Generate public/og-card.png — 1200x630 share card in the LX ink-on-paper style.

Drawn with PIL primitives only (no fonts beyond default: all text lives in SVG
overlays rendered by Pillow's default font is NOT used — we rasterize real type
via system TTFs already on Windows). Layout mirrors the homepage hero:
top-left rule + wordmark, big display headline with gold underline, kicker,
lede, corridor rule with stops, sedan image right-bottom, ink band footer.
"""
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
PAPER = (244, 241, 232)
PANEL = (251, 249, 242)
INK = (23, 21, 15)
INK2 = (76, 72, 61)
INK3 = (138, 132, 120)
GREEN = (13, 92, 63)
GREEN2 = (10, 74, 50)
GOLD = (185, 138, 47)

FONT_DIR = r"C:\Windows\Fonts"


def font(name, size):
    return ImageFont.truetype(FONT_DIR + "\\" + name, size)


def main():
    im = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(im)

    # --- wordmark: green rule + EHGA Mobility ---
    d.rectangle([84, 62, 84 + 62, 62 + 12], fill=GREEN)
    f_word_bold = font("georgiab.ttf", 34)
    f_word_reg = font("georgia.ttf", 34)
    w1 = d.textlength("EHGA", font=f_word_bold)
    d.text((160, 52), "EHGA", font=f_word_bold, fill=INK)
    d.text((160 + w1 + 10, 52), "Mobility", font=f_word_reg, fill=INK2)

    # --- display headline, two lines ---
    f_disp = font("georgiab.ttf", 108)
    d.text((84, 130), "The road,", font=f_disp, fill=INK)
    d.text((84, 244), "run properly.", font=f_disp, fill=INK)
    # gold underline
    d.rectangle([84, 388, 84 + 130, 388 + 7], fill=GOLD)

    # --- kicker + lede ---
    f_kick = font("georgia.ttf", 22)
    kick = "SEATS · PARCELS · PRIVATE HIRE · SCHOOL RUNS"
    d.text((84, 420), kick, font=f_kick, fill=INK3)
    f_lede = font("georgia.ttf", 27)
    d.text((84, 462), "Koforidua — Accra on the Eastern corridor.", font=f_lede, fill=INK2)
    d.text((84, 498), "Tracked live, start to finish.", font=f_lede, fill=INK2)

    # --- corridor rule, upper right, above ink band ---
    f_stop = font("georgiab.ttf", 24)
    y = 168
    x1, x2 = 700, 1140
    d.line([x1, y, x2, y], fill=INK, width=2)
    # gold dashes overlay
    x = x1
    while x < x2:
        d.line([x, y, x + 1, y], fill=GOLD, width=2)
        x += 9
    # Koforidua stop (green box, K)
    d.rectangle([x1 - 14, y - 14, x1 + 14, y + 14], fill=GREEN, outline=INK)
    d.text((x1, y - 12), "K", font=f_stop, fill=PAPER, anchor="mm")
    d.text((x1 - 10, y - 52), "Koforidua", font=f_stop, fill=INK, anchor="lm")
    # Accra stop (ink box, A)
    d.rectangle([x2 - 14, y - 14, x2 + 14, y + 14], fill=INK, outline=INK)
    d.text((x2, y - 12), "A", font=f_stop, fill=PAPER, anchor="mm")
    d.text((x2 + 10, y - 52), "Accra", font=f_stop, fill=INK, anchor="rm")
    f_small = font("georgiai.ttf", 19)
    d.text(((x1 + x2) / 2, y + 42), "tracked live, start to finish", font=f_small, fill=INK3, anchor="mm")

    # --- sedan at right, above ink band ---
    car = Image.open("public/hero-sedan.png").convert("RGBA")
    car_w = 560
    car_h = int(car.height * car_w / car.width)
    car = car.resize((car_w, car_h), Image.LANCZOS)
    im.paste(car, (W - car_w - 24, H - 96 - car_h), car)

    # --- ink band footer ---
    band_top = H - 96
    d.rectangle([0, band_top, W, H], fill=INK)
    f_foot = font("georgiai.ttf", 20)
    d.text((84, band_top + 30), "Koforidua · Eastern Region · Ghana      seats GHS 90 · parcels from GHS 40", font=f_foot, fill=(203, 198, 184))

    im.save("public/og-card.png", optimize=True)
    print("og-card.png written", im.size)


if __name__ == "__main__":
    main()