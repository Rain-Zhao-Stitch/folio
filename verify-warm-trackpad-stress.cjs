const {chromium}=require('@playwright/test');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto('http://127.0.0.1:4173');await page.locator('#epub-input').setInputFiles('test-results/sample.epub');await page.locator('.book-card').click();
  await page.waitForFunction(()=>!busy&&rendition?.currentLocation()?.start);
  const paper=await page.locator('#paper').boundingBox();await page.mouse.move(paper.x+paper.width/2,paper.y+100);
  const sequence=await page.evaluate(async()=>{const start=rendition.currentLocation().start.cfi,out=[start];while(!rendition.currentLocation().atEnd&&out.length<10){await rendition.next();out.push(rendition.currentLocation().start.cfi);}await rendition.display(start);return out;});
  await page.evaluate(()=>{const original=playPreparedTurn;window.preparedTurns=0;playPreparedTurn=async(...args)=>{window.preparedTurns++;return original(...args);};});
  const patterns=[[[4,11],[38,24],[72,55],[105,86]],[[9,4],[55,70],[70,4],[100,0]],[[13,18],[80,100],[130,2]],[[25,0],[40,150],[75,1],[95,0]]];
  const wheel=(deltaX,deltaY)=>page.evaluate(({deltaX,deltaY,x,y})=>document.elementFromPoint(x,y).dispatchEvent(new WheelEvent('wheel',{deltaX,deltaY,deltaMode:0,bubbles:true,cancelable:true})),{deltaX,deltaY,x:paper.x+paper.width/2,y:paper.y+100});
  async function settled(){await page.waitForFunction(()=>!busy,{timeout:15000});await page.waitForFunction(()=>wheelGesture===null&&wheelReleased,{timeout:3000});}
  for(let step=1;step<Math.min(sequence.length,8);step++){
   await page.waitForFunction(()=>preparedTurn?.direction===1,{timeout:15000});
   for(const [x,y] of patterns[step%patterns.length]){await wheel(x,y);await page.waitForTimeout(step%2?12:25);}for(let tail=0;tail<8;tail++){await wheel(Math.max(1,8-tail),0);await page.waitForTimeout(8);}await settled();
   assert.equal(await page.evaluate(()=>rendition.currentLocation().start.cfi),sequence[step],`cached forward stroke ${step}`);
  }
  assert.equal(await page.evaluate(()=>window.preparedTurns),Math.min(sequence.length,8)-1);
  assert.deepEqual(errors,[]);
  console.log('Seven varied cached trackpad strokes each advanced exactly one page');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
