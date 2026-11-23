const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const electronVersion='45.4.1';
const runtimeSHA256='2ba6223afa9121f42831fefe92c434334907540165294fc56697449d12e7cfe9';
const runtime=path.resolve(process.env.ELECTRON_RUNTIME_ZIP||path.join(root,'.cache',`electron-v${electronVersion}-win32-x64.zip`));
if(!fs.existsSync(runtime))throw Error(`Electron runtime ZIP not found. Place it at ${runtime} or set ELECTRON_RUNTIME_ZIP.`);
if(crypto.createHash('sha256').update(fs.readFileSync(runtime)).digest('hex')!==runtimeSHA256)throw Error(`Official Electron ${electronVersion} Windows x64 runtime required.`);
const folder=path.join(root,'dist',`DeepSeekGirlDesktop-${pkg.version}-win-x64`);
if(!folder.startsWith(path.join(root,'dist')+path.sep))throw Error('Invalid distribution path');
fs.mkdirSync(folder,{recursive:true});
const extraction=spawnSync('tar.exe',['-xf',runtime,'-C',folder],{stdio:'inherit',windowsHide:true});
if(extraction.status!==0)throw Error('Runtime extraction failed');
const application=path.join(folder,'resources/app');fs.mkdirSync(application,{recursive:true});
for(const file of ['main.cjs','preload.cjs','icon.png'])fs.copyFileSync(path.join(root,file),path.join(application,file));
fs.cpSync(path.join(root,'ui'),path.join(application,'ui'),{recursive:true});
fs.copyFileSync(path.join(root,'vendor/React-LICENSE.txt'),path.join(application,'React-LICENSE.txt'));
fs.copyFileSync(path.join(root,'assets/OFL-Xiaolai.txt'),path.join(application,'OFL-Xiaolai.txt'));
fs.copyFileSync(path.join(root,'THIRD_PARTY_NOTICES.md'),path.join(application,'THIRD_PARTY_NOTICES.md'));
const manifest={name:pkg.name,productName:pkg.productName,version:pkg.version,main:pkg.main,private:true};
fs.writeFileSync(path.join(application,'package.json'),JSON.stringify(manifest,null,2)+'\n');
const executable=path.join(folder,'小鲸鱼桌宠.exe');
fs.copyFileSync(path.join(folder,'electron.exe'),executable);fs.unlinkSync(path.join(folder,'electron.exe'));
const png=fs.readFileSync(path.join(root,'icon.png')),ico=Buffer.alloc(22);
ico.writeUInt16LE(1,2);ico.writeUInt16LE(1,4);ico[6]=128;ico[7]=128;ico.writeUInt16LE(1,10);ico.writeUInt16LE(32,12);ico.writeUInt32LE(png.length,14);ico.writeUInt32LE(22,18);
fs.writeFileSync(path.join(folder,'小鲸鱼.ico'),Buffer.concat([ico,png]));
fs.writeFileSync(path.join(folder,'使用说明.txt'),[
 '小鲸鱼桌宠 · 独立离线版 '+pkg.version,'',
 '双击「小鲸鱼桌宠.exe」启动。请保留整个文件夹。','',
 '轻点头部摸摸头，快速点三次会鼓脸。','点身体或右键打开转轮，点旁边的白饭盆喂饭。',
 '按住人物拖动，她会像被拎起后衣领一样悬空，松手后轻轻落地。Ctrl + 滚轮调整大小。','转轮 → 更多 → 变身 Pro，可切换形态。','转轮 → 换衣服，可预览并保存各形态的穿搭。',
 '转轮 → 更多 → 桌面互动，可以跟着光标散步、点泡泡或开启专注陪伴。','互动时点击角色下方的状态按钮可以结束。',
 '转轮 → 更多 → 桌面互动 → 乒乓球。鼠标或左右方向键移动球拍，点击或空格发球，先到 5 分获胜。',
 '转轮下方的心形进度按钮可以查看亲密度、设置称呼。','系统托盘里的小鲸鱼图标支持找回、暂停、选择屏幕、置顶和退出。','',
 '这是离线互动桌宠。变身由菜单手动切换。','亲密度按喂饭和摸头累计，每天最多 14 点，两个形态共用。',
 '设置和进度保存在 %APPDATA%\\DeepSeekGirlDesktop。','',
 '程序使用 Electron 45.4.1，React 19.2.0。第三方许可随程序附带。'
].join('\r\n'),'utf8');
fs.mkdirSync(path.join(root,'.cache'),{recursive:true});
fs.writeFileSync(path.join(root,'.cache/distribution.json'),JSON.stringify({version:pkg.version,folder,executable,runtime:electronVersion,runtimeSHA256},null,2));
console.log(JSON.stringify({packaged:true,version:pkg.version,executable}));
