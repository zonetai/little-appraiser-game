/* ============================================================
   小小估價師大冒險 — 遊戲引擎
   ============================================================ */

/* ---------- 工具 ---------- */
const $ = id => document.getElementById(id);
const rnd = a => a[Math.floor(Math.random()*a.length)];
const rint = (a,b) => a+Math.floor(Math.random()*(b-a+1));
function shuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const stars = n => '⭐'.repeat(n) + '☆'.repeat(3-n);

/* ---------- 估咕貓頭鷹貼圖 ---------- */
const MASCOT='估咕貓頭鷹';
const STK={
  jiayou:['加油','stk-jiayou.png'], zaoan:['估摸檸（早安）','stk-zaoan.png'], wanan:['估耐（晚安）','stk-wanan.png'],
  zhuanye:['交給專業的來','stk-zhuanye.png'], lima:['立馬處理','stk-lima.png'], shengri:['生日快樂','stk-shengri.png'],
  deadline:['Deadline','stk-deadline.png'], tiekou:['鐵口直斷','stk-tiekou.png'], ganxie:['謝謝你','stk-tai-ganxie.png'],
  ok:['歐虧 OK','stk-ok.png'], qingzhu:['慶祝一下','stk-qingzhu.png'], jingda:['精打細算','stk-jingda.png'],
  newyear:['新年快樂','stk-newyear.png'], newyear2:['新年快樂','stk-newyear2.png'], tongxiao:['通宵趕報告','stk-tongxiao.png'],
  xiankan:['現勘中','stk-xiankan.png'], qiazhi:['掐指一算','stk-qiazhi.png'], duck:['真的 duck 不必','stk-duck.png'],
  jingzhun:['泰精準','stk-tai-jingzhun.png'], bengkui:['泰崩潰','stk-tai-bengkui.png'], xmas:['耶誕節快樂','stk-xmas.png'], xinkule:['辛苦了','stk-xinkule.png']};
function stk(k, cls){ const s=STK[k]||STK.jiayou; return `<img class="stk ${cls||''}" src="assets/${s[1]}" alt="${MASCOT}：${s[0]}" loading="lazy">`; }
const stkOK = cls => stk(rnd(['jingzhun','jingda','ok','qingzhu']), cls);
const stkNO = cls => stk(rnd(['bengkui','jiayou','duck']), cls);
function seasonStk(){ const d=new Date(), m=d.getMonth()+1, day=d.getDate(), h=d.getHours();
  if(m===12 && day>=10 && day<=26) return 'xmas';
  if((m===1 && day>=15) || (m===2 && day<=20)) return rnd(['newyear','newyear2']);
  if(h>=21 || h<5) return 'wanan';
  return 'zaoan'; }
function celebrate(key, msg){
  let el=$('cele'); if(!el){ el=document.createElement('div'); el.id='cele'; el.className='cele'; document.body.appendChild(el); }
  el.innerHTML=`${stk(key,'cele-img')}<div class="cele-msg">${msg}</div>`; el.classList.add('show');
  clearTimeout(celebrate.t); celebrate.t=setTimeout(()=>el.classList.remove('show'), 2600);
  el.onclick=()=>el.classList.remove('show');
}

/* ---------- 逐題答題紀錄 ---------- */
const LOGKEY='kid-appraiser-log';
let LOG=(()=>{ try{ return JSON.parse(localStorage.getItem(LOGKEY)||'[]'); }catch(e){ return []; } })();
function logSave(){ try{ if(LOG.length>1500) LOG=LOG.slice(-1500); localStorage.setItem(LOGKEY, JSON.stringify(LOG)); }catch(e){} }
function logEvent(ev){ ev.t=Date.now(); ev.p=1; LOG.push(ev); logSave(); if(typeof cloudQueueFlush==='function') cloudQueueFlush(); }
const GAME_NAMES={quiz:'快問快答',tf:'真假快答',price:'哪間比較貴',estimate:'價格猜猜樂',comp:'找鄰居',city:'城市規劃師',mission:'估價師出任務',match:'連連看',card:'知識卡',quiz_done:'快問快答結算',tf_done:'真假快答結算',mission_done:'任務完成'};
const SCORED=['quiz','tf','price','estimate','comp','mission','city'];

/* ---------- 狀態 ---------- */
const KEY='kid-appraiser-v2';
function defaults(){ return {name:'', xp:0, read:[], badges:[], quizBest:0, chalBest:0, priceStreak:0, priceStreakBest:0, compCorrect:0, est3:0, estPlayed:0, tfBest:0, matchDone:0, matchBestMoves:0, city:{}, missions:{}, sound:true, plays:0}; }
let S = load();
function load(){ const d=defaults(); try{ const o=JSON.parse(localStorage.getItem(KEY)||'{}'); return Object.assign(d,o); }catch(e){ return d; } }
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){} refreshMeta(); if(typeof cloudPush==='function') cloudPush(); }

/* ---------- 音效 ---------- */
let actx=null;
function beep(freq, dur, type, vol){
  if(!S.sound) return;
  try{
    actx = actx || new (window.AudioContext||window.webkitAudioContext)();
    const o=actx.createOscillator(), g=actx.createGain();
    o.type=type||'sine'; o.frequency.value=freq; g.gain.value=vol||0.12;
    o.connect(g); g.connect(actx.destination); o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime+dur); o.stop(actx.currentTime+dur);
  }catch(e){}
}
const sfx = {
  ok(){ beep(660,.12); setTimeout(()=>beep(880,.18),90); },
  bad(){ beep(220,.25,'sawtooth',.08); },
  click(){ beep(520,.05,'triangle',.06); },
  badge(){ [523,659,784,1047].forEach((f,i)=>setTimeout(()=>beep(f,.25,'triangle'),i*110)); },
  level(){ [392,523,659,784,1047,1319].forEach((f,i)=>setTimeout(()=>beep(f,.3,'triangle'),i*100)); },
  tick(){ beep(1000,.03,'square',.03); },
};
function toggleSound(){ S.sound=!S.sound; save(); $('sound-btn').textContent=S.sound?'🔊':'🔇'; if(S.sound) sfx.ok(); }

/* ---------- 彩帶 ---------- */
let confettiPs=[], confettiRunning=false;
function confetti(n){
  const c=$('confetti'); if(!c) return; c.width=innerWidth; c.height=innerHeight;
  const cols=['#ffd166','#ff9f1c','#ef476f','#06d6a0','#118ab2','#9b5de5'];
  if(confettiPs.length>400) return; // 已經很多了，不再疊加
  for(let i=0;i<(n||120);i++) confettiPs.push({x:Math.random()*c.width, y:-20-Math.random()*200, vx:(Math.random()-.5)*4, vy:2+Math.random()*4, r:4+Math.random()*6, col:rnd(cols), rot:Math.random()*6, vr:(Math.random()-.5)*.3});
  if(confettiRunning) return; confettiRunning=true; c.style.display='block';
  const ctx=c.getContext('2d');
  (function frame(){
    ctx.clearRect(0,0,c.width,c.height);
    confettiPs.forEach(p=>{ p.x+=p.vx; p.y+=p.vy; p.vy+=.05; p.rot+=p.vr; ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot); ctx.fillStyle=p.col; ctx.fillRect(-p.r/2,-p.r/2,p.r,p.r*1.6); ctx.restore(); });
    confettiPs=confettiPs.filter(p=>p.y<c.height+20);
    if(confettiPs.length) requestAnimationFrame(frame); else { ctx.clearRect(0,0,c.width,c.height); c.style.display='none'; confettiRunning=false; }
  })();
}

/* ---------- 通知 ---------- */
let toastTimer, toastQueue=[], toastBusy=false;
function toast(msg, cls){
  if(cls==='xp' && toastQueue.some(t=>t.cls==='xp')) return; // 避免 XP 通知塞車
  if(toastQueue.length>4) toastQueue.shift();
  toastQueue.push({msg,cls}); if(!toastBusy) nextToast();
}
function nextToast(){
  const it=toastQueue.shift(); if(!it){ toastBusy=false; return; }
  toastBusy=true; const t=$('toast'); t.textContent=it.msg; t.className='toast show '+(it.cls||'');
  setTimeout(()=>{ t.classList.remove('show'); setTimeout(nextToast, 350); }, 2000);
}

