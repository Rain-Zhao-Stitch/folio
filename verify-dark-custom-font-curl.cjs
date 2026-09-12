const {chromium}=require('@playwright/test');
const {PNG}=require('pngjs');
const fs=require('node:fs');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:4173');
  await page.locator('#epub-input').setInputFiles('test-results/sample.epub');
  await page.locator('.book-card').click();
  await page.waitForFunction(()=>preparedTurn?.gpu&&!busy);
  await page.locator('#theme').click();
  await page.locator('#settings-toggle').click();
  await page.locator('#font-select').selectOption('comic');
  await page.waitForFunction(()=>!busy&&preparedTurn?.gpu);
  await page.locator('#settings-toggle').click();
  const paper=await page.locator('#paper').boundingBox();
  await page.mouse.move(paper.x+paper.width-4,paper.y+paper.height-10);
  await page.mouse.down();
  await page.mouse.move(paper.x+paper.width*.65,paper.y+paper.height*.78,{steps:10});
  await page.waitForFunction(()=>document.querySelector('.three-curl-host')?.dataset.mode==='corner');
  const image=await page.locator('#animation canvas').screenshot({path:'test-results/dark-custom-font-curl.png'});
  const png=PNG.sync.read(image);
  for(let i=3;i<png.data.length;i+=4)assert.equal(png.data[i],255,'The dark curl canvas must be fully opaque');
  assert.equal(await page.evaluate(()=>document.querySelector('.three-curl-host').dataset.opaque),'true');
  await page.mouse.up();await page.waitForFunction(()=>!busy);
  assert.deepEqual(errors,[]);
  assert.ok(fs.statSync('test-results/dark-custom-font-curl.png').size>10000);
  console.log('Dark-mode custom-font corner curl remains opaque and completes cleanly');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
