/* ═══════════════════════════════════════════
   FocusFlow — by Omar Mohamed
   All logic: Auth · Timer · Sleep · Habits
   Water · Notes · Analytics · Profile · Sound
═══════════════════════════════════════════ */

/* ── Storage ── */
const DB = {
  get: (k, d = null) => { try { const v = localStorage.getItem(k); return v != null ? JSON.parse(v) : d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del: (k) => localStorage.removeItem(k),
};
const UK = (sub) => `ff_${currentUser}_${sub}`;

/* ── Auth State ── */
let currentUser = null;

function getUsers() { return DB.get('ff_users', {}); }
function setUsers(u) { DB.set('ff_users', u); }

function showAuthTab(t) {
  document.getElementById('login-form').style.display    = t === 'login' ? '' : 'none';
  document.getElementById('register-form').style.display = t === 'register' ? '' : 'none';
  document.querySelectorAll('.auth-tab').forEach((b, i) => b.classList.toggle('active', (i === 0) === (t === 'login')));
}

function doRegister() {
  const name = document.getElementById('r-name').value.trim();
  const email = document.getElementById('r-email').value.trim().toLowerCase();
  const pw = document.getElementById('r-pw').value;
  const err = document.getElementById('r-err');
  if (!name || !email || !pw) { err.textContent = 'All fields required.'; return; }
  if (pw.length < 6) { err.textContent = 'Password must be at least 6 characters.'; return; }
  const users = getUsers();
  if (Object.values(users).some(u => u.email === email)) { err.textContent = 'Email already registered.'; return; }
  const uid = 'u' + Date.now();
  users[uid] = { uid, name, email, pw: btoa(pw), joined: new Date().toISOString() };
  setUsers(users);
  DB.set(`ff_profile_${uid}`, { name, email, bio: '', goal: 120, sleepGoal: 8, avatar: '' });
  startSession(uid);
}

function doLogin() {
  const email = document.getElementById('l-email').value.trim().toLowerCase();
  const pw    = document.getElementById('l-pw').value;
  const err   = document.getElementById('l-err');
  const users = getUsers();
  const user  = Object.values(users).find(u => u.email === email && u.pw === btoa(pw));
  if (!user) { err.textContent = 'Incorrect email or password.'; return; }
  startSession(user.uid);
}

function startSession(uid) {
  DB.set('ff_session', uid);
  currentUser = uid;
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'grid';
  initApp();
}

function doLogout() {
  stopTimer(); stopAmbient();
  DB.del('ff_session');
  currentUser = null;
  document.getElementById('app-screen').style.display = 'none';
  document.getElementById('auth-screen').style.display = '';
}

function togglePw(id, el) {
  const inp = document.getElementById(id);
  inp.type = inp.type === 'password' ? 'text' : 'password';
  el.className = 'ti pw-toggle ' + (inp.type === 'text' ? 'ti-eye-off' : 'ti-eye');
}

/* ── App Init ── */
function initApp() {
  loadProfile();
  initTimer();
  renderTasks();
  navigate('dashboard');
  setupSleepDefaults();
  loadWaterPage();
  loadNotesPage();
  // Service worker
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

/* ── Navigation ── */
const PAGE_TITLES = {
  dashboard:'Dashboard', timer:'Pomodoro Timer', sleep:'Sleep Tracker',
  habits:'Habits', water:'Water Tracker', notes:'Study Notes',
  analytics:'Analytics', profile:'Profile'
};

function navigate(p) {
  unlockAudio(); // ensure audio context ready on interaction
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.sn, .bn').forEach(el => el.classList.remove('active'));
  document.getElementById('page-' + p).classList.add('active');
  document.querySelectorAll(`[data-p="${p}"]`).forEach(el => el.classList.add('active'));
  document.getElementById('topbar-title').textContent = PAGE_TITLES[p] || p;
  closeSidebar();
  if (p === 'dashboard') renderDashboard();
  if (p === 'sleep')  { setupSleepDefaults(); loadSleepPage(); }
  if (p === 'habits') loadHabits();
  if (p === 'water')  loadWaterPage();
  if (p === 'notes')  loadNotesPage();
  if (p === 'analytics') renderAnalytics();
  if (p === 'profile') renderProfile();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sb-overlay').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sb-overlay').classList.remove('open');
}

/* ── Profile ── */
function getProfile() {
  return DB.get(`ff_profile_${currentUser}`, { name: '', email: '', bio: '', goal: 120, sleepGoal: 8, avatar: '' });
}
function setProfile(p) { DB.set(`ff_profile_${currentUser}`, p); }

function initials(name) {
  return name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '??';
}

function setAvEl(id, avatar, init) {
  const el = document.getElementById(id);
  if (!el) return;
  if (avatar) { el.innerHTML = `<img src="${avatar}" alt="avatar"/>`; }
  else { el.textContent = init; }
}

function loadProfile() {
  const p = getProfile();
  const ini = initials(p.name);
  ['sb-av','tb-av','dash-av','pr-av'].forEach(id => setAvEl(id, p.avatar, ini));
  document.getElementById('sb-name').textContent = p.name || 'User';
  document.getElementById('dash-greeting').textContent = greeting(p.name);
  document.getElementById('dash-date').textContent = new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
}

function greeting(name) {
  const h = new Date().getHours();
  const g = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return `${g}, ${name.split(' ')[0] || 'there'} 👋`;
}

function renderProfile() {
  const p = getProfile();
  const users = getUsers();
  const user  = users[currentUser] || {};
  const ini   = initials(p.name);
  setAvEl('pr-av', p.avatar, ini);
  document.getElementById('pr-name').textContent  = p.name;
  document.getElementById('pr-email').textContent = p.email;
  document.getElementById('pr-joined').textContent = user.joined ? 'Joined ' + new Date(user.joined).toLocaleDateString('en-GB', { month:'long', year:'numeric' }) : '';
  document.getElementById('pr-edit-name').value = p.name;
  document.getElementById('pr-edit-bio').value  = p.bio || '';
  document.getElementById('pr-edit-goal').value = p.goal || 120;
  document.getElementById('pr-edit-sg').value   = p.sleepGoal || 8;
  renderBadges();
  renderAchievements();
}

function saveProfile() {
  const p = getProfile();
  p.name      = document.getElementById('pr-edit-name').value.trim() || p.name;
  p.bio       = document.getElementById('pr-edit-bio').value.trim();
  p.goal      = parseInt(document.getElementById('pr-edit-goal').value) || 120;
  p.sleepGoal = parseFloat(document.getElementById('pr-edit-sg').value) || 8;
  setProfile(p);
  loadProfile();
  renderProfile();
  toast('Profile saved! ✓');
}

function uploadAv(inp) {
  const file = inp.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const p = getProfile(); p.avatar = e.target.result; setProfile(p);
    loadProfile(); renderProfile(); toast('Photo updated! 📸');
  };
  reader.readAsDataURL(file);
}

/* Badges */
function renderBadges() {
  const logs = getLogs();
  const fm = focusMinTotal(logs);
  const sl = getSleepLogs().length;
  const badges = [];
  if (fm >= 60)  badges.push({ label: '1h Focus',       color: 'purple' });
  if (fm >= 600) badges.push({ label: '10h Focus',      color: 'purple' });
  if (sl >= 7)   badges.push({ label: '7-Day Sleeper',  color: 'blue'   });
  if (sl >= 30)  badges.push({ label: '30-Night Streak',color: 'blue'   });
  if (getHabits().length >= 3) badges.push({ label: 'Habit Builder', color: 'green' });
  if (getWaterLogs()[todayStr()] >= 8) badges.push({ label: 'Hydrated',  color: 'blue' });
  if (getNotes().length >= 5) badges.push({ label: 'Note Taker', color: 'amber' });
  const el = document.getElementById('pr-badges');
  el.innerHTML = badges.length
    ? badges.map(b => `<span class="badge ${b.color}">${b.label}</span>`).join('')
    : '<span style="font-size:12px;color:var(--text3)">Complete sessions to earn badges</span>';
}

const ACH = [
  { id: 'a1', ico: '🎯', name: 'First Focus',     desc: 'Complete your first session',   check: l => l.filter(x => x.type==='session').length >= 1 },
  { id: 'a2', ico: '🔥', name: 'On Fire',          desc: '10 focus sessions',             check: l => l.filter(x => x.type==='session').length >= 10 },
  { id: 'a3', ico: '💯', name: 'Century',           desc: '100 focus sessions',            check: l => l.filter(x => x.type==='session').length >= 100 },
  { id: 'a4', ico: '⏰', name: 'Deep Work',         desc: '5 hours total focus',           check: l => focusMinTotal(l) >= 300 },
  { id: 'a5', ico: '🌙', name: 'Early to Bed',      desc: 'Log your first sleep',         check: () => getSleepLogs().length >= 1 },
  { id: 'a6', ico: '😴', name: 'Sleep Champion',    desc: '7 nights logged',              check: () => getSleepLogs().length >= 7 },
  { id: 'a7', ico: '💧', name: 'Hydrated',          desc: 'Hit water goal for a day',     check: () => { const wl=getWaterLogs(); const p=getProfile(); return Object.values(wl).some(v=>v>=(p.goal_water||8)); } },
  { id: 'a8', ico: '📚', name: 'Note Taker',        desc: 'Write 5 study notes',          check: () => getNotes().length >= 5 },
  { id: 'a9', ico: '✅', name: 'Habit Builder',     desc: 'Add 3 habits',                 check: () => getHabits().length >= 3 },
  { id:'a10', ico: '📸', name: 'Face of Focus',     desc: 'Upload a profile photo',       check: () => !!getProfile().avatar },
];

function renderAchievements() {
  const logs = getLogs();
  document.getElementById('ach-grid').innerHTML = ACH.map(a => {
    const ok = a.check(logs);
    return `<div class="ach ${ok ? 'unlocked' : 'locked'}">
      <div class="ach-ico">${a.ico}</div>
      <div class="ach-name">${a.name}</div>
      <div class="ach-desc">${a.desc}</div>
    </div>`;
  }).join('');
}

/* ── Activity Logs ── */
function getLogs() { return DB.get(UK('logs'), []); }
function addLog(entry) {
  const logs = getLogs();
  logs.unshift({ ...entry, id: Date.now(), ts: new Date().toISOString() });
  DB.set(UK('logs'), logs.slice(0, 2000));
}
function focusMinTotal(logs) { return logs.filter(l => l.type === 'focus').reduce((s, l) => s + (l.minutes || 0), 0); }
function todayStr() { return new Date().toISOString().slice(0, 10); }
function todayFocusMin() { return getLogs().filter(l => l.type === 'focus' && l.date === todayStr()).reduce((s, l) => s + (l.minutes || 0), 0); }

function logTimeAgo(ts) {
  const diff = (Date.now() - new Date(ts)) / 60000;
  if (diff < 1)    return 'just now';
  if (diff < 60)   return Math.round(diff) + 'm ago';
  if (diff < 1440) return Math.round(diff / 60) + 'h ago';
  return new Date(ts).toLocaleDateString('en-GB', { day:'numeric', month:'short' });
}

function last7Days() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
}

