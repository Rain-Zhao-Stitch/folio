const {chromium}=require('@playwright/test');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  for(let cycle=0;cycle<6;cycle++){
   await page.goto('http://127.0.0.1:4173');
   if(!await page.locator('.book-card').count()){
    await page.locator('#epub-input').setInputFiles('test-results/sample.epub');
    await page.locator('.book-card').waitFor();
   }
   await page.locator('.book-card').click();
   await page.waitForFunction(()=>!busy&&rendition?.currentLocation()?.start);
   await page.locator('#toc-toggle').click();
   await page.locator('#toc-items button').nth(1).click();
   await page.waitForFunction(()=>!busy&&/夜色/.test(document.querySelector('#chapter')?.textContent||''));
   assert.match(await page.locator('#chapter').textContent(),/夜色/);
  }
  assert.deepEqual(errors,[]);
  console.log('Six reload/open/TOC cycles reached the second chapter without stale chapter labels');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
