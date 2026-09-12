import * as THREE from 'three';

let renderer;
let lost = false;
let owner = null;
let supported = true;
const metrics = {frames: 0, lastDrawMs: 0, surfaces: 0, textures: 0};

function device() {
  if (!renderer) {
    try{
      const canvas=document.createElement('canvas');
      const context=canvas.getContext('webgl2',{alpha:false,antialias:true,premultipliedAlpha:false,powerPreference:'high-performance'});
      if(!context)throw new Error('WebGL2 is unavailable.');
      renderer = new THREE.WebGLRenderer({canvas,context,antialias:true,alpha:false,premultipliedAlpha:false,powerPreference:'high-performance'});
    }catch(error){supported=false;throw error;}
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearAlpha(1);
    renderer.domElement.className = 'three-curl-canvas';
    renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
    renderer.domElement.addEventListener('webglcontextlost', event => {event.preventDefault();lost = true;});
    renderer.domElement.addEventListener('webglcontextrestored', () => {lost = false;});
  }
  if (lost) throw new Error('The graphics context was lost. Please try turning again.');
  return renderer;
}

async function texture(snapshot, background) {
  const canvas = document.createElement('canvas');
  const scale = Math.min(devicePixelRatio || 1, 1.5, 4096 / Math.max(snapshot.width, snapshot.height));
  canvas.width = Math.max(1, Math.round(snapshot.width * scale));
  canvas.height = Math.max(1, Math.round(snapshot.height * scale));
  const context = canvas.getContext('2d');
  context.scale(scale, scale);context.fillStyle = background;context.fillRect(0, 0, snapshot.width, snapshot.height);
  for (const frame of snapshot.frames) {
    if (!frame.imageUrl) throw new Error('A vector page snapshot is required for GPU rendering.');
    const response = await fetch(frame.imageUrl);
    if (!response.ok) throw new Error('Could not read the page texture.');
    const svg = await response.text(), image = new Image();
    // Blob SVGs containing foreignObject taint a canvas in Chromium. A fully
    // self-contained data SVG stays origin-clean and can be uploaded to WebGL.
    image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    await image.decode();context.drawImage(image, frame.x, frame.y, frame.width, frame.height);
  }
  context.getImageData(0, 0, 1, 1);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;map.generateMipmaps = false;
  map.minFilter = THREE.LinearFilter;map.magFilter = THREE.LinearFilter;
  device().initTexture(map);metrics.textures++;
  return map;
}

const vertexShader = `
  uniform float progress; uniform float pageWidth; uniform float pageHeight;
  uniform float direction; uniform float spine; uniform float spread; uniform float mode;
  uniform float dragX; uniform float dragY; uniform float originY;
  varying vec2 pageUv; varying float lighting;
  void main() {
    pageUv = uv;
    const float PI = 3.14159265;
    float p = clamp(progress, 0.0, 1.0);
    vec2 point = vec2(pageWidth * uv.x, (uv.y-.5) * pageHeight);

    // For a grabbed corner the physical crease is the perpendicular bisector
    // between the corner's resting position and the pointer. Keyboard and
    // trackpad input retain a vertical crease parallel to the binding.
    vec2 normal = vec2(1.0,0.0);
    vec2 contact = vec2(pageWidth*(1.0-p),0.0);
    if (mode > .5) {
      vec2 origin = vec2(pageWidth,originY);
      vec2 pull = origin-vec2(dragX,dragY);
      if (length(pull) > .001) normal=normalize(pull);
      contact=(origin+vec2(dragX,dragY))*.5;
    }
    vec2 line = vec2(-normal.y,normal.x);
    vec2 relative = point-contact;
    float across = dot(relative, normal);
    float along = dot(relative, line);

    // The paper follows a circular arc at the crease, then leaves the arc on
    // its tangent. The turned flap therefore remains inclined above the book
    // instead of becoming a second plane parallel to the page underneath.
    float radius = pageWidth * mix(.075,.115,sin(p*PI));
    float maxBend = mix(2.72,mix(2.35,2.88,p),mode);
    float band = radius*maxBend*.5;
    float curvedAcross = across;
    float z = 0.0;
    float angle = 0.0;
    if (across > -band && across < band) {
      angle = (across+band)/radius;
      curvedAcross = -band + radius*sin(angle);
      z = radius*(1.0-cos(angle));
    } else if (across >= band) {
      angle = maxBend;
      curvedAcross = -band+radius*sin(maxBend)+(across-band)*cos(maxBend);
      z = radius*(1.0-cos(maxBend))+(across-band)*sin(maxBend);
    }
    vec2 curled = contact + line*along + normal*curvedAcross;
    vec3 turned = vec3(curled.x, curled.y, z);
    turned = mix(vec3(point,0.0), turned, smoothstep(0.0,.055,p));
    vec3 landed = vec3(-point.x, point.y, 0.0);
    turned = mix(turned, landed, smoothstep(.945, 1.0, p));

    lighting = 1.0 - .16*sin(min(angle, PI))*sin(p*PI);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(spine + direction*turned.x, turned.y, turned.z+2.0, 1.0);
  }
`;
const fragmentShader = `
  uniform sampler2D beforeMap; uniform sampler2D afterMap;
  uniform float direction; uniform float spread;
  varying vec2 pageUv; varying float lighting;
  void main() {
    bool front = (gl_FrontFacing == (direction > 0.0));
    float u = front ? (direction > 0.0 ? pageUv.x : 1.0-pageUv.x) : (direction > 0.0 ? 1.0-pageUv.x : pageUv.x);
    float offset = front ? (direction > 0.0 ? .5 : 0.0) : (direction > 0.0 ? 0.0 : .5);
    vec2 coord = vec2(spread > .5 ? u*.5+offset : u, pageUv.y);
    vec4 paper = front ? texture2D(beforeMap, coord) : texture2D(afterMap, coord);
    gl_FragColor = vec4(paper.rgb * lighting, 1.0);
    #include <colorspace_fragment>
  }
`;