/* ---------- XP、等級、徽章 ---------- */
function levelOf(xp){ let L=LEVELS[0], i=0; LEVELS.forEach((l,k)=>{ if(xp>=l.xp){ L=l; i=k; } }); return {lv:L, idx:i, next:LEVELS[i+1]||null}; }
function addXP(n, why){
  if(!n) return;
  const before=levelOf(S.xp).idx; S.xp+=n; save();
  toast(`+${n} XP ${why||''}`, 'xp');
  const after=levelOf(S.xp);
  if(after.idx>before){ sfx.level(); confetti(200); celebrate('qingzhu', `升級！你現在是「${after.lv.ico} ${after.lv.name}」`); }
  checkBadges();
}
function checkBadges(){
  const gained=[];
  BADGES.forEach(b=>{ if(!S.badges.includes(b.id) && b.test(S)){ S.badges.push(b.id); gained.push(b); } });
  if(gained.length){
    save(); sfx.badge(); confetti(140);
    gained.forEach(b=>toast(`🏅 獲得徽章：${b.ico} ${b.name}！`, 'badge'));
    if(gained.some(b=>b.id==='master')) celebrate('shengri', '🎓 通過估咕初階認證：你是「小小估價師」了！');
  }
}
function refreshMeta(){
  const L=levelOf(S.xp);
  const pct = L.next ? Math.round((S.xp-L.lv.xp)/(L.next.xp-L.lv.xp)*100) : 100;
  $('hdr-level').innerHTML = `<span class="lv-ico">${L.lv.ico}</span><div><div class="lv-name">${esc(S.name||'小小估價師')} · ${L.lv.name}</div><div class="lv-bar"><i style="width:${pct}%"></i></div><div class="lv-xp">${S.xp} XP${L.next?` · 再 ${L.next.xp-S.xp} XP 升級`:' · 滿級！'}</div></div>`;
  const setText=(id,t)=>{ const el=$(id); if(el) el.textContent=t; };
  setText('home-progress', `${S.badges.length} / ${BADGES.length} 徽章 · ${S.xp} XP`);
  setText('tile-learn', `已讀 ${S.read.length} / ${CARDS.length} 張`);
  setText('learn-progress', `已讀 ${S.read.length} / ${CARDS.length}`);
  setText('badge-count', `${S.badges.length} / ${BADGES.length}`);
}

/* ---------- 導覽 ---------- */
const PAGES=['home','learn','games','quiz','tf','price','estimate','comp','match','city','mission','badges','cert','teacher','about','records','calc'];
let timers=[];
function clearTimers(){ timers.forEach(t=>clearInterval(t)); timers=[]; }
function go(page){
  if(!PAGES.includes(page)) page='home';
  clearTimers();
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('show'));
  $('page-'+page).classList.add('show');
  const navKey = {quiz:'games',tf:'games',price:'games',estimate:'games',comp:'games',match:'games',city:'games',mission:'games'}[page]||page;
  document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('active', b.dataset.page===navKey));
  if(location.hash!=='#'+page) location.hash=page;
  window.scrollTo({top:0, behavior:'smooth'});
  const init={home:renderHome, learn:renderCards, games:renderGames, badges:renderBadges, cert:renderCert, records:renderRecords, calc:()=>calcMenu(),
    quiz:()=>quizMenu(), tf:()=>tfMenu(), price:()=>priceNew(), estimate:()=>estNew(), comp:()=>compNew(), match:()=>matchStart(), city:()=>cityMenu(), mission:()=>missionMenu()};
  if(init[page]) init[page]();
}
window.addEventListener('hashchange', ()=>{ const p=(location.hash||'#home').slice(1); if(!$('page-'+p).classList.contains('show')) go(p); });

/* ---------- 首頁 ---------- */
function renderHome(){
  const L=levelOf(S.xp);
  const c=rnd(CARDS); const ci=CARDS.indexOf(c);
  $('home-daily').innerHTML=`<div class="daily"><div class="daily-ico">${c.ico}</div><div><div class="daily-k">🦉 估咕今天推薦的知識卡</div><h3>${esc(c.t)}</h3><p>${esc(c.a)}</p><div class="tipline"><b>🦉 估咕小知識：</b>${esc(c.tip)}</div></div></div>`;
  if(!S.read.includes(ci)){ S.read.push(ci); save(); checkBadges(); }
  $('home-title').innerHTML = S.name ? `嗨，${esc(S.name)}！我是${MASCOT}。<br>你現在是「${L.lv.ico} ${L.lv.name}」` : `嗨！我是${MASCOT}，<br>房子的「價格偵探」🔍`;
  const os=$('home-owl-say'); if(os){ const k=seasonStk(); os.src='assets/'+STK[k][1]; os.alt=MASCOT+'：'+STK[k][0]; }
  renderGameTiles('home-tiles', 6);
}
function gameList(){
  return [
    {p:'mission', ico:'🕵️', name:'估價師出任務', desc:'9 個真實情境：銀行、法院、都更、徵收、店面、道德考驗、品管審查、審查委員、調解人。', prog:`完成 ${Object.keys(S.missions||{}).length} / ${MISSIONS.length} 任務`, col:'var(--r)'},
    {p:'quiz', ico:'🧠', name:'快問快答', desc:'練習模式自選主題；挑戰模式 15 題計時連擊！', prog:`練習最佳 ${S.quizBest}/10 · 挑戰最佳 ${S.chalBest}/15`, col:'var(--g)'},
    {p:'price', ico:'💰', name:'哪間比較貴？', desc:'兩間房子比一比，猜每坪誰貴，學影響房價的因素。', prog:`最佳連勝 ${S.priceStreakBest}`, col:'var(--o)'},
    {p:'estimate', ico:'🎯', name:'價格猜猜樂', desc:'看三個案例和調整條件，拉動滑桿估出標的單價。', prog:`3 星次數 ${S.est3}`, col:'var(--b)'},
    {p:'city', ico:'🏙️', name:'城市規劃師', desc:'在格子地圖放公園、捷運、工廠，讓住宅地價最大化。', prog:`通關 ${Object.keys(S.city||{}).length} / ${CITY_LEVELS.length}`, col:'var(--t)'},
    {p:'tf', ico:'⏱️', name:'真假快答', desc:'60 秒內判斷敘述是真是假，越多越好！', prog:`最佳 ${S.tfBest} 題`, col:'var(--p)'},
    {p:'comp', ico:'🏘️', name:'找鄰居（比較法）', desc:'從三個成交案例選出最像的比較標的。', prog:`累計答對 ${S.compCorrect}`, col:'var(--b)'},
    {p:'match', ico:'🧩', name:'名詞連連看', desc:'翻牌配對專有名詞與意思。', prog:`完成 ${S.matchDone} 局`, col:'var(--p)'},
  ];
}
function renderGameTiles(id, limit){
  const list=gameList().slice(0, limit||99);
  $(id).innerHTML=list.map(g=>`<div class="tile" style="border-color:${g.col}" onclick="go('${g.p}')"><div class="ico">${g.ico}</div><h3>${g.name}</h3><p>${g.desc}</p><div class="meta">${g.prog}</div></div>`).join('');
}
function renderGames(){ renderGameTiles('games-tiles'); }

/* ---------- 知識庫 ---------- */
let currentWorld='w1', searchTerm='';
function renderWorlds(){
  $('worlds').innerHTML=WORLDS.map(w=>{
    const total=CARDS.filter(c=>c.w===w.id).length;
    const read=CARDS.filter((c,i)=>c.w===w.id && S.read.includes(i)).length;
    return `<button style="background:${w.color}" class="${w.id===currentWorld&&!searchTerm?'active':''}" onclick="setWorld('${w.id}')">${w.name} <span class="cnt">${read}/${total}</span></button>`;
  }).join('');
}
function setWorld(id){ currentWorld=id; searchTerm=''; $('card-search').value=''; renderCards(); }
function searchCards(v){ searchTerm=v.trim(); renderCards(); }
function renderCards(){
  renderWorlds();
  const w=WORLDS.find(x=>x.id===currentWorld);
  $('world-desc').textContent = searchTerm ? `搜尋「${searchTerm}」` : w.desc;
  const list=CARDS.map((c,i)=>({c,i})).filter(x=> searchTerm ? (x.c.t+x.c.a+x.c.tip+x.c.q).includes(searchTerm) : x.c.w===currentWorld);
  $('cards').innerHTML= list.length ? list.map(({c,i})=>{
    const col=WORLDS.find(x=>x.id===c.w).color;
    const tall=(c.a.length+c.tip.length+(c.fun||'').length)>160?' tall':'';
    return `<div class="kcard${tall}" id="kc${i}" onclick="flip(${i})">
      <div class="inner">
        <div class="face front" style="--c:${col}">
          <span class="read">${S.read.includes(i)?'✅':''}</span>
          <div class="ico">${c.ico}</div>
          <h3>${esc(c.t)}</h3>
          <div class="q">${esc(c.q)}</div>
          <div class="hint">👆 點我翻面看答案</div>
        </div>
        <div class="face back">
          <h4>${c.ico} ${esc(c.t)}</h4>
          <p>${esc(c.a)}</p>
          <div class="tip"><b>🦉 估咕小知識：</b>${esc(c.tip)}</div>
          ${c.fun?`<div class="fun"><b>💡 你知道嗎？</b>${esc(c.fun)}</div>`:''}
        </div>
      </div>
    </div>`;
  }).join('') : `<p class="empty">${stk('duck')}<br>找不到相關的卡片，換個關鍵字試試？</p>`;
}
function flip(i){
  const el=$('kc'+i); if(!el) return; el.classList.toggle('flipped'); sfx.click();
  if(!S.read.includes(i)){ S.read.push(i); save(); el.querySelector('.read').textContent='✅'; renderWorlds(); addXP(5,'閱讀知識卡'); const c=CARDS[i]; logEvent({game:'card', world:c.w, question:c.t}); }
}
function randomCard(){ const i=Math.floor(Math.random()*CARDS.length); currentWorld=CARDS[i].w; searchTerm=''; $('card-search').value=''; renderCards(); setTimeout(()=>{ const el=$('kc'+i); el.scrollIntoView({behavior:'smooth',block:'center'}); flip(i); },100); }

