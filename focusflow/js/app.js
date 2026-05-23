/* FocusFlow — by Omar Mohamed */

/* ── Storage helpers ── */
const DB = {
  get: (k, def = null) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
  del: (k) => localStorage.removeItem(k),
};

/* ── Auth ── */
let currentUser = null;

function getUsers() { return DB.get('ff_users', {}); }
function saveUsers(u) { DB.set('ff_users', u); }
function userKey(uid, sub) { return `ff_user_${uid}_${sub}`; }

function showAuthTab(tab) {
  document.getElementById('login-form').style.display = tab === 'login' ? '' : 'none';
  document.getElementById('register-form').style.display = tab === 'register' ? '' : 'none';
  document.querySelectorAll('.tab-btn').forEach((b, i) => b.classList.toggle('active', (i === 0) === (tab === 'login')));
}

function doRegister() {
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim().toLowerCase();
  const pw = document.getElementById('reg-pw').value;
  const err = document.getElementById('reg-err');
  if (!name || !email || !pw) { err.textContent = 'All fields required.'; return; }
  if (pw.length < 6) { err.textContent = 'Password must be 6+ characters.'; return; }
  const users = getUsers();
  if (Object.values(users).find(u => u.email === email)) { err.textContent = 'Email already registered.'; return; }
  const uid = 'u_' + Date.now();
  users[uid] = { uid, name, email, pw: btoa(pw), joined: new Date().toISOString() };
  saveUsers(users);
  DB.set(`ff_profile_${uid}`, { name, email, bio: '', goal: 120, sleepGoal: 8, avatar: '' });
  login(uid);
}

function doLogin() {
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const pw = document.getElementById('login-pw').value;
  const err = document.getElementById('login-err');
  const users = getUsers();
  const user = Object.values(users).find(u => u.email === email && u.pw === btoa(pw));
  if (!user) { err.textContent = 'Invalid email or password.'; return; }
  login(user.uid);
}

function login(uid) {
  DB.set('ff_session', uid);
  currentUser = uid;
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'grid';
  initApp();
}

function doLogout() {
  if (timerRunning) stopTimer();
  DB.del('ff_session');
  currentUser = null;
  document.getElementById('app-screen').style.display = 'none';
  document.getElementById('auth-screen').style.display = '';
  document.getElementById('login-err').textContent = '';
}

function togglePw(id, icon) {
  const inp = document.getElementById(id);
  const isText = inp.type === 'text';
  inp.type = isText ? 'password' : 'text';
  icon.className = isText ? 'ti ti-eye' : 'ti ti-eye-off';
}

/* ── Init ── */
function initApp() {
  loadProfile();
  navigate('dashboard');
  renderDots();
  renderTasks();
  setTimerMode('focus');
  loadSleepPage();
  loadHabits();
  setupSleepDate();
}

/* ── Navigation ── */
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelector(`[data-page="${page}"]`)?.classList.add('active');
  document.getElementById('topbar-title').textContent = { dashboard: 'Dashboard', timer: 'Pomodoro timer', sleep: 'Sleep tracker', habits: 'Habits', analytics: 'Analytics', profile: 'Profile' }[page] || page;
  if (page === 'dashboard') renderDashboard();
  if (page === 'analytics') renderAnalytics();
  if (page === 'profile') renderProfile();
  if (page === 'habits') { loadHabits(); renderHabitDate(); }
  if (page === 'sleep') loadSleepPage();
  closeSidebar();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
}

/* ── Profile ── */
function getProfile() {
  return DB.get(`ff_profile_${currentUser}`, { name: 'Omar Mohamed', email: '', bio: '', goal: 120, sleepGoal: 8, avatar: '' });
}
function saveProfileData(p) { DB.set(`ff_profile_${currentUser}`, p); }

