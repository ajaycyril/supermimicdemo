"""Render the article and prepare a portable Substack editing package."""
import html
import re
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
source = (root / "article/article.md").read_text()
blocks = source.strip().split("\n\n")
title = blocks[0][2:]
subtitle = blocks[1].strip("*")


def inline(text):
    text = html.escape(text)
    text = re.sub(r"\[([^\]]+)\]\((https?://[^)]+)\)", r'<a href="\2">\1</a>', text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"(?<!\*)\*([^*]+)\*", r"<em>\1</em>", text)
    return re.sub(r"`([^`]+)`", r"<code>\1</code>", text)


parts = []
for i, block in enumerate(blocks):
    if block.startswith("!["):
        match = re.fullmatch(r"!\[([^\]]+)\]\((visuals/[^)]+)\)", block)
        if not match:
            raise ValueError("Invalid article image")
        parts.append(f'<figure><img loading="lazy" src="article/{html.escape(match[2])}" alt="{html.escape(match[1])}"></figure>')
    elif block.startswith("# "):
        parts.append("<h1>" + inline(block[2:]) + "</h1>")
    elif i == 1:
        parts.append('<p class="subtitle">' + inline(subtitle) + "</p>")
    elif block.startswith("## "):
        parts.append("<h2>" + inline(block[3:]) + "</h2>")
    elif block.startswith("| "):
        rows = []
        for row_index, row in enumerate(block.splitlines()):
            if row_index == 1:
                continue
            tag = "th" if row_index == 0 else "td"
            rows.append("<tr>" + "".join(f"<{tag}>{inline(value.strip())}</{tag}>" for value in row.strip("|").split("|")) + "</tr>")
        parts.append('<div class="article-table"><table>' + "".join(rows) + "</table></div>")
    else:
        paragraph = inline(block.replace("\n", " "))
        if block.startswith("*") and not block.startswith("**") and block.endswith("*") and parts[-1].endswith("</figure>"):
            parts[-1] = parts[-1][:-9] + "<figcaption>" + paragraph + "</figcaption></figure>"
        else:
            parts.append("<p>" + paragraph + "</p>")

body = "".join(parts)
head = ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1">'
        f'<title>{html.escape(title)} · Ajay Cyril</title>'
        f'<meta name="description" content="{html.escape(subtitle)}">')
page = (head + '<link rel="stylesheet" href="style.css"></head><body class="story-page">'
        '<header><a class="brand" href="./"><span class="mark">D</span> DIGDEEP / ARTICLES</a>'
        '<nav><a href="./">Try the experiment ↗</a></nav></header>'
        '<main><div class="article-actions"><button id="copy-article" type="button">Copy article for Substack</button>'
        '<a href="article/substack/SuperMimic-Substack.zip" download>Download article &amp; visuals</a>'
        '<span id="copy-status" role="status"></span></div>'
        '<article class="article" id="article-content">' + body + '</article></main>'
        '<script type="module" src="src/article.mjs"></script></body></html>')
(root / "article.html").write_text(page)

bundle_dir = root / "article/substack"
bundle_dir.mkdir(exist_ok=True)
portable = (head + '<style>' + (root / "style.css").read_text() +
            '</style></head><body class="story-page"><main><article class="article">' +
            body.replace('src="article/visuals/', 'src="visuals/') + '</article></main></body></html>')
instructions = (
    "SUBSTACK PUBLISHING\n\n"
    f"Title\n{title}\n\nSubtitle\n{subtitle}\n\n"
    "The published article has a Copy article for Substack button. Paste into a new draft, "
    "then move the title and subtitle into Substack's separate fields. "
    "Check the three image placements in the draft and upload the included files wherever needed.\n\n"
    "This package also includes a standalone HTML article and Markdown source. "
    "The PNG version of gradient-path is available for a static replacement.\n\n"
    "All diagrams are original explanatory visuals. The prediction chart uses the linked demo's measurements. "
    "The article contains source credits and links to the demo, code, research and method.\n"
)
with zipfile.ZipFile(bundle_dir / "SuperMimic-Substack.zip", "w", zipfile.ZIP_DEFLATED) as bundle:
    bundle.writestr("SuperMimic-Article.md", source)
    bundle.writestr("SuperMimic-Article.html", portable)
    bundle.writestr("Publishing.txt", instructions)
    for image in sorted((root / "article/visuals").iterdir()):
        bundle.write(image, "visuals/" + image.name)
print("Rendered article and Substack package")
