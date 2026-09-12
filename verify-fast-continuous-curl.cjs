const {chromium}=require('@playwright/test');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto('http://127.0.0.1:4173');
  await page.locator('#epub-input').setInputFiles('test-results/sample.epub');
  await page.locator('.book-card').click();
  await page.waitForFunction(()=>!busy&&preparedTurn?.direction===1,{timeout:15000});
  const expected=await page.evaluate(async()=>{
   const start=rendition.currentLocation().start.cfi,out=[start];
   await rendition.next();out.push(rendition.currentLocation().start.cfi);
   await rendition.next();out.push(rendition.currentLocation().start.cfi);
   await rendition.display(start);return out;
  });
  await page.waitForFunction(()=>preparedTurn?.direction===1,{timeout:15000});
  await page.evaluate(()=>{const original=playThreeTurn;window.fastCurlTurns=0;playThreeTurn=async(...args)=>{window.fastCurlTurns++;return original(...args);};});
  const rect=await page.locator('#paper').boundingBox(),point={x:rect.x+rect.width/2,y:rect.y+100};
  const wheel=deltaX=>page.evaluate(({x,y,deltaX})=>document.elementFromPoint(x,y).dispatchEvent(new WheelEvent('wheel',{deltaX,deltaY:0,deltaMode:0,bubbles:true,cancelable:true})),{...point,deltaX});
  await wheel(500);
  await page.waitForTimeout(48);
  await wheel(8);
  await page.waitForTimeout(10);
  await wheel(20);
  await page.waitForTimeout(10);
  await wheel(100);
  await page.waitForTimeout(10);
  await wheel(120);
  await page.waitForFunction(()=>window.fastCurlTurns>=2,{timeout:20000});
  await page.waitForFunction(()=>!busy&&wheelGesture===null&&wheelReleased,{timeout:20000});
  assert.equal(await page.evaluate(()=>rendition.currentLocation().start.cfi),expected[2]);
  assert.equal(await page.evaluate(()=>window.fastCurlTurns),2);
  assert.deepEqual(errors,[]);
  console.log('A second rising swipe before the release timeout retained a complete GPU curl');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
