const {chromium}=require('@playwright/test');
const JSZip=require('jszip');
const assert=require('node:assert/strict');

async function longBook(){
 const zip=new JSZip();zip.file('mimetype','application/epub+zip');zip.file('META-INF/container.xml','<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OPS/book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');zip.file('OPS/book.opf','<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="cold-performance">cold-performance</dc:identifier><dc:title>Cold performance</dc:title><dc:language>en</dc:language></metadata><manifest><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/></spine></package>');const paragraph='A cold page turn must never animate a chapter-sized iframe. '.repeat(14);zip.file('OPS/c1.xhtml','<html xmlns="http://www.w3.org/1999/xhtml"><body>'+Array.from({length:750},(_,index)=>`<p>${index+1}: ${paragraph}</p>`).join('')+'</body></html>');return zip.generateAsync({type:'nodebuffer'});
}

(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1280,height:900}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto('http://127.0.0.1:4173');await page.locator('#epub-input').setInputFiles({name:'cold-performance.epub',mimeType:'application/epub+zip',buffer:await longBook()});await page.locator('.book-card').click();await page.waitForFunction(()=>!busy&&rendition?.currentLocation()?.start,{timeout:30000});
  const start=await page.evaluate(()=>{invalidatePreparedTurn();window.coldTiming={input:0,mounts:0};const original=FolioGPU.create;FolioGPU.create=async(...args)=>{window.coldTiming.mounts++;return original(...args);};return rendition.currentLocation().start.cfi;}),paper=await page.locator('#paper').boundingBox();await page.mouse.move(paper.x+paper.width/2,paper.y+120);await page.evaluate(()=>window.coldTiming.input=performance.now());await page.mouse.wheel(100,0);
  await page.waitForFunction(()=>{const edge=document.querySelector('.cold-edge');return edge&&Number(getComputedStyle(edge).opacity)>.1;},{timeout:1000});const response=await page.evaluate(()=>performance.now()-window.coldTiming.input);
  await page.mouse.wheel(100,0);await page.waitForFunction(()=>!busy,{timeout:30000});
  assert.ok(response<150,`cold gesture response took ${response}ms`);assert.ok(await page.evaluate(()=>window.coldTiming.mounts)>0);assert.equal(await page.locator('#animation iframe').count(),0);assert.notEqual(await page.evaluate(()=>rendition.currentLocation().start.cfi),start);assert.deepEqual(errors,[]);console.log(`Cold long-chapter gesture responded in ${response.toFixed(1)}ms before preparing its matching curl`);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
