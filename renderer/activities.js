const BUBBLE_COUNT = 5;
const FOCUS_MINUTES = [15, 25, 45];
const WALK_DURATION = 15000;

function activityPosition(box, count) {
  const offsets = [[64, -20], [140, 55], [85, 126], [194, 9], [125, 93]];
  const [distance, rise] = offsets[count];
  const useLeft = box.x > window.innerWidth - box.x - box.width;
  const x = useLeft ? box.x - distance - 42 : box.x + box.width + distance;
  return {
    left: clamp(x, 8, Math.max(8, window.innerWidth - 58)),
    top: clamp(box.y + box.height * .46 - rise, 8, Math.max(8, window.innerHeight - 58)),
  };
}

function useDesktopActivities(root, box, savePosition, onComplete) {
  const [activity, setActivity] = React.useState(null);
  const [moving, setMoving] = React.useState(false);
  const [seconds, setSeconds] = React.useState(0);
  const cursor = React.useRef(null);
  const active = React.useRef(null);
  const walk = React.useRef(null);

  function select(next) {
    active.current = next;
    setActivity(next);
  }

  function stop(rememberPosition = true) {
    const position = walk.current;
    walk.current = null;
    setMoving(false);
    if (position?.moved && rememberPosition) savePosition(position);
    select(null);
  }

  function start(kind, minutes) {
    if (walk.current) stop();
    if (kind === 'focus') {
      setSeconds(minutes * 60);
      select({kind, deadline: Date.now() + minutes * 60000});
    } else if (kind === 'walk') {
      select({kind, deadline: Date.now() + WALK_DURATION});
    } else if (kind === 'bubbles') {
      select({kind, count: 0});
    } else {
      select({kind});
    }
  }

  function pop() {
    const game = active.current;
    if (game?.kind !== 'bubbles') return;
    if (game.count + 1 === BUBBLE_COUNT) {
      stop();
      onComplete('bubbles');
    } else {
      select({...game, count: game.count + 1});
    }
  }

  React.useEffect(() => window.desktopPet.onCursor(point => { cursor.current = point; }), []);

  React.useLayoutEffect(() => {
    if (activity?.kind !== 'walk') return;
    const node = root.current;
    const position = {x: box.x, y: box.y, width: box.width, height: box.height, moved: false};
    walk.current = position;
    let previous = performance.now();
    let frame;
    let wasMoving = false;

    function advance(now) {
      if (active.current !== activity) return;
      const elapsed = Math.min(.06, (now - previous) / 1000);
      previous = now;
      const point = cursor.current;
      let nowMoving = false;
      if (point && point.x >= 0 && point.x < window.innerWidth && point.y >= 0 && point.y < window.innerHeight) {
        const dx = point.x - position.x - box.width / 2;
        const dy = point.y - position.y - box.height * .55;
        const distance = Math.hypot(dx, dy);
        const beyond = distance - Math.max(box.width / 2, box.height * .55) - 48;
        if (beyond > 0) {
          const step = Math.min(beyond, elapsed * Math.min(390, beyond * 4));
          const x = clamp(position.x + dx / distance * step, 0, Math.max(0, window.innerWidth - box.width));
          const y = clamp(position.y + dy / distance * step, 0, Math.max(0, window.innerHeight - box.height - 32));
          if (Math.abs(position.x - x) + Math.abs(position.y - y) > .03) {
            Object.assign(position, {x, y, moved: true});
            node.style.translate = `${x - box.x}px ${y - box.y}px`;
            nowMoving = true;
          }
        }
      }
      if (wasMoving !== nowMoving) {
        wasMoving = nowMoving;
        setMoving(nowMoving);
      }
      frame = requestAnimationFrame(advance);
    }

    const timer = setTimeout(stop, Math.max(0, activity.deadline - Date.now()));
    frame = requestAnimationFrame(advance);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      node.style.translate = '';
      walk.current = null;
    };
  }, [activity?.kind === 'walk']);

  React.useEffect(() => {
    if (activity?.kind !== 'focus') return;
    function update() {
      if (active.current !== activity) return;
      const remaining = Math.max(0, Math.ceil((activity.deadline - Date.now()) / 1000));
      setSeconds(remaining);
      if (remaining === 0) {
        stop();
        onComplete('focus');
      }
    }
    const tick = setInterval(update, 250);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('focus', update);
    update();
    return () => {
      clearInterval(tick);
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('focus', update);
    };
  }, [activity]);

  React.useEffect(() => {
    function clearWalk(rememberPosition = true) {
      if (active.current?.kind === 'walk') stop(rememberPosition);
    }
    const resize = () => clearWalk();
    const reset = () => clearWalk(false);
    const visibility = () => { if (document.hidden) clearWalk(); };
    window.addEventListener('resize', resize);
    window.addEventListener('desktop-reset', reset);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('desktop-reset', reset);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);

  const countdown = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  return {activity, moving, countdown, start, stop, pop};
}
