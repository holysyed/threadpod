"""Build threadPod in Blender. Run: blender --background --python model/build_ipod.py"""
import bpy, math, os
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def material(name, color, metallic=0, roughness=.3):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*color, 1)
    bs.inputs['Metallic'].default_value = metallic
    bs.inputs['Roughness'].default_value = roughness
    return m

ivory = material('Ivory polycarbonate', (.91,.90,.86), 0, .23)
chrome = material('Polished stainless steel', (.66,.69,.72), 1, .18)
edge = material('Chrome edge', (.8,.81,.82), .9, .16)
wheelmat = material('Ceramic click wheel', (.45,.46,.44), .05, .5)
buttonmat = material('Center button', (.86,.86,.82), .03, .3)
ink = material('Wheel engraving', (.12,.13,.12), .1, .6)
black = material('Screen gasket', (.035,.04,.035), .05, .25)
lcd = material('LCD placeholder', (.65,.71,.62), 0, 1)
orange = material('Hold orange', (.9,.23,.04), 0, .35)

def finish(obj, name, mat):
    obj.name = name
    obj.data.materials.append(mat)
    for p in obj.data.polygons: p.use_smooth=True
    return obj

def box(name, loc, dims, bevel, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mod = obj.modifiers.new('Soft manufactured edges', 'BEVEL')
    mod.width=bevel; mod.segments=8
    bpy.ops.object.modifier_apply(modifier=mod.name)
    mod = obj.modifiers.new('Weighted face normals', 'WEIGHTED_NORMAL')
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(obj,name,mat)

def cylinder(name, x, y, z, radius, depth, mat):
    bpy.ops.mesh.primitive_cylinder_add(vertices=128, radius=radius, depth=depth,
        location=(x,y,z), rotation=(math.pi/2,0,0))
    obj=bpy.context.object
    mod=obj.modifiers.new('Button rim', 'BEVEL'); mod.width=.008; mod.segments=3
    bpy.ops.object.modifier_apply(modifier=mod.name)
    mod=obj.modifiers.new('Face normals','WEIGHTED_NORMAL')
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(obj,name,mat)

def text_obj(name, text, pos, size, mat, rotation=(math.pi/2,0,0)):
    c=bpy.data.curves.new(name,'FONT'); c.body=text; c.align_x='CENTER'; c.align_y='CENTER'
    c.size=size; c.extrude=.0005; c.space_character=1.05
    o=bpy.data.objects.new(name,c); bpy.context.collection.objects.link(o)
    o.location=pos; o.rotation_euler=rotation; o.data.materials.append(mat)
    bpy.context.view_layer.objects.active=o; o.select_set(True)
    bpy.ops.object.convert(target='MESH'); o.select_set(False)
    return o

box('Steel back shell',(0,.07,0),(2.72,.51,4.56),.185,chrome)
box('Polished perimeter seam',(0,-.15,0),(2.735,.15,4.575),.17,edge)
box('Ivory front shell',(0,-.213,0),(2.70,.19,4.54),.16,ivory)
box('Recessed screen bezel',(0,-.314,1.02),(2.24,.026,1.73),.065,black)
box('LCD surround',(0,-.330,1.02),(2.15,.018,1.63),.04,wheelmat)

# Explicit screen UVs become a live CanvasTexture in Three.js.
w,h=2.06,1.54; z=1.02; y=-.343
mesh=bpy.data.meshes.new('LCD plane')
mesh.from_pydata([(-w/2,y,z-h/2),(w/2,y,z-h/2),(w/2,y,z+h/2),(-w/2,y,z+h/2)],[],[(0,1,2,3)])
mesh.uv_layers.new(name='UVMap')
for i,uv in enumerate([(0,0),(1,0),(1,1),(0,1)]): mesh.uv_layers.active.data[i].uv=uv
screen=bpy.data.objects.new('LCD_Display',mesh); bpy.context.collection.objects.link(screen)
screen.data.materials.append(lcd)
cylinder('Wheel rim',0,-.310,-1.02,.944,.018,buttonmat)
cylinder('ClickWheel',0,-.324,-1.02,.92,.022,wheelmat)
cylinder('Center rim',0,-.342,-1.02,.338,.026,ink)
cylinder('CenterButton',0,-.359,-1.02,.327,.033,buttonmat)
text_obj('Menu engraving','MENU',(0,-.341,-.335),.115,ink)

def triangle(name,x,z,direction=1):
    m=bpy.data.meshes.new(name)
    m.from_pydata([(x-direction*.045,-.342,z+.057),(x-direction*.045,-.342,z-.057),(x+direction*.045,-.342,z)],[],[(0,1,2)])
    o=bpy.data.objects.new(name,m); bpy.context.collection.objects.link(o); o.data.materials.append(ink)
    for p in m.polygons: p.use_smooth=False
    o.data.materials[0].use_backface_culling=False

for sign in [-1,1]:
    triangle('Skip triangle',sign*.65,-1.02,sign)
    triangle('Skip triangle',sign*.74,-1.02,sign)
    box('Skip bar',(sign*.801,-.342,-1.02),(.017,.002,.115),.001,ink)
triangle('Play',-.085,-1.73,1)
for x in [.045,.095]: box('Pause',(x,-.342,-1.73),(.022,.002,.11),.001,ink)
box('Hold switch recess',(-.67,.02,2.274),(.46,.15,.018),.018,black)
box('Hold indicator',(-.80,.02,2.289),(.16,.11,.009),.008,orange)
box('Hold slider',(-.61,.02,2.293),(.25,.115,.035),.015,chrome)
bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=.1,depth=.012,location=(.78,.02,2.278))
finish(bpy.context.object,'Headphone jack',black)
box('Dock connector',(0,.02,-2.28),(.94,.12,.018),.024,black)
text_obj('Back wordmark','threadPod',(0,.331,.4),.25,ink,(-math.pi/2,0,math.pi))
text_obj('Back edition','1,000 THREADS IN YOUR POCKET',(0,.331,-.08),.068,ink,(-math.pi/2,0,math.pi))

# Save an editable scene with a useful camera and studio lights.
bpy.ops.object.camera_add(location=(5,-10,5))
camera=bpy.context.object
camera.rotation_euler=((Vector((0,0,0))-camera.location).to_track_quat('-Z','Y').to_euler())
bpy.context.scene.camera=camera
for name, loc, power, size in [('Key',(-4,-6,7),1000,5),('Fill',(5,-2,3),700,4),('Rim',(1,4,6),1100,3)]:
    bpy.ops.object.light_add(type='AREA', location=loc)
    lamp=bpy.context.object; lamp.name=name; lamp.data.energy=power; lamp.data.shape='DISK'; lamp.data.size=size
    lamp.rotation_euler=((Vector((0,0,0))-lamp.location).to_track_quat('-Z','Y').to_euler())
bpy.context.scene.render.engine='CYCLES'
bpy.context.scene.cycles.samples=32
bpy.context.scene.world.color=(.25,.25,.25)
bpy.context.scene.render.resolution_x=1000; bpy.context.scene.render.resolution_y=1200
bpy.context.scene.render.resolution_percentage=100
os.makedirs(os.path.join(ROOT,'public','models'),exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'model','threadpod.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,'public','models','threadpod.glb'),export_format='GLB',export_cameras=False,export_lights=False,export_apply=True)
print('THREADPOD_MODEL_READY')

