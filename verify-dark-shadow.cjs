const {chromium}=require('@playwright/test');
const {PNG}=require('pngjs');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:900,height:700}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:4173');
  const data=await page.evaluate(async()=>{
   const width=800,height=600;
   const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#000"/></svg>`;
   const imageUrl='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
   const snapshot={width,height,frames:[{imageUrl,x:0,y:0,width,height}]};
   const surface=await FolioGPU.create(snapshot,snapshot,1,{width,height,double:true},'#000000');
   document.body.replaceChildren(surface.host);surface.host.style.cssText='position:fixed;left:0;top:0;width:800px;height:600px';
   surface.draw(.42,{mode:'spine'},true);
   return surface.host.querySelector('canvas').toDataURL('image/png');
  });
  const png=PNG.sync.read(Buffer.from(data.slice(data.indexOf(',')+1),'base64'));
  let brightest=0,litPixels=0;
  for(let i=0;i<png.data.length;i+=4){
    const value=Math.max(png.data[i],png.data[i+1],png.data[i+2]);
    brightest=Math.max(brightest,value);if(value>2)litPixels++;
  }
  assert.ok(brightest<=64,`The dark binding must stay subdued (maximum channel ${brightest})`);
  assert.ok(litPixels<=png.height*4,`Only the narrow binding may be non-black (${litPixels} lit pixels)`);
  assert.deepEqual(errors,[]);
  console.log('Dark page curl keeps a narrow binding without an artificial highlight band');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
