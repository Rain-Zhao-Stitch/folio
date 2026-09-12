const {chromium}=require('@playwright/test');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173');await page.locator('#epub-input').setInputFiles('test-results/sample.epub');await page.locator('.book-card').click();await page.waitForFunction(()=>preparedTurn?.gpu&&!busy);
 const start=await page.evaluate(()=>rendition.currentLocation().start.cfi),rect=await page.locator('#paper').boundingBox();await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);
 await page.mouse.wheel(100,0);await page.waitForFunction(()=>!!wheelGesture&&!!document.querySelector('#animation canvas'));
 const geometry=await page.evaluate(()=>({y:wheelGesture.y,h:wheelGesture.height,p:wheelGesture.progress,rendered:Number(document.querySelector('.three-curl-host').dataset.progress)}));
 assert.equal(geometry.y,geometry.h/2);assert.equal(geometry.p,.3125);assert.ok(Math.abs(geometry.rendered-geometry.p)<.001);
 await page.waitForFunction(()=>!busy);assert.equal(await page.evaluate(()=>rendition.currentLocation().start.cfi),start);
 await page.waitForFunction(()=>preparedTurn?.gpu);await page.mouse.wheel(240,0);await page.waitForFunction(cfi=>!busy&&rendition.currentLocation().start.cfi!==cfi,start);
 await page.waitForFunction(()=>preparedTurn?.gpu&&preparedOppositeTurn?.gpu);const forward=await page.evaluate(()=>rendition.currentLocation().start.cfi);await page.mouse.wheel(-100,0);await page.waitForFunction(()=>!!document.querySelector('#animation canvas'));await page.waitForFunction(()=>!busy);assert.equal(await page.evaluate(()=>rendition.currentLocation().start.cfi),forward);
 await page.evaluate(async()=>{while(!rendition.currentLocation().atEnd)await rendition.next();});await page.mouse.wheel(240,0);await page.waitForTimeout(350);
 assert.equal(await page.evaluate(()=>busy),false);assert.equal(await page.locator('#animation').evaluate(n=>n.childElementCount),0);assert.equal(await page.evaluate(()=>wheelGesture),null);assert.deepEqual(errors,[]);
 console.log('GPU trackpad progress, reverse cancel and end-boundary cleanup passed');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
