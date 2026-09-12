const {chromium}=require('@playwright/test');
const {PNG}=require('pngjs');
const assert=require('node:assert/strict');

function mean(a,b){
  a=PNG.sync.read(a);b=PNG.sync.read(b);let total=0;
  for(let i=0;i<a.data.length;i+=4)for(let c=0;c<3;c++)total+=Math.abs(a.data[i+c]-b.data[i+c]);
  return total/(a.width*a.height*3);
}
function columnLuma(buffer,x){
  const png=PNG.sync.read(buffer);let total=0,count=0;
  for(let y=20;y<png.height-20;y++){
    const i=(y*png.width+x)*4;total+=(png.data[i]+png.data[i+1]+png.data[i+2])/3;count++;
  }
  return total/count;
}

(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:4173');
    await page.locator('#epub-input').setInputFiles('test-results/sample.epub');
    await page.locator('.book-card').click();
    await page.waitForFunction(()=>preparedTurn?.gpu&&!busy);
    await page.evaluate(()=>{window.appleGesture={wheel:true,progress:0,ended:false};window.appleTurn=turn(1,appleGesture);});
    await page.waitForFunction(()=>document.querySelector('.three-curl-host'));
    const shots=[];
    for(const progress of [0,.25,.5,.75]){
      await page.evaluate(value=>appleGesture.progress=value,progress);
      await page.waitForFunction(value=>Number(document.querySelector('.three-curl-host').dataset.progress)===value,progress);
      shots.push(await page.locator('#animation canvas').screenshot({path:`test-results/apple-curl-${progress*100}.png`}));
    }
    assert.ok(mean(shots[0],shots[1])>1,'The moving cylinder must visibly engage by quarter progress');
    assert.ok(mean(shots[1],shots[2])>1,'Curl geometry must continue changing with drag distance');
    assert.ok(mean(shots[2],shots[3])>1,'The page must continue toward the binding after midpoint');
    const center=PNG.sync.read(shots[1]).width>>1;
    const binding=Math.min(columnLuma(shots[1],center-1),columnLuma(shots[1],center),columnLuma(shots[1],center+1));
    const paper=(columnLuma(shots[1],center-5)+columnLuma(shots[1],center+5))/2;
    assert.ok(binding<paper-20,'The fixed binding must remain visible while the page turns');
    assert.equal(await page.evaluate(()=>parseInt(getComputedStyle(paper,'::before').zIndex)<parseInt(getComputedStyle(animation).zIndex)),true,'The spine must stay below the curled sheet');
    await page.evaluate(async()=>{appleGesture.cancelled=true;appleGesture.ended=true;await appleTurn;});
    assert.deepEqual(errors,[]);
    console.log('Moving-cylinder curl stages and spine layering passed');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
