const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {_electron}=require('playwright');
const root=path.resolve(__dirname,'..');
const distribution=JSON.parse(fs.readFileSync(path.join(root,'.cache/distribution.json'),'utf8'));
const profile=path.join(root,'.cache','native-test-'+Date.now());
const proof=path.join(root,'.cache/native-test');fs.mkdirSync(proof,{recursive:true});
async function launch(){
 const env={...process.env,DSG_DESKTOP_TEST:'1'};delete env.ELECTRON_RUN_AS_NODE;
 const app=await _electron.launch({executablePath:distribution.executable,args:['--pet-data-dir='+profile],env,timeout:20000});
 const page=await app.firstWindow();
 return{app,page};
}
(async()=>{
 let app;
 try{
  const first=await launch();app=first.app;const page=first.page,errors=[];
  page.on('pageerror',error=>errors.push(error.stack));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.locator('.dsg-art').waitFor({timeout:15000});
  await page.waitForFunction(()=>document.querySelector('.dsg-character .dsg-clip')?.getAttribute('aria-busy')==='false');
  const properties=await app.evaluate(({BrowserWindow,app})=>{
   const window=BrowserWindow.getAllWindows()[0];
   return{visible:window.isVisible(),topmost:window.isAlwaysOnTop(),frame:window.isMenuBarVisible(),bounds:window.getBounds(),preferences:window.webContents.getLastWebPreferences(),runtime:process.versions.electron,appPath:app.getAppPath()};
  });
  assert.equal(properties.preferences.contextIsolation,true);assert.equal(properties.preferences.nodeIntegration,false);assert.equal(properties.preferences.sandbox,true);
  assert.equal(properties.visible,true);assert.equal(properties.topmost,true);assert.equal(properties.runtime,'45.4.1');
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].focus());
  assert.equal(page.url(),'whale://app/index.html');
  assert.equal(await page.evaluate(()=>typeof require),'undefined');
  const requests=[];page.on('request',request=>{if(/^https?:/.test(request.url()))requests.push(request.url());});
  const start=Date.now();await page.clock.install({time:new Date(start)});await page.clock.pauseAt(new Date(start+1000));
  await page.evaluate(()=>DeepSeekPet.writePrefs({...DeepSeekPet.readPrefs(),greetingsEnabled:false,beggingEnabled:false}));
  if(await page.locator('.dsg-greeting').count())await page.getByRole('button',{name:'关闭问候气泡'}).click();
  const prefs=()=>page.evaluate(()=>DeepSeekPet.readPrefs());
  const tick=async milliseconds=>{await page.clock.runFor(milliseconds);await page.evaluate(()=>{});};
  async function menu(){if(!await page.locator('.dsg-menu').count())await page.locator('.dsg-character').press('Enter');}
  async function choose(label){await menu();let button=page.locator('.dsg-menu').getByRole('button',{name:label,exact:true});if(!await button.count())await page.getByRole('button',{name:'更多',exact:true}).click();await button.click();}
  await app.evaluate(({BrowserWindow,screen,Menu,app})=>{
   const window=BrowserWindow.getAllWindows()[0],set=window.setIgnoreMouseEvents.bind(window);
   window.__mouseCalls=[];window.setIgnoreMouseEvents=(ignore,options)=>{window.__mouseCalls.push(ignore);if(!window.__syntheticOnly)return set(ignore,options);};
   window.__ignorePhysicalMouse=()=>{window.__syntheticOnly=true;set(true,{forward:false});};
   const getCursor=screen.getCursorScreenPoint.bind(screen);screen.getCursorScreenPoint=()=>app.__cursor||getCursor();
   const create=Menu.buildFromTemplate.bind(Menu);Menu.buildFromTemplate=template=>{app.__tray=template;return create(template);};
  });
  async function nativePointer(point,expected){
   await app.evaluate(({BrowserWindow,app},point)=>{const bounds=BrowserWindow.getAllWindows()[0].getBounds();app.__cursor={x:Math.round(bounds.x+point.x),y:Math.round(bounds.y+point.y)};},point);
   await page.waitForTimeout(100);
   const ignored=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].__mouseCalls.at(-1));
   assert.equal(ignored,expected);
  }
  const initial=await page.locator('.dsg-character').boundingBox();
  assert.ok(initial.height>initial.width*1.3,'Flash has space for the full body');
  await nativePointer({x:initial.x+initial.width/2,y:initial.y+initial.height/2},false);
  await nativePointer({x:5,y:5},true);
  await nativePointer({x:initial.x+initial.width*.43,y:initial.y+initial.height*.93},false);
  await nativePointer({x:initial.x+1,y:initial.y+1},true);
  await page.locator('.dsg-root').screenshot({path:path.join(proof,'flash.png'),omitBackground:true});
  await page.locator('.dsg-character').click({position:{x:initial.width*.5,y:initial.height*.3}});
  assert.equal((await prefs()).companion.points,1);assert.equal(await page.locator('.dsg-finance-card').count(),0);
  await page.locator('.dsg-food').click();assert.equal((await prefs()).companion.points,4);
  const flashMealArt = page.locator('.dsg-character .dsg-art[data-state="eating"]');
  await page.waitForFunction(()=>document.querySelector('.dsg-character .dsg-art[data-state="eating"]')?.getAnimations().some(animation=>animation.animationName==='dsg-flash-frames-eating'));
  const mealFrames = await flashMealArt.evaluate(art=>{
   const animation=art.getAnimations().find(item=>item.animationName==='dsg-flash-frames-eating');
   animation.pause();
   return [0,4360,8720].map(start=>[500,1500,2300].map(offset=>{
    animation.currentTime=start+offset;
    const shift=new DOMMatrixReadOnly(getComputedStyle(art).transform).m41;
    return Math.round(-shift/(art.width/10));
   }));
  });
  assert.deepEqual(mealFrames,[[5,6,7],[5,6,7],[5,6,7]],'Each of the three bites shows bowl, spoon at mouth, then chew');
  await tick(13080);await page.locator('.dsg-root[data-deepseek-girl-state="aftermeal"]').waitFor();
  assert.equal(await page.locator('.dsg-character img').count(),1,'Flash has one complete sprite, including during the after-meal action');
  assert.equal(await page.locator('.dsg-food').isDisabled(),true);await tick(3700);await page.locator('.dsg-root[data-deepseek-girl-state="idle"]').waitFor();
  await choose('打开小衣柜');assert.equal(await page.locator('.dsg-outfit .dsg-wardrobe-art').count(),5);await page.locator('[data-outfit-choice="winter-cape"]').click();
  await page.waitForFunction(()=>document.querySelector('.dsg-wear')?.disabled===false);await page.getByRole('button',{name:'就穿这套',exact:true}).click();assert.equal((await prefs()).outfit,'winter-cape');
  const skill=async label=>{await choose('桌面互动');await page.getByRole('button',{name:label,exact:true}).click();};
  await skill('玩点泡泡');
  const bubble=page.getByRole('button',{name:'戳破泡泡'});
  const bubbleBox=await bubble.boundingBox();
  await nativePointer({x:bubbleBox.x+bubbleBox.width/2,y:bubbleBox.y+bubbleBox.height/2},false);
  await nativePointer({x:5,y:5},true);
  for(let popped=0;popped<5;popped++){
   assert.match(await page.locator('.dsg-activity-chip').innerText(),new RegExp(`${popped}/5`));
   await bubble.click();
  }
  assert.match(await page.locator('.dsg-greeting-text').innerText(),/五个泡泡都戳破啦/);
  await skill('跟着光标散步');
  await nativePointer({x:Math.max(5,initial.x-430),y:Math.max(5,initial.y-180)},true);
  await tick(1000);
  await page.locator('.dsg-character .dsg-art[data-state="walking"]').waitFor();
  const walked=await page.locator('.dsg-character').boundingBox();
  assert.ok(walked.x<initial.x-30&&walked.y<initial.y-30,JSON.stringify({initial,walked}));
  await tick(14000);await page.locator('.dsg-activity-chip').waitFor({state:'hidden'});
  const walkSaved=await prefs();assert.ok(walkSaved.x<initial.x-30);
  const walkEnd=await page.locator('.dsg-character').boundingBox();assert.ok(Math.abs(walkEnd.x-walkSaved.x)<1);
  await skill('专注陪伴');
  await page.getByRole('button',{name:'15 分钟',exact:true}).click();
  assert.match(await page.locator('.dsg-activity-chip').innerText(),/15:00/);
  await page.clock.fastForward(15*60*1000);
  assert.match(await page.locator('.dsg-greeting-text').innerText(),/专注时间到啦/);
  await page.getByRole('button',{name:'关闭问候气泡'}).click();
  await skill('和小鲸鱼打乒乓球');
  const pong=page.getByRole('dialog',{name:'鲸鱼乒乓'});
  const court=pong.locator('canvas');
  const table=await court.boundingBox();
  const readPaddle=()=>court.evaluate(canvas=>{
   const pixels=canvas.getContext('2d').getImageData(0,Math.floor(canvas.height*270/304),canvas.width,1).data;
   const xs=[];
   for(let i=0;i<pixels.length;i+=4)if(pixels[i]>248&&pixels[i+1]>=200&&pixels[i+1]<=213&&pixels[i+2]<172)xs.push(i/4);
   return (xs[0]+xs.at(-1))/2;
  });
  const initialPaddle=await readPaddle();
  await court.press('ArrowRight');
  assert.ok(await readPaddle()>initialPaddle+5,'The arrow keys move the actual paddle');
  const aim=ratio=>court.dispatchEvent('pointermove',{clientX:table.x+table.width*ratio,clientY:table.y+table.height*.9});
  await aim(.5);
  assert.ok(Math.abs(await readPaddle()-initialPaddle)<3,'Pointer input moves the paddle back to center');
  await nativePointer({x:table.x+table.width/2,y:table.y+table.height/2},false);
  await nativePointer({x:5,y:5},true);
  await pong.screenshot({path:path.join(proof,'pong.png'),omitBackground:true});
  await court.press('Space');
  assert.equal(await pong.getAttribute('data-pong-mode'),'rally');
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  assert.equal(await pong.getAttribute('data-pong-mode'),'paused');
  await tick(3100);
  assert.equal(await pong.getAttribute('data-pong-mode'),'paused');
  await pong.locator('.dsg-pong-action').click();
  for(let point=1;point<=5;point++){
   if(point>1){await aim(.5);await court.press('Space');}
   await aim(.02);
   await tick(2100);
   assert.equal(await pong.locator('[data-side="whale"] strong').innerText(),String(point));
  }
  assert.equal(await pong.getAttribute('data-pong-mode'),'finished');
  await pong.getByRole('button',{name:'再来一局'}).click();
  assert.equal(await pong.getAttribute('data-pong-mode'),'serve');
  assert.equal(await pong.locator('[data-side="whale"] strong').innerText(),'0');
  await court.press('Escape');await pong.waitFor({state:'hidden'});
  await page.locator('.dsg-character').waitFor();
  // Native hit testing is checked above. Avoid the physical mouse interrupting simulated drags.
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].__ignorePhysicalMouse());
  async function scruffDrag(form, outfit){
   const character=page.locator('.dsg-character');
   const original=await character.boundingBox();
   const start={x:original.x+original.width*.5,y:original.y+original.height*.53};
   const target={x:start.x-120,y:start.y-120};
   const grip=character.locator('.dsg-scruff-grip');
   await page.mouse.move(start.x,start.y);await page.mouse.down();
   assert.equal(await grip.count(),0,'A press by itself does not pick her up');
   await page.mouse.move(target.x,target.y);
   await character.locator(`img[data-state="dragging"][data-outfit="${outfit}"]`).waitFor();
   await tick(200);
   const held=await grip.boundingBox();
   assert.ok(Math.abs(held.x+held.width/2-target.x)<2&&Math.abs(held.y+held.height/2-target.y)<2,'The back collar follows the pointer');
   const pinned=await character.boundingBox();
   await tick(200);
   const steady=await character.boundingBox();
   assert.ok(Math.abs(steady.x-pinned.x)<.1&&Math.abs(steady.y-pinned.y)<.1,'The drag anchor stays put while the pointer is stationary');
   if(form==='flash'){
    const screenHeight=await page.evaluate(()=>innerHeight);
    await page.mouse.move(3,screenHeight-4);await tick(40);
    const edge=await character.boundingBox();
    assert.ok(edge.x>=-.1&&edge.y+edge.height<=screenHeight-31,'The sprite stays on screen at the bottom edge');
    await page.mouse.move(target.x,target.y);await tick(40);
   }
   const beforeRelease=await character.boundingBox();
   await page.mouse.up();
   await character.locator(`img[data-state="drop"][data-outfit="${outfit}"]`).waitFor({timeout:2500});
   assert.equal(await grip.count(),0);
   const landed=await character.boundingBox();
   assert.ok(Math.abs(landed.x-beforeRelease.x)<1&&Math.abs(landed.y-beforeRelease.y)<1,'Release does not jump to another position');
   await tick(420);await character.locator('img[data-state="idle"]').first().waitFor();
  }
  await scruffDrag('flash','winter-cape');
  await choose('变身 Pro 娘');await tick(500);await page.locator('.dsg-morph[data-direction="to-pro"]').waitFor();await tick(2300);
  await page.waitForFunction(()=>document.querySelector('.dsg-root')?.dataset.form==='pro'&&document.querySelector('.dsg-root')?.dataset.transforming==='false');
  await choose('打开小衣柜');await page.locator('[data-outfit-choice="pro-winter-puffer"]').click();await page.waitForFunction(()=>document.querySelector('.dsg-wear')?.disabled===false);await page.getByRole('button',{name:'就穿这套',exact:true}).click();
  assert.equal((await prefs()).proOutfit,'pro-winter-puffer');
  await menu();await page.getByRole('button',{name:'陪伴手账',exact:true}).click();
  await page.locator('#dsg-companion-name').fill('小船长');await page.getByRole('button',{name:'记住这个称呼',exact:true}).click();assert.equal((await prefs()).nickname,'小船长');
  assert.match(await page.locator('.dsg-bond-panel').innerText(),/14 点/);assert.doesNotMatch(await page.locator('.dsg-bond-panel').innerText(),/完成任务/);await page.keyboard.press('Escape');
  await page.locator('.dsg-bond-panel').waitFor({state:'hidden'});
  await scruffDrag('pro','pro-winter-puffer');
  await page.locator('.dsg-character').evaluate(element=>element.dispatchEvent(new WheelEvent('wheel',{ctrlKey:true,deltaY:-100,bubbles:true,cancelable:true})));
  await page.waitForFunction(()=>DeepSeekPet.readPrefs().size===191);
  await choose('暂停动画');await page.waitForFunction(()=>document.querySelector('.dsg-root')?.dataset.motionEnabled==='false');await page.keyboard.press('Escape');
  await page.locator('.dsg-root').screenshot({path:path.join(proof,'pro.png'),omitBackground:true});
  // Tray callbacks operate on the native window and persist app-level settings.
  await app.evaluate(({app})=>app.__tray.find(item=>item.label==='保持置顶').click({checked:false}));
  assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isAlwaysOnTop()),false);
  await page.evaluate(()=>desktopPet.hide());await page.waitForTimeout(50);assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible()),false);
  const duplicateEnv={...process.env,DSG_DESKTOP_TEST:'1'};delete duplicateEnv.ELECTRON_RUN_AS_NODE;
  await new Promise((resolve,reject)=>require('node:child_process').execFile(distribution.executable,['--pet-data-dir='+profile],{env:duplicateEnv,windowsHide:true,timeout:10000},error=>error?reject(error):resolve()));
  await page.waitForTimeout(100);assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().length),1);assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible()),true);
  await page.evaluate(()=>desktopPet.hide());await page.waitForTimeout(50);
  await app.evaluate(({app})=>app.__tray.find(item=>item.label==='显示小鲸鱼').click());await page.waitForTimeout(100);assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible()),true);
  const saved=await prefs();assert.equal(saved.desktopForm,'pro');assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  await app.close();app=null;
  const second=await launch();app=second.app;const reopened=second.page;
  await reopened.locator('.dsg-art').waitFor();
  assert.equal(await reopened.locator('.dsg-root').getAttribute('data-form'),'pro');
  const restored=await reopened.evaluate(()=>DeepSeekPet.readPrefs());
  for(const key of ['outfit','proOutfit','desktopForm','nickname','size','x','y','animate'])assert.equal(restored[key],saved[key],key+' survives reopening');
  assert.equal(restored.companion.points,4);assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isAlwaysOnTop()),false);
  const result={passed:true,runtime:properties.runtime,packagedExecutable:true,noHarnessRuntime:true,stableStorageOrigin:true,singleInstance:true,transparentWindow:true,alphaHitTesting:true,blankClickThrough:true,nativeTray:true,hideShow:true,topmostPersists:true,feedingAndAfterMeal:true,fullBodyBites:3,manualTransformation:true,bothWardrobes:true,fullBodyFlashOutfits:5,walk:true,bubbleGame:true,focusTimer:true,desktopPong:true,nickname:true,affection:true,dragging:true,resize:true,pause:true,reopenPreservesProgress:true,contextIsolation:true,sandbox:true,networkRequests:requests,errors};
  fs.writeFileSync(path.join(proof,'verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
  assert.deepEqual(errors,[]);
 }finally{if(app)await app.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
