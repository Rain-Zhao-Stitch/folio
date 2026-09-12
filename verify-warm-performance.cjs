const {chromium}=require('@playwright/test');
const JSZip=require('jszip');
const assert=require('node:assert/strict');

async function longBook(){
 const zip=new JSZip();
 zip.file('mimetype','application/epub+zip');
 zip.file('META-INF/container.xml','<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OPS/book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
 zip.file('OPS/book.opf','<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="warm-performance">warm-performance</dc:identifier><dc:title>Warm performance</dc:title><dc:language>en</dc:language></metadata><manifest><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/></spine></package>');
 const paragraph='Long chapter content makes DOM serialization meaningful. '.repeat(14);
 zip.file('OPS/c1.xhtml','<html xmlns="http://www.w3.org/1999/xhtml"><head><style>body{line-height:1.8}p{margin:1em 0}</style></head><body>'+Array.from({length:750},(_,index)=>`<p>${index+1}: ${paragraph}</p>`).join('')+'</body></html>');
 return zip.generateAsync({type:'nodebuffer'});
}

(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto('http://127.0.0.1:4173');
  await page.locator('#epub-input').setInputFiles({name:'warm-performance.epub',mimeType:'application/epub+zip',buffer:await longBook()});
  await page.locator('.book-card').click();
  await page.waitForFunction(()=>!busy&&rendition?.currentLocation()?.start,{timeout:30000});
  await page.waitForFunction(()=>preparedTurn?.direction===1,{timeout:30000});
  const start=await page.evaluate(()=>rendition.currentLocation().start.cfi);
  await page.evaluate(()=>{
   window.warmTiming={};
   const progress=preparedTurn.gpu.draw.bind(preparedTurn.gpu),original=mountSnapshot;
   preparedTurn.gpu.draw=(...args)=>{window.warmTiming.fold??=performance.now();return progress(...args);};
   mountSnapshot=async(...args)=>{window.warmTiming.mounts=(window.warmTiming.mounts||0)+1;return original(...args);};
  });
  const paper=await page.locator('#paper').boundingBox();
  await page.mouse.move(paper.x+paper.width/2,paper.y+150);
  await page.evaluate(()=>window.warmTiming.input=performance.now());
  await page.mouse.wheel(240,0);
  await page.waitForFunction(()=>window.warmTiming.fold!==undefined,{timeout:5000});
  const timing=await page.evaluate(()=>window.warmTiming);
  assert.equal(timing.mounts||0,0);
  assert.ok(timing.fold-timing.input<250,`first parallel frame took ${timing.fold-timing.input}ms after cached input`);
  await page.waitForFunction(()=>!busy,{timeout:30000});
  assert.notEqual(await page.evaluate(()=>rendition.currentLocation().start.cfi),start);
  assert.deepEqual(errors,[]);
  console.log(`Long-chapter cached first fold: ${(timing.fold-timing.input).toFixed(1)}ms`);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
