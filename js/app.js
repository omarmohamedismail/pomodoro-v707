/*
 * FocusFlow — by Omar Mohamed
 * Performance: timer tick touches ONLY 3 DOM nodes.
 * Charts are created once and updated in-place (no destroy/recreate).
 */

/* ════════════ STORAGE ════════════ */
const DB = {
  get:(k,d=null)=>{try{const v=localStorage.getItem(k);return v!=null?JSON.parse(v):d;}catch{return d;}},
  set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch{}},
  del:(k)=>localStorage.removeItem(k),
};
const UK = sub => `ff_${currentUser}_${sub}`;

/* ════════════ AUTH ════════════ */
let currentUser = null;

function getUsers(){ return DB.get('ff_users',{}); }
function setUsers(u){ DB.set('ff_users',u); }

function showAuthTab(t){
  document.getElementById('login-form').style.display    = t==='login' ? '' : 'none';
  document.getElementById('register-form').style.display = t==='register' ? '' : 'none';
  document.querySelectorAll('.auth-tab').forEach((b,i)=>b.classList.toggle('active',(i===0)===(t==='login')));
}

function doRegister(){
  const name  = document.getElementById('r-name').value.trim();
  const email = document.getElementById('r-email').value.trim().toLowerCase();
  const pw    = document.getElementById('r-pw').value;
  const err   = document.getElementById('r-err');
  if(!name||!email||!pw){err.textContent='All fields required.';return;}
  if(pw.length<6){err.textContent='Password must be at least 6 characters.';return;}
  const users = getUsers();
  if(Object.values(users).some(u=>u.email===email)){err.textContent='Email already registered.';return;}
  const uid='u'+Date.now();
  users[uid]={uid,name,email,pw:btoa(pw),joined:new Date().toISOString()};
  setUsers(users);
  DB.set(`ff_profile_${uid}`,{name,email,bio:'',goal:120,sleepGoal:8,avatar:''});
  beginSession(uid);
}

function doLogin(){
  const email=document.getElementById('l-email').value.trim().toLowerCase();
  const pw   =document.getElementById('l-pw').value;
  const err  =document.getElementById('l-err');
  const users=getUsers();
  const user =Object.values(users).find(u=>u.email===email&&u.pw===btoa(pw));
  if(!user){err.textContent='Incorrect email or password.';return;}
  beginSession(user.uid);
}

function beginSession(uid){
  DB.set('ff_session',uid);
  currentUser=uid;
  document.getElementById('auth-screen').style.display='none';
  document.getElementById('app-screen').style.display='grid';
  initApp();
}

function doLogout(){
  stopTimer(); stopAmbient();
  DB.del('ff_session'); currentUser=null;
  document.getElementById('app-screen').style.display='none';
  document.getElementById('auth-screen').style.display='';
}

function togglePw(id,el){
  const inp=document.getElementById(id);
  inp.type=inp.type==='password'?'text':'password';
  el.className='ti pw-eye '+(inp.type==='text'?'ti-eye-off':'ti-eye');
}

