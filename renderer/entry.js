(() => {
 const {Mascot,DICTIONARIES,CSS,readPrefs,writePrefs,viewport}=window.DeepSeekPet;
 const React=window.React,h=React.createElement;
 const style=document.createElement('style');
 style.textContent=CSS+'\nhtml,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent;font-family:"Microsoft YaHei",sans-serif}.dsg-wardrobe-backdrop,.dsg-finance-backdrop{background:transparent}.dsg-root{-webkit-app-region:no-drag}';
 document.head.appendChild(style);
 const pixel=document.createElement('canvas');pixel.width=pixel.height=1;
 const context=pixel.getContext('2d',{willReadFrequently:true});
 let cursor={x:-1,y:-1},held=false,lastHit;
 function hitsCharacter(character,x,y){
  if(character.getAttribute('aria-disabled')==='true')return false;
  for(const image of character.querySelectorAll('img')){
   const bounds=image.getBoundingClientRect();
   if(!bounds.width||!bounds.height||x<bounds.left||x>=bounds.right||y<bounds.top||y>=bounds.bottom)continue;
   if(!image.complete||!image.naturalWidth)return true;
   const sx=Math.floor((x-bounds.left)/bounds.width*image.naturalWidth),sy=Math.floor((y-bounds.top)/bounds.height*image.naturalHeight);
   try{context.clearRect(0,0,1,1);context.drawImage(image,sx,sy,1,1,0,0,1,1);if(context.getImageData(0,0,1,1).data[3]>24)return true;}catch{return true;}
  }
  return false;
 }
 function updateHit(){
  const element=document.elementFromPoint(cursor.x,cursor.y);
  const control=element?.closest('.dsg-menu,.dsg-greeting,.dsg-wardrobe,.dsg-bond-panel,.dsg-food,.dsg-bubble-target,.dsg-activity-chip,.dsg-pong');
  const character=element?.closest('.dsg-character');
  const hit=held||Boolean(control)||Boolean(character&&hitsCharacter(character,cursor.x,cursor.y));
  if(hit!==lastHit){lastHit=hit;window.desktopPet.hit(hit);}
 }
 window.desktopPet.onCursor(point=>{cursor=point;updateHit();});
 document.addEventListener('pointerdown',event=>{cursor={x:event.clientX,y:event.clientY};updateHit();if(lastHit){held=true;window.desktopPet.capture(true);}},true);
 const release=()=>{held=false;window.desktopPet.capture(false);updateHit();};
 window.addEventListener('pointerup',release);window.addEventListener('pointercancel',release);window.addEventListener('blur',release);
 const observer=new MutationObserver(updateHit);observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','data-form','data-deepseek-girl-state']});
 setInterval(updateHit,80);
 function App(){
  const [form,setForm]=React.useState(()=>readPrefs().desktopForm==='pro'?'pro':'flash');
  React.useEffect(()=>window.desktopPet.onAction(action=>{
   if(action.type==='form')window.dispatchEvent(new CustomEvent('desktop-form',{detail:action.value}));
   if(action.type==='animation')writePrefs({...readPrefs(),animate:action.value});
   if(action.type==='reset'){window.dispatchEvent(new Event('desktop-reset'));writePrefs({...readPrefs(),...viewport({})});window.dispatchEvent(new Event('desktop-dismiss'));}
   if(action.type==='dismiss')window.dispatchEvent(new Event('desktop-dismiss'));
  }),[]);
  React.useEffect(()=>{
   const change=event=>{setForm(event.detail==='pro'?'pro':'flash');writePrefs({...readPrefs(),desktopForm:event.detail==='pro'?'pro':'flash'});};
   window.addEventListener('desktop-form',change);return()=>window.removeEventListener('desktop-form',change);
  },[]);
  React.useEffect(()=>{
   const sync=()=>window.desktopPet.state({form,animate:readPrefs().animate!==false});
   sync();window.addEventListener('deepseek-girl-preferences',sync);return()=>window.removeEventListener('deepseek-girl-preferences',sync);
  },[form]);
  React.useEffect(()=>{window.desktopPet.ready();},[]);
  return h(Mascot,{modelTarget:form,t:key=>DICTIONARIES.zh[key]||key});
 }
 window.ReactDOM.createRoot(document.getElementById('pet')).render(h(App));
})();