function loadProfile() {
  const p = getProfile();
  const initials = p.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  setAvatarEl('sb-avatar', p.avatar, initials);
  setAvatarEl('tb-avatar', p.avatar, initials);
  setAvatarEl('dash-avatar', p.avatar, initials);
  document.getElementById('sb-name').textContent = p.name;
  document.getElementById('dash-greeting').textContent = greet(p.name);
  document.getElementById('dash-date').textContent = new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function setAvatarEl(id, avatar, initials) {
  const el = document.getElementById(id);
  if (!el) return;
  if (avatar) { el.innerHTML = `<img src="${avatar}" alt="avatar"/>`; }
  else { el.textContent = initials; }
}

function greet(name) {
  const h = new Date().getHours();
  const g = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return `${g}, ${name.split(' ')[0]} 👋`;
}

function renderProfile() {
  const p = getProfile();
  const initials = p.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  setAvatarEl('profile-avatar', p.avatar, initials);
  document.getElementById('profile-name-big').textContent = p.name;
  document.getElementById('profile-email-big').textContent = p.email || '';
  document.getElementById('edit-name').value = p.name;
  document.getElementById('edit-bio').value = p.bio || '';
  document.getElementById('edit-goal').value = p.goal || 120;
  document.getElementById('edit-sleep-goal').value = p.sleepGoal || 8;
  renderBadges();
  renderAchievements();
}

function saveProfile() {
  const p = getProfile();
  p.name = document.getElementById('edit-name').value.trim() || p.name;
  p.bio = document.getElementById('edit-bio').value.trim();
  p.goal = parseInt(document.getElementById('edit-goal').value) || 120;
  p.sleepGoal = parseFloat(document.getElementById('edit-sleep-goal').value) || 8;
  saveProfileData(p);
  loadProfile();
  renderProfile();
  toast('Profile saved!');
}

function uploadAvatar(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const p = getProfile();
    p.avatar = e.target.result;
    saveProfileData(p);
    loadProfile();
    renderProfile();
    toast('Photo updated!');
  };
  reader.readAsDataURL(file);
}

function renderBadges() {
  const logs = getLogs();
  const focusMin = logs.filter(l => l.type === 'focus').reduce((s, l) => s + (l.minutes || 0), 0);
  const badges = [];
  if (focusMin >= 60) badges.push('1h Focus');
  if (focusMin >= 600) badges.push('10h Focus');
  if (getSleepLogs().length >= 7) badges.push('7-Day Sleeper');
  if (getHabits().length >= 3) badges.push('Habit Builder');
  const el = document.getElementById('profile-badges');
  el.innerHTML = badges.length ? badges.map(b => `<span class="badge">${b}</span>`).join('') : '<span style="font-size:13px;color:var(--text3)">Complete sessions to earn badges</span>';
}

const ACHIEVEMENTS = [
  { id: 'first_session', icon: '🎯', name: 'First session', desc: 'Complete your first focus session', check: (logs) => logs.filter(l => l.type === 'session').length >= 1 },
  { id: 'ten_sessions', icon: '🔥', name: 'On fire', desc: 'Complete 10 focus sessions', check: (logs) => logs.filter(l => l.type === 'session').length >= 10 },
  { id: 'hundred_sessions', icon: '💯', name: 'Century', desc: 'Complete 100 focus sessions', check: (logs) => logs.filter(l => l.type === 'session').length >= 100 },
  { id: 'first_sleep', icon: '🌙', name: 'Early to bed', desc: 'Log your first sleep', check: () => getSleepLogs().length >= 1 },
  { id: 'sleep_week', icon: '😴', name: 'Sleep champion', desc: 'Log sleep for 7 days', check: () => getSleepLogs().length >= 7 },
  { id: 'five_hours', icon: '⏰', name: 'Deep work', desc: 'Focus for 5 hours total', check: (logs) => logs.filter(l => l.type === 'focus').reduce((s, l) => s + (l.minutes || 0), 0) >= 300 },
  { id: 'habit_streak', icon: '✅', name: 'Habit master', desc: 'Complete all habits for a day', check: () => { const h = getHabits(); const today = todayStr(); return h.length > 0 && h.every(hb => (DB.get(userKey(currentUser, 'habit_log'), {}))[hb.id + '_' + today]); } },
  { id: 'profile_photo', icon: '📸', name: 'Face behind the focus', desc: 'Upload a profile photo', check: () => !!getProfile().avatar },
];

