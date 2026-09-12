const {chromium}=require('@playwright/test');
const {PNG}=require('pngjs');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 for(const width of [600,1280]){
  const page=await browser.newPage({viewport:{width,height:900}});
  await page.goto('http://127.0.0.1:4173');await page.locator('#epub-input').setInputFiles('test-results/sample.epub');await page.locator('.book-card').click();await page.waitForFunction(()=>!!preparedTurn&&!busy);
  await page.evaluate(async()=>{window.savedTarget=preparedTurn.targetSnapshot;preparedTurn.objectUrls=[];busy=true;invalidatePreparedTurn();await rendition.next();});
  const live=PNG.sync.read(await page.locator('#viewer').screenshot());
  await page.evaluate(async()=>{const b=$('viewer').getBoundingClientRect(),overlay=document.createElement('div');overlay.id='adjacent-test';overlay.style.cssText=`position:fixed;z-index:99999;left:${b.left}px;top:${b.top}px;width:${b.width}px;height:${b.height}px;overflow:hidden;background:var(--paper)`;document.body.append(overlay);await mountSnapshot(savedTarget,overlay);});
  const snap=PNG.sync.read(await page.locator('#adjacent-test').screenshot());
  let error=0;for(let i=0;i<live.data.length;i+=4)for(let c=0;c<3;c++)error+=Math.abs(live.data[i+c]-snap.data[i+c]);const mean=error/(live.width*live.height*3);console.log(width,mean);assert.ok(mean<5,`Adjacent snapshot differs from live page: ${mean}`);await page.close();
 }
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
