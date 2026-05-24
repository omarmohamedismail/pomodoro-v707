/*
 * FocusFlow — by Omar Mohamed
 *
 * PERFORMANCE FIXES vs previous version:
 * 1. Timer uses requestAnimationFrame + timestamp diff → no setInterval drift/jank
 * 2. timerTick ONLY touches 2 pre-cached DOM nodes (ring + display)
 * 3. Charts never destroyed — updated in-place with chart.update('none')
 * 4. Sleep uses H+M number inputs — no native time picker, zero picker lag
 * 5. No backdrop-filter, no drop-shadow filters in CSS
 * 6. navigate() guards against redundant re-renders on same page
 */

/* ══ STORAGE ══ */
const DB={
  get:(k,d=null)=>{try{const v=localStorage.getItem(k);return v!=null?JSON.parse(v):d;}catch{return d;}},
  set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch{}},
  del:(k)=>localStorage.removeItem(k),
};
const UK=sub=>`ff_${currentUser}_${sub}`;

/* ══ AUTH ══ */
let currentUser=null;
const getUsers=()=>DB.get('ff_users',{});
const setUsers=u=>DB.set('ff_users',u);

function showTab(t){
  document.getElementById('login-form').style.display=t==='login'?'':'none';
  document.getElementById('reg-form').style.display=t==='register'?'':'none';
  document.querySelectorAll('.atab').forEach((b,i)=>b.classList.toggle('active',(i===0)===(t==='login')));
}

function doRegister(){
  const name=document.getElementById('r-name').value.trim();
  const email=document.getElementById('r-email').value.trim().toLowerCase();
  const pw=document.getElementById('r-pw').value;
  const err=document.getElementById('r-err');
  if(!name||!email||!pw){err.textContent='All fields required.';return;}
  if(pw.length<6){err.textContent='Password min 6 characters.';return;}
  const users=getUsers();
  if(Object.values(users).some(u=>u.email===email)){err.textContent='Email already registered.';return;}
  const uid='u'+Date.now();
  users[uid]={uid,name,email,pw:btoa(pw),joined:new Date().toISOString()};
  setUsers(users);
  DB.set(`ff_profile_${uid}`,{name,email,bio:'',goal:120,sleepGoal:8,avatar:''});
  startSession(uid);
}

function doLogin(){
  const email=document.getElementById('l-email').value.trim().toLowerCase();
  const pw=document.getElementById('l-pw').value;
  const err=document.getElementById('l-err');
  const user=Object.values(getUsers()).find(u=>u.email===email&&u.pw===btoa(pw));
  if(!user){err.textContent='Incorrect email or password.';return;}
  startSession(user.uid);
}

function startSession(uid){
  DB.set('ff_session',uid); currentUser=uid;
  document.getElementById('auth-screen').style.display='none';
  document.getElementById('app-screen').style.display='grid';
  initApp();
}
function doLogout(){
  stopTimer(); stopAmbient(); DB.del('ff_session'); currentUser=null;
  document.getElementById('app-screen').style.display='none';
  document.getElementById('auth-screen').style.display='';
}
function togglePw(id,el){
  const i=document.getElementById(id);
  i.type=i.type==='password'?'text':'password';
  el.className='ti peye '+(i.type==='text'?'ti-eye-off':'ti-eye');
}

/* ══ INIT ══ */
function initApp(){
  loadProfileUI();
  initTimer();
  renderTasks();
  setupSleepDate();
  navigate('dashboard');
  if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
}

/* ══ NAVIGATION ══ */
const PAGE_TITLES={dashboard:'Dashboard',timer:'Pomodoro Timer',sleep:'Sleep Tracker',
  habits:'Habits',water:'Water Tracker',notes:'Study Notes',analytics:'Analytics',profile:'Profile'};
let curPage='dashboard';

function navigate(p){
  // Don't re-render if same page (except dashboard which shows live data)
  if(p===curPage&&p!=='dashboard') return;
  curPage=p;
  document.querySelectorAll('.page').forEach(el=>el.classList.remove('active'));
  document.querySelectorAll('.sn,.bn').forEach(el=>el.classList.remove('active'));
  const pg=document.getElementById('page-'+p);
  if(pg) pg.classList.add('active');
  document.querySelectorAll(`[data-p="${p}"]`).forEach(el=>el.classList.add('active'));
  const tt=document.getElementById('topbar-title');
  if(tt) tt.textContent=PAGE_TITLES[p]||p;
  closeSB();
  if(p==='dashboard')  renderDashboard();
  if(p==='sleep')      {setupSleepDate();loadSleepPage();}
  if(p==='habits')     loadHabits();
  if(p==='water')      loadWater();
  if(p==='notes')      loadNotes();
  if(p==='analytics')  renderAnalytics();
  if(p==='profile')    renderProfile();
}

function toggleSB(){
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sb-ov').classList.toggle('show');
}
function closeSB(){
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sb-ov').classList.remove('show');
}
document.addEventListener('click',e=>{
  if(document.getElementById('sb-ov').classList.contains('show')&&!document.getElementById('sidebar').contains(e.target))closeSB();
});

/* ══ PROFILE ══ */
const getProfile=()=>DB.get(`ff_profile_${currentUser}`,{name:'',email:'',bio:'',goal:120,sleepGoal:8,avatar:''});
const setProfile=p=>DB.set(`ff_profile_${currentUser}`,p);
const ini=name=>name.split(' ').filter(Boolean).map(w=>w[0]).join('').toUpperCase().slice(0,2)||'?';
const setText=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
const setVal=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v;};