/* ---------- 快問快答 ---------- */
let quizState=null;
function quizMenu(){
  quizState=null;
  $('quiz-panel').innerHTML=`
    <h3>選擇模式</h3>
    <div class="modes">
      <div class="mode" onclick="quizStart('practice','all')"><div class="ico">${stk('zhuanye','stk-sm')}</div><h4>練習模式</h4><p>10 題、不計時，答完看解說。最佳 ${S.quizBest}/10</p></div>
      <div class="mode hot" onclick="quizStart('challenge')"><div class="ico">${stk('deadline','stk-sm')}</div><h4>挑戰模式</h4><p>15 題、每題 20 秒、連擊加分！最佳 ${S.chalBest}/15</p></div>
    </div>
    <h3 style="margin-top:18px">依主題練習</h3>
    <div class="worlds">${WORLDS.map(w=>`<button style="background:${w.color}" onclick="quizStart('practice','${w.id}')">${w.name}</button>`).join('')}</div>`;
}
function quizStart(mode, world){
  let pool = mode==='challenge' ? QUIZ : (world==='all' ? QUIZ : QUIZ.filter(q=>q.w===world));
  const n = mode==='challenge' ? 15 : Math.min(10, pool.length);
  quizState={mode, world, qs:shuffle(pool).slice(0,n), i:0, score:0, combo:0, maxCombo:0, answered:false, timeLeft:20};
  quizRender();
}
function quizRender(){
  const st=quizState, p=$('quiz-panel'); clearTimers();
  if(st.i>=st.qs.length) return quizEnd();
  const q=st.qs[st.i];
  p.innerHTML=`
    <div class="score"><span class="pill">第 ${st.i+1} / ${st.qs.length} 題</span><span class="pill">⭐ 答對 ${st.score}</span>${st.mode==='challenge'?`<span class="pill combo">🔥 連擊 ${st.combo}</span><span class="pill timer" id="quiz-timer">⏳ 20</span>`:''}<span class="pill lvl">${q.lv===2?'進階':'基礎'}</span></div>
    <div class="progress"><i style="width:${st.i/st.qs.length*100}%"></i></div>
    <div class="question">${esc(q.q)}</div>
    <div class="options">${q.o.map((o,k)=>`<button class="opt" onclick="quizAnswer(${k})"><span class="k">${'ABCD'[k]}</span><span>${esc(o)}</span></button>`).join('')}</div>
    <div class="explain" id="quiz-explain"></div>
    <p class="right"><button class="btn sm" id="quiz-next" style="display:none" onclick="quizNext()">下一題 ➡️</button></p>`;
  if(st.mode==='challenge'){
    st.timeLeft=20;
    const t=setInterval(()=>{ st.timeLeft--; const el=$('quiz-timer'); if(el){ el.textContent='⏳ '+st.timeLeft; if(st.timeLeft<=5){ el.classList.add('danger'); sfx.tick(); } } if(st.timeLeft<=0){ clearInterval(t); quizAnswer(-1); } },1000);
    timers.push(t);
  }
}
function quizAnswer(k){
  const st=quizState; if(!st||st.answered) return; st.answered=true; clearTimers();
  const q=st.qs[st.i]; const opts=document.querySelectorAll('#quiz-panel .opt');
  opts.forEach((b,i)=>{ b.disabled=true; if(i===q.a) b.classList.add('correct'); else if(i===k) b.classList.add('wrong'); });
  const ok=k===q.a;
  logEvent({game:'quiz', world:q.w, question:q.q, chosen:k>=0?q.o[k]:'（時間到，未作答）', correct:q.o[q.a], ok, extra:{mode:st.mode, lv:q.lv}});
  let xp=0;
  if(ok){ st.score++; st.combo++; st.maxCombo=Math.max(st.maxCombo,st.combo); sfx.ok(); xp = st.mode==='challenge' ? 15+Math.min(st.combo-1,5)*5 : 10; }
  else { st.combo=0; sfx.bad(); }
  const ex=$('quiz-explain');
  ex.innerHTML=`${ok?stkOK('stk-r'):stkNO('stk-r')}<b>${ok?'✅ 答對了！':(k<0?'⏰ 時間到！':'❌ 答錯了，')}${ok?'':'正確答案是 '+'ABCD'[q.a]+'。'}</b>${xp?`<span class="xpchip">+${xp} XP${st.combo>1?' 🔥 連擊 x'+st.combo:''}</span>`:''}<br>🦉 估咕說：${esc(q.e)}`;
  ex.classList.add('show');
  if(xp) addXP(xp, '');
  $('quiz-next').style.display='inline-block';
  if(st.mode==='challenge'){ const t=setTimeout(()=>{ if(quizState===st && st.answered) quizNext(); }, 3500); timers.push(t); }
}
function quizNext(){ if(!quizState) return; quizState.i++; quizState.answered=false; quizRender(); }
function quizEnd(){
  const st=quizState, s=st.score, n=st.qs.length;
  let title, ico;
  if(st.mode==='challenge'){ if(s>S.chalBest){ S.chalBest=s; save(); } if(s>=12) addXP(50,'挑戰完成獎勵'); }
  else { if(n===10 && s>S.quizBest){ S.quizBest=s; save(); } }
  checkBadges();
  logEvent({game:'quiz_done', question:st.mode==='challenge'?'挑戰模式':'練習模式'+(st.world&&st.world!=='all'?'（'+(WORLDS.find(w=>w.id===st.world)||{}).name+'）':''), extra:{score:s, n, maxCombo:st.maxCombo}});
  const r=s/n; ico = r>=.9?'🏆':r>=.7?'😊':'📚';
  title = r>=.9?'太厲害了！你根本是估價師本人！': r>=.8?'很棒！繼續保持！': r>=.6?'不錯喔！再去知識庫複習一下。':'沒關係，先去知識庫看看，再來挑戰！';
  $('quiz-panel').innerHTML=`<h3>結算</h3>${stk(r>=.8?'qingzhu':r>=.6?'xinkule':'jiayou','stk-big')}
    <p class="center big">答對 ${s} / ${n} 題${st.mode==='challenge'?` · 最高連擊 ${st.maxCombo}`:''}</p>
    <p class="center">${title}</p>
    <p class="center muted">${st.mode==='challenge'?`挑戰最佳：${S.chalBest} 題`:`練習最佳：${S.quizBest} 題`}</p>
    <p class="center"><button class="btn g" onclick="quizStart('${st.mode}','${st.world||'all'}')">🔁 再玩一局</button> <button class="btn ghost" onclick="quizMenu()">↩️ 選模式</button></p>`;
}

/* ---------- 真假快答 ---------- */
let tfState=null;
function tfMenu(){
  tfState=null; clearTimers();
  $('tf-panel').innerHTML=`${stk('deadline','stk-big')}<p class="center big">60 秒內，判斷每句話是「真」還是「假」！</p><p class="center muted">答對 +5 XP，連續答對有加成。最佳紀錄：${S.tfBest} 題</p><p class="center"><button class="btn p" onclick="tfStart()">▶️ 開始！</button></p>`;
}
function tfStart(){
  tfState={qs:shuffle(TF), i:0, correct:0, wrong:[], time:60, combo:0, lock:false};
  tfRender();
  const t=setInterval(()=>{ tfState.time--; const el=$('tf-time'); if(el){ el.textContent=tfState.time; if(tfState.time<=10) el.parentElement.classList.add('danger'); } if(tfState.time<=0){ clearTimers(); tfEnd(); } },1000);
  timers.push(t);
}
function tfRender(){
  const st=tfState; if(st.i>=st.qs.length){ st.qs=st.qs.concat(shuffle(TF)); }
  const q=st.qs[st.i];
  $('tf-panel').innerHTML=`
    <div class="score"><span class="pill timer">⏳ <b id="tf-time">${st.time}</b> 秒</span><span class="pill">✅ ${st.correct}</span><span class="pill combo">🔥 ${st.combo}</span></div>
    <div class="tf-card" id="tf-card"><div class="tf-s">${esc(q.s)}</div></div>
    <div class="tf-btns"><button class="btn g big" onclick="tfAnswer(true)">⭕ 真的</button><button class="btn r big" onclick="tfAnswer(false)">❌ 假的</button></div>
    <div class="tf-fb" id="tf-fb"></div>`;
}
function tfAnswer(v){
  const st=tfState; if(!st||st.lock) return; st.lock=true;
  const q=st.qs[st.i]; const ok=v===q.t; const card=$('tf-card');
  logEvent({game:'tf', question:q.s, chosen:v?'真':'假', correct:q.t?'真':'假', ok});
  card.classList.add(ok?'ok':'no');
  if(ok){ st.correct++; st.combo++; sfx.ok(); addXP(5+(st.combo>=5?5:0),''); } else { st.combo=0; st.wrong.push(q); sfx.bad(); }
  $('tf-fb').innerHTML=`<b>${ok?'✅ 答對':'❌ 答錯'}</b>：${esc(q.e)} ${ok?stk('jingzhun'):stk('bengkui')}`;
  setTimeout(()=>{ if(tfState!==st) return; st.i++; st.lock=false; if(st.time>0) tfRender(); }, ok?600:1300);
}
function tfEnd(){
  const st=tfState; if(!st) return; tfState=null;
  if(st.correct>S.tfBest){ S.tfBest=st.correct; save(); }
  logEvent({game:'tf_done', question:'60 秒真假快答', extra:{correct:st.correct, wrong:st.wrong.length}});
  checkBadges();
  $('tf-panel').innerHTML=`<h3>時間到！</h3>${stk(st.correct>=15?'qingzhu':st.correct>=10?'xinkule':'jiayou','stk-big')}
    <p class="center big">答對 ${st.correct} 題</p><p class="center muted">最佳紀錄：${S.tfBest} 題${st.correct>=15?' · 達成「真假快手」條件！':'（15 題可拿徽章）'}</p>
    ${st.wrong.length?`<div class="review"><h4>答錯的題目複習：</h4><ul>${st.wrong.map(q=>`<li>「${esc(q.s)}」是<b>${q.t?'真':'假'}</b>的：${esc(q.e)}</li>`).join('')}</ul></div>`:'<p class="center">全部答對，太強了！</p>'}
    <p class="center"><button class="btn p" onclick="tfStart()">🔁 再來一次</button></p>`;
}

