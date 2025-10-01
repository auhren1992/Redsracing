// Jonny Kids Edition interactivity
// Handles Speed Lab (gas/brake/nitro + sounds + trail), Sticker Garage drag/drop, and Rookie Quiz

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

function initSpeedLab() {
  // simple Web Audio context for nitro/brake effects
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let ctx = null;
  const ensureCtx = () => (ctx ||= new AudioCtx());

  const playTone = (freqStart, freqEnd, durationMs, type='sawtooth', volume=0.08) => {
    try {
      const c = ensureCtx();
      const now = c.currentTime;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freqStart, now);
      osc.frequency.linearRampToValueAtTime(freqEnd, now + durationMs/1000);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs/1000);
      osc.connect(gain).connect(c.destination);
      osc.start(now);
      osc.stop(now + durationMs/1000);
    } catch {}
  };
  const needle = document.getElementById('kids-needle');
  const speedVal = document.getElementById('speed-val');
  const gas = document.getElementById('gas');
  const brake = document.getElementById('brake');
  const nitro = document.getElementById('nitro');
  const muteBtn = document.getElementById('mute');
  const lab = document.getElementById('speed-lab');

  let speed = 0; // 0-100
  let gasDown = false;
  let brakeDown = false;
  let muted = false;
  let nitroCooldown = false;

  // Audio
  const idle = new Audio('assets/audio/idle.mp3');
  const rev = new Audio('assets/audio/rev.mp3');
  idle.loop = true; rev.loop = false;
  idle.volume = 0.35; rev.volume = 0.5;
  const playSafe = (a) => { try { if (!muted) a.currentTime = 0, a.play(); } catch(e) {} };
  const stopSafe = (a) => { try { a.pause(); a.currentTime = 0; } catch(e) {} };

  const updateUI = () => {
    if (needle) {
      const deg = -90 + (speed * 1.8); // -90..+90
      needle.style.transform = `rotate(${deg}deg)`;
    }
    if (speedVal) speedVal.textContent = String(Math.round(speed));
    if (lab) {
      if (speed >= 80) lab.classList.add('speed-trail'); else lab.classList.remove('speed-trail');
    }
  };

  // Main loop
  const tick = () => {
    const accel = gasDown ? 0.9 : 0;
    const decel = brakeDown ? 2.0 : 0.25; // natural drag
    speed = clamp(speed + accel - decel, 0, 100);
    updateUI();
    // audio
    if (gasDown && speed > 5) playSafe(rev);
    if (!gasDown && speed < 5) stopSafe(rev);
    if (!muted && speed > 0 && idle.paused) playSafe(idle);
    if ((muted || speed === 0) && !idle.paused) stopSafe(idle);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  // Pointer helpers
  const onHold = (btn, set) => {
    btn.addEventListener('pointerdown', () => { set(true); btn.setPointerCapture?.(event.pointerId); });
    btn.addEventListener('pointerup',   () => set(false));
    btn.addEventListener('pointerleave',() => set(false));
    btn.addEventListener('pointercancel',() => set(false));
  };
  onHold(gas, v => gasDown = v);
  onHold(brake, v => {
    brakeDown = v;
    if (v) {
      // brake sound: descending pitch blip
      playTone(600, 180, 180, 'square', 0.08);
    }
  });

  nitro.addEventListener('click', () => {
    // nitro sound: quick rising pitch
    playTone(220, 880, 450, 'sawtooth', 0.12);
    if (nitroCooldown) return;
    nitroCooldown = true;
    speed = clamp(speed + 25, 0, 100);
    lab?.classList.add('nitro-flash');
    setTimeout(()=> lab?.classList.remove('nitro-flash'), 600);
    setTimeout(()=> nitroCooldown = false, 2000);
    playSafe(rev);
  });

  muteBtn.addEventListener('click', () => {
    muted = !muted;
    muteBtn.setAttribute('aria-pressed', String(!muted ? false : true));
    muteBtn.innerHTML = muted ? '<i class="fas fa-volume-mute mr-2"></i>Sound: Off' : '<i class="fas fa-volume-up mr-2"></i>Sound: On';
    if (muted) { stopSafe(idle); stopSafe(rev); }
  });

  // Keyboard
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'Space') { gasDown = true; e.preventDefault(); }
    if (e.code === 'KeyS')  { brakeDown = true; }
    if (e.code === 'KeyN')  { nitro.click(); }
    if (e.code === 'KeyM')  { muteBtn.click(); }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') { gasDown = false; }
    if (e.code === 'KeyS')  { brakeDown = false; }
  });
}