function setAvEl(id,avatar,init){
  const el=document.getElementById(id); if(!el) return;
  if(avatar){el.innerHTML=`<img src="${avatar}" alt=""/>`;}
  else{el.textContent='';el.textContent=init;}
}

function loadProfileUI(){
  const p=getProfile(); const i=ini(p.name);
  ['sb-av','tb-av','dash-av'].forEach(id=>setAvEl(id,p.avatar,i));
  setText('sb-name',p.name||'User');
  const h=new Date().getHours();
  const g=h<5?'Good night':h<12?'Good morning':h<17?'Good afternoon':'Good evening';
  setText('dash-greet',`${g}, ${p.name.split(' ')[0]||'there'} 👋`);
  setText('dash-date',new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'}));
}

function renderProfile(){
  const p=getProfile(); const users=getUsers(); const user=users[currentUser]||{};
  setAvEl('pr-av',p.avatar,ini(p.name));
  setText('pr-name',p.name); setText('pr-email',p.email||'');
  setText('pr-joined',user.joined?'Joined '+new Date(user.joined).toLocaleDateString('en-GB',{month:'long',year:'numeric'}):'');
  setVal('pe-name',p.name); setVal('pe-bio',p.bio||'');
  setVal('pe-goal',p.goal||120); setVal('pe-sg',p.sleepGoal||8);
  renderBadges(); renderAchievements();
}

function saveProfile(){
  const p=getProfile();
  p.name=document.getElementById('pe-name')?.value.trim()||p.name;
  p.bio=document.getElementById('pe-bio')?.value.trim()||'';
  p.goal=parseInt(document.getElementById('pe-goal')?.value)||120;
  p.sleepGoal=parseFloat(document.getElementById('pe-sg')?.value)||8;
  setProfile(p); loadProfileUI(); renderProfile(); toast('Profile saved ✓');
}

function uploadAv(inp){
  const file=inp.files[0]; if(!file) return;
  new Promise(res=>{const r=new FileReader();r.onload=e=>res(e.target.result);r.readAsDataURL(file);})
    .then(av=>{const p=getProfile();p.avatar=av;setProfile(p);loadProfileUI();renderProfile();toast('Photo updated 📸');});
}

function renderBadges(){
  const logs=getLogs(); const fm=fmAll(logs);
  const badges=[];
  if(fm>=60)  badges.push({t:'1h Focus',c:'purple'});
  if(fm>=600) badges.push({t:'10h Focus',c:'purple'});
  if(getSleepLogs().length>=7) badges.push({t:'7-Day Sleep',c:'blue'});
  if(getHabits().length>=3)    badges.push({t:'Habit Builder',c:'green'});
  if(getNotes().length>=5)     badges.push({t:'Note Taker',c:'amber'});
  const el=document.getElementById('pr-badges'); if(!el) return;
  el.innerHTML=badges.length
    ?badges.map(b=>`<span class="badge ${b.c}">${b.t}</span>`).join('')
    :'<span style="font-size:12px;color:var(--tx3)">Complete sessions to earn badges</span>';
}

const ACH=[
  {id:'a1',ico:'🎯',name:'First Focus',   desc:'Complete first session',  chk:l=>l.filter(x=>x.type==='session').length>=1},
  {id:'a2',ico:'🔥',name:'On Fire',        desc:'10 focus sessions',       chk:l=>l.filter(x=>x.type==='session').length>=10},
  {id:'a3',ico:'💯',name:'Century',         desc:'100 sessions',            chk:l=>l.filter(x=>x.type==='session').length>=100},
  {id:'a4',ico:'⏰',name:'Deep Work',       desc:'5 total hours of focus',  chk:l=>fmAll(l)>=300},
  {id:'a5',ico:'🌙',name:'First Sleep Log', desc:'Log your first sleep',   chk:()=>getSleepLogs().length>=1},
  {id:'a6',ico:'😴',name:'Sleep Champion',  desc:'7 nights logged',        chk:()=>getSleepLogs().length>=7},
  {id:'a7',ico:'💧',name:'Hydrated',        desc:'Hit water goal one day', chk:()=>Object.values(getWaterLogs()).some(v=>v>=getWaterGoal())},
  {id:'a8',ico:'📚',name:'Note Taker',      desc:'Write 5 notes',          chk:()=>getNotes().length>=5},
  {id:'a9',ico:'✅',name:'Habit Builder',   desc:'Add 3 habits',           chk:()=>getHabits().length>=3},
  {id:'a10',ico:'📸',name:'Face of Focus',  desc:'Upload a profile photo', chk:()=>!!getProfile().avatar},
];

function renderAchievements(){
  const logs=getLogs(); const el=document.getElementById('ach-grid'); if(!el) return;
  el.innerHTML=ACH.map(a=>{
    const ok=a.chk(logs);
    return `<div class="ach ${ok?'unlocked':'locked'}"><div class="ach-ico">${a.ico}</div><div class="ach-name">${a.name}</div><div class="ach-desc">${a.desc}</div></div>`;
  }).join('');
}

/* ══ LOGS ══ */
const getLogs=()=>DB.get(UK('logs'),[]);
function addLog(e){
  const logs=getLogs();
  logs.unshift({...e,id:Date.now(),ts:new Date().toISOString()});
  DB.set(UK('logs'),logs.slice(0,2000));
}
const fmAll=logs=>logs.filter(l=>l.type==='focus').reduce((s,l)=>s+(l.minutes||0),0);
const todayStr=()=>new Date().toISOString().slice(0,10);
const todayFm=()=>getLogs().filter(l=>l.type==='focus'&&l.date===todayStr()).reduce((s,l)=>s+(l.minutes||0),0);

function timeAgo(ts){
  const d=(Date.now()-new Date(ts))/60000;
  if(d<1)return'just now';if(d<60)return Math.round(d)+'m ago';
  if(d<1440)return Math.round(d/60)+'h ago';
  return new Date(ts).toLocaleDateString('en-GB',{day:'numeric',month:'short'});
}

const last7=()=>Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));return d.toISOString().slice(0,10);});