/* ════════════ INIT ════════════ */
function initApp(){
  loadProfileUI();
  initTimer();
  renderTasks();
  setupSleepDate();
  navigate('dashboard');
  if('serviceWorker'in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
}

/* ════════════ NAVIGATION ════════════ */
const PAGE_TITLES={dashboard:'Dashboard',timer:'Pomodoro Timer',sleep:'Sleep Tracker',
  habits:'Habits',water:'Water Tracker',notes:'Study Notes',analytics:'Analytics',profile:'Profile'};

let currentPage = 'dashboard';

function navigate(p){
  if(p===currentPage && p!=='dashboard') return; // avoid redundant re-render
  currentPage=p;
  document.querySelectorAll('.page').forEach(el=>el.classList.remove('active'));
  document.querySelectorAll('.sn,.bn').forEach(el=>el.classList.remove('active'));
  document.getElementById('page-'+p).classList.add('active');
  document.querySelectorAll(`[data-p="${p}"]`).forEach(el=>el.classList.add('active'));
  document.getElementById('topbar-title').textContent=PAGE_TITLES[p]||p;
  closeSidebar();
  // Page-specific init
  if(p==='dashboard')  renderDashboard();
  if(p==='sleep')      { setupSleepDate(); loadSleepPage(); }
  if(p==='habits')     loadHabitsPage();
  if(p==='water')      loadWaterPage();
  if(p==='notes')      loadNotesPage();
  if(p==='analytics')  renderAnalytics();
  if(p==='profile')    renderProfile();
}

function toggleSidebar(){
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sb-ov').classList.toggle('open');
}
function closeSidebar(){
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sb-ov').classList.remove('open');
}
document.addEventListener('click',e=>{
  const ov=document.getElementById('sb-ov');
  if(ov?.classList.contains('open')&&!document.getElementById('sidebar')?.contains(e.target)) closeSidebar();
});

/* ════════════ PROFILE ════════════ */
function getProfile(){ return DB.get(`ff_profile_${currentUser}`,{name:'',email:'',bio:'',goal:120,sleepGoal:8,avatar:''}); }
function setProfile(p){ DB.set(`ff_profile_${currentUser}`,p); }
function initials(name){ return name.split(' ').filter(Boolean).map(w=>w[0]).join('').toUpperCase().slice(0,2)||'?'; }

function setAv(id,avatar,init){
  const el=document.getElementById(id); if(!el) return;
  if(avatar) el.innerHTML=`<img src="${avatar}" alt=""/>`;
  else { el.textContent=init; el.innerHTML=''; el.textContent=init; }
}

function loadProfileUI(){
  const p=getProfile(); const ini=initials(p.name);
  ['sb-av','tb-av','dash-av','pr-av'].forEach(id=>setAv(id,p.avatar,ini));
  const sbName=document.getElementById('sb-name'); if(sbName) sbName.textContent=p.name||'User';
  const greet=document.getElementById('dash-greet');
  const dateEl=document.getElementById('dash-date');
  if(greet) greet.textContent=greeting(p.name);
  if(dateEl) dateEl.textContent=new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
}

function greeting(name){
  const h=new Date().getHours();
  const g=h<5?'Good night':h<12?'Good morning':h<17?'Good afternoon':'Good evening';
  return `${g}, ${name.split(' ')[0]||'there'} 👋`;
}

function renderProfile(){
  const p=getProfile(); const users=getUsers(); const user=users[currentUser]||{};
  const ini=initials(p.name); setAv('pr-av',p.avatar,ini);
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('pr-name',p.name); set('pr-email',p.email||'');
  set('pr-joined',user.joined?'Joined '+new Date(user.joined).toLocaleDateString('en-GB',{month:'long',year:'numeric'}):'');
  const pe_name=document.getElementById('pe-name'); if(pe_name) pe_name.value=p.name;
  const pe_bio =document.getElementById('pe-bio');  if(pe_bio)  pe_bio.value=p.bio||'';
  const pe_goal=document.getElementById('pe-goal'); if(pe_goal) pe_goal.value=p.goal||120;
  const pe_sg  =document.getElementById('pe-sg');   if(pe_sg)   pe_sg.value=p.sleepGoal||8;
  renderBadges(); renderAchievements();
}

function saveProfile(){
  const p=getProfile();
  p.name     =(document.getElementById('pe-name')?.value.trim())||p.name;
  p.bio      =document.getElementById('pe-bio')?.value.trim()||'';
  p.goal     =parseInt(document.getElementById('pe-goal')?.value)||120;
  p.sleepGoal=parseFloat(document.getElementById('pe-sg')?.value)||8;
  setProfile(p); loadProfileUI(); renderProfile(); toast('Profile saved ✓');
}

function uploadAv(inp){
  const file=inp.files[0]; if(!file) return;
  const r=new FileReader();
  r.onload=e=>{const p=getProfile();p.avatar=e.target.result;setProfile(p);loadProfileUI();renderProfile();toast('Photo updated 📸');};
  r.readAsDataURL(file);
}

function renderBadges(){
  const logs=getLogs(); const fm=focusMinAll(logs);
  const badges=[];
  if(fm>=60)  badges.push({t:'1h Focus',   c:'purple'});
  if(fm>=600) badges.push({t:'10h Focus',  c:'purple'});
  if(getSleepLogs().length>=7) badges.push({t:'7-Day Sleep',c:'blue'});
  if(getHabits().length>=3)    badges.push({t:'Habit Builder',c:'green'});
  if(getNotes().length>=5)     badges.push({t:'Note Taker',c:'amber'});
  const el=document.getElementById('pr-badges'); if(!el) return;
  el.innerHTML=badges.length
    ? badges.map(b=>`<span class="badge ${b.c}">${b.t}</span>`).join('')
    : '<span style="font-size:12px;color:var(--tx3)">Complete sessions to earn badges</span>';
}

const ACH_DEF=[
  {id:'a1',ico:'🎯',name:'First Focus',    desc:'Complete your first session',  check:l=>l.filter(x=>x.type==='session').length>=1},
  {id:'a2',ico:'🔥',name:'On Fire',         desc:'Complete 10 sessions',         check:l=>l.filter(x=>x.type==='session').length>=10},
  {id:'a3',ico:'💯',name:'Century',          desc:'Complete 100 sessions',        check:l=>l.filter(x=>x.type==='session').length>=100},
  {id:'a4',ico:'⏰',name:'Deep Work',        desc:'5 total hours of focus',       check:l=>focusMinAll(l)>=300},
  {id:'a5',ico:'🌙',name:'Early to Bed',     desc:'Log your first sleep',        check:()=>getSleepLogs().length>=1},
  {id:'a6',ico:'😴',name:'Sleep Champion',   desc:'7 nights logged',             check:()=>getSleepLogs().length>=7},
  {id:'a7',ico:'💧',name:'Hydrated',         desc:'Hit water goal for a day',    check:()=>{const wl=getWaterLogs();const g=getWaterGoal();return Object.values(wl).some(v=>v>=g);}},
  {id:'a8',ico:'📚',name:'Note Taker',       desc:'Write 5 study notes',         check:()=>getNotes().length>=5},
  {id:'a9',ico:'✅',name:'Habit Master',     desc:'Add 3 habits',                check:()=>getHabits().length>=3},
  {id:'a10',ico:'📸',name:'Face of Focus',   desc:'Upload a profile photo',      check:()=>!!getProfile().avatar},
];

function renderAchievements(){
  const logs=getLogs();
  const el=document.getElementById('ach-grid'); if(!el) return;
  el.innerHTML=ACH_DEF.map(a=>{
    const ok=a.check(logs);
    return `<div class="ach ${ok?'unlocked':'locked'}"><div class="ach-ico">${a.ico}</div><div class="ach-name">${a.name}</div><div class="ach-desc">${a.desc}</div></div>`;
  }).join('');
}

/* ════════════ ACTIVITY LOG ════════════ */
function getLogs(){ return DB.get(UK('logs'),[]); }
function addLog(entry){
  const logs=getLogs();
  logs.unshift({...entry,id:Date.now(),ts:new Date().toISOString()});
  DB.set(UK('logs'),logs.slice(0,2000));
}
function focusMinAll(logs){ return logs.filter(l=>l.type==='focus').reduce((s,l)=>s+(l.minutes||0),0); }
function todayStr(){ return new Date().toISOString().slice(0,10); }
function todayFocusMin(){ return getLogs().filter(l=>l.type==='focus'&&l.date===todayStr()).reduce((s,l)=>s+(l.minutes||0),0); }

function timeAgo(ts){
  const d=(Date.now()-new Date(ts))/60000;
  if(d<1) return 'just now';
  if(d<60) return Math.round(d)+'m ago';
  if(d<1440) return Math.round(d/60)+'h ago';
  return new Date(ts).toLocaleDateString('en-GB',{day:'numeric',month:'short'});
}

function last7Days(){
  return Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));return d.toISOString().slice(0,10);});
}

