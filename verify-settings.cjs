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
  await page.locator('#settings-toggle').click();
  await page.locator('#font-select').selectOption('comic');
  await page.waitForFunction(()=>!busy);
  for(const [id,value] of [['line-height','2.2'],['letter-spacing','1.5'],['word-spacing','6'],['page-margin','40'],['paragraph-spacing','1.6']]){
   await page.locator('#'+id).fill(value);
   await page.locator('#'+id).dispatchEvent('change');
   await page.waitForFunction(()=>!busy&&!typographyPending);
  }
  const metrics=await page.evaluate(()=>{
   const document=rendition.getContents()[0].document,style=document.defaultView.getComputedStyle(document.querySelector('p'));
   return {font:style.fontFamily,line:style.lineHeight,letter:style.letterSpacing,word:style.wordSpacing,paragraph:style.marginBottom,padding:document.defaultView.getComputedStyle(document.body).paddingLeft,gap:rendition.manager.layout.gap};
  });
  assert.match(metrics.font,/Comic Sans MS/);assert.equal(metrics.line,'44px');assert.equal(metrics.letter,'1.5px');assert.equal(metrics.word,'6px');assert.equal(metrics.paragraph,'32px');assert.equal(metrics.padding,'40px');assert.equal(metrics.gap,80);
  console.log('COMPUTED TYPOGRAPHY OK',metrics);
  await page.screenshot({path:'test-results/settings.png'});
  await page.locator('#settings-toggle').click();
  await page.locator('#next').click();await page.waitForFunction(()=>!busy);
  await page.locator('#theme').click();
  await page.locator('#fullscreen').click();
  await page.waitForFunction(()=>!!document.fullscreenElement&&!fullscreenRelayout);
  await page.waitForFunction(()=>getComputedStyle(document.body).backgroundColor==='rgb(0, 0, 0)');
  const dark=await page.evaluate(()=>{const document=rendition.getContents()[0].document;return [getComputedStyle(window.document.body).backgroundColor,document.defaultView.getComputedStyle(document.body).backgroundColor,document.defaultView.getComputedStyle(document.querySelector('p')).color];});
  assert.deepEqual(dark,['rgb(0, 0, 0)','rgb(0, 0, 0)','rgb(255, 255, 255)']);
  await page.screenshot({path:'test-results/fullscreen-black.png'});
  assert.equal(await page.locator('header').isVisible(),false);
  assert.equal(await page.locator('.reader-toolbar').isVisible(),false);
  assert.equal(await page.locator('.reader-bottom').isVisible(),true);
  assert.equal(await page.locator('#position').isVisible(),true);
  assert.equal(await page.locator('#next').isVisible(),false);
  const fullscreenBox=await page.locator('#paper').boundingBox();
  assert.equal(fullscreenBox.x,0);assert.equal(fullscreenBox.y,0);
  assert.equal(fullscreenBox.width,await page.evaluate(()=>innerWidth));
  assert.equal(fullscreenBox.height,await page.evaluate(()=>innerHeight));
  await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>!busy);
  assert.equal(await page.evaluate(()=>prefs.lineHeight),2.2);
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!document.fullscreenElement&&!document.body.classList.contains('fullscreen')&&!fullscreenRelayout);
  await page.locator('header').waitFor({state:'visible'});
  assert.equal(await page.locator('header').isVisible(),true);
  console.log('FULLSCREEN OK');
  await page.reload();await page.locator('.book-card').click();
  await page.waitForFunction(()=>!busy&&rendition?.currentLocation()?.start);
  assert.equal(await page.evaluate(()=>prefs.font),'comic');assert.equal(await page.evaluate(()=>prefs.pageMargin),40);assert.equal(await page.evaluate(()=>prefs.lineHeight),2.2);assert.equal(await page.evaluate(()=>prefs.letterSpacing),1.5);assert.equal(await page.evaluate(()=>prefs.wordSpacing),6);assert.equal(await page.evaluate(()=>prefs.paragraphSpacing),1.6);
  console.log('PERSISTENCE OK');
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500);
  await page.locator('#settings-toggle').click();await page.locator('#paragraph-spacing').scrollIntoViewIfNeeded();
  assert.equal(await page.locator('#paragraph-spacing').isVisible(),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);
  assert.deepEqual(errors,[]);
  console.log('MOBILE SETTINGS OK');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