function renderAchievements() {
  const logs = getLogs();
  const grid = document.getElementById('achievements-grid');
  grid.innerHTML = ACHIEVEMENTS.map(a => {
    const done = a.check(logs);
    return `<div class="ach-item ${done ? '' : 'locked'}">
      <div class="ach-icon">${a.icon}</div>
      <div class="ach-name">${a.name}</div>
      <div class="ach-desc">${a.desc}</div>
    </div>`;
  }).join('');
}

/* ── Logs ── */
function getLogs() { return DB.get(userKey(currentUser, 'logs'), []); }
function addLog(entry) {
  const logs = getLogs();
  logs.unshift({ ...entry, id: Date.now(), ts: new Date().toISOString() });
  DB.set(userKey(currentUser, 'logs'), logs.slice(0, 1000));
}

function todayStr() { return new Date().toISOString().slice(0, 10); }

function getTodayFocusMin() {
  return getLogs().filter(l => l.type === 'focus' && l.date === todayStr()).reduce((s, l) => s + (l.minutes || 0), 0);
}

/* ── Dashboard ── */
let focusChart = null, sleepChart = null;

function renderDashboard() {
  loadProfile();
  const focusMin = getTodayFocusMin();
  document.getElementById('stat-focus-today').textContent = focusMin >= 60 ? Math.round(focusMin / 6) / 10 + 'h' : focusMin + 'm';
  const sleepLogs = getSleepLogs();
  const lastSleep = sleepLogs[0];
  document.getElementById('stat-sleep-last').textContent = lastSleep ? lastSleep.hours.toFixed(1) + 'h' : '—';
  document.getElementById('stat-streak').textContent = calcFocusStreak();
  const tasks = getTasks();
  const done = tasks.filter(t => t.done).length;
  document.getElementById('stat-tasks-done').textContent = `${done}/${tasks.length}`;
  renderActivityLog();
  renderWeeklyFocusChart();
  renderWeeklySleepChart();
}

function renderActivityLog() {
  const logs = getLogs().slice(0, 20);
  const el = document.getElementById('activity-log');
  if (!logs.length) { el.innerHTML = '<p style="font-size:13px;color:var(--text3);padding:12px 0">No activity yet — start your first session!</p>'; return; }
  el.innerHTML = logs.map(l => `
    <div class="log-item">
      <div class="log-dot ${l.type}"></div>
      <span class="log-text">${l.label}</span>
      <span class="log-time">${fmtLogTime(l.ts)}</span>
    </div>`).join('');
}

function fmtLogTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diff = (now - d) / 60000;
  if (diff < 1) return 'just now';
  if (diff < 60) return Math.round(diff) + 'm ago';
  if (diff < 1440) return Math.round(diff / 60) + 'h ago';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function getLast7Days() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
}

function renderWeeklyFocusChart() {
  const days = getLast7Days();
  const logs = getLogs();
  const data = days.map(d => logs.filter(l => l.type === 'focus' && l.date === d).reduce((s, l) => s + (l.minutes || 0), 0));
  const labels = days.map(d => new Date(d).toLocaleDateString('en-GB', { weekday: 'short' }));
  if (focusChart) focusChart.destroy();
  const ctx = document.getElementById('chart-focus').getContext('2d');
  focusChart = new Chart(ctx, { type: 'bar', data: { labels, datasets: [{ data, backgroundColor: '#534AB7', borderRadius: 6 }] }, options: chartOpts('min') });
}

function renderWeeklySleepChart() {
  const days = getLast7Days();
  const slogs = getSleepLogs();
  const data = days.map(d => { const s = slogs.find(l => l.date === d); return s ? +s.hours.toFixed(1) : 0; });
  const labels = days.map(d => new Date(d).toLocaleDateString('en-GB', { weekday: 'short' }));
  if (sleepChart) sleepChart.destroy();
  const ctx = document.getElementById('chart-sleep').getContext('2d');
  sleepChart = new Chart(ctx, { type: 'bar', data: { labels, datasets: [{ data, backgroundColor: '#185FA5', borderRadius: 6 }] }, options: chartOpts('h') });
}

