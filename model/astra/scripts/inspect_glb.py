"""Dependency-free structural/accessor checks on the exported binary glTF."""
import json, math, struct
from pathlib import Path
root = Path(__file__).resolve().parents[1]
path = root / 'output' / 'threadPod.glb'
data = path.read_bytes()
magic, version, size = struct.unpack_from('<4sII', data)
assert magic == b'glTF' and version == 2 and size == len(data)
n, kind = struct.unpack_from('<II', data, 12)
doc = json.loads(data[20:20+n])
offset = 20+n
binary_size, kind = struct.unpack_from('<II', data, offset)
binary = data[offset+8:offset+8+binary_size]
def values(index):
    a = doc['accessors'][index]; v = doc['bufferViews'][a['bufferView']]
    fmt = {5126:'f',5125:'I',5123:'H',5121:'B'}[a['componentType']]
    width = {'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
    form = '<'+fmt*width; step=v.get('byteStride',struct.calcsize(form))
    start = v.get('byteOffset',0)+a.get('byteOffset',0)
    return [struct.unpack_from(form,binary,start+i*step) for i in range(a['count'])]
triangles=0; primitives=0; normal_errors=0
for mesh in doc['meshes']:
    for prim in mesh['primitives']:
        primitives+=1
        attrs=prim['attributes']
        assert all(x in attrs for x in ['POSITION','NORMAL','TEXCOORD_0'])
        assert prim.get('mode',4)==4
        pos=values(attrs['POSITION']); normals=values(attrs['NORMAL']); uv=values(attrs['TEXCOORD_0'])
        assert all(math.isfinite(c) for array in [pos,normals,uv] for row in array for c in row)
        normal_errors+=sum(abs(sum(c*c for c in row)-1)>.01 for row in normals)
        inds=[v[0] for v in values(prim['indices'])]
        assert len(inds)%3==0 and max(inds)<len(pos)
        triangles+=len(inds)//3
        assert 'material' in prim
assert normal_errors==0
assert all('uri' not in i and 'bufferView' in i for i in doc['images'])
assert all('uri' not in b for b in doc['buffers'])
names=[n.get('name') for n in doc['nodes']]
assert len(names)==len(set(names))
assert not any(n.startswith('Studio') or n=='Preview_Camera' for n in names)
report={'glb_version':version,'bytes':len(data),'triangles':triangles,'mesh_primitives':primitives,
        'materials':len(doc['materials']),'images':len(doc['images']),'invalid_normals':normal_errors,
        'external_dependencies':0,'animations':[a['name'] for a in doc.get('animations',[])],
        'extensions_used':doc.get('extensionsUsed',[]),'result':'passed'}
(root/'output'/'glb_checks.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
