/* ============================================================
   小小估價師大冒險 — 階層系統（初階／中階／進階）
   這個檔案在 app.js 之後載入，覆寫部分遊戲函式以提供難度分級。
   ============================================================ */

/* ---------- 狀態 ---------- */
S.tier = S.tier || 'basic';
S.unlocked = Object.assign({mid:false, adv:false}, S.unlocked||{});
S.t = Object.assign({mid:{}, adv:{}}, S.t||{});
function tierOf(){ return S.unlocked[S.tier] || S.tier==='basic' ? S.tier : 'basic'; }
function tierInfo(id){ return TIERS.find(t=>t.id===(id||tierOf())); }
function tstat(){ const t=tierOf(); if(t==='basic') return S; S.t[t]=S.t[t]||{}; return S.t[t]; }
function xpMult(){ const t=tierOf(); if(t==='mid') return 2; if(t==='adv') return 3; return S.unlocked.mid ? 0.5 : 1; }
const _addXP = addXP;
addXP = function(n, why){ if(!n) return; _addXP(Math.max(1, Math.round(n*xpMult())), why); };

/* 初階「小小估價師」徽章只看初階徽章 */
BADGES.find(b=>b.id==='master').test = S=>BADGES.filter(b=>!b.tier && b.id!=='master').every(b=>S.badges.includes(b.id));

function refreshUnlocks(){
  let ch=false;
  if(S.badges.includes('master') && !S.unlocked.mid){ S.unlocked.mid=true; ch=true; celebrate('qingzhu','🔓 中階解鎖！題目開始要動腦計算囉'); }
  if(S.badges.includes('mid_master') && !S.unlocked.adv){ S.unlocked.adv=true; ch=true; celebrate('shengri','🔓 進階解鎖！像真正的估價師一樣思考'); }
  if(ch){ save(); checkBadges(); }
}
const _checkBadges = checkBadges;
checkBadges = function(){ _checkBadges(); refreshUnlocks(); };

function setTier(id){
  if(id!=='basic' && !S.unlocked[id]){ toast(`🔒 ${tierInfo(id).name}還沒解鎖：${tierInfo(id).unlock}`); return; }
  S.tier=id; save(); quizState=priceState=compState=matchState=estState=cityState=misState=null; clearTimers();
  toast(`${tierInfo(id).ico} 切換到${tierInfo(id).name}`); renderGames(); refreshMeta();
}
const _refreshMeta = refreshMeta;
refreshMeta = function(){ _refreshMeta(); const el=document.querySelector('#hdr-level .lv-name'); const ti=tierInfo(); if(el&&ti) el.innerHTML += ` <span class="tier-chip tier-${tierOf()}">${ti.ico}${ti.name}</span>`; };

/* 紀錄加上階層 */
const _logEvent = logEvent;
logEvent = function(ev){ ev.extra = Object.assign({tier:tierOf()}, ev.extra||{}); _logEvent(ev); };

/* ---------- 遊樂場：階層切換 ---------- */
function tierTabsHTML(){
  return `<div class="tier-tabs">${TIERS.map(t=>{ const un=t.id==='basic'||S.unlocked[t.id]; return `<button class="tier-tab tier-${t.id} ${tierOf()===t.id?'on':''} ${un?'':'locked'}" onclick="setTier('${t.id}')">${t.ico} ${t.name}${un?'':' 🔒'}</button>`; }).join('')}</div>
  <div class="tier-desc"><b>${tierInfo().ico} ${tierInfo().name}</b>：${tierInfo().desc} <span class="muted">XP 倍率 ×${xpMult()}${tierOf()==='basic'&&S.unlocked.mid?'（已解鎖中階，初階 XP 減半）':''}</span>
  ${!S.unlocked.mid?`<br><span class="muted">🔒 中階解鎖條件：${TIERS[1].unlock}</span>`:!S.unlocked.adv?`<br><span class="muted">🔒 進階解鎖條件：${TIERS[2].unlock}</span>`:''}</div>`;
}
renderGames = function(){
  const list=gameList();
  if(tierOf()!=='basic'){ const t=tstat(); list.splice(1,0,{p:'calc', ico:'🧮', name:'估價計算所', desc:tierOf()==='mid'?'一步計算：容積、折舊、收益、成數、公設、調整率。':'兩步計算：含殘值折舊、淨收益、權變分配、剩餘法、連乘調整。', prog:`10 題全對 ${t.calcPerfect||0} 次`, col:'var(--teal)'}); }
  $('games-tiles').innerHTML = list.map(g=>`<div class="tile" style="border-color:${g.col}" onclick="go('${g.p}')"><div class="ico">${g.ico}</div><h3>${g.name}</h3><p>${g.desc}</p><div class="meta">${g.prog}</div></div>`).join('');
  const bar=$('tier-bar'); if(bar) bar.innerHTML=tierTabsHTML();
};

/* ---------- 快問快答 ---------- */
function quizPool(){ const t=tierOf(); return QUIZ.filter(q=> t==='basic' ? q.lv<=2 : t==='mid' ? (q.lv===2||q.lv===3) : q.lv>=3); }
function quizTimer(){ return {basic:20, mid:15, adv:10}[tierOf()]; }
quizMenu = function(){
  quizState=null; const t=tstat(); const ti=tierInfo();
  $('quiz-panel').innerHTML=`
    <h3>選擇模式 <span class="tier-chip tier-${tierOf()}">${ti.ico}${ti.name}</span></h3>
    <div class="modes">
      <div class="mode" onclick="quizStart('practice','all')"><div class="ico">${stk('zhuanye','stk-sm')}</div><h4>練習模式</h4><p>10 題、不計時，答完看解說。${tierOf()==='basic'?`最佳 ${S.quizBest}/10`:`${ti.name}題庫 ${quizPool().length} 題`}</p></div>
      <div class="mode hot" onclick="quizStart('challenge')"><div class="ico">${stk('deadline','stk-sm')}</div><h4>挑戰模式</h4><p>15 題、每題 ${quizTimer()} 秒、連擊加分！最佳 ${(tierOf()==='basic'?S.chalBest:(t.chalBest||0))}/15</p></div>
    </div>
    ${tierOf()==='basic'?`<h3 style="margin-top:18px">依主題練習</h3><div class="worlds">${WORLDS.map(w=>`<button style="background:${w.color}" onclick="quizStart('practice','${w.id}')">${w.name}</button>`).join('')}</div>`:`<p class="fine">${ti.name}題目多半要動筆計算，可以準備紙筆或計算機。</p>`}`;
};
quizStart = function(mode, world){
  let pool=quizPool(); if(mode!=='challenge' && world && world!=='all'){ const p2=pool.filter(q=>q.w===world); if(p2.length>=4) pool=p2; }
  const n = mode==='challenge' ? 15 : Math.min(10, pool.length);
  quizState={mode, world, qs:shuffle(pool).slice(0,n), i:0, score:0, combo:0, maxCombo:0, answered:false, timeLeft:quizTimer(), tier:tierOf()};
  quizRender();
};
quizRender = function(){
  const st=quizState, p=$('quiz-panel'); clearTimers();
  if(st.i>=st.qs.length) return quizEnd();
  const q=st.qs[st.i]; const T=quizTimer();
  p.innerHTML=`
    <div class="score"><span class="pill">第 ${st.i+1} / ${st.qs.length} 題</span><span class="pill">⭐ 答對 ${st.score}</span>${st.mode==='challenge'?`<span class="pill combo">🔥 連擊 ${st.combo}</span><span class="pill timer" id="quiz-timer">⏳ ${T}</span>`:''}<span class="pill lvl">${['','基礎','基礎','中階','進階'][q.lv]||''}</span></div>
    <div class="progress"><i style="width:${st.i/st.qs.length*100}%"></i></div>
    <div class="question">${esc(q.q)}</div>
    <div class="options">${q.o.map((o,k)=>`<button class="opt" onclick="quizAnswer(${k})"><span class="k">${'ABCD'[k]}</span><span>${esc(o)}</span></button>`).join('')}</div>
    <div class="explain" id="quiz-explain"></div>
    <p class="right"><button class="btn sm" id="quiz-next" style="display:none" onclick="quizNext()">下一題 ➡️</button></p>`;
  if(st.mode==='challenge'){
    st.timeLeft=T;
    const t=setInterval(()=>{ st.timeLeft--; const el=$('quiz-timer'); if(el){ el.textContent='⏳ '+st.timeLeft; if(st.timeLeft<=5){ el.classList.add('danger'); sfx.tick(); } } if(st.timeLeft<=0){ clearInterval(t); quizAnswer(-1); } },1000);
    timers.push(t);
  }
};
quizEnd = function(){
  const st=quizState, s=st.score, n=st.qs.length; const tier=st.tier||tierOf();
  if(st.mode==='challenge'){ if(tier==='basic'){ if(s>S.chalBest) S.chalBest=s; } else { const t=S.t[tier]=S.t[tier]||{}; if(s>(t.chalBest||0)) t.chalBest=s; } save(); if(s>=12) addXP(50,'挑戰完成獎勵'); }
  else if(tier==='basic' && n===10 && s>S.quizBest){ S.quizBest=s; save(); }
  logEvent({game:'quiz_done', question:(st.mode==='challenge'?'挑戰模式':'練習模式')+'（'+tierInfo(tier).name+'）', extra:{score:s, n, maxCombo:st.maxCombo}});
  checkBadges();
  const r=s/n;
  const title = r>=.9?'太厲害了！你根本是估價師本人！': r>=.8?'很棒！繼續保持！': r>=.6?'不錯喔！再去知識庫複習一下。':'沒關係，先去知識庫看看，再來挑戰！';
  $('quiz-panel').innerHTML=`<h3>結算</h3>${stk(r>=.8?'qingzhu':r>=.6?'xinkule':'jiayou','stk-big')}
    <p class="center big">答對 ${s} / ${n} 題${st.mode==='challenge'?` · 最高連擊 ${st.maxCombo}`:''} <span class="tier-chip tier-${tier}">${tierInfo(tier).ico}${tierInfo(tier).name}</span></p>
    <p class="center">${title}</p>
    <p class="center"><button class="btn g" onclick="quizStart('${st.mode}','${st.world||'all'}')">🔁 再玩一局</button> <button class="btn ghost" onclick="quizMenu()">↩️ 選模式</button></p>`;
};