function focusStreak(){
  const logs=getLogs(); let s=0; const d=new Date();
  for(let i=0;i<365;i++){
    if(logs.some(l=>l.type==='focus'&&l.date===d.toISOString().slice(0,10))){s++;d.setDate(d.getDate()-1);}else break;
  }
  return s;
}

function renderLog(id,logs,max=20){
  const el=document.getElementById(id); if(!el) return;
  if(!logs.length){el.innerHTML='<div class="empty-state"><i class="ti ti-list"></i>No activity yet</div>';return;}
  el.innerHTML=logs.slice(0,max).map(l=>
    `<div class="log-item"><div class="log-dot ${l.type}"></div><span class="log-text">${esc(l.label)}</span><span class="log-time">${timeAgo(l.ts)}</span></div>`
  ).join('');
}

/* ══ CHARTS — singleton, update in-place, animation:false ══ */
const Ch={};
function upsert(id,type,labels,datasets,opts){
  const cv=document.getElementById(id); if(!cv) return;
  if(Ch[id]){
    Ch[id].data.labels=labels;
    datasets.forEach((d,i)=>{
      if(!Ch[id].data.datasets[i]) return;
      Ch[id].data.datasets[i].data=d.data;
      if(d.backgroundColor!==undefined)Ch[id].data.datasets[i].backgroundColor=d.backgroundColor;
    });
    Ch[id].update('none'); // ← key: no animation, no jank
    return;
  }
  Ch[id]=new Chart(cv.getContext('2d'),{type,data:{labels,datasets},options:opts||bOpts('val')});
}

function bOpts(unit){
  return{responsive:true,maintainAspectRatio:false,animation:{duration:0},
    plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>c.raw+unit}}},
    scales:{x:{grid:{display:false},ticks:{color:'#5c5a65',font:{size:11}}},
            y:{grid:{color:'rgba(255,255,255,0.04)'},ticks:{color:'#5c5a65',font:{size:11}}}}};
}

/* ══ DASHBOARD ══ */
function renderDashboard(){
  loadProfileUI();
  const fm=todayFm();
  setText('kpi-focus',fm>=60?(fm/60).toFixed(1)+'h':fm+'m');
  const sl=getSleepLogs()[0];
  setText('kpi-sleep',sl?sl.hours.toFixed(1)+'h':'—');
  setText('kpi-streak',focusStreak());
  const habs=getHabits(),hlog=getHabitLog();
  setText('kpi-habits',`${habs.filter(h=>hlog[h.id+'_'+todayStr()]).length}/${habs.length}`);
  // Charts update in-place
  buildWFChart(); buildWSChart();
  renderLog('dash-log',getLogs());
  const QUOTES=[
    '"Deep work is the superpower of our age." — Cal Newport',
    '"The secret of getting ahead is getting started." — Mark Twain',
    '"Focus is the art of knowing what to ignore."',
    '"Small steps every day lead to extraordinary results."',
    '"Discipline is the bridge between goals and accomplishment." — Jim Rohn',
    '"An investment in knowledge pays the best interest." — Benjamin Franklin',
    '"Your future self will thank you for every hour of focus today."',
    '"Study hard. Dream big. Work harder than yesterday."',
  ];
  setText('dash-quote',QUOTES[new Date().getDate()%QUOTES.length]);
}

function buildWFChart(){
  const days=last7(),logs=getLogs();
  const data=days.map(d=>logs.filter(l=>l.type==='focus'&&l.date===d).reduce((s,l)=>s+(l.minutes||0),0));
  const lbl=days.map(d=>new Date(d+'T00:00:00').toLocaleDateString('en-GB',{weekday:'short'}));
  upsert('c-wf','bar',lbl,[{data,backgroundColor:'#7c6fcd55',borderColor:'#7c6fcd',borderWidth:1.5,borderRadius:6,borderSkipped:false}],bOpts('min'));
}

function buildWSChart(){
  const days=last7(),slogs=getSleepLogs();
  const data=days.map(d=>{const s=slogs.find(l=>l.date===d);return s?+s.hours.toFixed(1):0;});
  const lbl=days.map(d=>new Date(d+'T00:00:00').toLocaleDateString('en-GB',{weekday:'short'}));
  upsert('c-ws','bar',lbl,[{data,backgroundColor:'#3a85e055',borderColor:'#3a85e0',borderWidth:1.5,borderRadius:6,borderSkipped:false}],bOpts('h'));
}

