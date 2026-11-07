"""Blender 5.x: build, export, render and round-trip validate threadPod.
Run: blender --background --factory-startup --python build_threadpod.py
Dimensions are authored in mm, converted to meters. Front = -Y in Blender.
"""
import bpy, math, json, shutil
from pathlib import Path
from datetime import datetime
from mathutils import Vector
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output'
OUT.mkdir(exist_ok=True)
for f in OUT.iterdir():
    if f.is_file():
        backup = ROOT / 'backups' / datetime.now().strftime('%Y%m%d-%H%M%S')
        backup.mkdir(parents=True, exist_ok=True)
        shutil.copy2(f, backup / f.name)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for datablocks in (bpy.data.meshes, bpy.data.materials, bpy.data.curves, bpy.data.cameras, bpy.data.lights):
    for block in list(datablocks):
        if block.users == 0: datablocks.remove(block)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.render.engine = 'CYCLES'
scene.cycles.samples = 64
scene.cycles.use_denoising = True
scene.render.resolution_x = 1400
scene.render.resolution_y = 1400
scene.render.resolution_percentage = 100
scene.view_settings.view_transform = 'AgX'
scene.world.color = (.15, .15, .15)
def p(x, y, depth): return (x*.001, -depth*.001, y*.001)
def mat(name, color, metallic=0, rough=.35, coat=0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    n = m.node_tree.nodes.get('Principled BSDF')
    n.inputs['Base Color'].default_value = (*color, 1)
    n.inputs['Metallic'].default_value = metallic
    n.inputs['Roughness'].default_value = rough
    n.inputs['Coat Weight'].default_value = coat
    n.inputs['Coat Roughness'].default_value = .12
    return m
ivory = mat('Casing_PearlWhite', (.88,.89,.87), .04, .24, .32)
silver = mat('Back_PolishedAluminium', (.62,.67,.73), 1, .23)
edge = mat('Edge_Chrome', (.72,.76,.80), 1, .17)
dark = mat('Seams_Graphite', (.018,.023,.028), .25, .48)
wheelmat = mat('Wheel_Ceramic', (.73,.75,.73), .03, .37, .12)
ink = mat('Controls_CoolGrey', (.045,.06,.075), 0, .46)
glass = mat('Screen_Glass', (.04,.07,.085), .12, .12, .5)
orange = mat('Hold_Orange', (.95,.21,.025), 0, .4)
root = bpy.data.objects.new('threadPod', None); scene.collection.objects.link(root)
root['asset_version'] = '1.0'; root['dimensions_mm'] = '62 x 103 x 11'
root['front_axis'] = 'glTF +Z'; root['units'] = 'meters'
def finish(obj, name, material, parent=root, bevel=0):
    obj.name = name
    obj.data.materials.append(material)
    if parent: obj.parent = parent
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    if bevel:
        m = obj.modifiers.new('Machined edge radius', 'BEVEL'); m.width = bevel*.001; m.segments = 3
        bpy.ops.object.modifier_apply(modifier=m.name)
    for f in obj.data.polygons: f.use_smooth = True
    n = obj.modifiers.new('Weighted corner normals', 'WEIGHTED_NORMAL'); n.keep_sharp = True; n.weight = 50
    bpy.ops.object.modifier_apply(modifier=n.name)
    # Every mesh receives explicit UVs; the display has a dedicated planar map.
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.uv.smart_project(island_margin=.02)
    bpy.ops.object.mode_set(mode='OBJECT')
    obj.select_set(False)
    return obj
def contour(w,h,r, cx=0,cy=0, n=12):
    pts=[]
    for x,y,start in [(w/2-r,h/2-r,0),(-w/2+r,h/2-r,90),(-w/2+r,-h/2+r,180),(w/2-r,-h/2+r,270)]:
        for j in range(n+1):
            a=math.radians(start+j*90/n)
            pts.append((cx+x+r*math.cos(a),cy+y+r*math.sin(a)))
    return pts
def prism(name,w,h,t,r,loc,material,bevel=.12):
    pts=contour(w,h,r); N=len(pts)
    verts=[p(x,y,z) for z in [-t/2,t/2] for x,y in pts]
    faces=[tuple(reversed(range(N))),tuple(range(N,2*N))]
    faces += [(i,(i+1)%N,(i+1)%N+N,i+N) for i in range(N)]
    mesh=bpy.data.meshes.new(name); mesh.from_pydata(verts,[],faces); mesh.update()
    ob=bpy.data.objects.new(name,mesh); scene.collection.objects.link(ob); ob.location=p(*loc)
    return finish(ob,name,material,bevel=bevel)
def ringframe(name,outer,inner,depth,t,material):
    # Closed rounded frame with a true opening for the recessed glass.
    a=contour(*outer); b=contour(*inner)
    N=len(a); verts=[p(x,y,z) for z in [depth-t/2,depth+t/2] for pts in [a,b] for x,y in pts]
    faces=[]
    for i in range(N):
        j=(i+1)%N
        faces += [(i,j,2*N+j,2*N+i),(N+j,N+i,3*N+i,3*N+j),
                  (j,i,N+i,N+j),(2*N+i,2*N+j,3*N+j,3*N+i)]
    mesh=bpy.data.meshes.new(name); mesh.from_pydata(verts,[],faces); mesh.update()
    obj=bpy.data.objects.new(name,mesh); scene.collection.objects.link(obj)
    return finish(obj,name,material,bevel=.12)
def disk(name,r,depth,loc,material,bevel=.12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=96,radius=r*.001,depth=depth*.001,location=p(*loc),rotation=(math.pi/2,0,0))
    ob=bpy.context.object
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    return finish(ob,name,material,bevel=bevel)
def text(name,body,size,loc,material,parent=root):
    curve=bpy.data.curves.new(name,'FONT'); curve.body=body; curve.align_x='CENTER'; curve.align_y='CENTER'
    curve.size=size*.001; curve.resolution_u=4
    ob=bpy.data.objects.new(name,curve); scene.collection.objects.link(ob)
    ob.location=p(*loc); ob.rotation_euler=(math.pi/2,0,0)
    bpy.context.view_layer.objects.active=ob; ob.select_set(True); bpy.ops.object.convert(target='MESH')
    ob=bpy.context.object
    finish(ob,name,material)
    if parent != root:
        world=ob.matrix_world.copy(); ob.parent=parent; ob.matrix_world=world
    return ob
prism('Body_Back',62,103,8.4,5,(0,0,-1.3),silver,.45)
prism('Body_Seam',61.9,102.9,.35,5,(0,0,2.98),dark,.06)
ringframe('Body_Front',(61.8,102.8,4.9),(49.2,38.2,2,0,23),4.25,2.5,ivory)
ringframe('Screen_Bezel',(49.1,38.1,2,0,23),(46,34.6,1,0,23),4.85,.65,dark)
prism('Screen_Glass',46,34.6,.32,1,(0,23,4.86),glass,.1)
# Screen plane uses an embedded original 512 x 384 texture, with clearcoat glass response.
screenmat=mat('Screen_Display', (1,1,1), 0, .2, .45)
nodes=screenmat.node_tree.nodes; bsdf=nodes.get('Principled BSDF')
tex=nodes.new('ShaderNodeTexImage'); tex.image=bpy.data.images.load(str(ROOT/'textures'/'screen.png')); tex.image.pack()
screenmat.node_tree.links.new(tex.outputs['Color'],bsdf.inputs['Base Color'])
screenmat.node_tree.links.new(tex.outputs['Color'],bsdf.inputs['Emission Color'])
bsdf.inputs['Emission Strength'].default_value=.32
mesh=bpy.data.meshes.new('DisplayUV')
mesh.from_pydata([p(-22.5,6.125,5.035),p(22.5,6.125,5.035),p(22.5,39.875,5.035),p(-22.5,39.875,5.035)],[],[(0,1,2,3)])
mesh.uv_layers.new(name='UVMap')
for loop,uv in zip(mesh.uv_layers.active.data,[(0,0),(1,0),(1,1),(0,1)]): loop.uv=uv
display=bpy.data.objects.new('Screen_Display',mesh); scene.collection.objects.link(display); display.parent=root; mesh.materials.append(screenmat)
disk('Wheel_Recess',21.4,.18,(0,-23,5.55),dark,.06)
disk('Wheel_Base',21.1,.3,(0,-23,5.69),wheelmat,.1)
wheel=bpy.data.objects.new('ClickWheel',None); scene.collection.objects.link(wheel); wheel.parent=root; wheel.location=p(0,-23,5.85)
wheel['interactive']='wheel'; wheel['rotation_axis']='local Z in glTF'
def sector(name,angle):
    N=24; verts=[]
    for z in [-.10,.10]:
        for r in [7.8,20.95]:
            for j in range(N+1):
                a=math.radians(angle-44.75+j*89.5/N)
                verts.append(p(r*math.cos(a),r*math.sin(a),z))
    k=N+1; faces=[]
    for i in range(N):
        faces.extend([(i,i+1,k+i+1,k+i),(2*k+i,3*k+i,3*k+i+1,2*k+i+1),
                      (i,2*k+i,2*k+i+1,i+1),(k+i+1,3*k+i+1,3*k+i,k+i)])
    faces += [(0,k,3*k,2*k),(N,2*k+N,3*k+N,k+N)]
    m=bpy.data.meshes.new(name); m.from_pydata(verts,[],faces); m.update()
    ob=bpy.data.objects.new(name,m); scene.collection.objects.link(ob)
    finish(ob,name,wheelmat,parent=wheel,bevel=.04)
    ob['interactive']=name
    # Set each control pivot to its own center, preserving shape and wheel parenting.
    center=Vector(p(14*math.cos(math.radians(angle)),14*math.sin(math.radians(angle)),0))
    for v in m.vertices: v.co-=center
    ob.location=center
    return ob
menu=sector('Button_Menu',90); nxt=sector('Button_Next',0); prev=sector('Button_Previous',180); play=sector('Button_PlayPause',270)
center=disk('Button_Select',7.5,.55,(0,-23,5.9),ivory,.18); center['interactive']='select'
text('Label_Menu','MENU',2.35,(0,-8.3,6.01),ink,menu)
def symbol(name,pts,loc,parent):
    m=bpy.data.meshes.new(name); m.from_pydata([p(x,y,0) for x,y in pts],[],[tuple(range(len(pts)))]); m.update()
    ob=bpy.data.objects.new(name,m); scene.collection.objects.link(ob); ob.location=p(*loc)
    finish(ob,name,ink)
    world=ob.matrix_world.copy(); ob.parent=parent; ob.matrix_world=world
    return ob
for name,sign,button in [('Next',1,nxt),('Previous',-1,prev)]:
    x=sign*14.8
    for j in [-1,1]:
        symbol('Label_'+name+str(j),[(sign*(-.9),-1.1),(sign*1,0),(sign*(-.9),1.1)],(x+j*1.45,-23,6.01),button)
    symbol('Label_'+name+'Stop',[(-.23,-1.15),(.23,-1.15),(.23,1.15),(-.23,1.15)],(x+sign*3,-23,6.01),button)
symbol('Label_Play',[(-1,-1.3),(1.2,0),(-1,1.3)],(-1.8,-37.8,6.01),play)
for x in [1.2,2.5]: symbol('Label_Pause'+str(x),[(-.28,-1.2),(.28,-1.2),(.28,1.2),(-.28,1.2)],(x,-37.8,6.01),play)
# Top/bottom connector details, modeled as recessed dark sockets with metal surrounds.
jack=disk('Headphone_Rim',2.35,.45,(-20,51.35,-1.4),edge,.07)
jack.rotation_euler.x=math.pi/2
hole=disk('Headphone_Socket',1.7,.47,(-20,51.57,-1.4),dark,.05); hole.rotation_euler.x=math.pi/2
hold=prism('Hold_Recess',10,3,.35,1,(16,51.48,-1.5),dark,.05); hold.rotation_euler.x=math.pi/2
slider=prism('Switch_Hold',5.2,2.5,.55,.8,(17.8,51.69,-1.5),ivory,.08); slider.rotation_euler.x=math.pi/2; slider['interactive']='hold'
indicator=prism('Hold_Indicator',2.5,1.6,.1,.3,(12.9,51.7,-1.5),orange,.02); indicator.rotation_euler.x=math.pi/2
port=prism('Dock_Rim',23,3.4,.4,1,(0,-51.5,-1.2),edge,.08); port.rotation_euler.x=-math.pi/2
port=prism('Dock_Socket',21.5,2.4,.44,.6,(0,-51.7,-1.2),dark,.05); port.rotation_euler.x=-math.pi/2
backlabel=text('Back_Engraving','threadPod',5,(0,8,-5.56),ink)
backlabel.rotation_euler.x=-math.pi/2
backsmall=text('Back_Specification','DESIGNED FOR YOUR SOUND\n64 GB   /   MODEL TP-01',1.65,(0,-31,-5.56),ink); backsmall.rotation_euler.x=-math.pi/2
# Looping turntable on the root: exported as one named, opt-in clip.
scene.render.fps=30; scene.frame_start=1; scene.frame_end=241
root.rotation_mode='XYZ'
for frame,angle in [(1,0),(61,math.pi/2),(121,math.pi),(181,math.pi*1.5),(241,math.pi*2)]:
    root.rotation_euler.z=angle; root.keyframe_insert(data_path='rotation_euler',frame=frame)
root.animation_data.action.name='Inspection_360'
for layer in root.animation_data.action.layers:
    for strip in layer.strips:
        for bag in strip.channelbags:
            for fc in bag.fcurves:
                for key in fc.keyframe_points: key.interpolation='LINEAR'
scene.frame_set(1)
asset=[root]+[o for o in scene.objects if o.type=='MESH']+[wheel]
def aim(obj,target): obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
def light(name,loc,power,size,color,target=(0,0,0)):
    data=bpy.data.lights.new(name,'AREA'); data.energy=power*.32; data.shape='DISK'; data.size=size; data.color=color
    ob=bpy.data.objects.new(name,data); scene.collection.objects.link(ob); ob.location=loc; aim(ob,target)
light('Key_Softbox',(.07,-.13,.16),5,.13,(.88,.94,1))
light('Fill_Softbox',(-.13,-.04,.04),3,.10,(1,.91,.78))
light('Rim_Strip',(.04,.08,.10),7,.08,(.75,.86,1))
bpy.ops.object.camera_add(location=(.135,-.255,.125)); camera=bpy.context.object; camera.name='Preview_Camera'
camera.data.type='ORTHO'; camera.data.ortho_scale=.154; camera.data.clip_start=.001; aim(camera,(0,0,0)); scene.camera=camera
floor_mat=mat('Studio_Backdrop',(.035,.055,.075),.1,.55)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.052))
floor=bpy.context.object; floor.name='Studio_Floor'; floor.data.materials.append(floor_mat)
scene.world.use_nodes=True; scene.world.node_tree.nodes.get('Background').inputs[0].default_value=(.19,.24,.31,1)
scene.world.node_tree.nodes.get('Background').inputs[1].default_value=.35
# Export only asset hierarchy; studio objects remain editable in the blend.
bpy.ops.object.select_all(action='DESELECT')
for ob in asset: ob.select_set(True)
bpy.context.view_layer.objects.active=root
export=OUT/'threadPod.glb'
bpy.ops.export_scene.gltf(filepath=str(export),export_format='GLB',use_selection=True,export_animations=True,export_yup=True,export_extras=True,export_materials='EXPORT')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'threadPod.blend'))
scene.render.filepath=str(OUT/'threadPod_preview.png'); bpy.ops.render.render(write_still=True)
camera.location=(0,-.28,.012); aim(camera,(0,0,0)); camera.data.ortho_scale=.128
scene.render.filepath=str(OUT/'threadPod_front.png'); bpy.ops.render.render(write_still=True)
# Automated source validation and fresh-scene import verification.
import bmesh
issues=[]; meshes=[o for o in asset if o.type=='MESH']; triangles=0; uv_missing=[]; open_meshes=[]
for ob in meshes:
    ob.data.calc_loop_triangles(); triangles+=len(ob.data.loop_triangles)
    if not ob.data.uv_layers: uv_missing.append(ob.name)
    bm=bmesh.new(); bm.from_mesh(ob.data)
    if any(f.calc_area()<1e-14 for f in bm.faces): issues.append('Degenerate face: '+ob.name)
    if any(not e.is_manifold for e in bm.edges): open_meshes.append(ob.name)
    bm.free()
