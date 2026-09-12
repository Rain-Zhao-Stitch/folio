const {chromium}=require('@playwright/test');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173');await page.locator('#epub-input').setInputFiles('test-results/sample.epub');await page.locator('.book-card').click();await page.waitForFunction(()=>preparedTurn?.gpu&&!busy);
 const start=await page.evaluate(()=>rendition.currentLocation().start.cfi);
 await page.evaluate(()=>{window.g={wheel:true,progress:.3,ended:false};window.pending=turn(1,g);});await page.waitForFunction(()=>!!document.querySelector('#animation canvas'));
 await page.evaluate(()=>{window.loss=document.querySelector('#animation canvas').getContext('webgl2').getExtension('WEBGL_lose_context');if(!loss)throw Error('Context loss test extension unavailable');loss.loseContext();});
 await page.waitForFunction(()=>FolioGPU.stats().lost);
 await page.evaluate(async()=>{g.cancelled=true;g.ended=true;await pending;});assert.equal(await page.evaluate(()=>busy),false);assert.equal(await page.evaluate(()=>rendition.currentLocation().start.cfi),start);assert.equal(await page.locator('#paper').evaluate(e=>e.classList.contains('turning')),false);
 await page.evaluate(()=>loss.restoreContext());await page.waitForFunction(()=>!FolioGPU.stats().lost);await page.evaluate(()=>queuePreparedTurn());await page.waitForFunction(()=>preparedTurn?.gpu);
 await page.keyboard.press('ArrowRight');await page.waitForFunction(cfi=>!busy&&rendition.currentLocation()?.start?.cfi!==cfi,start);assert.deepEqual(errors,[]);
 console.log('GPU loss during a held gesture cleans up; restored context turns pages again');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