/* ---------- 真假快答 ---------- */
function tfPool(){ const t=tierOf(); return TF.filter(q=> t==='basic' ? !(q.lv>1) : t==='mid' ? (q.lv||1)<=2 : (q.lv||1)>=2); }
function tfTime(){ return {basic:60, mid:45, adv:35}[tierOf()]; }
tfMenu = function(){
  tfState=null; clearTimers(); const best = tierOf()==='basic'?S.tfBest:(tstat().tfBest||0);
  $('tf-panel').innerHTML=`${stk('deadline','stk-big')}<p class="center big">${tfTime()} 秒內，判斷每句話是「真」還是「假」！<span class="tier-chip tier-${tierOf()}">${tierInfo().ico}${tierInfo().name}</span></p><p class="center muted">答對 +5 XP（×${xpMult()}），連續答對有加成。最佳紀錄：${best} 題</p><p class="center"><button class="btn p" onclick="tfStart()">▶️ 開始！</button></p>`;
};
tfStart = function(){
  let pool=shuffle(tfPool()); if(tierOf()==='mid') pool=shuffle(pool.filter(q=>q.lv===2).concat(shuffle(pool.filter(q=>!(q.lv>1))).slice(0,8)));
  tfState={qs:pool, i:0, correct:0, wrong:[], time:tfTime(), combo:0, lock:false, tier:tierOf()};
  tfRender();
  const t=setInterval(()=>{ tfState.time--; const el=$('tf-time'); if(el){ el.textContent=tfState.time; if(tfState.time<=10) el.parentElement.classList.add('danger'); } if(tfState.time<=0){ clearTimers(); tfEnd(); } },1000);
  timers.push(t);
};
const _tfEnd = tfEnd;
tfEnd = function(){
  const st=tfState; if(!st) return;
  if((st.tier||'basic')!=='basic'){ const t=S.t[st.tier]=S.t[st.tier]||{}; if(st.correct>(t.tfBest||0)) t.tfBest=st.correct; const keep=S.tfBest; _tfEnd(); S.tfBest=keep; save(); checkBadges(); }
  else _tfEnd();
};