/* ══ AUDIO ══ */
let actx=null, ambNodes=[];
function unlock(){
  try{
    if(!actx)actx=new(window.AudioContext||window.webkitAudioContext)();
    if(actx.state==='suspended')actx.resume();
  }catch{}
}
function tone(f,type='sine',dur=0.8,g=0.2,delay=0){
  try{
    unlock(); const ctx=actx;
    const o=ctx.createOscillator(),gn=ctx.createGain();
    o.connect(gn);gn.connect(ctx.destination);
    o.type=type;o.frequency.setValueAtTime(f,ctx.currentTime+delay);
    gn.gain.setValueAtTime(0,ctx.currentTime+delay);
    gn.gain.linearRampToValueAtTime(g,ctx.currentTime+delay+0.02);
    gn.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+delay+dur);
    o.start(ctx.currentTime+delay);o.stop(ctx.currentTime+delay+dur);
  }catch{}
}
function playBell(){
  if(!document.getElementById('snd')?.checked)return;
  unlock();
  if(timerMode==='focus'){[[523,0],[659,.18],[784,.36],[1047,.54],[1319,.72]].forEach(([f,d])=>tone(f,'sine',1.2,0.18,d));}
  else{[[784,0],[659,.2],[523,.4]].forEach(([f,d])=>tone(f,'sine',0.9,0.14,d));}
}
function playTick(){
  if(!document.getElementById('tick')?.checked||!running)return;
  try{
    unlock();
    const buf=actx.createBuffer(1,Math.floor(actx.sampleRate*.012),actx.sampleRate);
    const d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*.06;
    const src=actx.createBufferSource(),gn=actx.createGain();
    gn.gain.setValueAtTime(.08,actx.currentTime);gn.gain.exponentialRampToValueAtTime(.001,actx.currentTime+.012);
    src.buffer=buf;src.connect(gn);gn.connect(actx.destination);src.start();
  }catch{}
}
function setAmb(type,btn){
  unlock(); stopAmbient();
  document.querySelectorAll('.ab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active'); if(type==='off')return;
  try{
    const ctx=actx;
    if(type==='white'||type==='brown'){
      const buf=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),d=buf.getChannelData(0);
      if(type==='white'){for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;}
      else{let l=0;for(let i=0;i<d.length;i++){l=(l+.02*(Math.random()*2-1))/1.02;d[i]=l*3.5;}}
      const src=ctx.createBufferSource(),gn=ctx.createGain();
      src.buffer=buf;src.loop=true;gn.gain.setValueAtTime(type==='white'?.04:.12,ctx.currentTime);
      src.connect(gn);gn.connect(ctx.destination);src.start();ambNodes.push(src,gn);
    }else if(type==='rain'){
      const buf=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),d=buf.getChannelData(0);
      for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
      const src=ctx.createBufferSource(),f=ctx.createBiquadFilter(),gn=ctx.createGain();
      src.buffer=buf;src.loop=true;f.type='bandpass';f.frequency.value=400;f.Q.value=.5;
      gn.gain.setValueAtTime(.18,ctx.currentTime);src.connect(f);f.connect(gn);gn.connect(ctx.destination);src.start();
      ambNodes.push(src,f,gn);
    }else if(type==='cafe'){
      const buf=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),d=buf.getChannelData(0);
      let l=0;for(let i=0;i<d.length;i++){l=(l+.02*(Math.random()*2-1))/1.02;d[i]=l*3;}
      const src=ctx.createBufferSource(),gn=ctx.createGain(),osc=ctx.createOscillator(),og=ctx.createGain();
      src.buffer=buf;src.loop=true;gn.gain.setValueAtTime(.08,ctx.currentTime);
      src.connect(gn);gn.connect(ctx.destination);src.start();
      osc.type='sawtooth';osc.frequency.setValueAtTime(80,ctx.currentTime);
      og.gain.setValueAtTime(.01,ctx.currentTime);osc.connect(og);og.connect(ctx.destination);osc.start();
      ambNodes.push(src,gn,osc,og);
    }
  }catch{}
}
function stopAmbient(){ambNodes.forEach(n=>{try{n.stop?n.stop():n.disconnect();}catch{}});ambNodes=[];}

/* ══ TIMER — rAF-based, zero setInterval ══ */
const DUR={focus:25,short:5,long:15};
let timerMode='focus', totalSecs=25*60, remSecs=25*60;
let running=false, rafId=null, sessCount=0, lastTs=0;

// Cache DOM refs — never look them up in the hot path
let _rf=null, _td=null;

function initTimer(){
  _rf=document.getElementById('ring-fg');
  _td=document.getElementById('t-disp');
  setMode('focus');
  renderDots();
  refreshTStats();
}

const fmtT=s=>String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
const modeColor=()=>({focus:'#7c6fcd',short:'#22c97a',long:'#3a85e0'})[timerMode];

/* updateRing — ONLY touches 2 pre-cached variables, no DOM queries */
function updateRing(){
  const circ=2*Math.PI*98;
  _rf.style.strokeDasharray=circ;
  _rf.style.strokeDashoffset=circ*(1-remSecs/totalSecs);
  _rf.style.stroke=modeColor();
  _td.textContent=fmtT(remSecs);
}

function setMode(m){
  stopTimer();
  timerMode=m; totalSecs=DUR[m]*60; remSecs=totalSecs;
  _rf=document.getElementById('ring-fg');
  _td=document.getElementById('t-disp');
  document.querySelectorAll('.mtab').forEach((t,i)=>t.classList.toggle('active',['focus','short','long'][i]===m));
  setText('t-lbl',{focus:'FOCUS TIME',short:'SHORT BREAK',long:'LONG BREAK'}[m]);
  const pi=document.getElementById('play-icon');if(pi)pi.className='ti ti-player-play';
  updateRing();
}

function toggleTimer(){unlock();running?stopTimer():startTimer();}

function startTimer(){
  running=true; lastTs=performance.now();
  const pi=document.getElementById('play-icon');if(pi)pi.className='ti ti-player-pause';
  rafId=requestAnimationFrame(rafLoop);
}

function stopTimer(){
  running=false;
  if(rafId){cancelAnimationFrame(rafId);rafId=null;}
  const pi=document.getElementById('play-icon');if(pi)pi.className='ti ti-player-play';
}

/*
 * ★ HOT PATH — runs ~60fps via rAF.
 * Only triggers timerTick() once per second using timestamp diff.
 * Never touches charts, never touches logs, never queries DOM by class/id.
 */