function focusStreak(){
  const logs=getLogs(); let s=0; const d=new Date();
  for(let i=0;i<365;i++){
    const str=d.toISOString().slice(0,10);
    if(!logs.some(l=>l.type==='focus'&&l.date===str)) break;
    s++; d.setDate(d.getDate()-1);
  }
  return s;
}

function renderLogList(id,logs,max=20){
  const el=document.getElementById(id); if(!el) return;
  const items=logs.slice(0,max);
  if(!items.length){ el.innerHTML='<div class="empty-state"><i class="ti ti-list"></i>No activity yet</div>'; return; }
  el.innerHTML=items.map(l=>
    `<div class="log-item"><div class="log-dot ${l.type}"></div><span class="log-text">${esc(l.label)}</span><span class="log-time">${timeAgo(l.ts)}</span></div>`
  ).join('');
}

/* ════════════ CHARTS — singleton, never destroyed ════════════ */
const C = {}; // chart registry

function upsertChart(id, type, labels, datasets, opts){
  const canvas=document.getElementById(id); if(!canvas) return;
  if(C[id]){
    C[id].data.labels=labels;
    datasets.forEach((d,i)=>{
      if(!C[id].data.datasets[i]) return;
      C[id].data.datasets[i].data=d.data;
      if(d.backgroundColor!==undefined) C[id].data.datasets[i].backgroundColor=d.backgroundColor;
    });
    C[id].update('none'); // ← NO animation = zero jank
    return;
  }
  C[id]=new Chart(canvas.getContext('2d'),{type,data:{labels,datasets},options:opts||baseOpts('val')});
}

function baseOpts(unit,extraY){
  return {
    responsive:true, maintainAspectRatio:false, animation:{duration:300},
    plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>c.raw+unit}}},
    scales:{
      x:{grid:{display:false},ticks:{color:'#5c5a65',font:{size:11}}},
      y:{...extraY, grid:{color:'rgba(255,255,255,0.04)'},ticks:{color:'#5c5a65',font:{size:11}}}
    }
  };
}

/* ════════════ DASHBOARD ════════════ */
function renderDashboard(){
  loadProfileUI();
  // KPIs — just text updates, no DOM creation
  const fm=todayFocusMin();
  const kFocus=document.getElementById('kpi-focus'); if(kFocus) kFocus.textContent=fm>=60?(fm/60).toFixed(1)+'h':fm+'m';
  const sl=getSleepLogs()[0];
  const kSleep=document.getElementById('kpi-sleep'); if(kSleep) kSleep.textContent=sl?sl.hours.toFixed(1)+'h':'—';
  const kStr=document.getElementById('kpi-streak'); if(kStr) kStr.textContent=focusStreak();
  const habits=getHabits(); const hlog=getHabitLog();
  const hDone=habits.filter(h=>hlog[h.id+'_'+todayStr()]).length;
  const kH=document.getElementById('kpi-habits'); if(kH) kH.textContent=`${hDone}/${habits.length}`;
  // Charts — update in-place
  buildWeekFocusChart();
  buildWeekSleepChart();
  // Log
  renderLogList('dash-log',getLogs());
  // Quote
  const QUOTES=[
    '"Deep work is the superpower of our age." — Cal Newport',
    '"The secret of getting ahead is getting started." — Mark Twain',
    '"Focus is the art of knowing what to ignore."',
    '"Small steps every day lead to extraordinary results."',
    '"An investment in knowledge pays the best interest." — Benjamin Franklin',
    '"Discipline is the bridge between goals and accomplishment." — Jim Rohn',
    '"Your future self will thank you for every hour of focus today."',
    '"Study hard. Dream big. Work harder than yesterday."',
  ];
  const q=document.getElementById('dash-quote'); if(q) q.textContent=QUOTES[new Date().getDate()%QUOTES.length];
}

function buildWeekFocusChart(){
  const days=last7Days(); const logs=getLogs();
  const data=days.map(d=>logs.filter(l=>l.type==='focus'&&l.date===d).reduce((s,l)=>s+(l.minutes||0),0));
  const labels=days.map(d=>new Date(d+'T00:00:00').toLocaleDateString('en-GB',{weekday:'short'}));
  upsertChart('c-wf','bar',labels,[{data,backgroundColor:'#7c6fcd55',borderColor:'#7c6fcd',borderWidth:1.5,borderRadius:6,borderSkipped:false}],baseOpts('min'));
}

function buildWeekSleepChart(){
  const days=last7Days(); const slogs=getSleepLogs();
  const data=days.map(d=>{const s=slogs.find(l=>l.date===d);return s?+s.hours.toFixed(1):0;});
  const labels=days.map(d=>new Date(d+'T00:00:00').toLocaleDateString('en-GB',{weekday:'short'}));
  upsertChart('c-ws','bar',labels,[{data,backgroundColor:'#3a85e055',borderColor:'#3a85e0',borderWidth:1.5,borderRadius:6,borderSkipped:false}],baseOpts('h'));
}

/* ════════════ AUDIO ════════════ */
let actx=null, ambNodes=[];

function unlockAudio(){
  try{
    if(!actx) actx=new(window.AudioContext||window.webkitAudioContext)();
    if(actx.state==='suspended') actx.resume();
  }catch{}
}

function tone(freq,type='sine',dur=0.8,gain=0.2,delay=0){
  try{
    unlockAudio();
    const o=actx.createOscillator(),g=actx.createGain();
    o.connect(g);g.connect(actx.destination);
    o.type=type; o.frequency.setValueAtTime(freq,actx.currentTime+delay);
    g.gain.setValueAtTime(0,actx.currentTime+delay);
    g.gain.linearRampToValueAtTime(gain,actx.currentTime+delay+0.02);
    g.gain.exponentialRampToValueAtTime(0.001,actx.currentTime+delay+dur);
    o.start(actx.currentTime+delay); o.stop(actx.currentTime+delay+dur);
  }catch{}
}

