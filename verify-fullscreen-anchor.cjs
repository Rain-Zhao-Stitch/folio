const {chromium}=require('@playwright/test');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1180,height:760}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto('http://127.0.0.1:4173');
  await page.locator('#epub-input').setInputFiles('test-results/sample.epub');
  await page.locator('.book-card').click();
  await page.waitForFunction(()=>!busy&&rendition?.currentLocation()?.start);
  await page.evaluate(async()=>{await rendition.next();await rendition.next();});
  await page.waitForFunction(()=>stableReadingCfi===rendition.currentLocation().start.cfi);
  const beforeEnter=await page.evaluate(()=>stableReadingCfi);
  await page.evaluate(()=>{
   const original=rendition.display.bind(rendition);window.fullscreenDisplayArgs=[];
   rendition.display=async target=>{window.fullscreenDisplayArgs.push(target);return original(target);};
  });
  await page.locator('#fullscreen').click();
  await page.waitForFunction(()=>document.body.classList.contains('fullscreen')&&!fullscreenRelayout,{timeout:15000});
  assert.equal(await page.evaluate(()=>window.fullscreenDisplayArgs.at(-1)),beforeEnter);
  const indicator=await page.locator('#position').evaluate(node=>({text:node.textContent,display:getComputedStyle(node).display,rect:node.getBoundingClientRect().toJSON()}));
  assert.match(indicator.text,/Chapter\s+\d+\s*\/\s*\d+/);
  assert.notEqual(indicator.display,'none');
  assert.ok(indicator.rect.width>0&&indicator.rect.height>0);
  const beforeExit=await page.evaluate(()=>stableReadingCfi);
  await page.evaluate(()=>{window.fullscreenDisplayArgs=[];toggleFullscreen();});
  await page.waitForFunction(()=>!document.body.classList.contains('fullscreen')&&!fullscreenRelayout,{timeout:15000});
  assert.equal(await page.evaluate(()=>window.fullscreenDisplayArgs.at(-1)),beforeExit);
  assert.deepEqual(errors,[]);
  console.log('Fullscreen shows the page indicator and reflows from the saved first-line CFI in both directions');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
