const {app,BrowserWindow,Menu,Tray,ipcMain,screen,nativeImage,session,dialog,protocol,net}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

app.setName('小鲸鱼桌宠');
app.setAppUserModelId('io.deepseekgirl.desktop');
protocol.registerSchemesAsPrivileged([{scheme:'whale',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
const testProfile=process.env.DSG_DESKTOP_TEST==='1'&&process.argv.find(arg=>arg.startsWith('--pet-data-dir='));
app.setPath('userData',testProfile?path.resolve(testProfile.slice('--pet-data-dir='.length)):path.join(app.getPath('appData'),'DeepSeekGirlDesktop'));
const configFile=path.join(app.getPath('userData'),'desktop.json');
let config={alwaysOnTop:true};
try{const saved=JSON.parse(fs.readFileSync(configFile,'utf8'));config={displayId:Number.isSafeInteger(saved.displayId)?saved.displayId:undefined,alwaysOnTop:saved.alwaysOnTop!==false};}catch{}
let petWindow,tray,cursorTimer,lastCursor,ignoring=true,hover=false,captured=false,form='flash',animate=true,ready=false;

function saveConfig(){
 fs.mkdirSync(path.dirname(configFile),{recursive:true});
 fs.writeFileSync(configFile+'.new',JSON.stringify(config,null,2));
 fs.renameSync(configFile+'.new',configFile);
}
function sendAction(action){
 if(petWindow&&!petWindow.isDestroyed())petWindow.webContents.send('pet:action',action);
}
function showPet(reset=false){
 if(!petWindow||petWindow.isDestroyed())return;
 lastCursor=undefined;
 petWindow.showInactive();
 if(reset)sendAction({type:'reset'});
 refreshTray();
}
function refreshInput(){
 if(!petWindow||petWindow.isDestroyed())return;
 const next=!captured&&!hover;
 if(next===ignoring)return;
 ignoring=next;
 petWindow.setIgnoreMouseEvents(next,{forward:true});
}
function selectDisplay(displayId,reset=true){
 if(!petWindow||petWindow.isDestroyed())return;
 const display=screen.getAllDisplays().find(item=>item.id===displayId)||screen.getPrimaryDisplay();
 config.displayId=display.id;
 petWindow.setBounds(display.workArea);
 lastCursor=undefined;
 saveConfig();
 if(reset)sendAction({type:'reset'});
 refreshTray();
}
function refreshTray(){
 if(!tray||!petWindow||petWindow.isDestroyed())return;
 const displays=screen.getAllDisplays();
 tray.setContextMenu(Menu.buildFromTemplate([
  {label:petWindow.isVisible()?'暂时藏起来':'显示小鲸鱼',click:()=>{if(petWindow.isVisible())petWindow.hide();else showPet();refreshTray();}},
  {label:'找回小鲸鱼 / 恢复位置',click:()=>showPet(true)},
  {label:form==='pro'?'变回 Flash 小鲸鱼':'变身 Pro 娘',click:()=>{showPet();sendAction({type:'form',value:form==='pro'?'flash':'pro'});}},
  {label:animate?'暂停动画':'开启动画',click:()=>sendAction({type:'animation',value:!animate})},
  {type:'separator'},
  {label:'保持置顶',type:'checkbox',checked:config.alwaysOnTop,click:item=>{config.alwaysOnTop=item.checked;petWindow.setAlwaysOnTop(item.checked,'floating');saveConfig();}},
  {label:'显示在哪个屏幕',submenu:displays.map((display,index)=>({label:`屏幕 ${index+1} · ${display.label||display.size.width+' × '+display.size.height}`,type:'radio',checked:config.displayId===display.id,click:()=>selectDisplay(display.id)}))},
  {type:'separator'},
  {label:'退出小鲸鱼桌宠',click:()=>app.quit()}
 ]));
}
function trusted(event){return petWindow&&!petWindow.isDestroyed()&&event.sender===petWindow.webContents&&event.senderFrame===petWindow.webContents.mainFrame;}

if(!app.requestSingleInstanceLock()){
 app.quit();
}else{
 app.on('second-instance',()=>showPet());
 app.whenReady().then(async()=>{
  Menu.setApplicationMenu(null);
  session.defaultSession.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(_details,callback)=>callback({cancel:true}));
  const uiFiles=new Set(['index.html','entry.js','pet.js','react-runtime.js']);
  protocol.handle('whale',request=>{
   const address=new URL(request.url),file=address.pathname.slice(1);
   if(address.hostname!=='app'||!uiFiles.has(file))return new Response('Not found',{status:404});
   return net.fetch(pathToFileURL(path.join(__dirname,'ui',file)).href);
  });
  const display=screen.getAllDisplays().find(item=>item.id===config.displayId)||screen.getPrimaryDisplay();
  config.displayId=display.id;
  petWindow=new BrowserWindow({
   ...display.workArea,title:'小鲸鱼桌宠',frame:false,transparent:true,backgroundColor:'#00000000',hasShadow:false,
   resizable:false,movable:false,maximizable:false,minimizable:false,fullscreenable:false,skipTaskbar:true,autoHideMenuBar:true,thickFrame:false,show:false,
   icon:path.join(__dirname,'icon.png'),
   webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:true}
  });
  petWindow.setAlwaysOnTop(config.alwaysOnTop,'floating');
  petWindow.setIgnoreMouseEvents(true,{forward:true});
  const localURL='whale://app/index.html';
  petWindow.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  petWindow.webContents.on('will-navigate',(event,url)=>{if(url!==localURL)event.preventDefault();});
  petWindow.on('blur',()=>{captured=false;hover=false;refreshInput();sendAction({type:'dismiss'});});
  petWindow.on('hide',()=>{captured=false;hover=false;refreshInput();});
  ipcMain.on('pet:hit',(event,value)=>{if(!trusted(event)||typeof value!=='boolean')return;hover=value;refreshInput();});
  ipcMain.on('pet:capture',(event,value)=>{if(!trusted(event)||typeof value!=='boolean')return;captured=value;refreshInput();});
  ipcMain.on('pet:hide',event=>{if(trusted(event)){petWindow.hide();refreshTray();}});
  ipcMain.on('pet:quit',event=>{if(trusted(event))app.quit();});
  ipcMain.on('pet:state',(event,value)=>{
   if(!trusted(event)||!value||!['flash','pro'].includes(value.form)||typeof value.animate!=='boolean')return;
   if(form!==value.form||animate!==value.animate){form=value.form;animate=value.animate;refreshTray();}
  });
  ipcMain.on('pet:ready',event=>{
   if(!trusted(event)||ready)return;
   ready=true;petWindow.showInactive();refreshTray();
  });
  const image=nativeImage.createFromPath(path.join(__dirname,'icon.png')).resize({width:20,height:20});
  tray=new Tray(image);tray.setToolTip('小鲸鱼桌宠 · 右键打开菜单');tray.on('double-click',()=>showPet());refreshTray();
  cursorTimer=setInterval(()=>{
   if(!ready||!petWindow||petWindow.isDestroyed()||!petWindow.isVisible())return;
   const cursor=screen.getCursorScreenPoint(),bounds=petWindow.getBounds();
   if(lastCursor&&lastCursor.x===cursor.x&&lastCursor.y===cursor.y)return;
   lastCursor=cursor;
   petWindow.webContents.send('pet:cursor',{x:cursor.x-bounds.x,y:cursor.y-bounds.y});
  },40);
  screen.on('display-removed',()=>selectDisplay(config.displayId));
  screen.on('display-added',refreshTray);
  screen.on('display-metrics-changed',(_event,changed)=>{if(changed.id===config.displayId)selectDisplay(config.displayId,false);});
  await petWindow.loadURL(localURL);
 }).catch(error=>{dialog.showErrorBox('小鲸鱼没有启动成功',error.message);app.quit();});
 app.on('window-all-closed',()=>app.quit());
 app.on('will-quit',()=>{clearInterval(cursorTimer);tray?.destroy();});
}