function focusStreak() {
  const logs = getLogs(); let s = 0;
  const d = new Date();
  while (true) {
    const str = d.toISOString().slice(0, 10);
    if (!logs.some(l => l.type === 'focus' && l.date === str)) break;
    s++; d.setDate(d.getDate() - 1);
  }
  return s;
}

function renderLogList(containerId, logs, max = 20) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const items = logs.slice(0, max);
  if (!items.length) {
    el.innerHTML = `<div class="empty-state"><i class="ti ti-list"></i>No activity yet</div>`;
    return;
  }
  el.innerHTML = items.map(l => `
    <div class="log-item">
      <div class="log-dot ${l.type}"></div>
      <span class="log-text">${escHtml(l.label)}</span>
      <span class="log-time">${logTimeAgo(l.ts)}</span>
    </div>`).join('');
}

/* ── Dashboard ── */
let dashCharts = {};

function renderDashboard() {
  loadProfile();
  // KPIs
  const fm = todayFocusMin();
  document.getElementById('kpi-focus').textContent  = fm >= 60 ? (fm/60).toFixed(1)+'h' : fm+'m';
  const sl = getSleepLogs()[0];
  document.getElementById('kpi-sleep').textContent  = sl ? sl.hours.toFixed(1)+'h' : '—';
  document.getElementById('kpi-streak').textContent = focusStreak();
  const habits = getHabits(), hlog = getHabitLog();
  const hDone = habits.filter(h => hlog[h.id+'_'+todayStr()]).length;
  document.getElementById('kpi-habits').textContent = `${hDone}/${habits.length}`;
  // Charts
  renderWeekChart('c-dash-focus', getLogs(), 'focus', '#7c6fcd', 'min');
  renderWeekChart('c-dash-sleep', getSleepLogs().map(s => ({ type:'sleep', date: s.date, minutes: s.hours*60 })), 'sleep', '#3a85e0', 'h', 60);
  // Log
  renderLogList('dash-log', getLogs());
  // Quote
  const QUOTES = [
    '"Deep work is the superpower of our age." — Cal Newport',
    '"The secret of getting ahead is getting started." — Mark Twain',
    '"Focus is the art of knowing what to ignore."',
    '"Small steps every day lead to extraordinary results."',
    '"An investment in knowledge pays the best interest." — Benjamin Franklin',
    '"Study hard, dream big, work harder than yesterday."',
    '"Your future self will thank you for every hour of focus today."',
    '"Discipline is the bridge between goals and accomplishment." — Jim Rohn',
  ];
  document.getElementById('dash-quote').textContent = QUOTES[new Date().getDate() % QUOTES.length];
}