function playBell(){
  if(!document.getElementById('snd')?.checked) return;
  unlockAudio();
  if(timerMode==='focus'){
    [[523,0],[659,.18],[784,.36],[1047,.54],[1319,.72]].forEach(([f,d])=>tone(f,'sine',1.2,0.18,d));
  } else {
    [[784,0],[659,.2],[523,.4]].forEach(([f,d])=>tone(f,'sine',0.9,0.14,d));
  }
}

function playTick(){
  if(!document.getElementById('tick')?.checked||!timerRunning) return;
  try{
    unlockAudio();
    const buf=actx.createBuffer(1,Math.floor(actx.sampleRate*.012),actx.sampleRate);
    const d=buf.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*.06;
    const src=actx.createBufferSource(),g=actx.createGain();
    g.gain.setValueAtTime(.08,actx.currentTime);
    g.gain.exponentialRampToValueAtTime(.001,actx.currentTime+.012);
    src.buffer=buf;src.connect(g);g.connect(actx.destination);src.start();
  }catch{}
}

function setAmb(type,btn){
  unlockAudio(); stopAmbient();
  document.querySelectorAll('.ab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  if(type==='off') return;
  try{
    unlockAudio();
    const ctx=actx;
    if(type==='white'||type==='brown'){
      const buf=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);
      const data=buf.getChannelData(0);
      if(type==='white'){ for(let i=0;i<data.length;i++) data[i]=Math.random()*2-1; }
      else{ let l=0; for(let i=0;i<data.length;i++){l=(l+.02*(Math.random()*2-1))/1.02;data[i]=l*3.5;} }
      const src=ctx.createBufferSource(),g=ctx.createGain();
      src.buffer=buf;src.loop=true;
      g.gain.setValueAtTime(type==='white'?.04:.12,ctx.currentTime);
      src.connect(g);g.connect(ctx.destination);src.start();
      ambNodes.push(src,g);
    } else if(type==='rain'){
      const buf=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);
      const data=buf.getChannelData(0); for(let i=0;i<data.length;i++) data[i]=Math.random()*2-1;
      const src=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();
      src.buffer=buf;src.loop=true;
      f.type='bandpass';f.frequency.value=400;f.Q.value=.5;
      g.gain.setValueAtTime(.18,ctx.currentTime);
      src.connect(f);f.connect(g);g.connect(ctx.destination);src.start();
      ambNodes.push(src,f,g);
    } else if(type==='cafe'){
      const buf=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);
      const data=buf.getChannelData(0);let l=0;
      for(let i=0;i<data.length;i++){l=(l+.02*(Math.random()*2-1))/1.02;data[i]=l*3;}
      const src=ctx.createBufferSource(),g=ctx.createGain();
      src.buffer=buf;src.loop=true;g.gain.setValueAtTime(.08,ctx.currentTime);
      src.connect(g);g.connect(ctx.destination);src.start();
      const osc=ctx.createOscillator(),og=ctx.createGain();
      osc.type='sawtooth';osc.frequency.setValueAtTime(80,ctx.currentTime);
      og.gain.setValueAtTime(.012,ctx.currentTime);
      osc.connect(og);og.connect(ctx.destination);osc.start();
      ambNodes.push(src,g,osc,og);
    }
  }catch{}
}

function stopAmbient(){
  ambNodes.forEach(n=>{try{n.stop?n.stop():n.disconnect();}catch{}});
  ambNodes=[];
}

/* ════════════ TIMER ════════════ */
const DUR={focus:25,short:5,long:15};
let timerMode='focus', timerTotal=25*60, timerRemaining=25*60;
let timerRunning=false, timerInterval=null, sessCount=0;

// Pre-cache DOM refs for the hot tick path — no querySelector every second
let _ringFg=null, _tDisp=null, _ringCirc=0;

function initTimer(){
  _ringFg  = document.getElementById('ring-fg');
  _tDisp   = document.getElementById('t-disp');
  setMode('focus');
  renderSessDots();
  refreshTimerStats();
}

