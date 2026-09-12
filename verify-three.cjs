const {chromium}=require('@playwright/test');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{for(const [width,dpr] of [[1280,1],[600,1],[1280,2],[390,2]]){
 const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:dpr}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://127.0.0.1:4173');await page.locator('#epub-input').setInputFiles('test-results/sample.epub');await page.locator('.book-card').click();await page.waitForFunction(()=>!busy&&preparedTurn?.gpu);
 const start=await page.evaluate(()=>rendition.currentLocation().start.cfi);
 await page.evaluate(()=>{window.gpuGesture={wheel:true,progress:.35,ended:false};window.gpuTurn=turn(1,gpuGesture);});
 await page.waitForFunction(()=>document.querySelector('#animation canvas'));
 await page.screenshot({path:`test-results/three-${width}-35.png`});
 await page.evaluate(()=>gpuGesture.progress=.65);await page.waitForTimeout(70);await page.screenshot({path:`test-results/three-${width}-65.png`});
 const stats=await page.evaluate(()=>FolioGPU.stats());assert.equal(stats.contexts,1);assert.ok(stats.frames>0);assert.ok(stats.renderer.render.triangles>100);
 await page.evaluate(async()=>{gpuGesture.cancelled=true;gpuGesture.ended=true;await gpuTurn;});assert.equal(await page.evaluate(()=>rendition.currentLocation().start.cfi),start);
 await page.waitForFunction(()=>preparedTurn?.gpu);await page.keyboard.press('ArrowRight');await page.waitForFunction(cfi=>!busy&&rendition.currentLocation()?.start?.cfi!==cfi,start);
 await page.keyboard.press('ArrowLeft');await page.waitForFunction(cfi=>!busy&&rendition.currentLocation()?.start?.cfi===cfi,start);
 await page.evaluate(()=>invalidatePreparedTurn());await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>FolioGPU.stats().surfaces),0);assert.equal(await page.evaluate(()=>FolioGPU.stats().textures),0);assert.equal(await page.evaluate(()=>FolioGPU.stats().renderer.memory.textures),0);assert.equal(await page.evaluate(()=>FolioGPU.stats().renderer.memory.geometries),0);
 assert.deepEqual(errors,[]);console.log(`Three.js ${width}px DPR ${dpr}: curl, cancel, keys, cold turn and GPU disposal passed`,stats.lastDrawMs);await page.close();
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