function initStickerGarage() {
  const palette = Array.from(document.querySelectorAll('.sticker'));
  const canvas = document.getElementById('sticker-canvas');
  const reset = document.getElementById('stickers-reset');
  if (!canvas) return;

  const addStickerAt = (emoji, x, y) => {
    const el = document.createElement('div');
    el.className = 'absolute select-none';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.transform = 'translate(-50%, -50%)';
    el.style.fontSize = '42px';
    el.textContent = emoji;
    canvas.appendChild(el);
  };

  palette.forEach(p => {
    let active = false;
    const onPointerMove = (e) => {
      if (!active) return;
      const rect = canvas.getBoundingClientRect();
      const x = clamp(e.clientX - rect.left, 0, rect.width);
      const y = clamp(e.clientY - rect.top, 0, rect.height);
      addStickerAt(p.dataset.sticker || '⭐', x, y);
      active = false; // drop once per pointer action for simplicity
      window.removeEventListener('pointermove', onPointerMove);
    };
    p.addEventListener('pointerdown', (e) => {
      active = true;
      window.addEventListener('pointermove', onPointerMove, { once: true });
    });
    p.addEventListener('pointerup', () => { active = false; });
    p.addEventListener('pointercancel', () => { active = false; });
  });

  reset?.addEventListener('click', () => {
    Array.from(canvas.querySelectorAll(':scope > div')).forEach(n => n.remove());
  });
}

function initQuiz() {
  const list = document.getElementById('quiz-list');
  const badge = document.getElementById('quiz-badge');
  if (!list) return;

  const questions = [
    { q: 'What number does Jonny race?', options: ['#8', '#88', '#1'], a: '#88' },
    { q: 'Which series is Jonny entering?', options: ['Karting Only', 'American Super Cups', 'Formula E'], a: 'American Super Cups' },
    { q: 'Where should you focus your eyes in a corner?', options: ['Directly at the nose of the car', 'At the dashboard', 'At the apex and exit'], a: 'At the apex and exit' },
    { q: 'When should most braking happen?', options: ['Mid-corner', 'In a straight line before turn-in', 'After the apex'], a: 'In a straight line before turn-in' },
    { q: 'Yellow flag means...', options: ['Speed up to pass', 'Slow down, no passing', 'Go to pits immediately'], a: 'Slow down, no passing' },
    { q: 'Why smooth steering/throttle/brake?', options: ['To impress the crowd', 'To keep the car balanced and fast', 'To heat up the seat'], a: 'To keep the car balanced and fast' },
    { q: 'First laps are for...', options: ['Sending it!', 'Learning grip, warming tires, leaving space', 'Practicing burnouts'], a: 'Learning grip, warming tires, leaving space' },
    { q: 'In pit lane you should...', options: ['Drive at race speed', 'Stop on track', 'Go walking speed and watch for people'], a: 'Go walking speed and watch for people' },
    { q: 'Racing side-by-side means...', options: ['Squeeze the other car', 'Leave room and finish the lap', 'Aim for the grass'], a: 'Leave room and finish the lap' },
    { q: 'What does Nitro do?', options: ['Turn on lights', 'Make car slower', 'Give a speed boost'], a: 'Give a speed boost' }
  ];

  let correctCount = 0;
  const renderCard = (q, idx) => {
    const card = document.createElement('div');
    card.className = 'quiz-card';
    const title = document.createElement('div');
    title.className = 'text-white font-extrabold mb-2';
    title.textContent = q.q;
    card.appendChild(title);

    q.options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'quiz-option';
      btn.textContent = opt;
      btn.addEventListener('click', () => {
        if (btn.classList.contains('correct') || btn.classList.contains('incorrect')) return;
        if (opt === q.a) {
          btn.classList.add('correct');
          correctCount += 1;
          if (correctCount >= questions.length) {
            badge?.classList.remove('hidden');
          }
        } else {
          btn.classList.add('incorrect');
          setTimeout(()=> btn.classList.remove('incorrect'), 900);
        }
      });
      card.appendChild(btn);
    });
    return card;
  };

  questions.forEach((q, i) => list.appendChild(renderCard(q, i)));
}

