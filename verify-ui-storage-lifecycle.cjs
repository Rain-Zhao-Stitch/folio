const {chromium}=require('@playwright/test');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const context=await browser.newContext(),page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto('http://127.0.0.1:4173');
  await page.locator('#epub-input').setInputFiles('test-results/sample.epub');
  await page.locator('.book-card').click();await page.waitForFunction(()=>!busy&&rendition?.currentLocation()?.start);
  await page.locator('#translation-toggle').click();
  await page.locator('#settings-toggle').click();
  assert.deepEqual(await page.evaluate(()=>({translation:$('translation-settings').hidden,settings:$('settings').hidden,toc:$('toc').hidden})),{translation:true,settings:false,toc:true});
  await page.locator('#translation-toggle').click();
  await page.locator('#toc-toggle').click();
  assert.deepEqual(await page.evaluate(()=>({translation:$('translation-settings').hidden,settings:$('settings').hidden,toc:$('toc').hidden})),{translation:true,settings:true,toc:false});
  await page.locator('#translation-toggle').click();await page.locator('#home').click();
  await page.waitForFunction(()=>!document.body.classList.contains('reading'));
  assert.equal(await page.locator('#translation-settings').isHidden(),true,'Returning to the library must close translation settings');

  // Every current connection must release itself on versionchange so another
  // tab or a future Folio release can upgrade without hanging indefinitely.
  const peer=await context.newPage();await peer.goto('http://127.0.0.1:4173');
  const upgraded=await page.evaluate(()=>Promise.race([
   new Promise((resolve,reject)=>{const request=indexedDB.open('folio-library',3);request.onupgradeneeded=()=>{};request.onsuccess=()=>{const version=request.result.version;request.result.close();resolve(version);};request.onerror=()=>reject(request.error);request.onblocked=()=>reject(new Error('upgrade blocked'));}),
   new Promise((_,reject)=>setTimeout(()=>reject(new Error('upgrade timed out')),2000))
  ]));
  assert.equal(upgraded,3);
  await peer.close();assert.deepEqual(errors,[]);
  console.log('Settings panels are exclusive and IndexedDB connections release future upgrades');
 }finally{await context.close();await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
