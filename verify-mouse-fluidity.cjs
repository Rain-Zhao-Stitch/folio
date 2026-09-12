const {chromium}=require('@playwright/test');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:4173');
  await page.locator('#epub-input').setInputFiles('test-results/sample.epub');
  await page.locator('.book-card').click();
  await page.waitForFunction(()=>preparedTurn?.gpu&&!busy);
  const paper=await page.locator('#paper').boundingBox();
  await page.mouse.move(paper.x+paper.width-45,paper.y+paper.height-30);
  await page.mouse.down();
  await page.waitForFunction(()=>document.querySelector('.three-curl-host')?.dataset.mode==='corner');
  const initial=Number(await page.locator('.three-curl-host').getAttribute('data-progress'));
  assert.ok(initial<.005,`Picking up the wide page edge must not jump the curl (got ${initial})`);
  await page.mouse.move(paper.x+paper.width*.72,paper.y+paper.height*.72);
  const samples=await page.evaluate(async()=>{
   const values=[];
   for(let i=0;i<9;i++)await new Promise(resolve=>requestAnimationFrame(()=>{values.push(Number(document.querySelector('.three-curl-host').dataset.progress));resolve();}));
   return values;
  });
  const distinct=new Set(samples.map(value=>value.toFixed(3))).size;
  assert.ok(distinct>=4,`Abrupt pointer input must be spread over several rendered frames (${samples.join(', ')})`);
  assert.ok(samples.every((value,index)=>index===0||value+1e-6>=samples[index-1]),'Smoothed mouse progress must remain monotonic');
  assert.ok(samples.at(-1)>.18,`The rendered page must keep catching up while the pointer is stationary (${samples.join(', ')})`);
  const cornerBefore=Number(await page.locator('.three-curl-host').getAttribute('data-corner-y'));
  await page.mouse.move(paper.x+paper.width*.72,paper.y+paper.height*.58);
  const cornerSamples=await page.evaluate(async()=>{
   const values=[];
   for(let i=0;i<7;i++)await new Promise(resolve=>requestAnimationFrame(()=>{values.push(Number(document.querySelector('.three-curl-host').dataset.cornerY));resolve();}));
   return values;
  });
  assert.ok(new Set(cornerSamples.map(value=>value.toFixed(1))).size>=3,'Vertical pointer motion must smoothly reshape the held corner');
  assert.ok(cornerSamples.at(-1)<cornerBefore-paper.height*.1,'The held corner must follow substantial vertical pointer movement');
  await page.mouse.up();await page.waitForFunction(()=>!busy);
  assert.deepEqual(errors,[]);
  console.log('Mouse pickup has no jump and sparse pointer motion is smoothly interpolated');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