function renderWeekChart(canvasId, logs, type, color, unit, divBy = 1) {
  const days = last7Days();
  const data  = days.map(d => +(logs.filter(l => l.type === type && l.date === d).reduce((s, l) => s + (l.minutes || 0), 0) / divBy).toFixed(1));
  const labels = days.map(d => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday:'short' }));
  if (dashCharts[canvasId]) dashCharts[canvasId].destroy();
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  dashCharts[canvasId] = new Chart(ctx.getContext('2d'), {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: color + '55', borderColor: color, borderWidth: 1.5, borderRadius: 6, borderSkipped: false }] },
    options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false}, tooltip:{callbacks:{label:c=>c.raw+unit}} }, scales:{ x:{grid:{display:false}, ticks:{color:'#5c5a65',font:{size:11}}}, y:{grid:{color:'rgba(255,255,255,0.04)'}, ticks:{color:'#5c5a65',font:{size:11}}} } }
  });
}

/* ── AUDIO ENGINE ── */
let audioCtx = null;
let ambientNodes = [];
let ambientType = 'off';

function unlockAudio() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch {}
}

function playTone(freq, type = 'sine', dur = 0.8, gain = 0.2, startDelay = 0) {
  try {
    unlockAudio();
    const ctx = audioCtx;
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + startDelay);
    g.gain.setValueAtTime(0, ctx.currentTime + startDelay);
    g.gain.linearRampToValueAtTime(gain, ctx.currentTime + startDelay + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startDelay + dur);
    osc.start(ctx.currentTime + startDelay);
    osc.stop(ctx.currentTime + startDelay + dur);
  } catch {}
}

function playBell() {
  if (!document.getElementById('snd')?.checked) return;
  unlockAudio();
  if (timerMode === 'focus') {
    // Triumphant ascending chord
    [[523,0],[659,0.18],[784,0.36],[1047,0.54],[1319,0.72]].forEach(([f,d]) => playTone(f,'sine',1.2,0.18,d));
  } else {
    // Gentle descending
    [[784,0],[659,0.2],[523,0.4]].forEach(([f,d]) => playTone(f,'sine',0.9,0.15,d));
  }
}

function playTick() {
  if (!document.getElementById('tick')?.checked || !timerRunning) return;
  try {
    unlockAudio();
    const ctx = audioCtx;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.012), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.06;
    const src = ctx.createBufferSource();
    const g   = ctx.createGain();
    g.gain.setValueAtTime(0.08, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.012);
    src.buffer = buf; src.connect(g); g.connect(ctx.destination); src.start();
  } catch {}
}

