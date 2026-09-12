const {chromium}=require('@playwright/test');
const JSZip=require('jszip');
const assert=require('node:assert/strict');

async function longBook(){
 const zip=new JSZip();
 zip.file('mimetype','application/epub+zip');
 zip.file('META-INF/container.xml','<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OPS/book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
 zip.file('OPS/book.opf','<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="animation-frames">animation-frames</dc:identifier><dc:title>Animation frames</dc:title><dc:language>en</dc:language></metadata><manifest><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/></spine></package>');
 const paragraph='Long chapter content makes compositing pressure representative. '.repeat(14);
 zip.file('OPS/c1.xhtml','<html xmlns="http://www.w3.org/1999/xhtml"><head><style>body{line-height:1.8}p{margin:1em 0}</style></head><body>'+Array.from({length:750},(_,index)=>`<p>${index+1}: ${paragraph}</p>`).join('')+'</body></html>');
 return zip.generateAsync({type:'nodebuffer'});
}

(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 page.on('console',message=>console.log('browser:',message.type(),message.text()));
 try{
  await page.goto('http://127.0.0.1:4173');
  await page.locator('#epub-input').setInputFiles({name:'animation-frames.epub',mimeType:'application/epub+zip',buffer:await longBook()});
  await page.locator('.book-card').click();
  await page.waitForFunction(()=>!busy&&preparedTurn?.direction===1,{timeout:30000});
  const geometry=await page.evaluate(()=>{
   const live=$('viewer').querySelector('iframe'),cached=preparedTurn.host.querySelector('iframe'),image=preparedTurn.host.querySelector('img'),doc=live.contentDocument;
   const html=getComputedStyle(doc.documentElement),body=getComputedStyle(doc.body);
   return {viewer:[$('viewer').clientWidth,$('viewer').clientHeight],live:[live.offsetWidth,live.offsetHeight],cached:cached?[cached.offsetWidth,cached.offsetHeight]:null,image:image?[image.naturalWidth,image.naturalHeight,image.offsetWidth,image.offsetHeight]:null,html:{style:doc.documentElement.getAttribute('style'),width:html.width,height:html.height,overflow:html.overflow},body:{style:doc.body.getAttribute('style'),width:body.width,height:body.height,columnWidth:body.width,columnGap:body.columnGap,overflow:body.overflow}};
  });
  console.log('Geometry',JSON.stringify(geometry));
  await page.evaluate(()=>{
   window.frameProfile={deltas:[],longTasks:[],active:true};let prior;
   new PerformanceObserver(list=>{for(const e of list.getEntries())window.frameProfile.longTasks.push(e.duration);}).observe({type:'longtask'});
   const sample=now=>{if(busy){if(prior!==undefined)window.frameProfile.deltas.push(now-prior);prior=now;}else prior=undefined;if(window.frameProfile.active)requestAnimationFrame(sample);};requestAnimationFrame(sample);
  });
  const rect=await page.locator('#paper').boundingBox();await page.mouse.move(rect.x+rect.width/2,rect.y+150);
  for(const delta of [30,35,40,45,50,55]){await page.mouse.wheel(delta,0);await page.waitForTimeout(25);}
  await page.waitForFunction(()=>!busy,{timeout:30000});await page.waitForTimeout(100);
  const profile=await page.evaluate(()=>{window.frameProfile.active=false;return window.frameProfile;});
  const active=profile.deltas.filter(value=>value<500),sorted=[...active].sort((a,b)=>a-b),p95=sorted[Math.floor(sorted.length*.95)]||0;
  const result={frames:active.length,max:Math.max(...active),p95,over25:active.filter(x=>x>25).length,over50:active.filter(x=>x>50).length,longTasks:profile.longTasks};
  console.log('Frame profile',JSON.stringify(result));
  assert.ok(result.frames>10);
  assert.ok(result.p95<50,`page-turn p95 frame interval was ${result.p95}ms`);
  assert.ok(result.max<140,`page-turn maximum frame interval was ${result.max}ms`);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
