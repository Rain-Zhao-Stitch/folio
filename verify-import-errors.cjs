const {chromium}=require('@playwright/test');
const JSZip=require('jszip');
const assert=require('node:assert/strict');

async function epubBuffer({drm=false}={}){
 const zip=new JSZip();
 zip.file('mimetype','application/epub+zip');
 zip.file('META-INF/container.xml','<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OPS/book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
 if(drm)zip.file('META-INF/encryption.xml','<encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container">xmlenc#aes</encryption>');
 zip.file('OPS/book.opf','<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">edge-case-book</dc:identifier><dc:title>Edge case book</dc:title><dc:language>en</dc:language></metadata><manifest><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/></spine></package>');
 zip.file('OPS/c1.xhtml','<html xmlns="http://www.w3.org/1999/xhtml"><body><p>Testing import validation.</p></body></html>');
 return zip.generateAsync({type:'nodebuffer'});
}

(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto('http://127.0.0.1:4173');
  await page.locator('#epub-input').setInputFiles({name:'not-a-book.txt',mimeType:'text/plain',buffer:Buffer.from('plain text')});
  await page.waitForFunction(()=>document.querySelector('#toast')?.textContent==='Choose an EPUB file.');
  assert.equal(await page.locator('.book-card').count(),0);

  await page.locator('#epub-input').setInputFiles({name:'damaged.epub',mimeType:'application/epub+zip',buffer:Buffer.from('not a zip archive')});
  await page.waitForFunction(()=>document.querySelector('#toast')?.textContent?.startsWith('Could not import “damaged.epub”'));
  assert.equal(await page.locator('.book-card').count(),0);

  await page.locator('#epub-input').setInputFiles({name:'protected.epub',mimeType:'application/epub+zip',buffer:await epubBuffer({drm:true})});
  await page.waitForFunction(()=>document.querySelector('#toast')?.textContent?.includes('DRM-protected'));
  assert.equal(await page.locator('.book-card').count(),0);

  const valid=await epubBuffer();
  const file={name:'edge-case-book.epub',mimeType:'application/epub+zip',buffer:valid};
  await page.locator('#epub-input').setInputFiles(file);
  await page.locator('.book-card').waitFor();
  assert.equal(await page.locator('.book-card').count(),1);
  await page.locator('#epub-input').setInputFiles(file);
  await page.waitForFunction(()=>document.querySelector('#toast')?.textContent==='This book is already in your library.');
  assert.equal(await page.locator('.book-card').count(),1);
  await page.locator('.book-card').click();
  await page.waitForFunction(()=>!busy&&rendition?.currentLocation()?.start);
  await page.locator('#font-input').setInputFiles({name:'broken.ttf',mimeType:'font/ttf',buffer:Buffer.from('not a font')});
  await page.waitForFunction(()=>document.querySelector('#toast')?.textContent?.startsWith('Could not add the font:'));
  assert.deepEqual(errors,[]);
  console.log('Invalid EPUB and font files, DRM EPUB and duplicate import handling passed');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
