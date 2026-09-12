const {chromium}=require('@playwright/test');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:4173');
  await page.locator('#epub-input').setInputFiles('test-results/sample.epub');
  await page.locator('.book-card').click();
  await page.waitForFunction(()=>!busy&&rendition?.currentLocation()?.start);
  await page.evaluate(()=>{
   window.flickerFrames=[];
   window.gpuHandoffs=0;const originalAnimate=Element.prototype.animate;
   Element.prototype.animate=function(frames,options){if(this.classList?.contains('three-turn')&&frames?.[0]?.opacity===1&&frames?.at?.(-1)?.opacity===0)window.gpuHandoffs++;return originalAnimate.call(this,frames,options);};
   let active=true;
   window.stopFlickerWatch=()=>active=false;
   const sample=()=>{
    const paper=document.querySelector('#paper');
    const viewer=document.querySelector('#viewer');
    const animation=document.querySelector('#animation');
    const visibleOverlay=[...animation.children].some(el=>!el.classList.contains('cold-edge')&&getComputedStyle(el).visibility!=='hidden');
    if(!paper.classList.contains('turning')&&visibleOverlay)window.flickerFrames.push('overlay exposed before snapshot handoff');
    if(paper.classList.contains('turning')){
     const freeze=animation.querySelector('.freeze');
     const visiblePages=[...animation.querySelectorAll('.flip-page')].filter(el=>getComputedStyle(el).display!=='none');
     if(getComputedStyle(viewer).visibility==='hidden')window.flickerFrames.push('live viewer fallback hidden while turning');
     if(!animation.children.length)window.flickerFrames.push('empty animation layer');
     const parallel=animation.querySelector('.three-turn');
     const loadedParallel=parallel&&getComputedStyle(parallel).visibility==='visible'&&parallel.querySelector('canvas')&&!FolioGPU.stats().lost&&FolioGPU.stats().frames>0;
     if(!freeze&&!visiblePages.length&&!loadedParallel)window.flickerFrames.push('no rendered snapshot');
     if(parseInt(getComputedStyle(paper,'::before').zIndex)>=parseInt(getComputedStyle(animation).zIndex))window.flickerFrames.push('book spine drawn through turning page');
    }
    if(active)requestAnimationFrame(sample);
   };
   requestAnimationFrame(sample);
  });
  const rect=await page.locator('#paper').boundingBox();
  await page.mouse.move(rect.x+rect.width/2,rect.y+150);
  await page.mouse.wheel(100,0);await page.waitForTimeout(35);await page.mouse.wheel(80,0);
  await page.waitForFunction(()=>!busy);
  await page.waitForTimeout(150);
  await page.locator('#next').click();
  await page.waitForFunction(()=>busy);
  await page.waitForFunction(()=>!busy);
  await page.evaluate(()=>stopFlickerWatch());
  assert.deepEqual(await page.evaluate(()=>window.flickerFrames),[]);
  assert.equal(await page.evaluate(()=>window.gpuHandoffs),2);
  assert.deepEqual(errors,[]);
  console.log('No blank or live-content frame appeared during gesture and button turns');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