function fmtTime(s){ return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0'); }
function modeColor(){ return{focus:'#7c6fcd',short:'#22c97a',long:'#3a85e0'}[timerMode]; }

/* updateRing — only touches 2 cached DOM nodes, no layout queries */
function updateRing(){
  const r=98; const circ=2*Math.PI*r;
  if(!_ringFg){ _ringFg=document.getElementById('ring-fg'); }
  if(!_tDisp){  _tDisp =document.getElementById('t-disp');  }
  const offset = circ*(1-timerRemaining/timerTotal);
  _ringFg.style.strokeDasharray  = circ;
  _ringFg.style.strokeDashoffset = offset;
  _ringFg.style.stroke           = modeColor();
  _tDisp.textContent             = fmtTime(timerRemaining);
}

function setMode(m){
  if(timerRunning) stopTimer();
  timerMode=m; timerTotal=DUR[m]*60; timerRemaining=timerTotal;
  // reset cached refs (canvas may have re-rendered)
  _ringFg=document.getElementById('ring-fg');
  _tDisp =document.getElementById('t-disp');
  document.querySelectorAll('.mtab').forEach((t,i)=>t.classList.toggle('active',['focus','short','long'][i]===m));
  const lbl=document.getElementById('t-lbl');
  if(lbl) lbl.textContent={focus:'FOCUS TIME',short:'SHORT BREAK',long:'LONG BREAK'}[m];
  const pi=document.getElementById('play-icon');
  if(pi) pi.className='ti ti-player-play';
  updateRing();
}

function toggleTimer(){ unlockAudio(); timerRunning?stopTimer():startTimer(); }

function startTimer(){
  timerRunning=true;
  const pi=document.getElementById('play-icon'); if(pi) pi.className='ti ti-player-pause';
  timerInterval=setInterval(timerTick,1000);
}

function stopTimer(){
  timerRunning=false;
  clearInterval(timerInterval);
  const pi=document.getElementById('play-icon'); if(pi) pi.className='ti ti-player-play';
}

/* ★ HOT PATH — this runs every second.
   It ONLY touches:  _tDisp.textContent, _ringFg.style, document.title
   Nothing else. No charts, no logs, no DOM queries. */
function timerTick(){
  if(timerRemaining<=0){ onSessionEnd(); return; }
  timerRemaining--;
  updateRing();                                // 2 cached DOM nodes
  playTick();                                  // audio (conditional)
  document.title=fmtTime(timerRemaining)+' — FocusFlow'; // title only
}

function resetTimer(){ unlockAudio(); stopTimer(); timerRemaining=timerTotal; updateRing(); }
function skipSession(){ unlockAudio(); stopTimer(); onSessionEnd(true); }

function onSessionEnd(skipped=false){
  stopTimer(); timerRemaining=0; updateRing();
  document.title='FocusFlow — by Omar Mohamed';
  if(!skipped) playBell();
  if(timerMode==='focus'){
    sessCount++;
    const min=DUR.focus;
    const topic=document.getElementById('working-on')?.value.trim();
    addLog({type:'focus',  label:`${min}min focus session${topic?' — '+topic:''}`,minutes:min,date:todayStr()});
    addLog({type:'session',label:`Pomodoro done${topic?': '+topic:''}`,minutes:min,date:todayStr()});
    refreshTimerStats();
    renderSessDots();
    toast('Session complete! 🎉');
    const next=sessCount%4===0?'long':'short';
    setTimeout(()=>{setMode(next);if(document.getElementById('auto')?.checked)startTimer();},1200);
  } else {
    toast('Break over — back to focus! 💪');
    setTimeout(()=>{setMode('focus');if(document.getElementById('auto')?.checked)startTimer();},1200);
  }
  // Refresh dashboard KPIs only if currently visible — never from tick
  if(currentPage==='dashboard') renderDashboard();
}

/* refreshTimerStats — updates only the 3 stat text nodes */
function refreshTimerStats(){
  const s=document.getElementById('ts-sess'); if(s) s.textContent=sessCount;
  const m=document.getElementById('ts-min');  if(m) m.textContent=todayFocusMin()+'m';
  const r=document.getElementById('ts-str');  if(r) r.textContent=focusStreak();
}

function renderSessDots(){
  const wrap=document.getElementById('sdots'); if(!wrap) return;
  wrap.innerHTML='';
  for(let i=0;i<4;i++){
    const d=document.createElement('div');
    const pos=sessCount%4;
    d.className='sdot'+(i<pos?' done':(i===pos&&timerRunning?' cur':''));
    wrap.appendChild(d);
  }
}

function adjDur(key,delta){
  DUR[key]=Math.max(1,Math.min(120,DUR[key]+delta));
  const el=document.getElementById('d-'+key); if(el) el.textContent=DUR[key]+'m';
  if(timerMode===key&&!timerRunning){timerTotal=DUR[key]*60;timerRemaining=timerTotal;updateRing();}
}

/* ════════════ TASKS ════════════ */
function getTasks(){ return DB.get(UK('tasks'),[]); }
function setTasks(t){ DB.set(UK('tasks'),t); }

function addTask(){
  unlockAudio();
  const inp=document.getElementById('task-inp'); if(!inp) return;
  const val=inp.value.trim(); if(!val) return;
  const tasks=getTasks(); tasks.push({id:Date.now(),text:val,done:false,date:todayStr()});
  setTasks(tasks); inp.value=''; renderTasks();
}

function toggleTask(id){
  const tasks=getTasks(); const t=tasks.find(t=>t.id===id);
  if(t){t.done=!t.done;setTasks(tasks);renderTasks();}
}
function deleteTask(id){ setTasks(getTasks().filter(t=>t.id!==id)); renderTasks(); }

function renderTasks(){
  const el=document.getElementById('task-list'); if(!el) return;
  const tasks=getTasks().filter(t=>t.date===todayStr());
  el.innerHTML=tasks.length
    ? tasks.map(t=>`<div class="task-item">
        <div class="task-cb ${t.done?'done':''}" onclick="toggleTask(${t.id})">${t.done?'<i class="ti ti-check"></i>':''}</div>
        <span class="task-txt ${t.done?'done':''}">${esc(t.text)}</span>
        <button class="task-del" onclick="deleteTask(${t.id})"><i class="ti ti-x"></i></button>
      </div>`).join('')
    : '<div class="empty-state" style="padding:.75rem 0"><i class="ti ti-checkbox" style="font-size:24px;margin-bottom:4px"></i>No tasks yet</div>';
}

/* ════════════ SLEEP ════════════ */
let sleepStar=3;
function getSleepLogs(){ return DB.get(UK('sleep'),[]); }
function setSleepLogs(l){ DB.set(UK('sleep'),l); }
function setupSleepDate(){ const el=document.getElementById('sl-date'); if(el&&!el.value) el.value=todayStr(); }

function setStar(v){
  sleepStar=v;
  document.querySelectorAll('#sl-stars i').forEach((s,i)=>s.classList.toggle('lit',i<v));
}

function sleepHrs(bed,wake){
  const[bh,bm]=bed.split(':').map(Number);
  const[wh,wm]=wake.split(':').map(Number);
  let m=(wh*60+wm)-(bh*60+bm); if(m<0) m+=1440;
  return+(m/60).toFixed(2);
}

function logSleep(){
  unlockAudio();
  const bed=document.getElementById('sl-bed')?.value;
  const wake=document.getElementById('sl-wake')?.value;
  const date=document.getElementById('sl-date')?.value;
  const note=document.getElementById('sl-note')?.value.trim();
  if(!bed||!wake||!date){toast('Fill in bedtime, wake-up and date');return;}
  const hours=sleepHrs(bed,wake);
  const logs=getSleepLogs();
  const idx=logs.findIndex(l=>l.date===date);
  const entry={id:Date.now(),date,bed,wake,hours,quality:sleepStar,note:note||''};
  if(idx>-1) logs[idx]=entry; else logs.unshift(entry);
  setSleepLogs(logs.sort((a,b)=>b.date.localeCompare(a.date)));
  addLog({type:'sleep',label:`Slept ${hours.toFixed(1)}h · ${bed} → ${wake} · ${'★'.repeat(sleepStar)}`,date});
  toast(`Sleep logged: ${hours.toFixed(1)} hours 🌙`);
  loadSleepPage();
}

function loadSleepPage(){
  const logs=getSleepLogs();
  if(logs.length){
    const avg=logs.reduce((s,l)=>s+l.hours,0)/logs.length;
    const best=Math.max(...logs.map(l=>l.hours));
    const avgQ=logs.reduce((s,l)=>s+(l.quality||3),0)/logs.length;
    const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
    set('ss-avg',avg.toFixed(1)+'h'); set('ss-best',best.toFixed(1)+'h');
    set('ss-qual',avgQ.toFixed(1)+'★'); set('ss-days',logs.length);
  } else {
    ['ss-avg','ss-best','ss-qual'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent='—';});
    const el=document.getElementById('ss-days');if(el)el.textContent='0';
  }
  buildSleepPageChart();
  renderSleepHistory();
}

