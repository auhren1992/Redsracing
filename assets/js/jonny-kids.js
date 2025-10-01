// Jonny Kids Edition interactivity
import { getFirebaseStorage } from "./firebase-core.js";
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

// Confetti + success screen
function showSuccessScreen(){
  const overlay = document.createElement('div');
  overlay.style.position='fixed'; overlay.style.inset='0'; overlay.style.zIndex='10000';
  overlay.style.background='rgba(0,0,0,0.55)'; overlay.style.backdropFilter='blur(4px)';
  const panel = document.createElement('div');
  panel.style.position='absolute'; panel.style.left='50%'; panel.style.top='50%'; panel.style.transform='translate(-50%,-50%)';
  panel.style.background='rgba(15,23,42,0.9)'; panel.style.border='1px solid rgba(239,68,68,0.4)'; panel.style.borderRadius='16px';
  panel.style.padding='24px'; panel.style.color='#fff'; panel.style.textAlign='center'; panel.style.width='min(92vw, 520px)';
  panel.innerHTML = '<div style="font-weight:900;letter-spacing:.1em;text-transform:uppercase" class="font-racing">Rookie Badge Earned!</div><div style="margin-top:8px;color:#cbd5e1">Great focus and race knowledge! You\'re ready to hit the track.</div><button id="close-success" style="margin-top:16px" class="bg-neon-yellow text-slate-900 font-extrabold px-4 py-2 rounded-md">Back to page</button>';
  const canvas = document.createElement('canvas'); canvas.width = window.innerWidth; canvas.height = window.innerHeight; canvas.style.position='fixed'; canvas.style.inset='0'; canvas.style.zIndex='-1';
  overlay.appendChild(canvas); overlay.appendChild(panel); document.body.appendChild(overlay);
  const ctx = canvas.getContext('2d');
  const parts = Array.from({length: 160}, () => ({ x: Math.random()*canvas.width, y: -20, vx: (Math.random()-0.5)*2, vy: 2+Math.random()*3, s: 4+Math.random()*4, c: `hsl(${Math.random()*360},90%,60%)`, a: 1 }));
  let animId = 0;
  const step = () => {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    parts.forEach(p => { p.x += p.vx; p.y += p.vy; p.a *= 0.996; ctx.globalAlpha = p.a; ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, p.s, p.s); });
    ctx.globalAlpha = 1;
    animId = requestAnimationFrame(step);
  };
  step();
  const close = () => { cancelAnimationFrame(animId); overlay.remove(); };
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  panel.querySelector('#close-success').addEventListener('click', close);
}

