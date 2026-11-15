"""Original article diagrams and the measured prediction chart."""
import gzip
import json
import math
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "article/visuals"
OUT.mkdir(exist_ok=True)
BG = "#f7f5ef"
INK = "#182e35"
MUTED = "#53646b"
TEAL = "#14767c"
PURPLE = "#6850a1"
ORANGE = "#b84d29"
LINE = "#d9ddd8"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def text(draw, xy, value, size=26, fill=INK, bold=False, anchor=None):
    draw.text(xy, value, font=ImageFont.truetype(BOLD if bold else FONT, size), fill=fill, anchor=anchor)


def arrow(draw, points, color, width=4):
    draw.line(points, fill=color, width=width, joint="curve")
    (x0, y0), (x, y) = points[-2:]
    angle = math.atan2(y-y0, x-x0)
    draw.polygon([(x,y),(x-14*math.cos(angle-.45),y-14*math.sin(angle-.45)),
                  (x-14*math.cos(angle+.45),y-14*math.sin(angle+.45))], fill=color)


def card(draw, box, title, subtitle, color, active=False):
    x0,y0,x1,y1 = box
    draw.rounded_rectangle(box, radius=14, fill="#ffffff", outline=color if active else LINE, width=3 if active else 2)
    text(draw, ((x0+x1)/2,y0+26), title, 27, color, True, "mt")
    for i,line in enumerate(subtitle):
        text(draw, ((x0+x1)/2,y0+73+i*31), line, 22, MUTED, anchor="mt")


im = Image.new("RGB", (1120, 1070), BG)
d = ImageDraw.Draw(im)
text(d,(48,38),"The SuperMimic training loop",43,bold=True)
text(d,(48,100),"Physics supplies experience. Learned dynamics guide the update.",24,MUTED)
lefts = [48,414,780]
width = 292
bands = [
    (180, TEAL, "Collect experience", [
        ("Current policy", ["Chooses joint", "commands"]),
        ("MuJoCo Warp", ["Calculates", "the next state"]),
        ("Replay buffer", ["Stores state,", "action and outcome"])]),
    (443, PURPLE, "Fit the world model", [
        ("Replay windows", ["Saved actions and", "simulator states"]),
        ("World model", ["Predicts the", "same transitions"]),
        ("Prediction loss", ["Updates the", "model weights"])]),
    (706, ORANGE, "Improve the controller", [
        ("Policy", ["Chooses actions", "for the motion goal"]),
        ("Learned rollout", ["Predicts states", "with fixed weights"]),
        ("Objective", ["Rewards + critic", "score the rollout"])]),
]
for y,color,title,items in bands:
    text(d,(48,y-29),title,30,color,True)
    for i,(name,lines) in enumerate(items):
        x = lefts[i]
        card(d,(x,y+24,x+width,y+168),name,lines,color,True)
        if i<2:
            arrow(d,[(x+width+9,y+94),(lefts[i+1]-10,y+94)],color)
arrow(d,[(926,885),(926,932),(194,932),(194,885)],ORANGE)
text(d,(560,950),"Backpropagation updates the policy through the fixed model",24,ORANGE,anchor="mt")
text(d,(48,1020),"Repeat with fresh simulator data • Explanatory redraw of paper Figure 2",22,MUTED)
im.save(OUT/"training-loop.png",optimize=True)