function chartOpts(unit) {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ctx.raw + unit } } },
    scales: { x: { grid: { display: false }, ticks: { font: { size: 11 } } }, y: { grid: { color: 'rgba(128,128,128,0.1)' }, ticks: { font: { size: 11 } } } }
  };
}

function calcFocusStreak() {
  const logs = getLogs();
  let streak = 0, day = new Date();
  while (true) {
    const d = day.toISOString().slice(0, 10);
    const hasFocus = logs.some(l => l.type === 'focus' && l.date === d);
    if (!hasFocus) break;
    streak++;
    day.setDate(day.getDate() - 1);
  }
  return streak;
}

/* ── Timer ── */
const timerDurations = { focus: 25, short: 5, long: 15 };
let timerMode = 'focus';
let timerTotal = 25 * 60;
let timerRemaining = 25 * 60;
let timerRunning = false;
let timerInterval = null;
let sessionsToday = 0;
let audioCtx = null;

function getAudioCtx() { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); return audioCtx; }
function playTone(f, type, dur, gain) {
  try {
    const ctx = getAudioCtx();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = type; o.frequency.setValueAtTime(f, ctx.currentTime);
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.start(); o.stop(ctx.currentTime + dur);
  } catch {}
}
function playBell() {
  if (!document.getElementById('snd-on').checked) return;
  const notes = timerMode === 'focus' ? [523, 659, 784, 1047] : [784, 659, 523];
  notes.forEach((f, i) => setTimeout(() => playTone(f, 'sine', 0.8, 0.22), i * 210));
}
function playTick() {
  if (!document.getElementById('tick-on').checked || !timerRunning) return;
  try {
    const ctx = getAudioCtx();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.012, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.07;
    const src = ctx.createBufferSource(), g = ctx.createGain();
    g.gain.setValueAtTime(0.1, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.012);
    src.buffer = buf; src.connect(g); g.connect(ctx.destination); src.start();
  } catch {}
}

function fmtTime(s) { return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }

function ringColor() { return { focus: '#534AB7', short: '#0F6E56', long: '#185FA5' }[timerMode]; }

function updateRingDisplay() {
  const circ = 2 * Math.PI * 100;
  const prog = document.getElementById('ring-prog');
  prog.style.strokeDasharray = circ;
  prog.style.strokeDashoffset = circ * (1 - timerRemaining / timerTotal);
  prog.style.stroke = ringColor();
  document.getElementById('timer-disp').textContent = fmtTime(timerRemaining);
}

function setTimerMode(m) {
  if (timerRunning) stopTimer();
  timerMode = m;
  timerTotal = timerDurations[m] * 60;
  timerRemaining = timerTotal;
  document.querySelectorAll('.mode-tab').forEach((t, i) => t.classList.toggle('active', ['focus', 'short', 'long'][i] === m));
  const lbl = { focus: 'focus time', short: 'short break', long: 'long break' };
  document.getElementById('timer-mode-lbl').textContent = lbl[m];
  document.getElementById('play-icon').className = 'ti ti-player-play';
  updateRingDisplay();
}

function toggleTimer() { timerRunning ? stopTimer() : startTimer(); }

function startTimer() {
  timerRunning = true;
  document.getElementById('play-icon').className = 'ti ti-player-pause';
  timerInterval = setInterval(() => {
    if (timerRemaining <= 0) { onTimerEnd(); return; }
    timerRemaining--;
    playTick();
    updateRingDisplay();
    updateTimerStats();
  }, 1000);
}

function stopTimer() {
  timerRunning = false;
  clearInterval(timerInterval);
  document.getElementById('play-icon').className = 'ti ti-player-play';
}

function resetTimer() { stopTimer(); timerRemaining = timerTotal; updateRingDisplay(); }
function skipTimerSession() { stopTimer(); onTimerEnd(true); }

