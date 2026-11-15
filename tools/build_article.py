"""Render the article source as a readable static article."""
import html,re
from pathlib import Path
root=Path(__file__).resolve().parents[1]
md=(root/'article/article.md').read_text()
def inline(t):
    t=html.escape(t)
    t=re.sub(r'\[([^\]]+)\]\((https?://[^)]+)\)',r'<a href="\2">\1</a>',t)
    t=re.sub(r'\*\*(.+?)\*\*',r'<strong>\1</strong>',t)
    t=re.sub(r'(?<!\*)\*([^*]+)\*',r'<em>\1</em>',t)
    t=re.sub(r'`([^`]+)`',r'<code>\1</code>',t)
    return t
parts=[]
for block in md.strip().split('\n\n'):
    if block.startswith('!['):
        m=re.fullmatch(r'!\[([^\]]+)\]\((gifs/[^)]+)\)',block)
        if not m: raise ValueError('Invalid article image')
        parts.append(f'<figure><img loading="lazy" src="article/{html.escape(m[2])}" alt="{html.escape(m[1])}"></figure>')
    elif block.startswith('# '): parts.append('<h1>'+inline(block[2:])+'</h1>')
    elif block.startswith('## '): parts.append('<h2>'+inline(block[3:])+'</h2>')
    elif block.startswith('> '): parts.append('<div class="article-note">'+inline(block[2:])+'</div>')
    elif block.startswith('| '):
        rows=block.splitlines(); out='<table>'
        for i,row in enumerate(rows):
            if i==1:continue
            tag='th' if i==0 else 'td';out+='<tr>'+''.join(f'<{tag}>{inline(v.strip())}</{tag}>' for v in row.strip('|').split('|'))+'</tr>'
        parts.append(out+'</table>')
    else:parts.append('<p>'+inline(block.replace('\n',' '))+'</p>')
page='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>SuperMimic: why the gradient matters · Ajay Cyril</title><link rel="stylesheet" href="style.css"></head><body><header><a class="brand" href="./"><span class="mark">D</span> DIGDEEP / ARTICLES</a><nav><a href="./">Try the experiment ↗</a></nav></header><main><article class="article"><p class="eyebrow">AJAY CYRIL · PHYSICAL AI EXPERIMENTS</p>'+''.join(parts)+'</article></main></body></html>'
(root/'article.html').write_text(page)
print('Rendered article')
