const {chromium}=require('@playwright/test');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto('http://127.0.0.1:4173');
  const result=await page.evaluate(()=>{
   buildToc([null,{href:'OPS/untitled.xhtml'},{label:'  Heading only  ',subitems:[undefined,{label:'',href:'OPS/nested.xhtml#part'}]}]);
   return [...document.querySelectorAll('#toc-items button')].map(button=>({text:button.textContent,disabled:button.disabled,aria:button.getAttribute('aria-disabled')}));
  });
  assert.deepEqual(result,[
   {text:'untitled.xhtml',disabled:false,aria:null},
   {text:'Heading only',disabled:true,aria:'true'},
   {text:'nested.xhtml',disabled:false,aria:null}
  ]);
  await page.evaluate(()=>buildToc([null,undefined]));
  assert.equal(await page.locator('#toc-items').textContent(),'This book does not include a table of contents.');
  assert.deepEqual(errors,[]);
  console.log('Missing, empty and non-link TOC entries are handled without crashing');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
