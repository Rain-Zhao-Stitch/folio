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
  const before=await page.evaluate(()=>rendition.currentLocation().start.cfi);
  const paper=await page.locator('#paper').boundingBox();
  await page.mouse.move(paper.x+paper.width-4,paper.y+paper.height-10);
  await page.mouse.down();
  await page.mouse.move(paper.x+paper.width*.8,paper.y+paper.height*.8,{steps:5});
  await page.waitForFunction(()=>busy&&document.querySelector('.three-curl-host'));
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  await page.waitForFunction(()=>!busy,null,{timeout:2000});
  assert.equal(await page.evaluate(()=>rendition.currentLocation().start.cfi),before,'Interrupted drag must cancel instead of turning');
  assert.equal(await page.locator('#animation').count(),1);
  assert.equal(await page.locator('#animation').evaluate(node=>node.childElementCount),0);
  await page.waitForFunction(()=>preparedTurn?.gpu&&!busy);
  const beforeWheel=await page.evaluate(()=>rendition.currentLocation().start.cfi);
  await page.mouse.move(paper.x+paper.width/2,paper.y+paper.height/2);
  await page.mouse.wheel(80,0);
  await page.waitForFunction(()=>busy&&wheelGesture&&!wheelGesture.ended);
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  assert.equal(await page.evaluate(()=>wheelGesture?.ended),true,'Blur must end the trackpad gesture immediately');
  await page.waitForFunction(()=>!busy,null,{timeout:2000});
  assert.equal(await page.evaluate(()=>rendition.currentLocation().start.cfi),beforeWheel,'Interrupted trackpad swipe must cancel instead of turning');
  assert.equal(await page.locator('#animation').evaluate(node=>node.childElementCount),0);
  assert.deepEqual(errors,[]);
  console.log('Window blur safely cancels active mouse and trackpad page gestures');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