/* ---------- 哪間比較貴 ---------- */
let priceState=null;
const ZONES=[{n:'市中心',base:60,ico:'🏙️'},{n:'近郊住宅區',base:40,ico:'🏘️'},{n:'偏遠郊區',base:25,ico:'🌄'}];
function genHouse(){
  const type=rnd(['電梯大樓','電梯大樓','無電梯公寓','透天']);
  const zone=rnd(ZONES);
  const age=rnd([2,5,10,15,20,30,40]);
  const floor=type==='透天'?null: type==='無電梯公寓'? rnd([1,2,3,4,5]) : rnd([2,5,8,12,18]);
  const mrt=rnd([true,false,false]);
  const park=rnd([true,false]);
  const school=rnd([true,false,false]);
  const bad=rnd([null,null,null,'垃圾焚化廠','高壓電塔','墳墓','加油站']);
  const h={type,zone,age,floor,mrt,park,school,bad};
  h.price=calcPrice(h); return h;
}
function calcPrice(h){
  let p=h.zone.base;
  p*=1-Math.min(h.age,40)*0.009;
  if(h.mrt) p*=1.12;
  if(h.park) p*=1.05;
  if(h.school) p*=1.04;
  if(h.bad) p*=0.85;
  if(h.type==='電梯大樓') p*=1+(h.floor-1)*0.01;
  if(h.type==='無電梯公寓') p*= h.floor>=4?0.9:1;
  if(h.type==='透天') p*=1.08;
  return p;
}
function houseHTML(h,name,onclick){
  return `<div class="house" onclick="${onclick}">
    <div class="tag">比較貴！</div>
    <div class="art">${h.type==='透天'?'🏠':h.type==='電梯大樓'?'🏢':'🏬'}</div>
    <h4>${name}</h4>
    <ul>
      <li><span>類型</span><b>${h.type}</b></li>
      <li><span>地點</span><b>${h.zone.ico} ${h.zone.n}</b></li>
      <li><span>屋齡</span><b>${h.age} 年</b></li>
      ${h.floor?`<li><span>樓層</span><b>${h.floor} 樓</b></li>`:''}
      <li><span>捷運</span><b>${h.mrt?'🚇 走路 3 分鐘':'🚶 走路 20 分鐘'}</b></li>
      <li><span>公園</span><b>${h.park?'🌳 旁邊有公園':'—'}</b></li>
      <li><span>學校</span><b>${h.school?'🏫 走路 5 分鐘':'—'}</b></li>
      <li><span>附近</span><b>${h.bad?'⚠️ '+h.bad:'😊 沒有特別的'}</b></li>
    </ul>
  </div>`;
}
function priceNew(){
  let a,b,tries=0; const minDiff = S.priceStreak>=5 ? 0.06 : 0.1;
  do{ a=genHouse(); b=genHouse(); tries++; }while((Math.abs(a.price-b.price)/Math.max(a.price,b.price)<minDiff || JSON.stringify(a)===JSON.stringify(b)) && tries<300);
  priceState={a,b,done:false};
  $('price-panel').innerHTML=`
    <div class="score"><span class="pill">🔥 連續答對 ${S.priceStreak}</span><span class="pill">🏅 最佳 ${S.priceStreakBest}</span>${S.priceStreak>=5?'<span class="pill hot">困難模式：差距變小了！</span>':''}</div>
    ${stk('xiankan','stk-r')}<div class="question">兩間房子，哪一間「每坪」的價錢比較高？</div>
    <div class="houses" id="houses">${houseHTML(a,'A 房子','priceAnswer(0)')}${houseHTML(b,'B 房子','priceAnswer(1)')}</div>
    <div class="explain" id="price-explain"></div>
    <p class="right"><button class="btn sm y" id="price-next" style="display:none" onclick="priceNew()">下一題 ➡️</button></p>`;
}
function reasons(x,y){
  const r=[];
  if(x.zone.base>y.zone.base) r.push(`📍 地點：${x.zone.n} 比 ${y.zone.n} 搶手（地點、地點、地點！）`);
  if(x.age<y.age) r.push(`👟 屋齡：${x.age} 年比 ${y.age} 年新，折舊比較少`);
  if(x.mrt&&!y.mrt) r.push('🚇 交通：走路 3 分鐘到捷運站加分');
  if(x.park&&!y.park) r.push('🌳 環境：旁邊有公園加分');
  if(x.school&&!y.school) r.push('🏫 學區：走路 5 分鐘到學校加分');
  if(!x.bad&&y.bad) r.push(`⚠️ 嫌惡設施：另一間旁邊有${y.bad}，會扣分`);
  if(x.type==='電梯大樓'&&y.type==='電梯大樓'&&x.floor>y.floor) r.push('🌇 樓層：有電梯的大樓，高樓層視野好、較貴');
  if(x.type==='無電梯公寓'&&y.type==='無電梯公寓'&&x.floor<y.floor&&y.floor>=4) r.push('🪜 樓層：沒電梯的公寓，4、5 樓要爬很累，反而便宜');
  if(x.type==='透天'&&y.type!=='透天') r.push('🏠 類型：透天連土地都是自己的，每坪通常較高');
  if(x.type!=='透天'&&y.type==='透天') r.push('🏠 類型：雖然另一間是透天，但其他條件差太多');
  return r;
}
function priceAnswer(k){
  const st=priceState; if(st.done) return; st.done=true;
  const win=st.a.price>st.b.price?0:1; const ok=k===win;
  const hs=document.querySelectorAll('#houses .house');
  hs[win].classList.add('win'); hs[1-win].classList.add('lose');
  const W=win===0?st.a:st.b, L=win===0?st.b:st.a;
  const diff=Math.round((W.price/L.price-1)*100);
  const hd=h=>`${h.zone.n}/${h.type}/${h.age}年${h.floor?'/'+h.floor+'樓':''}${h.mrt?'/近捷運':''}${h.park?'/公園':''}${h.school?'/學校':''}${h.bad?'/'+h.bad:''}`;
  logEvent({game:'price', question:`A：${hd(st.a)}｜B：${hd(st.b)}`, chosen:k===0?'A':'B', correct:win===0?'A':'B', ok, extra:{diff}});
  S.priceStreak= ok?S.priceStreak+1:0;
  S.priceStreakBest=Math.max(S.priceStreakBest,S.priceStreak); save();
  if(ok){ sfx.ok(); addXP(10+(S.priceStreak>=5?5:0),''); } else sfx.bad();
  checkBadges();
  const rs=reasons(W,L);
  const ex=$('price-explain');
  ex.innerHTML=`${ok?stkOK('stk-r'):stkNO('stk-r')}<b>${ok?'✅ 答對了！':'❌ 不對喔！'}</b> ${win===0?'A':'B'} 房子每坪大約貴了 ${diff}%。<br>
    🦉 <b>估咕這樣想：</b><ul>${rs.map(r=>`<li>${r}</li>`).join('')||'<li>兩間條件很接近，但加總起來還是有差！</li>'}</ul>
    <div class="fine">（教學用簡化數字：市中心 60 萬／坪、近郊 40、郊區 25 為基礎，再依屋齡、交通、環境、樓層調整。）</div>`;
  ex.classList.add('show');
  $('price-next').style.display='inline-block';
  document.querySelector('#price-panel .score').innerHTML=`<span class="pill">🔥 連續答對 ${S.priceStreak}</span><span class="pill">🏅 最佳 ${S.priceStreakBest}</span>`;
}

