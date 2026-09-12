const {chromium}=require('@playwright/test');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1000,height:820}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  // Reproduce an existing installation and ensure the v2 dictionary store is
  // added without destroying books, fonts or settings.
  await page.goto('http://127.0.0.1:4173/favicon.svg');
  await page.evaluate(()=>new Promise((resolve,reject)=>{const drop=indexedDB.deleteDatabase('folio-library');drop.onerror=()=>reject(drop.error);drop.onsuccess=()=>{const open=indexedDB.open('folio-library',1);open.onupgradeneeded=()=>{for(const name of ['books','fonts','settings'])open.result.createObjectStore(name,{keyPath:'id'});};open.onsuccess=()=>{const db=open.result,tx=db.transaction('settings','readwrite');tx.objectStore('settings').put({id:'migration-marker',kept:true});tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};open.onerror=()=>reject(open.error);};}));
  await page.goto('http://127.0.0.1:4173');
  await page.locator('#translation-toggle').click();
  assert.equal(await page.locator('#dictionary-import').isVisible(),true);
  assert.equal(await page.locator('#translation-target + .dictionary-import-row').count(),1,'Dictionary controls must sit directly below the language selector');
  const migration=await page.evaluate(()=>new Promise((resolve,reject)=>{const open=indexedDB.open('folio-library');open.onsuccess=()=>{const db=open.result,tx=db.transaction(['settings','dictionaries'],'readonly');const request=tx.objectStore('settings').get('migration-marker');tx.oncomplete=()=>resolve({version:db.version,kept:request.result?.kept,stores:[...db.objectStoreNames]});tx.onerror=()=>reject(tx.error);};open.onerror=()=>reject(open.error);}));
  assert.deepEqual(migration,{version:2,kept:true,stores:['books','dictionaries','fonts','settings']});

  const custom={beautiful:{zh:'自定义漂亮',en:'custom beautiful'},codexium:{zh:'测试词',en:'a test-only imported entry'}};
  await page.locator('#dictionary-input').setInputFiles({name:'personal.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(custom))});
  await page.waitForFunction(()=>document.querySelector('#dictionary-status').textContent.includes('2 imported entries'));
  assert.equal((await page.evaluate(()=>FolioTranslation.lookup('beautiful'))).data[0],'自定义漂亮');
  assert.equal((await page.evaluate(()=>FolioTranslation.lookup('codexium'))).data[3],'a test-only imported entry');
  await page.screenshot({path:'test-results/dictionary-import.png'});

  await page.reload();
  await page.locator('#translation-toggle').click();
  await page.waitForFunction(()=>document.querySelector('#dictionary-status').textContent.includes('personal.json'));
  assert.equal((await page.evaluate(()=>FolioTranslation.lookup('codexium'))).data[0],'测试词','Imported dictionary must survive reload');

  await page.locator('#dictionary-input').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{broken')});
  await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('Could not import'));
  assert.equal((await page.evaluate(()=>FolioTranslation.lookup('codexium'))).data[0],'测试词','A failed import must not replace the active dictionary');

  const tsv='word\tzh\ten\nfoliolex\t词典测试\tTSV dictionary entry\nsecondword\t第二条\tSecond entry\n';
  await page.locator('#dictionary-input').setInputFiles({name:'personal.tsv',mimeType:'text/tab-separated-values',buffer:Buffer.from(tsv)});
  await page.waitForFunction(()=>document.querySelector('#dictionary-status').textContent.includes('personal.tsv'));
  assert.equal((await page.evaluate(()=>FolioTranslation.lookup('foliolex'))).data[3],'TSV dictionary entry');

  const gb18030=Buffer.concat([Buffer.from('word\tzh\ten\ngbkword\t','ascii'),Buffer.from([0xb2,0xe2,0xca,0xd4]),Buffer.from('\tGB18030 entry\n','ascii')]);
  await page.locator('#dictionary-input').setInputFiles({name:'windows.txt',mimeType:'text/plain',buffer:gb18030});
  await page.waitForFunction(()=>document.querySelector('#dictionary-status').textContent.includes('windows.txt'));
  assert.equal((await page.evaluate(()=>FolioTranslation.lookup('gbkword'))).data[0],'测试','Windows GB18030 text must not import as mojibake');

  await page.locator('#dictionary-remove').click();
  await page.waitForFunction(()=>document.querySelector('#dictionary-status').textContent.includes('ECDICT'));
  assert.equal(await page.evaluate(()=>FolioTranslation.lookup('codexium')),null);
  assert.notEqual((await page.evaluate(()=>FolioTranslation.lookup('beautiful'))).data[0],'自定义漂亮');
  assert.deepEqual(errors,[]);
  console.log('Dictionary UI, v1 migration, UTF-8/GB18030 import, priority, persistence, invalid-file safety and removal passed');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
