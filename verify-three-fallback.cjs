const {chromium}=require('@playwright/test');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:get.call(this,type,...args);};});
 await page.goto('http://127.0.0.1:4173');await page.locator('#epub-input').setInputFiles('test-results/sample.epub');await page.locator('.book-card').click();await page.waitForFunction(()=>!busy&&rendition?.currentLocation()?.start);
 const start=await page.evaluate(()=>rendition.currentLocation().start.cfi);await page.keyboard.press('ArrowRight');await page.waitForFunction(cfi=>!busy&&rendition.currentLocation()?.start?.cfi!==cfi,start);
 assert.equal(await page.evaluate(()=>FolioGPU.available()),false);await page.keyboard.press('ArrowLeft');await page.waitForFunction(cfi=>!busy&&rendition.currentLocation()?.start?.cfi===cfi,start);assert.equal(await page.locator('#animation').evaluate(e=>e.childElementCount),0);
 console.log('Reading and keyboard navigation survive unavailable WebGL');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