function rafLoop(ts){
  if(!running)return;
  if(ts-lastTs>=1000){
    lastTs+=1000; // steady drift correction
    timerTick();
  }
  rafId=requestAnimationFrame(rafLoop);
}

function timerTick(){
  if(remSecs<=0){onEnd();return;}
  remSecs--;
  updateRing();   // 2 cached DOM nodes only
  playTick();     // audio (conditional)
  document.title=fmtT(remSecs)+' — FocusFlow';
}

function resetTimer(){unlock();stopTimer();remSecs=totalSecs;updateRing();}
function skipSession(){unlock();stopTimer();onEnd(true);}

function onEnd(skipped=false){
  stopTimer(); remSecs=0; updateRing();
  document.title='FocusFlow — by Omar Mohamed';
  if(!skipped)playBell();
  if(timerMode==='focus'){
    sessCount++;
    const min=DUR.focus; const topic=document.getElementById('working-on')?.value.trim();
    addLog({type:'focus',label:`${min}min focus${topic?' — '+topic:''}`,minutes:min,date:todayStr()});
    addLog({type:'session',label:`Pomodoro done${topic?': '+topic:''}`,minutes:min,date:todayStr()});
    refreshTStats(); renderDots(); toast('Session complete! 🎉');
    const next=sessCount%4===0?'long':'short';
    setTimeout(()=>{setMode(next);if(document.getElementById('auto')?.checked)startTimer();},1200);
  }else{
    toast('Break over — back to focus! 💪');
    setTimeout(()=>{setMode('focus');if(document.getElementById('auto')?.checked)startTimer();},1200);
  }
  if(curPage==='dashboard')renderDashboard();
}

/* ★ ADD TIME — works while running or paused */
function addTimeSecs(secs){
  unlock();
  remSecs=Math.max(1,Math.min(remSecs+secs, 7200)); // clamp 1s–2h
  if(secs>totalSecs/2) totalSecs=remSecs; // extend total if needed so ring looks right
  updateRing();
  toast(secs>0?`+${secs/60}min added`:`${Math.abs(secs/60)}min removed`);
}

/* ★ APPLY CUSTOM DURATION */
function applyCustomDur(){
  unlock();
  const v=parseInt(document.getElementById('custom-min')?.value)||0;
  if(v<1||v>180){toast('Enter 1–180 minutes');return;}
  stopTimer(); DUR[timerMode]=v; totalSecs=v*60; remSecs=totalSecs;
  document.getElementById('d-'+timerMode).textContent=v+'m';
  updateRing(); toast(`Timer set to ${v} minutes`);
}

function refreshTStats(){
  setText('ts-sess',sessCount); setText('ts-min',todayFm()+'m'); setText('ts-str',focusStreak());
}

function renderDots(){
  const w=document.getElementById('sdots');if(!w)return;
  w.innerHTML='';
  for(let i=0;i<4;i++){
    const d=document.createElement('div');
    const pos=sessCount%4;
    d.className='sdot'+(i<pos?' done':i===pos&&running?' cur':'');
    w.appendChild(d);
  }
}

function adjDur(key,delta){
  DUR[key]=Math.max(1,Math.min(120,DUR[key]+delta));
  document.getElementById('d-'+key).textContent=DUR[key]+'m';
  if(timerMode===key&&!running){totalSecs=DUR[key]*60;remSecs=totalSecs;updateRing();}
}

/* ══ TASKS ══ */
const getTasks=()=>DB.get(UK('tasks'),[]);
const setTasks=t=>DB.set(UK('tasks'),t);
function addTask(){
  unlock();
  const inp=document.getElementById('task-inp');if(!inp)return;
  const v=inp.value.trim();if(!v)return;
  const tasks=getTasks();tasks.push({id:Date.now(),text:v,done:false,date:todayStr()});
  setTasks(tasks);inp.value='';renderTasks();
}
function toggleTask(id){const t=getTasks();const x=t.find(t=>t.id===id);if(x){x.done=!x.done;setTasks(t);renderTasks();}}
function deleteTask(id){setTasks(getTasks().filter(t=>t.id!==id));renderTasks();}
function renderTasks(){
  const el=document.getElementById('task-list');if(!el)return;
  const tasks=getTasks().filter(t=>t.date===todayStr());
  el.innerHTML=tasks.length
    ?tasks.map(t=>`<div class="task-item"><div class="task-cb ${t.done?'done':''}" onclick="toggleTask(${t.id})">${t.done?'<i class="ti ti-check"></i>':''}</div><span class="task-txt ${t.done?'done':''}">${esc(t.text)}</span><button class="task-del" onclick="deleteTask(${t.id})"><i class="ti ti-x"></i></button></div>`).join('')
    :'<div class="empty-state" style="padding:.75rem 0"><i class="ti ti-checkbox" style="font-size:24px;margin-bottom:4px"></i>No tasks yet</div>';
}

/* ══ SLEEP — reads H+M number inputs, no type="time" lag ══ */
let slStar=3;
const getSleepLogs=()=>DB.get(UK('sleep'),[]);
const setSleepLogs=l=>DB.set(UK('sleep'),l);
function setupSleepDate(){const el=document.getElementById('sl-date');if(el&&!el.value)el.value=todayStr();}
function setStar(v){slStar=v;document.querySelectorAll('#sl-stars i').forEach((s,i)=>s.classList.toggle('lit',i<v));}

function readHM(hId,mId){
  const h=parseInt(document.getElementById(hId)?.value)||0;
  const m=parseInt(document.getElementById(mId)?.value)||0;
  return h*60+m; // returns total minutes from midnight
}

