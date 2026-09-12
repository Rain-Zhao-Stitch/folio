const {chromium}=require('@playwright/test');const {PNG}=require('pngjs');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1280,height:900}});try{
 await page.goto('http://127.0.0.1:4173');await page.locator('#epub-input').setInputFiles('test-results/sample.epub');await page.locator('.book-card').click();await page.waitForFunction(()=>!busy&&rendition?.currentLocation()?.start);await page.evaluate(()=>turn(1));await page.locator('#theme').click();
 for(const mobile of [false,true]){
  if(mobile){await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500);}
  await page.waitForFunction(()=>preparedTurn?.gpu);
  assert.ok(await page.evaluate(async()=>{const texts=await Promise.all(preparedTurn.currentSnapshot.frames.map(async f=>(await fetch(f.imageUrl)).text()));return texts.some(t=>t.includes('清晨的风'));}));
  const box=await page.locator('#paper').boundingBox();await page.mouse.move(box.x+box.width-5,box.y+box.height-10);await page.mouse.down();await page.mouse.move(box.x+box.width*.68,box.y+box.height*.82,{steps:12});
  await page.waitForFunction(()=>!!document.querySelector('#animation canvas'));
  const image=PNG.sync.read(await page.locator('#animation canvas').screenshot({path:mobile?'test-results/mobile-flipping-text.png':'test-results/desktop-flipping-text.png'}));let light=0,dark=0;
  for(let i=0;i<image.data.length;i+=4){const value=image.data[i]+image.data[i+1]+image.data[i+2];if(value>600)light++;if(value<100)dark++;}
  assert.ok(light>image.width*image.height*.005&&dark>image.width*image.height*.005,'GPU page must contain contrasting text, not a blank sheet');
  await page.mouse.up();await page.waitForFunction(()=>!busy);console.log(mobile?'Portrait GPU page retains text':'Desktop GPU page retains text');
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