/* ---------- 價格猜猜樂 ---------- */
let estState=null;
const EST_GROUPS=[[0,1],[4,5],[6,7,8]];
function estNew(){
  const P=rint(25,80);
  const subj={zone:rnd(['快樂區','陽光區','幸福區']), type:rnd(['電梯大樓','無電梯公寓']), area:rnd([20,25,30,35]), age:rnd([8,12,15,20])};
  const comps=['A','B','C'].map(name=>{
    const n=rnd([1,1,2]); const picked=[]; const usedGroups=new Set();
    let guard=0;
    while(picked.length<n && guard++<50){
      const i=rint(0,EST_FEATS.length-1); if(picked.includes(i)) continue;
      const g=EST_GROUPS.findIndex(gr=>gr.includes(i)); if(g>=0){ if(usedGroups.has(g)) continue; usedGroups.add(g); }
      picked.push(i);
    }
    const adj=picked.reduce((s,i)=>s+EST_FEATS[i].adj,0);
    const price=Math.round(P*(1+adj)*10)/10;
    return {name, feats:picked, adj, price};
  });
  estState={P,subj,comps,done:false};
  $('est-panel').innerHTML=`
    <div class="score"><span class="pill">🎯 3 星次數 ${S.est3}</span><span class="pill">已玩 ${S.estPlayed} 次</span></div>
    ${stk('qiazhi','stk-r')}<div class="question">請用「比較法」估出標的每坪多少萬元。先看三個案例和它們與標的的差異，再拉動滑桿！</div>
    <div class="house subject est-subj"><div class="art">🎯</div><h4>勘估標的</h4><ul><li><span>地區</span><b>${subj.zone}</b></li><li><span>類型</span><b>${subj.type}</b></li><li><span>屋齡</span><b>${subj.age} 年</b></li><li><span>面積</span><b>${subj.area} 坪</b></li></ul></div>
    <div class="comps">${comps.map(c=>`<div class="comp"><div class="comp-h">案例 ${c.name}<span class="comp-p">${c.price} 萬／坪</span></div><div class="comp-f">和標的比：${c.feats.map(i=>`<span class="chip ${EST_FEATS[i].adj>0?'up':'down'}">${esc(EST_FEATS[i].label)}（${EST_FEATS[i].adj>0?'+':'−'}${Math.round(Math.abs(EST_FEATS[i].adj)*100)}%）</span>`).join('')}</div></div>`).join('')}</div>
    <div class="slider-box"><div class="slider-val">我的估價：<b id="est-val">50.0</b> 萬／坪 <span class="muted">（總價約 <span id="est-total">${(50*subj.area).toFixed(0)}</span> 萬）</span></div>
      <input type="range" id="est-slider" min="10" max="120" step="0.5" value="50" oninput="estSlide(this.value)">
      <div class="slider-ticks"><span>10</span><span>40</span><span>70</span><span>100</span><span>120</span></div></div>
    <p class="center"><button class="btn b" id="est-submit" onclick="estSubmit()">📋 送出估價</button></p>
    <div class="explain" id="est-explain"></div>
    <p class="right"><button class="btn sm y" id="est-next" style="display:none" onclick="estNew()">下一題 ➡️</button></p>`;
}
function estSlide(v){ $('est-val').textContent=Number(v).toFixed(1); $('est-total').textContent=(v*estState.subj.area).toFixed(0); }
function estSubmit(){
  const st=estState; if(st.done) return; st.done=true;
  const v=Number($('est-slider').value); const err=Math.abs(v-st.P)/st.P;
  const n = err<=0.05?3: err<=0.10?2: err<=0.20?1:0;
  logEvent({game:'estimate', question:`${st.subj.zone} ${st.subj.type} ${st.subj.age}年 ${st.subj.area}坪`, chosen:v.toFixed(1)+' 萬/坪', correct:st.P+' 萬/坪', ok:n>=2, extra:{errPct:Math.round(err*100), stars:n}});
  S.estPlayed++; if(n===3) S.est3++; save();
  if(n>=2) sfx.ok(); else sfx.bad();
  if(n) addXP(n*20,'估價'); checkBadges();
  $('est-submit').disabled=true; $('est-slider').disabled=true;
  const ex=$('est-explain');
  ex.innerHTML=`${stk(['bengkui','jiayou','jingda','jingzhun'][n],'stk-r')}<b>${['😅 差太多了！','👍 還不錯！','🎉 很接近！','🏆 神準！'][n]}</b> 你估 ${v.toFixed(1)} 萬，合理價格約 <b>${st.P} 萬／坪</b>（誤差 ${Math.round(err*100)}%）<span class="xpchip">${stars(n)}</span><br>
    🦉 <b>估咕這樣算：</b>每個案例的價格，要「反過來」把差異調整掉，才會變成標的的價格。<ul>
    ${st.comps.map(c=>`<li>案例 ${c.name}：${c.price} ÷ (1 ${c.adj>=0?'+':'−'} ${Math.abs(Math.round(c.adj*100))}%) ≈ <b>${(c.price/(1+c.adj)).toFixed(1)}</b> 萬</li>`).join('')}
    <li>三個調整後的價格都很接近，取其平均 ≈ <b>${(st.comps.reduce((s,c)=>s+c.price/(1+c.adj),0)/3).toFixed(1)}</b> 萬／坪，就是合理的估價。</li></ul>
    <div class="fine">小技巧：案例條件比標的「好」（+），它的價格就要往下調；比標的「差」（−），就要往上調。</div>`;
  ex.classList.add('show'); $('est-next').style.display='inline-block';
}

/* ---------- 找鄰居 ---------- */
let compState=null;
const DISTRICTS=['快樂區','陽光區','幸福區'];
function compNew(){
  const subj={d:rnd(DISTRICTS), type:rnd(['電梯大樓','無電梯公寓','透天']), age:rnd([5,10,20,30]), area:rnd([20,30,45])};
  const feats=['d','type','age','area','when'];
  function cand(matchN){
    const c={d:subj.d,type:subj.type,age:subj.age,area:subj.area,when:'上個月'};
    shuffle(feats).slice(0, feats.length-matchN).forEach(f=>{
      if(f==='d') c.d=rnd(DISTRICTS.filter(x=>x!==subj.d).concat(['隔壁縣市']));
      if(f==='type') c.type=rnd(['電梯大樓','無電梯公寓','透天'].filter(x=>x!==subj.type));
      if(f==='age') c.age=rnd([5,10,20,30,45].filter(x=>Math.abs(x-subj.age)>=15));
      if(f==='area') c.area=rnd([12,20,30,45,80].filter(x=>Math.abs(x-subj.area)>=20));
      if(f==='when') c.when=rnd(['12 年前','8 年前']);
    });
    c.score=feats.filter(f=>f==='when'? c.when==='上個月' : c[f]===subj[f]).length;
    return c;
  }
  const best=cand(5); best.age=Math.max(1,subj.age+rnd([-2,-1,1,2])); best.area=subj.area+rnd([-2,-1,1,2]); best.score=5;
  const cands=shuffle([best,cand(rnd([2,3])),cand(rnd([1,2]))]);
  compState={subj,cands,done:false,correct:cands.indexOf(best)};
  const cHTML=(c,i)=>`<div class="house" onclick="compAnswer(${i})"><div class="tag">最像！</div><div class="art">${c.type==='透天'?'🏠':c.type==='電梯大樓'?'🏢':'🏬'}</div><h4>案例 ${i+1}</h4>
    <ul><li><span>地區</span><b>${c.d}</b></li><li><span>類型</span><b>${c.type}</b></li><li><span>屋齡</span><b>${c.age} 年</b></li><li><span>面積</span><b>${c.area} 坪</b></li><li><span>成交</span><b>${c.when}</b></li></ul></div>`;
  $('comp-panel').innerHTML=`
    <div class="score"><span class="pill">🏅 累計答對 ${S.compCorrect}</span></div>
    ${stk('xiankan','stk-r')}<div class="question">估價師要估下面這間房子。用「比較法」，從三個成交案例中選出<u>最像</u>的那一個！</div>
    <div class="house subject est-subj"><div class="art">🎯</div><h4>要估價的房子（勘估標的）</h4><ul><li><span>地區</span><b>${subj.d}</b></li><li><span>類型</span><b>${subj.type}</b></li><li><span>屋齡</span><b>${subj.age} 年</b></li><li><span>面積</span><b>${subj.area} 坪</b></li></ul></div>
    <div class="cands" id="cands">${cands.map(cHTML).join('')}</div>
    <div class="explain" id="comp-explain"></div>
    <p class="right"><button class="btn sm" id="comp-next" style="display:none" onclick="compNew()">下一題 ➡️</button></p>`;
}
function compAnswer(i){
  const st=compState; if(st.done) return; st.done=true;
  const ok=i===st.correct; const hs=document.querySelectorAll('#cands .house');
  logEvent({game:'comp', question:`${st.subj.d} ${st.subj.type} ${st.subj.age}年 ${st.subj.area}坪`, chosen:'案例 '+(i+1), correct:'案例 '+(st.correct+1), ok});
  hs[st.correct].classList.add('win'); hs.forEach((h,k)=>{ if(k!==st.correct) h.classList.add('lose'); });
  if(ok){ S.compCorrect++; save(); sfx.ok(); addXP(15,''); } else sfx.bad();
  checkBadges();
  const wrongs=st.cands.map((c,k)=>({c,k})).filter(x=>x.k!==st.correct).map(({c,k})=>{
    const why=[]; if(c.d!==st.subj.d) why.push('地區不同'); if(c.type!==st.subj.type) why.push('類型不同'); if(Math.abs(c.age-st.subj.age)>=15) why.push('屋齡差太多'); if(Math.abs(c.area-st.subj.area)>=20) why.push('面積差太多'); if(c.when!=='上個月') why.push(`成交是 ${c.when}，太久了`);
    return `<li>案例 ${k+1}：${why.join('、')||'條件接近'}</li>`;
  });
  const ex=$('comp-explain');
  ex.innerHTML=`${ok?stkOK('stk-r'):stkNO('stk-r')}<b>${ok?'✅ 答對了！':'❌ 不對喔！最像的是案例 '+(st.correct+1)+'。'}</b><br>🦉 <b>估咕這樣想：</b>比較法要選「同地區、同類型、屋齡接近、面積接近、最近成交」的案例，差一點點沒關係，之後再做「調整」。<ul>${wrongs.join('')}</ul>`;
  ex.classList.add('show'); $('comp-next').style.display='inline-block';
  document.querySelector('#comp-panel .score').innerHTML=`<span class="pill">🏅 累計答對 ${S.compCorrect}</span>`;
}