/* ---------- 哪間比較貴（中階：更多因素／進階：三間排序） ---------- */
const _genHouse=genHouse, _calcPrice=calcPrice, _houseHTML=houseHTML, _reasons=reasons, _priceNew=priceNew, _priceAnswer=priceAnswer;
genHouse = function(){ const h=_genHouse(); if(tierOf()!=='basic'){ h.road=rnd([4,6,8,12,20]); h.ps=h.type==='透天'?0:rnd([15,25,33]); h.price=calcPrice(h); } return h; };
calcPrice = function(h){ let p=_calcPrice(h); if(h.road){ if(h.road>=12) p*=1.04; else if(h.road<=4) p*=0.93; } if(h.ps){ p*= h.ps>=33?0.96:h.ps<=15?1.03:1; } return p; };
houseHTML = function(h,name,onclick){ let s=_houseHTML(h,name,onclick); if(h.road){ s=s.replace('</ul>', `<li><span>臨路</span><b>${h.road} 公尺</b></li>${h.type!=='透天'?`<li><span>公設比</span><b>${h.ps}%</b></li>`:''}</ul>`); } return s; };
reasons = function(x,y){ const r=_reasons(x,y); if(x.road&&y.road){ if(x.road>=12&&y.road<12) r.push(`🛣️ 臨路：${x.road} 公尺大路比 ${y.road} 公尺好利用`); if(y.road<=4&&x.road>4) r.push(`🛣️ 臨路：另一間只有 ${y.road} 公尺巷道，消防車難進、重建困難`); } if(x.ps!=null&&y.ps!=null&&x.ps<y.ps&&y.ps>=33) r.push(`🛗 公設比：另一間公設 ${y.ps}%，室內實坪較少`); return r; };
priceNew = function(){
  const t=tierOf();
  if(t==='basic') return _priceNew();
  const st=tstat(); st.priceStreak=st.priceStreak||0; st.priceStreakBest=st.priceStreakBest||0;
  if(t==='mid'){
    let a,b,tries=0; do{ a=genHouse(); b=genHouse(); tries++; }while((Math.abs(a.price-b.price)/Math.max(a.price,b.price)<0.05 || JSON.stringify(a)===JSON.stringify(b)) && tries<400);
    priceState={a,b,done:false,tier:'mid'};
    $('price-panel').innerHTML=`<div class="score"><span class="pill">🔥 連續答對 ${st.priceStreak}</span><span class="pill">🏅 最佳 ${st.priceStreakBest}</span><span class="tier-chip tier-mid">🔬中階</span><span class="pill hot">差距只有 5% 起，多了臨路與公設比</span></div>
      ${stk('xiankan','stk-r')}<div class="question">兩間房子，哪一間「每坪」的價錢比較高？</div>
      <div class="houses" id="houses">${houseHTML(a,'A 房子','priceAnswer(0)')}${houseHTML(b,'B 房子','priceAnswer(1)')}</div>
      <div class="explain" id="price-explain"></div><p class="right"><button class="btn sm y" id="price-next" style="display:none" onclick="priceNew()">下一題 ➡️</button></p>`;
    return;
  }
  // 進階：三間排序
  let hs,tries=0;
  do{ hs=[genHouse(),genHouse(),genHouse()]; tries++; const ps=hs.map(h=>h.price).sort((x,y)=>y-x); var okd = (ps[0]-ps[1])/ps[0]>=0.05 && (ps[1]-ps[2])/ps[1]>=0.05; }while(!okd && tries<500);
  priceState={hs, picked:[], done:false, tier:'adv'};
  $('price-panel').innerHTML=`<div class="score"><span class="pill">🔥 連續答對 ${st.priceStreak}</span><span class="pill">🏅 最佳 ${st.priceStreakBest}</span><span class="tier-chip tier-adv">🐉進階</span></div>
    ${stk('qiazhi','stk-r')}<div class="question">三間房子，請依「每坪價格」<u>由高到低</u>依序點選（先點最貴的）。三個順序都對才算答對！</div>
    <div class="cands" id="houses">${hs.map((h,i)=>houseHTML(h,['A','B','C'][i]+' 房子','priceAnswer('+i+')').replace('class="house"','class="house rank"').replace('<div class="tag">比較貴！</div>','<div class="tag rank-tag" id="rank-tag-'+i+'"></div>')).join('')}</div>
    <div class="explain" id="price-explain"></div><p class="right"><button class="btn sm y" id="price-next" style="display:none" onclick="priceNew()">下一題 ➡️</button></p>`;
};
priceAnswer = function(k){
  const st=priceState; if(!st||st.done) return;
  if(!st.tier) return _priceAnswer(k);
  const ts=tstat();
  if(st.tier==='mid'){
    st.done=true; const win=st.a.price>st.b.price?0:1; const ok=k===win; const hs=document.querySelectorAll('#houses .house'); hs[win].classList.add('win'); hs[1-win].classList.add('lose');
    const W=win===0?st.a:st.b, L=win===0?st.b:st.a; const diff=Math.round((W.price/L.price-1)*100);
    logEvent({game:'price', question:`A：${st.a.zone.n}/${st.a.type}/${st.a.age}年/臨路${st.a.road}m｜B：${st.b.zone.n}/${st.b.type}/${st.b.age}年/臨路${st.b.road}m`, chosen:k===0?'A':'B', correct:win===0?'A':'B', ok, extra:{diff}});
    ts.priceStreak = ok?ts.priceStreak+1:0; ts.priceStreakBest=Math.max(ts.priceStreakBest,ts.priceStreak); save(); if(ok){ sfx.ok(); addXP(12,''); } else sfx.bad(); checkBadges();
    const rs=reasons(W,L); const ex=$('price-explain'); ex.innerHTML=`${ok?stkOK('stk-r'):stkNO('stk-r')}<b>${ok?'✅ 答對了！':'❌ 不對喔！'}</b> ${win===0?'A':'B'} 房子每坪大約貴了 ${diff}%。<br>🦉 <b>估咕這樣想：</b><ul>${rs.map(r=>`<li>${r}</li>`).join('')||'<li>兩間條件很接近，但加總起來還是有差！</li>'}</ul>`; ex.classList.add('show');
    $('price-next').style.display='inline-block'; document.querySelector('#price-panel .score').innerHTML=`<span class="pill">🔥 連續答對 ${ts.priceStreak}</span><span class="pill">🏅 最佳 ${ts.priceStreakBest}</span><span class="tier-chip tier-mid">🔬中階</span>`;
    return;
  }
  // adv rank
  if(st.picked.includes(k)) return;
  st.picked.push(k); const tag=$('rank-tag-'+k); tag.textContent=['第 1 貴','第 2 貴','第 3 貴'][st.picked.length-1]; tag.style.display='block'; sfx.click();
  if(st.picked.length<3) return;
  st.done=true;
  const order=[0,1,2].sort((x,y)=>st.hs[y].price-st.hs[x].price); const ok=order.every((v,i)=>v===st.picked[i]);
  const hs=document.querySelectorAll('#houses .house'); order.forEach((idx,i)=>{ hs[idx].classList.add(st.picked[i]===idx?'win':'lose'); });
  logEvent({game:'price', question:'三間排序：'+st.hs.map((h,i)=>['A','B','C'][i]+'='+h.zone.n+'/'+h.type+'/'+h.age+'年').join('｜'), chosen:st.picked.map(i=>['A','B','C'][i]).join('>'), correct:order.map(i=>['A','B','C'][i]).join('>'), ok});
  ts.priceStreak = ok?ts.priceStreak+1:0; ts.priceStreakBest=Math.max(ts.priceStreakBest,ts.priceStreak); save(); if(ok){ sfx.ok(); addXP(15,''); } else sfx.bad(); checkBadges();
  const L=['A','B','C']; const ex=$('price-explain');
  ex.innerHTML=`${ok?stkOK('stk-r'):stkNO('stk-r')}<b>${ok?'✅ 三個順序全對！':'❌ 順序不對。'}</b> 正確順序：${order.map(i=>L[i]).join(' ＞ ')}（每坪約 ${order.map(i=>Math.round(st.hs[i].price)).join(' / ')} 萬）<br>🦉 <b>估咕這樣想：</b><ul>${[0,1].map(i=>`<li><b>${L[order[i]]} ＞ ${L[order[i+1]]}</b>：${reasons(st.hs[order[i]],st.hs[order[i+1]]).slice(0,3).join('；')||'條件接近，加總後仍有差距'}</li>`).join('')}</ul>`;
  ex.classList.add('show'); $('price-next').style.display='inline-block';
  document.querySelector('#price-panel .score').innerHTML=`<span class="pill">🔥 連續答對 ${ts.priceStreak}</span><span class="pill">🏅 最佳 ${ts.priceStreakBest}</span><span class="tier-chip tier-adv">🐉進階</span>`;
};

