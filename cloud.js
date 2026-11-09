/* ============================================================
   小小估價師大冒險 — 雲端帳號與跨裝置同步（Supabase）
   登入方式：暱稱 + 密碼，不需要 email。
   帳號、密碼雜湊、登入 token 與進度都放在 Supabase 資料庫，
   前端只透過 kid_signup / kid_login / kid_load / kid_save / kid_logout
   這幾個資料庫函式存取（資料表本身有 RLS，前端不能直接讀寫）。
   ============================================================ */

const SUPABASE_URL = 'https://vbqglkkkvsnuobbbysfk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_wZl0mw0Hn18udcHJOFHg4w_BMkWvyrw'; // publishable key，可公開
const TOKEN_KEY = 'kid-appraiser-token';
const LOGOUT_KEY = 'kid-appraiser-loggedout';

let sb = null, cloudUser = null, pushTimer = null, cloudStatus = 'off';

function validNick(nick){
  nick = nick.trim();
  if(nick.length<2) return '暱稱至少 2 個字';
  if(nick.length>12) return '暱稱最多 12 個字';
  if(/\s/.test(nick)) return '暱稱不能有空白';
  return '';
}
const ERR_MAP = {
  NICK_LEN:'暱稱要 2 到 12 個字', NICK_SPACE:'暱稱不能有空白', PW_LEN:'密碼至少 6 個字',
  NICK_TAKEN:'這個暱稱已經有人用了，換一個或直接登入', NICK_RESERVED:'「訪客-」開頭是保留給系統的，請換一個暱稱', BAD_LOGIN:'暱稱或密碼不對，再試一次', BAD_TOKEN:'登入已過期，請重新登入',
};
function friendly(err){
  const m = (err && err.message) || String(err);
  for(const k in ERR_MAP){ if(m.includes(k)) return ERR_MAP[k]; }
  if(/Failed to fetch|NetworkError|network/i.test(m)) return '連不上雲端，請檢查網路';
  return '發生問題：' + m;
}
function getToken(){ try{ return localStorage.getItem(TOKEN_KEY) || ''; }catch(e){ return ''; } }
function setToken(t){ try{ t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); }catch(e){} }

/* 狀態顯示 */
function setCloudStatus(st, msg){
  cloudStatus = st;
  const el = $('acct-btn'); if(!el) return;
  const icons = {off:'👤 登入', syncing:'⏳ 同步中', ok:'☁️ 已同步', err:'⚠️ 同步失敗', offline:'📴 離線'};
  el.innerHTML = cloudUser ? `<span class="acct-nick">${cloudUser.guest?'👤 ':''}${esc(cloudUser.nickname)}</span><span class="acct-st st-${st}">${cloudUser.guest&&st==='ok'?'☁️ 訪客 · 點我設暱稱':(icons[st]||'')}</span>` : `<span>${icons.off}</span>`;
  el.title = msg || '';
  const m = $('acct-sync-msg'); if(m) m.textContent = msg || '';
}

/* 合併本機與雲端進度：取「比較多」的那一邊 */
function mergeProgress(remote, local){
  const out = Object.assign({}, local);
  if(!remote || !Object.keys(remote).length) return out;
  const nums = ['xp','quizBest','chalBest','priceStreakBest','compCorrect','est3','estPlayed','tfBest','matchDone','plays','priceStreak'];
  nums.forEach(k=>{ out[k] = Math.max(Number(local[k])||0, Number(remote[k])||0); });
  out.matchBestMoves = [local.matchBestMoves, remote.matchBestMoves].filter(v=>v>0).sort((a,b)=>a-b)[0] || 0;
  ['read','badges'].forEach(k=>{ out[k] = Array.from(new Set([...(local[k]||[]), ...(remote[k]||[])])); });
  ['city','missions'].forEach(k=>{ const o = Object.assign({}, remote[k]||{}); Object.entries(local[k]||{}).forEach(([key,v])=>{ o[key] = Math.max(Number(o[key])||0, Number(v)||0); }); out[k]=o; });
  out.unlocked = {mid:!!((local.unlocked||{}).mid||(remote.unlocked||{}).mid), adv:!!((local.unlocked||{}).adv||(remote.unlocked||{}).adv)};
  out.t = {}; ['mid','adv'].forEach(tr=>{ const L=(local.t||{})[tr]||{}, R=(remote.t||{})[tr]||{}; const o={}; new Set([...Object.keys(L),...Object.keys(R)]).forEach(k=>{ o[k]=Math.max(Number(L[k])||0, Number(R[k])||0); }); out.t[tr]=o; });
  out.tier = local.tier || remote.tier || 'basic';
  out.name = local.name || remote.name || '';
  out.sound = local.sound !== undefined ? local.sound : remote.sound;
  return out;
}

