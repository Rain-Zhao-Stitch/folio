const fs=require('node:fs');const crypto=require('node:crypto');
// Parse quoted CSV fields without loading parser dependencies at reader runtime.
const input=fs.readFileSync('dictionary-source/ecdict.csv','utf8');
const buckets=Array.from({length:256},()=>Object.create(null));let fields=[],field='',quoted=false,header,count=0;
function row(){if(!header){header=fields;return;}const record=Object.fromEntries(header.map((key,i)=>[key,fields[i]||'']));if(!record.word||!record.translation)return;const word=record.word.toLowerCase().trim();let hash=2166136261;for(const c of word)hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;buckets[hash&255][word]=[record.translation.replace(/\\n/g,'\n'),record.pos,record.exchange,record.definition.replace(/\\n/g,'\n')];count++;}
for(let i=0;i<input.length;i++){const c=input[i];if(c==='"'){if(quoted&&input[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){fields.push(field);field='';}else if(c==='\n'&&!quoted){fields.push(field.replace(/\r$/,''));row();fields=[];field='';}else field+=c;}
if(field||fields.length){fields.push(field);row();}
for(let i=0;i<256;i++)fs.writeFileSync(`dist/dictionary/${i.toString(16).padStart(2,'0')}.json`,JSON.stringify(buckets[i]));
fs.writeFileSync('dist/dictionary/manifest.json',JSON.stringify({name:'ECDICT',entries:count,source:'https://github.com/skywind3000/ECDICT',license:'MIT',sourceSHA256:crypto.createHash('sha256').update(input).digest('hex'),languages:['en','zh-CN']},null,2));
console.log('Prepared local English–Chinese dictionary entries:',count);