/* Ambient sounds */
function setAmbient(type, btn) {
  unlockAudio();
  stopAmbient();
  document.querySelectorAll('.amb-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  ambientType = type;
  if (type === 'off') return;
  startAmbient(type);
}

function startAmbient(type) {
  try {
    unlockAudio();
    const ctx = audioCtx;
    if (type === 'white' || type === 'brown') {
      const bufSec = 2;
      const buf = ctx.createBuffer(1, ctx.sampleRate * bufSec, ctx.sampleRate);
      const data = buf.getChannelData(0);
      if (type === 'white') {
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      } else {
        let last = 0;
        for (let i = 0; i < data.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; data[i] = last * 3.5; }
      }
      const src = ctx.createBufferSource();
      const g   = ctx.createGain();
      src.buffer = buf; src.loop = true;
      g.gain.setValueAtTime(type === 'white' ? 0.04 : 0.12, ctx.currentTime);
      src.connect(g); g.connect(ctx.destination); src.start();
      ambientNodes.push(src, g);
    } else if (type === 'rain') {
      // Rain = filtered white noise
      const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const src    = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const g      = ctx.createGain();
      src.buffer = buf; src.loop = true;
      filter.type = 'bandpass'; filter.frequency.value = 400; filter.Q.value = 0.5;
      g.gain.setValueAtTime(0.18, ctx.currentTime);
      src.connect(filter); filter.connect(g); g.connect(ctx.destination); src.start();
      ambientNodes.push(src, filter, g);
    } else if (type === 'cafe') {
      // Cafe = brown noise + occasional low tones
      const buf  = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < data.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; data[i] = last * 3; }
      const src = ctx.createBufferSource();
      const g   = ctx.createGain();
      src.buffer = buf; src.loop = true;
      g.gain.setValueAtTime(0.08, ctx.currentTime);
      src.connect(g); g.connect(ctx.destination); src.start();
      ambientNodes.push(src, g);
      // Add subtle murmur
      const osc = ctx.createOscillator();
      const og  = ctx.createGain();
      osc.type = 'sawtooth'; osc.frequency.setValueAtTime(80, ctx.currentTime);
      og.gain.setValueAtTime(0.012, ctx.currentTime);
      osc.connect(og); og.connect(ctx.destination); osc.start();
      ambientNodes.push(osc, og);
    }
  } catch {}
}

function stopAmbient() {
  ambientNodes.forEach(n => { try { n.stop ? n.stop() : n.disconnect(); } catch {} });
  ambientNodes = [];
}

/* ── TIMER ── */
const DUR = { focus: 25, short: 5, long: 15 };
let timerMode      = 'focus';
let timerTotal     = 25 * 60;
let timerRemaining = 25 * 60;
let timerRunning   = false;
let timerInterval  = null;
let sessCount      = 0;

function fmtTime(s) { return String(Math.floor(s/60)).padStart(2,'0') + ':' + String(s%60).padStart(2,'0'); }

function modeColor() { return { focus:'#7c6fcd', short:'#22c97a', long:'#3a85e0' }[timerMode]; }

function updateRing() {
  const circ = 2 * Math.PI * 98;
  const fg   = document.getElementById('ring-fg');
  fg.style.strokeDasharray  = circ;
  fg.style.strokeDashoffset = circ * (1 - timerRemaining / timerTotal);
  fg.style.stroke = modeColor();
  document.getElementById('t-disp').textContent = fmtTime(timerRemaining);
}

function initTimer() {
  setMode('focus');
  renderSessDots();
  updateTimerStats();
}

function setMode(m) {
  if (timerRunning) stopTimer();
  timerMode = m;
  timerTotal = DUR[m] * 60;
  timerRemaining = timerTotal;
  document.querySelectorAll('.mtab').forEach((t, i) => t.classList.toggle('active', ['focus','short','long'][i] === m));
  document.getElementById('t-lbl').textContent = { focus:'FOCUS TIME', short:'SHORT BREAK', long:'LONG BREAK' }[m];
  document.getElementById('play-icon').className = 'ti ti-player-play';
  updateRing();
}

function toggleTimer() {
  unlockAudio();
  timerRunning ? stopTimer() : startTimer();
}

function startTimer() {
  timerRunning = true;
  document.getElementById('play-icon').className = 'ti ti-player-pause';
  timerInterval = setInterval(timerTick, 1000);
}

function stopTimer() {
  timerRunning = false;
  clearInterval(timerInterval);
  document.getElementById('play-icon').className = 'ti ti-player-play';
}

function timerTick() {
  if (timerRemaining <= 0) { onSessionEnd(); return; }
  timerRemaining--;
  playTick();
  updateRing();
  // Update page title with time
  document.title = `${fmtTime(timerRemaining)} — FocusFlow`;
}

function resetTimer() { unlockAudio(); stopTimer(); timerRemaining = timerTotal; updateRing(); }
function skipSession() { unlockAudio(); stopTimer(); onSessionEnd(true); }

function onSessionEnd(skipped = false) {
  stopTimer();
  timerRemaining = 0; updateRing();
  document.title = 'FocusFlow — by Omar Mohamed';
  if (!skipped) playBell();

  if (timerMode === 'focus') {
    sessCount++;
    const min = DUR.focus;
    const topic = document.getElementById('working-on')?.value.trim();
    addLog({ type: 'focus',   label: `${min}min focus session${topic ? ' — ' + topic : ''}`, minutes: min, date: todayStr() });
    addLog({ type: 'session', label: `Pomodoro completed${topic ? ': ' + topic : ''}`, minutes: min, date: todayStr() });
    updateTimerStats();
    renderSessDots();
    toast('Session complete! Great work 🎉');
    const next = sessCount % 4 === 0 ? 'long' : 'short';
    setTimeout(() => { setMode(next); if (document.getElementById('auto')?.checked) startTimer(); }, 1200);
  } else {
    toast('Break over — back to focus! 💪');
    setTimeout(() => { setMode('focus'); if (document.getElementById('auto')?.checked) startTimer(); }, 1200);
  }
}

function updateTimerStats() {
  document.getElementById('ts-sess').textContent   = sessCount;
  document.getElementById('ts-focus').textContent  = todayFocusMin() + 'm';
  document.getElementById('ts-streak').textContent = focusStreak();
}