/* ---------- 價格猜猜樂（中階：兩項差異、±3%；進階：四案例含異常交易） ---------- */
const _estNew=estNew, _estSubmit=estSubmit;
function estTh(){ return tierOf()==='basic' ? [0.05,0.10,0.20] : [0.03,0.06,0.12]; }
estNew = function(){
  const t=tierOf(); if(t==='basic') return _estNew();
  const P=rint(25,80);
  const subj={zone:rnd(['快樂區','陽光區','幸福區']), type:rnd(['電梯大樓','無電梯公寓']), area:rnd([20,25,30,35]), age:rnd([8,12,15,20])};
  const names = t==='adv' ? ['A','B','C','D'] : ['A','B','C'];
  const outlier = t==='adv' ? rint(0, 3) : -1;
  const comps=names.map((name,idx)=>{
    if(idx===outlier){ const price=Math.round(P*rnd([0.7,0.74,1.3])*10)/10; return {name, feats:[], adj:0, price, outlier:true, note:price<P?'備註：賣方與買方為親屬關係':'備註：買方急需取得，含高額搬遷補償'}; }
    const n=2; const picked=[]; const usedGroups=new Set(); let guard=0;
    while(picked.length<n && guard++<60){ const i=rint(0,EST_FEATS.length-1); if(picked.includes(i)) continue; const g=EST_GROUPS.findIndex(gr=>gr.includes(i)); if(g>=0){ if(usedGroups.has(g)) continue; usedGroups.add(g); } picked.push(i); }
    const adj=picked.reduce((s,i)=>s+EST_FEATS[i].adj,0); const price=Math.round(P*(1+adj)*10)/10;
    return {name, feats:picked, adj, price};
  });
  estState={P,subj,comps,done:false,tier:t,outlier};
  const ts=tstat();
  $('est-panel').innerHTML=`
    <div class="score"><span class="pill">🎯 3 星次數 ${ts.est3||0}</span><span class="tier-chip tier-${t}">${tierInfo().ico}${tierInfo().name}</span><span class="pill hot">${t==='adv'?'四個案例中有一個「不正常交易」要剔除！':'每個案例有兩項差異，3 星要誤差 3% 內'}</span></div>
    ${stk('qiazhi','stk-r')}<div class="question">請用「比較法」估出標的每坪多少萬元。${t==='adv'?'先找出不能用的案例並剔除，再反推其他案例。':'每個案例的兩個差異都要反推。'}</div>
    <div class="house subject est-subj"><div class="art">🎯</div><h4>勘估標的</h4><ul><li><span>地區</span><b>${subj.zone}</b></li><li><span>類型</span><b>${subj.type}</b></li><li><span>屋齡</span><b>${subj.age} 年</b></li><li><span>面積</span><b>${subj.area} 坪</b></li></ul></div>
    <div class="comps ${t==='adv'?'comps4':''}">${comps.map(c=>`<div class="comp ${c.outlier?'comp-warn':''}"><div class="comp-h">案例 ${c.name}<span class="comp-p">${c.price} 萬／坪</span></div><div class="comp-f">${c.outlier?`<span class="chip warn">⚠️ ${c.note}</span>`:'和標的比：'+c.feats.map(i=>`<span class="chip ${EST_FEATS[i].adj>0?'up':'down'}">${esc(EST_FEATS[i].label)}（${EST_FEATS[i].adj>0?'+':'−'}${Math.round(Math.abs(EST_FEATS[i].adj)*100)}%）</span>`).join('')}</div></div>`).join('')}</div>
    <div class="slider-box"><div class="slider-val">我的估價：<b id="est-val">50.0</b> 萬／坪 <span class="muted">（總價約 <span id="est-total">${(50*subj.area).toFixed(0)}</span> 萬）</span></div>
      <input type="range" id="est-slider" min="10" max="120" step="0.5" value="50" oninput="estSlide(this.value)">
      <div class="slider-ticks"><span>10</span><span>40</span><span>70</span><span>100</span><span>120</span></div></div>
    <p class="center"><button class="btn b" id="est-submit" onclick="estSubmit()">📋 送出估價</button></p>
    <div class="explain" id="est-explain"></div>
    <p class="right"><button class="btn sm y" id="est-next" style="display:none" onclick="estNew()">下一題 ➡️</button></p>`;
};
estSubmit = function(){
  const st=estState; if(!st||st.done) return;
  if(!st.tier) return _estSubmit();
  st.done=true; const v=Number($('est-slider').value); const err=Math.abs(v-st.P)/st.P; const th=estTh();
  const n = err<=th[0]?3: err<=th[1]?2: err<=th[2]?1:0; const ts=tstat();
  logEvent({game:'estimate', question:`${st.subj.zone} ${st.subj.type} ${st.subj.age}年 ${st.subj.area}坪`, chosen:v.toFixed(1)+' 萬/坪', correct:st.P+' 萬/坪', ok:n>=2, extra:{errPct:Math.round(err*100), stars:n}});
  ts.estPlayed=(ts.estPlayed||0)+1; if(n===3) ts.est3=(ts.est3||0)+1; save();
  if(n>=2) sfx.ok(); else sfx.bad(); if(n) addXP(n*20,'估價'); checkBadges();
  $('est-submit').disabled=true; $('est-slider').disabled=true;
  const valid=st.comps.filter(c=>!c.outlier);
  const ex=$('est-explain');
  ex.innerHTML=`${stk(['bengkui','jiayou','jingda','jingzhun'][n],'stk-r')}<b>${['😅 差太多了！','👍 還不錯！','🎉 很接近！','🏆 神準！'][n]}</b> 你估 ${v.toFixed(1)} 萬，合理價格約 <b>${st.P} 萬／坪</b>（誤差 ${Math.round(err*100)}%，${tierInfo().name}標準：3 星 ≤${th[0]*100}%）<span class="xpchip">${stars(n)}</span><br>
    🦉 <b>估咕這樣算：</b><ul>
    ${st.outlier>=0?`<li>案例 ${st.comps[st.outlier].name} 是不正常交易（${esc(st.comps[st.outlier].note)}），<b>剔除不用</b>。</li>`:''}
    ${valid.map(c=>`<li>案例 ${c.name}：${c.price} ÷ (1 ${c.adj>=0?'+':'−'} ${Math.abs(Math.round(c.adj*100))}%) ≈ <b>${(c.price/(1+c.adj)).toFixed(1)}</b> 萬</li>`).join('')}
    <li>取平均 ≈ <b>${(valid.reduce((s,c)=>s+c.price/(1+c.adj),0)/valid.length).toFixed(1)}</b> 萬／坪。</li></ul>`;
  ex.classList.add('show'); $('est-next').style.display='inline-block';
};