async function rpc(fn, args){
  const {data, error} = await sb.rpc(fn, args);
  if(error) throw error;
  return data;
}

/* 下載並合併 */
async function cloudPull(){
  if(!sb || !cloudUser) return;
  setCloudStatus('syncing','正在下載雲端進度…');
  let res;
  try{ res = await rpc('kid_load', {p_token: getToken()}); }
  catch(err){
    if(String(err.message).includes('BAD_TOKEN')){ cloudUser=null; setToken(''); setCloudStatus('off'); toast('登入已過期，請重新登入'); return; }
    setCloudStatus('err', friendly(err)); return;
  }
  const merged = mergeProgress(res.data, S);
  const changed = JSON.stringify(merged) !== JSON.stringify(S);
  S = merged;
  if(!S.name && !res.guest && !/^訪客-/.test(res.nickname)) S.name = res.nickname;
  try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){}
  refreshMeta();
  if($('page-badges').classList.contains('show')) renderBadges();
  if($('page-learn').classList.contains('show')) renderCards();
  if($('page-home').classList.contains('show')) renderHome();
  if($('page-cert').classList.contains('show')) renderCert();
  if($('page-games').classList.contains('show')) renderGames();
  await cloudPushNow();
  cloudFlushLog();
  if(changed) toast('☁️ 已合併雲端進度', 'xp');
}

/* 上傳（防抖動） */
function cloudPush(){
  if(!sb || !cloudUser) return;
  clearTimeout(pushTimer);
  setCloudStatus('syncing','等待上傳…');
  pushTimer = setTimeout(cloudPushNow, 1500);
}
async function cloudPushNow(){
  if(!sb || !cloudUser) return;
  clearTimeout(pushTimer); pushTimer=null;
  try{ await rpc('kid_save', {p_token: getToken(), p_data: S}); setCloudStatus('ok', '進度已同步到雲端 '+new Date().toLocaleTimeString()); }
  catch(err){ setCloudStatus('err', friendly(err)); console.warn(err); }
}

/* 逐題紀錄上傳 / 下載 */
let flushTimer=null, flushing=false;
function cloudQueueFlush(){ if(!sb||!cloudUser) return; clearTimeout(flushTimer); flushTimer=setTimeout(cloudFlushLog, 2500); }
async function cloudFlushLog(){
  if(!sb||!cloudUser||flushing) return; const pend=LOG.filter(e=>e.p); if(!pend.length) return;
  flushing=true; clearTimeout(flushTimer);
  try{
    const batch=pend.slice(0,200);
    await rpc('kid_log', {p_token:getToken(), p_events: batch.map(e=>({t:e.t, game:e.game, world:e.world||null, question:e.question||null, chosen:e.chosen||null, correct:e.correct||null, ok:(typeof e.ok==='boolean'?e.ok:null), extra:e.extra||{}}))});
    const done=new Set(batch); LOG=LOG.filter(e=>!done.has(e)); logSave();
    if(pend.length>batch.length) setTimeout(cloudFlushLog, 300);
  }catch(err){ console.warn('log flush failed', err); }
  finally{ flushing=false; }
}
async function cloudEvents(limit){ if(!sb||!cloudUser) return null; try{ return await rpc('kid_events_list', {p_token:getToken(), p_limit:limit||1000}); }catch(e){ console.warn(e); return null; } }

