const {spawn,spawnSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
async function ready(){try{const response=await fetch('http://127.0.0.1:4173',{signal:AbortSignal.timeout(1000)});return response.ok&&(await response.text()).includes('Folio');}catch{return false;}}
(async()=>{
 let server;
 try{
  if(!await ready()){
   server=spawn(process.execPath,['server.cjs'],{cwd:root,stdio:'inherit',windowsHide:true,env:{...process.env,FOLIO_PORT:'4173'}});
   let running=false;for(let i=0;i<40;i++){if(server.exitCode!==null)break;if(await ready()){running=true;break;}await new Promise(resolve=>setTimeout(resolve,250));}
   if(!running)throw new Error('The local Folio server did not become ready.');
  }
  const tests=['verify.cjs',...fs.readdirSync(root).filter(file=>/^verify-.*\.cjs$/.test(file)).sort()],failed=[];
  for(const test of tests){console.log('\nRUN '+test);const result=spawnSync(process.execPath,[test],{cwd:root,stdio:'inherit',windowsHide:true});if(result.status!==0)failed.push(test);}
  console.log('\n'+(tests.length-failed.length)+'/'+tests.length+' validation scripts passed.');
  if(failed.length){console.error('Failed: '+failed.join(', '));process.exitCode=1;}
 }finally{if(server&&server.exitCode===null)server.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});
