"""Render measured prediction-horizon figures from the checked-in study data."""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parents[1]
DATA=json.loads((ROOT/'article/horizon-study.json').read_text())
W,H=1000,670
BG='#f8f7f3';INK='#142d32';MUTED='#647a7c';TEAL='#116d79';ORANGE='#da6836';GRID='#dbe3df'
FONT='/System/Library/Fonts/Supplemental/Arial.ttf'
def font(n):
 try:return ImageFont.truetype(FONT,n)
 except OSError:return ImageFont.load_default(size=n)
def text(d,xy,s,size=22,fill=INK):d.text(xy,s,font=font(size),fill=fill)
def base(title,subtitle):
 im=Image.new('RGB',(W,H),BG);d=ImageDraw.Draw(im)
 text(d,(48,32),title,32);text(d,(48,80),subtitle,19,MUTED)
 return im,d
def horizon(active):
 im,d=base('A longer prediction, a larger disagreement','Root-position error against MuJoCo · 128 windows from 8 seeded trajectories')
 left,right,top,bottom=100,945,170,515
 y=lambda v:bottom-v/16*(bottom-top)
 for v in [0,4,8,12,16]:
  d.line((left,y(v),right,y(v)),fill=GRID,width=2);text(d,(48,y(v)-12),str(v),18,MUTED)
 text(d,(48,127),'cm',18,MUTED)
 for i,r in enumerate(DATA['summary']['all']):
  x=180+i*175;color=TEAL if i==active else '#b6ccc9'
  d.rounded_rectangle((x-40,y(r['medianRootCm']),x+40,bottom),radius=4,fill=color)
  d.line((x,y(r['p10RootCm']),x,y(r['p90RootCm'])),fill=INK,width=3)
  for v in [r['p10RootCm'],r['p90RootCm']]:d.line((x-10,y(v),x+10,y(v)),fill=INK,width=3)
  text(d,(x-34,530),['20 ms','100 ms','200 ms','500 ms','1 sec'][i],19,INK)
  text(d,(x-32,y(r['p90RootCm'])-34),f"{r['medianRootCm']:.2f}",20,TEAL if i==active else MUTED)
 text(d,(115,578),'Bars: median · whiskers: 10th–90th percentile',19,MUTED)
 text(d,(115,615),'Scripted trajectories include falls. This measures prediction, not balance.',18,MUTED)
 return im
def subset(active):
 im,d=base('The pattern also appears in higher starting states','Median root-position error · same measured horizons')
 left,right,top,bottom=100,945,180,505;y=lambda v:bottom-v/10*(bottom-top)
 for v in [0,2,4,6,8,10]:d.line((left,y(v),right,y(v)),fill=GRID,width=2);text(d,(54,y(v)-12),str(v),18,MUTED)
 text(d,(48,140),'cm',18,MUTED)
 for key,color,label,yy in [('all',TEAL,'All windows · n = 128',120),('highRoot',ORANGE,'Starting root > 0.6 m · n = 56',150)]:
  d.line((580,yy+10,615,yy+10),fill=color,width=4);text(d,(628,yy),label,18,color)
  points=[(180+i*175,y(r['medianRootCm'])) for i,r in enumerate(DATA['summary'][key])]
  d.line(points,fill=color,width=4)
  for i,(x,yp) in enumerate(points):
   radius=9 if i==active else 5;d.ellipse((x-radius,yp-radius,x+radius,yp+radius),fill=color)
  x,yp=points[active];text(d,(x-35,yp+14 if key=='highRoot' else yp-34),f"{DATA['summary'][key][active]['medianRootCm']:.2f} cm",18,color)
 for i,label in enumerate(['20 ms','100 ms','200 ms','500 ms','1 sec']):text(d,(147+i*175,525),label,19)
 text(d,(100,577),'A starting-height filter does not establish stable standing or walking.',18,MUTED)
 text(d,(100,612),'Windows overlap; they are not independent trials.',18,MUTED)
 return im
for name,render in [('horizon',horizon),('state-check',subset)]:
 frames=[render(i) for i in range(5)]
 frames[-1].save(ROOT/'work'/f'{name}.png')
 frames[0].save(ROOT/'article/gifs'/f'{name}.gif',save_all=True,append_images=frames[1:],duration=[1400]*5,loop=0,optimize=False)
print('Rendered horizon.gif and state-check.gif from measured data')
