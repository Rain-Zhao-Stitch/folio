const {chromium}=require('@playwright/test');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.addInitScript(()=>{
   window.testPad={index:0,buttons:Array.from({length:16},()=>({pressed:false})),axes:[0,0,0,0]};
   Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[window.testPad]});
  });
  await page.goto('http://127.0.0.1:4173');
  await page.locator('#epub-input').setInputFiles('test-results/sample.epub');
  await page.locator('.book-card').click();
  await page.waitForFunction(()=>!busy&&rendition?.currentLocation()?.start);
  await page.locator('#fullscreen').click();
  await page.waitForFunction(()=>!!document.fullscreenElement&&document.body.classList.contains('fullscreen'));
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'reader');
  await page.waitForFunction(()=>!!rendition.currentLocation()?.start?.cfi&&!busy&&!!preparedTurn);
  const first=await page.evaluate(()=>rendition.currentLocation().start.cfi);
  await page.evaluate(()=>testPad.buttons[0].pressed=true);await page.waitForTimeout(180);await page.evaluate(()=>testPad.buttons[0].pressed=false);
  assert.equal(await page.evaluate(()=>rendition.currentLocation().start.cfi),first,'JoyXoff mouse-click button must not also turn pages');
  assert.deepEqual(await page.evaluate(async()=>{const original=rendition.currentLocation,g={wheel:true,ended:false};rendition.currentLocation=()=>({});try{await turn(1,g);return{busy,ended:g.ended,cancelled:g.cancelled};}finally{rendition.currentLocation=original;}}),{busy:false,ended:true,cancelled:true});
  await page.evaluate(()=>testPad.buttons[15].pressed=true);await page.waitForTimeout(120);await page.evaluate(()=>testPad.buttons[15].pressed=false);
  await page.waitForFunction(cfi=>!busy&&rendition.currentLocation().start.cfi!==cfi,first);
  const second=await page.evaluate(()=>rendition.currentLocation().start.cfi);
  const expectedThird=await page.evaluate(async cfi=>{await rendition.next();const next=rendition.currentLocation().start.cfi;await rendition.display(cfi);return next;},second);

  await page.evaluate(()=>{testPad.buttons[15].pressed=true;document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));});
  await page.waitForFunction(()=>busy);await page.evaluate(()=>testPad.buttons[15].pressed=false);await page.waitForFunction(()=>!busy);await page.waitForTimeout(180);
  const third=await page.evaluate(()=>rendition.currentLocation().start.cfi);
  assert.equal(third,expectedThird,'JoyXoff keyboard emulation plus native gamepad input must turn exactly one page');
  assert.deepEqual(errors,[]);
  await page.evaluate(()=>testPad.buttons[1].pressed=true);
  await page.waitForFunction(()=>!document.fullscreenElement);
  console.log('Fullscreen focus, direct gamepad paging, duplicate suppression, and controller exit passed');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
