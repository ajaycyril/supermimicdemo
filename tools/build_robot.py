"""Generate the browser MJCF from pinned mjlab G1; Apache-2.0 adaptation.
Modified: omit visual meshes, retain explicit inertias and all collision geoms,
add mjlab-equivalent position actuators, flat ground, solver configuration.
"""
import json
import math
from pathlib import Path
import xml.etree.ElementTree as E

ROOT = Path(__file__).resolve().parents[1]
tree = E.parse(ROOT / 'tools/upstream-g1.xml')
r = tree.getroot()
for parent in r.iter():
    for child in list(parent):
        if child.tag == 'mesh' or (child.tag == 'geom' and child.get('class') == 'visual'):
            parent.remove(child)
        elif child.tag == 'default' and child.get('class') == 'visual':
            parent.remove(child)
# No mesh assets are needed: all moving bodies have explicit inertias.
r.find('compiler').attrib.pop('meshdir', None)
E.SubElement(r, 'option', timestep='0.005', integrator='implicitfast',
             solver='Newton', cone='pyramidal', iterations='10', ls_iterations='20',
             tolerance='1e-8', ls_tolerance='0.01', impratio='1', gravity='0 0 -9.81')
world = r.find('worldbody')
E.SubElement(world, 'geom', name='ground', type='plane', size='0 0 0.05',
             friction='1 0.005 0.0001', contype='1', conaffinity='1', condim='3')
for g in world.iter('geom'):
    name = g.get('name', '')
    if name.endswith('_collision'):
        foot = ('_foot' in name)
        g.set('contype', '1'); g.set('conaffinity', '1')
        g.set('condim', '3' if foot else '1')
        g.set('priority', '1' if foot else '0')
        if foot: g.set('friction', '1 0.005 0.0001')

def inertia(rotor, gears):
    return rotor[0]*(gears[1]*gears[2])**2 + rotor[1]*gears[2]**2 + rotor[2]

i5020 = inertia((.139e-4,.017e-4,.169e-4),(1,1+46/18,1+56/16))
i14 = inertia((.489e-4,.098e-4,.533e-4),(1,4.5,1+48/22))
i22 = inertia((.489e-4,.109e-4,.738e-4),(1,4.5,5))
i4010 = inertia((.068e-4,0,0),(1,5,5))
w = 10*2*3.1415926535
act = E.SubElement(r, 'actuator')
joints = []
for j in world.iter('joint'):
    if j.get('type') == 'free': continue
    n = j.get('name')
    if not n: continue
    if any(t in n for t in ('hip_pitch','hip_yaw','waist_yaw')): arm, limit = i14,88
    elif any(t in n for t in ('hip_roll','knee')): arm, limit = i22,139
    elif any(t in n for t in ('wrist_pitch','wrist_yaw')): arm, limit = i4010,5
    elif any(t in n for t in ('ankle','waist_roll','waist_pitch')): arm, limit = 2*i5020,50
    else: arm, limit = i5020,25
    kp, kd = arm*w*w, 4*arm*w
    j.set('armature', str(arm))
    E.SubElement(act, 'position', name=n+'_motor', joint=n, kp=str(kp), kv=str(kd),
                 forcelimited='true', forcerange=f'{-limit} {limit}', ctrllimited='false')
    home = 0
    for part,value in [('hip_pitch',-.312),('knee',.669),('ankle_pitch',-.363),('elbow',.6),('shoulder_pitch',.2)]:
        if part in n: home=value
    if 'shoulder_roll' in n: home=.2 if n.startswith('left') else -.2
    joints.append(dict(name=n, home=home, scale=.25*limit/kp, kp=kp, kd=kd, armature=arm))
assert len(joints) == 29, len(joints)
out = ROOT / 'dist/assets'; out.mkdir(parents=True, exist_ok=True)
E.indent(tree)
tree.write(out / 'g1.xml', encoding='unicode')
(out/'robot.json').write_text(json.dumps({'joints':joints,'dt':.02,'substeps':4,
    'source_commit':'8bb2bc9e187797689ec82c78c35019afd2fd0376'},indent=2))
print('Built G1 physics: 29 joints, explicit inertias, 50 Hz controls / 200 Hz physics')