def gradient(phase, progress):
    image=Image.new("RGB",(1000,720),BG)
    draw=ImageDraw.Draw(image)
    headings=["Predict the consequences","Trace the sensitivity backward","Update the controller"]
    descriptions=[
        ["The policy chooses actions.", "The learned dynamics predict a short trajectory."],
        ["How would a small action change alter the score?", "Derivatives connect the score back to the policy."],
        ["The optimizer changes the policy parameters.", "The world-model weights stay fixed in this phase."],
    ]
    text(draw,(42,35),headings[phase],42,bold=True)
    text(draw,(42,100),"Inside one policy-training update",24,MUTED)
    centers=[175,500,825]
    titles=["Policy","World model","Objective"]
    subs=[["Chooses actions"],["Predicts states"],["Scores the motion"]]
    for i,c in enumerate(centers):
        active=phase!=2 or i==0
        color=ORANGE if phase else TEAL
        card(draw,(c-135,215,c+135,362),titles[i],subs[i],color,active)
    for i in range(2):
        arrow(draw,[(centers[i]+141,285),(centers[i+1]-141,285)],TEAL)
    arrow(draw,[(825,377),(825,443),(175,443),(175,377)],ORANGE)
    draw.line((500,377,500,443),fill=ORANGE,width=4)
    arrow(draw,[(750,443),(500,443)],ORANGE)
    arrow(draw,[(475,443),(175,443)],ORANGE)
    text(draw,(500,465),"Gradient through the predicted trajectory",23,ORANGE,anchor="mt")
    if phase==0:
        x=175+650*progress
        draw.ellipse((x-8,184,x+8,200),fill=TEAL)
        text(draw,(500,164),"forward prediction",21,TEAL,anchor="mt")
    elif phase==1:
        x=825-650*progress
        draw.ellipse((x-9,434,x+9,452),fill=ORANGE)
        text(draw,(500,164),"backward gradient",21,ORANGE,anchor="mt")
    else:
        draw.rounded_rectangle((57,201,293,212),radius=4,fill=ORANGE)
        text(draw,(500,164),"policy weights change",21,ORANGE,anchor="mt")
    for i,line in enumerate(descriptions[phase]):
        text(draw,(42,543+i*39),line,27)
    draw.line((42,650,958,650),fill=LINE,width=2)
    text(draw,(42,676),"Conceptual animation • No gradient magnitudes are measured here",22,MUTED)
    return image

frames=[gradient(p,i/17) for p in range(3) for i in range(18)]
durations=[100 if i%18<17 else 1300 for i in range(len(frames))]
frames[0].save(OUT/"gradient-path.gif",save_all=True,append_images=frames[1:],duration=durations,loop=0,optimize=True)
frames[26].save(OUT/"gradient-path.png",optimize=True)

with gzip.open(ROOT/"article/warp-horizons.json.gz","rt") as f:
    data=json.load(f)
plt.rcParams.update({"font.family":"DejaVu Sans","font.size":14,"axes.spines.top":False,"axes.spines.right":False})
fig,ax=plt.subplots(figsize=(10,7.2),dpi=150)
fig.patch.set_facecolor(BG)
ax.set_facecolor(BG)
fig.subplots_adjust(top=.77,bottom=.24,left=.11,right=.86)
fig.text(.07,.94,"A millimetre becomes several centimetres",fontsize=23,weight="bold",color=INK)
fig.text(.07,.885,"Learned-model root-position gap to MuJoCo Warp",fontsize=16,color=MUTED)
for condition,color,label in zip(data["conditions"],[TEAL,ORANGE],["Standard friction · 1.00","Lower friction · 0.35"]):
    rows=condition["summary"]
    xs=[r["seconds"] for r in rows]
    ys=[r["medianCm"][0] for r in rows]
    lows=[min(s[0] for s in r["perSeedCm"]) for r in rows]
    highs=[max(s[0] for s in r["perSeedCm"]) for r in rows]
    ax.fill_between(xs,lows,highs,color=color,alpha=.10,linewidth=0)
    ax.plot(xs,ys,color=color,linewidth=3,marker="o",markersize=6,label=label)
    ax.annotate(f"{ys[-1]:.2f} cm",(1,ys[-1]),xytext=(12,0),textcoords="offset points",va="center",weight="bold",color=color)
ax.set_ylim(0,12);ax.set_xlim(0,1.01)
ax.set_ylabel("Position gap (cm)",color=MUTED)
ax.set_xlabel("Prediction horizon (seconds)",labelpad=12,color=MUTED)
ax.grid(axis="y",color=LINE);ax.set_axisbelow(True)
for spine in ax.spines.values():spine.set_color(LINE)
ax.tick_params(colors=MUTED)
ax.legend(loc="upper left",frameon=False,fontsize=13)
fig.text(.07,.105,"Lines show 20-window medians. Shading spans the four seed medians.",fontsize=12,color=MUTED)
fig.text(.07,.064,"Native MuJoCo vs. Warp at 1 s: 0.00022 cm and 0.0020 cm.",fontsize=12,color=MUTED)
fig.text(.07,.025,"Community checkpoint • Scripted motions including falls • Overlapping windows",fontsize=11,color=MUTED)
fig.savefig(OUT/"prediction-gap.png",facecolor=BG)
plt.close(fig)
print("Rendered article architecture, gradient animation and measured chart.")
