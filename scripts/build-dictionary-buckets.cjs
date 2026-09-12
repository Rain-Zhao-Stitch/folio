'use strict';
const fs=require('node:fs');
const path=require('node:path');

const directory=path.resolve(__dirname,'..','dist','dictionary');
const sources=fs.readdirSync(directory).filter(name=>/^[0-9a-f]{2}\.json$/.test(name)).sort();
if(sources.length!==256)throw new Error(`Expected 256 dictionary buckets, found ${sources.length}`);
for(const name of sources){
 const key=name.slice(0,2),json=fs.readFileSync(path.join(directory,name),'utf8');JSON.parse(json);
 const safe=json.replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
 fs.writeFileSync(path.join(directory,key+'.js'),`'use strict';globalThis.__FolioDictionaryBuckets??=Object.create(null);globalThis.__FolioDictionaryBuckets[${JSON.stringify(key)}]=${safe};\n`);
}
console.log(`Built ${sources.length} script-loadable dictionary buckets.`);
