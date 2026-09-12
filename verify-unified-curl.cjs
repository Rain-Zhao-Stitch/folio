const {chromium}=require('@playwright/test');
const {PNG}=require('pngjs');
const assert=require('node:assert/strict');
function mean(a,b){a=PNG.sync.read(a);b=PNG.sync.read(b);assert.equal(a.width,b.width);assert.equal(a.height,b.height);let error=0;for(let i=0;i<a.data.length;i+=4)for(let c=0;c<3;c++)error+=Math.abs(a.data[i+c]-b.data[i+c]);return error/(a.width*a.height*3);}
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 for(const width of [1280,600]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173');await page.locator('#epub-input').setInputFiles('test-results/sample.epub');await page.locator('.book-card').click();await page.waitForFunction(()=>preparedTurn?.gpu&&!busy);
  const initial=await page.locator('#viewer').screenshot({path:'test-results/gpu-live-'+width+'.png'});
  const start=await page.evaluate(()=>rendition.currentLocation().start.cfi);
  await page.evaluate(()=>{window.g={wheel:true,progress:0,ended:false};window.pending=turn(1,g);});
  await page.waitForFunction(()=>!!document.querySelector('#animation canvas'));
  const zero=await page.locator('#animation canvas').screenshot({path:'test-results/gpu-zero-'+width+'.png'});console.log('pixel difference',width,mean(initial,zero));
  // DOM text uses LCD subpixel AA; GPU textures use grayscale AA, especially
  // on fractional-width mobile layouts. Compare with a calibrated tolerance.
  assert.ok(mean(initial,zero)<8,'GPU zero-progress image must match current text');
  await page.evaluate(()=>g.progress=.25);await page.waitForFunction(()=>Number(document.querySelector('.three-curl-host').dataset.progress)===.25);
  await page.evaluate(()=>g.progress=.5);await page.waitForFunction(()=>Number(document.querySelector('.three-curl-host').dataset.progress)===.5);
  const idle=await page.evaluate(()=>FolioGPU.stats().frames);await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>FolioGPU.stats().frames),idle,'held progress must not redraw');
  await page.evaluate(async()=>{g.progress=1;await rendition.next();});await page.waitForTimeout(60);
  const end=await page.locator('#animation canvas').screenshot();
  await page.evaluate(()=>$('paper').classList.remove('turning'));
  const target=await page.locator('#viewer').screenshot();
  assert.ok(mean(target,end)<8,'GPU completed page must match next live text');
  await page.evaluate(async()=>{g.cancelled=true;g.ended=true;await pending;});
  assert.equal(await page.evaluate(()=>rendition.currentLocation().start.cfi),start);
  assert.deepEqual(errors,[]);console.log('GPU image endpoints, proportional input, and idle rendering passed',width);await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
