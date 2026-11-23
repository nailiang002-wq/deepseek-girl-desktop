const {contextBridge,ipcRenderer}=require('electron');
function listen(channel,callback){
 const handler=(_event,value)=>callback(value);
 ipcRenderer.on(channel,handler);
 return()=>ipcRenderer.removeListener(channel,handler);
}
contextBridge.exposeInMainWorld('desktopPet',{
 ready:()=>ipcRenderer.send('pet:ready'),
 hit:value=>ipcRenderer.send('pet:hit',Boolean(value)),
 capture:value=>ipcRenderer.send('pet:capture',Boolean(value)),
 hide:()=>ipcRenderer.send('pet:hide'),
 quit:()=>ipcRenderer.send('pet:quit'),
 state:value=>ipcRenderer.send('pet:state',value),
 onAction:callback=>listen('pet:action',callback),
 onCursor:callback=>listen('pet:cursor',callback)
});