/* ---------- 連連看 ---------- */
let matchState=null;
function matchStart(){
  const pairs=shuffle(PAIRS).slice(0,8);
  let tiles=[]; pairs.forEach((p,i)=>{ tiles.push({id:i,txt:p[0],term:true}); tiles.push({id:i,txt:p[1],term:false}); });
  matchState={tiles:shuffle(tiles), open:[], done:0, moves:0, lock:false};
  $('match-panel').innerHTML=`<div class="score"><span class="pill" id="match-moves">👆 翻牌次數 0</span><span class="pill" id="match-done">✅ 配對 0 / 8</span><span class="pill">🏅 最少次數 ${S.matchBestMoves||'—'}</span></div>
    <div class="question">翻開兩張卡片，把「名詞」和「它的意思」配成一對！</div>
    <div class="memgrid">${matchState.tiles.map((t,i)=>`<div class="mem ${t.term?'term':''}" id="mem${i}" onclick="matchFlip(${i})"><span>${esc(t.txt)}</span></div>`).join('')}</div>
    <div class="explain" id="match-explain"></div>`;
}
function matchFlip(i){
  const st=matchState; if(!st||st.lock) return;
  const el=$('mem'+i); if(el.classList.contains('open')||el.classList.contains('done')) return;
  el.classList.add('open'); st.open.push(i); sfx.click();
  if(st.open.length===2){
    st.moves++; $('match-moves').textContent=`👆 翻牌次數 ${st.moves}`;
    const [a,b]=st.open, ta=st.tiles[a], tb=st.tiles[b]; st.lock=true;
    if(ta.id===tb.id && ta.term!==tb.term){
      setTimeout(()=>{ $('mem'+a).classList.add('done'); $('mem'+b).classList.add('done'); st.open=[]; st.done++; st.lock=false; sfx.ok(); addXP(5,'');
        $('match-done').textContent=`✅ 配對 ${st.done} / 8`;
        if(st.done===8){ logEvent({game:'match', question:'名詞連連看', extra:{moves:st.moves}}); S.matchDone++; if(!S.matchBestMoves||st.moves<S.matchBestMoves) S.matchBestMoves=st.moves; save(); addXP(30,'完成連連看'); checkBadges();
          const ex=$('match-explain'); ex.innerHTML=`${stk('ganxie','stk-r')}<b>🎉 全部配對完成！</b> 總共翻了 ${st.moves} 次。${st.moves<=12?'記憶力超強！':'再玩一次挑戰更少次數吧！'} <button class="btn sm p" onclick="matchStart()">🔁 再玩一局</button>`; ex.classList.add('show'); }
      }, 400);
    } else {
      setTimeout(()=>{ $('mem'+a).classList.remove('open'); $('mem'+b).classList.remove('open'); st.open=[]; st.lock=false; }, 900);
    }
  }
}

/* ---------- 城市規劃師 ---------- */
let cityState=null;
function cityMenu(){
  cityState=null;
  $('city-panel').innerHTML=`${stk('lima','stk-big')}<p class="center big">你是城市規劃師！在地圖上放置設施，讓所有「住宅」的地價總和越高越好。</p>
    <div class="legend">${Object.entries(CITY_ITEMS).map(([k,v])=>`<div class="lg"><span class="lg-ico">${v.ico}</span><b>${v.name}</b><small>${v.desc}</small></div>`).join('')}</div>
    <div class="modes">${CITY_LEVELS.map((L,i)=>`<div class="mode" onclick="cityStart(${i})"><div class="ico">${['🏘️','🏙️','🌆'][i]}</div><h4>${L.name}</h4><p>${L.size}×${L.size} 格 · 必放：${Object.entries(L.req).map(([k,n])=>CITY_ITEMS[k].ico+'×'+n).join(' ')}</p><p class="stars">${stars(S.city[i]||0)}</p></div>`).join('')}</div>`;
}
function cityValues(grid, n){
  const vals=new Array(n*n).fill(null); let total=0;
  for(let i=0;i<n*n;i++){
    if(grid[i]!=='home') continue;
    const r=Math.floor(i/n), c=i%n; let v=100;
    for(let j=0;j<n*n;j++){
      const t=grid[j]; if(!t||t==='home'||j===i) continue;
      const eff=CITY_ITEMS[t].eff; const d=Math.max(Math.abs(Math.floor(j/n)-r), Math.abs(j%n-c));
      if(d>=1 && d<=eff.length) v+=eff[d-1];
    }
    v=Math.max(10,v); vals[i]=v; total+=v;
  }
  return {vals,total};
}
function cityBest(L){
  const n=L.size, items=[]; Object.entries(L.req).forEach(([k,c])=>{ for(let i=0;i<c;i++) items.push(k); });
  let best=0, bestGrid=null;
  for(let t=0;t<400;t++){
    const grid=new Array(n*n).fill('home'); const cells=shuffle([...Array(n*n).keys()]).slice(0,items.length);
    items.forEach((it,i)=>grid[cells[i]]=it);
    const tot=cityValues(grid,n).total; if(tot>best){ best=tot; bestGrid=grid; }
  }
  // 爬山法微調
  let cur=bestGrid.slice(), curV=best;
  for(let t=0;t<600;t++){
    const g=cur.slice(); const a=rint(0,n*n-1), b=rint(0,n*n-1); if(g[a]===g[b]) continue; [g[a],g[b]]=[g[b],g[a]];
    const v=cityValues(g,n).total; if(v>=curV){ cur=g; curV=v; }
  }
  return Math.max(best,curV);
}
function cityStart(li){
  const L=CITY_LEVELS[li]; const n=L.size;
  cityState={li, n, grid:new Array(n*n).fill('home'), tool:'park', best:cityBest(L), done:false};
  cityRender();
}
function cityRemaining(){
  const st=cityState, L=CITY_LEVELS[st.li]; const rem={};
  Object.entries(L.req).forEach(([k,c])=>{ rem[k]=c-st.grid.filter(x=>x===k).length; });
  return rem;
}
function cityRender(){
  const st=cityState, L=CITY_LEVELS[st.li], n=st.n; const {vals,total}=cityValues(st.grid,n); const rem=cityRemaining();
  const allPlaced=Object.values(rem).every(v=>v===0);
  const t3=Math.round(st.best*0.97), t2=Math.round(st.best*0.9), t1=Math.round(st.best*0.8);
  $('city-panel').innerHTML=`
    <div class="score"><span class="pill">${L.name}</span><span class="pill big-pill">💰 住宅地價總和：<b id="city-total">${total}</b></span><span class="pill">⭐ ${t1} · ⭐⭐ ${t2} · ⭐⭐⭐ ${t3}</span></div>
    <div class="city-wrap">
      <div class="palette">
        <div class="pal-title">選擇要放的東西，再點地圖：</div>
        ${['home',...Object.keys(L.req)].map(k=>`<button class="pal ${st.tool===k?'sel':''}" onclick="cityTool('${k}')"><span class="pal-ico">${CITY_ITEMS[k].ico}</span><span class="pal-name">${CITY_ITEMS[k].name}</span><span class="pal-cnt">${k==='home'?'∞':`剩 ${rem[k]}`}</span></button>`).join('')}
        <div class="pal-hint">💡 ${esc(L.hint)}</div>
        <button class="btn g" ${allPlaced&&!st.done?'':'disabled'} onclick="cityFinish()">✅ 完成規劃</button>
        <button class="btn ghost sm" onclick="cityMenu()">↩️ 選關卡</button>
      </div>
      <div class="citygrid" style="grid-template-columns:repeat(${n},1fr)">
        ${st.grid.map((g,i)=>{ const v=vals[i]; const cls=g==='home'?(v>=140?'hot':v>=110?'warm':v<80?'cold':''):'fac'; return `<button class="cell ${cls}" onclick="cityPlace(${i})"><span class="c-ico">${CITY_ITEMS[g].ico}</span><span class="c-val">${g==='home'?v:''}</span></button>`; }).join('')}
      </div>
    </div>
    <div class="explain" id="city-explain"></div>`;
}
function cityTool(k){ cityState.tool=k; cityRender(); }
function cityPlace(i){
  const st=cityState; if(st.done) return; const k=st.tool;
  if(k!=='home'){ const rem=cityRemaining(); if(rem[k]<=0 && st.grid[i]!==k){ toast(`${CITY_ITEMS[k].name}已經放完了，點它可以移回住宅`); return; } }
  st.grid[i] = (st.grid[i]===k && k!=='home') ? 'home' : k; sfx.click(); cityRender();
}
function cityFinish(){
  const st=cityState; if(st.done) return; st.done=true;
  const total=cityValues(st.grid,st.n).total; const r=total/st.best;
  const n= r>=0.97?3: r>=0.9?2: r>=0.8?1:0;
  logEvent({game:'city', question:CITY_LEVELS[st.li].name, chosen:'總地價 '+total, correct:'最佳約 '+st.best, ok:n>=2, extra:{stars:n}});
  const prev=S.city[st.li]||0; if(n>prev){ S.city[st.li]=n; save(); }
  if(n>=2) sfx.ok(); else sfx.bad(); if(n) { addXP(n*40,'城市規劃'); if(n===3) confetti(150); } checkBadges();
  cityRender();
  const ex=$('city-explain'); ex.innerHTML=`${stk(['jiayou','xinkule','qingzhu','jingzhun'][n],'stk-r')}<b>${['😅 還可以更好！','👍 不錯的城市！','🎉 很棒的規劃！','🏆 完美城市！'][n]}</b> 總地價 ${total}，電腦找到的最佳解約 ${st.best}。<span class="xpchip">${stars(n)}</span><br>
    🦉 <b>估咕的規劃心得：</b><ul><li>嫌惡設施（工廠、垃圾場）放角落，只影響到少數格子，最好讓它們互相靠近、一起「犧牲」同一區。</li><li>加分設施（捷運、公園、學校）放中間，周圍八個方向的住宅都能受惠。</li><li>這就是真實城市「土地使用分區」的道理：把相容的放一起，把衝突的分開。</li></ul>
    <p class="center"><button class="btn b" onclick="cityStart(${st.li})">🔁 再挑戰這關</button> <button class="btn ghost" onclick="cityMenu()">↩️ 選關卡</button></p>`;
  ex.classList.add('show'); ex.scrollIntoView({behavior:'smooth'});
}