// Simple toast utility
function showToast(message, kind='info'){
  const c = document.createElement('div');
  c.style.position='fixed'; c.style.left='50%'; c.style.bottom='24px'; c.style.transform='translateX(-50%)';
  c.style.padding='10px 14px'; c.style.borderRadius='10px'; c.style.fontWeight='900'; c.style.letterSpacing='.06em';
  c.style.zIndex='10000'; c.style.border='1px solid rgba(255,255,255,0.2)'; c.style.backdropFilter='blur(6px)';
  c.style.color='#fff'; c.style.background = kind==='success' ? 'rgba(34,197,94,0.25)' : kind==='error' ? 'rgba(239,68,68,0.25)' : 'rgba(148,163,184,0.25)';
  c.textContent = message; document.body.appendChild(c);
  setTimeout(()=>{ c.remove(); }, 2200);
}

function initGalleryUpload(){
  const input = document.getElementById('photo-upload-input');
  const btn = document.getElementById('upload-btn');
  const bar = document.getElementById('upload-progress-bar');
  const status = document.getElementById('upload-status');
  const gallery = document.getElementById('dynamic-gallery-container');
  const container = document.getElementById('upload-container');
  if (!input || !btn || !bar || !status || !gallery) return;

  // Expose the upload form (was hidden inline)
  if (container) container.style.display = '';

  input.addEventListener('change', () => {
    btn.disabled = !input.files || input.files.length === 0;
  });

  btn.addEventListener('click', async () => {
    const file = input.files?.[0];
    if (!file) return;
    btn.disabled = true; status.textContent = 'Preparing upload...'; bar.style.width = '0%';
    try {
      // For now, immediately display locally (preview) and simulate upload progress
      const url = URL.createObjectURL(file);
      const img = document.createElement('img');
      img.src = url; img.alt = file.name; img.className = 'rounded-lg w-full h-auto';
      const wrap = document.createElement('div'); wrap.className = 'gallery-item-3d'; wrap.appendChild(img);
      gallery.prepend(wrap);

      // Simulate smooth progress
      let p = 0; const timer = setInterval(()=>{ p = Math.min(100, p+12); bar.style.width = p + '%'; if (p>=100) { clearInterval(timer); } }, 120);

      // If you want Firebase Storage later, replace this block with real upload & getDownloadURL
      await new Promise(res=> setTimeout(res, 1400));
      status.textContent = 'Uploaded!'; showToast('Photo uploaded', 'success');
      input.value = ''; btn.disabled = true;
    } catch (e) {
      console.error(e); status.textContent = 'Upload failed'; showToast('Upload failed', 'error');
    }
  });
}

window.addEventListener('DOMContentLoaded', () => {
  try { initSpeedLab(); } catch(e) {}
  try { initStickerGarage(); } catch(e) {}
  try { initQuiz(); } catch(e) {}
  try { initGalleryUpload(); } catch(e) {}
});