/* 註冊 / 登入 / 登出 */
async function afterAuth(res){
  try{ localStorage.removeItem(LOGOUT_KEY); }catch(e){}
  setToken(res.token); cloudUser = {id:res.id, nickname:res.nickname, guest:!!res.guest};
  if(!S.name){ S.name = res.nickname; try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){} }
  await cloudPull();
  toast(`☁️ 嗨，${res.nickname}！進度已連上雲端`, 'level');
}
async function cloudGuest(){
  if(!sb || cloudUser) return;
  try{ const res = await rpc('kid_guest', {}); setToken(res.token); cloudUser={id:res.id, nickname:res.nickname, guest:true}; try{ localStorage.removeItem(LOGOUT_KEY); }catch(e){} await cloudPull(); }
  catch(err){ console.warn('guest create failed', err); setCloudStatus('off'); }
}
async function cloudClaim(nick, pw){
  const err = validNick(nick); if(err) throw new Error(err);
  if(pw.length<6) throw new Error('密碼至少 6 個字');
  let res; try{ res = await rpc('kid_claim', {p_token:getToken(), p_nick:nick.trim(), p_pw:pw}); }catch(e){ throw new Error(friendly(e)); }
  cloudUser = {id:res.id, nickname:res.nickname, guest:false};
  if(!S.name || /^訪客-/.test(S.name)){ S.name = res.nickname; }
  save(); await cloudPushNow(); setCloudStatus('ok','帳號已建立');
  toast(`🎉 太好了，${res.nickname}！以後用這個暱稱和密碼就能在任何裝置繼續`, 'level');
}
async function cloudSignUp(nick, pw){
  const err = validNick(nick); if(err) throw new Error(err);
  if(pw.length<6) throw new Error('密碼至少 6 個字');
  let res; try{ res = await rpc('kid_signup', {p_nick: nick.trim(), p_pw: pw}); }catch(e){ throw new Error(friendly(e)); }
  await afterAuth(res);
}
async function cloudSignIn(nick, pw){
  const err = validNick(nick); if(err) throw new Error(err);
  let res; try{ res = await rpc('kid_login', {p_nick: nick.trim(), p_pw: pw}); }catch(e){ throw new Error(friendly(e)); }
  await afterAuth(res);
}
async function cloudSignOut(clearLocal){
  if(sb && cloudUser){ clearTimeout(pushTimer); await cloudPushNow(); await cloudFlushLog(); try{ await rpc('kid_logout', {p_token: getToken()}); }catch(e){} }
  cloudUser = null; setToken(''); try{ localStorage.setItem(LOGOUT_KEY,'1'); }catch(e){}
  if(clearLocal){ try{ localStorage.removeItem(KEY); }catch(e){} S = load(); refreshMeta(); go('home'); }
  setCloudStatus('off');
  toast('已登出');
}