/* ---------- 找鄰居（中階：五選一、差異更細；進階：六選三） ---------- */
const _compNew=compNew, _compAnswer=compAnswer;
compNew = function(){
  const t=tierOf(); if(t==='basic') return _compNew();
  const subj={d:rnd(DISTRICTS), type:rnd(['電梯大樓','無電梯公寓','透天']), age:rnd([5,10,20,30]), area:rnd([20,30,45])};
  const feats=['d','type','age','area','when'];
  function cand(matchN, subtle){
    const c={d:subj.d,type:subj.type,age:subj.age,area:subj.area,when:'上個月'};
    shuffle(feats).slice(0, feats.length-matchN).forEach(f=>{
      if(f==='d') c.d=rnd(DISTRICTS.filter(x=>x!==subj.d).concat(['隔壁縣市']));
      if(f==='type') c.type=rnd(['電梯大樓','無電梯公寓','透天'].filter(x=>x!==subj.type));
      if(f==='age') c.age=subtle? subj.age+rnd([8,9,10,-8]) : rnd([5,10,20,30,45].filter(x=>Math.abs(x-subj.age)>=15));
      if(f==='area') c.area=subtle? subj.area+rnd([12,14,-12]) : rnd([12,20,30,45,80].filter(x=>Math.abs(x-subj.area)>=20));
      if(f==='when') c.when=subtle? rnd(['2 年前','3 年前']) : rnd(['12 年前','8 年前']);
    });
    if(c.age<1) c.age=1; if(c.area<8) c.area=8;
    c.score=matchN; return c;
  }
  const tweak=c=>{ c.age=Math.max(1,subj.age+rnd([-2,-1,1,2])); c.area=subj.area+rnd([-2,-1,1,2]); return c; };
  let cands, correctSet;
  if(t==='mid'){ const best=tweak(cand(5)); cands=shuffle([best, cand(4,true), cand(4,true), cand(3,true), cand(2)]); correctSet=[cands.indexOf(best)]; }
  else { const b1=tweak(cand(5)), b2=cand(4,true), b3=cand(4,true); cands=shuffle([b1,b2,b3, cand(3,true), cand(2,true), cand(2)]); correctSet=[b1,b2,b3].map(x=>cands.indexOf(x)); }
  compState={subj,cands,done:false,correctSet,picked:[],tier:t};
  const ts=tstat();
  const cHTML=(c,i)=>`<div class="house ${t==='adv'?'pick':''}" id="cand-${i}" onclick="compAnswer(${i})"><div class="tag">${t==='adv'?'✓ 選入':'最像！'}</div><div class="art">${c.type==='透天'?'🏠':c.type==='電梯大樓'?'🏢':'🏬'}</div><h4>案例 ${i+1}</h4>
    <ul><li><span>地區</span><b>${c.d}</b></li><li><span>類型</span><b>${c.type}</b></li><li><span>屋齡</span><b>${c.age} 年</b></li><li><span>面積</span><b>${c.area} 坪</b></li><li><span>成交</span><b>${c.when}</b></li></ul></div>`;
  $('comp-panel').innerHTML=`
    <div class="score"><span class="pill">🏅 累計答對 ${ts.compCorrect||0}</span><span class="tier-chip tier-${t}">${tierInfo().ico}${tierInfo().name}</span></div>
    ${stk('xiankan','stk-r')}<div class="question">${t==='mid'?'五個案例差異很小。用「比較法」選出<u>最像</u>的一個！':'估價技術規則要求至少三個比較標的。請從六個案例中選出<u>最適合的三個</u>，再按確認。'}</div>
    <div class="house subject est-subj"><div class="art">🎯</div><h4>勘估標的</h4><ul><li><span>地區</span><b>${subj.d}</b></li><li><span>類型</span><b>${subj.type}</b></li><li><span>屋齡</span><b>${subj.age} 年</b></li><li><span>面積</span><b>${subj.area} 坪</b></li></ul></div>
    <div class="cands cands-many" id="cands">${cands.map(cHTML).join('')}</div>
    ${t==='adv'?`<p class="center"><button class="btn b" id="comp-confirm" onclick="compConfirm()" disabled>✅ 確認這三個（已選 <span id="comp-n">0</span>/3）</button></p>`:''}
    <div class="explain" id="comp-explain"></div>
    <p class="right"><button class="btn sm" id="comp-next" style="display:none" onclick="compNew()">下一題 ➡️</button></p>`;
};
function compWhy(c, subj){ const why=[]; if(c.d!==subj.d) why.push('地區不同'); if(c.type!==subj.type) why.push('類型不同'); if(Math.abs(c.age-subj.age)>=8) why.push(`屋齡差 ${Math.abs(c.age-subj.age)} 年`); if(Math.abs(c.area-subj.area)>=10) why.push(`面積差 ${Math.abs(c.area-subj.area)} 坪`); if(c.when!=='上個月') why.push(`成交是 ${c.when}`); return why; }
compAnswer = function(i){
  const st=compState; if(!st||st.done) return;
  if(!st.tier) return _compAnswer(i);
  const ts=tstat();
  if(st.tier==='mid'){
    st.done=true; const ok=st.correctSet.includes(i); const hs=document.querySelectorAll('#cands .house'); hs[st.correctSet[0]].classList.add('win'); hs.forEach((h,k)=>{ if(!st.correctSet.includes(k)) h.classList.add('lose'); });
    logEvent({game:'comp', question:`${st.subj.d} ${st.subj.type} ${st.subj.age}年 ${st.subj.area}坪（中階五選一）`, chosen:'案例 '+(i+1), correct:'案例 '+(st.correctSet[0]+1), ok});
    if(ok){ ts.compCorrect=(ts.compCorrect||0)+1; save(); sfx.ok(); addXP(15,''); } else sfx.bad(); checkBadges();
    const ex=$('comp-explain'); ex.innerHTML=`${ok?stkOK('stk-r'):stkNO('stk-r')}<b>${ok?'✅ 答對了！':'❌ 不對喔！最像的是案例 '+(st.correctSet[0]+1)+'。'}</b><br>🦉 <b>估咕這樣想：</b>差異越小越好，但「地區／類型」不同是硬傷，屋齡差 8 年以上、面積差 12 坪以上、成交超過一年也都要扣分。<ul>${st.cands.map((c,k)=>k===st.correctSet[0]?'':`<li>案例 ${k+1}：${compWhy(c,st.subj).join('、')||'條件接近'}</li>`).join('')}</ul>`; ex.classList.add('show'); $('comp-next').style.display='inline-block';
    document.querySelector('#comp-panel .score').innerHTML=`<span class="pill">🏅 累計答對 ${ts.compCorrect||0}</span><span class="tier-chip tier-mid">🔬中階</span>`;
    return;
  }
  const el=$('cand-'+i); if(st.picked.includes(i)){ st.picked=st.picked.filter(x=>x!==i); el.classList.remove('sel'); } else { if(st.picked.length>=3){ toast('最多選三個，先取消一個再選'); return; } st.picked.push(i); el.classList.add('sel'); }
  sfx.click(); $('comp-n').textContent=st.picked.length; $('comp-confirm').disabled=st.picked.length!==3;
};
function compConfirm(){
  const st=compState; if(!st||st.done||st.picked.length!==3) return; st.done=true; const ts=tstat();
  const ok=st.correctSet.every(i=>st.picked.includes(i)); const hs=document.querySelectorAll('#cands .house');
  hs.forEach((h,k)=>{ h.classList.remove('sel'); if(st.correctSet.includes(k)) h.classList.add('win'); else if(st.picked.includes(k)) h.classList.add('lose'); else h.classList.add('lose'); });
  logEvent({game:'comp', question:`${st.subj.d} ${st.subj.type} ${st.subj.age}年 ${st.subj.area}坪（進階六選三）`, chosen:st.picked.map(i=>i+1).sort().join(','), correct:st.correctSet.map(i=>i+1).sort().join(','), ok});
  if(ok){ ts.compCorrect=(ts.compCorrect||0)+1; save(); sfx.ok(); addXP(20,''); } else sfx.bad(); checkBadges(); $('comp-confirm').style.display='none';
  const hit=st.picked.filter(i=>st.correctSet.includes(i)).length;
  const ex=$('comp-explain'); ex.innerHTML=`${ok?stkOK('stk-r'):stkNO('stk-r')}<b>${ok?'✅ 三個全對！':'❌ 選對 '+hit+' 個。正確是案例 '+st.correctSet.map(i=>i+1).sort().join('、')+'。'}</b><br>🦉 <b>估咕這樣想：</b><ul>${st.cands.map((c,k)=>`<li>案例 ${k+1}${st.correctSet.includes(k)?' ✅':''}：${compWhy(c,st.subj).join('、')||'條件最接近'}</li>`).join('')}</ul>`; ex.classList.add('show'); $('comp-next').style.display='inline-block';
  document.querySelector('#comp-panel .score').innerHTML=`<span class="pill">🏅 累計答對 ${ts.compCorrect||0}</span><span class="tier-chip tier-adv">🐉進階</span>`;
}