function renderSessDots() {
  const wrap = document.getElementById('sess-dots');
  if (!wrap) return;
  wrap.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const d = document.createElement('div');
    const pos = sessCount % 4;
    d.className = 'sdot' + (i < pos ? ' done' : (i === pos && timerRunning ? ' cur' : ''));
    wrap.appendChild(d);
  }
}

function adjDur(key, delta) {
  DUR[key] = Math.max(1, Math.min(120, DUR[key] + delta));
  document.getElementById('d-' + key).textContent = DUR[key] + 'm';
  if (timerMode === key && !timerRunning) { timerTotal = DUR[key] * 60; timerRemaining = timerTotal; updateRing(); }
}

/* ── TASKS ── */
function getTasks() { return DB.get(UK('tasks'), []); }
function setTasks(t) { DB.set(UK('tasks'), t); }

function addTask() {
  unlockAudio();
  const inp = document.getElementById('task-inp');
  const val = inp.value.trim();
  if (!val) return;
  const tasks = getTasks();
  tasks.push({ id: Date.now(), text: val, done: false, date: todayStr() });
  setTasks(tasks);
  inp.value = ''; renderTasks();
}

function toggleTask(id) {
  const tasks = getTasks();
  const t = tasks.find(t => t.id === id);
  if (t) { t.done = !t.done; setTasks(tasks); renderTasks(); }
}

function deleteTask(id) { setTasks(getTasks().filter(t => t.id !== id)); renderTasks(); }

function renderTasks() {
  const el = document.getElementById('task-list');
  if (!el) return;
  const tasks = getTasks().filter(t => t.date === todayStr());
  el.innerHTML = tasks.length ? tasks.map(t => `
    <div class="task-item">
      <div class="task-cb ${t.done ? 'done' : ''}" onclick="toggleTask(${t.id})">${t.done ? '<i class="ti ti-check"></i>' : ''}</div>
      <span class="task-txt ${t.done ? 'done' : ''}">${escHtml(t.text)}</span>
      <span class="task-del" onclick="deleteTask(${t.id})"><i class="ti ti-x"></i></span>
    </div>`).join('')
    : '<div class="empty-state" style="padding:1rem 0"><i class="ti ti-checkbox" style="font-size:24px;margin-bottom:4px"></i>No tasks yet</div>';
}

/* ── SLEEP ── */
let sleepStar = 3;

function getSleepLogs() { return DB.get(UK('sleep'), []); }
function setSleepLogs(l) { DB.set(UK('sleep'), l); }

function setupSleepDefaults() {
  const el = document.getElementById('sl-date');
  if (el && !el.value) el.value = todayStr();
}

function setStar(v) {
  sleepStar = v;
  document.querySelectorAll('#sl-stars i').forEach((s, i) => s.classList.toggle('lit', i < v));
}

function sleepHours(bed, wake) {
  const [bh, bm] = bed.split(':').map(Number);
  const [wh, wm] = wake.split(':').map(Number);
  let m = (wh * 60 + wm) - (bh * 60 + bm);
  if (m < 0) m += 1440;
  return +(m / 60).toFixed(2);
}

function logSleep() {
  unlockAudio();
  const bed  = document.getElementById('sl-bed').value;
  const wake = document.getElementById('sl-wake').value;
  const date = document.getElementById('sl-date').value;
  const note = document.getElementById('sl-note').value.trim();
  if (!bed || !wake || !date) { toast('Please fill bedtime, wake-up and date'); return; }
  const hours = sleepHours(bed, wake);
  const logs = getSleepLogs();
  const idx  = logs.findIndex(l => l.date === date);
  const entry = { id: Date.now(), date, bed, wake, hours, quality: sleepStar, note };
  if (idx > -1) logs[idx] = entry; else logs.unshift(entry);
  setSleepLogs(logs.sort((a, b) => b.date.localeCompare(a.date)));
  addLog({ type: 'sleep', label: `Slept ${hours.toFixed(1)}h · ${bed} → ${wake} · ${'★'.repeat(sleepStar)}`, date });
  toast(`Sleep logged: ${hours.toFixed(1)} hours 🌙`);
  loadSleepPage();
}

function loadSleepPage() {
  const logs = getSleepLogs();
  if (logs.length) {
    const avg = logs.reduce((s, l) => s + l.hours, 0) / logs.length;
    const best = Math.max(...logs.map(l => l.hours));
    const avgQ = logs.reduce((s, l) => s + (l.quality || 3), 0) / logs.length;
    document.getElementById('ss-avg').textContent  = avg.toFixed(1)  + 'h';
    document.getElementById('ss-best').textContent = best.toFixed(1) + 'h';
    document.getElementById('ss-qual').textContent = avgQ.toFixed(1) + '★';
    document.getElementById('ss-days').textContent = logs.length;
  } else {
    ['ss-avg','ss-best','ss-qual'].forEach(id => document.getElementById(id).textContent = '—');
    document.getElementById('ss-days').textContent = '0';
  }
  renderSleepChart();
  renderSleepHistory();
}

function renderSleepChart() {
  const days  = last7Days();
  const logs  = getSleepLogs();
  const data  = days.map(d => { const s = logs.find(l => l.date === d); return s ? +s.hours.toFixed(1) : 0; });
  const labels = days.map(d => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday:'short' }));
  if (dashCharts['c-sleep']) dashCharts['c-sleep'].destroy();
  const ctx = document.getElementById('c-sleep');
  if (!ctx) return;
  dashCharts['c-sleep'] = new Chart(ctx.getContext('2d'), {
    type: 'line',
    data: { labels, datasets: [{ data, borderColor:'#3a85e0', backgroundColor:'rgba(58,133,224,0.1)', tension:0.4, fill:true, pointBackgroundColor:'#3a85e0', pointRadius:4 }] },
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}, tooltip:{callbacks:{label:c=>c.raw+'h'}}}, scales:{ x:{grid:{display:false},ticks:{color:'#5c5a65',font:{size:11}}}, y:{grid:{color:'rgba(255,255,255,0.04)'},ticks:{color:'#5c5a65',font:{size:11}}} } }
  });
}

