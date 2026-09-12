const {chromium}=require('@playwright/test');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 try{
  await page.goto('http://127.0.0.1:4173');
  await page.locator('#epub-input').setInputFiles('test-results/sample.epub');
  await page.locator('.book-card').click();
  await page.waitForFunction(()=>!busy&&rendition?.currentLocation()?.start);
  const rect=await page.locator('#paper').boundingBox();
  await page.mouse.move(rect.x+rect.width*.5,rect.y+100);
  const wheel=deltaX=>page.evaluate(({x,y,deltaX})=>document.elementFromPoint(x,y).dispatchEvent(new WheelEvent('wheel',{deltaX,deltaY:0,deltaMode:0,bubbles:true,cancelable:true})),{x:rect.x+rect.width*.5,y:rect.y+100,deltaX});
  for(let i=0;i<3;i++){
   const before=await page.evaluate(()=>rendition.currentLocation().start.cfi);
   await wheel(70);
   await page.waitForFunction(()=>!!wheelGesture&&!wheelGesture.ended);
   const geometry=await page.evaluate(()=>({progress:(wheelGesture.width-wheelGesture.x)/wheelGesture.width,travel:wheelGesture.travel}));
   assert.ok(Math.abs(geometry.progress-105/geometry.travel)<.01);
   await page.waitForTimeout(300);
   const resumed=await page.evaluate(()=>wheelGesture&&!wheelGesture.ended);
   if(!resumed){
    await page.waitForFunction(()=>!busy);
    await wheel(70);
    // Keep the synthetic stroke contiguous. Polling here can itself exceed the
    // release gap on a loaded test machine and split one stroke into two.
    await wheel(150);
   }else{
    await wheel(150);
   }
   await page.waitForFunction(()=>!busy);
   const after=await page.evaluate(()=>rendition.currentLocation().start.cfi);
    assert.notEqual(after,before,JSON.stringify(await page.evaluate(()=>({location:rendition.currentLocation(),gesture:wheelGesture&&{progress:wheelGesture.progress,cancelled:wheelGesture.cancelled,ended:wheelGesture.ended},wheelDistance,wheelReleased}))));
   await wheel(10);
   await page.waitForTimeout(230);
   assert.equal(await page.evaluate(()=>rendition.currentLocation().start.cfi),after);
  }
  console.log('Three consecutive swipes without clicking, 1.5x distance, pause/restart handling, threshold and inertia passed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