/* ---------- 城市規劃師：河流、山地、醫院、高速公路 ---------- */
const _cityMenu=cityMenu;
cityMenu = function(){
  cityState=null; const t=tierOf();
  const lv=CITY_LEVELS.map((L,i)=>({L,i})).filter(x=> t==='basic' ? !x.L.tier : x.L.tier===t);
  $('city-panel').innerHTML=`${stk('lima','stk-big')}<p class="center big">你是城市規劃師！在地圖上放置設施，讓所有「住宅」的地價總和越高越好。<span class="tier-chip tier-${t}">${tierInfo().ico}${tierInfo().name}</span></p>
    <div class="legend">${Object.entries(CITY_ITEMS).filter(([k,v])=> t!=='basic' || !['hospital','highway','water','mountain'].includes(k)).map(([k,v])=>`<div class="lg"><span class="lg-ico">${v.ico}</span><b>${v.name}</b><small>${v.desc}</small></div>`).join('')}</div>
    <div class="modes">${lv.map(({L,i})=>`<div class="mode" onclick="cityStart(${i})"><div class="ico">${['🏘️','🏙️','🌆','🌉','⛰️','🌃','🌊'][i]||'🏙️'}</div><h4>${L.name}</h4><p>${L.size}×${L.size} 格 · 必放：${Object.entries(L.req).map(([k,n])=>CITY_ITEMS[k].ico+'×'+n).join(' ')}</p><p class="stars">${stars(S.city[i]||0)}</p></div>`).join('')}</div>`;
};
cityValues = function(grid, n){
  const vals=new Array(n*n).fill(null); let total=0; const hasHighway=grid.includes('highway');
  for(let i=0;i<n*n;i++){
    if(grid[i]!=='home') continue;
    const r=Math.floor(i/n), c=i%n; let v=100;
    for(let j=0;j<n*n;j++){ const t=grid[j]; if(!t||t==='home'||j===i) continue; const eff=CITY_ITEMS[t].eff||[]; if(!eff.length) continue; const d=Math.max(Math.abs(Math.floor(j/n)-r), Math.abs(j%n-c)); if(d>=1 && d<=eff.length) v+=eff[d-1]; }
    if(hasHighway) v+=CITY_ITEMS.highway.city||0;
    v=Math.max(10,v); vals[i]=v; total+=v;
  }
  return {vals,total};
};
function cityBaseGrid(L){ const g=new Array(L.size*L.size).fill('home'); Object.entries(L.blocked||{}).forEach(([k,idx])=>idx.forEach(i=>{ if(i<g.length) g[i]=k; })); return g; }
cityBest = function(L){
  const n=L.size, items=[]; Object.entries(L.req).forEach(([k,c])=>{ for(let i=0;i<c;i++) items.push(k); });
  const base=cityBaseGrid(L); const free=[...Array(n*n).keys()].filter(i=>base[i]==='home');
  let best=0, bestGrid=null;
  for(let t=0;t<350;t++){ const grid=base.slice(); const cells=shuffle(free).slice(0,items.length); items.forEach((it,i)=>grid[cells[i]]=it); const tot=cityValues(grid,n).total; if(tot>best){ best=tot; bestGrid=grid; } }
  let cur=bestGrid.slice(), curV=best;
  for(let t=0;t<700;t++){ const g=cur.slice(); const a=rnd(free), b=rnd(free); if(g[a]===g[b]) continue; [g[a],g[b]]=[g[b],g[a]]; const v=cityValues(g,n).total; if(v>=curV){ cur=g; curV=v; } }
  return Math.max(best,curV);
};
cityStart = function(li){ const L=CITY_LEVELS[li]; cityState={li, n:L.size, grid:cityBaseGrid(L), tool:Object.keys(L.req)[0], best:cityBest(L), done:false}; cityRender(); };
cityRender = function(){
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
      <div class="citygrid ${n>=7?'big':''}" style="grid-template-columns:repeat(${n},1fr)">
        ${st.grid.map((g,i)=>{ const fixed=CITY_ITEMS[g]&&CITY_ITEMS[g].fixed; const v=vals[i]; const cls=fixed?('fixed '+g):g==='home'?(v>=140?'hot':v>=110?'warm':v<80?'cold':''):'fac'; return `<button class="cell ${cls}" ${fixed?'disabled':''} onclick="cityPlace(${i})"><span class="c-ico">${CITY_ITEMS[g].ico}</span><span class="c-val">${g==='home'?v:''}</span></button>`; }).join('')}
      </div>
    </div>
    <div class="explain" id="city-explain"></div>`;
};
const _cityPlace=cityPlace;
cityPlace = function(i){ const st=cityState; if(!st||st.done) return; const cur=st.grid[i]; if(CITY_ITEMS[cur]&&CITY_ITEMS[cur].fixed){ toast('這裡是'+CITY_ITEMS[cur].name+'，不能蓋'); return; } _cityPlace(i); };

/* ---------- 任務：依階層 ---------- */
missionMenu = function(){
  misState=null; const t=tierOf(); const list=MISSIONS.map((m,i)=>({m,i})).filter(x=> t==='basic' ? !x.m.tier : x.m.tier===t);
  $('mission-panel').innerHTML=`${stk('zhuanye','stk-big')}<p class="center big">${t==='basic'?'你是剛拿到證書的估價師。每個任務有 5 個關鍵決定，全部答對拿 3 顆星！':t==='mid'?'你已經是能獨立作業的估價師，現在要面對瑕疵、審議會與政策案。':'進階任務要你一步一步計算，並在壓力下守住專業。'}<span class="tier-chip tier-${t}">${tierInfo().ico}${tierInfo().name}</span></p>
    <div class="missions">${list.map(({m,i})=>`<div class="mission-card" onclick="missionStart(${i})"><div class="m-ico">${m.ico}</div><div><h4>${esc(m.title)}</h4><p>${esc(m.intro)}</p><div class="stars">${stars(S.missions[m.id]||0)}${S.missions[m.id]!=null?'':' <span class="muted">尚未完成</span>'}</div></div></div>`).join('')}</div>`;
};
const _missionEnd=missionEnd;
missionEnd = function(){ const m=misState.m; _missionEnd(); const nextIdx=MISSIONS.indexOf(m)+1; const nb=document.querySelector('#mission-panel .btn.b'); if(nb && MISSIONS[nextIdx] && (MISSIONS[nextIdx].tier||'basic')!==(m.tier||'basic')) nb.style.display='none'; };

/* ---------- 估價計算所 ---------- */
let calcState=null;
function fmtN(v){ if(Math.abs(v)>=1000) return Math.round(v).toLocaleString('zh-TW'); if(Math.abs(v)>=100) return String(Math.round(v)); return String(Math.round(v*10)/10); }
function calcGen(tier){
  const pick=rnd;
  const gens = tier==='mid' ? [
    ()=>{ const L=rint(5,30)*10, r=pick([150,200,225,300,400]); return {q:`一塊 ${L} 坪土地，容積率 ${r}%，最多可蓋多少坪樓地板面積？`, a:L*r/100, u:'坪', e:`${L} × ${r}% ＝ ${fmtN(L*r/100)} 坪`}; },
    ()=>{ const L=rint(5,30)*10, c=pick([40,50,60]); return {q:`土地 ${L} 坪、建蔽率 ${c}%，一樓最多可以蓋幾坪？`, a:L*c/100, u:'坪', e:`${L} × ${c}% ＝ ${fmtN(L*c/100)} 坪`}; },
    ()=>{ const C=rint(6,20)*100, g=rint(1,9)*5; return {q:`重建成本 ${C} 萬、耐用年數 50 年、屋齡 ${g} 年（直線折舊、不計殘值），建物現值多少萬？`, a:C*(1-g/50), u:'萬', e:`每年折舊 ${fmtN(C/50)} 萬，${g} 年折 ${fmtN(C*g/50)} 萬，剩 ${fmtN(C*(1-g/50))} 萬`}; },
    ()=>{ const m=rint(3,20), r=pick([3,4,5,6]); return {q:`店面每月租金 ${m} 萬，收益資本化率 ${r}%，收益法價格約多少萬？`, a:m*12/(r/100), u:'萬', e:`年租 ${m*12} 萬 ÷ ${r}% ＝ ${fmtN(m*12/(r/100))} 萬`}; },
    ()=>{ const E=rint(8,30)*100, r=pick([60,70,80]); return {q:`估價金額 ${E} 萬，貸款成數 ${r/10} 成，最多可以借多少萬？`, a:E*r/100, u:'萬', e:`${E} × ${r}% ＝ ${fmtN(E*r/100)} 萬`}; },
    ()=>{ const D=rint(20,60), r=pick([25,30,33,35]); return {q:`權狀 ${D} 坪、公設比 ${r}%，室內（主建物＋附屬建物）約幾坪？`, a:D*(1-r/100), u:'坪', e:`${D} × (1 − ${r}%) ＝ ${fmtN(D*(1-r/100))} 坪`}; },
    ()=>{ const k=rint(3,30); return {q:`${k*33} 平方公尺大約是幾坪？（1 坪 ≈ 3.3 平方公尺）`, a:k*10, u:'坪', e:`${k*33} ÷ 3.3 ＝ ${k*10} 坪`}; },
    ()=>{ const p=rint(30,90), s=pick([-1,1]), d=rint(3,15); return {q:`比較案例每坪 ${p} 萬，案例比標的${s>0?'好':'差'}，應調整 ${s>0?'−':'+'}${d}%。推算標的每坪多少萬？`, a:p*(1-s*d/100), u:'萬', e:`${p} × (1 ${s>0?'−':'+'} ${d}%) ＝ ${fmtN(p*(1-s*d/100))} 萬`}; },
    ()=>{ const p=rint(30,90), g=pick([-8,-5,-3,3,5,8,10]); return {q:`案例一年前成交每坪 ${p} 萬，這一年行情${g>0?'漲':'跌'}了 ${Math.abs(g)}%，期日修正後每坪多少萬？`, a:p*(1+g/100), u:'萬', e:`${p} × (1 ${g>0?'+':'−'} ${Math.abs(g)}%) ＝ ${fmtN(p*(1+g/100))} 萬`}; },
    ()=>{ const n=pick([2,4,5,8]), A=rint(3,20)*n*2; return {q:`一筆 ${A} 坪土地，你的持分是 1/${n}，相當於幾坪？`, a:A/n, u:'坪', e:`${A} ÷ ${n} ＝ ${A/n} 坪`}; },
    ()=>{ const u=rint(20,90), ar=rint(15,60); return {q:`每坪 ${u} 萬、權狀 ${ar} 坪，總價多少萬？`, a:u*ar, u:'萬', e:`${u} × ${ar} ＝ ${fmtN(u*ar)} 萬`}; },
    ()=>{ const I=rint(6,15)*10, k=rint(8,20); return {q:`房價 ${I*k} 萬、家庭年收入 ${I} 萬，房價所得比是多少？`, a:k, u:'', e:`${I*k} ÷ ${I} ＝ ${k}`}; },
  ] : [
    ()=>{ const L=rint(5,30)*10, r=pick([200,225,300]), ps=pick([25,30,33]); const a=L*r/100*(1-ps/100); return {q:`土地 ${L} 坪、容積率 ${r}%、公設比 ${ps}%，可賣的室內面積約幾坪？`, a, u:'坪', e:`樓地板 ${fmtN(L*r/100)} 坪 × (1 − ${ps}%) ≈ ${fmtN(a)} 坪`}; },
    ()=>{ const C=rint(6,20)*100, g=rint(1,9)*5; const a=C*(1-0.9*g/50); return {q:`重建成本 ${C} 萬、耐用 50 年、屋齡 ${g} 年、殘值率 10%，建物現值多少萬？`, a, u:'萬', e:`可折舊 ${fmtN(C*0.9)} 萬 × ${g}/50 ＝ ${fmtN(C*0.9*g/50)} 萬；${C} − ${fmtN(C*0.9*g/50)} ＝ ${fmtN(a)} 萬`}; },
    ()=>{ const m=rint(3,20), e=pick([15,20,25]), r=pick([3,4,5]); const a=m*12*(1-e/100)/(r/100); return {q:`店面月租 ${m} 萬，每年支出占租金 ${e}%，資本化率 ${r}%，收益法價格約多少萬？`, a, u:'萬', e:`淨收益 ${m}×12×(1−${e}%) ＝ ${fmtN(m*12*(1-e/100))} 萬 ÷ ${r}% ＝ ${fmtN(a)} 萬`}; },
    ()=>{ const p=rint(30,90), g=pick([3,4,5,6]), s=pick([-1,1]), d=rint(1,5); const a=p*(1+g/100)*(1-s*d/100); return {q:`案例每坪 ${p} 萬，一年前成交（行情漲 ${g}%），且案例比標的${s>0?'好':'差'} ${d}%，調整後每坪多少萬？`, a, u:'萬', e:`${p} × 1.0${g} × (1 ${s>0?'−':'+'} ${d}%) ≈ ${fmtN(a)} 萬（兩個調整要相乘）`}; },
    ()=>{ const TB=rint(3,8), sh=pick([5,8,10,12,20]), TA=TB*rint(2,3), CC=Math.round(TA*pick([0.3,0.4,0.45])*10)/10; const mine=TB*sh/100; const a=(TA-CC)*sh/100*10000; return {q:`更新前總價值 ${TB} 億、你的價值 ${fmtN(mine*10000)} 萬；更新後總價值 ${TA} 億、共同負擔 ${CC} 億。你可分配的價值約多少萬？`, a, u:'萬', e:`比例 ${sh}%；可分配 ${TA} − ${CC} ＝ ${fmtN(TA-CC)} 億 × ${sh}% ＝ ${fmtN(a)} 萬`}; },
    ()=>{ const B=rint(8,30)*100, k=pick([2,3]); const a=B*Math.pow(0.8,k-1); return {q:`法拍底價 ${B} 萬，每次流標降 20%。第 ${k} 拍的底價是多少萬？`, a, u:'萬', e:`${B}${' × 0.8'.repeat(k-1)} ＝ ${fmtN(a)} 萬`}; },
    ()=>{ const p=[rint(40,60),rint(40,60),rint(40,60)]; const a=p[0]*0.5+p[1]*0.3+p[2]*0.2; return {q:`三案例調整後價格 ${p.join('、')} 萬，權重 50%、30%、20%，加權平均每坪多少萬？`, a, u:'萬', e:`${p[0]}×0.5 + ${p[1]}×0.3 + ${p[2]}×0.2 ＝ ${fmtN(a)} 萬`}; },
    ()=>{ const E=rint(8,25)*100, r=pick([70,80]), Pr=E+rint(1,4)*50; const a=Pr-E*r/100; return {q:`估價 ${E} 萬、貸款 ${r/10} 成，買價 ${Pr} 萬。買方要準備多少自備款？`, a, u:'萬', e:`可貸 ${fmtN(E*r/100)} 萬；${Pr} − ${fmtN(E*r/100)} ＝ ${fmtN(a)} 萬`}; },
    ()=>{ const T=rint(4,20), c=Math.round(T*pick([0.6,0.65,0.7])*10)/10; const a=(T-c)*10000; return {q:`土地開發分析：開發後總銷 ${T} 億，開發成本、利潤與稅費共 ${c} 億，土地價值約多少萬？`, a, u:'萬', e:`${T} − ${c} ＝ ${fmtN(T-c)} 億 ＝ ${fmtN(a)} 萬`}; },
    ()=>{ const V=rint(5,20)*100, b=pick([20,30,40]), ps=pick([30,33]); const a=V*(1+b/100)*(1-ps/100); return {q:`基準容積 ${V} 坪，容積獎勵 ${b}%，公設比 ${ps}%，可賣的室內面積約幾坪？`, a, u:'坪', e:`${V} × ${1+b/100} ＝ ${fmtN(V*(1+b/100))} 坪 × (1 − ${ps}%) ≈ ${fmtN(a)} 坪`}; },
    ()=>{ const c=pick([50,60,75]), k=rint(3,8); return {q:`建蔽率 ${c}%、容積率 ${c*k}%，每層都蓋滿建蔽率時最多可蓋幾層？`, a:k, u:'層', e:`${c*k}% ÷ ${c}% ＝ ${k} 層`}; },
    ()=>{ const I=rint(8,20)*10, Y=Math.round(I*pick([0.3,0.35,0.4,0.45,0.5])); const a=Y/I*100; return {q:`年收入 ${I} 萬、每年房貸還款 ${Y} 萬，貸款負擔率是多少%？`, a, u:'%', e:`${Y} ÷ ${I} ＝ ${fmtN(a)}%`}; },
  ];
  const g=pick(gens)(); const a=g.a;
  const cands=new Set([fmtN(a)]); const wrongs=[a*0.8, a*1.25, a*0.5, a*2, a*0.9, a*1.1, a+Math.max(1,Math.round(a*0.15))];
  const opts=[fmtN(a)]; for(const w of shuffle(wrongs)){ const f=fmtN(w); if(!cands.has(f) && Number(f.replace(/,/g,''))>0){ cands.add(f); opts.push(f); } if(opts.length===4) break; }
  return {q:g.q, opts:shuffle(opts), ans:fmtN(a), unit:g.u, e:g.e};
}
function calcMenu(){
  calcState=null; const t=tierOf();
  if(t==='basic'){ $('calc-panel').innerHTML=`${stk('tiekou','stk-big')}<p class="center big">估價計算所是中階以上的遊戲</p><p class="center muted">集滿初階 13 枚徽章解鎖中階後，就可以來這裡練習容積、折舊、收益法的計算。</p><p class="center"><button class="btn ghost" onclick="go('games')">↩️ 回遊樂場</button></p>`; return; }
  const ts=tstat();
  $('calc-panel').innerHTML=`${stk('jingda','stk-big')}<p class="center big">估價計算所 <span class="tier-chip tier-${t}">${tierInfo().ico}${tierInfo().name}</span></p>
    <p class="center">${t==='mid'?'一步計算：容積率、建蔽率、折舊、收益法、貸款成數、公設比、坪數換算、調整率、期日修正、持分、房價所得比。':'兩步計算：容積＋公設、含殘值折舊、淨收益資本化、連乘調整、權變分配、法拍減價、加權平均、自備款、剩餘法、容積獎勵、樓層數、負擔率。'}</p>
    <p class="center muted">每局 10 題，答對一題 +10 XP（×${xpMult()}），10 題全對有徽章。全對紀錄：${ts.calcPerfect||0} 次 · 可以用紙筆或計算機。</p>
    <p class="center"><button class="btn b" onclick="calcStart()">▶️ 開始計算</button></p>`;
}
function calcStart(){ calcState={qs:Array.from({length:10},()=>calcGen(tierOf())), i:0, score:0, answered:false, tier:tierOf()}; calcRender(); }
function calcRender(){
  const st=calcState; if(st.i>=st.qs.length) return calcEnd();
  const q=st.qs[st.i];
  $('calc-panel').innerHTML=`<div class="score"><span class="pill">第 ${st.i+1} / 10 題</span><span class="pill">⭐ 答對 ${st.score}</span><span class="tier-chip tier-${st.tier}">${tierInfo(st.tier).ico}${tierInfo(st.tier).name}</span></div>
    <div class="progress"><i style="width:${st.i*10}%"></i></div>
    <div class="question">${esc(q.q)}</div>
    <div class="options calc-opts">${q.opts.map((o,k)=>`<button class="opt" onclick="calcAnswer(${k})"><span class="k">${'ABCD'[k]}</span><span>${o}${q.unit?' '+q.unit:''}</span></button>`).join('')}</div>
    <div class="explain" id="calc-explain"></div><p class="right"><button class="btn sm" id="calc-next" style="display:none" onclick="calcState.i++; calcState.answered=false; calcRender()">下一題 ➡️</button></p>`;
}
function calcAnswer(k){
  const st=calcState; if(!st||st.answered) return; st.answered=true; const q=st.qs[st.i]; const ok=q.opts[k]===q.ans;
  document.querySelectorAll('#calc-panel .opt').forEach((b,i)=>{ b.disabled=true; if(q.opts[i]===q.ans) b.classList.add('correct'); else if(i===k) b.classList.add('wrong'); });
  logEvent({game:'calc', question:q.q, chosen:q.opts[k]+(q.unit?' '+q.unit:''), correct:q.ans+(q.unit?' '+q.unit:''), ok});
  if(ok){ st.score++; sfx.ok(); addXP(10,''); } else sfx.bad();
  const ex=$('calc-explain'); ex.innerHTML=`${ok?stkOK('stk-r'):stkNO('stk-r')}<b>${ok?'✅ 答對了！':'❌ 正確答案是 '+q.ans+(q.unit?' '+q.unit:'')+'。'}</b><br>🦉 估咕這樣算：${esc(q.e)}`; ex.classList.add('show'); $('calc-next').style.display='inline-block';
}
function calcEnd(){
  const st=calcState; const ts=S.t[st.tier]=S.t[st.tier]||{}; if(st.score===10){ ts.calcPerfect=(ts.calcPerfect||0)+1; addXP(40,'計算所全對'); } save(); checkBadges();
  logEvent({game:'calc_done', question:'估價計算所（'+tierInfo(st.tier).name+'）', extra:{score:st.score, n:10}});
  $('calc-panel').innerHTML=`<h3>結算</h3>${stk(st.score===10?'qingzhu':st.score>=7?'jingda':'jiayou','stk-big')}<p class="center big">答對 ${st.score} / 10 題</p><p class="center">${st.score===10?'全對！真正的估價師也要這樣算。':st.score>=7?'很好，把算錯的公式再看一次。':'多練幾次，公式會越來越熟。'}</p><p class="center"><button class="btn b" onclick="calcStart()">🔁 再來一局</button> <button class="btn ghost" onclick="calcMenu()">↩️</button></p>`;
}
GAME_NAMES.calc='估價計算所'; GAME_NAMES.calc_done='計算所結算'; SCORED.push('calc');

/* ---------- 徽章牆：依階層分組 ---------- */
renderBadges = function(){
  const groups=[{id:'basic',name:'🌱 初階',list:BADGES.filter(b=>!b.tier)},{id:'mid',name:'🔬 中階',list:BADGES.filter(b=>b.tier==='mid')},{id:'adv',name:'🐉 進階',list:BADGES.filter(b=>b.tier==='adv')}];
  $('badges').innerHTML=groups.map(g=>{ const un=g.id==='basic'||S.unlocked[g.id]; const got=g.list.filter(b=>S.badges.includes(b.id)).length; return `<div class="badge-group ${un?'':'locked'}"><h3>${g.name} <span class="pill">${got} / ${g.list.length}</span>${un?'':`<span class="muted" style="font-size:14px"> 🔒 ${tierInfo(g.id).unlock}</span>`}</h3><div class="badges">${g.list.map(b=>`<div class="badge ${S.badges.includes(b.id)?'got':''}"><span class="lock">🔒</span><div class="ico">${b.ico}</div><h4>${b.name}</h4><p>${b.desc}</p></div>`).join('')}</div></div>`; }).join('');
  const L=levelOf(S.xp);
  $('level-list').innerHTML=LEVELS.map((l,i)=>`<div class="lvrow ${i<=L.idx?'got':''}"><span>${l.ico}</span><b>${l.name}</b><small>${l.xp} XP</small></div>`).join('');
  refreshMeta();
};

/* ---------- 啟動 ---------- */
refreshUnlocks(); refreshMeta();
if($('page-games').classList.contains('show')) renderGames();
