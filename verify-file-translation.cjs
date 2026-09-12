const {chromium}=require('@playwright/test');
const path=require('node:path');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{for(const url of ['http://127.0.0.1:4173/',new URL('file:///'+path.resolve('dist/index.html').replaceAll('\\','/')).href]){
  const page=await browser.newPage();const failures=[];page.on('requestfailed',request=>failures.push({url:request.url(),error:request.failure()?.errorText}));await page.goto(url);await page.waitForFunction(()=>window.FolioTranslation);const result=await page.evaluate(async()=>({status:$('dictionary-status').textContent,lookups:await Promise.all(['beautiful','world','book','translation','zebra'].map(word=>window.FolioTranslation.lookup(word)))}));assert.deepEqual(result.lookups.map(item=>item?.word),['beautiful','world','book','translation','zebra'],`${url}: local lookup failed`);assert.match(result.status,/768,739 entries/);assert.deepEqual(failures,[]);await page.close();
 }console.log('Local dictionary lookup works over HTTP and direct file opening');}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
