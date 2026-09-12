const {chromium}=require('@playwright/test');
const assert=require('node:assert/strict');
function lineDot(angleDegrees,dx,dy){const angle=angleDegrees*Math.PI/180;return Math.abs(Math.cos(angle)*dx+Math.sin(angle)*dy)/Math.hypot(dx,dy);}

(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto('http://127.0.0.1:4173');
  await page.locator('#epub-input').setInputFiles('test-results/sample.epub');
  await page.locator('.book-card').click();
  await page.waitForFunction(()=>!busy&&preparedTurn?.direction===1,{timeout:15000});
  const start=await page.evaluate(()=>rendition.currentLocation().start.cfi);
  const paper=await page.locator('#paper').boundingBox(),x=paper.x+paper.width-8,y=paper.y+paper.height/2;
  await page.mouse.move(x,y);await page.mouse.down();
  await page.mouse.move(x-220,y+110,{steps:6});
  await page.waitForFunction(()=>document.querySelector('.three-curl-host')?.dataset.mode==='corner');
  await page.waitForTimeout(220);
  const first=await page.evaluate(()=>({progress:Number(document.querySelector('.three-curl-host').dataset.progress),angle:Number(document.querySelector('.three-curl-host').dataset.foldAngle)}));
  await page.mouse.move(x-220,y-150,{steps:6});
  await page.waitForTimeout(220);
  const second=await page.evaluate(()=>({progress:Number(document.querySelector('.three-curl-host').dataset.progress),angle:Number(document.querySelector('.three-curl-host').dataset.foldAngle)}));
  assert.ok(lineDot(first.angle,-220,110)<.05,`middle-edge crease was not perpendicular to its pull: ${first.angle}`);
  assert.ok(lineDot(second.angle,-220,-150)<.05,`moved middle-edge crease was not perpendicular to its pull: ${second.angle}`);
  assert.ok(Math.abs(first.angle-second.angle)>20,'Changing the middle-edge pull direction must rotate the crease');
  assert.ok(second.progress>first.progress,'A longer diagonal pull must increase the physical fold progress');
  await page.mouse.up();await page.waitForFunction(()=>!busy);
  assert.equal(await page.evaluate(()=>rendition.currentLocation().start.cfi),start);
  assert.deepEqual(errors,[]);
  console.log('Dragging from the page-edge middle follows the same perpendicular-bisector normal rule');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
