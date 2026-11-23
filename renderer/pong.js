const PONG_WIDTH = 448;
const PONG_HEIGHT = 304;
const PONG_EDGE = 22;
const PONG_TOP = 93;
const PONG_BOTTOM = 270;
const PONG_PLAYER_PADDLE = 94;
const PONG_WHALE_PADDLE = 78;
const PONG_WIN_SCORE = 5;
const PONG_BALL_RADIUS = 5;

function pongAim(x, paddle = PONG_PLAYER_PADDLE) {
  return clamp(x, PONG_EDGE + paddle / 2, PONG_WIDTH - PONG_EDGE - paddle / 2);
}

function newPongMatch() {
  return {
    mode: 'serve', player: 0, whale: 0, lastPoint: null, returns: 0,
    playerX: PONG_WIDTH / 2, whaleX: PONG_WIDTH / 2, ball: null, swing: 0,
  };
}

function servePong(match) {
  const direction = (match.player + match.whale) % 2 ? -1 : 1;
  match.ball = {x: match.playerX, y: PONG_BOTTOM - 12, vx: 65 * direction, vy: -236};
  match.mode = 'rally';
  match.lastPoint = null;
  match.returns = 0;
}

function scorePong(match, side) {
  match[side]++;
  match.lastPoint = side;
  match.mode = match[side] === PONG_WIN_SCORE ? 'finished' : 'serve';
  match.ball = null;
  match.swing = 0;
}

function bouncePong(ball, x, width, sign, returns) {
  const offset = clamp((ball.x - x) / (width / 2), -1, 1);
  const angle = offset * .85;
  const speed = Math.min(420, 252 + returns * 11);
  ball.vx = Math.sin(angle) * speed;
  ball.vy = Math.cos(angle) * speed * sign;
}

function stepPong(match, seconds, direction) {
  const ball = match.ball;
  if (direction) match.playerX = pongAim(match.playerX + direction * 405 * seconds);
  match.swing = Math.max(0, match.swing - seconds);

  // The whale follows the incoming ball with a limited reach, leaving corner shots open.
  const opponentAim = ball.vy < 0 ? ball.x + Math.sin(match.returns * 1.9 + match.player * 1.6 + .55) * 23 : PONG_WIDTH / 2;
  const opponentSpeed = ball.vy < 0 ? Math.min(230, 172 + match.returns * 3) : 102;
  match.whaleX = pongAim(match.whaleX + clamp(opponentAim - match.whaleX, -opponentSpeed * seconds, opponentSpeed * seconds), PONG_WHALE_PADDLE);

  const previousY = ball.y;
  ball.x += ball.vx * seconds;
  ball.y += ball.vy * seconds;
  const left = PONG_EDGE + PONG_BALL_RADIUS;
  const right = PONG_WIDTH - left;
  if (ball.x < left || ball.x > right) {
    ball.x = ball.x < left ? left * 2 - ball.x : right * 2 - ball.x;
    ball.vx = -ball.vx;
  }

  const whaleLine = PONG_TOP + PONG_BALL_RADIUS + 3;
  if (ball.vy < 0 && previousY >= whaleLine && ball.y <= whaleLine && Math.abs(ball.x - match.whaleX) <= PONG_WHALE_PADDLE / 2 + PONG_BALL_RADIUS) {
    ball.y = whaleLine;
    match.swing = .23;
    bouncePong(ball, match.whaleX, PONG_WHALE_PADDLE, 1, match.returns);
  }

  const playerLine = PONG_BOTTOM - PONG_BALL_RADIUS - 3;
  if (ball.vy > 0 && previousY <= playerLine && ball.y >= playerLine && Math.abs(ball.x - match.playerX) <= PONG_PLAYER_PADDLE / 2 + PONG_BALL_RADIUS) {
    ball.y = playerLine;
    match.returns++;
    bouncePong(ball, match.playerX, PONG_PLAYER_PADDLE, -1, match.returns);
  }

  if (ball.y < PONG_TOP - 21) scorePong(match, 'player');
  if (ball.y > PONG_HEIGHT + PONG_BALL_RADIUS) scorePong(match, 'whale');
}

