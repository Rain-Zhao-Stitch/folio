const {chromium}=require('@playwright/test');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto('http://127.0.0.1:4173');
  await page.locator('#epub-input').setInputFiles('test-results/sample.epub');
  await page.locator('.book-card').click();
  await page.waitForFunction(()=>!busy&&rendition?.currentLocation()?.start);
  const expected=await page.evaluate(async()=>{
   const start=rendition.currentLocation().start.cfi,locations=[start];
   await rendition.next();locations.push(rendition.currentLocation().start.cfi);
   await rendition.next();locations.push(rendition.currentLocation().start.cfi);
   await rendition.display(start);return locations;
  });
  await page.waitForFunction(()=>preparedTurn?.direction===1,{timeout:15000});
  const edgeStyle=await page.evaluate(()=>{
   const edge=document.createElement('div');edge.className='cold-edge right';$('animation').append(edge);
   const style=getComputedStyle(edge),result={backgroundColor:style.backgroundColor,backgroundImage:style.backgroundImage};
   edge.remove();return result;
  });
  assert.equal(edgeStyle.backgroundColor,'rgba(0, 0, 0, 0)');
  assert.equal(edgeStyle.backgroundImage,'none');
  const paper=await page.locator('#paper').boundingBox(),point={x:paper.x+paper.width/2,y:paper.y+100};
  await page.evaluate(()=>{
   const originalThree=playThreeTurn,originalCold=playColdTurn;
   const cue=document.createElement('div');cue.className='cold-edge right';$('animation').append(cue);
   const cueStyle=getComputedStyle(cue);
   window.continuousCurl={three:0,cold:0,coldEdge:{image:cueStyle.backgroundImage,color:cueStyle.backgroundColor}};cue.remove();
   playThreeTurn=async(...args)=>{window.continuousCurl.three++;return originalThree(...args);};
   playColdTurn=async(...args)=>{window.continuousCurl.cold++;return originalCold(...args);};
  });
  const dispatch=deltaX=>page.evaluate(({x,y,deltaX})=>document.elementFromPoint(x,y).dispatchEvent(new WheelEvent('wheel',{deltaX,deltaY:0,deltaMode:0,bubbles:true,cancelable:true})),{...point,deltaX});
  await dispatch(500);
  await page.waitForFunction(()=>busy&&wheelGesture?.ended,{timeout:5000});
  await dispatch(320);
  await page.waitForFunction(()=>window.continuousCurl.three>=2,{timeout:20000});
  await page.waitForFunction(()=>!busy&&wheelGesture===null&&wheelReleased,{timeout:20000});
  assert.equal(await page.evaluate(()=>rendition.currentLocation().start.cfi),expected[2]);
  assert.deepEqual(await page.evaluate(()=>window.continuousCurl),{three:2,cold:0,coldEdge:{image:'none',color:'rgba(0, 0, 0, 0)'}});
  const cueStyle=await page.evaluate(()=>{
   const cue=document.createElement('div');cue.className='cold-edge right';document.querySelector('#animation').append(cue);
   const style=getComputedStyle(cue),result={backgroundImage:style.backgroundImage,backgroundColor:style.backgroundColor};cue.remove();return result;
  });
  assert.equal(cueStyle.backgroundImage,'none');
  assert.equal(cueStyle.backgroundColor,'rgba(0, 0, 0, 0)');
  assert.deepEqual(errors,[]);
  console.log('A queued second trackpad swipe retained GPU curl animation without a dark edge or cold fallback');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