function buildSleepPageChart(){
  const days=last7Days(); const logs=getSleepLogs();
  const data=days.map(d=>{const s=logs.find(l=>l.date===d);return s?+s.hours.toFixed(1):0;});
  const labels=days.map(d=>new Date(d+'T00:00:00').toLocaleDateString('en-GB',{weekday:'short'}));
  upsertChart('c-sleep-pg','line',labels,
    [{data,borderColor:'#3a85e0',backgroundColor:'rgba(58,133,224,.1)',tension:.4,fill:true,pointBackgroundColor:'#3a85e0',pointRadius:4}],
    baseOpts('h')
  );
}

function renderSleepHistory(){
  const el=document.getElementById('sleep-hist'); if(!el) return;
  const logs=getSleepLogs();
  if(!logs.length){el.innerHTML='<div class="empty-state"><i class="ti ti-moon"></i>No sleep logged yet</div>';return;}
  el.innerHTML=logs.slice(0,30).map(l=>`
    <div class="log-item">
      <div class="log-dot sleep"></div>
      <span class="log-text">${l.date} · ${l.bed} → ${l.wake} · ${l.hours.toFixed(1)}h · ${'★'.repeat(l.quality||3)}${l.note?' · '+esc(l.note):''}</span>
      <button class="log-del" onclick="delSleep(${l.id})"><i class="ti ti-x"></i></button>
    </div>`).join('');
}

function delSleep(id){ setSleepLogs(getSleepLogs().filter(l=>l.id!==id)); loadSleepPage(); toast('Removed'); }

/* ════════════ HABITS ════════════ */
function getHabits(){ return DB.get(UK('habits'),[]); }
function setHabits(h){ DB.set(UK('habits'),h); }
function getHabitLog(){ return DB.get(UK('hlog'),{}); }
function setHabitLog(l){ DB.set(UK('hlog'),l); }

function openHM(){  document.getElementById('h-modal').style.display='flex'; }
function closeHM(){ document.getElementById('h-modal').style.display='none'; }

function saveHabit(){
  const name =document.getElementById('h-name')?.value.trim();
  const emoji=document.getElementById('h-emoji')?.value.trim()||'✅';
  const cat  =document.getElementById('h-cat')?.value;
  if(!name){toast('Enter a habit name');return;}
  const habits=getHabits();
  habits.push({id:Date.now(),name,emoji,cat,created:todayStr()});
  setHabits(habits);
  if(document.getElementById('h-name')) document.getElementById('h-name').value='';
  if(document.getElementById('h-emoji')) document.getElementById('h-emoji').value='';
  closeHM(); loadHabitsPage(); toast('Habit added 💚');
}

function toggleHabit(id){
  unlockAudio();
  const log=getHabitLog(); const key=id+'_'+todayStr();
  log[key]=!log[key]; setHabitLog(log);
  if(log[key]){
    const h=getHabits().find(h=>h.id===id);
    addLog({type:'habit',label:`Habit done: ${h?h.emoji+' '+h.name:''}`,date:todayStr()});
    toast(`${h?h.emoji:'✅'} Done!`);
  }
  loadHabitsPage();
}

function delHabit(id){ setHabits(getHabits().filter(h=>h.id!==id)); loadHabitsPage(); toast('Removed'); }

function loadHabitsPage(){
  const habits=getHabits(); const log=getHabitLog(); const today=todayStr();
  const hd=document.getElementById('hd-today');
  if(hd) hd.textContent=new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'});
  const el=document.getElementById('habits-today'); if(!el) return;
  if(!habits.length){
    el.innerHTML='<div class="empty-state"><i class="ti ti-heart"></i>Add your first habit!</div>';
  } else {
    el.innerHTML=habits.map(h=>{
      const done=!!log[h.id+'_'+today];
      return `<div class="habit-row">
        <span class="h-emoji">${h.emoji}</span>
        <div style="flex:1"><div class="h-name">${esc(h.name)}</div><div class="h-cat">${h.cat}</div></div>
        <button class="h-chk ${done?'done':''}" onclick="toggleHabit(${h.id})">${done?'<i class="ti ti-check"></i>':''}</button>
        <button class="h-del" onclick="delHabit(${h.id})"><i class="ti ti-trash"></i></button>
      </div>`;
    }).join('');
  }
  renderHabitWeek(habits,log);
}