function onTimerEnd(skipped = false) {
  stopTimer();
  timerRemaining = 0; updateRingDisplay();
  if (!skipped) playBell();
  if (timerMode === 'focus') {
    sessionsToday++;
    const min = timerDurations.focus;
    addLog({ type: 'focus', label: `Completed ${min}min focus session`, minutes: min, date: todayStr() });
    addLog({ type: 'session', label: 'Pomodoro session completed', minutes: min, date: todayStr() });
    updateTimerStats();
    toast('Session complete! 🎉');
    const next = sessionsToday % 4 === 0 ? 'long' : 'short';
    const auto = document.getElementById('auto-on').checked;
    setTimeout(() => { setTimerMode(next); if (auto) startTimer(); }, 1000);
  } else {
    toast('Break over — back to focus!');
    const auto = document.getElementById('auto-on').checked;
    setTimeout(() => { setTimerMode('focus'); if (auto) startTimer(); }, 1000);
  }
  renderDots();
}

function updateTimerStats() {
  document.getElementById('ts-sessions').textContent = sessionsToday;
  document.getElementById('ts-focus').textContent = getTodayFocusMin() + 'm';
  document.getElementById('ts-streak').textContent = calcFocusStreak();
}

function renderDots() {
  const wrap = document.getElementById('session-dots');
  if (!wrap) return;
  wrap.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const d = document.createElement('div');
    const pos = sessionsToday % 4;
    d.className = 'dot' + (i < pos ? ' done' : (i === pos && timerMode === 'focus' && timerRunning ? ' active' : ''));
    wrap.appendChild(d);
  }
}

function adjDur(key, delta) {
  timerDurations[key] = Math.max(1, timerDurations[key] + delta);
  document.getElementById('dur-' + key).textContent = timerDurations[key] + 'm';
  if (timerMode === key) { timerTotal = timerDurations[key] * 60; if (!timerRunning) { timerRemaining = timerTotal; updateRingDisplay(); } }
}

/* ── Tasks ── */
function getTasks() { return DB.get(userKey(currentUser, 'tasks'), []); }
function saveTasks(t) { DB.set(userKey(currentUser, 'tasks'), t); }

function addTask() {
  const inp = document.getElementById('task-input');
  const val = inp.value.trim();
  if (!val) return;
  const tasks = getTasks();
  tasks.push({ id: Date.now(), text: val, done: false, date: todayStr() });
  saveTasks(tasks);
  inp.value = '';
  renderTasks();
}

function toggleTask(id) {
  const tasks = getTasks();
  const t = tasks.find(t => t.id === id);
  if (t) { t.done = !t.done; saveTasks(tasks); renderTasks(); }
}

function deleteTask(id) {
  const tasks = getTasks().filter(t => t.id !== id);
  saveTasks(tasks);
  renderTasks();
}

function renderTasks() {
  const list = document.getElementById('task-list');
  if (!list) return;
  const tasks = getTasks().filter(t => t.date === todayStr());
  list.innerHTML = tasks.length ? tasks.map(t => `
    <div class="task-item">
      <div class="task-check ${t.done ? 'done' : ''}" onclick="toggleTask(${t.id})">${t.done ? '<i class="ti ti-check"></i>' : ''}</div>
      <span class="task-text ${t.done ? 'done' : ''}">${escHtml(t.text)}</span>
      <span class="task-del" onclick="deleteTask(${t.id})"><i class="ti ti-x"></i></span>
    </div>`).join('') : '<p style="font-size:13px;color:var(--text3);padding:10px 0">No tasks yet — add one above!</p>';
}

function escHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

/* ── Sleep ── */
let sleepStarVal = 0;
let sleepPageChart = null;

function setupSleepDate() {
  const el = document.getElementById('sleep-date');
  if (el) el.value = todayStr();
}

function setSleepStar(v) {
  sleepStarVal = v;
  document.querySelectorAll('#sleep-stars i').forEach((s, i) => s.classList.toggle('lit', i < v));
}

function getSleepLogs() { return DB.get(userKey(currentUser, 'sleep'), []); }
function saveSleepLogs(l) { DB.set(userKey(currentUser, 'sleep'), l); }

function calcSleepHours(bed, wake) {
  const [bh, bm] = bed.split(':').map(Number);
  const [wh, wm] = wake.split(':').map(Number);
  let mins = (wh * 60 + wm) - (bh * 60 + bm);
  if (mins < 0) mins += 1440;
  return +(mins / 60).toFixed(2);
}

