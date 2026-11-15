"""Render the standalone article from its Markdown source."""
import html
import re
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
        '<main><article class="article" id="article-content">' + body + '</article></main>'
        '</body></html>')
(root / "article.html").write_text(page)

print("Rendered standalone article")