/* 登入視窗 */
let acctTab = 'login';
function openAcct(){ if(cloudUser && cloudUser.guest) acctTab='claim'; $('acct-modal').classList.add('show'); renderAcct(); }
function closeAcct(){ $('acct-modal').classList.remove('show'); }
function setAcctTab(t){ acctTab = t; renderAcct(); }
function renderAcct(){
  const box = $('acct-body');
  if(!sb){ box.innerHTML = `<p class="center muted">雲端功能目前無法使用（可能沒有網路）。你的進度仍會存在這台裝置上。</p>`; return; }
  if(cloudUser && cloudUser.guest && acctTab!=='login'){
    box.innerHTML = `
      <div class="acct-hello">👋 你現在是訪客 <b>${esc(cloudUser.nickname)}</b></div>
      <p class="center muted" id="acct-sync-msg"></p>
      <p class="center">進度和答題紀錄已經自動存到雲端，但只有這台裝置認得你。<b>設定暱稱和密碼</b>之後，換電腦、平板或手機都能接著玩，進度不會丟。</p>
      <form onsubmit="acctClaim(event)" class="acct-form">
        <label>我的暱稱 <small>（2–12 個字，可以用中文）</small><input id="acct-nick" type="text" maxlength="12" autocomplete="username" placeholder="例如：小明" required></label>
        <label>我的密碼 <small>（至少 6 個字）</small><input id="acct-pw" type="password" minlength="6" autocomplete="new-password" placeholder="••••••" required></label>
        <label class="chk"><input type="checkbox" id="acct-ok" required> 我記住暱稱和密碼了（忘記的話要請老師幫忙）</label>
        <p class="acct-err" id="acct-err"></p>
        <button class="btn g" id="acct-submit" type="submit">✨ 設定暱稱與密碼</button>
      </form>
      <hr>
      <p class="center"><button class="btn ghost sm" onclick="setAcctTab('login')">我已經有帳號了，改用登入</button> <button class="btn ghost sm" onclick="closeAcct(); go('records')">📒 看答題紀錄</button></p>
      <p class="fine center">用已有帳號登入後，這台裝置上的進度會合併到那個帳號。</p>`;
    setCloudStatus(cloudStatus);
    setTimeout(()=>{ const i=$('acct-nick'); if(i) i.focus(); }, 50);
    return;
  }
  if(cloudUser && !cloudUser.guest){
    box.innerHTML = `
      <div class="acct-hello">👋 嗨，<b>${esc(cloudUser.nickname)}</b>！</div>
      <p class="center muted" id="acct-sync-msg"></p>
      <p class="center">你的進度會自動同步到雲端。在別台電腦、平板或手機用同樣的暱稱和密碼登入，就能接著玩！</p>
      <p class="center"><button class="btn b sm" onclick="cloudPull()">🔄 立刻同步</button> <button class="btn sm ghost" onclick="closeAcct(); go('records')">📒 看答題紀錄</button></p>
      <hr>
      <p class="center"><button class="btn ghost sm" onclick="cloudSignOut(false); closeAcct()">登出（保留這台的進度）</button>
      <button class="btn ghost sm" onclick="cloudSignOut(true); closeAcct()">登出並清除這台的進度</button></p>
      <p class="fine center">在學校共用電腦時，請選「登出並清除」，下一位同學才不會接到你的進度。</p>`;
    setCloudStatus(cloudStatus);
    return;
  }
  box.innerHTML = `
    <div class="acct-tabs"><button class="${acctTab==='login'?'on':''}" onclick="setAcctTab('login')">登入</button><button class="${acctTab==='signup'?'on':''}" onclick="setAcctTab('signup')">建立新帳號</button></div>
    <form onsubmit="acctSubmit(event)" class="acct-form">
      <label>暱稱 <small>（2–12 個字，可以用中文，不需要 email）</small><input id="acct-nick" type="text" maxlength="12" autocomplete="username" placeholder="例如：小明" required></label>
      <label>密碼 <small>（至少 6 個字）</small><input id="acct-pw" type="password" minlength="6" autocomplete="${acctTab==='login'?'current-password':'new-password'}" placeholder="••••••" required></label>
      ${acctTab==='signup'?'<label class="chk"><input type="checkbox" id="acct-ok" required> 我記住暱稱和密碼了（忘記的話要請老師幫忙）</label>':''}
      <p class="acct-err" id="acct-err"></p>
      <button class="btn ${acctTab==='login'?'b':'g'}" id="acct-submit" type="submit">${acctTab==='login'?'🔑 登入':'✨ 建立帳號並登入'}</button>
    </form>
    <p class="fine center">登入後，這台裝置上已經有的進度會和雲端進度合併，不會不見。</p>${cloudUser&&cloudUser.guest?'<p class="center"><button class="btn ghost sm" onclick="setAcctTab(\'claim\')">↩️ 回到訪客設定</button></p>':''}`;
  setTimeout(()=>{ const i=$('acct-nick'); if(i) i.focus(); }, 50);
}
async function acctClaim(e){
  e.preventDefault();
  const nick=$('acct-nick').value, pw=$('acct-pw').value, errEl=$('acct-err'), btn=$('acct-submit');
  errEl.textContent=''; btn.disabled=true; btn.textContent='請稍等…';
  try{ await cloudClaim(nick, pw); sfx.ok(); closeAcct(); celebrate('ganxie', `歡迎，${cloudUser.nickname}！帳號建立完成`); }
  catch(err){ errEl.textContent=err.message; sfx.bad(); if($('acct-submit')){ btn.disabled=false; btn.textContent='✨ 設定暱稱與密碼'; } }
}
async function acctSubmit(e){
  e.preventDefault();
  const nick = $('acct-nick').value, pw = $('acct-pw').value, errEl = $('acct-err'), btn = $('acct-submit');
  errEl.textContent=''; btn.disabled = true; btn.textContent = '請稍等…';
  try{
    if(acctTab==='signup') await cloudSignUp(nick, pw); else await cloudSignIn(nick, pw);
    sfx.ok(); closeAcct();
  }catch(err){ errEl.textContent = err.message; sfx.bad(); }
  finally{ if($('acct-submit')){ btn.disabled=false; btn.textContent = acctTab==='login'?'🔑 登入':'✨ 建立帳號並登入'; } }
}