function logSleep() {
  const bed = document.getElementById('sleep-bed').value;
  const wake = document.getElementById('sleep-wake').value;
  const date = document.getElementById('sleep-date').value;
  if (!bed || !wake || !date) { toast('Fill in all fields!'); return; }
  const hours = calcSleepHours(bed, wake);
  const logs = getSleepLogs();
  const existing = logs.findIndex(l => l.date === date);
  const entry = { id: Date.now(), date, bed, wake, hours, quality: sleepStarVal || 3 };
  if (existing > -1) logs[existing] = entry; else logs.unshift(entry);
  saveSleepLogs(logs);
  addLog({ type: 'sleep', label: `Slept ${hours.toFixed(1)}h (${bed} → ${wake})`, date });
  toast('Sleep logged!');
  setSleepStar(0);
  loadSleepPage();
}

function loadSleepPage() {
  const logs = getSleepLogs();
  if (!logs.length) {
    document.getElementById('avg-sleep').textContent = '—';
    document.getElementById('best-sleep').textContent = '—';
    document.getElementById('avg-quality').textContent = '—';
    document.getElementById('sleep-streak').textContent = '0';
  } else {
    const avg = logs.reduce((s, l) => s + l.hours, 0) / logs.length;
    document.getElementById('avg-sleep').textContent = avg.toFixed(1) + 'h';
    document.getElementById('best-sleep').textContent = Math.max(...logs.map(l => l.hours)).toFixed(1) + 'h';
    const avgQ = logs.reduce((s, l) => s + (l.quality || 3), 0) / logs.length;
    document.getElementById('avg-quality').textContent = avgQ.toFixed(1) + '★';
    document.getElementById('sleep-streak').textContent = logs.length;
  }
  renderSleepHistory();
  renderSleepPageChart();
}

function renderSleepHistory() {
  const logs = getSleepLogs();
  const el = document.getElementById('sleep-history');
  if (!logs.length) { el.innerHTML = '<p style="font-size:13px;color:var(--text3);padding:12px 0">No sleep logged yet.</p>'; return; }
  el.innerHTML = logs.slice(0, 20).map(l => `
    <div class="log-item">
      <div class="log-dot sleep"></div>
      <span class="log-text">${l.date} — ${l.bed} → ${l.wake} (${l.hours.toFixed(1)}h) ${'★'.repeat(l.quality || 3)}</span>
      <span class="task-del" onclick="deleteSleepLog(${l.id})"><i class="ti ti-x"></i></span>
    </div>`).join('');
}

function deleteSleepLog(id) {
  saveSleepLogs(getSleepLogs().filter(l => l.id !== id));
  loadSleepPage();
}

function renderSleepPageChart() {
  const days = getLast7Days();
  const logs = getSleepLogs();
  const data = days.map(d => { const s = logs.find(l => l.date === d); return s ? +s.hours.toFixed(1) : 0; });
  const labels = days.map(d => new Date(d).toLocaleDateString('en-GB', { weekday: 'short' }));
  if (sleepPageChart) sleepPageChart.destroy();
  const ctx = document.getElementById('chart-sleep-page');
  if (!ctx) return;
  sleepPageChart = new Chart(ctx.getContext('2d'), {
    type: 'line',
    data: { labels, datasets: [{ data, borderColor: '#185FA5', backgroundColor: 'rgba(24,95,165,0.1)', tension: 0.4, fill: true, pointBackgroundColor: '#185FA5' }] },
    options: { ...chartOpts('h'), plugins: { legend: { display: false } } }
  });
}

/* ── Habits ── */
function getHabits() { return DB.get(userKey(currentUser, 'habits'), []); }
function saveHabits(h) { DB.set(userKey(currentUser, 'habits'), h); }
function getHabitLog() { return DB.get(userKey(currentUser, 'habit_log'), {}); }
function saveHabitLog(l) { DB.set(userKey(currentUser, 'habit_log'), l); }

function openHabitModal() { document.getElementById('habit-modal').style.display = 'flex'; }
function closeHabitModal() { document.getElementById('habit-modal').style.display = 'none'; }

