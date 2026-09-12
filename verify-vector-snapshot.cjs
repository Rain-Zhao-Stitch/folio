const {chromium}=require('@playwright/test');
const {PNG}=require('pngjs');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const JSZip=require('jszip');

async function imageBook(){
 const zip=new JSZip();zip.file('mimetype','application/epub+zip');zip.file('META-INF/container.xml','<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OPS/book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
 zip.file('OPS/book.opf','<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="vector-image">vector-image</dc:identifier><dc:title>Vector image</dc:title><dc:language>en</dc:language></metadata><manifest><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/><item id="css" href="book.css" media-type="text/css"/><item id="picture" href="picture.png" media-type="image/png"/></manifest><spine><itemref idref="c1"/></spine></package>');
 zip.file('OPS/book.css','h1{color:rgb(180,20,80);letter-spacing:3px}p{font-size:24px}');
 zip.file('OPS/c1.xhtml','<html xmlns="http://www.w3.org/1999/xhtml"><head><link rel="stylesheet" href="book.css"/></head><body><h1>Embedded image</h1><img src="picture.png" alt="checker"/><p>The image above must survive the optimized page snapshot.</p></body></html>');
 zip.file('OPS/picture.png',Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAATElEQVR4nO3PQQ0AIBDAsAP/nuGNAvZoFSzZOjNnyNi1dwfgUQCeBOBJAB4F4EkAHgXgSQCeBOBJAB4F4EkAHgXgSQCeBOBJAB4F4EkAHgXgSQCeBOBJAF6uATZ/2lMYAAAAAElFTkSuQmCC','base64'));
 return zip.generateAsync({type:'nodebuffer'});
}

async function veryLongBook(){
 const zip=new JSZip();zip.file('mimetype','application/epub+zip');zip.file('META-INF/container.xml','<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OPS/book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
 zip.file('OPS/book.opf','<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="vector-long">vector-long</dc:identifier><dc:title>Vector long offset</dc:title><dc:language>en</dc:language></metadata><manifest><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/></spine></package>');
 const text='Far-offset content must remain visible in an optimized snapshot. '.repeat(10);zip.file('OPS/c1.xhtml','<html xmlns="http://www.w3.org/1999/xhtml"><body>'+Array.from({length:500},(_,index)=>`<p>${index+1}: ${text}</p>`).join('')+'</body></html>');return zip.generateAsync({type:'nodebuffer'});
}

function difference(a,b){
 const left=PNG.sync.read(a),right=PNG.sync.read(b);assert.equal(left.width,right.width);assert.equal(left.height,right.height);
 let absolute=0,changed=0;for(let i=0;i<left.data.length;i+=4){let pixel=0;for(let channel=0;channel<3;channel++){const delta=Math.abs(left.data[i+channel]-right.data[i+channel]);absolute+=delta;pixel=Math.max(pixel,delta);}if(pixel>32)changed++;}
 return {mean:absolute/(left.width*left.height*3),changedRatio:changed/(left.width*left.height)};
}

(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto('http://127.0.0.1:4173');
  await page.locator('#epub-input').setInputFiles('test-results/sample.epub');
  await page.locator('.book-card').click();await page.waitForFunction(()=>!busy&&rendition?.currentLocation()?.start);
  async function compare(label){
   const live=await page.locator('#viewer').screenshot();
   await page.evaluate(async()=>{
    const bounds=$('viewer').getBoundingClientRect(),snapshot=await captureVector(),overlay=document.createElement('div');overlay.className='visual-snapshot';overlay.style.cssText=`position:fixed;z-index:9999;left:${bounds.left}px;top:${bounds.top}px;width:${snapshot.width}px;height:${snapshot.height}px;overflow:hidden;background:var(--paper)`;document.body.append(overlay);await mountSnapshot(snapshot,overlay);overlay.dataset.urls=JSON.stringify(snapshot.objectUrls);
   });
   const rendered=await page.locator('.visual-snapshot').screenshot(),diff=difference(live,rendered);fs.writeFileSync(`test-results/vector-${label.replace(/\s+/g,'-')}-live.png`,live);fs.writeFileSync(`test-results/vector-${label.replace(/\s+/g,'-')}-rendered.png`,rendered);
   await page.evaluate(()=>{const overlay=document.querySelector('.visual-snapshot');for(const url of JSON.parse(overlay.dataset.urls))URL.revokeObjectURL(url);overlay.remove();});
   assert.ok(diff.mean<5,`${label} mean pixel error ${diff.mean}`);assert.ok(diff.changedRatio<.035,`${label} changed-pixel ratio ${diff.changedRatio}`);return diff;
  }
  console.log('Initial vector snapshot',await compare('initial'));
  for(let i=0;i<3;i++)await page.evaluate(()=>rendition.next());
  console.log('Offset vector snapshot',await compare('offset'));
  await page.locator('#theme').click();await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark'&&!busy);await page.waitForTimeout(100);
  console.log('Dark vector snapshot',await compare('dark'));
  const fontPath='C:\\Windows\\Fonts\\arial.ttf';if(fs.existsSync(fontPath)){
   await page.locator('#font-input').setInputFiles({name:'snapshot-custom.ttf',mimeType:'font/ttf',buffer:fs.readFileSync(fontPath)});await page.waitForFunction(()=>!busy&&prefs.font.startsWith('font-'),{timeout:15000});
   console.log('Custom-font vector snapshot',await compare('custom font'));
  }
  await page.locator('#back').click();await page.waitForFunction(()=>$('reader').hidden);await page.locator('#epub-input').setInputFiles({name:'vector-image.epub',mimeType:'application/epub+zip',buffer:await imageBook()});await page.locator('.book-card').first().click();await page.waitForFunction(()=>!busy&&rendition?.currentLocation()?.start);if(await page.evaluate(()=>prefs.theme==='dark')){await page.locator('#theme').click();await page.waitForFunction(()=>prefs.theme==='light'&&!busy);}await page.evaluate(()=>{prefs.font='original';return changeTypography();});await page.waitForFunction(()=>!busy);
  console.log('Embedded-image vector snapshot',await compare('embedded image'));
  await page.locator('#back').click();await page.waitForFunction(()=>$('reader').hidden);await page.locator('#epub-input').setInputFiles({name:'vector-long.epub',mimeType:'application/epub+zip',buffer:await veryLongBook()});await page.locator('.book-card').first().click();await page.waitForFunction(()=>!busy&&rendition?.currentLocation()?.start);await page.evaluate(async()=>{for(let i=0;i<120;i++)await rendition.next();});
  assert.ok(await page.evaluate(()=>$('viewer').querySelector('iframe').getBoundingClientRect().left<$('viewer').getBoundingClientRect().left-100000));console.log('Far-offset vector snapshot',await compare('far offset'));
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