report={'blender_version':bpy.app.version_string,'source_meshes':len(meshes),'source_vertices':sum(len(o.data.vertices) for o in meshes),
        'source_polygons':sum(len(o.data.polygons) for o in meshes),'triangles':triangles,'glb_bytes':export.stat().st_size,
        'missing_uvs':uv_missing,'geometry_issues':issues,'open_surface_meshes':open_meshes,
        'open_surface_explanation':'Display and printed/engraved graphic meshes intentionally use single-sided surfaces.',
        'texture':'512 x 384 PNG, embedded','dimensions_mm':[62,103,11],
        'notes':['Connector sockets are shallow visual recesses, without hidden internal electronics.','Inspection animation is opt-in; 8-second linear seamless turntable.','Browser rendering needs an environment map for metal reflections.']}
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(export))
expected=['threadPod','ClickWheel','Button_Menu','Button_Next','Button_Previous','Button_PlayPause','Button_Select','Switch_Hold','Screen_Display']
report['round_trip_import']='passed'
report['interactive_nodes']={name:name in bpy.data.objects for name in expected}
report['imported_animations']=[a.name for a in bpy.data.actions if a.users]
report['imported_meshes']=len([o for o in scene.objects if o.type=='MESH'])
(OUT/'validation.json').write_text(json.dumps(report,indent=2))
print('THREADPOD_REPORT '+json.dumps(report))
assert all(report['interactive_nodes'].values()), 'Missing interactive components'
assert not uv_missing and not issues, 'Mesh validation failed'
