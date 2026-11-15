"""Render measured prediction figures and the conceptual gradient illustration."""
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
def arrow(d,a,b,color,width=5):
 import math
 d.line((*a,*b),fill=color,width=width)
 angle=math.atan2(b[1]-a[1],b[0]-a[0]);length=13
 d.polygon([b,(b[0]-length*math.cos(angle-.5),b[1]-length*math.sin(angle-.5)),(b[0]-length*math.cos(angle+.5),b[1]-length*math.sin(angle+.5))],fill=color)
def centered(d,x,y,s,size,color=INK):
 d.text((x,y),s,font=font(size),fill=color,anchor='mt')
def gradient(phase,progress):
 im,d=base('How a consequence reaches the controller','A differentiable world model connects actions to a training objective')
 titles=['1  Predict the consequences','2  Differentiate through the prediction','3  Update the policy']
 text(d,(48,135),titles[phase],30,TEAL if phase==0 else ORANGE)
 centers=[145,382,619,856];labels=['Policy','Motor command','World model','Objective']
 details=[['Chooses actions'],['Moves the joints'],['Predicts next state'],['Scores the motion']]
 for i,x in enumerate(centers):
  active=phase==2 and i==0
  d.rounded_rectangle((x-100,218,x+100,358),radius=16,fill=TEAL if active else '#ffffff',outline=TEAL if active else GRID,width=2)
  centered(d,x,245,labels[i],25,'#ffffff' if active else INK)
  centered(d,x,285,details[i][0],19,'#e4f0eb' if active else MUTED)
  if i==2:centered(d,x,321,'Weights fixed here',18,ORANGE)
 for i in range(3):arrow(d,(centers[i]+103,286),(centers[i+1]-103,286),TEAL if phase==0 else GRID,4)
 if phase==0:
  x=145+711*progress;d.ellipse((x-7,198,x+7,212),fill=TEAL)
  centered(d,500,431,'Repeat across a short imagined trajectory.',26)
  centered(d,500,475,'The model predicts what the policy would cause.',24,MUTED)
 else:
  for x in centers:d.line((x,362,x,427),fill=ORANGE if phase==1 else GRID,width=3)
  for i in range(3,0,-1):arrow(d,(centers[i],427),(centers[i-1],427),ORANGE if phase==1 else GRID,4)
  arrow(d,(145,427),(145,363),ORANGE if phase==1 else GRID,4)
  if phase==1:
   x=856-711*progress;d.ellipse((x-8,419,x+8,435),fill=INK)
  centered(d,500,475,'Derivatives pass through fixed model weights.' if phase==1 else 'Change the controller using that sensitivity.',26)
  centered(d,500,520,'How would a small action change alter the objective?' if phase==1 else 'Model fitting is a separate learning step.',23,MUTED)
 d.line((48,583,952,583),fill=GRID,width=2)
 text(d,(48,607),'Conceptual illustration · not measured gradients',21,MUTED)
 text(d,(48,640),'SuperMimic: policy update through learned dynamics',17,MUTED)
 return im
frames=[gradient(phase,i/11) for phase in range(3) for i in range(12)]
frames[18].save(ROOT/'work/gradient-flow.png')
frames[0].save(ROOT/'article/gifs/gradient-flow.gif',save_all=True,append_images=frames[1:],duration=240,loop=0,optimize=True)
print('Rendered measured horizon figures and conceptual gradient-flow.gif')
