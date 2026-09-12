const {chromium}=require('@playwright/test');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>Object.defineProperty(window,'indexedDB',{configurable:true,value:{open(){throw new DOMException('Storage denied','SecurityError');}}}));
  await page.goto('http://127.0.0.1:4173');
  await page.waitForFunction(()=>window.FolioTranslation&&document.querySelector('#import').disabled);
  const result=await page.evaluate(()=>window.FolioTranslation.lookup('beautiful'));
  assert.equal(result.word,'beautiful','Local dictionary must still work when IndexedDB is denied');
  await page.locator('#translation-toggle').click();
  await page.locator('#translation-auto').click();
  await page.waitForTimeout(50);
  assert.match(await page.locator('#toast').textContent(),/save translation settings/i);
  assert.deepEqual(errors,[],'Storage denial must not create unhandled runtime errors');
  console.log('Local translation remains usable when settings storage is denied');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