/* ---------- 估價師出任務 ---------- */
let misState=null;
function missionMenu(){
  misState=null;
  $('mission-panel').innerHTML=`${stk('zhuanye','stk-big')}<p class="center big">你是剛拿到證書的估價師。每個任務有 5 個關鍵決定，全部答對拿 3 顆星！</p>
    <div class="missions">${MISSIONS.map((m,i)=>`<div class="mission-card" onclick="missionStart(${i})"><div class="m-ico">${m.ico}</div><div><h4>${esc(m.title)}</h4><p>${esc(m.intro)}</p><div class="stars">${stars(S.missions[m.id]||0)}${S.missions[m.id]!=null?'':' <span class="muted">尚未完成</span>'}</div></div></div>`).join('')}</div>`;
}
function missionStart(i){
  const m=MISSIONS[i]; misState={m, i:0, correct:0, answered:false};
  const MSTK={qc:'tongxiao',committee:'zhuanye',mediation:'ok',bank:'jingda',court:'tiekou',renewal:'xiankan',expro:'xiankan',shop:'qiazhi',ethics:'duck'};
  $('mission-panel').innerHTML=`<div class="m-intro">${stk(MSTK[m.id]||'zhuanye','stk-big')}<h3>${esc(m.title)}</h3><p>${esc(m.intro)}</p><p class="center"><button class="btn r" onclick="missionStep()">🕵️ 接下任務</button> <button class="btn ghost" onclick="missionMenu()">↩️ 返回</button></p></div>`;
}
function missionStep(){
  const st=misState, m=st.m;
  if(st.i>=m.steps.length) return missionEnd();
  const s=m.steps[st.i]; st.answered=false;
  $('mission-panel').innerHTML=`
    <div class="score"><span class="pill">${m.ico} ${esc(m.title)}</span><span class="pill">決定 ${st.i+1} / ${m.steps.length}</span><span class="pill">✅ ${st.correct}</span></div>
    <div class="progress"><i style="width:${st.i/m.steps.length*100}%"></i></div>
    <div class="question">${esc(s.q)}</div>
    <div class="options">${s.o.map((o,k)=>`<button class="opt" onclick="missionAnswer(${k})"><span class="k">${'ABC'[k]}</span><span>${esc(o)}</span></button>`).join('')}</div>
    <div class="explain" id="m-explain"></div>
    <p class="right"><button class="btn sm r" id="m-next" style="display:none" onclick="missionNextStep()">${st.i+1<m.steps.length?'下一個決定 ➡️':'看結果 🏁'}</button></p>`;
}
function missionAnswer(k){
  const st=misState; if(st.answered) return; st.answered=true;
  const s=st.m.steps[st.i]; const ok=k===s.a;
  logEvent({game:'mission', question:`${st.m.title}｜${s.q}`, chosen:s.o[k], correct:s.o[s.a], ok, extra:{id:st.m.id, step:st.i+1}});
  document.querySelectorAll('#mission-panel .opt').forEach((b,i)=>{ b.disabled=true; if(i===s.a) b.classList.add('correct'); else if(i===k) b.classList.add('wrong'); });
  if(ok){ st.correct++; sfx.ok(); addXP(10,''); } else sfx.bad();
  const ex=$('m-explain'); ex.innerHTML=`${ok?stk(rnd(['ok','jingzhun']),'stk-r'):stk(rnd(['duck','bengkui']),'stk-r')}<b>${ok?'✅ 正確的決定！':'❌ 這樣做會有問題。'}</b><br>🦉 ${esc(s.e)}`; ex.classList.add('show');
  $('m-next').style.display='inline-block';
}
function missionNextStep(){ misState.i++; missionStep(); }
function missionEnd(){
  const st=misState, m=st.m, c=st.correct, n=m.steps.length;
  const sc = c===n?3: c>=n-1?2: c>=n-2?1:0;
  logEvent({game:'mission_done', question:m.title, extra:{id:m.id, stars:sc, correct:c}});
  const prev=S.missions[m.id]; if(prev==null||sc>prev) S.missions[m.id]=sc; save();
  addXP(30,'完成任務'); if(sc===3) confetti(150); checkBadges();
  const nextIdx=MISSIONS.indexOf(m)+1;
  $('mission-panel').innerHTML=`<h3>任務完成！</h3>${stk(sc===3?'qingzhu':sc>=1?'xinkule':'jiayou','stk-big')}<p class="center big">${c} / ${n} 個正確決定 ${stars(sc)}</p>
    <p class="center">${sc===3?'完美！你做出了一位專業估價師會做的每個決定。':sc>=2?'很好！只差一點點就完美了。':'再試一次，想想估價師最重視的「證據」和「公正」。'}</p>
    <p class="center"><button class="btn r" onclick="missionStart(${MISSIONS.indexOf(m)})">🔁 重玩</button> ${nextIdx<MISSIONS.length?`<button class="btn b" onclick="missionStart(${nextIdx})">下一個任務 ➡️</button>`:''} <button class="btn ghost" onclick="missionMenu()">↩️ 任務列表</button></p>`;
}

/* ---------- 徽章 ---------- */
function renderBadges(){
  $('badges').innerHTML=BADGES.map(b=>`<div class="badge ${S.badges.includes(b.id)?'got':''}"><span class="lock">🔒</span><div class="ico">${b.ico}</div><h4>${b.name}</h4><p>${b.desc}</p></div>`).join('');
  const L=levelOf(S.xp);
  $('level-list').innerHTML=LEVELS.map((l,i)=>`<div class="lvrow ${i<=L.idx?'got':''}"><span>${l.ico}</span><b>${l.name}</b><small>${l.xp} XP</small></div>`).join('');
  refreshMeta();
}
let resetArmed=false;
function resetAll(btn){
  if(!resetArmed){ resetArmed=true; btn.textContent='⚠️ 再按一次就會清除所有進度'; btn.classList.add('r'); btn.classList.remove('ghost'); setTimeout(()=>{ resetArmed=false; btn.textContent='🔄 重新開始（清除所有進度）'; btn.classList.remove('r'); btn.classList.add('ghost'); }, 4000); return; }
  resetArmed=false; try{ localStorage.removeItem(KEY); }catch(e){}
  S=load(); save(); quizState=priceState=compState=matchState=estState=cityState=misState=null; clearTimers(); renderBadges(); renderCards(); toast(typeof cloudUser!=='undefined'&&cloudUser?'已重新開始（雲端進度也一起清除）':'已重新開始！');
  btn.textContent='🔄 重新開始（清除所有進度）'; btn.classList.remove('r'); btn.classList.add('ghost');
}