function paintPongCourt(canvas, match, art) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(canvas.width / PONG_WIDTH, 0, 0, canvas.height / PONG_HEIGHT, 0, 0);

  function rounded(x, y, width, height, radius, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fill();
  }

  const sky = ctx.createLinearGradient(0, 0, 0, PONG_HEIGHT);
  sky.addColorStop(0, '#e9f5fc');
  sky.addColorStop(.46, '#d8eaf5');
  sky.addColorStop(1, '#c7dfef');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, PONG_WIDTH, PONG_HEIGHT);
  ctx.strokeStyle = '#84b3ca42';
  ctx.lineWidth = 1.5;
  for (const [x, y] of [[24, 36], [87, 55], [346, 47], [392, 23], [374, 64]]) {
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  const cheerful = match.swing > 0 || match.lastPoint === 'whale';
  const portrait = cheerful && art.celebrate.naturalWidth ? art.celebrate : art.idle;
  if (portrait.complete && portrait.naturalWidth) {
    const height = art.pro ? 160 : 116;
    const width = height * portrait.naturalWidth / portrait.naturalHeight;
    const y = art.pro ? -5 : 6;
    ctx.drawImage(portrait, match.whaleX - width / 2, y - (match.swing > 0 ? 3 : 0), width, height);
  }

  rounded(PONG_EDGE - 7, 86, PONG_WIDTH - 2 * PONG_EDGE + 14, 203, 13, '#648eaa');
  rounded(PONG_EDGE - 7, 77, PONG_WIDTH - 2 * PONG_EDGE + 14, 204, 13, '#315e83');
  const table = ctx.createLinearGradient(0, 79, 0, 281);
  table.addColorStop(0, '#487ba3');
  table.addColorStop(1, '#3c708e');
  rounded(PONG_EDGE - 2, 82, PONG_WIDTH - 2 * PONG_EDGE + 4, 194, 8, table);
  ctx.strokeStyle = '#e5f4f2a0';
  ctx.lineWidth = 1.4;
  ctx.strokeRect(PONG_EDGE + 4, 87, PONG_WIDTH - 2 * (PONG_EDGE + 4), 183);
  ctx.fillStyle = '#d6e9f359';
  ctx.fillRect(PONG_WIDTH / 2 - .6, 87, 1.2, 183);

  const netY = 176;
  rounded(PONG_EDGE - 3, netY - 5, PONG_WIDTH - 2 * PONG_EDGE + 6, 10, 3, '#274e70');
  ctx.fillStyle = '#b7d9ecb8';
  for (let x = PONG_EDGE + 1; x < PONG_WIDTH - PONG_EDGE; x += 7) ctx.fillRect(x, netY - 3, 1, 6);
  ctx.fillRect(PONG_EDGE - 3, netY - 5, PONG_WIDTH - 2 * PONG_EDGE + 6, 1.6);
  rounded(PONG_EDGE - 7, netY - 9, 6, 18, 2, '#e3f2f9');
  rounded(PONG_WIDTH - PONG_EDGE + 1, netY - 9, 6, 18, 2, '#e3f2f9');

  function paddle(x, y, width, color) {
    rounded(x - width / 2, y - 1, width, 8, 4, '#24446187');
    rounded(x - width / 2, y - 4, width, 7, 3.5, color);
    rounded(x - width / 2 + 4, y - 3, width - 8, 1.4, .7, '#ffffff85');
  }

  paddle(match.whaleX, PONG_TOP, PONG_WHALE_PADDLE, '#9edcea');
  paddle(match.playerX, PONG_BOTTOM, PONG_PLAYER_PADDLE, '#ffd0a0');

  const ball = match.ball ?? {x: match.playerX, y: PONG_BOTTOM - 12, vx: 0, vy: 0};
  if (match.mode === 'rally') {
    ctx.strokeStyle = '#fff8ea85';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ball.x - ball.vx * .035, ball.y - ball.vy * .035);
    ctx.lineTo(ball.x, ball.y);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, PONG_BALL_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = '#fffbeb';
  ctx.fill();
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = '#d89f67';
  ctx.stroke();
}