function sleepHrs(bedMin,wakeMin){
  let diff=wakeMin-bedMin; if(diff<=0)diff+=1440; return+(diff/60).toFixed(2);
}

function hhmm(totalMin){
  const h=Math.floor(totalMin/60)%24; const m=totalMin%60;
  return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');
}

function logSleep(){
  unlock();
  const bedMin=readHM('bed-h','bed-m'); const wakeMin=readHM('wake-h','wake-m');
  const date=document.getElementById('sl-date')?.value;
  const note=document.getElementById('sl-note')?.value.trim();
  const bedH=parseInt(document.getElementById('bed-h')?.value);
  const wakeH=parseInt(document.getElementById('wake-h')?.value);
  if(isNaN(bedH)||isNaN(wakeH)||!date){toast('Enter bedtime, wake-up time and date');return;}
  const hours=sleepHrs(bedMin,wakeMin);
  const bedStr=hhmm(bedMin); const wakeStr=hhmm(wakeMin);
  const logs=getSleepLogs(); const idx=logs.findIndex(l=>l.date===date);
  const entry={id:Date.now(),date,bed:bedStr,wake:wakeStr,hours,quality:slStar,note:note||''};
  if(idx>-1)logs[idx]=entry;else logs.unshift(entry);
  setSleepLogs(logs.sort((a,b)=>b.date.localeCompare(a.date)));
  addLog({type:'sleep',label:`Slept ${hours.toFixed(1)}h · ${bedStr} → ${wakeStr} · ${'★'.repeat(slStar)}`,date});
  toast(`Sleep logged: ${hours.toFixed(1)} hours 🌙`);
  loadSleepPage();
}

function loadSleepPage(){
  const logs=getSleepLogs();
  if(logs.length){
    const avg=logs.reduce((s,l)=>s+l.hours,0)/logs.length;
    const best=Math.max(...logs.map(l=>l.hours));
    const avgQ=logs.reduce((s,l)=>s+(l.quality||3),0)/logs.length;
    setText('ss-avg',avg.toFixed(1)+'h');setText('ss-best',best.toFixed(1)+'h');
    setText('ss-qual',avgQ.toFixed(1)+'★');setText('ss-days',logs.length);
  }else{
    ['ss-avg','ss-best','ss-qual'].forEach(id=>setText(id,'—'));setText('ss-days','0');
  }
  buildSleepChart(); renderSleepHist();
}

function buildSleepChart(){
  const days=last7(),slogs=getSleepLogs();
  const data=days.map(d=>{const s=slogs.find(l=>l.date===d);return s?+s.hours.toFixed(1):0;});
  const lbl=days.map(d=>new Date(d+'T00:00:00').toLocaleDateString('en-GB',{weekday:'short'}));
  upsert('c-sleep-pg','line',lbl,
    [{data,borderColor:'#3a85e0',backgroundColor:'rgba(58,133,224,.1)',tension:.4,fill:true,pointBackgroundColor:'#3a85e0',pointRadius:4}],
    bOpts('h'));
}

function renderSleepHist(){
  const el=document.getElementById('sleep-hist');if(!el)return;
  const logs=getSleepLogs();
  if(!logs.length){el.innerHTML='<div class="empty-state"><i class="ti ti-moon"></i>No sleep logged yet</div>';return;}
  el.innerHTML=logs.slice(0,30).map(l=>`
    <div class="log-item"><div class="log-dot sleep"></div>
    <span class="log-text">${l.date} · ${l.bed} → ${l.wake} · ${l.hours.toFixed(1)}h · ${'★'.repeat(l.quality||3)}${l.note?' · '+esc(l.note):''}</span>
    <button class="log-del" onclick="delSleep(${l.id})"><i class="ti ti-x"></i></button></div>`).join('');
}
function delSleep(id){setSleepLogs(getSleepLogs().filter(l=>l.id!==id));loadSleepPage();toast('Removed');}

/* ══ HABITS ══ */
const getHabits=()=>DB.get(UK('habits'),[]);
const setHabits=h=>DB.set(UK('habits'),h);
const getHabitLog=()=>DB.get(UK('hlog'),{});
const setHabitLog=l=>DB.set(UK('hlog'),l);
function openHM(){document.getElementById('h-modal').style.display='flex';}
function closeHM(){document.getElementById('h-modal').style.display='none';}
function saveHabit(){
  const name=document.getElementById('h-name')?.value.trim();
  const emoji=document.getElementById('h-emoji')?.value.trim()||'✅';
  const cat=document.getElementById('h-cat')?.value;
  if(!name){toast('Enter a habit name');return;}
  const h=getHabits();h.push({id:Date.now(),name,emoji,cat,created:todayStr()});setHabits(h);
  setVal('h-name','');setVal('h-emoji','');closeHM();loadHabits();toast('Habit added 💚');
}
function toggleHabit(id){
  unlock();
  const log=getHabitLog();const key=id+'_'+todayStr();log[key]=!log[key];setHabitLog(log);
  if(log[key]){const h=getHabits().find(h=>h.id===id);addLog({type:'habit',label:`Habit done: ${h?h.emoji+' '+h.name:''}`,date:todayStr()});toast('Done! '+(h?.emoji||'✅'));}
  loadHabits();
}
function delHabit(id){setHabits(getHabits().filter(h=>h.id!==id));loadHabits();toast('Removed');}
function loadHabits(){
  const habs=getHabits(),log=getHabitLog(),today=todayStr();
  const hd=document.getElementById('hd-today');if(hd)hd.textContent=new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'});
  const el=document.getElementById('habits-today');if(!el)return;
  el.innerHTML=habs.length
    ?habs.map(h=>{const done=!!log[h.id+'_'+today];return`<div class="habit-row"><span class="h-emoji">${h.emoji}</span><div style="flex:1"><div class="h-name">${esc(h.name)}</div><div class="h-cat">${h.cat}</div></div><button class="h-chk ${done?'done':''}" onclick="toggleHabit(${h.id})">${done?'<i class="ti ti-check"></i>':''}</button><button class="h-del" onclick="delHabit(${h.id})"><i class="ti ti-trash"></i></button></div>`;}).join('')
    :'<div class="empty-state"><i class="ti ti-heart"></i>Add your first habit!</div>';
  renderHabitWeek(habs,log);
}
function renderHabitWeek(habs,log){
  const el=document.getElementById('habits-week');if(!el)return;
  const days=last7(),today=todayStr();
  const lbl=days.map(d=>new Date(d+'T00:00:00').toLocaleDateString('en-GB',{weekday:'short'}));
  el.innerHTML=habs.map(h=>`<div class="hw-row"><div class="hwn">${h.emoji} ${esc(h.name)}</div><div class="hw-dots">${days.map((d,i)=>`<div class="hw-d ${log[h.id+'_'+d]?'done':''} ${d===today?'today':''}">${lbl[i]}</div>`).join('')}</div></div>`).join('');
}

