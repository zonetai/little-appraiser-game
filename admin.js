/* ============================================================
   小小估價師大冒險 — 管理後台
   需要管理帳號密碼；所有資料都透過 kid_admin_* 資料庫函式讀取。
   ============================================================ */
const SUPABASE_URL = 'https://vbqglkkkvsnuobbbysfk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_wZl0mw0Hn18udcHJOFHg4w_BMkWvyrw'; // publishable key，可公開
const ATOK = 'kid-admin-token', AUSER = 'kid-admin-user';

const $ = id => document.getElementById(id);
const esc = s => String(s==null?'':s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const GAME_NAMES = {quiz:'快問快答', tf:'真假快答', price:'哪間比較貴', estimate:'價格猜猜樂', comp:'找鄰居', city:'城市規劃師', mission:'估價師出任務', calc:'估價計算所', match:'連連看', card:'知識卡閱讀', quiz_done:'快問快答結算', tf_done:'真假快答結算', mission_done:'任務完成', calc_done:'計算所結算'};
const SCORED = ['quiz','tf','price','estimate','comp','city','mission','calc'];
const TIER_NAMES = {basic:'🌱 初階', mid:'🔬 中階', adv:'🐉 進階'};
const ERR = {BAD_ADMIN_LOGIN:'帳號或密碼不對', ADMIN_LOCKED:'錯誤太多次，請 10 分鐘後再試', BAD_ADMIN:'登入已過期，請重新登入', SETUP_DONE:'後台帳號已經設定過了，請直接登入', BAD_CODE:'設定碼不對', USER_LEN:'帳號要 3 到 24 個字', ADMIN_PW_LEN:'密碼至少 10 個字', PW_LEN:'新密碼至少 6 個字', NO_ACCOUNT:'找不到這個帳號（訪客帳號不能重設密碼）'};

let sb = null;
try{ sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {auth:{persistSession:false, autoRefreshToken:false}}); }catch(e){}
async function arpc(fn, args){ const {data, error} = await sb.rpc(fn, args); if(error) throw error; return data; }
function friendly(e){ const m = (e && (e.err || e.message)) || String(e); for(const k in ERR){ if(m.includes(k)) return ERR[k]; } if(/fetch|network/i.test(m)) return '連不上雲端，請檢查網路'; return '發生問題：' + m; }
function tok(){ try{ return sessionStorage.getItem(ATOK) || ''; }catch(e){ return ''; } }
function setTok(t, u){ try{ if(t){ sessionStorage.setItem(ATOK, t); sessionStorage.setItem(AUSER, u||''); } else { sessionStorage.removeItem(ATOK); sessionStorage.removeItem(AUSER); } }catch(e){} }
let toastT; function toast(msg){ const t=$('toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('show'), 2600); }

const p2 = n => String(n).padStart(2,'0');
function fmt(ts){ if(!ts) return '—'; const d=new Date(ts); return `${d.getMonth()+1}/${d.getDate()} ${p2(d.getHours())}:${p2(d.getMinutes())}`; }
function fmtS(ts){ const d=new Date(ts); return `${d.getMonth()+1}/${d.getDate()} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`; }
function pct(ok, ng){ const n=ok+ng; return n ? Math.round(ok/n*100) : null; }
function pctHTML(ok, ng){ const p=pct(ok,ng); if(p===null) return '<span class="muted">—</span>'; return `<span class="pctcell ${p>=80?'pct-good':p>=60?'pct-mid':'pct-low'}">${p}%</span> <span class="muted">(${ok}/${ok+ng})</span>`; }
function levelOf(xp){ let L=LEVELS[0]; LEVELS.forEach(l=>{ if(xp>=l.xp) L=l; }); return L; }
function certOf(badges){ const c=CERTS.slice().reverse().find(c=>(badges||[]).includes(c.badge)); return c||null; }
function csvDownload(name, rows){
  const csv='﻿'+rows.map(r=>r.map(v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"').join(',')).join('\n');
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

/* ---------- 登入與第一次設定 ---------- */
let D = null, flt = {type:'all', hideIdle:true, q:'', sort:'last', dir:-1}, sel = null, detail = null;
function header(logged){ ['adm-who','adm-refresh','adm-logout'].forEach(id=>$(id).style.display = logged ? '' : 'none'); if(logged){ let u=''; try{ u=sessionStorage.getItem(AUSER)||''; }catch(e){} $('adm-who').textContent='👤 '+u; } }
function renderLogin(mode, msg){
  header(false);
  const setup = mode==='setup';
  $('adm-root').innerHTML = `<div class="adm-card adm-login">
    <img src="assets/stk-zhuanye.png" alt="估咕貓頭鷹">
    <h3 style="text-align:center">${setup?'第一次設定後台帳號':'後台登入'}</h3>
    ${msg?`<div class="adm-note">${esc(msg)}</div>`:''}
    <form class="acct-form" onsubmit="${setup?'admSetup(event)':'admLogin(event)'}">
      ${setup?`<label>設定碼 <small>（在電腦專案資料夾的「後台設定碼-只能用一次.local.txt」裡，只能用一次）</small><input id="a-code" type="text" autocomplete="off" placeholder="GUGU-XXXXX-XXXXX-XXXXX-XXXXX" required></label>`:''}
      <label>後台帳號 ${setup?'<small>（自己取，3 到 24 個字，英文數字為佳）</small>':''}<input id="a-user" type="text" autocomplete="username" required></label>
      <label>密碼 ${setup?'<small>（至少 10 個字，請不要和其他網站相同）</small>':''}<input id="a-pw" type="password" autocomplete="${setup?'new-password':'current-password'}" required></label>
      ${setup?`<label>再輸入一次密碼<input id="a-pw2" type="password" autocomplete="new-password" required></label>`:''}
      <p class="acct-err" id="a-err"></p>
      <button class="btn b" id="a-submit" type="submit">${setup?'✨ 建立後台帳號':'🔑 登入'}</button>
    </form>
    <p class="center" style="margin-top:12px"><button class="btn sm ghost" onclick="renderLogin('${setup?'login':'setup'}')">${setup?'↩️ 已經有帳號，回登入':'第一次使用？建立後台帳號'}</button></p>
    <p class="fine center">後台只有管理者可以進入。連續輸入錯誤 5 次會鎖定 10 分鐘；登入後 12 小時自動登出。</p>
  </div>`;
  setTimeout(()=>{ const i=$(setup?'a-code':'a-user'); if(i) i.focus(); }, 50);
}
async function admLogin(e){
  e.preventDefault(); const btn=$('a-submit'), err=$('a-err'); err.textContent=''; btn.disabled=true;
  try{ const r = await arpc('kid_admin_login', {p_user:$('a-user').value, p_pw:$('a-pw').value}); if(!r.ok) throw r; setTok(r.token, r.username); await admLoad(); }
  catch(ex){ err.textContent = friendly(ex); btn.disabled=false; }
}
async function admSetup(e){
  e.preventDefault(); const btn=$('a-submit'), err=$('a-err'); err.textContent='';
  const user=$('a-user').value, pw=$('a-pw').value;
  if(pw !== $('a-pw2').value){ err.textContent='兩次輸入的密碼不一樣'; return; }
  if(pw.length < 10){ err.textContent=ERR.ADMIN_PW_LEN; return; }
  btn.disabled=true;
  try{ await arpc('kid_admin_setup', {p_code:$('a-code').value, p_user:user, p_pw:pw}); const r = await arpc('kid_admin_login', {p_user:user, p_pw:pw}); if(!r.ok) throw r; setTok(r.token, r.username); toast('後台帳號建立完成'); await admLoad(); }
  catch(ex){ err.textContent = friendly(ex); btn.disabled=false; }
}
async function admLogout(){ try{ await arpc('kid_admin_logout', {p_token: tok()}); }catch(e){} setTok(''); D=null; sel=null; detail=null; renderLogin('login'); }

/* ---------- 讀取總覽 ---------- */
async function admLoad(){
  if(!tok()){ renderLogin('login'); return; }
  header(true);
  if(!D) $('adm-root').innerHTML = '<p class="center muted" style="margin-top:40px">⏳ 讀取資料中…</p>';
  try{ D = await arpc('kid_admin_overview', {p_token: tok()}); }
  catch(ex){ if(String(ex.message||'').includes('BAD_ADMIN')){ setTok(''); renderLogin('login', ERR.BAD_ADMIN); return; } $('adm-root').innerHTML = `<div class="adm-card"><p>${esc(friendly(ex))}</p></div>`; return; }
  renderDash();
  if(sel) admDetail(sel, true);
}

/* ---------- 儀表板 ---------- */
function activeAccounts(){ return D.accounts.filter(a=>a.ev>0 || a.xp>0 || a.cards>2); }
function renderDash(){
  const A = D.accounts, named = A.filter(a=>!a.guest), guests = A.filter(a=>a.guest), act = activeAccounts();
  const ok = A.reduce((s,a)=>s+a.ok,0), ng = A.reduce((s,a)=>s+a.ng,0), ev = A.reduce((s,a)=>s+a.ev,0);
  const now = new Date(D.now).getTime(), day = 86400000;
  const in7 = A.filter(a=>a.last && now-new Date(a.last).getTime() < 7*day && (a.ev>0||a.xp>0)).length;
  const today = (D.daily.slice(-1)[0]||{});
  const todayStr = (()=>{ const d=new Date(D.now); return `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`; })();
  const certN = CERTS.map(c=>A.filter(a=>(a.badges||[]).includes(c.badge)).length);
  $('adm-root').innerHTML = `
    <div class="adm-tiles">
      <div class="adm-tile"><b>${A.length}</b><span>帳號總數</span><small>正式 ${named.length} · 訪客 ${guests.length}</small></div>
      <div class="adm-tile"><b>${act.length}</b><span>有實際遊玩的帳號</span><small>其餘只開過首頁</small></div>
      <div class="adm-tile"><b>${in7}</b><span>近 7 天活躍</span><small>今天 ${today.day===todayStr?today.players:0} 人</small></div>
      <div class="adm-tile"><b>${ev}</b><span>答題與閱讀紀錄</span><small>計分題 ${ok+ng} 題</small></div>
      <div class="adm-tile"><b>${pct(ok,ng)===null?'—':pct(ok,ng)+'%'}</b><span>整體正確率</span><small>${ok} 對 / ${ng} 錯</small></div>
      <div class="adm-tile"><b>${certN.join(' / ')}</b><span>取得認證人數</span><small>初階 / 中階 / 進階</small></div>
    </div>
    <div class="adm-card"><h3>📅 每日狀況（近 14 天有資料的日子）</h3>${dailyHTML()}</div>
    <div class="adm-card"><h3>👥 帳號列表</h3>${accountsToolsHTML()}<div class="adm-scroll" id="adm-acc"></div>
      <p class="fine">點任一列可看該帳號的錯題、各遊戲正確率與時間軸。「⚡」表示有多題在 1.5 秒內連續作答，可能是亂點，正確率僅供參考。</p></div>
    <div id="adm-detail"></div>
    <div class="adm-two">
      <div class="adm-card"><h3>🎮 各遊戲正確率</h3>${gamesHTML()}</div>
      <div class="adm-card"><h3>🌏 各世界正確率</h3>${worldsHTML()}</div>
    </div>
    <div class="adm-card"><h3>❌ 最多人答錯的題目（快問快答、真假快答、任務）</h3>${wrongHTML()}</div>
    <p class="fine center">資料時間：${fmt(D.now)} · 後台只讀取暱稱與遊玩紀錄，沒有任何個人資料。</p>`;
  renderAccounts();
}
function dailyHTML(){
  const m = {}; D.daily.forEach(d=>{ m[d.day]=Object.assign({day:d.day, guest:0, named:0}, d); }); D.newacc.forEach(d=>{ m[d.day]=Object.assign(m[d.day]||{day:d.day, players:0, ev:0, ok:0, ng:0}, {guest:d.guest, named:d.named}); });
  const rows = Object.values(m).sort((a,b)=>a.day<b.day?1:-1).slice(0,14); const maxEv = Math.max(1, ...rows.map(r=>r.ev));
  if(!rows.length) return '<p class="muted">還沒有資料。</p>';
  return `<div class="adm-scroll"><table class="adm"><tr><th>日期</th><th class="num">活躍帳號</th><th class="num">紀錄數</th><th></th><th>正確率</th><th class="num">新正式帳號</th><th class="num">新訪客</th></tr>
    ${rows.map(r=>`<tr><td>${r.day}</td><td class="num">${r.players}</td><td class="num">${r.ev}</td><td><span class="bar" style="width:${Math.round(r.ev/maxEv*160)}px"></span></td><td>${pctHTML(r.ok,r.ng)}</td><td class="num">${r.named||0}</td><td class="num">${r.guest||0}</td></tr>`).join('')}</table></div>`;
}
function accountsToolsHTML(){
  return `<div class="adm-tools">
    <select onchange="flt.type=this.value; renderAccounts()"><option value="all">全部類型</option><option value="named">只看正式帳號</option><option value="guest">只看訪客</option></select>
    <label><input type="checkbox" ${flt.hideIdle?'checked':''} onchange="flt.hideIdle=this.checked; renderAccounts()"> 隱藏只開過首頁的帳號</label>
    <input type="search" placeholder="搜尋暱稱" oninput="flt.q=this.value.trim(); renderAccounts()">
    <button class="btn sm ghost" onclick="exportAccounts()">⬇️ 匯出帳號 CSV</button></div>`;
}
const COLS = [['nickname','暱稱'],['guest','類型'],['xp','XP',1],['level','等級'],['tier','階層'],['cert','認證'],['nb','徽章',1],['cards','知識卡',1],['missions','任務',1],['ev','紀錄',1],['acc','正確率'],['created','建立'],['last','最後活動']];
function sortVal(a, k){ if(k==='nb') return (a.badges||[]).length; if(k==='acc'){ const p=pct(a.ok,a.ng); return p===null?-1:p; } if(k==='level') return a.xp; if(k==='cert'){ const c=certOf(a.badges); return c?CERTS.indexOf(c)+1:0; } if(k==='tier') return ['basic','mid','adv'].indexOf(a.tier); if(k==='created'||k==='last') return a[k]?new Date(a[k]).getTime():0; if(k==='guest') return a.guest?1:0; return a[k]; }
function setSort(k){ if(flt.sort===k) flt.dir=-flt.dir; else { flt.sort=k; flt.dir = (k==='nickname')?1:-1; } renderAccounts(); }
function filtered(){
  let L = D.accounts.slice();
  if(flt.type==='named') L=L.filter(a=>!a.guest); if(flt.type==='guest') L=L.filter(a=>a.guest);
  if(flt.hideIdle) L=L.filter(a=>a.ev>0 || a.xp>0 || a.cards>2 || !a.guest);
  if(flt.q) L=L.filter(a=>a.nickname.toLowerCase().includes(flt.q.toLowerCase()));
  L.sort((x,y)=>{ const a=sortVal(x,flt.sort), b=sortVal(y,flt.sort); return (a>b?1:a<b?-1:0)*flt.dir; });
  return L;
}
function renderAccounts(){
  const L = filtered();
  $('adm-acc').innerHTML = `<table class="adm"><tr>${COLS.map(c=>`<th class="sortable ${c[2]?'num':''}" onclick="setSort('${c[0]}')">${c[1]}${flt.sort===c[0]?(flt.dir>0?' ▲':' ▼'):''}</th>`).join('')}</tr>
    ${L.map(a=>{ const lv=levelOf(a.xp), c=certOf(a.badges); return `<tr class="row ${sel===a.id?'sel':''}" onclick="admDetail('${a.id}')">
      <td><b>${esc(a.nickname)}</b>${a.fast>=5?` <span class="tag warn" title="有 ${a.fast} 題在 1.5 秒內連續作答">⚡ ${a.fast}</span>`:''}</td>
      <td><span class="tag ${a.guest?'guest':'named'}">${a.guest?'訪客':'正式'}</span></td>
      <td class="num">${a.xp}</td><td>${lv.ico} ${lv.name}</td><td>${TIER_NAMES[a.tier]||a.tier}</td>
      <td>${c?`<span class="tag cert">${c.ico} ${c.name}</span>`:'<span class="muted">—</span>'}</td>
      <td class="num">${(a.badges||[]).length}</td><td class="num">${a.cards}</td><td class="num">${a.missions}</td><td class="num">${a.ev}</td>
      <td>${pctHTML(a.ok,a.ng)}</td><td>${fmt(a.created)}</td><td>${fmt(a.last)}</td></tr>`; }).join('') || `<tr><td colspan="${COLS.length}" class="muted">沒有符合條件的帳號</td></tr>`}</table>
    <p class="fine">顯示 ${L.length} / ${D.accounts.length} 個帳號</p>`;
}
function exportAccounts(){
  const rows=[['暱稱','類型','XP','等級','階層','認證','徽章數','知識卡','任務','紀錄數','答對','答錯','正確率%','快速連點題數','建立','最後活動']];
  filtered().forEach(a=>{ const c=certOf(a.badges); rows.push([a.nickname, a.guest?'訪客':'正式', a.xp, levelOf(a.xp).name, (TIER_NAMES[a.tier]||a.tier).replace(/^\S+\s/,''), c?c.name:'', (a.badges||[]).length, a.cards, a.missions, a.ev, a.ok, a.ng, pct(a.ok,a.ng)===null?'':pct(a.ok,a.ng), a.fast, a.created?new Date(a.created).toLocaleString('zh-TW'):'', a.last?new Date(a.last).toLocaleString('zh-TW'):'']); });
  csvDownload(`帳號總覽_${new Date().toISOString().slice(0,10)}.csv`, rows);
}
function gamesHTML(){
  const m={}; D.games.forEach(g=>{ if(!SCORED.includes(g.game)) return; const k=g.game+'|'+g.tier; m[k]=g; });
  const rows = Object.values(m).sort((a,b)=> SCORED.indexOf(a.game)-SCORED.indexOf(b.game) || ['basic','mid','adv'].indexOf(a.tier)-['basic','mid','adv'].indexOf(b.tier));
  const other = D.games.filter(g=>!SCORED.includes(g.game));
  const cards = other.filter(g=>g.game==='card').reduce((s,g)=>s+g.n,0);
  if(!rows.length) return '<p class="muted">還沒有資料。</p>';
  return `<div class="adm-scroll"><table class="adm"><tr><th>遊戲</th><th>階層</th><th class="num">題數</th><th class="num">人數</th><th>正確率</th></tr>
    ${rows.map(g=>`<tr><td>${GAME_NAMES[g.game]||esc(g.game)}</td><td>${TIER_NAMES[g.tier]||esc(g.tier)}</td><td class="num">${g.ok+g.ng}</td><td class="num">${g.players}</td><td>${pctHTML(g.ok,g.ng)}</td></tr>`).join('')}</table></div>
    <p class="fine">另有知識卡閱讀紀錄 ${cards} 筆。</p>`;
}
function worldsHTML(){
  const rows = WORLDS.map(w=>{ const d=D.worlds.find(x=>x.world===w.id)||{ok:0,ng:0}; return {w, ok:d.ok, ng:d.ng}; }).filter(r=>r.ok+r.ng>0);
  if(!rows.length) return '<p class="muted">還沒有帶世界標籤的作答（只有快問快答會標註世界）。</p>';
  return `<table class="adm"><tr><th>世界</th><th class="num">題數</th><th>正確率</th></tr>${rows.map(r=>`<tr><td>${r.w.name}</td><td class="num">${r.ok+r.ng}</td><td>${pctHTML(r.ok,r.ng)}</td></tr>`).join('')}</table>`;
}
function wrongHTML(){
  if(!D.wrong.length) return '<p class="muted">目前沒有答錯紀錄。</p>';
  return `<div class="adm-scroll"><table class="adm"><tr><th>遊戲</th><th>階層</th><th>題目</th><th>正解</th><th class="num">答錯</th><th class="num">作答</th><th class="num">人數</th></tr>
    ${D.wrong.slice(0,40).map(w=>`<tr><td>${GAME_NAMES[w.game]||esc(w.game)}</td><td>${TIER_NAMES[w.tier]||esc(w.tier)}</td><td class="q">${esc(w.question)}</td><td>${esc(w.correct||'')}</td><td class="num"><b class="pct-low">${w.ng}</b></td><td class="num">${w.n}</td><td class="num">${w.players}</td></tr>`).join('')}</table></div>`;
}

/* ---------- 單一帳號 ---------- */
async function admDetail(id, keep){
  sel = id; renderAccounts();
  const box = $('adm-detail'); const a = D.accounts.find(x=>x.id===id); if(!a){ box.innerHTML=''; return; }
  if(!keep) box.innerHTML = '<div class="adm-card"><p class="muted">⏳ 讀取帳號紀錄…</p></div>';
  try{ detail = await arpc('kid_admin_events', {p_token: tok(), p_account: id, p_limit: 2000}); }
  catch(ex){ if(String(ex.message||'').includes('BAD_ADMIN')){ setTok(''); renderLogin('login', ERR.BAD_ADMIN); return; } box.innerHTML = `<div class="adm-card"><p>${esc(friendly(ex))}</p></div>`; return; }
  const E = detail.events || [], P = detail.progress || {};
  const sc = E.filter(e=>SCORED.includes(e.game) && typeof e.ok==='boolean');
  const byGame = {}; sc.forEach(e=>{ const k=e.game+'|'+((e.extra&&e.extra.tier)||'basic'); byGame[k]=byGame[k]||{game:e.game, tier:(e.extra&&e.extra.tier)||'basic', ok:0, ng:0}; byGame[k][e.ok?'ok':'ng']++; });
  const wrong = E.filter(e=>e.ok===false);
  const asc = sc.slice().sort((x,y)=>new Date(x.ts)-new Date(y.ts)); let fast=0; for(let i=1;i<asc.length;i++){ if(new Date(asc[i].ts)-new Date(asc[i-1].ts) < 1500) fast++; }
  const lv = levelOf(a.xp), c = certOf(a.badges);
  const best = [['練習最佳', P.quizBest, '/10'], ['挑戰最佳', P.chalBest, '/15'], ['真假快答', P.tfBest, ' 題'], ['比價連勝', P.priceStreakBest, ''], ['找鄰居', P.compCorrect, ' 題'], ['猜價 3 星', P.est3, ' 次']].filter(b=>b[1]!=null);
  box.innerHTML = `<div class="adm-card">
    <h3>🔎 ${esc(a.nickname)} <span class="tag ${a.guest?'guest':'named'}">${a.guest?'訪客':'正式'}</span> ${c?`<span class="tag cert">${c.ico} ${c.name}</span>`:''}</h3>
    <p>${lv.ico} ${lv.name} · ${a.xp} XP · ${TIER_NAMES[a.tier]||''} · 徽章 ${(a.badges||[]).length} / ${BADGES.length} · 知識卡 ${a.cards} / ${CARDS.length} · 任務 ${a.missions} / ${MISSIONS.length} · 建立 ${fmt(a.created)} · 最後活動 ${fmt(a.last)}</p>
    ${best.length?`<p class="muted">初階最佳紀錄：${best.map(b=>`${b[0]} ${b[1]}${b[2]}`).join(' · ')}</p>`:''}
    ${fast>=5?`<div class="adm-note">⚡ 有 <b>${fast}</b> 題是在前一題之後 1.5 秒內作答，可能是快速亂點（常見於想刷過關卡時）。這些題目的對錯不代表真實理解程度。</div>`:''}
    <div class="adm-two">
      <div><h4>各遊戲正確率</h4>${Object.values(byGame).length?`<table class="adm"><tr><th>遊戲</th><th>階層</th><th>正確率</th></tr>${Object.values(byGame).sort((x,y)=>SCORED.indexOf(x.game)-SCORED.indexOf(y.game)).map(g=>`<tr><td>${GAME_NAMES[g.game]}</td><td>${TIER_NAMES[g.tier]||''}</td><td>${pctHTML(g.ok,g.ng)}</td></tr>`).join('')}</table>`:'<p class="muted">還沒有計分題紀錄。逐題紀錄從 11/9 起才開始累積。</p>'}</div>
      <div><h4>管理</h4>
        <p><button class="btn sm b" onclick="exportDetail()">⬇️ 匯出這個帳號的紀錄 CSV</button></p>
        ${a.guest?'<p class="muted">訪客帳號沒有密碼，孩子可在網站右上角自行設定暱稱與密碼。</p>':`<div class="adm-inline"><input id="rp-pw" type="text" autocomplete="off" placeholder="幫他設定新密碼（至少 6 字）"><button class="btn sm ghost" onclick="admResetPw('${a.id}')">🔁 重設密碼</button></div><p class="fine">孩子忘記密碼時使用。重設後請把新密碼告訴他。</p>`}
      </div>
    </div>
    <h4>❌ 答錯的題目（${wrong.length}）</h4>
    ${wrong.length?`<div class="adm-scroll" style="max-height:340px;overflow-y:auto"><table class="adm"><tr><th>時間</th><th>遊戲</th><th>題目</th><th>他選</th><th>正解</th></tr>${wrong.slice(0,300).map(e=>`<tr><td>${fmtS(e.ts)}</td><td>${GAME_NAMES[e.game]||esc(e.game)}</td><td class="q">${esc(e.question||'')}</td><td class="pct-low">${esc(e.chosen||'')}</td><td class="pct-good">${esc(e.correct||'')}</td></tr>`).join('')}</table></div>`:'<p class="muted">沒有答錯紀錄。</p>'}
    <h4>🕒 最近紀錄（${E.length}）</h4>
    ${E.length?`<div class="adm-scroll" style="max-height:340px;overflow-y:auto"><table class="adm"><tr><th>時間</th><th>遊戲</th><th>階層</th><th>內容</th><th>結果</th></tr>${E.slice(0,400).map(e=>`<tr><td>${fmtS(e.ts)}</td><td>${GAME_NAMES[e.game]||esc(e.game)}</td><td>${TIER_NAMES[(e.extra&&e.extra.tier)||'basic']||''}</td><td class="q">${esc((e.question||'').slice(0,90))}${e.chosen?` → ${esc(e.chosen)}`:''}</td><td>${e.ok===true?'✅':e.ok===false?'❌':''}${e.extra&&e.extra.stars!=null?' '+'⭐'.repeat(e.extra.stars):''}${e.extra&&e.extra.score!=null?` ${e.extra.score}/${e.extra.n}`:''}</td></tr>`).join('')}</table></div>`:'<p class="muted">這個帳號還沒有逐題紀錄。</p>'}
  </div>`;
  if(!keep) box.scrollIntoView({behavior:'smooth', block:'start'});
}
function exportDetail(){
  if(!detail) return; const a = D.accounts.find(x=>x.id===sel);
  const rows=[['時間','遊戲','階層','世界','題目','作答','正解','結果','其他']];
  (detail.events||[]).forEach(e=>rows.push([new Date(e.ts).toLocaleString('zh-TW'), GAME_NAMES[e.game]||e.game, (e.extra&&e.extra.tier)||'basic', e.world?((WORLDS.find(w=>w.id===e.world)||{}).name||e.world):'', e.question||'', e.chosen||'', e.correct||'', e.ok===true?'對':e.ok===false?'錯':'', e.extra?JSON.stringify(e.extra):'']));
  csvDownload(`答題紀錄_${a?a.nickname:'帳號'}_${new Date().toISOString().slice(0,10)}.csv`, rows);
}
async function admResetPw(id){
  const pw = $('rp-pw').value; if(pw.length<6){ toast(ERR.PW_LEN); return; }
  try{ await arpc('kid_admin_reset_pw', {p_token: tok(), p_account: id, p_pw: pw}); $('rp-pw').value=''; toast('密碼已重設，請把新密碼告訴孩子'); }
  catch(ex){ toast(friendly(ex)); }
}

/* ---------- 啟動 ---------- */
if(!sb){ $('adm-root').innerHTML = '<div class="adm-card"><p>無法載入雲端元件，請檢查網路後重新整理。</p></div>'; }
else admLoad();