export async function create(before, after, direction, state, background) {
  const gpu = device(), maps = [], geometries = [], materials = [];
  try {
    maps.push(await texture(before, background));maps.push(await texture(after, background));
    const {width, height, double: spread} = state, pageWidth = spread ? width/2 : width;
    const scene = new THREE.Scene();scene.background = new THREE.Color(background);
    const camera = new THREE.OrthographicCamera(-width/2, width/2, height/2, -height/2, .1, width*5);
    camera.position.z = width*3;
    const plane = (map, w, x, z, half) => {
      const geometry = new THREE.PlaneGeometry(w, height);geometries.push(geometry);
      if (half !== undefined) {const uv = geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setX(i, uv.getX(i)*.5+half*.5);}
      const material = new THREE.MeshBasicMaterial({map,transparent:false,depthTest:true,depthWrite:true,blending:THREE.NoBlending});materials.push(material);
      const mesh = new THREE.Mesh(geometry, material);mesh.position.set(x,0,z);scene.add(mesh);
    };
    plane(maps[1],width,0,0);
    if(spread)plane(maps[0],pageWidth,direction>0?-width/4:width/4,1,direction>0?0:1);
    // Keep the binding visible during a turn without projecting it onto the
    // moving sheet. It sits above flat textures but below the curled page, so
    // depth testing hides only the portions that are physically covered.
    if(spread){
      const spineGeometry=new THREE.PlaneGeometry(1,height);geometries.push(spineGeometry);
      const spineMaterial=new THREE.MeshBasicMaterial({color:0x777777,transparent:false,depthTest:true,depthWrite:true,blending:THREE.NoBlending});materials.push(spineMaterial);
      const binding=new THREE.Mesh(spineGeometry,spineMaterial);binding.position.set(0,0,2.05);scene.add(binding);
    }
    const geometry = new THREE.PlaneGeometry(1,1,80,40);geometries.push(geometry);
    const material = new THREE.ShaderMaterial({
      uniforms:{progress:{value:0},pageWidth:{value:pageWidth},pageHeight:{value:height},direction:{value:direction},spine:{value:spread?0:-direction*width/2},spread:{value:spread?1:0},mode:{value:0},dragX:{value:pageWidth},dragY:{value:-height/2},originY:{value:-height/2},beforeMap:{value:maps[0]},afterMap:{value:maps[1]}},
      vertexShader,fragmentShader,side:THREE.DoubleSide,depthTest:true,depthWrite:true,transparent:false,blending:THREE.NoBlending
    });materials.push(material);
    const sheet = new THREE.Mesh(geometry,material);sheet.frustumCulled=false;scene.add(sheet);
    const shadowGeometry=new THREE.PlaneGeometry(width,height);geometries.push(shadowGeometry);
    const shadowMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,
      uniforms:{progress:material.uniforms.progress,direction:{value:direction},width:{value:width},height:{value:height},pageWidth:{value:pageWidth},spine:material.uniforms.spine,dark:{value:background==='#000000'?1:0},mode:material.uniforms.mode,dragX:material.uniforms.dragX,dragY:material.uniforms.dragY,originY:material.uniforms.originY},
      vertexShader:'varying vec2 v; void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:'uniform float progress,direction,width,height,pageWidth,spine,dark,mode,dragX,dragY,originY; varying vec2 v; void main(){vec2 normal=vec2(1.0,0.0);vec2 contact=vec2(pageWidth*(1.0-progress),0.0);if(mode>.5){vec2 origin=vec2(pageWidth,originY);vec2 pull=origin-vec2(dragX,dragY);if(length(pull)>.001)normal=normalize(pull);contact=(origin+vec2(dragX,dragY))*.5;}vec2 point=vec2((((v.x-.5)*width)-spine)*direction,(v.y-.5)*height);float distance=dot(point-contact,normal);float alpha=(1.0-dark)*.12*sin(progress*3.14159265)*exp(-abs(distance)/22.0);gl_FragColor=vec4(vec3(0.0),alpha);}'
    });materials.push(shadowMaterial);const shadow=new THREE.Mesh(shadowGeometry,shadowMaterial);shadow.position.z=1.5;scene.add(shadow);
    gpu.compile(scene,camera);
    const host = document.createElement('div');host.className='three-curl-host';host.style.cssText='position:absolute;inset:0;overflow:hidden;pointer-events:none';
    let disposed=false,last=-1;metrics.surfaces++;
    const surface={host,state,direction,progress:0,mode:'spine',
      draw(progress,interaction={},force=false){
        if(typeof interaction==='boolean'){force=interaction;interaction={};}
        if(disposed)return;const p=Number.isFinite(progress)?Math.max(0,Math.min(1,progress)):0;
        const mode=interaction.mode==='corner'?1:0,cornerY=Math.max(-height*.5,Math.min(height*1.5,Number.isFinite(interaction.cornerY)?interaction.cornerY:height)),startY=Math.max(0,Math.min(height,Number.isFinite(interaction.startY)?interaction.startY:cornerY)),cornerSign=startY<height/2?1:-1;
        const fallbackX=direction>0?width*(1-p):width*p,pointerX=Number.isFinite(interaction.pointerX)?interaction.pointerX:fallbackX,spineWorld=spread?0:-direction*width/2;
        const dragX=Math.max(-pageWidth*1.5,Math.min(pageWidth*1.25,(pointerX-width/2-spineWorld)*direction)),dragY=height/2-cornerY,originY=height/2-startY;
        const dx=pageWidth-dragX,dy=originY-dragY,lineX=-dy,lineY=dx,screenX=direction*lineX,screenY=-lineY,foldAngle=((Math.atan2(screenY,screenX)*180/Math.PI)%180+180)%180;
        const signature=`${p}:${mode}:${dragX}:${dragY}:${originY}`;
        if(!force&&signature===last&&owner===surface)return;
        const begin=performance.now(),active=device();
        if(owner!==surface){active.setSize(width,height,false);host.append(active.domElement);owner=surface;}
        material.uniforms.progress.value=p;material.uniforms.mode.value=mode;material.uniforms.dragX.value=dragX;material.uniforms.dragY.value=dragY;material.uniforms.originY.value=originY;active.render(scene,camera);last=signature;surface.progress=p;surface.mode=mode?'corner':'spine';
        host.dataset.progress=String(p);host.dataset.mode=surface.mode;host.dataset.corner=cornerSign>0?'top':'bottom';host.dataset.cornerY=String(cornerY);host.dataset.foldAngle=String(mode?foldAngle:90);host.dataset.flapTilt=String(mode?(2.35+(2.88-2.35)*p)*180/Math.PI:2.72*180/Math.PI);host.dataset.opaque=String(!material.transparent&&material.depthWrite&&material.blending===THREE.NoBlending);metrics.frames++;metrics.lastDrawMs=performance.now()-begin;
      },
      dispose(){if(disposed)return;disposed=true;if(owner===surface){gpu.domElement.remove();owner=null;}host.remove();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const map of maps){map.dispose();map.image.width=map.image.height=1;metrics.textures--;}metrics.surfaces--;}
    };
    return surface;
  } catch(error) {for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const map of maps){map.dispose();metrics.textures--;}throw error;}
}

export function stats(){return {...metrics,contexts:renderer?1:0,lost,renderer:renderer?.info};}
window.FolioGPU={create,stats,available:()=>supported&&!lost};