/* ---------- 證書 ---------- */
function renderCert(){
  const L=levelOf(S.xp); const d=new Date();
  $('cert-name').value=S.name||'';
  $('cert').innerHTML=`
    <div class="cert-border"><div class="cert-inner">
      <img class="cert-owl" src="assets/owl-glasses.png" alt="估咕貓頭鷹">
      <div class="cert-top">小小估價師大冒險</div>
      <h2>${S.badges.includes('master')?'小小估價師 結業證書':'學習成就證明'}</h2>
      <p class="cert-to">茲證明</p>
      <div class="cert-who">${esc(S.name||'＿＿＿＿＿')}</div>
      <p>完成不動產知識庫學習，目前稱號為</p>
      <div class="cert-title">${L.lv.ico} ${L.lv.name}</div>
      <div class="cert-stats"><div><b>${S.xp}</b><small>XP</small></div><div><b>${S.read.length}/${CARDS.length}</b><small>知識卡</small></div><div><b>${S.badges.length}/${BADGES.length}</b><small>徽章</small></div><div><b>${Object.keys(S.missions).length}/${MISSIONS.length}</b><small>任務</small></div></div>
      <div class="cert-badges">${BADGES.filter(b=>S.badges.includes(b.id)).map(b=>`<span title="${b.name}">${b.ico}</span>`).join('')||'<span class="muted">還沒有徽章，快去遊樂場！</span>'}</div>
      <div class="cert-date">${d.getFullYear()} 年 ${d.getMonth()+1} 月 ${d.getDate()} 日</div>
      <div class="cert-stamp">🦉 估咕貓頭鷹 認證</div>
      <div class="cert-sign">估價師簽證 ✍️ ＿＿＿＿＿＿</div>
    </div></div>`;
}
function saveName(v){ S.name=v.trim().slice(0,12); save(); renderCert(); }

/* ---------- 我的紀錄 ---------- */
let recFilter='all', recCache=null;
function fmtTime(t){ const d=new Date(t); const p=n=>String(n).padStart(2,'0'); return `${d.getMonth()+1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`; }
function evTime(e){ return e.t || (e.ts ? new Date(e.ts).getTime() : 0); }
async function getAllEvents(){
  const local=LOG.slice();
  let cloud=[];
  if(typeof cloudEvents==='function' && typeof cloudUser!=='undefined' && cloudUser){ const r=await cloudEvents(2000); if(r) cloud=r; }
  const all=cloud.concat(local.filter(e=>e.p)).map(e=>Object.assign({}, e, {time:evTime(e)}));
  all.sort((x,y)=>y.time-x.time); return {all, fromCloud:cloud.length>0, loggedIn:!!(typeof cloudUser!=='undefined'&&cloudUser)};
}
function setRecFilter(v){ recFilter=v; renderRecords(true); }
async function renderRecords(useCache){
  const box=$('records-panel');
  if(!useCache || !recCache){ box.innerHTML='<p class="center muted">⏳ 正在整理紀錄…</p>'; recCache=await getAllEvents(); }
  const {all, loggedIn}=recCache;
  const nick = loggedIn ? cloudUser.nickname : (S.name||'這台裝置');
  const scored=all.filter(e=>SCORED.includes(e.game));
  const games=[...new Set(all.map(e=>e.game))];
  const stat=g=>{ const l=scored.filter(e=>e.game===g); const c=l.filter(e=>e.ok===true).length; return {n:l.length,c, pct:l.length?Math.round(c/l.length*100):0}; };
  const byWorld=WORLDS.map(w=>{ const l=scored.filter(e=>e.world===w.id); const c=l.filter(e=>e.ok===true).length; return {w, n:l.length, c, pct:l.length?Math.round(c/l.length*100):0}; }).filter(x=>x.n);
  const wrongs=all.filter(e=>e.ok===false && ['quiz','tf','mission','comp','price'].includes(e.game) && (recFilter==='all'||e.game===recFilter));
  const timeline=all.filter(e=>recFilter==='all'||e.game===recFilter).slice(0,80);
  const days=[...new Set(all.map(e=>new Date(e.time).toDateString()))].length;
  if(!all.length){
    box.innerHTML=`${stk('xiankan','stk-big')}<p class="center big">還沒有答題紀錄</p><p class="center muted">${loggedIn?'從現在開始，每答一題都會記錄下來（之前玩過的不會回溯）。':'登入後紀錄會同步到雲端；現在沒登入，只會存在這台裝置。'}</p>`;
    return;
  }
  box.innerHTML=`
    <div class="rec-head"><div><h3 style="margin:0">${esc(nick)} 的答題紀錄</h3><div class="muted" style="font-size:14px">共 ${all.length} 筆 · ${days} 天 · ${loggedIn?'☁️ 雲端同步':'📱 僅本機'}${LOG.filter(e=>e.p).length&&loggedIn?` · ${LOG.filter(e=>e.p).length} 筆待上傳`:''}</div></div>
      <div><button class="btn sm ghost" onclick="renderRecords()">🔄 重新整理</button> <button class="btn sm b" onclick="exportCSV()">⬇️ 匯出 CSV</button></div></div>
    <h4 class="rec-h">各遊戲正確率</h4>
    <div class="rec-grid">${SCORED.filter(g=>stat(g).n).map(g=>{ const s=stat(g); return `<div class="rec-card"><div class="rec-g">${GAME_NAMES[g]}</div><div class="rec-pct ${s.pct>=80?'good':s.pct>=60?'mid':'low'}">${s.pct}%</div><div class="muted">${s.c} / ${s.n} 題</div></div>`; }).join('')}</div>
    ${byWorld.length?`<h4 class="rec-h">各世界正確率（快問快答、真假快答等有標註世界的題目）</h4>
    <div class="rec-bars">${byWorld.map(x=>`<div class="rec-bar"><span class="rec-bar-l">${x.w.name}</span><div class="rec-bar-t"><i style="width:${x.pct}%;background:${x.w.color}"></i></div><span class="rec-bar-v">${x.pct}%（${x.c}/${x.n}）</span></div>`).join('')}</div>`:''}
    <div class="rec-filter">篩選：<select onchange="setRecFilter(this.value)"><option value="all" ${recFilter==='all'?'selected':''}>全部</option>${games.map(g=>`<option value="${g}" ${recFilter===g?'selected':''}>${GAME_NAMES[g]||g}</option>`).join('')}</select></div>
    <h4 class="rec-h">❌ 答錯的題目（${wrongs.length}）</h4>
    ${wrongs.length?`<div class="rec-wrong">${wrongs.slice(0,120).map(e=>`<div class="rec-row"><div class="rec-meta">${fmtTime(e.time)} · ${GAME_NAMES[e.game]||e.game}${e.world?' · '+((WORLDS.find(w=>w.id===e.world)||{}).name||''):''}</div><div class="rec-q">${esc(e.question||'')}</div><div class="rec-a"><span class="bad">他選：${esc(e.chosen||'—')}</span><span class="good">正解：${esc(e.correct||'—')}</span></div></div>`).join('')}</div>`:'<p class="muted">這個範圍內沒有答錯的題目 🎉</p>'}
    <h4 class="rec-h">🕒 最近紀錄</h4>
    <div class="rec-timeline">${timeline.map(e=>`<div class="rec-tl ${e.ok===true?'ok':e.ok===false?'no':''}"><span class="rec-tl-t">${fmtTime(e.time)}</span><span class="rec-tl-g">${GAME_NAMES[e.game]||e.game}</span><span class="rec-tl-q">${esc((e.question||'').slice(0,60))}${e.chosen?` → ${esc(e.chosen)}`:''}${e.ok===true?' ✅':e.ok===false?' ❌':''}${e.extra&&e.extra.stars!=null?' '+stars(e.extra.stars):''}${e.extra&&e.extra.score!=null?` ${e.extra.score}/${e.extra.n}`:''}</span></div>`).join('')}</div>
    <p class="fine">家長或老師：用孩子的暱稱與密碼登入，就能在任何裝置看到這一頁。紀錄從開通這個功能之後開始累積，之前玩過的內容不會回溯。</p>`;
}
function exportCSV(){
  if(!recCache) return;
  const rows=[['時間','遊戲','世界','題目','作答','正解','結果','其他']];
  recCache.all.forEach(e=>rows.push([new Date(e.time).toLocaleString('zh-TW'), GAME_NAMES[e.game]||e.game, e.world?((WORLDS.find(w=>w.id===e.world)||{}).name||e.world):'', e.question||'', e.chosen||'', e.correct||'', e.ok===true?'對':e.ok===false?'錯':'', e.extra?JSON.stringify(e.extra):'']));
  const csv='﻿'+rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`答題紀錄_${(recCache.loggedIn?cloudUser.nickname:'本機')}_${new Date().toISOString().slice(0,10)}.csv`; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },500);
}

/* ---------- 啟動 ---------- */
document.querySelectorAll('#nav button').forEach(b=>b.addEventListener('click',()=>go(b.dataset.page)));
$('sound-btn').textContent=S.sound?'🔊':'🔇';
refreshMeta();
const start=(location.hash||'#home').slice(1);
go(PAGES.includes(start)?start:'home');