function saveHabit() {
  const name = document.getElementById('habit-name-input').value.trim();
  const cat = document.getElementById('habit-cat').value;
  const emoji = document.getElementById('habit-emoji').value.trim() || '✅';
  if (!name) { toast('Enter a habit name!'); return; }
  const habits = getHabits();
  habits.push({ id: Date.now(), name, cat, emoji, created: todayStr() });
  saveHabits(habits);
  document.getElementById('habit-name-input').value = '';
  document.getElementById('habit-emoji').value = '';
  closeHabitModal();
  loadHabits();
  toast('Habit added!');
}

function toggleHabit(id) {
  const log = getHabitLog();
  const key = id + '_' + todayStr();
  log[key] = !log[key];
  saveHabitLog(log);
  if (log[key]) addLog({ type: 'habit', label: 'Completed habit: ' + (getHabits().find(h => h.id === id)?.name || ''), date: todayStr() });
  loadHabits();
}

function deleteHabit(id) {
  saveHabits(getHabits().filter(h => h.id !== id));
  loadHabits();
}

function loadHabits() {
  const habits = getHabits();
  const log = getHabitLog();
  const today = todayStr();
  const todayEl = document.getElementById('habits-today');
  if (!todayEl) return;
  if (!habits.length) {
    todayEl.innerHTML = '<p style="font-size:13px;color:var(--text3);padding:12px 0">No habits yet — add one above!</p>';
  } else {
    todayEl.innerHTML = habits.map(h => {
      const done = !!log[h.id + '_' + today];
      return `<div class="habit-row">
        <span class="habit-emoji">${h.emoji}</span>
        <span class="habit-name">${escHtml(h.name)}</span>
        <button class="habit-check-btn ${done ? 'done' : ''}" onclick="toggleHabit(${h.id})">${done ? '<i class="ti ti-check"></i>' : ''}</button>
        <button class="habit-del-btn" onclick="deleteHabit(${h.id})"><i class="ti ti-trash"></i></button>
      </div>`;
    }).join('');
  }
  renderHabitWeek();
}

function renderHabitDate() {
  const el = document.getElementById('habit-date');
  if (el) el.textContent = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

function renderHabitWeek() {
  const habits = getHabits();
  const log = getHabitLog();
  const days = getLast7Days();
  const labels = days.map(d => new Date(d).toLocaleDateString('en-GB', { weekday: 'short' }));
  const today = todayStr();
  const grid = document.getElementById('habits-week-grid');
  if (!grid) return;
  if (!habits.length) { grid.innerHTML = ''; return; }
  grid.innerHTML = habits.map(h => `
    <div class="habit-week-item">
      <div class="habit-week-name">${h.emoji} ${escHtml(h.name)}</div>
      <div class="habit-week-dots">
        ${days.map((d, i) => {
          const done = !!log[h.id + '_' + d];
          return `<div class="habit-week-dot ${done ? 'done' : ''} ${d === today ? 'today' : ''}">${labels[i]}</div>`;
        }).join('')}
      </div>
    </div>`).join('');
}

/* ── Analytics ── */
let anCharts = {};

function renderAnalytics() {
  const logs = getLogs();
  const slogs = getSleepLogs();
  const focusMins = logs.filter(l => l.type === 'focus').reduce((s, l) => s + (l.minutes || 0), 0);
  document.getElementById('an-total-focus').textContent = Math.round(focusMins / 60 * 10) / 10 + 'h';
  const avgSleep = slogs.length ? slogs.reduce((s, l) => s + l.hours, 0) / slogs.length : 0;
  document.getElementById('an-avg-sleep').textContent = avgSleep ? avgSleep.toFixed(1) + 'h' : '—';
  const uniqueDays = [...new Set(logs.map(l => l.date))];
  document.getElementById('an-days').textContent = uniqueDays.length;

  const dayFocus = {};
  logs.filter(l => l.type === 'focus').forEach(l => { dayFocus[l.date] = (dayFocus[l.date] || 0) + (l.minutes || 0); });
  const bestDay = Object.entries(dayFocus).sort((a, b) => b[1] - a[1])[0];
  document.getElementById('an-best-day').textContent = bestDay ? new Date(bestDay[0]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—';

  render14DayFocusChart(logs);
  renderPieChart(logs, slogs);
  renderScatterChart(logs, slogs);
  renderFullLog(logs);
}

function render14DayFocusChart(logs) {
  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (13 - i)); return d.toISOString().slice(0, 10); });
  const data = days.map(d => logs.filter(l => l.type === 'focus' && l.date === d).reduce((s, l) => s + (l.minutes || 0), 0));
  const labels = days.map(d => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));
  if (anCharts.focus14) anCharts.focus14.destroy();
  const ctx = document.getElementById('chart-focus-14').getContext('2d');
  anCharts.focus14 = new Chart(ctx, { type: 'bar', data: { labels, datasets: [{ data, backgroundColor: days.map((d, i) => i === 13 ? '#534AB7' : '#AFA9EC'), borderRadius: 6 }] }, options: chartOpts('min') });
}