function renderHabitWeek(habits,log){
  const el=document.getElementById('habits-week'); if(!el) return;
  const days=last7Days(); const today=todayStr();
  const lbl=days.map(d=>new Date(d+'T00:00:00').toLocaleDateString('en-GB',{weekday:'short'}));
  el.innerHTML=habits.map(h=>`
    <div class="hw-row">
      <div class="hwn">${h.emoji} ${esc(h.name)}</div>
      <div class="hw-dots">
        ${days.map((d,i)=>`<div class="hw-d ${log[h.id+'_'+d]?'done':''} ${d===today?'today':''}">${lbl[i]}</div>`).join('')}
      </div>
    </div>`).join('');
}

/* ════════════ WATER ════════════ */
function getWaterLogs(){ return DB.get(UK('water'),{}); }
function setWaterLogs(l){ DB.set(UK('water'),l); }
function getWaterGoal(){ return DB.get(UK('wgoal'),8); }
function setWaterGoal(g){ DB.set(UK('wgoal'),g); }

function addWater(){ unlockAudio(); adjWater(1); }
function removeWater(){ adjWater(-1); }

function adjWater(delta){
  const logs=getWaterLogs(); const today=todayStr();
  logs[today]=Math.max(0,Math.min(20,(logs[today]||0)+delta));
  setWaterLogs(logs);
  if(delta>0) addLog({type:'water',label:`Glass of water 💧 (${logs[today]} today)`,date:today});
  loadWaterPage();
}

function adjWGoal(delta){
  const g=Math.max(1,Math.min(20,getWaterGoal()+delta));
  setWaterGoal(g);
  const gn=document.getElementById('w-goal-n'); if(gn) gn.textContent=g;
  const gl=document.getElementById('w-goal-lbl'); if(gl) gl.textContent=g+' glasses';
  loadWaterPage();
}

function loadWaterPage(){
  const logs=getWaterLogs(); const today=todayStr(); const goal=getWaterGoal();
  const count=logs[today]||0;
  const wc=document.getElementById('w-count'); if(wc) wc.textContent=count;
  const gn=document.getElementById('w-goal-n'); if(gn) gn.textContent=goal;
  const gl=document.getElementById('w-goal-lbl'); if(gl) gl.textContent=goal+' glasses';
  // Ring
  const circ=2*Math.PI*85;
  const fg=document.getElementById('wr-fg');
  if(fg){ fg.style.strokeDasharray=circ; fg.style.strokeDashoffset=circ*(1-Math.min(count/goal,1)); }
  // Cups
  const cupsEl=document.getElementById('w-cups');
  if(cupsEl) cupsEl.innerHTML=Array.from({length:goal},(_,i)=>`<div class="w-cup ${i<count?'filled':''}">💧</div>`).join('');
  // Stats
  const vals=Object.values(logs).filter(v=>v>0);
  const avg =vals.length?(vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1):'0';
  const best=vals.length?Math.max(...vals):'0';
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('wst-avg',avg); set('wst-best',best); set('wst-str',calcWStreak(logs,goal));
  buildWaterChart(logs,goal);
}

function calcWStreak(logs,goal){
  let s=0; const d=new Date();
  for(let i=0;i<365;i++){
    const str=d.toISOString().slice(0,10);
    if((logs[str]||0)>=goal){s++;d.setDate(d.getDate()-1);}else break;
  }
  return s;
}

function buildWaterChart(logs,goal){
  const days=last7Days();
  const data=days.map(d=>logs[d]||0);
  const labels=days.map(d=>new Date(d+'T00:00:00').toLocaleDateString('en-GB',{weekday:'short'}));
  upsertChart('c-water','bar',labels,[
    {data, backgroundColor:data.map(v=>v>=goal?'#15b5c8aa':'#15b5c844'), borderColor:'#15b5c8', borderWidth:1.5, borderRadius:6},
    {data:Array(7).fill(goal), type:'line', borderColor:'rgba(21,181,200,.4)', borderDash:[4,4], pointRadius:0, fill:false}
  ],baseOpts(''));
}

/* ════════════ NOTES ════════════ */
let currentNoteId=null;
function getNotes(){ return DB.get(UK('notes'),[]); }
function setNotes(n){ DB.set(UK('notes'),n); }

function loadNotesPage(){
  renderNotesList();
  const notes=getNotes();
  if(notes.length) openNoteEditor(notes[0].id); else clearEditor();
}

function renderNotesList(){
  const el=document.getElementById('notes-list'); if(!el) return;
  const notes=getNotes();
  if(!notes.length){el.innerHTML='<div class="notes-empty"><i class="ti ti-notes"></i>No notes yet.<br/>Click "New note" to start</div>';return;}
  el.innerHTML=notes.map(n=>`
    <div class="note-item ${n.id===currentNoteId?'active':''}" onclick="openNoteEditor(${n.id})">
      <div class="ni-title">${esc(n.title||'Untitled')}</div>
      <div class="ni-prev">${esc((n.body||'').slice(0,80))}</div>
      <div class="ni-date">${new Date(n.ts).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}${n.tags?' · '+esc(n.tags):''}</div>
    </div>`).join('');
}

function newNote(){
  const note={id:Date.now(),title:'',body:'',tags:'',ts:new Date().toISOString()};
  const notes=getNotes(); notes.unshift(note); setNotes(notes);
  currentNoteId=note.id; renderNotesList(); openNoteEditor(note.id);
  document.getElementById('note-title')?.focus();
}

function openNoteEditor(id){
  const note=getNotes().find(n=>n.id===id); if(!note) return;
  currentNoteId=id;
  const t=document.getElementById('note-title'); if(t) t.value=note.title||'';
  const b=document.getElementById('note-body');  if(b) b.value=note.body||'';
  const g=document.getElementById('note-tags');  if(g) g.value=note.tags||'';
  renderNotesList();
}