/* 初始化 */
(function initCloud(){
  const btn = $('acct-btn');
  if(btn) btn.onclick = openAcct;
  if(typeof supabase === 'undefined' || !supabase.createClient){ setCloudStatus('offline','無法載入雲端元件'); return; }
  sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {auth:{persistSession:false, autoRefreshToken:false}});
  setCloudStatus('off');
  const tok = getToken();
  if(tok){
    setCloudStatus('syncing','正在恢復登入…');
    rpc('kid_load', {p_token: tok}).then(res=>{ cloudUser={id:res.id, nickname:res.nickname, guest:!!res.guest}; return cloudPull(); })
      .catch(err=>{ if(String(err.message).includes('BAD_TOKEN')){ setToken(''); cloudUser=null; setCloudStatus('off'); cloudGuest(); } else { cloudUser=null; setCloudStatus('off'); } });
  } else {
    let lo=false; try{ lo=!!localStorage.getItem(LOGOUT_KEY); }catch(e){}
    if(!lo) cloudGuest();
  }
  document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='visible' && cloudUser && cloudStatus!=='syncing') cloudPull(); });
  window.addEventListener('beforeunload', ()=>{
    if(!sb || !cloudUser || !navigator.sendBeacon) return;
    if(pushTimer){ clearTimeout(pushTimer); navigator.sendBeacon(`${SUPABASE_URL}/rest/v1/rpc/kid_save?apikey=${SUPABASE_KEY}`, new Blob([JSON.stringify({p_token:getToken(), p_data:S})],{type:'application/json'})); }
    const pend=LOG.filter(e=>e.p).slice(0,200);
    if(pend.length){ const okb=navigator.sendBeacon(`${SUPABASE_URL}/rest/v1/rpc/kid_log?apikey=${SUPABASE_KEY}`, new Blob([JSON.stringify({p_token:getToken(), p_events:pend.map(e=>({t:e.t, game:e.game, world:e.world||null, question:e.question||null, chosen:e.chosen||null, correct:e.correct||null, ok:(typeof e.ok==='boolean'?e.ok:null), extra:e.extra||{}}))})],{type:'application/json'})); if(okb){ const d=new Set(pend); LOG=LOG.filter(e=>!d.has(e)); logSave(); } }
  });
})();
