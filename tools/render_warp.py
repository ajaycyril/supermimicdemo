"""Render one animated figure from the aggregate Warp horizon study."""
import gzip
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

article = Path("article")
with gzip.open(article / "warp-horizons.json.gz", "rt") as source:
    data = json.load(source)
font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
colors = ("#a64024", "#5947a4")
ink = "#142d32"
muted = "#485e61"
steps = ("20 ms", "100 ms", "200 ms", "500 ms", "1 s")


def label(draw, position, value, size=24, fill=ink, anchor=None):
    draw.text(position, value, font=ImageFont.truetype(font_path, size), fill=fill, anchor=anchor)


def render(active):
    image = Image.new("RGB", (860, 480), "#f8f7f3")
    draw = ImageDraw.Draw(image)
    label(draw, (34, 28), "How far ahead can the model predict?", 35)
    label(draw, (34, 79), "Median root-position gap to MuJoCo Warp", 23, muted)
    label(draw, (34, 126), "Standard friction · 1.00", 21, colors[0])
    label(draw, (398, 126), "Lower friction · 0.35", 21, colors[1])
    limits = [0, 2, 4, 6, 8, 10]
    bottom, top = 366, 164
    y = lambda gap: bottom - gap * (bottom - top) / limits[-1]
    for gap in limits:
        draw.line((89, y(gap), 818, y(gap)), fill="#d9e0dc")
        label(draw, (78, y(gap)), f"{gap:g}", 16, muted, "rm")
    label(draw, (29, 164), "cm", 16, muted)
    for i, step in enumerate(steps):
        x = 131 + 161 * i
        label(draw, (x + 24, 384), step, 18, muted, "ma")
        if i > active:
            continue
        for c, condition in enumerate(data["conditions"]):
            value = condition["summary"][i]["medianCm"][0]
            bar_x = x + 29 * c
            draw.rectangle((bar_x, y(value), bar_x + 21, bottom), fill=colors[c])
            if i == active:
                offset = -6 if c == 0 else 8
                label(draw, (bar_x + 10 + offset, y(value) - 5 - 22 * (1-c)), f"{value:.2f}", 17, colors[c], "ms")
    baseline = [c["summary"][active]["medianCm"][2] for c in data["conditions"]]
    label(draw, (34, 428), f"Native MuJoCo vs. Warp at {steps[active]}: {baseline[0]:.2g} cm and {baseline[1]:.2g} cm", 20, muted)
    return image


frames = [render(i) for i in range(len(steps))]
frames[0].save(article / "gifs" / "forecast-horizon.gif", save_all=True,
               append_images=frames[1:], duration=[900, 700, 700, 850, 4200], loop=0, optimize=True)
