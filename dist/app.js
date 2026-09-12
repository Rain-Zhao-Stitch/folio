'use strict';
const $ = id => document.getElementById(id);
let db, books = [], fonts = [], active, book, rendition, busy = false, importing = false, progressTimer, toastTimer;
let preparedTurn, preparedOppositeTurn, preparingHolder, prepareTimer, prepareIdle, prepareGeneration = 0, lastTurnDirection;
let stableReadingCfi,fullscreenAnchorCfi,fullscreenRelayout=false;
const urls = new Map();
let prefs = { theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light', font: 'original', size: 20, lineHeight: null, letterSpacing: null, wordSpacing: null, pageMargin: null, paragraphSpacing: null };
function message(text) { $('toast').textContent = text; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 6000); }
function database() { return new Promise((resolve,reject) => { const req = indexedDB.open('folio-library',2);let settled=false;const fail=error=>{if(settled)return;settled=true;reject(error);};req.onupgradeneeded = () => { for (const name of ['books','fonts','settings','dictionaries']) if(!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name,{keyPath:'id'}); }; req.onsuccess = () => {const connection=req.result;connection.onversionchange=()=>connection.close();if(settled){connection.close();return;}settled=true;resolve(connection);}; req.onerror = () => fail(req.error);req.onblocked=()=>fail(new Error('Another Folio tab is blocking the local database upgrade. Close it and refresh.')); }); }
function storage(name, method, value) { return new Promise((resolve,reject) => { const tx = db.transaction(name,method === 'getAll' || method === 'get' ? 'readonly' : 'readwrite'); const request = tx.objectStore(name)[method](value); tx.oncomplete = () => resolve(request.result); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); }); }
function persistPrefs() { storage('settings','put',{id:'preferences',...prefs}).catch(() => message('Could not save settings. Check your browser storage.')); }
function applyTheme(theme) { prefs.theme = theme; invalidatePreparedTurn(); document.documentElement.dataset.theme = theme; $('theme').textContent = theme === 'dark' ? '☀' : '☾'; $('theme').setAttribute('aria-label',theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'); $('theme').setAttribute('title',theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'); $('light-option').classList.toggle('active',theme === 'light'); $('dark-option').classList.toggle('active',theme === 'dark'); const updates=rendition?.getContents().map(styleContents)||[]; if(updates.length)Promise.all(updates).finally(queuePreparedTurn); if(db) persistPrefs(); }
function fontFamily() { return prefs.font === 'comic' ? '"Comic Sans MS", "Comic Sans", cursive' : prefs.font === 'serif' ? '"Songti SC", "SimSun", serif' : prefs.font === 'sans' ? '"PingFang SC", "Microsoft YaHei", sans-serif' : prefs.font.startsWith('font-') ? `"${prefs.font}"` : ''; }
async function styleContents(contents) {
 const doc = contents.document; let style = doc.getElementById('folio-style'); if(!style) { style = doc.createElement('style'); style.id = 'folio-style'; doc.head.append(style); }
 const family = fontFamily(); const font = fonts.find(f => f.id === prefs.font); const dark = prefs.theme === 'dark';
 style.textContent = `${font ? `@font-face{font-family:"${font.id}";src:url("${urls.get(font.id)}")}` : ''} html,body{background:${dark?'#000000':'#ffffff'}!important;color:${dark?'#ffffff':'#26332e'}!important} body{font-size:${prefs.size}px!important;${family?`font-family:${family}!important;`:''}} ${family?`body p,body span,body div,body li,body h1,body h2,body h3,body td{font-family:${family}!important}`:''} ${dark?'body p,body span,body div,body li,body h1,body h2,body h3,body td{color:inherit!important;background-color:transparent!important}a{color:#ffffff!important}':''} img,svg,video{max-width:100%} ::selection{background:#d9d9d9;color:#000000}`;
 style.textContent += spacingCSS();
 if(font) await doc.fonts.load(`${prefs.size}px "${font.id}"`).catch(()=>{});
}
// One physical trackpad stroke owns exactly one page. Quiet input is the browser's
// closest signal for finger release, so the fold is committed only at that point.
let wheelDistance=0,wheelGesture=null,wheelQuietTimer,wheelReleased=true,lastWheelCompleted=-Infinity,wheelLastInput=-Infinity,preparingSnapshots=0,lastSnapshotPreparation=-Infinity;
let wheelProbeX=0,wheelProbeY=0,wheelPendingX=0,wheelLastMagnitude=0,wheelLastSign=0,wheelRestartProbeX=0,wheelRestartProbeAt=0,wheelRestartProbeMagnitude=0;
function resetWheelGesture(){clearTimeout(wheelQuietTimer);wheelDistance=0;wheelGesture=null;wheelProbeX=0;wheelProbeY=0;wheelPendingX=0;wheelLastMagnitude=0;wheelLastSign=0;wheelRestartProbeX=0;wheelRestartProbeAt=0;wheelRestartProbeMagnitude=0;wheelReleased=true;}
function armWheelRelease(){
 clearTimeout(wheelQuietTimer);wheelReleased=false;
   wheelQuietTimer=setTimeout(()=>{
   const now=performance.now(),prewarmInterference=preparingSnapshots>0||now-lastSnapshotPreparation<220;if(prewarmInterference&&wheelGesture&&!wheelGesture.ended&&now-wheelLastInput<350){armWheelRelease();return;}
  wheelReleased=true;
  if(wheelGesture&&!wheelGesture.ended)settleWheelGesture();
  else if(Math.abs(wheelPendingX)>=8&&!busy)flushQueuedWheel();
  else if(wheelGesture?.ended&&!busy)resetWheelGesture();
   },160);
}
function flushQueuedWheel(){
 if(busy||!wheelReleased||Math.abs(wheelPendingX)<8)return;
 const pending=wheelPendingX;resetWheelGesture();
 trackpadTurn({deltaX:pending,deltaY:0,deltaMode:0,target:$('viewer'),preventDefault(){}});
}
function cancelWheelGesture(){
 if(!wheelGesture||wheelGesture.ended)return false;
 wheelGesture.cancelled=true;wheelGesture.x=wheelGesture.direction>0?wheelGesture.width-2:-2;wheelGesture.ended=true;
 armWheelRelease();return true;
}
function settleWheelGesture(){
 if(!wheelGesture||wheelGesture.ended)return;
 wheelRestartProbeX=0;wheelRestartProbeAt=0;wheelRestartProbeMagnitude=0;
 wheelGesture.cancelled=(wheelGesture.progress||0)<=.5;
 wheelGesture.releasedAt=performance.now();
 if(wheelGesture.cancelled)wheelGesture.x=wheelGesture.direction>0?wheelGesture.width-2:-2;
 wheelGesture.ended=true;
}
function trackpadTurn(e){
 if($('reader').hidden||e.ctrlKey||e.metaKey||e.target?.closest?.('aside,input,select,textarea'))return;
 if(fullscreenRelayout){e.preventDefault();return;}
 const factor=e.deltaMode===1?16:e.deltaMode===2?$('viewer').clientWidth:1;
 const rawX=e.deltaX*factor,rawY=e.deltaY*factor;
 if(!rawX)return;
 const now=performance.now(),inputGap=now-wheelLastInput,previousMagnitude=wheelLastMagnitude,previousSign=wheelLastSign,magnitude=Math.abs(rawX),sign=Math.sign(rawX);
 wheelLastInput=now;wheelLastMagnitude=magnitude;wheelLastSign=sign;

 // The release timer can expire while the page is still settling. Retire that
 // completed stroke before accepting the first event from the next one.
 if(wheelGesture?.ended&&!busy&&wheelReleased)resetWheelGesture();

 // During the settling animation, ignore its inertia. If the previous stroke has
 // already gone quiet, retain the next deliberate stroke and replay it afterward.
 if(busy&&wheelGesture?.ended){
  e.preventDefault();
  const releaseTail=now-(wheelGesture.releasedAt||0)<350&&magnitude<24;
  const risingStroke=magnitude>=8&&sign===previousSign&&magnitude>Math.max(8,previousMagnitude*1.28);
  const reversedStroke=magnitude>=8&&sign!==wheelGesture.sign;
  if(!releaseTail||risingStroke||reversedStroke||wheelPendingX)wheelPendingX+=rawX;
  armWheelRelease();return;
 }

 if(!wheelGesture){
  // Sparse, low-amplitude tail events can arrive well after a physical swipe.
  // Ignore only those; a new deliberate stroke is admitted as soon as it ramps up.
  if(performance.now()-lastWheelCompleted<650&&Math.abs(rawX)<16){e.preventDefault();armWheelRelease();return;}
  // Start only from a real horizontal impulse. Tiny decaying events are inertia;
  // accumulating them over time is what previously caused surprise extra pages.
  if(Math.abs(rawX)<8){e.preventDefault();armWheelRelease();return;}
  wheelProbeX=rawX;wheelProbeY=rawY;
  if(Math.abs(wheelProbeX)<Math.abs(wheelProbeY)*.45){armWheelRelease();return;}
  if(busy)return;
  const sign=Math.sign(wheelProbeX),direction=sign*(book?.package?.metadata?.direction==='rtl'?-1:1);
  const location=rendition?.currentLocation();
  if(!location||(direction>0&&location.atEnd)||(direction<0&&location.atStart)){e.preventDefault();invalidatePreparedTurn();$('paper').classList.remove('turning');$('animation').replaceChildren();resetWheelGesture();return;}
  const width=$('viewer').clientWidth,height=$('viewer').clientHeight;
  wheelDistance=wheelProbeX*1.5;wheelProbeX=wheelProbeY=0;
  wheelGesture={wheel:true,sign,direction,width,height,completeThreshold:.5,travel:Math.min(480,width/2),progress:0,x:direction>0?width-2:2,y:height/2,startY:height/2,ended:false};
  turn(direction,wheelGesture);
 }else if(!wheelGesture.ended){
  // A fresh stroke can begin before the browser's synthetic release timeout.
  // Once the current page is fully pulled over, a short pause followed by a
  // rising impulse is queued for the next page instead of being swallowed.
  const saturated=(wheelGesture.progress||0)>=.98,probeFresh=wheelRestartProbeX&&now-wheelRestartProbeAt<90;
  const restarted=saturated&&probeFresh&&sign===wheelGesture.sign&&Math.sign(wheelRestartProbeX)===sign&&magnitude>=8&&magnitude>wheelRestartProbeMagnitude*1.18;
  if(restarted){
   wheelGesture.cancelled=false;wheelGesture.releasedAt=now;wheelGesture.ended=true;wheelPendingX+=wheelRestartProbeX+rawX;wheelRestartProbeX=0;wheelRestartProbeAt=0;wheelRestartProbeMagnitude=0;
   e.preventDefault();armWheelRelease();return;
  }
  if(saturated&&inputGap>=38&&sign===wheelGesture.sign&&magnitude>=6){
   wheelRestartProbeX=rawX;wheelRestartProbeAt=now;wheelRestartProbeMagnitude=magnitude;e.preventDefault();armWheelRelease();return;
  }
  if(!saturated){wheelRestartProbeX=0;wheelRestartProbeAt=0;wheelRestartProbeMagnitude=0;}
  wheelDistance+=rawX*1.5;
 }
 e.preventDefault();armWheelRelease();
 if(wheelGesture.ended)return;
 const progress=Math.max(0,Math.min(1,wheelDistance*wheelGesture.sign/wheelGesture.travel));
 wheelGesture.progress=progress;
 wheelGesture.x=wheelGesture.direction>0?wheelGesture.width*(1-progress):wheelGesture.width*progress;
}
$('reading-space').addEventListener('wheel',trackpadTurn,{passive:false});
window.addEventListener('blur',cancelWheelGesture);
function spacingCSS(){
 const rules=[];
 if(prefs.lineHeight!==null)rules.push(`line-height:${prefs.lineHeight}!important`);
 if(prefs.letterSpacing!==null)rules.push(`letter-spacing:${prefs.letterSpacing}px!important`);
 if(prefs.wordSpacing!==null)rules.push(`word-spacing:${prefs.wordSpacing}px!important`);
 return `body,body p,body li,body div,body span,body td{${rules.join(';')}}`+
  (prefs.paragraphSpacing!==null?`body p{margin-block-start:0!important;margin-block-end:${prefs.paragraphSpacing}em!important}`:'')+
  (prefs.pageMargin!==null?`body{padding-top:${prefs.pageMargin}px!important;padding-bottom:${prefs.pageMargin}px!important}`:'');
}
const spacingControls=[['line-height','lineHeight',1.9,'×'],['letter-spacing','letterSpacing',0,'px'],['word-spacing','wordSpacing',0,'px'],['page-margin','pageMargin',24,'px'],['paragraph-spacing','paragraphSpacing',1,'em']];
function syncSpacingControls(){for(const [id,key,value,unit] of spacingControls){$(id).value=prefs[key]??value;$(id+'-value').textContent=prefs[key]===null?'Book default':`${prefs[key]} ${unit}`;}}
for(const [id,key,,unit] of spacingControls){$(id).oninput=e=>{prefs[key]=Number(e.target.value);$(id+'-value').textContent=`${prefs[key]} ${unit}`;};$(id).onchange=()=>changeTypography();}
async function toggleFullscreen(){
 if(busy||fullscreenRelayout)return;
 // EPUB.js reports the CFI at the first visible line. Capture it before the
 // viewport changes, then display that exact content anchor in the new layout.
 fullscreenAnchorCfi=stableReadingCfi||rendition?.currentLocation()?.start?.cfi;
 fullscreenRelayout=true;
 try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}
 catch{fullscreenRelayout=false;fullscreenAnchorCfi=null;message('Fullscreen is unavailable in this browser. You can use F11 instead.');}
}
$('fullscreen').onclick=toggleFullscreen;
document.addEventListener('fullscreenchange',async()=>{
 const anchor=fullscreenAnchorCfi||stableReadingCfi||rendition?.currentLocation()?.start?.cfi,full=!!document.fullscreenElement;
 fullscreenRelayout=true;invalidatePreparedTurn();window.FolioTranslation?.close();document.body.classList.toggle('fullscreen',full);
 if(full){$('reader').tabIndex=-1;$('reader').focus({preventScroll:true});$('settings').hidden=true;$('toc').hidden=true;}
 clearTimeout(gamepadPollTimer);gamepadPollTimer=setTimeout(pollGamepads,0);$('fullscreen').textContent=full?'⊡':'⛶';$('fullscreen').title=full?'Exit fullscreen':'Enter fullscreen';$('fullscreen').setAttribute('aria-label',$('fullscreen').title);$('fullscreen').setAttribute('aria-pressed',String(full));
 try{
  if(rendition){
   await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
   rendition.resize($('viewer').clientWidth,$('viewer').clientHeight);
   if(anchor)await withTimeout(rendition.display(anchor),12000,'Fullscreen layout timed out');
   await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  }
 }catch(error){message('Could not preserve the exact reading position while resizing.');console.error(error);}
 finally{
  fullscreenRelayout=false;fullscreenAnchorCfi=null;
  if(rendition){const location=rendition.currentLocation();stableReadingCfi=location?.start?.cfi||anchor;updateReaderLocation(location);queuePreparedTurn();}
 }
});
function refreshLibrary() {
 $('count').textContent = `${books.length} ${books.length===1?'book':'books'}`; $('empty').hidden = books.length > 0; $('books').replaceChildren();
 for(const item of [...books].sort((a,b)=>(b.updated||0)-(a.updated||0))) {
  const card = document.createElement('button'); card.className='book-card'; card.setAttribute('aria-label',`Read ${item.title}`);
  const cover=document.createElement('div'); cover.className='cover'; cover.textContent=item.title;
  if(item.cover) { const img=document.createElement('img'); const key=`cover-${item.id}`; if(!urls.has(key)) urls.set(key,URL.createObjectURL(item.cover)); img.src=urls.get(key); img.alt=''; img.onerror=()=>img.remove(); cover.append(img); }
  const title=document.createElement('h2');title.textContent=item.title; const author=document.createElement('p');author.textContent=item.author || 'Unknown author';const resume=document.createElement('span');resume.className='resume';resume.textContent=item.cfi?'Continue reading →':'Start reading →';card.append(cover,title,author,resume);card.onclick=()=>openBook(item);$('books').append(card);
 }
}
async function importBooks(files) {
 if(importing) return; importing=true; $('import').disabled=true;
 let added=0;
 try { for(const file of files) { if(!/\.epub$/i.test(file.name)) {message('Choose an EPUB file.');continue;} message(`Importing “${file.name}”…`); let parsed;
  try { const data=await file.arrayBuffer();const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data))).map(b=>b.toString(16).padStart(2,'0')).join('');if(books.some(b=>b.id===hash)){message('This book is already in your library.');continue;}
   const zip=await JSZip.loadAsync(data);if(!zip.file('META-INF/container.xml'))throw new Error('The EPUB container information is missing');
   const encryption=zip.file('META-INF/encryption.xml');if(encryption && /xmlenc#aes|xmlenc#tripledes|adept/i.test(await encryption.async('string')))throw new Error('This book is DRM-protected and cannot be opened');
   parsed=ePub(data,{replacements:'blobUrl'}); await withTimeout(parsed.ready,20000,'EPUB parsing timed out');const meta=await parsed.loaded.metadata;let cover=null;try{const url=await parsed.coverUrl();if(url)cover=await (await fetch(url)).blob();}catch{}
   const item={id:hash,title:meta.title||file.name.replace(/\.epub$/i,''),author:meta.creator||'',data,cover,updated:Date.now(),cfi:null};await storage('books','put',item);books.push(item);added++;refreshLibrary();
  }catch(error){message(`Could not import “${file.name}”: ${error.message || 'The file is damaged or storage is full'}`);}finally{parsed?.destroy();}
 } if(added) message(`${added} ${added===1?'book':'books'} saved to your local library.`);
 }finally{importing=false;$('import').disabled=false;$('epub-input').value='';}
}
function withTimeout(promise,ms,label) {let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label)),ms);})]).finally(()=>clearTimeout(timer));}
async function saveProgress(force=false){if(!active||!rendition||(!force&&busy))return;const loc=rendition.currentLocation();if(!loc?.start?.cfi)return;if(active.cfi===loc.start.cfi&&active.progressSaved)return;active.cfi=loc.start.cfi;active.updated=Date.now();active.progressSaved=true;await storage('settings','put',{id:'progress-'+active.id,cfi:active.cfi,updated:active.updated}).catch(()=>{active.progressSaved=false;message('Could not save your reading position. Check local storage.');});}
async function openBook(item) {
 if(busy)return;invalidatePreparedTurn();$('translation-settings').hidden=true;busy=true;
  try{await saveProgress(true);rendition?.destroy();book?.destroy();stableReadingCfi=null;active=item;book=ePub(item.data.slice(0),{replacements:'blobUrl'});$('library').hidden=true;$('reader').hidden=false;document.body.classList.add('reading');$('book-title').textContent=item.title;$('chapter').textContent='Opening…';$('position').textContent='';$('viewer').replaceChildren();
 await withTimeout(book.ready,20000,'Opening the book timed out');rendition=book.renderTo('viewer',{width:'100%',height:'100%',flow:'paginated',spread:'auto',minSpreadWidth:850,gap:prefs.pageMargin === null ? undefined : prefs.pageMargin*2,allowScriptedContent:false});
 rendition.hooks.content.register(async contents=>{await styleContents(contents);contents.document.addEventListener('keydown',keyboard);wireGestures(contents.document);window.FolioTranslation?.attach(contents.document);});
  rendition.on('relocated',updateReaderLocation);
 rendition.on('displayError',()=>message('This chapter cannot be displayed. It may use unsupported EPUB content.'));
 buildToc(book.navigation.toc);try{await withTimeout(rendition.display(item.cfi||undefined),20000,'Page layout timed out');}catch(err){if(item.cfi)await rendition.display();else throw err;}
 }catch(error){message(`Could not open this book: ${error.message}`);rendition?.destroy();rendition=null;book?.destroy();book=null;active=null;showLibrary();}finally{busy=false;if(rendition){$('reader').tabIndex=-1;$('reader').focus({preventScroll:true});}queuePreparedTurn();}
}
function updateReaderLocation(loc){if(!loc?.start||!book)return;if(!fullscreenRelayout)stableReadingCfi=loc.start.cfi;window.FolioTranslation?.close();$('paper').classList.toggle('spread',(rendition.manager?.layout?.divisor||1)===2);const section=book.spine.get(loc.start.cfi);const tocItem=findToc(book.navigation.toc,section?.href);$('chapter').textContent=tocItem?.label?.trim()||active?.title||'';const shown=loc.start.displayed;$('position').textContent=shown?`Chapter ${shown.page} / ${shown.total}`:'';$('prev').disabled=loc.atStart;$('next').disabled=loc.atEnd;clearTimeout(progressTimer);progressTimer=setTimeout(saveProgress,250);if(!busy&&!fullscreenRelayout)queuePreparedTurn();}
function findToc(items,href){for(const item of items||[]){if(!item)continue;if(item.href?.split('#')[0]===href?.split('#')[0])return item;const nested=findToc(item.subitems,href);if(nested)return nested;}}
function buildToc(items){$('toc-items').replaceChildren();let count=0;const walk=(nodes,depth=0)=>{for(const item of nodes||[]){if(!item)continue;const btn=document.createElement('button'),label=typeof item.label==='string'?item.label.trim():'';btn.textContent=label||item.href?.split('/').pop()?.split('#')[0]||'Untitled section';btn.style.paddingLeft=`${10+depth*14}px`;if(item.href)btn.onclick=async()=>{if(busy)return;invalidatePreparedTurn();$('toc').hidden=true;busy=true;try{await rendition.display(item.href);await new Promise(resolve=>requestAnimationFrame(resolve));updateReaderLocation(rendition.currentLocation());}catch{message('This chapter could not be opened.');}finally{busy=false;queuePreparedTurn();}};else{btn.disabled=true;btn.setAttribute('aria-disabled','true');}$('toc-items').append(btn);count++;walk(item.subitems||[],depth+1);}};walk(items);if(!count)$('toc-items').textContent='This book does not include a table of contents.';}
function showLibrary(){invalidatePreparedTurn();window.FolioTranslation?.close();$('reader').hidden=true;$('library').hidden=false;$('settings').hidden=true;$('toc').hidden=true;$('translation-settings').hidden=true;document.body.classList.remove('reading');refreshLibrary();}
async function goHome(){if(busy)return;invalidatePreparedTurn();await saveProgress();clearTimeout(progressTimer);rendition?.destroy();rendition=null;book?.destroy();book=null;active=null;stableReadingCfi=null;showLibrary();}
// Capture the visible iframe geometry, not a scroll container that resets during cloning.
function capture(viewport=$('viewer')){
 const bounds=viewport.getBoundingClientRect();
 const frames=[...viewport.querySelectorAll('iframe')].map(frame=>{
  const rect=frame.getBoundingClientRect(),doc=frame.contentDocument,copy=doc.documentElement.cloneNode(true);
  const styles=[...doc.querySelectorAll('style')];
  copy.querySelectorAll('style').forEach((style,i)=>{try{style.textContent=[...styles[i].sheet.cssRules].map(rule=>rule.cssText).join('\n');}catch{}});
  copy.querySelectorAll('script').forEach(script=>script.remove());
   return {html:new XMLSerializer().serializeToString(copy),x:rect.left-bounds.left,y:rect.top-bounds.top,width:rect.width,height:rect.height,scrollX:frame.contentWindow.scrollX,scrollY:frame.contentWindow.scrollY};
 });
 return {width:bounds.width,height:bounds.height,frames};
}
async function inlineSnapshotResources(html){
 const objectUrls=[...new Set(html.match(/blob:[^"'\s)<>]+/g)||[])];if(!objectUrls.length)return html;
 const replacements=await Promise.all(objectUrls.map(async url=>{try{const blob=await (await fetch(url)).blob(),data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});return [url,data];}catch{return [url,url];}}));
 for(const [url,data] of replacements)html=html.split(url).join(data);return html;
}
async function captureVector(viewport=$('viewer')){
 const snapshot=capture(viewport),frames=[],objectUrls=[];
 try{for(const saved of snapshot.frames){
  const left=Math.max(0,saved.x),top=Math.max(0,saved.y),right=Math.min(snapshot.width,saved.x+saved.width),bottom=Math.min(snapshot.height,saved.y+saved.height),width=Math.max(0,right-left),height=Math.max(0,bottom-top);if(!width||!height)continue;
  const sourceX=saved.scrollX+left-saved.x,sourceY=saved.scrollY+top-saved.y,parsed=new DOMParser().parseFromString(saved.html,'application/xhtml+xml'),body=parsed.querySelector('body');if(body)body.style.overflow='visible';const html=await inlineSnapshotResources(new XMLSerializer().serializeToString(parsed.documentElement));
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${sourceX} ${sourceY} ${width} ${height}"><foreignObject x="0" y="0" width="${saved.width}" height="${saved.height}">${html}</foreignObject></svg>`;
  const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'})),image=new Image();image.src=url;try{await image.decode();}catch(error){URL.revokeObjectURL(url);throw error;}objectUrls.push(url);frames.push({imageUrl:url,x:left,y:top,width,height});
 }}catch(error){for(const url of objectUrls)URL.revokeObjectURL(url);throw error;}
 return {width:snapshot.width,height:snapshot.height,frames,vector:true,objectUrls};
}
function snapshotState(location=rendition?.currentLocation()){
 const viewer=$('viewer'),cfi=location?.start?.cfi;
 if(!cfi||!viewer.clientWidth||!viewer.clientHeight)return null;
 return {cfi,width:viewer.clientWidth,height:viewer.clientHeight,double:(rendition.manager?.layout?.divisor||1)===2};
}
function sameSnapshotState(a,b){return !!a&&!!b&&a.cfi===b.cfi&&a.width===b.width&&a.height===b.height&&a.double===b.double;}
function canTurn(location,direction){return !!location&&!(direction>0?location.atEnd:location.atStart);}
function destroyFlip(flip){try{flip?.getRender()?.stop();const ui=flip?.getUI?.();if(ui?.onResize)window.removeEventListener('resize',ui.onResize,false);flip?.destroy();}catch{}}
function disposePreparedTurn(prepared){destroyFlip(prepared?.flip);prepared?.holder?.remove();for(const url of prepared?.objectUrls||[])URL.revokeObjectURL(url);}
function invalidatePreparedTurn(){
 prepareGeneration++;clearTimeout(prepareTimer);prepareTimer=undefined;
 if(prepareIdle!==undefined){window.cancelIdleCallback?.(prepareIdle);prepareIdle=undefined;}
 preparingHolder=null;
 for(const stale of [preparedTurn,preparedOppositeTurn])if(stale)disposePreparedTurn(stale);preparedTurn=null;preparedOppositeTurn=null;
}
function makeThreeSurface(before,after,direction,state,parent){
 const host=document.createElement('div');host.className='three-turn';host.style.cssText='position:absolute;inset:0;visibility:hidden';parent.append(host);
 const built={host,parallelHost:host,state,direction,currentSnapshot:before,targetSnapshot:after,objectUrls:[...new Set([...(before.objectUrls||[]),...(after.objectUrls||[])])]};
 built.mounts=[async()=>{built.gpu=await window.FolioGPU.create(before,after,direction,state,prefs.theme==='dark'?'#000000':'#ffffff');host.append(built.gpu.host);}];
 built.renderer={drawFrame(){if(!busy)built.gpu?.draw(0);}};
 built.flip={getRender:()=>({stop(){}}),destroy:()=>built.gpu?.dispose()};
 return built;
}
async function captureAdjacentSnapshot(state,direction,sourceBook){
 const host=document.createElement('div');host.style.cssText=`position:fixed;left:-20000px;top:0;width:${state.width}px;height:${state.height}px;overflow:hidden;visibility:hidden;pointer-events:none`;document.body.append(host);preparingHolder=host;let preview;
 try{
  preview=sourceBook.renderTo(host,{width:state.width,height:state.height,flow:'paginated',spread:'auto',minSpreadWidth:850,gap:prefs.pageMargin===null?undefined:prefs.pageMargin*2,allowScriptedContent:false});
  preview.hooks.content.register(styleContents);
  await withTimeout(preview.display(state.cfi),20000,'Preview layout timed out');
  await withTimeout(direction>0?preview.next():preview.prev(),12000,'Preview turn timed out');
  await withTimeout(Promise.all(preview.getContents().map(c=>c.document.fonts.ready)),4000,'Preview font loading timed out');
   return await captureVector(host);
 }finally{preview?.destroy();if(preparingHolder===host)preparingHolder=null;host.remove();}
}
async function prepareTurn(state,direction,generation,opposite=false,allowBusy=false,beforeSeed){
 let holder,built,before,after,handedOff=false,counted=false;
 try{
   if(generation!==prepareGeneration||(!allowBusy&&busy)||!book||!sameSnapshotState(state,snapshotState()))return;
   preparingSnapshots++;counted=true;
   const sourceBook=book;before=beforeSeed||await captureVector();after=await captureAdjacentSnapshot(state,direction,sourceBook);
  if(generation!==prepareGeneration||(!allowBusy&&busy)||book!==sourceBook||!sameSnapshotState(state,snapshotState()))return;
  holder=document.createElement('div');holder.style.cssText=`position:fixed;left:-20000px;top:0;width:${state.width}px;height:${state.height}px;overflow:hidden;visibility:hidden;pointer-events:none`;document.body.append(holder);preparingHolder=holder;
  built=makeThreeSurface(before,after,direction,state,holder);built.host.style.position='absolute';built.host.style.inset='0';
  await Promise.all(built.mounts.map(mount=>mount()));if(!allowBusy){built.renderer.drawFrame();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));}
  if(generation!==prepareGeneration||(!allowBusy&&busy)||book!==sourceBook||!sameSnapshotState(state,snapshotState()))return;
   const ready={...built,holder,state,direction};if(!allowBusy)setParallelProgress(ready,0);if(opposite)preparedOppositeTurn=ready;else preparedTurn=ready;handedOff=true;built=null;holder=null;preparingHolder=null;
 }catch(error){console.warn('Could not prepare the page-turn cache.',error);}finally{
   if(counted){preparingSnapshots=Math.max(0,preparingSnapshots-1);lastSnapshotPreparation=performance.now();}
  if(preparingHolder===holder)preparingHolder=null;
   if(built)disposePreparedTurn({...built,holder});else holder?.remove();if(!handedOff&&!built)for(const url of [...(before?.objectUrls||[]),...(after?.objectUrls||[])])URL.revokeObjectURL(url);
 }
}
async function prepareContinuousTurn(beforeSnapshot){
 if(!window.FolioGPU?.available()||!rendition||!book||$('reader').hidden||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const location=rendition.currentLocation(),state=snapshotState(location);if(!state)return;
 let direction=lastTurnDirection??(book.package?.metadata?.direction==='rtl'?-1:1);if(!canTurn(location,direction))direction=-direction;if(!canTurn(location,direction))return;
 // The next continuous stroke overwhelmingly keeps its direction. Preparing only
 // that side here halves post-turn DOM/layout work and keeps the next curl responsive.
 invalidatePreparedTurn();const generation=prepareGeneration;
 await prepareTurn(state,direction,generation,false,true,beforeSnapshot);
}
function queueOppositePreparedTurn(){
 const primary=preparedTurn;if(!primary||preparedOppositeTurn||busy||fullscreenRelayout||!rendition||!book)return;
 const location=rendition.currentLocation(),state=snapshotState(location),direction=-primary.direction;
 if(!state||!canTurn(location,direction))return;
 const generation=prepareGeneration;let deferrals=0;
 prepareTimer=setTimeout(()=>{
  prepareTimer=undefined;
  const run=deadline=>{
   prepareIdle=undefined;
   if(generation!==prepareGeneration||busy||preparedTurn!==primary||preparedOppositeTurn)return;
   if(deadline&&deadline.timeRemaining()<8&&deferrals++<3){prepareIdle=window.requestIdleCallback(run,{timeout:180});return;}
   prepareTurn(state,direction,generation,true);
  };
  if(window.requestIdleCallback)prepareIdle=window.requestIdleCallback(run,{timeout:300});else run();
 },240);
}
function queuePreparedTurn(){
 if(!window.FolioGPU?.available()||busy||fullscreenRelayout||$('reader').hidden||!rendition||!book||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const location=rendition.currentLocation(),state=snapshotState(location);if(!state)return;
 let direction=lastTurnDirection??(book.package?.metadata?.direction==='rtl'?-1:1);
 if(!canTurn(location,direction))direction=-direction;if(!canTurn(location,direction))return;
 invalidatePreparedTurn();const generation=prepareGeneration;
 const directions=[direction,-direction].filter((value,index,list)=>list.indexOf(value)===index&&canTurn(location,value));
 prepareTimer=setTimeout(()=>{prepareTimer=undefined;let deferrals=0;const run=deadline=>{prepareIdle=undefined;if(generation!==prepareGeneration||busy)return;if(deadline&&deadline.timeRemaining()<8&&deferrals++<3){prepareIdle=window.requestIdleCallback(run,{timeout:160});return;}Promise.all(directions.map((value,index)=>prepareTurn(state,value,generation,index>0)));};if(window.requestIdleCallback)prepareIdle=window.requestIdleCallback(run,{timeout:240});else prepareTimer=setTimeout(run,0);},240);
}
function takePreparedTurn(direction,location){
 const candidates=[preparedTurn,preparedOppositeTurn].filter(Boolean);preparedTurn=null;preparedOppositeTurn=null;prepareGeneration++;clearTimeout(prepareTimer);prepareTimer=undefined;if(prepareIdle!==undefined){window.cancelIdleCallback?.(prepareIdle);prepareIdle=undefined;}preparingHolder=null;
 if(!candidates.length)return null;const current=snapshotState(location),candidate=candidates.find(item=>item.direction===direction&&sameSnapshotState(item.state,current));
 if(candidate){for(const stale of candidates)if(stale!==candidate)disposePreparedTurn(stale);return candidate;}
 const fallback=candidates.find(item=>sameSnapshotState(item.state,current));for(const stale of candidates)if(stale!==fallback)disposePreparedTurn(stale);
 if(fallback?.currentSnapshot){destroyFlip(fallback.flip);fallback.holder?.remove();return {coldSnapshot:fallback.currentSnapshot,objectUrls:fallback.objectUrls};}
 if(fallback)disposePreparedTurn(fallback);return null;
}
async function mountSnapshot(snapshot,parent){
 const clone=document.createElement('div');clone.style.cssText='position:relative;overflow:hidden;width:'+snapshot.width+'px;height:'+snapshot.height+'px;pointer-events:none';parent.append(clone);
 const ready=[];
 for(const saved of snapshot.frames){
  if(saved.imageUrl){
   const image=new Image();image.alt='';image.setAttribute('aria-hidden','true');image.draggable=false;image.style.cssText='position:absolute;left:'+saved.x+'px;top:'+saved.y+'px;width:'+saved.width+'px;height:'+saved.height+'px';image.src=saved.imageUrl;clone.append(image);ready.push(withTimeout(image.decode(),5000,'Loading the page image timed out'));continue;
  }
   const frame=document.createElement('iframe');frame.setAttribute('sandbox','allow-same-origin');frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;
   frame.style.cssText='position:absolute;border:0;max-width:none;left:'+saved.x+'px;top:'+saved.y+'px;width:'+saved.width+'px;height:'+saved.height+'px';
   // srcdoc survives the flip library's cloning/reparenting; document.write does not.
   const loaded=new Promise((resolve,reject)=>{frame.onload=async()=>{try{frame.contentWindow.scrollTo(saved.scrollX,saved.scrollY);await withTimeout(frame.contentDocument.fonts.ready,4000,'Font loading timed out');resolve();}catch(error){reject(error);}};frame.onerror=()=>reject(new Error('Could not load the page snapshot'));});
  frame.srcdoc=saved.html;clone.append(frame);ready.push(withTimeout(loaded,5000,'Loading the page snapshot timed out'));
 }
 await Promise.all(ready);return clone;
}
function setParallelProgress(prepared,progress,interaction){prepared.gpu.draw(progress,interaction);}
function gestureProgress(gesture,direction,width){
 if(!gesture)return 0;if(Number.isFinite(gesture.progress))return Math.max(0,Math.min(1,gesture.progress));
 const pageWidth=Math.max(1,width||gesture.width||1),start=Number.isFinite(gesture.startX)?gesture.startX:(direction>0?pageWidth:0);
 const distance=direction>0?start-gesture.x:gesture.x-start,travel=direction>0?start:pageWidth-start;
 if(!gesture.wheel&&Number.isFinite(gesture.startY)&&Number.isFinite(gesture.y))return Math.max(0,Math.min(1,Math.hypot(Math.max(0,distance),(gesture.y-gesture.startY)*.65)/Math.max(1,travel)));
 return Math.max(0,Math.min(1,distance/Math.max(1,travel)));
}
async function playThreeTurn(prepared,direction,gesture,location){
 const {host,holder,gpu}=prepared,paper=$('paper'),animation=$('animation');
 const progress=()=>gestureProgress(gesture,direction,prepared.state.width);
 let rendered=progress(),renderedX=gesture?.startX??gesture?.x??prepared.state.width/2,renderedY=gesture?.startY??gesture?.y??prepared.state.height/2,lastFrame=performance.now();
 const interaction=(shown=rendered,base=rendered)=>{if(!gesture||gesture.wheel)return{mode:'spine'};const ratio=base>.0001?shown/base:0,startX=gesture.startX??renderedX,startY=gesture.startY??renderedY;return{mode:'corner',cornerY:startY+(renderedY-startY)*ratio,startY,pointerX:startX+(renderedX-startX)*ratio,startX};};
 host.style.visibility='hidden';animation.append(host);holder.remove();gpu.draw(rendered,interaction(rendered,rendered),true);paper.classList.add('turning');host.style.visibility='visible';
 if(gesture&&!gesture.ended)await new Promise((resolve,reject)=>{const tick=now=>{try{const raw=progress();if(gesture.wheel)rendered=raw;else{const elapsed=Math.min(24,Math.max(0,now-lastFrame)),blend=1-Math.exp(-elapsed/24);rendered+=((raw-rendered)*blend);renderedX+=(gesture.x-renderedX)*blend;renderedY+=(gesture.y-renderedY)*blend;if(Math.abs(raw-rendered)<.0005)rendered=raw;if(Math.abs(gesture.x-renderedX)<.1)renderedX=gesture.x;if(Math.abs(gesture.y-renderedY)<.1)renderedY=gesture.y;}lastFrame=now;gesture.renderedProgress=rendered;gesture.renderedX=renderedX;gesture.renderedY=renderedY;gpu.draw(rendered,interaction(rendered,rendered));if(gesture.ended)resolve();else requestAnimationFrame(tick);}catch(error){reject(error);}};requestAnimationFrame(tick);});
 const raw=progress(),start=gesture&&!gesture.wheel?rendered:raw,committed=gesture?!(gesture.cancelled??(raw<=.5)):true,target=committed?1:0,duration=120+Math.abs(target-start)*220;
 await new Promise((resolve,reject)=>{let frame;const began=performance.now(),timer=setTimeout(()=>{cancelAnimationFrame(frame);resolve();},600);const tick=now=>{try{const t=Math.min(1,(now-began)/duration),shown=start+(target-start)*(1-(1-t)**3);gpu.draw(shown,interaction(shown,start));if(t===1){clearTimeout(timer);resolve();}else frame=requestAnimationFrame(tick);}catch(e){clearTimeout(timer);reject(e);}};frame=requestAnimationFrame(tick);});
 gpu.draw(target,interaction(target,start));if(gesture)gesture.cancelled=!committed;
 if(committed){await withTimeout(direction>0?rendition.next():rendition.prev(),12000,'Turning the page timed out');await withTimeout(Promise.all(rendition.getContents().map(c=>c.document.fonts.ready)),4000,'Font loading timed out');await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));}
 else if(rendition.currentLocation()?.start?.cfi!==location.start.cfi)await rendition.display(location.start.cfi);
 // GPU textures and live EPUB text use different antialiasing paths. Blend
 // their identical end states instead of dropping the canvas between frames.
 await host.animate([{opacity:1},{opacity:0}],{duration:64,easing:'ease-out',fill:'forwards'}).finished.catch(()=>{});
}
async function playPreparedTurn(prepared,direction,gesture,location){await playThreeTurn(prepared,direction,gesture,location);return prepared.flip;}
async function playColdTurn(direction,gesture,snapshot){
 const viewer=$('viewer'),paper=$('paper'),animation=$('animation'),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 let cue;if(gesture&&!gesture.ended&&!reduced){cue=document.createElement('div');cue.className=`cold-edge ${direction>0?'right':'left'}`;animation.append(cue);await new Promise(resolve=>{const tick=()=>{const progress=gestureProgress(gesture,direction,gesture.width);cue.style.opacity=String(Math.min(.8,.12+progress*.68));cue.style.transform=`scaleX(${Math.max(.08,progress)})`;if(gesture.ended)resolve();else requestAnimationFrame(tick);};tick();});}
 if(gesture){const progress=gestureProgress(gesture,direction,gesture.width);if(gesture.cancelled===undefined)gesture.cancelled=progress<=.5;if(gesture.cancelled){cue?.remove();return;}}cue?.remove();
 let cover;if(snapshot&&!reduced){cover=document.createElement('div');cover.className='freeze';cover.style.visibility='hidden';animation.append(cover);await mountSnapshot(snapshot,cover);cover.style.visibility='visible';paper.classList.add('turning');}
 await withTimeout(direction>0?rendition.next():rendition.prev(),12000,'Turning the page timed out');await withTimeout(Promise.all(rendition.getContents().map(c=>c.document.fonts.ready)),4000,'Font loading timed out');await new Promise(resolve=>requestAnimationFrame(resolve));
 paper.classList.remove('turning');if(cover){await cover.animate([{opacity:1},{opacity:0}],{duration:130,easing:'ease-out'}).finished.catch(()=>{});cover.remove();}
}
async function turn(direction,gesture){if(!rendition||busy)return;const location=rendition.currentLocation();if(!location?.start){if(gesture){gesture.cancelled=true;gesture.ended=true;}return;}if(direction>0&&location.atEnd||direction<0&&location.atStart){if(gesture){gesture.cancelled=true;gesture.ended=true;}invalidatePreparedTurn();$('paper').classList.remove('turning');$('animation').replaceChildren();if(gesture?.wheel)resetWheelGesture();return;}const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches||!window.FolioGPU?.available(),cached=!reduced?takePreparedTurn(direction,location):null;let prepared=cached?.flip?cached:null;if(!cached)invalidatePreparedTurn();busy=true;lastTurnDirection=direction;window.FolioTranslation?.close();const paper=$('paper'),animation=$('animation');let flip,holder,extraUrls=[];
 try{
  if(!prepared&&!reduced){
   let cue;if(gesture){
    cue=document.createElement('div');cue.className=`cold-edge ${direction>0?'right':'left'}`;animation.append(cue);
    const update=()=>{if(!cue.isConnected)return;const p=gesture.progress||0;cue.style.opacity=String(.12+p*.68);cue.style.transform=`scaleX(${Math.max(.08,p)})`;requestAnimationFrame(update);};update();
    // Yield one compositor frame before cloning a potentially enormous EPUB
    // document. Input remains responsive even when a cache has been invalidated.
    await new Promise(resolve=>requestAnimationFrame(resolve));
   }
   const state=snapshotState(location),before=cached?.coldSnapshot||await captureVector();extraUrls.push(...(before.objectUrls||[]));
   const after=await captureAdjacentSnapshot(state,direction,book);extraUrls.push(...(after.objectUrls||[]));
   holder=document.createElement('div');holder.style.cssText=`position:fixed;left:-20000px;width:${state.width}px;height:${state.height}px;visibility:hidden`;document.body.append(holder);
   const built=makeThreeSurface(before,after,direction,state,holder);flip=built.flip;await Promise.all(built.mounts.map(mount=>mount()));prepared={...built,holder,state,direction};cue?.remove();
  }
  if(prepared){flip=prepared.flip;await playPreparedTurn(prepared,direction,gesture,location);return;}await playColdTurn(direction,gesture,cached?.coldSnapshot);
 }catch(error){
  if(!window.FolioGPU?.available()){
   paper.classList.remove('turning');animation.replaceChildren();
   try{await playColdTurn(direction,gesture);message('GPU animation is unavailable. Reading remains available.');}catch(fallbackError){message('Could not turn this page. Please try again.');console.error(fallbackError);}
  }else{message('Something went wrong while turning the page. Please try again.');console.error(error);}
 }finally{
  if(gesture?.wheel){gesture.ended=true;if(!gesture.cancelled)lastWheelCompleted=performance.now();}
  paper.classList.remove('turning');animation.replaceChildren();
  destroyFlip(flip);holder?.remove();
  // Keep the completed page fully visible while preparing the next physical curl.
  // New trackpad input received here is accumulated and replayed once the GPU
  // surface is ready, so a rapid second swipe never degrades into a flat jump.
  if(gesture?.wheel&&!gesture.cancelled)await prepareContinuousTurn(prepared?.targetSnapshot);
  const retainedUrls=new Set([...(preparedTurn?.objectUrls||[]),...(preparedOppositeTurn?.objectUrls||[])]);
  for(const url of new Set([...(cached?.objectUrls||[]),...extraUrls]))if(!retainedUrls.has(url))URL.revokeObjectURL(url);
  busy=false;saveProgress(true);
  if(!preparedTurn&&!preparedOppositeTurn)queuePreparedTurn();else if(preparedTurn&&!preparedOppositeTurn)queueOppositePreparedTurn();
  if(gesture?.wheel&&wheelReleased&&Math.abs(wheelPendingX)<8)resetWheelGesture();
  flushQueuedWheel();
 }
}
let lastKeyboardTurn=-Infinity,pendingGamepadTurn,gamepadPollTimer,gamepadState=new Map();
function queueGamepadTurn(direction){clearTimeout(pendingGamepadTurn);const queuedAt=performance.now();pendingGamepadTurn=setTimeout(()=>{if(fullscreenRelayout||performance.now()-lastKeyboardTurn<140||queuedAt<lastKeyboardTurn)return;turn(direction);},80);}
function pollGamepads(){
 const available=navigator.getGamepads?.()||[],activeFullscreen=!!document.fullscreenElement&&!$('reader').hidden;
 for(const pad of available){if(!pad)continue;const previous=gamepadState.get(pad.index)||[];const pressed=i=>!!pad.buttons?.[i]?.pressed,next=pressed(15)||pressed(5),prev=pressed(14)||pressed(4),exit=pressed(1);
  if(activeFullscreen){const rtl=book?.package?.metadata?.direction==='rtl'?-1:1;if(next&&!previous[0])queueGamepadTurn(rtl);if(prev&&!previous[1])queueGamepadTurn(-rtl);if(exit&&!previous[2])toggleFullscreen();}
  gamepadState.set(pad.index,[next,prev,exit]);
 }
 for(const index of [...gamepadState.keys()])if(!available[index])gamepadState.delete(index);
 clearTimeout(gamepadPollTimer);gamepadPollTimer=setTimeout(pollGamepads,activeFullscreen?16:250);
}
gamepadPollTimer=setTimeout(pollGamepads,250);
function keyboard(e){if(e.key==="Escape"&&cancelWheelGesture()){e.preventDefault();return;}if(window.FolioTranslation?.handleKey(e))return;if(e.key==='Escape'&&document.fullscreenElement){toggleFullscreen();return;}if(!document.fullscreenElement&&e.target?.closest?.('input,select,textarea,button'))return;if(e.key==='Escape'){$('settings').hidden=true;$('toc').hidden=true;}if($('reader').hidden||fullscreenRelayout)return;if(e.key==='ArrowRight'){e.preventDefault();lastKeyboardTurn=performance.now();clearTimeout(pendingGamepadTurn);turn(book?.package?.metadata?.direction==='rtl'?-1:1);}if(e.key==='ArrowLeft'){e.preventDefault();lastKeyboardTurn=performance.now();clearTimeout(pendingGamepadTurn);turn(book?.package?.metadata?.direction==='rtl'?1:-1);}}
function wireGestures(target){target.addEventListener("wheel",trackpadTurn,{passive:false});let start;target.addEventListener('pointerdown',e=>{if(e.button===0)start={x:e.clientX,y:e.clientY};});target.addEventListener('pointerup',e=>{if(!start)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;start=null;if(Math.abs(dx)>35&&Math.abs(dx)>Math.abs(dy)*1.5&&!target.getSelection?.()?.toString()){turn((dx<0?1:-1)*(book?.package?.metadata?.direction==='rtl'?-1:1));}});target.addEventListener('pointercancel',()=>start=null);}
let typographyPending=false, typographyTimer;
async function changeTypography(){
 typographyPending=true;persistPrefs();clearTimeout(typographyTimer);invalidatePreparedTurn();
 if(busy){typographyTimer=setTimeout(changeTypography,80);return;}
 if(!rendition){typographyPending=false;return;}
 busy=true;typographyPending=false;const cfi=rendition.currentLocation()?.start.cfi;
 try{rendition.manager.settings.gap=prefs.pageMargin===null?undefined:prefs.pageMargin*2;rendition.manager.updateLayout();await Promise.all(rendition.getContents().map(styleContents));rendition.themes.fontSize(prefs.size+'px');await rendition.display(cfi);}
 catch{message('Could not update the layout. Reopen the book and try again.');}finally{busy=false;if(typographyPending)changeTypography();else queuePreparedTurn();}
}
async function importFont(file){if(!file)return;try{if(!/\.(ttf|otf|woff2?)$/i.test(file.name))throw new Error('Choose a supported font file');const data=await file.arrayBuffer();const id=`font-${crypto.randomUUID()}`;const face=new FontFace(id,data);await face.load();const item={id,name:file.name.replace(/\.[^.]+$/,''),data};await storage('fonts','put',item);fonts.push(item);addFont(item);prefs.font=id;$('font-select').value=id;await changeTypography();message('The font was added and saved locally.');}catch(error){message(`Could not add the font: ${error.message}`);}finally{$('font-input').value='';}}
function addFont(font){urls.set(font.id,URL.createObjectURL(new Blob([font.data])));const option=document.createElement('option');option.value=font.id;option.textContent=font.name;$('font-select').append(option);}
$('import').onclick=$('empty-import').onclick=()=>$('epub-input').click();$('epub-input').onchange=e=>importBooks(e.target.files);$('font-import').onclick=()=>$('font-input').click();$('font-input').onchange=e=>importFont(e.target.files[0]);$('home').onclick=$('back').onclick=goHome;$('prev').onclick=()=>turn(-1);$('next').onclick=()=>turn(1);$('theme').onclick=()=>applyTheme(prefs.theme==='dark'?'light':'dark');$('light-option').onclick=()=>applyTheme('light');$('dark-option').onclick=()=>applyTheme('dark');$('settings-toggle').onclick=()=>{const panel=$('settings');panel.hidden=!panel.hidden;$('toc').hidden=true;$('translation-settings').hidden=true;window.FolioTranslation?.close();};$('toc-toggle').onclick=()=>{const panel=$('toc');panel.hidden=!panel.hidden;$('settings').hidden=true;$('translation-settings').hidden=true;window.FolioTranslation?.close();};document.querySelectorAll('[data-close]').forEach(btn=>btn.onclick=()=>$(btn.dataset.close).hidden=true);$('font-select').onchange=e=>{prefs.font=e.target.value;changeTypography();};$('font-size').oninput=e=>{$('size-value').textContent=`${e.target.value} px`;};$('font-size').onchange=e=>{prefs.size=Number(e.target.value);changeTypography();};document.addEventListener('keydown',keyboard);document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelWheelGesture();invalidatePreparedTurn();saveProgress();}});window.addEventListener('pagehide',()=>{cancelWheelGesture();invalidatePreparedTurn();saveProgress();});
let readerResizeTimer;if(window.ResizeObserver)new ResizeObserver(()=>{if($('reader').hidden)return;invalidatePreparedTurn();clearTimeout(readerResizeTimer);readerResizeTimer=setTimeout(queuePreparedTurn,180);}).observe($('viewer'));
let dragDepth=0;document.addEventListener('dragenter',e=>{if(e.dataTransfer.types.includes('Files')){e.preventDefault();dragDepth++;$('drop-zone').hidden=false;}});document.addEventListener('dragover',e=>{if(e.dataTransfer.types.includes('Files'))e.preventDefault();});document.addEventListener('dragleave',()=>{if(--dragDepth<=0){dragDepth=0;$('drop-zone').hidden=true;}});document.addEventListener('drop',e=>{e.preventDefault();dragDepth=0;$('drop-zone').hidden=true;if(e.dataTransfer.files.length)importBooks(e.dataTransfer.files);});
for(const direction of [-1,1]){const edge=document.createElement('div');edge.className=`drag-edge ${direction<0?'left':'right'}`;edge.title='Drag the page edge to turn';$('paper').append(edge);let gesture;
 const finishGesture=cancelled=>{if(!gesture)return;const current=gesture;gesture=null;if(cancelled){current.cancelled=true;current.x=direction>0?$('paper').clientWidth-2:2;}current.ended=true;};
 edge.onpointerdown=e=>{if(busy||e.button!==0)return;e.preventDefault();edge.setPointerCapture(e.pointerId);const rect=$('paper').getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;gesture={x,y,startX:x,startY:y,width:rect.width,height:rect.height,ended:false};turn(direction,gesture);};
 edge.onpointermove=e=>{if(!gesture)return;const rect=$('paper').getBoundingClientRect();gesture.x=e.clientX-rect.left;gesture.y=e.clientY-rect.top;};
 edge.onpointerup=()=>finishGesture(false);edge.onpointercancel=edge.onlostpointercapture=()=>finishGesture(true);
 window.addEventListener('blur',()=>finishGesture(true));document.addEventListener('visibilitychange',()=>{if(document.hidden)finishGesture(true);});}
(async()=>{try{db=await database();[books,fonts]=await Promise.all([storage('books','getAll'),storage('fonts','getAll')]);const progress=await storage('settings','getAll');for(const item of books){const savedProgress=progress.find(p=>p.id==='progress-'+item.id);if(savedProgress){item.cfi=savedProgress.cfi;item.updated=savedProgress.updated;item.progressSaved=true;}}const saved=await storage('settings','get','preferences');if(saved)prefs={...prefs,...saved};fonts.forEach(addFont);syncSpacingControls();$('font-select').value=prefs.font;$('font-size').value=prefs.size;$('size-value').textContent=`${prefs.size} px`;applyTheme(prefs.theme);refreshLibrary();}catch(error){message('Local storage is unavailable. Allow this site to store data, then refresh.');$('import').disabled=$('empty-import').disabled=true;}})();
