/* ══ WATER ══ */
const getWaterLogs=()=>DB.get(UK('water'),{});
const setWaterLogs=l=>DB.set(UK('water'),l);
const getWaterGoal=()=>DB.get(UK('wgoal'),8);
const setWaterGoal=g=>DB.set(UK('wgoal'),g);
function addWater(){unlock();adjWater(1);}
function removeWater(){adjWater(-1);}
function adjWater(delta){
  const logs=getWaterLogs(),today=todayStr();
  logs[today]=Math.max(0,Math.min(20,(logs[today]||0)+delta));setWaterLogs(logs);
  if(delta>0)addLog({type:'water',label:`Glass of water 💧 (${logs[today]} today)`,date:today});
  loadWater();
}
function adjWGoal(delta){
  const g=Math.max(1,Math.min(20,getWaterGoal()+delta));setWaterGoal(g);
  setText('w-goal-n',g);setText('w-goal-lbl',g+' glasses');loadWater();
}
function loadWater(){
  const logs=getWaterLogs(),today=todayStr(),goal=getWaterGoal(),count=logs[today]||0;
  setText('w-count',count);setText('w-goal-n',goal);setText('w-goal-lbl',goal+' glasses');
  const circ=2*Math.PI*85,fg=document.getElementById('wr-fg');
  if(fg){fg.style.strokeDasharray=circ;fg.style.strokeDashoffset=circ*(1-Math.min(count/goal,1));}
  const cups=document.getElementById('w-cups');
  if(cups)cups.innerHTML=Array.from({length:goal},(_,i)=>`<div class="w-cup ${i<count?'filled':''}">💧</div>`).join('');
  const vals=Object.values(logs).filter(v=>v>0);
  setText('wst-avg',vals.length?(vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1):'0');
  setText('wst-best',vals.length?Math.max(...vals):'0');
  setText('wst-str',calcWStr(logs,goal));
  buildWaterChart(logs,goal);
}
function calcWStr(logs,goal){let s=0;const d=new Date();for(let i=0;i<365;i++){if((logs[d.toISOString().slice(0,10)]||0)>=goal){s++;d.setDate(d.getDate()-1);}else break;}return s;}
function buildWaterChart(logs,goal){
  const days=last7(),data=days.map(d=>logs[d]||0);
  const lbl=days.map(d=>new Date(d+'T00:00:00').toLocaleDateString('en-GB',{weekday:'short'}));
  upsert('c-water','bar',lbl,
    [{data,backgroundColor:data.map(v=>v>=goal?'#15b5c8aa':'#15b5c844'),borderColor:'#15b5c8',borderWidth:1.5,borderRadius:6},
     {data:Array(7).fill(goal),type:'line',borderColor:'rgba(21,181,200,.4)',borderDash:[4,4],pointRadius:0,fill:false}],
    bOpts(''));
}

/* ══ NOTES ══ */
let curNoteId=null;
const getNotes=()=>DB.get(UK('notes'),[]);
const setNotes=n=>DB.set(UK('notes'),n);
function loadNotes(){renderNoteList();const n=getNotes();if(n.length)openNote(n[0].id);else clearEditor();}
function renderNoteList(){
  const el=document.getElementById('notes-list');if(!el)return;
  const notes=getNotes();
  if(!notes.length){el.innerHTML='<div class="notes-empty"><i class="ti ti-notes"></i>No notes yet.<br/>Click "New note" to start</div>';return;}
  el.innerHTML=notes.map(n=>`<div class="note-item ${n.id===curNoteId?'active':''}" onclick="openNote(${n.id})"><div class="ni-title">${esc(n.title||'Untitled')}</div><div class="ni-prev">${esc((n.body||'').slice(0,80))}</div><div class="ni-date">${new Date(n.ts).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}${n.tags?' · '+esc(n.tags):''}</div></div>`).join('');
}
function newNote(){
  const note={id:Date.now(),title:'',body:'',tags:'',ts:new Date().toISOString()};
  const notes=getNotes();notes.unshift(note);setNotes(notes);
  curNoteId=note.id;renderNoteList();openNote(note.id);document.getElementById('note-title')?.focus();
}
function openNote(id){const n=getNotes().find(n=>n.id===id);if(!n)return;curNoteId=id;setVal('note-title',n.title||'');setVal('note-body',n.body||'');setVal('note-tags',n.tags||'');renderNoteList();}
function saveNote(){
  const notes=getNotes();const idx=notes.findIndex(n=>n.id===curNoteId);if(idx===-1)return;
  notes[idx].title=document.getElementById('note-title')?.value.trim()||'Untitled';
  notes[idx].body=document.getElementById('note-body')?.value||'';
  notes[idx].tags=document.getElementById('note-tags')?.value.trim()||'';
  notes[idx].ts=new Date().toISOString();setNotes(notes);renderNoteList();
  addLog({type:'note',label:`Saved: "${notes[idx].title}"`,date:todayStr()});toast('Note saved 📝');
}
function deleteNote(){if(!curNoteId)return;setNotes(getNotes().filter(n=>n.id!==curNoteId));curNoteId=null;clearEditor();loadNotes();toast('Deleted');}
function clearEditor(){['note-title','note-body','note-tags'].forEach(id=>setVal(id,''));}

