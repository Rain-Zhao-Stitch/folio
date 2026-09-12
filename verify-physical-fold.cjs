const {chromium}=require('@playwright/test');
const assert=require('node:assert/strict');

function lineDot(angleDegrees,dx,dy){
 const angle=angleDegrees*Math.PI/180;
 return Math.abs(Math.cos(angle)*dx+Math.sin(angle)*dy)/Math.hypot(dx,dy);
}

(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto('http://127.0.0.1:4173');
  await page.locator('#epub-input').setInputFiles('test-results/sample.epub');
  await page.locator('.book-card').click();
  await page.waitForFunction(()=>preparedTurn?.gpu&&!busy);
  const paper=await page.locator('#paper').boundingBox(),start={x:paper.x+paper.width-4,y:paper.y+4};
  await page.mouse.move(start.x,start.y);await page.mouse.down();
  await page.mouse.move(start.x-180,start.y+180,{steps:10});
  await page.waitForFunction(()=>Number(document.querySelector('.three-curl-host')?.dataset.progress)>.1);
  const diagonal=await page.locator('.three-curl-host').evaluate(host=>({fold:Number(host.dataset.foldAngle),tilt:Number(host.dataset.flapTilt),progress:Number(host.dataset.progress)}));
  assert.ok(Math.abs(diagonal.fold-45)<4,`Equal diagonal pull must create a 45-degree crease (got ${diagonal.fold})`);
  assert.ok(diagonal.tilt>120&&diagonal.tilt<175,`The folded flap must remain inclined, not parallel (got ${diagonal.tilt})`);
  await page.locator('#animation canvas').screenshot({path:'test-results/physical-45-degree-fold.png'});

  const dx=-260,dy=60;
  await page.mouse.move(start.x+dx,start.y+dy,{steps:8});
  await page.waitForTimeout(100);
  const changed=Number(await page.locator('.three-curl-host').getAttribute('data-fold-angle'));
  assert.ok(Math.abs(changed-diagonal.fold)>15,'Changing pull direction must rotate the crease');
  assert.ok(lineDot(changed,dx,dy)<.04,`Crease must be perpendicular to pull direction (normalized dot ${lineDot(changed,dx,dy)})`);
  await page.mouse.up();await page.waitForFunction(()=>!busy);

  await page.waitForFunction(()=>preparedTurn?.gpu&&!busy);
  await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x,start.y+260,{steps:8});
  await page.waitForFunction(()=>Number(document.querySelector('.three-curl-host')?.dataset.progress)>.08);
  const vertical=Number(await page.locator('.three-curl-host').getAttribute('data-fold-angle'));
  assert.ok(vertical<3||vertical>177,`A vertical pull must create a horizontal crease (got ${vertical})`);
  await page.mouse.up();await page.waitForFunction(()=>!busy);
  assert.deepEqual(errors,[]);
  console.log('45-degree crease, direction-perpendicular folding, vertical pull and inclined flap passed');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