function saveNote(){
  const notes=getNotes(); const idx=notes.findIndex(n=>n.id===currentNoteId); if(idx===-1) return;
  notes[idx].title=document.getElementById('note-title')?.value.trim()||'Untitled';
  notes[idx].body =document.getElementById('note-body')?.value||'';
  notes[idx].tags =document.getElementById('note-tags')?.value.trim()||'';
  notes[idx].ts   =new Date().toISOString();
  setNotes(notes); renderNotesList();
  addLog({type:'note',label:`Saved note: "${notes[idx].title}"`,date:todayStr()});
  toast('Note saved 📝');
}

function deleteNote(){
  if(!currentNoteId) return;
  setNotes(getNotes().filter(n=>n.id!==currentNoteId));
  currentNoteId=null; clearEditor(); loadNotesPage(); toast('Note deleted');
}
function clearEditor(){ ['note-title','note-body','note-tags'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';}); }

/* ════════════ ANALYTICS ════════════ */
function renderAnalytics(){
  const logs=getLogs(); const slogs=getSleepLogs();
  const fm=focusMinAll(logs);
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('an-focus',(fm/60).toFixed(1)+'h');
  const avgSl=slogs.length?slogs.reduce((s,l)=>s+l.hours,0)/slogs.length:0;
  set('an-sleep',avgSl?avgSl.toFixed(1)+'h':'—');
  set('an-days',[...new Set(logs.map(l=>l.date))].length);
  const byDay={};
  logs.filter(l=>l.type==='focus').forEach(l=>{byDay[l.date]=(byDay[l.date]||0)+(l.minutes||0);});
  const best=Object.entries(byDay).sort((a,b)=>b[1]-a[1])[0];
  set('an-best',best?new Date(best[0]+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'}):'—');
  build14Chart(logs);
  buildPieChart(logs,slogs);
  buildScatterChart(logs,slogs);
  renderLogList('an-log',logs,60);
}

function build14Chart(logs){
  const days=Array.from({length:14},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(13-i));return d.toISOString().slice(0,10);});
  const data=days.map(d=>logs.filter(l=>l.type==='focus'&&l.date===d).reduce((s,l)=>s+(l.minutes||0),0));
  const labels=days.map(d=>new Date(d+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'}));
  upsertChart('c-an14','bar',labels,
    [{data, backgroundColor:days.map((_,i)=>i===13?'#7c6fcd':'#7c6fcd44'), borderRadius:6, borderSkipped:false}],
    baseOpts('min'));
}

function buildPieChart(logs,slogs){
  const dN=Math.max(1,[...new Set(logs.map(l=>l.date))].length);
  const fh=+(focusMinAll(logs)/dN/60).toFixed(1);
  const sh=+(slogs.reduce((s,l)=>s+l.hours,0)/Math.max(1,slogs.length)).toFixed(1);
  const ot=Math.max(0,+(24-fh-sh).toFixed(1));
  const canvas=document.getElementById('c-pie'); if(!canvas) return;
  if(C['c-pie']){
    C['c-pie'].data.datasets[0].data=[fh,sh,ot];
    C['c-pie'].update('none'); return;
  }
  C['c-pie']=new Chart(canvas.getContext('2d'),{
    type:'doughnut',
    data:{labels:['Focus','Sleep','Other'],datasets:[{data:[fh,sh,ot],backgroundColor:['#7c6fcd','#3a85e0','#27272f'],borderWidth:0,spacing:2}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:'65%',animation:{duration:300},plugins:{legend:{position:'bottom',labels:{color:'#9896a0',font:{size:12},padding:16}}}}
  });
}

function buildScatterChart(logs,slogs){
  const fd={};
  logs.filter(l=>l.type==='focus').forEach(l=>{fd[l.date]=(fd[l.date]||0)+(l.minutes||0);});
  const pts=slogs.map(s=>({x:+s.hours.toFixed(1),y:fd[s.date]||0})).filter(p=>p.y>0);
  const canvas=document.getElementById('c-scat'); if(!canvas) return;
  if(C['c-scat']){
    C['c-scat'].data.datasets[0].data=pts;
    C['c-scat'].update('none'); return;
  }
  C['c-scat']=new Chart(canvas.getContext('2d'),{
    type:'scatter',
    data:{datasets:[{data:pts,backgroundColor:'#7c6fcd',pointRadius:6,pointHoverRadius:8}]},
    options:{responsive:true,maintainAspectRatio:false,animation:{duration:300},
      plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`Sleep: ${c.raw.x}h · Focus: ${c.raw.y}min`}}},
      scales:{
        x:{title:{display:true,text:'Sleep (h)',color:'#5c5a65',font:{size:11}},grid:{color:'rgba(255,255,255,0.04)'},ticks:{color:'#5c5a65',font:{size:11}}},
        y:{title:{display:true,text:'Focus (min)',color:'#5c5a65',font:{size:11}},grid:{color:'rgba(255,255,255,0.04)'},ticks:{color:'#5c5a65',font:{size:11}}}
      }}
  });
}

/* ════════════ UTILS ════════════ */
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

let _toastT;
function toast(msg){
  const el=document.getElementById('toast'); if(!el) return;
  el.textContent=msg; el.classList.add('show');
  clearTimeout(_toastT); _toastT=setTimeout(()=>el.classList.remove('show'),3000);
}

/* ════════════ BOOT ════════════ */
window.addEventListener('DOMContentLoaded',()=>{
  const uid=DB.get('ff_session');
  if(uid&&getUsers()[uid]){
    currentUser=uid;
    document.getElementById('auth-screen').style.display='none';
    document.getElementById('app-screen').style.display='grid';
    initApp();
  }
  // Auto-save notes with debounce
  document.getElementById('note-body')?.addEventListener('input',debounce(()=>{if(currentNoteId)saveNote();},1500));
});

function debounce(fn,ms){let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);};}