function renderSleepHistory() {
  const el = document.getElementById('sleep-hist');
  if (!el) return;
  const logs = getSleepLogs();
  if (!logs.length) { el.innerHTML = '<div class="empty-state"><i class="ti ti-moon"></i>No sleep logged yet</div>'; return; }
  el.innerHTML = logs.slice(0, 30).map(l => `
    <div class="log-item">
      <div class="log-dot sleep"></div>
      <span class="log-text">${l.date} · ${l.bed} → ${l.wake} · ${l.hours.toFixed(1)}h · ${'★'.repeat(l.quality||3)}${l.note ? ' · ' + escHtml(l.note) : ''}</span>
      <span class="task-del" onclick="deleteSleepLog(${l.id})"><i class="ti ti-x"></i></span>
    </div>`).join('');
}

function deleteSleepLog(id) {
  setSleepLogs(getSleepLogs().filter(l => l.id !== id));
  loadSleepPage();
  toast('Sleep log removed');
}

/* ── HABITS ── */
function getHabits()  { return DB.get(UK('habits'), []); }
function setHabits(h) { DB.set(UK('habits'), h); }
function getHabitLog()  { return DB.get(UK('habit_log'), {}); }
function setHabitLog(l) { DB.set(UK('habit_log'), l); }

function openHModal()  { document.getElementById('h-modal').style.display = 'flex'; }
function closeHModal() { document.getElementById('h-modal').style.display = 'none'; }

function saveHabit() {
  const name  = document.getElementById('h-name').value.trim();
  const emoji = document.getElementById('h-emoji').value.trim() || '✅';
  const cat   = document.getElementById('h-cat').value;
  if (!name) { toast('Enter a habit name'); return; }
  const habits = getHabits();
  habits.push({ id: Date.now(), name, emoji, cat, created: todayStr() });
  setHabits(habits);
  document.getElementById('h-name').value  = '';
  document.getElementById('h-emoji').value = '';
  closeHModal(); loadHabits(); toast('Habit added! 💚');
}

function toggleHabit(id) {
  unlockAudio();
  const log = getHabitLog();
  const key = id + '_' + todayStr();
  log[key] = !log[key];
  setHabitLog(log);
  if (log[key]) {
    const h = getHabits().find(h => h.id === id);
    addLog({ type:'habit', label:`Completed habit: ${h ? h.emoji + ' ' + h.name : ''}`, date: todayStr() });
    toast(`Habit done! ${h ? h.emoji : '✅'}`);
  }
  loadHabits();
}

function deleteHabit(id) {
  setHabits(getHabits().filter(h => h.id !== id));
  loadHabits(); toast('Habit removed');
}

function loadHabits() {
  const habits = getHabits();
  const log    = getHabitLog();
  const today  = todayStr();
  const el = document.getElementById('habits-today');
  if (!el) return;
  const hd = document.getElementById('hd-today');
  if (hd) hd.textContent = new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' });

  if (!habits.length) {
    el.innerHTML = '<div class="empty-state"><i class="ti ti-heart"></i>Add your first habit above!</div>';
  } else {
    el.innerHTML = habits.map(h => {
      const done = !!log[h.id + '_' + today];
      return `<div class="habit-row">
        <span class="habit-emoji">${h.emoji}</span>
        <div style="flex:1"><div class="habit-name">${escHtml(h.name)}</div><div class="habit-cat">${h.cat}</div></div>
        <button class="habit-chk ${done ? 'done' : ''}" onclick="toggleHabit(${h.id})">${done ? '<i class="ti ti-check"></i>' : ''}</button>
        <button class="habit-del-btn" onclick="deleteHabit(${h.id})"><i class="ti ti-trash"></i></button>
      </div>`;
    }).join('');
  }
  renderHabitWeek(habits, log);
}

function renderHabitWeek(habits, log) {
  const el   = document.getElementById('habits-week');
  if (!el) return;
  const days  = last7Days();
  const today = todayStr();
  const labels = days.map(d => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday:'short' }));
  if (!habits.length) { el.innerHTML = ''; return; }
  el.innerHTML = habits.map(h => `
    <div class="habit-week-row">
      <div class="hwn">${h.emoji} ${escHtml(h.name)}</div>
      <div class="hw-dots">
        ${days.map((d, i) => `<div class="hw-d ${log[h.id+'_'+d] ? 'done' : ''} ${d===today ? 'today' : ''}">${labels[i]}</div>`).join('')}
      </div>
    </div>`).join('');
}

/* ── WATER ── */
function getWaterLogs()  { return DB.get(UK('water'), {}); }
function setWaterLogs(l) { DB.set(UK('water'), l); }
function getWaterGoal()  { return DB.get(UK('water_goal'), 8); }
function setWaterGoal(g) { DB.set(UK('water_goal'), g); }

function addWater()    { unlockAudio(); adjWater(1); }
function removeWater() { adjWater(-1); }

function adjWater(delta) {
  const logs  = getWaterLogs();
  const today = todayStr();
  logs[today] = Math.max(0, Math.min(20, (logs[today] || 0) + delta));
  setWaterLogs(logs);
  if (delta > 0) addLog({ type:'water', label:`Drank a glass of water 💧 (${logs[today]} today)`, date: today });
  loadWaterPage();
}

