/* ============================================================
   小小估價師大冒險 — 雲端帳號與跨裝置同步（Supabase）
   登入方式：暱稱 + 密碼（小朋友不需要 email）。
   暱稱會被轉成一個假的 email 給 Supabase Auth 使用。
   ============================================================ */

const SUPABASE_URL = 'https://vbqglkkkvsnuobbbysfk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_wZl0mw0Hn18udcHJOFHg4w_BMkWvyrw'; // publishable key，可公開
const NICK_DOMAIN = 'kids.little-appraiser.app';

let sb = null, cloudUser = null, pushTimer = null, cloudStatus = 'off';

function cloudReady(){ return !!sb; }

/* 暱稱 ↔ 假 email */
function nickToEmail(nick){
  nick = nick.trim();
  if(nick.includes('@')) return nick.toLowerCase();
  const hex = Array.from(new TextEncoder().encode(nick.toLowerCase())).map(b=>b.toString(16).padStart(2,'0')).join('');
  return `u-${hex}@${NICK_DOMAIN}`;
}
function validNick(nick){
  nick = nick.trim();
  if(nick.includes('@')) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nick) ? '' : 'email 格式不對';
  if(nick.length<2) return '暱稱至少 2 個字';
  if(nick.length>12) return '暱稱最多 12 個字';
  if(/\s/.test(nick)) return '暱稱不能有空白';
  return '';
}

/* 狀態顯示 */
function setCloudStatus(st, msg){
  cloudStatus = st;
  const el = $('acct-btn'); if(!el) return;
  const icons = {off:'👤 登入', syncing:'⏳ 同步中', ok:'☁️ 已同步', err:'⚠️ 同步失敗', offline:'📴 離線'};
  const nick = cloudUser ? (cloudUser.user_metadata?.nickname || cloudUser.email) : '';
  el.innerHTML = cloudUser ? `<span class="acct-nick">${esc(nick)}</span><span class="acct-st st-${st}">${icons[st]||''}</span>` : `<span>${icons.off}</span>`;
  el.title = msg || '';
  const m = $('acct-sync-msg'); if(m) m.textContent = msg || '';
}

/* 合併本機與雲端進度：取「比較多」的那一邊 */
function mergeProgress(remote, local){
  const out = Object.assign({}, local);
  if(!remote) return out;
  const nums = ['xp','quizBest','chalBest','priceStreakBest','compCorrect','est3','estPlayed','tfBest','matchDone','plays'];
  nums.forEach(k=>{ out[k] = Math.max(Number(local[k])||0, Number(remote[k])||0); });
  out.priceStreak = Math.max(Number(local.priceStreak)||0, Number(remote.priceStreak)||0);
  out.matchBestMoves = [local.matchBestMoves, remote.matchBestMoves].filter(v=>v>0).sort((a,b)=>a-b)[0] || 0;
  ['read','badges'].forEach(k=>{ out[k] = Array.from(new Set([...(local[k]||[]), ...(remote[k]||[])])); });
  ['city','missions'].forEach(k=>{ const o = Object.assign({}, remote[k]||{}); Object.entries(local[k]||{}).forEach(([key,v])=>{ o[key] = Math.max(Number(o[key])||0, Number(v)||0); }); out[k]=o; });
  out.name = local.name || remote.name || '';
  out.sound = local.sound !== undefined ? local.sound : remote.sound;
  return out;
}

/* 下載並合併 */
async function cloudPull(){
  if(!sb || !cloudUser) return;
  setCloudStatus('syncing','正在下載雲端進度…');
  const {data, error} = await sb.from('progress').select('data, nickname, updated_at').eq('user_id', cloudUser.id).maybeSingle();
  if(error){ setCloudStatus('err', '下載失敗：'+error.message); return; }
  const merged = mergeProgress(data ? data.data : null, S);
  const changed = JSON.stringify(merged) !== JSON.stringify(S);
  S = merged;
  if(!S.name && cloudUser.user_metadata?.nickname) S.name = cloudUser.user_metadata.nickname;
  try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){}
  refreshMeta();
  if(typeof renderBadges==='function' && $('page-badges').classList.contains('show')) renderBadges();
  if($('page-learn').classList.contains('show')) renderCards();
  if($('page-home').classList.contains('show')) renderHome();
  if($('page-cert').classList.contains('show')) renderCert();
  await cloudPushNow();
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
  clearTimeout(pushTimer);
  const nick = cloudUser.user_metadata?.nickname || S.name || '';
  const {error} = await sb.from('progress').upsert({user_id: cloudUser.id, nickname: nick, data: S, updated_at: new Date().toISOString()});
  if(error){ setCloudStatus('err', '上傳失敗：'+error.message); console.warn(error); }
  else setCloudStatus('ok', '進度已同步到雲端 '+new Date().toLocaleTimeString());
}

