const {chromium}=require('@playwright/test');
const {PNG}=require('pngjs');
const assert=require('node:assert/strict');

function difference(a,b){
 a=PNG.sync.read(a);b=PNG.sync.read(b);
 assert.equal(a.width,b.width);assert.equal(a.height,b.height);
 let total=0;
 for(let i=0;i<a.data.length;i+=4)for(let c=0;c<3;c++)total+=Math.abs(a.data[i+c]-b.data[i+c]);
 return total/(a.width*a.height*3);
}

(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:4173');
  await page.locator('#epub-input').setInputFiles('test-results/sample.epub');
  await page.locator('.book-card').click();
  await page.waitForFunction(()=>preparedTurn?.gpu&&!busy);
  const render=async(progress,mode,cornerY)=>{
   const data=await page.evaluate(({progress,mode,cornerY})=>{
    const prepared=preparedTurn;
    prepared.gpu.draw(progress,{mode,cornerY},true);
    return prepared.gpu.host.querySelector('canvas').toDataURL('image/png');
   },{progress,mode,cornerY});
   return Buffer.from(data.slice(data.indexOf(',')+1),'base64');
  };
  const spineStart=await render(0,'spine',0),cornerStart=await render(0,'corner',0);
  const spineEnd=await render(1,'spine',0),cornerTopEnd=await render(1,'corner',0),cornerBottomEnd=await render(1,'corner',900);
  const spineMiddle=await render(.5,'spine',0),cornerMiddle=await render(.5,'corner',0);
  assert.ok(difference(spineStart,cornerStart)<.05,'Corner curl must share the exact resting geometry');
  assert.ok(difference(spineEnd,cornerTopEnd)<.05,'Top-corner curl must fully reach the turned endpoint');
  assert.ok(difference(spineEnd,cornerBottomEnd)<.05,'Bottom-corner curl must fully reach the turned endpoint');
  assert.ok(difference(spineMiddle,cornerMiddle)>1,'Corner curl must remain visibly distinct during the gesture');
  assert.deepEqual(errors,[]);
  console.log('Mouse corner curl has exact resting/turned endpoints and a distinct midpoint');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