function adjWGoal(delta) {
  const g = Math.max(1, Math.min(20, getWaterGoal() + delta));
  setWaterGoal(g);
  document.getElementById('w-goal-num').textContent = g;
  document.getElementById('w-goal-lbl').textContent = g + ' glasses';
  loadWaterPage();
}

function loadWaterPage() {
  const logs  = getWaterLogs();
  const today = todayStr();
  const goal  = getWaterGoal();
  const count = logs[today] || 0;
  document.getElementById('w-count').textContent    = count;
  document.getElementById('w-goal-num').textContent = goal;
  document.getElementById('w-goal-lbl').textContent = goal + ' glasses';
  // Ring
  const circ = 2 * Math.PI * 85;
  const fg   = document.getElementById('wr-fg');
  if (fg) {
    fg.style.strokeDasharray  = circ;
    fg.style.strokeDashoffset = circ * (1 - Math.min(count / goal, 1));
  }
  // Cups
  const cupsEl = document.getElementById('w-cups');
  if (cupsEl) {
    cupsEl.innerHTML = Array.from({ length: goal }, (_, i) =>
      `<div class="water-cup ${i < count ? 'filled' : ''}">💧</div>`
    ).join('');
  }
  // Stats
  const vals = Object.values(logs).filter(v => v > 0);
  document.getElementById('wst-avg').textContent    = vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1) : '0';
  document.getElementById('wst-best').textContent   = vals.length ? Math.max(...vals) : '0';
  const streak = calcWaterStreak(logs, goal);
  document.getElementById('wst-streak').textContent = streak;
  renderWaterChart(logs, goal);
}

function calcWaterStreak(logs, goal) {
  let s = 0; const d = new Date();
  while (true) {
    const str = d.toISOString().slice(0, 10);
    if ((logs[str] || 0) >= goal) { s++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return s;
}

function renderWaterChart(logs, goal) {
  const days   = last7Days();
  const data   = days.map(d => logs[d] || 0);
  const labels = days.map(d => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday:'short' }));
  if (dashCharts['c-water']) dashCharts['c-water'].destroy();
  const ctx = document.getElementById('c-water');
  if (!ctx) return;
  dashCharts['c-water'] = new Chart(ctx.getContext('2d'), {
    type: 'bar',
    data: { labels, datasets: [
      { data, backgroundColor: data.map(v => v >= goal ? '#15b5c8aa' : '#15b5c844'), borderColor: '#15b5c8', borderWidth: 1.5, borderRadius: 6 },
      { data: Array(7).fill(goal), type:'line', borderColor:'rgba(21,181,200,0.4)', borderDash:[4,4], pointRadius:0, fill:false }
    ]},
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ x:{grid:{display:false},ticks:{color:'#5c5a65',font:{size:11}}}, y:{grid:{color:'rgba(255,255,255,0.04)'},ticks:{color:'#5c5a65',font:{size:11}}} } }
  });
}

/* ── NOTES ── */
let currentNoteId = null;

function getNotes()  { return DB.get(UK('notes'), []); }
function setNotes(n) { DB.set(UK('notes'), n); }

function loadNotesPage() {
  renderNotesList();
  const notes = getNotes();
  if (notes.length) openNoteEditor(notes[0].id);
  else clearNoteEditor();
}

function renderNotesList() {
  const notes = getNotes();
  const el    = document.getElementById('notes-list');
  if (!el) return;
  if (!notes.length) {
    el.innerHTML = '<div class="notes-empty"><i class="ti ti-notes"></i>No notes yet.<br/>Click "New note" to start</div>';
    return;
  }
  el.innerHTML = notes.map(n => `
    <div class="note-item ${n.id === currentNoteId ? 'active' : ''}" onclick="openNoteEditor(${n.id})">
      <div class="ni-title">${escHtml(n.title || 'Untitled')}</div>
      <div class="ni-preview">${escHtml((n.body || '').slice(0, 80))}</div>
      <div class="ni-date">${new Date(n.ts).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}${n.tags ? ' · ' + escHtml(n.tags) : ''}</div>
    </div>`).join('');
}

function newNote() {
  const note = { id: Date.now(), title: '', body: '', tags: '', ts: new Date().toISOString() };
  const notes = getNotes();
  notes.unshift(note);
  setNotes(notes);
  currentNoteId = note.id;
  renderNotesList();
  openNoteEditor(note.id);
  document.getElementById('note-title').focus();
}

function openNoteEditor(id) {
  const notes = getNotes();
  const note  = notes.find(n => n.id === id);
  if (!note) return;
  currentNoteId = id;
  document.getElementById('note-title').value = note.title || '';
  document.getElementById('note-body').value  = note.body  || '';
  document.getElementById('note-tags').value  = note.tags  || '';
  renderNotesList();
}

function saveNote() {
  const notes = getNotes();
  const idx   = notes.findIndex(n => n.id === currentNoteId);
  if (idx === -1) return;
  notes[idx].title = document.getElementById('note-title').value.trim() || 'Untitled';
  notes[idx].body  = document.getElementById('note-body').value;
  notes[idx].tags  = document.getElementById('note-tags').value.trim();
  notes[idx].ts    = new Date().toISOString();
  setNotes(notes);
  renderNotesList();
  addLog({ type:'note', label:`Saved note: "${notes[idx].title}"`, date: todayStr() });
  toast('Note saved! 📝');
}

function deleteNote() {
  if (!currentNoteId) return;
  setNotes(getNotes().filter(n => n.id !== currentNoteId));
  currentNoteId = null;
  clearNoteEditor();
  loadNotesPage();
  toast('Note deleted');
}

