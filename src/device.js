import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { wheelDelta } from './state.js';

export async function createDevice(canvas, controls) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true, powerPreference:'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=.95;
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(33,1,.1,100);
  camera.position.set(0,.1,9.5); camera.lookAt(0,0,0);
  const pmrem=new THREE.PMREMGenerator(renderer), room=new RoomEnvironment();
  const env=pmrem.fromScene(room,.04); scene.environment=env.texture;scene.environmentIntensity=.8;
  room.dispose(); pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xffffff,0x9c9d89,1.1));
  const key=new THREE.DirectionalLight(0xffffff,2);key.position.set(-3,5,6);scene.add(key);
  const fill=new THREE.DirectionalLight(0xeaf0ff,.6);fill.position.set(3,1,-4);scene.add(fill);
  const model=(await new GLTFLoader().loadAsync('./models/threadpod.glb')).scene;
  const root=new THREE.Group(); root.add(model);scene.add(root);
  const home={x:-.06,y:-.27,z:-.075};
  let target={...home}, rotation={...home};
  root.rotation.set(home.x,home.y,home.z);
  const screen=model.getObjectByName('LCD_Display');
  if(!screen) throw new Error('LCD mesh missing from Blender export');
  const lcd=document.createElement('canvas');lcd.width=640;lcd.height=480;
  const ctx=lcd.getContext('2d');
  const texture=new THREE.CanvasTexture(lcd);texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=false;
  texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;
  screen.material=new THREE.MeshBasicMaterial({map:texture,toneMapped:false,side:THREE.DoubleSide});
  // Blender exports glTF UVs flipped vertically; CanvasTexture uses flipY=false.
  const originals=new Map();
  model.traverse(o=>{if(o.isMesh){o.material=o.material.clone();originals.set(o,o.material.color.clone());o.material.side=THREE.DoubleSide;}});
  let invalid=true,frame=0,disposed=false;
  const size=()=>{const {width,height}=canvas.getBoundingClientRect();renderer.setSize(width,height,false);camera.aspect=width/height;camera.position.z=height/width>1.3?9.5:8.9;camera.updateProjectionMatrix();invalid=true;};
  const observer=new ResizeObserver(size);observer.observe(canvas);size();
  const draw=()=>{
    if(disposed)return;
    let moving=false;
    for(const axis of ['x','y','z']){const delta=target[axis]-rotation[axis];if(Math.abs(delta)>.0001){rotation[axis]+=delta*.15;moving=true;}}
    root.rotation.set(rotation.x,rotation.y,rotation.z);
    if((invalid||moving)&&!document.hidden){renderer.render(scene,camera);invalid=false;}
    frame=requestAnimationFrame(draw);
  };draw();
  function paint(state){
    const {threads,index,page,filter,playing,favorites,source}=state;
    const dark='#263129', bg='#c4cdb6';
    ctx.fillStyle=bg;ctx.fillRect(0,0,640,480);
    ctx.fillStyle='#344032';ctx.font='bold 31px Arial';ctx.textBaseline='middle';ctx.textAlign='center';
    const title=page==='home'?'threadPod':page==='detail'?'Now browsing':filter==='active'?'In progress':filter==='waiting'?'Needs you':filter==='starred'?'Favorites':'All threads';
    ctx.fillText(title,310,35);
    ctx.textAlign='left';ctx.font='bold 23px Arial';ctx.fillText(playing?'▶':'',22,35);
    ctx.strokeStyle=dark;ctx.lineWidth=3;ctx.strokeRect(549,20,52,27);ctx.fillStyle=dark;ctx.fillRect(554,25,41,17);ctx.fillRect(602,28,6,11);
    ctx.fillRect(0,65,640,3);
    const trim=(str,max)=>{let value=String(str);while(ctx.measureText(value).width>max&&value.length)value=value.slice(0,-1);return value!==str?value.slice(0,-1)+'…':value;};
    if(page==='home'){
      const items=['All threads','In progress','Needs you','Favorites'];
      items.forEach((name,i)=>{const y=92+i*72;if(i===state.homeIndex){ctx.fillStyle=dark;ctx.fillRect(0,y-19,640,65);ctx.fillStyle=bg;}else ctx.fillStyle=dark;ctx.font='bold 31px Arial';ctx.fillText(name,24,y+13);ctx.fillText('›',592,y+13);});
      ctx.fillStyle=dark;ctx.font='22px Arial';ctx.fillText('A little less tab chaos.',24,421);
    }else if(page==='detail'&&threads[index]){
      const t=threads[index];ctx.fillStyle=dark;
      ctx.strokeStyle=dark;ctx.lineWidth=3;ctx.strokeRect(25,90,113,116);ctx.font='bold 48px monospace';ctx.fillText('{ }',36,145);
      ctx.font='bold 28px Arial';ctx.fillText(trim(t.agent,430),162,111);ctx.font='24px Arial';ctx.fillText(trim(t.project,425),162,151);ctx.font='21px Arial';ctx.fillText(t.status==='active'?'● In progress':t.status==='waiting'?'◐ Needs you':t.status==='completed'?'✓ Complete':'○ '+t.status,162,187);
      ctx.font='bold 31px Arial';let words=t.title.split(' '),line='',lines=[];
      words.forEach(w=>{if(ctx.measureText(line+w).width>580&&line){lines.push(line.trim());line='';}line+=w+' ';});if(line)lines.push(line.trim());
      lines.slice(0,3).forEach((l,i)=>ctx.fillText(trim(l,580),26,251+i*39));
      ctx.font='21px Arial';ctx.fillText('MENU: back   •   ◀ ▶: next thread',26,397);
      ctx.strokeRect(27,429,584,9);ctx.fillRect(27,429,584*(index+1)/Math.max(threads.length,1),9);
    }else if(!threads.length){ctx.fillStyle=dark;ctx.font='bold 30px Arial';ctx.fillText('No threads here.',26,126);ctx.font='24px Arial';ctx.fillText('Try another filter.',26,178);}
    else{
      const start=Math.max(0,Math.min(index-2,threads.length-5));
      threads.slice(start,start+5).forEach((t,i)=>{const y=76+i*65;const chosen=start+i===index;
        ctx.fillStyle=chosen?dark:bg;ctx.fillRect(0,y,625,65);ctx.fillStyle=chosen?bg:dark;
        ctx.font='bold 29px Arial';ctx.fillText(trim(t.title,535),22,y+33);ctx.fillText('›',589,y+33);
        if(favorites.has(t.id)){ctx.font='15px Arial';ctx.fillText('*',564,y+28);}
      });
      if(threads.length>5){ctx.fillStyle='#a1af94';ctx.fillRect(629,76,7,325);ctx.fillStyle=dark;ctx.fillRect(629,76+(index/(threads.length-1))*260,7,65);}
      ctx.fillStyle=dark;ctx.fillRect(0,413,640,2);ctx.font='22px Arial';ctx.fillText(`${index+1} of ${threads.length}`,24,447);ctx.textAlign='right';ctx.fillText(source==='demo'?'Demo collection':source==='local'?'Local Codex':'Your collection',612,447);ctx.textAlign='left';
    }
    texture.needsUpdate=true;screen.material.map=texture;invalid=true;
  }
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
  function hit(e){const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);return ray.intersectObject(model,true)[0];}
  function wheelPoint(e){const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);
    root.updateMatrixWorld(true);const inverse=root.matrixWorld.clone().invert();const localRay=ray.ray.clone().applyMatrix4(inverse);const p=new THREE.Vector3();return localRay.intersectPlane(new THREE.Plane(new THREE.Vector3(0,0,1),-.36),p)?p:null;}
  let gesture=null;
  canvas.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;const h=hit(e);if(!h)return;
    canvas.parentElement.focus({preventScroll:true});const p=wheelPoint(e),onWheel=p&&Math.hypot(p.x,p.y+1.02)<.96&&Math.abs(rotation.y) < 1.1;
    gesture={kind:onWheel?'wheel':'orbit',x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false,angle:p?Math.atan2(p.x,p.y+1.02):0,accum:0,p,center:onWheel&&Math.hypot(p.x,p.y+1.02)<.34};
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove',e=>{
    if(!gesture){const h=hit(e);canvas.style.cursor=h?'grab':'default';return;}
    const g=gesture;if(Math.hypot(e.clientX-g.x,e.clientY-g.y)>5)g.moved=true;
    if(g.kind==='orbit'){target.y+=(e.clientX-g.lastX)*.009;target.x=THREE.MathUtils.clamp(target.x+(e.clientY-g.lastY)*.005,-.7,.7);g.lastX=e.clientX;g.lastY=e.clientY;}
    else if(!g.center){const p=wheelPoint(e);if(!p)return;const angle=Math.atan2(p.x,p.y+1.02);g.accum+=wheelDelta(g.angle,angle);g.angle=angle;if(Math.abs(g.accum)>.24){const steps=Math.trunc(g.accum/.24);g.accum-=steps*.24;controls.step(steps);}}
  });
  canvas.addEventListener('pointerup',e=>{const g=gesture;gesture=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);if(!g||g.moved||g.kind!=='wheel')return;
    if(g.center)controls.select();else{const x=g.p.x,y=g.p.y+1.02;if(Math.abs(y)>Math.abs(x)){y>0?controls.back():controls.play();}else controls.step(x>0?1:-1);}
  });
  canvas.addEventListener('pointercancel',()=>{gesture=null;});
  let wheelAmount=0;
  canvas.addEventListener('wheel',e=>{e.preventDefault();wheelAmount+=e.deltaY;if(Math.abs(wheelAmount)>30){controls.step(Math.sign(wheelAmount));wheelAmount=0;}},{passive:false});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();controls.error('3D rendering paused. Reload to restore the device. Your library is still available.');});
  return {
    paint,
    reset(){target={...home};},
    setFinish(finish){model.traverse(o=>{if(!o.isMesh)return;const name=o.material.name;if(/Ivory polycarbonate/.test(name))o.material.color.set(finish==='black'?'#252823':originals.get(o));if(/Ceramic click wheel/.test(name))o.material.color.set(finish==='black'?'#3b3d39':originals.get(o));if(/Center button/.test(name))o.material.color.set(finish==='black'?'#30332e':originals.get(o));if(/Wheel engraving/.test(name))o.material.color.set(finish==='black'?'#a2a99a':originals.get(o));});invalid=true;},
    dispose(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();renderer.dispose();texture.dispose();env.dispose();model.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
  };
}