function usePongCourt(canvas, idle, celebrate, pro) {
  const controls = React.useRef(null);
  const [view, setView] = React.useState(() => newPongMatch());

  React.useLayoutEffect(() => {
    const court = canvas.current;
    const pixelRatio = Math.min(2.5, window.devicePixelRatio || 1);
    court.width = Math.round(PONG_WIDTH * pixelRatio);
    court.height = Math.round(PONG_HEIGHT * pixelRatio);
    const art = {idle: new Image(), celebrate: new Image(), pro};
    const keys = new Set();
    let match = newPongMatch();
    let frame = 0;
    let previous = null;

    const render = () => paintPongCourt(court, match, art);
    const publish = () => { setView({...match}); render(); };

    function update(now) {
      if (match.mode !== 'rally') return;
      let elapsed = previous === null ? 0 : Math.min(.05, (now - previous) / 1000);
      previous = now;
      const direction = Number(keys.has('ArrowRight')) - Number(keys.has('ArrowLeft'));
      while (elapsed > 0 && match.mode === 'rally') {
        const step = Math.min(elapsed, 1 / 120);
        stepPong(match, step, direction);
        elapsed -= step;
      }
      if (match.mode === 'rally') {
        render();
        frame = requestAnimationFrame(update);
      } else {
        keys.clear();
        publish();
      }
    }

    function pause() {
      keys.clear();
      if (match.mode !== 'rally') return;
      cancelAnimationFrame(frame);
      match.mode = 'paused';
      publish();
    }

    function action() {
      if (match.mode === 'rally') return;
      if (match.mode === 'finished') {
        match = newPongMatch();
        publish();
        return;
      }
      if (match.mode === 'serve') servePong(match);
      else match.mode = 'rally';
      previous = null;
      publish();
      frame = requestAnimationFrame(update);
    }

    function aim(x) {
      if (match.mode === 'finished' || match.mode === 'paused') return;
      match.playerX = pongAim(x);
      if (match.mode === 'serve') render();
    }

    controls.current = {
      action, pause, aim,
      keyDown(key) {
        keys.add(key);
        if (match.mode === 'serve') aim(match.playerX + (key === 'ArrowLeft' ? -22 : 22));
      },
      keyUp: key => keys.delete(key),
      release: () => keys.clear(),
    };
    art.idle.onload = render;
    art.celebrate.onload = render;
    art.idle.src = idle;
    art.celebrate.src = celebrate;
    window.addEventListener('blur', pause);
    const visibility = () => { if (document.hidden) pause(); };
    document.addEventListener('visibilitychange', visibility);
    publish();

    return () => {
      cancelAnimationFrame(frame);
      art.idle.onload = art.celebrate.onload = null;
      controls.current = null;
      window.removeEventListener('blur', pause);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [idle, celebrate, pro]);

  return {view, controls};
}

function PongGame({anchor, outfit, onClose}) {
  const canvas = React.useRef(null);
  const pro = isProOutfit(outfit);
  const {view, controls} = usePongCourt(canvas, assetFor(outfit, 'idle').still, assetFor(outfit, 'success').still, pro);
  React.useEffect(() => { canvas.current?.focus({preventScroll: true}); }, []);

  const width = Math.min(482, window.innerWidth - 24, Math.max(264, (window.innerHeight - 146) * 1.37));
  const left = anchor.x >= width + 24 ? anchor.x - width - 12 : window.innerWidth - anchor.x - anchor.width >= width + 24
    ? anchor.x + anchor.width + 12 : (window.innerWidth - width) / 2;
  const rallying = view.mode === 'rally';
  const finished = view.mode === 'finished';
  const paused = view.mode === 'paused';
  const message = finished ? (view.player === PONG_WIN_SCORE ? '你赢了！' : '小鲸鱼赢啦！') : paused ? '比赛暂停' :
    view.lastPoint === 'player' ? '你得分了' : view.lastPoint === 'whale' ? '小鲸鱼得分' : '准备发球';
  const actionLabel = finished ? '再来一局' : paused ? '继续比赛' : view.lastPoint ? '发下一球' : '发球';

  function action() {
    controls.current?.action();
    canvas.current?.focus({preventScroll: true});
  }

  function point(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    controls.current?.aim((event.clientX - rect.left) * PONG_WIDTH / rect.width);
  }

  return h('section',{className:'dsg-pong',role:'dialog','aria-labelledby':'dsg-pong-title',style:{left,width},
    'data-pong-mode':view.mode,onKeyDown:event=>{if(event.key==='Escape'){event.preventDefault();onClose();}}},
    h('header',{className:'dsg-pong-header'},
      h('h2',{id:'dsg-pong-title'},'鲸鱼乒乓'),
      h('div',{className:'dsg-pong-tools'},
        h('button',{type:'button',className:'dsg-pong-tool',disabled:!rallying&&!paused,
          'aria-label':paused?'继续比赛':'暂停比赛',title:paused?'继续比赛':'暂停比赛',onClick:paused?action:()=>controls.current?.pause()},
          h(WheelIcon,{name:paused?'play':'pause'})),
        h('button',{type:'button',className:'dsg-pong-tool','aria-label':'关闭乒乓球',title:'关闭乒乓球',onClick:onClose},h(WheelIcon,{name:'close'})))),
    h('div',{className:'dsg-pong-score','aria-live':'polite','aria-atomic':true},
      h('span',{className:'dsg-pong-side','data-side':'player'},h('i',{'aria-hidden':true}),'你',h('strong',null,view.player)),
      h('span',{className:'dsg-pong-goal'},'先到 5 分'),
      h('span',{className:'dsg-pong-side','data-side':'whale'},h('strong',null,view.whale),'小鲸鱼',h('i',{'aria-hidden':true}))),
    h('div',{className:'dsg-pong-field'},
      h('canvas',{ref:canvas,className:'dsg-pong-court',tabIndex:0,'aria-label':'球桌，左右方向键控制球拍，空格发球',
        onPointerMove:point,onPointerDown:event=>{point(event);event.currentTarget.focus({preventScroll:true});},
        onClick:()=>{if(!rallying)action();},onBlur:()=>controls.current?.release(),
        onKeyDown:event=>{
          if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();controls.current?.keyDown(event.key);}
          else if(event.code==='Space'&&!event.repeat){event.preventDefault();action();}
        },onKeyUp:event=>controls.current?.keyUp(event.key)}),
      !rallying&&h('div',{className:'dsg-pong-message'},
        h('span',{role:'status'},message),h('button',{type:'button',className:'dsg-pong-action',onClick:action},actionLabel))),
    h('p',{className:'dsg-pong-hint'},'鼠标或 ← → 移动球拍 · 点击或空格发球'));
}