function renderPieChart(logs, slogs) {
  const focusH = logs.filter(l => l.type === 'focus').reduce((s, l) => s + (l.minutes || 0), 0) / 60;
  const sleepH = slogs.reduce((s, l) => s + l.hours, 0);
  const days = Math.max(1, [...new Set(logs.map(l => l.date))].length);
  const avgFocus = +(focusH / days).toFixed(1);
  const avgSleep = +(sleepH / Math.max(1, slogs.length)).toFixed(1);
  const other = Math.max(0, +(24 - avgFocus - avgSleep).toFixed(1));
  if (anCharts.pie) anCharts.pie.destroy();
  const ctx = document.getElementById('chart-pie').getContext('2d');
  anCharts.pie = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Focus', 'Sleep', 'Other'],
      datasets: [{ data: [avgFocus, avgSleep, other], backgroundColor: ['#534AB7', '#185FA5', '#D3D1C7'], borderWidth: 0 }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 12 } } } } }
  });
}

function renderScatterChart(logs, slogs) {
  const focusByDay = {};
  logs.filter(l => l.type === 'focus').forEach(l => { focusByDay[l.date] = (focusByDay[l.date] || 0) + (l.minutes || 0); });
  const points = slogs.map(s => ({ x: +s.hours.toFixed(1), y: +(focusByDay[s.date] || 0) })).filter(p => p.y > 0);
  if (anCharts.scatter) anCharts.scatter.destroy();
  const ctx = document.getElementById('chart-scatter').getContext('2d');
  anCharts.scatter = new Chart(ctx, {
    type: 'scatter',
    data: { datasets: [{ label: 'Sleep vs Focus', data: points, backgroundColor: '#534AB7', pointRadius: 6 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `Sleep: ${c.raw.x}h, Focus: ${c.raw.y}min` } } },
      scales: { x: { title: { display: true, text: 'Sleep (h)', font: { size: 11 } } }, y: { title: { display: true, text: 'Focus (min)', font: { size: 11 } } } }
    }
  });
}

function renderFullLog(logs) {
  const el = document.getElementById('full-log');
  if (!logs.length) { el.innerHTML = '<p style="font-size:13px;color:var(--text3);padding:12px 0">No activity yet.</p>'; return; }
  el.innerHTML = logs.slice(0, 50).map(l => `
    <div class="log-item">
      <div class="log-dot ${l.type}"></div>
      <span class="log-text">${l.label}</span>
      <span class="log-time">${fmtLogTime(l.ts)}</span>
    </div>`).join('');
}

/* ── Toast ── */
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 3000);
}

/* ── Boot ── */
window.addEventListener('DOMContentLoaded', () => {
  const uid = DB.get('ff_session');
  if (uid && getUsers()[uid]) {
    currentUser = uid;
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'grid';
    initApp();
  }
});

/* Close sidebar on outside click */
document.addEventListener('click', e => {
  const sb = document.getElementById('sidebar');
  const btn = document.querySelector('.menu-btn');
  if (sb.classList.contains('open') && !sb.contains(e.target) && e.target !== btn) closeSidebar();
});