/* ══ ANALYTICS ══ */
function renderAnalytics(){
  const logs=getLogs(),slogs=getSleepLogs(),fm=fmAll(logs);
  setText('an-focus',(fm/60).toFixed(1)+'h');
  const avgSl=slogs.length?slogs.reduce((s,l)=>s+l.hours,0)/slogs.length:0;
  setText('an-sleep',avgSl?avgSl.toFixed(1)+'h':'—');
  setText('an-days',[...new Set(logs.map(l=>l.date))].length);
  const byDay={};logs.filter(l=>l.type==='focus').forEach(l=>{byDay[l.date]=(byDay[l.date]||0)+(l.minutes||0);});
  const best=Object.entries(byDay).sort((a,b)=>b[1]-a[1])[0];
  setText('an-best',best?new Date(best[0]+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'}):'—');
  build14();buildPie(logs,slogs);buildScat(logs,slogs);renderLog('an-log',logs,60);
}
function build14(){
  const days=Array.from({length:14},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(13-i));return d.toISOString().slice(0,10);});
  const logs=getLogs(),data=days.map(d=>logs.filter(l=>l.type==='focus'&&l.date===d).reduce((s,l)=>s+(l.minutes||0),0));
  const lbl=days.map(d=>new Date(d+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'}));
  upsert('c-an14','bar',lbl,[{data,backgroundColor:days.map((_,i)=>i===13?'#7c6fcd':'#7c6fcd44'),borderRadius:6,borderSkipped:false}],bOpts('min'));
}
function buildPie(logs,slogs){
  const dN=Math.max(1,[...new Set(logs.map(l=>l.date))].length);
  const fh=+(fmAll(logs)/dN/60).toFixed(1);
  const sh=+(slogs.reduce((s,l)=>s+l.hours,0)/Math.max(1,slogs.length)).toFixed(1);
  const ot=Math.max(0,+(24-fh-sh).toFixed(1));
  const cv=document.getElementById('c-pie');if(!cv)return;
  if(Ch['c-pie']){Ch['c-pie'].data.datasets[0].data=[fh,sh,ot];Ch['c-pie'].update('none');return;}
  Ch['c-pie']=new Chart(cv.getContext('2d'),{type:'doughnut',data:{labels:['Focus','Sleep','Other'],datasets:[{data:[fh,sh,ot],backgroundColor:['#7c6fcd','#3a85e0','#27272f'],borderWidth:0,spacing:2}]},options:{responsive:true,maintainAspectRatio:false,animation:{duration:0},cutout:'65%',plugins:{legend:{position:'bottom',labels:{color:'#9896a0',font:{size:12},padding:16}}}}});
}
function buildScat(logs,slogs){
  const fd={};logs.filter(l=>l.type==='focus').forEach(l=>{fd[l.date]=(fd[l.date]||0)+(l.minutes||0);});
  const pts=slogs.map(s=>({x:+s.hours.toFixed(1),y:fd[s.date]||0})).filter(p=>p.y>0);
  const cv=document.getElementById('c-scat');if(!cv)return;
  if(Ch['c-scat']){Ch['c-scat'].data.datasets[0].data=pts;Ch['c-scat'].update('none');return;}
  Ch['c-scat']=new Chart(cv.getContext('2d'),{type:'scatter',data:{datasets:[{data:pts,backgroundColor:'#7c6fcd',pointRadius:6}]},options:{responsive:true,maintainAspectRatio:false,animation:{duration:0},plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`Sleep: ${c.raw.x}h · Focus: ${c.raw.y}min`}}},scales:{x:{title:{display:true,text:'Sleep (h)',color:'#5c5a65',font:{size:11}},grid:{color:'rgba(255,255,255,0.04)'},ticks:{color:'#5c5a65',font:{size:11}}},y:{title:{display:true,text:'Focus (min)',color:'#5c5a65',font:{size:11}},grid:{color:'rgba(255,255,255,0.04)'},ticks:{color:'#5c5a65',font:{size:11}}}}}});
}

/* ══ UTILS ══ */
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
let _tt;
function toast(msg){const el=document.getElementById('toast');if(!el)return;el.textContent=msg;el.classList.add('show');clearTimeout(_tt);_tt=setTimeout(()=>el.classList.remove('show'),3000);}

/* ══ BOOT ══ */
window.addEventListener('DOMContentLoaded',()=>{
  const uid=DB.get('ff_session');
  if(uid&&getUsers()[uid]){currentUser=uid;document.getElementById('auth-screen').style.display='none';document.getElementById('app-screen').style.display='grid';initApp();}
  document.getElementById('note-body')?.addEventListener('input',debounce(()=>{if(curNoteId)saveNote();},1500));
});
function debounce(fn,ms){let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);};}
