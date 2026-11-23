const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const json=name=>JSON.parse(read(name));
const strip=source=>source.replace(/\bexport /g,'');
const pro=json('assets/pro.json');
const afterMeal=json('assets/after-meal.json');
const flashOutfits=['maid','hoodie','pajamas','winter-puffer','winter-cape'];
const flashArt=json('assets/flash-redraw/timelines.json');
const flashData=file=>'data:image/webp;base64,'+fs.readFileSync(path.join(root,'assets/flash-redraw',file)).toString('base64');
const scruffData=file=>'data:image/webp;base64,'+fs.readFileSync(path.join(root,'assets/scruff',file)).toString('base64');
const flashTimelines=Object.fromEntries(Object.entries(flashArt.states).map(([state,definition])=>{
 const frames=Array.from({length:definition.repeat??1},()=>definition.frames).flat();
 const delays=frames.map(([,delay])=>delay);
 const sequence=frames.map(([pose])=>flashArt.poses.indexOf(pose));
 const duration=delays.reduce((total,delay)=>total+delay,0);
 const animated=new Set(sequence).size>1;
 const still=definition.still??frames[0][0];
 if(sequence.some(index=>index<0)||!flashArt.poses.includes(still))throw Error('Unknown Flash pose in '+state);
 if(state!=='walking'&&duration!==(state==='aftermeal'?afterMeal.pro.duration:pro[state].duration))throw Error('Flash timeline duration changed: '+state);
 return [state,{count:animated?flashArt.poses.length:1,sequence,delays,duration,loop:definition.loop,still,animationName:'dsg-flash-frames-'+state}];
}));
const placeholders={
 FLASH_TIMELINES:JSON.stringify(flashTimelines),FLASH_ART:JSON.stringify(Object.fromEntries(flashOutfits.map(outfit=>[outfit,{
  strip:flashData(outfit+'/strip.webp'),poses:Object.fromEntries(flashArt.poses.map(pose=>[pose,flashData(outfit+'/'+pose+'.webp')]))
 }]))),
 SCRUFF_ART:JSON.stringify(Object.fromEntries(Object.entries(json('assets/scruff/grips.json')).map(([outfit,grip])=>[outfit,{
  grip,lift:scruffData(outfit+'-lift.webp'),land:scruffData(outfit+'-land.webp')
 }]))),
 PRO_ASSETS:JSON.stringify(pro),PRO_OUTFIT_ASSETS:JSON.stringify(json('assets/pro-outfits.json')),
 AFTER_MEAL_ASSETS:JSON.stringify(Object.fromEntries(Object.entries(afterMeal).filter(([id])=>id.startsWith('pro')))),PROPS:JSON.stringify(json('assets/props.json')),
 GREETING_FONT:'data:font/woff2;base64,'+fs.readFileSync(path.join(root,'assets/greeting-hand.woff2')).toString('base64'),
 LOGIC:strip(read('renderer/logic.js')),COMPANION:strip(read('renderer/companion.js')),
 MODEL_FORM:strip(read('renderer/model-form.js')),PRO_MOTION:strip(read('renderer/pro-motion.js')),
 ACTIVITIES:strip(read('renderer/activities.js')),
 PONG:strip(read('renderer/pong.js')),PONG_CSS:read('renderer/pong.css')
};
const proTimelines=Object.entries({...pro,aftermeal:afterMeal.pro}).map(([state,asset])=>['dsg-frames-'+state,asset]);
const animatedFlash=Object.values(flashTimelines).filter(asset=>asset.count>1).map(asset=>[asset.animationName,asset]);
placeholders.SPRITE_CSS=[...proTimelines,...animatedFlash].map(([name,asset])=>{
 let elapsed=0;
 const sequence=asset.delays.map((delay,index)=>{const point=`${(elapsed/asset.duration*100).toFixed(6)}%{transform:translate3d(${(-asset.sequence[index]/asset.count*100).toFixed(6)}%,0,0)}`;elapsed+=delay;return point;});
 const finalIndex=asset.loop?asset.sequence[0]:asset.sequence.at(-1);
 sequence.push(`100%{transform:translate3d(${(-finalIndex/asset.count*100).toFixed(6)}%,0,0)}`);
 return `@keyframes ${name}{${sequence.join('')}}`;
}).join('\n');
const source=read('renderer/pet.template.js').replace(/__([A-Z_]+)__/g,(_match,key)=>{if(!(key in placeholders))throw Error('Unknown renderer placeholder '+key);return placeholders[key];});
fs.mkdirSync(path.join(root,'ui'),{recursive:true});
fs.writeFileSync(path.join(root,'ui/pet.js'),'(function(){\n'+source+'\n})();\n');
fs.copyFileSync(path.join(root,'renderer/entry.js'),path.join(root,'ui/entry.js'));
const files={react:'react.production.js',scheduler:'scheduler.production.js','react-dom':'react-dom.production.js','react-dom/client':'react-dom-client.production.js'};
const runtime=['(function(){const modules={};const process={env:{NODE_ENV:"production"}};function require(name){if(!(name in modules))throw Error("Unknown runtime module "+name);return modules[name];}'];
for(const [name,file]of Object.entries(files))runtime.push(`modules[${JSON.stringify(name)}]=(function(){const module={exports:{}};const exports=module.exports;\n${read('vendor/'+file)}\nreturn module.exports;})();`);
runtime.push('window.React=modules.react;window.ReactDOM=modules["react-dom/client"];})();');
fs.writeFileSync(path.join(root,'ui/react-runtime.js'),runtime.join('\n'));
console.log(JSON.stringify({built:true,version:json('package.json').version,rendererBytes:Buffer.byteLength(source),standalone:true}));
