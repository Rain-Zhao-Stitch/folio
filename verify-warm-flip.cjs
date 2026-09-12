const {chromium}=require('@playwright/test');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 let mobileContext;
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto('http://127.0.0.1:4173');
  await page.locator('#epub-input').setInputFiles('test-results/sample.epub');
  await page.locator('.book-card').click();
  await page.waitForFunction(()=>!busy&&rendition?.currentLocation()?.start);
  await page.evaluate(()=>{const add=window.addEventListener.bind(window),remove=window.removeEventListener.bind(window);window.warmResizeListeners=new Set();window.addEventListener=(type,listener,...args)=>{if(type==='resize')window.warmResizeListeners.add(listener);return add(type,listener,...args);};window.removeEventListener=(type,listener,...args)=>{if(type==='resize')window.warmResizeListeners.delete(listener);return remove(type,listener,...args);};});
  await page.waitForFunction(()=>preparedTurn?.direction===1,{timeout:15000});
  assert.ok(await page.evaluate(()=>preparedTurn.gpu&&FolioGPU.stats().textures>=2));
  const cachedUrls=await page.evaluate(()=>preparedTurn.objectUrls);
  assert.equal(await page.evaluate(()=>window.warmResizeListeners.size),0);
  const start=await page.evaluate(()=>rendition.currentLocation().start.cfi);
  await page.evaluate(()=>{const original=FolioGPU.create;window.warmMounts=0;FolioGPU.create=async(...args)=>{window.warmMounts++;return original(...args);};});
  const paper=await page.locator('#paper').boundingBox();
  await page.mouse.move(paper.x+paper.width/2,paper.y+150);

  // A cached short swipe still cancels, without rebuilding the pages in the input path.
  await page.mouse.wheel(100,0);await page.waitForFunction(()=>!busy,{timeout:15000});
  assert.equal(await page.evaluate(()=>rendition.currentLocation().start.cfi),start);
  assert.equal(await page.evaluate(()=>window.warmMounts),0);
  assert.equal(await page.evaluate(()=>FolioGPU.stats().surfaces>0),false);
  assert.equal(await page.evaluate(async urls=>(await Promise.all(urls.map(url=>fetch(url).then(()=>false,()=>true)))).every(Boolean),cachedUrls),true);

  await page.locator('#theme').click();await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark'&&preparedTurn?.direction===1,{timeout:15000});
  const darkSvg=await page.evaluate(async()=>await (await fetch(preparedTurn.currentSnapshot.frames[0].imageUrl)).text());
  assert.match(darkSvg,/background:\s*rgb\(0,\s*0,\s*0\)/i);
  await page.waitForFunction(()=>preparedTurn?.direction===1,{timeout:15000});
  await page.evaluate(()=>window.warmMounts=0);
  await page.mouse.move(paper.x+paper.width/2,paper.y+150);
  await page.mouse.wheel(240,0);await page.waitForFunction(()=>!busy,{timeout:15000});
  assert.notEqual(await page.evaluate(()=>rendition.currentLocation().start.cfi),start);
  assert.equal(await page.evaluate(()=>window.warmMounts),1);
  await page.waitForFunction(()=>preparedTurn?.direction===1,{timeout:15000});
  const buttonStart=await page.evaluate(()=>rendition.currentLocation().start.cfi);await page.evaluate(()=>window.warmMounts=0);
  await page.locator('#next').click();await page.waitForFunction(()=>!busy,{timeout:15000});
  assert.notEqual(await page.evaluate(()=>rendition.currentLocation().start.cfi),buttonStart);assert.equal(await page.evaluate(()=>window.warmMounts),0);
  const fallbackStart=await page.evaluate(()=>rendition.currentLocation().start.cfi);
  await page.evaluate(async()=>{invalidatePreparedTurn();const original=book.renderTo;book.renderTo=()=>{throw new Error('Injected preview failure');};queuePreparedTurn();await new Promise(resolve=>setTimeout(resolve,500));book.renderTo=original;});
  assert.equal(await page.evaluate(()=>!!preparedTurn||!!preparingHolder),false);
  await page.evaluate(()=>turn(1));await page.waitForFunction(()=>!busy,{timeout:15000});
  assert.notEqual(await page.evaluate(()=>rendition.currentLocation().start.cfi),fallbackStart);
  await page.locator('#back').click();await page.waitForFunction(()=>$('reader').hidden);
  assert.equal(await page.evaluate(()=>FolioGPU.stats().surfaces),0);
  assert.equal(await page.evaluate(()=>!!preparedTurn||!!preparingHolder),false);
  mobileContext=await browser.newContext({viewport:{width:390,height:844}});
  const mobile=await mobileContext.newPage(),mobileErrors=[];mobile.on('pageerror',error=>mobileErrors.push(error.message));
  await mobile.goto('http://127.0.0.1:4173');await mobile.locator('#epub-input').setInputFiles('test-results/sample.epub');await mobile.locator('.book-card').click();
  await mobile.waitForFunction(()=>!busy&&rendition?.currentLocation()?.start);await mobile.waitForFunction(()=>preparedTurn?.direction===1,{timeout:15000});
  assert.equal(await mobile.evaluate(()=>preparedTurn.state.double),false);
  const mobileStart=await mobile.evaluate(()=>rendition.currentLocation().start.cfi),mobilePaper=await mobile.locator('#paper').boundingBox();
  await mobile.mouse.move(mobilePaper.x+mobilePaper.width/2,mobilePaper.y+150);await mobile.mouse.wheel(240,0);await mobile.waitForFunction(()=>!busy,{timeout:15000});
  assert.notEqual(await mobile.evaluate(()=>rendition.currentLocation().start.cfi),mobileStart);assert.deepEqual(mobileErrors,[]);
  assert.deepEqual(errors,[]);
  console.log('Prepared flip cache preserves cancel/commit behavior without gesture-time snapshot mounting');
 }finally{await mobileContext?.close();await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