function clearNoteEditor() {
  ['note-title','note-body','note-tags'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
}

/* ── ANALYTICS ── */
let anCharts = {};

function renderAnalytics() {
  const logs  = getLogs();
  const slogs = getSleepLogs();
  const fm    = focusMinTotal(logs);
  document.getElementById('an-focus').textContent = (fm / 60).toFixed(1) + 'h';
  const avgSl = slogs.length ? slogs.reduce((s, l) => s + l.hours, 0) / slogs.length : 0;
  document.getElementById('an-sleep').textContent = avgSl ? avgSl.toFixed(1) + 'h' : '—';
  const days  = [...new Set(logs.map(l => l.date))];
  document.getElementById('an-days').textContent = days.length;
  const byDay = {};
  logs.filter(l => l.type === 'focus').forEach(l => { byDay[l.date] = (byDay[l.date] || 0) + (l.minutes || 0); });
  const best  = Object.entries(byDay).sort((a,b) => b[1]-a[1])[0];
  document.getElementById('an-best').textContent = best ? new Date(best[0]+'T00:00:00').toLocaleDateString('en-GB', {day:'numeric',month:'short'}) : '—';
  render14Chart(logs);
  renderPie(logs, slogs);
  renderScatter(logs, slogs);
  renderLogList('an-log', logs, 50);
}

function render14Chart(logs) {
  const days  = Array.from({length:14}, (_,i) => { const d=new Date(); d.setDate(d.getDate()-(13-i)); return d.toISOString().slice(0,10); });
  const data  = days.map(d => logs.filter(l => l.type==='focus' && l.date===d).reduce((s,l)=>s+(l.minutes||0),0));
  const labels = days.map(d => new Date(d+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'}));
  if (anCharts.f14) anCharts.f14.destroy();
  const ctx = document.getElementById('c-an-focus');
  if (!ctx) return;
  anCharts.f14 = new Chart(ctx.getContext('2d'), {
    type:'bar',
    data:{ labels, datasets:[{ data, backgroundColor: days.map((_,i)=> i===13 ? '#7c6fcd' : '#7c6fcd44'), borderRadius:6, borderSkipped:false }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>c.raw+'min'}}}, scales:{ x:{grid:{display:false},ticks:{color:'#5c5a65',font:{size:10}}}, y:{grid:{color:'rgba(255,255,255,0.04)'},ticks:{color:'#5c5a65',font:{size:11}}} } }
  });
}

function renderPie(logs, slogs) {
  const daysN = Math.max(1, [...new Set(logs.map(l=>l.date))].length);
  const fh = +(focusMinTotal(logs) / daysN / 60).toFixed(1);
  const sh = +(slogs.reduce((s,l)=>s+l.hours,0) / Math.max(1,slogs.length)).toFixed(1);
  const ot = Math.max(0, +(24 - fh - sh).toFixed(1));
  if (anCharts.pie) anCharts.pie.destroy();
  const ctx = document.getElementById('c-pie');
  if (!ctx) return;
  anCharts.pie = new Chart(ctx.getContext('2d'), {
    type:'doughnut',
    data:{ labels:['Focus','Sleep','Other'], datasets:[{ data:[fh,sh,ot], backgroundColor:['#7c6fcd','#3a85e0','#27272f'], borderWidth:0, spacing:2 }] },
    options:{ responsive:true, maintainAspectRatio:false, cutout:'65%', plugins:{ legend:{ position:'bottom', labels:{ color:'#9896a0', font:{size:12}, padding:16 } } } }
  });
}

function renderScatter(logs, slogs) {
  const fd = {};
  logs.filter(l=>l.type==='focus').forEach(l => { fd[l.date]=(fd[l.date]||0)+(l.minutes||0); });
  const pts = slogs.map(s => ({ x:+s.hours.toFixed(1), y: fd[s.date]||0 })).filter(p=>p.y>0);
  if (anCharts.sc) anCharts.sc.destroy();
  const ctx = document.getElementById('c-scatter');
  if (!ctx) return;
  anCharts.sc = new Chart(ctx.getContext('2d'), {
    type:'scatter',
    data:{ datasets:[{ data:pts, backgroundColor:'#7c6fcd', pointRadius:6, pointHoverRadius:8 }] },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false}, tooltip:{callbacks:{label:c=>`Sleep: ${c.raw.x}h · Focus: ${c.raw.y}min`}} },
      scales:{
        x:{ title:{display:true,text:'Sleep (hours)',color:'#5c5a65',font:{size:11}}, grid:{color:'rgba(255,255,255,0.04)'}, ticks:{color:'#5c5a65',font:{size:11}} },
        y:{ title:{display:true,text:'Focus (min)',color:'#5c5a65',font:{size:11}},   grid:{color:'rgba(255,255,255,0.04)'}, ticks:{color:'#5c5a65',font:{size:11}} }
      }
    }
  });
}

/* ── UTILITIES ── */
function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

/* ── BOOT ── */
window.addEventListener('DOMContentLoaded', () => {
  const uid = DB.get('ff_session');
  if (uid && getUsers()[uid]) {
    currentUser = uid;
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'grid';
    initApp();
  }
  // Auto-save note on body changes
  document.getElementById('note-body')?.addEventListener('input', debounce(() => {
    if (currentNoteId) saveNote();
  }, 1500));
});

function debounce(fn, ms) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

// Close sidebar on outside click (mobile)
document.addEventListener('click', e => {
  const sb  = document.getElementById('sidebar');
  const btn = document.querySelector('.topbar-menu');
  const ov  = document.getElementById('sb-overlay');
  if (ov?.classList.contains('open') && !sb?.contains(e.target) && e.target !== btn) closeSidebar();
});