/* 註冊 / 登入 / 登出 */
async function cloudSignUp(nick, pw){
  const err = validNick(nick); if(err) throw new Error(err);
  if(pw.length<6) throw new Error('密碼至少 6 個字');
  const {data, error} = await sb.auth.signUp({email: nickToEmail(nick), password: pw, options:{data:{nickname: nick.trim()}}});
  if(error){
    if(/already|registered|exists/i.test(error.message)) throw new Error('這個暱稱已經有人用了，換一個或直接登入');
    throw new Error(error.message);
  }
  if(!data.session) throw new Error('帳號已建立，但需要確認 email 才能登入（請管理員在 Supabase 關閉 Confirm email）');
  if(!S.name) { S.name = nick.trim(); save(); }
  return data.user;
}
async function cloudSignIn(nick, pw){
  const err = validNick(nick); if(err) throw new Error(err);
  const {data, error} = await sb.auth.signInWithPassword({email: nickToEmail(nick), password: pw});
  if(error){
    if(/invalid/i.test(error.message)) throw new Error('暱稱或密碼不對，再試一次');
    throw new Error(error.message);
  }
  return data.user;
}
async function cloudSignOut(clearLocal){
  if(sb){ clearTimeout(pushTimer); if(cloudUser) await cloudPushNow(); await sb.auth.signOut(); }
  cloudUser = null;
  if(clearLocal){ try{ localStorage.removeItem(KEY); }catch(e){} S = load(); save(); go('home'); }
  setCloudStatus('off');
  toast('已登出');
}

/* 登入視窗 */
let acctTab = 'login';
function openAcct(){
  const m = $('acct-modal'); m.classList.add('show');
  renderAcct();
}
function closeAcct(){ $('acct-modal').classList.remove('show'); }
function setAcctTab(t){ acctTab = t; renderAcct(); }
function renderAcct(){
  const box = $('acct-body');
  if(!sb){ box.innerHTML = `<p class="center muted">雲端功能目前無法使用（可能沒有網路）。你的進度仍會存在這台裝置上。</p>`; return; }
  if(cloudUser){
    const nick = cloudUser.user_metadata?.nickname || cloudUser.email;
    box.innerHTML = `
      <div class="acct-hello">👋 嗨，<b>${esc(nick)}</b>！</div>
      <p class="center muted" id="acct-sync-msg"></p>
      <p class="center">你的進度會自動同步到雲端。在別台電腦或手機用同樣的暱稱和密碼登入，就能接著玩！</p>
      <p class="center"><button class="btn b sm" onclick="cloudPull()">🔄 立刻同步</button></p>
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
      <label>暱稱 <small>（2–12 個字，可以用中文；大人也可以用 email）</small><input id="acct-nick" type="text" maxlength="40" autocomplete="username" placeholder="例如：小明" required></label>
      <label>密碼 <small>（至少 6 個字）</small><input id="acct-pw" type="password" minlength="6" autocomplete="${acctTab==='login'?'current-password':'new-password'}" placeholder="••••••" required></label>
      ${acctTab==='signup'?'<label class="chk"><input type="checkbox" id="acct-ok" required> 我記住暱稱和密碼了（忘記的話沒辦法找回喔）</label>':''}
      <p class="acct-err" id="acct-err"></p>
      <button class="btn ${acctTab==='login'?'b':'g'}" id="acct-submit" type="submit">${acctTab==='login'?'🔑 登入':'✨ 建立帳號並登入'}</button>
    </form>
    <p class="fine center">登入後，這台裝置上已經有的進度會和雲端進度合併，不會不見。</p>`;
  setTimeout(()=>{ const i=$('acct-nick'); if(i) i.focus(); }, 50);
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
  if(typeof supabase === 'undefined' || !supabase.createClient){ setCloudStatus('offline','無法載入雲端元件'); if(btn) btn.onclick = openAcct; return; }
  sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {auth:{persistSession:true, autoRefreshToken:true}});
  if(btn) btn.onclick = openAcct;
  sb.auth.onAuthStateChange((event, session)=>{
    const u = session ? session.user : null;
    const was = cloudUser; cloudUser = u;
    if(u && (!was || was.id!==u.id)){ setCloudStatus('syncing'); cloudPull().then(()=>{ toast(`☁️ 歡迎回來，${u.user_metadata?.nickname||''}！進度已連上雲端`, 'level'); }); }
    else if(!u){ setCloudStatus('off'); }
    if($('acct-modal') && $('acct-modal').classList.contains('show')) renderAcct();
  });
  setCloudStatus('off');
  document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='visible' && cloudUser && cloudStatus!=='syncing') cloudPull(); });
  window.addEventListener('beforeunload', ()=>{ if(pushTimer){ clearTimeout(pushTimer); cloudPushNow(); } });
})();
