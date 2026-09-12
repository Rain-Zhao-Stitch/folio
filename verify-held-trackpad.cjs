const {chromium}=require('@playwright/test');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:4173');
  await page.locator('#epub-input').setInputFiles('test-results/sample.epub');
  await page.locator('.book-card').click();
  await page.waitForFunction(()=>!busy&&rendition?.currentLocation()?.start);
  const initial=await page.evaluate(()=>rendition.currentLocation().start.cfi);
  const expectedNext=await page.evaluate(async cfi=>{await rendition.next();const next=rendition.currentLocation().start.cfi;await rendition.display(cfi);return next;},initial);
  const rect=await page.locator('#paper').boundingBox();
  await page.mouse.move(rect.x+rect.width/2,rect.y+150);

  // 150 / 480 = 31.25%: release must return to the current page.
  await page.mouse.wheel(100,0);
  await page.waitForFunction(()=>!!wheelGesture);
  assert.equal(await page.evaluate(()=>wheelGesture.ended),false);
  await page.waitForFunction(()=>!busy);
  assert.equal(await page.evaluate(()=>rendition.currentLocation().start.cfi),initial);
  console.log('Release before the midpoint returned to the current page');

  // 240 / 480 = exactly 50%: "over" is strict, so midpoint returns too.
  await page.waitForTimeout(700);
  await page.mouse.wheel(80,0);await page.waitForTimeout(35);await page.mouse.wheel(80,0);
  await page.waitForFunction(()=>!busy);
  assert.equal(await page.evaluate(()=>rendition.currentLocation().start.cfi),initial);
  console.log('Release exactly at the midpoint returned to the current page');

  // 270 / 480 = 56.25%: it stays unsettled until the release quiet period.
  await page.waitForTimeout(700);
  await page.mouse.wheel(100,0);await page.waitForTimeout(35);await page.mouse.wheel(80,0);
  await page.waitForFunction(()=>!busy);
  assert.equal(await page.evaluate(()=>rendition.currentLocation().start.cfi),expectedNext);
  await page.mouse.wheel(12,0);await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>rendition.currentLocation().start.cfi),expectedNext);
  console.log('Release beyond the midpoint turned exactly one page');

  await page.waitForTimeout(700);
  await page.mouse.wheel(-100,0);await page.waitForTimeout(35);await page.mouse.wheel(-80,0);
  await page.waitForFunction(()=>!busy);
  assert.equal(await page.evaluate(()=>rendition.currentLocation().start.cfi),initial);
  assert.deepEqual(errors,[]);
  console.log('Reverse release beyond the midpoint turned exactly one page');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