async function initQuiz() {
  const list = document.getElementById('quiz-list');
  const badge = document.getElementById('quiz-badge');
  const filterEl = document.getElementById('track-filter');
  if (!list) return;

  // Asphalt-only quiz content
  const general = [
    { q: 'What number does Jonny race?', options: ['#8', '#88', '#1'], a: '#88' },
    { q: 'Which series is Jonny entering?', options: ['Karting Only', 'American Super Cups', 'Formula E'], a: 'American Super Cups' },
    { q: 'Where should you focus your eyes in a corner?', options: ['At the nose of the car', 'At the apex and exit', 'At the dashboard'], a: 'At the apex and exit' },
    { q: 'When should most braking happen on ovals?', options: ['Mid-corner', 'In a straight line before turn-in', 'After the apex'], a: 'In a straight line before turn-in' },
    { q: 'Smooth hands and feet help to...', options: ['Keep the car balanced and fast', 'Impress the crowd', 'Heat up the seat'], a: 'Keep the car balanced and fast' },
    { q: 'First laps are for...', options: ['Sending it!', 'Learning grip and warming tires', 'Practicing burnouts'], a: 'Learning grip and warming tires' },
    { q: 'Yellow flag means...', options: ['Slow down, no passing', 'Drive to pits immediately', 'Speed up to pass'], a: 'Slow down, no passing' },
    { q: 'Side-by-side racing means...', options: ['Squeeze the other car', 'Leave room and be predictable', 'Aim for the grass'], a: 'Leave room and be predictable' },
  ];

  const shortOval = [
    { q: 'Overdriving entry usually causes...', options: ['Great exits', 'Poor exit speed', 'Nothing'], a: 'Poor exit speed' },
    { q: 'A later apex on flat short ovals helps you...', options: ['Turn earlier', 'Straighten the wheel sooner for better exit', 'Brake longer on exit'], a: 'Straighten the wheel sooner for better exit' },
    { q: 'Best passing setup is...', options: ['Divebomb low every time', 'Build exit momentum and position', 'Slow in/slow out'], a: 'Build exit momentum and position' },
  ];

  const etiquette = [
    { q: 'On cautions you should...', options: ['Pass the leader', 'Hold position and form up safely', 'Stop on track'], a: 'Hold position and form up safely' },
    { q: 'On restarts you should...', options: ['Weave across lanes', 'Be predictable and hold lane to T1', 'Stop at the line'], a: 'Be predictable and hold lane to T1' },
  ];

  // Load tracks from Firestore schedule (same as schedule.html)
  let tracks = ['General'];
  try {
    const { getFirebaseDb } = await import('./firebase-core.js');
    const db = getFirebaseDb();
    const { collection, getDocs, orderBy, query } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');
    const snap = await getDocs(query(collection(db, 'races'), orderBy('date', 'asc')));
    const names = new Set();
    snap.docs.forEach(d => { const n = (d.data().name || '').trim(); if (n) names.add(n); });
    tracks = ['All Tracks', ...Array.from(names)];
  } catch {}

  // Populate filter
  if (filterEl && tracks.length) {
    filterEl.innerHTML = '';
    tracks.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t === 'All Tracks' ? 'all' : t; opt.textContent = t; filterEl.appendChild(opt);
    });
  }

  // Track profiles derived from your notes (asphalt only)
  const trackProfiles = [
    {
      keys: ['grundy'],
      label: 'Grundy County Speedway',
      variant: 'semi-banked-1/3',
      tips: [
        'Semi-banked 1/3: carry entry speed but protect exit drive.',
        'Late apex helps you straighten the wheel and throttle earlier.',
        'Be consistent—string laps with similar lines and brake points.',
      ],
      questions: [
        { q: 'Grundy is about...', options: ['1/2 mile', '1/3 mile', '1 mile'], a: '1/3 mile' },
        { q: 'Semi-banking helps you...', options: ['Carry mid-corner speed', 'Hit the brakes mid-corner', 'Steer more with the wheel'], a: 'Carry mid-corner speed' },
      ],
    },
    {
      keys: ['dells'],
      label: 'Dells Raceway Park',
      variant: 'moderate-9deg',
      tips: [
        '9° corners, 6° straights: keep hands calm and roll speed.',
        'Focus on mid-to-exit—overdriving entry costs you down the straight.',
        'Use a later apex to get the car pointed early on exit.',
      ],
      questions: [
        { q: 'Dells corner banking is roughly...', options: ['3°', '9°', '20°'], a: '9°' },
      ],
    },
    {
      keys: ['golden sands','golden-sands'],
      label: 'Golden Sands Speedway',
      variant: 'high-banked-1/3',
      tips: [
        'High-banked 1/3: commit early and maintain momentum.',
        'Outside groove can work—let the banking help your exit.',
        'Small steering inputs—let the banking carry you.',
      ],
      questions: [
        { q: 'Golden Sands is known for...', options: ['Dirt surface', 'High banking and speed', 'Being a road course'], a: 'High banking and speed' },
      ],
    },
    {
      keys: ['slinger'],
      label: 'Slinger Speedway',
      variant: 'extreme-33deg-1/4',
      tips: [
        '33° turns on a 1/4 mile: extreme banking allows big commitment.',
        'Lift early and little—protect exit; don’t over-slow entry.',
        'Two grooves often work; be predictable on overlap.',
      ],
      questions: [
        { q: 'Slinger’s turn banking is about...', options: ['12°', '20°', '33°'], a: '33°' },
      ],
    },
    {
      keys: ['tomah'],
      label: 'Tomah Speedway',
      variant: 'slightly-banked-1/3',
      tips: [
        'Slight banking with fresh asphalt: expect strong grip early.',
        'Adjust braking points—new surface may allow later braking.',
        'Build pace gradually to learn how the resurfacing behaves.',
      ],
      questions: [
        { q: 'Tomah surface update means you should...', options: ['Brake earlier than ever', 'Test later braking cautiously', 'Ignore changes'], a: 'Test later braking cautiously' },
      ],
    },
    {
      keys: ['la crosse','lacrosse'],
      label: 'La Crosse Speedway',
      variant: 'progressive-banking',
      tips: [
        'Progressive banking: bottom ~5°, middle ~8°, top ~11°.',
        'Pick lane by car balance—top can carry momentum.',
        'Stay smooth transitioning lanes; be predictable near traffic.',
      ],
      questions: [
        { q: 'Progressive banking means...', options: ['Same angle every lane', 'More banking higher up', 'Dirt and asphalt mix'], a: 'More banking higher up' },
      ],
    },
    {
      keys: ['blackhawk farms','blackhawk'],
      label: 'Blackhawk Farms Raceway',
      variant: 'road-course-1.95',
      tips: [
        'Road course: eyes up; brake in a straight line, release smoothly.',
        'Turn-in once; clip apex; let car use all of exit curb/track.',
        'Be patient with throttle—balance first, then power.',
      ],
      questions: [
        { q: 'On a road course exit you should...', options: ['Stay mid-track', 'Use all available track if safe', 'Add throttle mid-corner suddenly'], a: 'Use all available track if safe' },
      ],
    },
  ];

  const tipsPanel = document.getElementById('track-tips-panel');

  const renderTips = (profile) => {
    if (!tipsPanel) return;
    if (!profile) { tipsPanel.classList.add('hidden'); tipsPanel.innerHTML = ''; return; }
    const items = profile.tips.map(t => `<li class="text-slate-300 text-sm">${t}</li>`).join('');
    tipsPanel.classList.remove('hidden');
    tipsPanel.innerHTML = `
      <div class="quiz-card">
        <div class="text-white font-extrabold mb-2"><i class="fas fa-lightbulb text-yellow-400 mr-2"></i>Track Tips: ${profile.label}</div>
        <ul class="list-disc pl-5 space-y-1">${items}</ul>
      </div>
    `;
  };

  const matchProfile = (trackName) => {
    if (!trackName || trackName === 'all') return null;
    const k = trackName.toLowerCase();
    return trackProfiles.find(p => p.keys.some(key => k.includes(key))) || null;
  };

  const questionsForTrack = (trackName) => {
    const base = [...general, ...etiquette, ...shortOval, { q: 'What does Nitro do?', options: ['Turn on lights', 'Make car slower', 'Give a speed boost'], a: 'Give a speed boost' }];
    const prof = matchProfile(trackName);
    if (prof && prof.questions) return [...base, ...prof.questions];
    return base;
  };

  let currentQuestions = questionsForTrack('all');
  let correctCount = 0;

  const renderCard = (q) => {
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
          if (correctCount >= currentQuestions.length) {
            badge?.classList.remove('hidden');
            try { showSuccessScreen(); } catch(e) {}
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

  const render = () => {
    list.innerHTML = '';
    correctCount = 0;
    currentQuestions.forEach(q => list.appendChild(renderCard(q)));
  };

  if (filterEl) {
    filterEl.addEventListener('change', () => {
      const val = filterEl.value;
      currentQuestions = questionsForTrack(val);
      renderTips(matchProfile(val));
      render();
    });
  }

  // Initial tips (hidden for All Tracks)
  renderTips(null);
  render();
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
      // Show local preview immediately, then swap to final URL
      const previewUrl = URL.createObjectURL(file);
      const img = document.createElement('img');
      img.src = previewUrl; img.alt = file.name; img.className = 'rounded-lg w-full h-auto';
      const wrap = document.createElement('div'); wrap.className = 'gallery-item-3d'; wrap.appendChild(img);
      gallery.prepend(wrap);

      const storage = getFirebaseStorage();
      const { ref, uploadBytesResumable, getDownloadURL } = await import("https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js");
      const path = `jonny/${Date.now()}-${file.name}`;
      const storageRef = ref(storage, path);
      const uploadTask = uploadBytesResumable(storageRef, file);

      await new Promise((resolve, reject) => {
        uploadTask.on('state_changed', (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          bar.style.width = progress + '%';
          status.textContent = `Uploading... ${Math.round(progress)}%`;
        }, (error) => {
          reject(error);
        }, async () => {
          try {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            img.src = url; // swap to permanent URL
            resolve();
          } catch (e) { reject(e); }
        });
      });

      status.textContent = 'Uploaded!'; showToast('Photo uploaded', 'success');
      input.value = ''; btn.disabled = true;
    } catch (e) {
      console.error(e); status.textContent = 'Upload failed'; showToast('Upload failed', 'error');
      btn.disabled = false;
    }
  });
}

window.addEventListener('DOMContentLoaded', () => {
  try { initSpeedLab(); } catch(e) {}
  try { initStickerGarage(); } catch(e) {}
  try { initQuiz(); } catch(e) {}
  try { initGalleryUpload(); } catch(e) {}
});
