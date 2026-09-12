const {spawn}=require('node:child_process');
const http=require('node:http');
const assert=require('node:assert/strict');

const port=Number(process.env.FOLIO_TEST_PORT)||4174;
const server=spawn(process.execPath,['server.cjs'],{
 env:{...process.env,FOLIO_PORT:String(port)},
 stdio:['ignore','pipe','pipe']
});
const output=[];
server.stdout.on('data',chunk=>output.push(chunk.toString()));
server.stderr.on('data',chunk=>output.push(chunk.toString()));

function request(path,method='GET'){
 return new Promise((resolve,reject)=>{
  const request=http.request({host:'127.0.0.1',port,path,method},response=>{
   let body='';
   response.setEncoding('utf8');
   response.on('data',chunk=>body+=chunk);
   response.on('end',()=>resolve({status:response.statusCode,headers:response.headers,body}));
  });
  request.on('error',reject);
  request.end();
 });
}

(async()=>{
 try{
  await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(new Error(output.join('')||'Server did not start')),5000);
   server.stdout.on('data',chunk=>{if(chunk.toString().includes('Folio:')){clearTimeout(timer);resolve();}});
   server.on('exit',code=>{clearTimeout(timer);reject(new Error(`Server exited ${code}: ${output.join('')}`));});
  });
  const [home,dictionary,head,post,malformed,traversal]=await Promise.all([
   request('/'),request('/dictionary/00.json'),request('/','HEAD'),request('/','POST'),request('/%'),request('/%2e%2e/server.cjs')
  ]);
  assert.equal(home.status,200);
  assert.match(home.headers['content-type'],/^text\/html/);
  assert.equal(dictionary.status,200);
  assert.match(dictionary.headers['content-type'],/^application\/json/);
  assert.equal(head.status,200);
  assert.equal(head.body,'');
  assert.equal(post.status,405);
  assert.equal(post.headers.allow,'GET, HEAD');
  assert.equal(malformed.status,400);
  assert.notEqual(traversal.status,200);
  console.log('Static server GET/HEAD/MIME/method/path checks passed');
 }finally{
  if(!server.killed)server.kill();
  await new Promise(resolve=>server.once('close',resolve));
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
