'use strict';
/* 小小估價師大冒險・幼兒園版 v2
   不用識字：所有指示由估小泰用語音說出，選項全部是圖片，答錯不扣分、會提示。
   語音優先播放預先錄好的 assets/voice/*.mp3（任何裝置都能播），沒有檔案時才用瀏覽器語音。
   進度只存在這台裝置（localStorage），不登入、不上傳。 */

const HAS_DOM = typeof document !== 'undefined';
const HAS_TTS = typeof window !== 'undefined' && 'speechSynthesis' in window;
const $ = id => document.getElementById(id);
const rnd = a => a[Math.floor(Math.random() * a.length)];
const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ZH  = ['零','一','兩','三','四','五','六','七','八','九','十'];   // 數量：兩個
const ZHC = ['零','一','二','三','四','五','六','七','八','九','十'];   // 數數：一、二、三

/* ---------- 進度 ---------- */
const KEY = 'kid-appraiser-kinder';
function freshState(){ return { stars:0, stickers:[], games:{}, sound:true }; }
function loadState(){ try { return Object.assign(freshState(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch(e){ return freshState(); } }
let K = loadState();
function save(){ try { localStorage.setItem(KEY, JSON.stringify(K)); } catch(e){} }
function level(id){ const p = (K.games[id] || {}).plays || 0; return p < 2 ? 0 : p < 5 ? 1 : 2; }

/* ---------- 估小泰說的每一句話（預錄語音由這份清單產生） ---------- */
const T = {
  welcome:'嗨！我是估小泰！我們一起來玩房子的遊戲。選一個你想玩的吧！',
  homeAgain:'想玩什麼呢？選一個吧！',
  starsHave:'看！這些都是你得到的星星！', starsNone:'玩遊戲就可以拿到星星喔！',
  soundOn:'聲音打開了！',
  bookHave:'這是你的貼紙簿！按一下貼紙，聽估小泰說話。', bookNone:'玩遊戲就可以拿到估小泰貼紙喔！', bookLocked:'這張還沒拿到，去玩遊戲就可以拿到喔！',
  star3:'太厲害了！三顆星星！', star2:'好棒！兩顆星星！', star1:'完成了！你得到一顆星星！',
  gift:'按一下禮物，打開看看！', allDone:'所有貼紙都收集完了，你是最棒的小小估價師！',
  memQ:'翻開卡片，找出兩張一樣的！',
  fixQ0:'哪裡壞掉了？找找看！', fixQ1:'這間房子呢？哪裡壞掉了？', found:'找到了！',
  owlQ:'估小泰是估價師，他要去哪裡上班呢？', owlA:'答對了！估價師要去看房子，幫房子估價！',
  bigQ:'哪一間房子比較大？', smallQ:'哪一間房子比較小？', tallQ:'哪一棟房子比較高？', winQ:'哪一間房子的窗戶比較多？',
  bigA:'答對了！這間比較大！', bigA2:'大房子通常比較貴喔！', smallA:'答對了！這間比較小！',
  winCountQ:'數一數，這間房子有幾扇窗戶？',
  countNo:'不對喔，我們再數一次。', same:'一樣！找到了！', take:'拿走！', gotSticker:'你得到一張新貼紙！',
  yardFull:'院子滿了，最多放三個喔！', appraise:'估小泰來估價囉！房子越大，越值錢喔！',
};
const PRAISE = ['答對了！','好棒！','你好厲害！','沒錯，就是這個！','太棒了！'];
const TRYAGAIN = ['再試試看！','不是這個喔，再看一看。','差一點點，再找找看！'];
const tTall   = n => `答對了！這棟比較高，有${ZH[n]}層樓！`;
const tWin    = n => `答對了！這間有${ZH[n]}扇窗戶！`;
const tCountQ = (u, nm) => `數一數，有幾${u}${nm}？`;
const tCountA = n => `答對了，就是${ZHC[n]}！`;
const tJobQ   = j => `${j.job}要去哪裡上班呢？`;
const tJobA   = j => `答對了！${j.job}在${j.place}上班！`;
const tPlace  = p => `這是${p}喔！`;
const tNotBroken = n => `這是${n}，沒有壞掉喔。`;
const tPick   = n => `${n}！`;
const tWorth  = n => `你的房子值${ZH[n]}個金幣！`;

/* ---------- 聲音：預錄 mp3 → 瀏覽器語音備援 ---------- */
const VOX = (typeof window !== 'undefined' && window.KIDS_VOX) || {};
const VOXV = (typeof window !== 'undefined' && window.KIDS_VOX_V) || '1';   // 語音版本，換錄音時避免讀到舊快取
const voxURL = h => 'assets/voice/' + h + '.mp3?v=' + VOXV;
function vh(t){ const b = new TextEncoder().encode(t); let h = 0x811c9dc5; for (const x of b){ h ^= x; h = Math.imul(h, 0x01000193) >>> 0; } return ('0000000' + h.toString(16)).slice(-8); }
const AUD = HAS_DOM ? new Audio() : null; if (AUD) AUD.preload = 'auto';
let VOICE = null;
function pickVoice(){
  if (!HAS_TTS) return;
  const vs = speechSynthesis.getVoices(), tw = vs.filter(v => /zh[-_]TW/i.test(v.lang));
  VOICE = tw.find(v => /Hanhan|Yating|HsiaoChen|Mei-?Jia|Google/i.test(v.name)) || tw[0] || vs.find(v => /zh[-_](HK|Hant)/i.test(v.lang)) || vs.find(v => /^zh/i.test(v.lang)) || null;
}
if (HAS_TTS){ pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
let sayTok = 0, curFin = null;
function stopVoice(){ if (AUD){ try { AUD.pause(); } catch(e){} } if (HAS_TTS){ try { speechSynthesis.cancel(); } catch(e){} } if (curFin){ const f = curFin; curFin = null; f(); } }
function ttsOne(text){
  return new Promise(res => {
    if (!HAS_TTS){ res(); return; }
    let done = false; const fin = () => { if (!done){ done = true; res(); } }; curFin = fin;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = VOICE ? VOICE.lang : 'zh-TW'; if (VOICE) u.voice = VOICE; u.rate = 0.92; u.pitch = 1.15;
    u.onend = fin; u.onerror = fin; setTimeout(fin, 1500 + text.length * 330);
    speechSynthesis.speak(u);
  });
}
function sayOne(text){
  return new Promise(res => {
    if (!K.sound || !text){ res(); return; }
    const h = vh(text);
    if (!VOX[h] || !AUD){ if (HAS_DOM && !VOX[h]) console.warn('[語音檔缺少]', text); ttsOne(text).then(res); return; }
    let done = false; const fin = () => { if (!done){ done = true; if (curFin === fin) curFin = null; res(); } }; curFin = fin;
    AUD.onended = fin; AUD.onerror = () => { if (!done){ done = true; ttsOne(text).then(res); } };
    AUD.src = voxURL(h);
    const p = AUD.play(); if (p && p.catch) p.catch(() => { if (!done){ done = true; ttsOne(text).then(res); } });
    setTimeout(fin, VOX[h] * 1000 + 3000);
  });
}
/* 說一句或依序說好幾句；新的話會打斷舊的 */
function say(text){
  const parts = (Array.isArray(text) ? text : [text]).filter(Boolean);
  stopVoice(); const tok = ++sayTok;
  return (async () => { for (const p of parts){ if (tok !== sayTok) return; await sayOne(p); } })();
}
function prefetchVoice(list){ if (!HAS_DOM) return; let i = 0; const next = () => { const t = list[i++]; if (!t) return; const h = vh(t); if (!VOX[h]) return next(); fetch(voxURL(h)).catch(() => {}).finally(next); }; next(); next(); }
let lastPrompt = '';
function prompt(text){ lastPrompt = text; return say(text); }
function replay(){ sfx.pop(); owlJump(); say(lastPrompt); armIdle(); }

/* 太久沒動作，估小泰再說一次題目 */
let idleT = null, QLIVE = false;
function armIdle(){ clearTimeout(idleT); if (!QLIVE) return; idleT = setTimeout(() => { if (QLIVE && lastPrompt){ owlJump(); say(lastPrompt); } }, 15000); }

/* ---------- 音效（不需要音檔） ---------- */
let AC = null;
function ac(){ if (!AC){ try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){} } if (AC && AC.state === 'suspended') AC.resume(); return AC; }
function tone(f, t0, dur, type, vol, slide){
  const a = ac(); if (!a || !K.sound) return;
  const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + t0;
  o.type = type || 'triangle'; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.14, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.05);
}
const sfx = {
  pop(){ tone(520, 0, .12, 'sine', .16, 900); },
  tap(){ tone(1200, 0, .05, 'sine', .05, 1600); },
  flip(){ tone(500, 0, .1, 'triangle', .1, 800); },
  ok(){ [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * .07, .22)); },
  no(){ tone(330, 0, .25, 'sine', .12, 220); },
  coin(){ tone(988, 0, .07, 'square', .05); tone(1319, .07, .22, 'square', .05); },
  win(){ [523, 659, 784, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * .11, .26)); },
  boing(){ tone(200, 0, .25, 'sine', .14, 600); },
};

/* ---------- 彩帶與點擊星光 ---------- */
const CF = { parts:[], raf:0 };
const CFC = ['#f8c008','#0098bc','#ff6b8b','#3bb273','#9b5de5','#ff8c42'];
function cfAdd(p){ CF.parts.push(p); if (CF.parts.length > 500) CF.parts.splice(0, CF.parts.length - 500); if (!CF.raf) CF.raf = requestAnimationFrame(cfStep); }
function cfSize(){ const c = $('k-confetti'); if (c.width !== innerWidth || c.height !== innerHeight){ c.width = innerWidth; c.height = innerHeight; } }
function confetti(x, y, n){
  cfSize(); if (x == null){ x = innerWidth / 2; y = innerHeight / 3; }
  for (let i = 0; i < (n || 100); i++){ const a = Math.random() * Math.PI * 2, v = 3 + Math.random() * 8;
    cfAdd({ x, y, vx:Math.cos(a) * v, vy:Math.sin(a) * v - 5, r:6 + Math.random() * 6, c:rnd(CFC), life:80 + Math.random() * 40, rot:Math.random() * 6, star:Math.random() < .35, g:.25 }); }
}
function sparkle(x, y){ cfSize(); for (let i = 0; i < 7; i++){ const a = Math.random() * Math.PI * 2, v = 1.5 + Math.random() * 3; cfAdd({ x, y, vx:Math.cos(a) * v, vy:Math.sin(a) * v - 1, r:7 + Math.random() * 6, c:rnd(['#f8c008','#ffd6e8','#fff3a0','#9be7ff']), life:26 + Math.random() * 14, rot:0, star:true, g:.06 }); } }
function starPath(g, r){ g.beginPath(); for (let i = 0; i < 10; i++){ const rr = i % 2 ? r * .45 : r, a = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); }
function cfStep(){
  const c = $('k-confetti'), g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
  CF.parts = CF.parts.filter(p => --p.life > 0 && p.y < c.height + 30);
  for (const p of CF.parts){ p.vy += p.g; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.rot += .15;
    g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.globalAlpha = Math.min(1, p.life / 20); g.fillStyle = p.c;
    if (p.star){ starPath(g, p.r); g.fill(); } else g.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 1.6);
    g.restore(); }
  CF.raf = CF.parts.length ? requestAnimationFrame(cfStep) : 0;
}
function burst(el){ const r = el.getBoundingClientRect(); confetti(r.left + r.width / 2, r.top + r.height / 2, 40); }

/* ---------- 估小泰 ---------- */
const STICKERS = [
  ['happy','開心','我好開心！'], ['sparkle','眼睛發亮','哇！好漂亮的房子！'], ['wink','眨眼','嘿嘿，我知道答案喔！'],
  ['moved','感動','你好棒，我好感動！'], ['shy','害羞','被你稱讚，好害羞喔！'], ['smirk','有把握','這題交給我！'],
  ['smug','得意','我是厲害的估小泰！'], ['ok','沒問題','沒問題！'], ['normal','認真','我要認真看房子！'],
  ['surprised','驚訝','咦？這是什麼？'], ['shocked','嚇一跳','哇！嚇我一跳！'], ['blank','愣住','嗯，我想一想。'],
  ['sweat','尷尬','哎呀，弄錯了！'], ['worried','擔心','下雨了，屋頂會不會漏水？'], ['cry','哭哭','嗚嗚，房子壞掉了！'],
  ['skeptical','懷疑','真的嗎？我再看一看。'], ['deadpan','無言','好吧，我知道了。'], ['annoyed','不耐煩','不要一直催我啦！'],
  ['pout','生悶氣','哼！我要生氣三秒鐘！'], ['angry','生氣','不可以亂丟垃圾！'], ['sleepy','想睡','好睏喔，晚安！'],
];
function owl(k){ const el = $('k-owl'); if (!el) return; el.src = 'assets/gxt-' + k + '.png'; owlJump(); }
function owlJump(){ const el = $('k-owl'); if (!el) return; el.classList.remove('jump'); void el.offsetWidth; el.classList.add('jump'); }
function guideHTML(face){ return `<div class="k-guide"><img id="k-owl" src="assets/gxt-${face || 'normal'}.png" alt="估小泰" draggable="false" onclick="replay()"><button class="k-say" onclick="replay()" aria-label="再聽一次">🔊</button></div>`; }

/* ---------- 房子插畫 ---------- */
const WALLS = [['#ffe9a8','黃色'],['#ffc9de','粉紅色'],['#c8f5c0','綠色'],['#aee6ff','藍色'],['#e3ccff','紫色'],['#ffffff','白色']];
const ROOFS = [['#ef4b5a','紅色'],['#2f7fd1','藍色'],['#24a88f','綠色'],['#a0603a','咖啡色'],['#ff8c42','橘色'],['#8a5cd6','紫色']];
const INK = '#4a3b3b';
function shade(hex, amt){
  const n = parseInt(hex.slice(1), 16), f = v => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
  return '#' + [n >> 16, n >> 8 & 255, n & 255].map(v => ('0' + f(v).toString(16)).slice(-2)).join('');
}
let SVGID = 0;
function winDefs(id){ return `<linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8f8ff"/><stop offset="1" stop-color="#8fcdf3"/></linearGradient>`; }
function win(x, y, ws, i, id){
  const st = `stroke="${INK}" stroke-width="2.5"`, gl = `url(#${id}g)`;
  const shine = `<path d="M${x + 5} ${y + 16} L${x + 15} ${y + 5}" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".75"/>`;
  if (ws === 'round') return `<g class="win" data-i="${i}"><circle cx="${x + 13}" cy="${y + 13}" r="15" fill="#fff" ${st}/><circle class="wg" cx="${x + 13}" cy="${y + 13}" r="11" fill="${gl}"/><path d="M${x + 13} ${y + 2} V${y + 24} M${x + 2} ${y + 13} H${x + 24}" stroke="#fff" stroke-width="2.5"/>${shine}</g>`;
  if (ws === 'arch') return `<g class="win" data-i="${i}"><path d="M${x - 2} ${y + 27} V${y + 11} A15 13 0 0 1 ${x + 28} ${y + 11} V${y + 27} Z" fill="#fff" ${st}/><path class="wg" d="M${x + 2} ${y + 25} V${y + 12} A11 10 0 0 1 ${x + 24} ${y + 12} V${y + 25} Z" fill="${gl}"/><path d="M${x + 13} ${y + 3} V${y + 25}" stroke="#fff" stroke-width="2.5"/>${shine}<rect x="${x - 4}" y="${y + 25}" width="34" height="8" rx="3" fill="#c97b4a" ${st}/><circle cx="${x + 3}" cy="${y + 24}" r="3.5" fill="#ff5d8f"/><circle cx="${x + 13}" cy="${y + 23}" r="3.5" fill="#ffd23f"/><circle cx="${x + 23}" cy="${y + 24}" r="3.5" fill="#ff5d8f"/></g>`;
  return `<g class="win" data-i="${i}"><rect x="${x - 2}" y="${y - 2}" width="30" height="30" rx="5" fill="#fff" ${st}/><rect class="wg" x="${x + 2}" y="${y + 2}" width="22" height="22" rx="2" fill="${gl}"/><path d="M${x + 13} ${y + 2} V${y + 24} M${x + 2} ${y + 13} H${x + 24}" stroke="#fff" stroke-width="2.5"/>${shine}<path d="M${x + 2} ${y + 2} H${x + 10} Q${x + 4} ${y + 8} ${x + 2} ${y + 16} Z M${x + 24} ${y + 2} H${x + 16} Q${x + 22} ${y + 8} ${x + 24} ${y + 16} Z" fill="#ff9ec2" opacity=".85"/></g>`;
}
function winIcon(ws){ const id = 'w' + (++SVGID); return `<svg viewBox="-6 -5 38 41"><defs>${winDefs(id)}</defs>${win(0, 0, ws, 0, id)}</svg>`; }
/* 一間房子：cols 每層幾扇窗、n 窗戶總數、floors 樓層、face 笑臉、bush 樹叢、smoke 煙囪冒煙 */
function houseSVG(o){
  const id = 'h' + (++SVGID);
  const cols = o.cols || 2, n = o.n != null ? o.n : (o.floors || 1) * cols;
  const floors = Math.max(o.floors || 1, Math.ceil(n / cols) || 1);
  const W = cols * 40 + 20, fh = 44, gh = 60, bodyH = floors * fh + gh, roofH = 54, X = 22;
  const vbW = W + X * 2, base = roofH + bodyH, vbH = base + 12, w = o.w == null ? 150 : o.w;
  const wall = o.wall || '#ffe9a8', roof = o.roof || '#ef4b5a', door = o.door || '#b5653a';
  const st = `stroke="${INK}" stroke-width="3" stroke-linejoin="round"`;
  const tri = `M${X - 12} ${roofH + 5} L${vbW / 2} 4 L${X + W + 12} ${roofH + 5} Z`;
  let s = `<svg class="house" viewBox="0 0 ${vbW} ${vbH}" style="width:${typeof w === 'number' ? w + 'px' : w}" aria-hidden="true"><defs>
    <linearGradient id="${id}w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(wall, .35)}"/><stop offset="1" stop-color="${shade(wall, -.06)}"/></linearGradient>
    <linearGradient id="${id}r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(roof, .22)}"/><stop offset="1" stop-color="${shade(roof, -.12)}"/></linearGradient>
    <linearGradient id="${id}d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(door, .15)}"/><stop offset="1" stop-color="${shade(door, -.18)}"/></linearGradient>
    <clipPath id="${id}c"><path d="${tri}"/></clipPath>${winDefs(id)}</defs>`;
  s += `<ellipse cx="${vbW / 2}" cy="${base + 3}" rx="${W / 2 + 18}" ry="7" fill="rgba(40,60,40,.16)"/>`;
  const cx = X + W * .68;
  if (o.smoke !== false) s += `<g class="smoke"><circle cx="${cx + 7}" cy="2" r="6"/><circle cx="${cx + 11}" cy="-8" r="8"/><circle cx="${cx + 5}" cy="-20" r="10"/></g>`;
  s += `<rect x="${cx}" y="8" width="16" height="${roofH - 4}" rx="2" fill="#c98b6b" ${st}/><rect x="${cx - 3}" y="5" width="22" height="7" rx="3" fill="#a86b4f" ${st}/>`;
  s += `<rect x="${X}" y="${roofH}" width="${W}" height="${bodyH}" rx="6" fill="url(#${id}w)" ${st}/>`;
  for (let yy = roofH + 14; yy < base - 4; yy += 14) s += `<path d="M${X + 4} ${yy} H${X + W - 4}" stroke="${shade(wall, -.12)}" stroke-width="1.2" opacity=".55"/>`;
  s += `<path d="${tri}" fill="url(#${id}r)"/><g clip-path="url(#${id}c)" fill="none" stroke="${shade(roof, -.25)}" stroke-width="2" opacity=".55">`;
  for (let ry = 22; ry < roofH + 4; ry += 11){ let d = `M${X - 14} ${ry}`; for (let xx = X - 14; xx < X + W + 14; xx += 12) d += ` q6 7 12 0`; s += `<path d="${d}"/>`; }
  s += `</g><path d="${tri}" fill="none" ${st}/><path d="M${X - 14} ${roofH + 5} H${X + W + 14}" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
  for (let i = 0; i < n; i++){
    const r = Math.floor(i / cols), inRow = Math.min(cols, n - r * cols), c = i % cols, off = (cols - inRow) * 20;
    s += win(X + 10 + off + c * 40 + 7, roofH + 12 + r * fh, o.ws, i, id);
  }
  const dx = X + W / 2 - 16, dy = base - 50;
  s += `<rect x="${dx - 5}" y="${base - 6}" width="42" height="7" rx="3" fill="#cfc6c0" ${st}/>`;
  s += `<path d="M${dx} ${base - 5} V${dy + 14} A16 14 0 0 1 ${dx + 32} ${dy + 14} V${base - 5} Z" fill="url(#${id}d)" ${st}/><circle cx="${dx + 16}" cy="${dy + 15}" r="5" fill="#ffe7a0" stroke="${INK}" stroke-width="2"/><circle cx="${dx + 25}" cy="${dy + 30}" r="2.8" fill="#ffd23f" stroke="${INK}" stroke-width="1.5"/>`;
  if (o.face){
    const fy = dy - 12, mx = X + W / 2;
    s += `<ellipse cx="${X + 18}" cy="${fy}" rx="8" ry="4.5" fill="#ff8fb1" opacity=".6"/><ellipse cx="${X + W - 18}" cy="${fy}" rx="8" ry="4.5" fill="#ff8fb1" opacity=".6"/><path d="M${mx - 8} ${fy - 3} Q${mx} ${fy + 5} ${mx + 8} ${fy - 3}" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`;
  }
  if (o.bush !== false) s += `<g ${st}><circle cx="${X - 6}" cy="${base - 8}" r="11" fill="#5cc96b"/><circle cx="${X + 8}" cy="${base - 4}" r="9" fill="#78d987"/><circle cx="${X + W + 6}" cy="${base - 8}" r="11" fill="#5cc96b"/><circle cx="${X + W - 8}" cy="${base - 4}" r="9" fill="#78d987"/></g><circle cx="${X - 8}" cy="${base - 12}" r="2.5" fill="#ff5d8f"/><circle cx="${X + W + 9}" cy="${base - 13}" r="2.5" fill="#ffd23f"/>`;
  return s + '</svg>';
}
function bldCard(b){
  const r = rnd(ROOFS)[0], w = rnd(WALLS)[0];
  return `<span class="bld" style="--rc:${r};--rc2:${shade(r, -.15)};--wc:${shade(w, .2)};--wc2:${shade(w, -.05)}"><span class="bld-roof"></span><span class="bld-body"><span class="bld-sign">${b}</span><span class="bld-w l"></span><span class="bld-w r"></span><span class="bld-door"></span></span></span>`;
}
function dotStr(v){ const a = '●'.repeat(Math.min(v, 5)), b = v > 5 ? '●'.repeat(v - 5) : ''; return `<span>${a}</span>${b ? `<span>${b}</span>` : ''}`; }
function starRow(n){ return '⭐'.repeat(n) + '<i>⭐</i>'.repeat(3 - n); }

/* ---------- 畫面切換 ---------- */
let RUN = 0;
function stopAll(){ RUN++; QLIVE = false; clearTimeout(idleT); stopVoice(); }
function stage(html){ $('stage').innerHTML = html; window.scrollTo(0, 0); }
/* 目前在哪個畫面：首頁不顯示「回遊樂園」；進遊戲時記一筆瀏覽紀錄，手機的「上一頁」就會回到遊樂園而不是離開網站 */
let VIEW = 'home', skipPop = false;
function setView(v){
  VIEW = v; document.body.dataset.view = v; $('k-home').hidden = v === 'home';
  try { if (v !== 'home' && !(history.state && history.state.k)) history.pushState({ k:1 }, ''); } catch(e){}
}
function goHome(){
  sfx.pop(); home(); say(T.homeAgain);
  try { if (history.state && history.state.k){ skipPop = true; setTimeout(() => { skipPop = false; }, 600); history.back(); } } catch(e){}
}
const BACKBTN = '<div class="k-backrow"><button class="k-bigbtn home wide" onclick="goHome()" aria-label="回遊樂園"><span>⬅️ 🏠</span><small>回遊樂園</small></button></div>';
/* 前往學齡版：要按住約一秒，避免小朋友誤觸 */
function bindAdult(){
  const b = $('k-adult'); if (!b) return; let t = null;
  const start = e => { e.preventDefault(); b.classList.add('hold'); t = setTimeout(() => { location.href = './'; }, 1300); };
  const end = () => { if (t){ clearTimeout(t); t = null; } b.classList.remove('hold'); };
  b.addEventListener('pointerdown', start);
  ['pointerup','pointerleave','pointercancel'].forEach(ev => b.addEventListener(ev, end));
  b.addEventListener('contextmenu', e => e.preventDefault());
  b.addEventListener('keydown', e => { if (e.key === 'Enter') location.href = './'; });
}
function setDots(n, done){ $('k-dots').innerHTML = n ? Array.from({ length:n }, (_, i) => `<i class="${i < done ? 'on' : ''}">⭐</i>`).join('') : ''; }
function refreshTop(bump){
  $('k-star-n').textContent = K.stars; $('k-book-n').textContent = K.stickers.length;
  $('k-sound').textContent = K.sound ? '🔊' : '🔇';
  if (bump) ['k-stars','k-book'].forEach(id => { const el = $(id); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); });
}

const GAMES = [
  { id:'build',  ico:'🏡', name:'蓋房子',       color:'#ffe08a', roof:'#ff8c42', intro:'' },
  { id:'big',    ico:'🐘', name:'比大小',       color:'#bfe6ff', roof:'#2f7fd1', intro:'我們來比一比！' },
  { id:'count',  ico:'🔢', name:'數一數',       color:'#ddd3ff', roof:'#8a5cd6', intro:'我們來數一數！' },
  { id:'who',    ico:'🧑‍🚒', name:'去哪裡上班', color:'#c9f2c2', roof:'#24a88f', intro:'猜猜看！' },
  { id:'memory', ico:'🃏', name:'翻翻卡',       color:'#ffd1e1', roof:'#ef4b5a', intro:'' },
  { id:'fix',    ico:'🔍', name:'找找哪裡壞掉', color:'#ffdcb8', roof:'#a0603a', intro:'估小泰要去看房子！' },
];

function home(){
  stopAll(); setDots(0); setView('home');
  const title = '估小泰遊樂園'.split('').map((c, i) => `<span style="--i:${i}">${c}</span>`).join('');
  stage(`<section class="k-home">
    <div class="k-hero">
      <img id="k-owl" class="wave" src="assets/gxt-ok.png" alt="估小泰" draggable="false" onclick="heroTap()">
      <div><div class="k-title">${title}</div><div class="k-bubble">👇 🎮 🎉</div></div>
    </div>
    <div class="k-tiles">${GAMES.map((g, i) => `<button class="k-tile" style="--c:${g.color};--c2:${shade(g.color, -.08)};--r:${g.roof};--r2:${shade(g.roof, -.2)};--d:${i * .18}s" onclick="startGame('${g.id}')" aria-label="${g.name}">
      <span class="t-roof"></span><span class="t-body"><span class="t-win"><span class="k-ico">${g.ico}</span></span>
      <span class="k-starrow">${starRow((K.games[g.id] || {}).best || 0)}</span><small>${g.name}</small></span></button>`).join('')}</div>
    <div class="k-foot"><button class="k-adult" id="k-adult" aria-label="按住一秒，前往學齡版"><i></i><span>🎒 學齡版<small>哥哥姊姊玩的・按住前往</small></span></button></div>
  </section>`);
  bindAdult(); refreshTop();
}
function heroTap(){ const s = rnd(STICKERS); owl(s[0]); sfx.boing(); say(s[2]); }

function startGame(id){
  stopAll(); sfx.pop(); setView('game'); const run = RUN;
  if (id === 'build') return startBuild(run);
  if (id === 'memory') return startMemory(run);
  runQuiz(id, 5, { big:qBig, count:qCount, who:qWho, fix:qFix }[id], run);
}

/* ---------- 題目型遊戲共用流程：5 題、答錯可重選、兩次錯就提示 ---------- */
async function runQuiz(id, n, makeQ, run){
  const g = GAMES.find(x => x.id === id), lv = level(id), ctx = {};
  let qi = 0, miss = 0;
  while (qi < n){
    if (run !== RUN) return;
    const q = makeQ(lv, qi, ctx); setDots(n, qi);
    const optsHTML = q.opts.map((o, i) => `<button class="k-opt ${q.optCls || ''}" data-i="${i}" ${o.style ? `style="${o.style}"` : ''} aria-label="${o.label || '選項'}">${o.html}</button>`).join('');
    const inScene = (q.scene || '').includes('{{OPTS}}');
    stage(`<section class="k-game k-${id}">
      <div class="k-top">${guideHTML()}<div class="k-scene ${q.sceneCls || ''}" id="k-scene">${inScene ? q.scene.replace('{{OPTS}}', optsHTML) : (q.scene || '')}</div></div>
      ${inScene ? '' : `<div class="k-opts cols${q.opts.length}">${optsHTML}</div>`}
    </section>`);
    QLIVE = true;
    await new Promise(resolve => {
      let tries = 0, locked = false;
      const btns = [...document.querySelectorAll('#stage .k-opt')];
      btns.forEach(b => b.addEventListener('click', async () => {
        if (locked || b.disabled || run !== RUN) return;
        const o = q.opts[+b.dataset.i]; clearTimeout(idleT);
        if (o.ok){
          locked = true; QLIVE = false; sfx.ok(); btns.forEach(x => x.classList.remove('hint')); b.classList.add('right');
          owl(rnd(['happy','sparkle','wink','smug','moved'])); burst(b);
          if (q.onRight) await q.onRight(b); else await say(rnd(PRAISE));
          resolve();
        } else {
          tries++; miss++; sfx.no(); b.classList.add('wrong'); b.disabled = true;
          owl(rnd(['surprised','sweat','blank','skeptical']));
          if (tries >= 2) btns.forEach(x => { if (q.opts[+x.dataset.i].ok) x.classList.add('hint'); });
          await say(o.no || rnd(TRYAGAIN)); armIdle();
        }
      }));
      lastPrompt = q.say; say([qi === 0 ? g.intro : '', q.say]).then(armIdle);
    });
    if (run !== RUN) return;
    qi++; setDots(n, qi); await sleep(450);
  }
  if (run === RUN) finish(id, miss <= 1 ? 3 : miss <= 3 ? 2 : 1, run);
}

/* 🐘 比大小 */
function qBig(lv){
  const kinds = lv === 0 ? ['big','small'] : ['big','small','tall','win'];
  const k = rnd(kinds), m = lv === 0 ? 2 : lv === 1 ? rnd([2, 3]) : 3;
  const walls = shuffle(WALLS), roofs = shuffle(ROOFS);
  let vals, mk, txt, right, after;
  if (k === 'big' || k === 'small'){
    vals = shuffle(m === 2 ? [0.5, 1] : [0.45, 0.72, 1]);
    mk = (v, j) => houseSVG({ cols:2, wall:walls[j][0], roof:roofs[j][0], face:true, w:Math.round(v * 74) + '%' });
    right = k === 'big' ? Math.max(...vals) : Math.min(...vals);
    txt = k === 'big' ? T.bigQ : T.smallQ;
    after = k === 'big' ? [T.bigA, Math.random() < .5 ? T.bigA2 : ''] : T.smallA;
  } else if (k === 'tall'){
    vals = shuffle(m === 2 ? rnd([[1, 3], [1, 2], [2, 4]]) : [1, 2, 4]);
    mk = (v, j) => houseSVG({ floors:v, cols:2, wall:walls[j][0], roof:roofs[j][0], face:true, w:'50%' });
    right = Math.max(...vals); txt = T.tallQ; after = tTall(right);
  } else {
    vals = shuffle(m === 2 ? rnd([[1, 4], [2, 6], [1, 3]]) : [1, 3, 6]);
    mk = (v, j) => houseSVG({ n:v, floors:2, cols:3, wall:walls[j][0], roof:roofs[j][0], w:'76%' });
    right = Math.max(...vals); txt = T.winQ; after = tWin(right);
  }
  const pic = { big:'🐘', small:'🐭', tall:'🦒', win:'🪟' }[k];
  return { say:txt, sceneCls:'mini', scene:`<span class="k-ask">${pic}<b>❓</b></span>`, optCls:'ground', opts:vals.map((v, j) => ({ ok:v === right, html:mk(v, j), label:'房子' })), onRight:() => say(after) };
}

/* 🔢 數一數 */
const CNT = [['🌳','棵','樹'],['🚗','台','車子'],['🏠','間','房子'],['🐱','隻','貓咪'],['🌷','朵','花'],['🏢','棟','大樓'],['🐦','隻','小鳥']];
function qCount(lv){
  const N = ri(lv === 2 ? 3 : 1, [5, 8, 10][lv]);
  let scene, txt, unit, name;
  if (Math.random() < .4){
    unit = '扇'; name = '窗戶'; txt = T.winCountQ;
    scene = houseSVG({ n:N, cols:N <= 4 ? 2 : 3, wall:rnd(WALLS)[0], roof:rnd(ROOFS)[0], w:'min(250px, 58vw)' });
  } else {
    const t = rnd(CNT); unit = t[1]; name = t[2]; txt = tCountQ(unit, name);
    scene = `<div class="k-cntrow">${Array.from({ length:N }, (_, i) => `<span class="cnt" style="--d:${(i * .23) % 1.4}s">${t[0]}</span>`).join('')}</div>`;
  }
  const set = new Set([N]); while (set.size < 3){ const d = N + rnd([-2, -1, 1, 2]); if (d >= 1 && d <= 10) set.add(d); }
  return {
    say:txt, scene, sceneCls:unit === '扇' ? '' : 'meadow', optCls:'col',
    opts:shuffle([...set]).map(v => ({ ok:v === N, label:String(v), html:`<b class="num">${v}</b><span class="dots">${dotStr(v)}</span>`, no:T.countNo })),
    onRight: async () => {
      const els = [...document.querySelectorAll('#k-scene .cnt, #k-scene .win')];
      for (let k = 0; k < els.length; k++){ els[k].classList.add('lit'); els[k].setAttribute('data-n', k + 1); sfx.tap(); await say(ZHC[k + 1]); }
      await say(tCountA(N));
    },
  };
}

/* 🧑‍🚒 去哪裡上班：每棟建築都有用途 */
const JOBS = [
  { p:'🧑‍⚕️', job:'醫生', b:'🏥', place:'醫院' },   { p:'🧑‍🏫', job:'老師', b:'🏫', place:'學校' },
  { p:'🧑‍🚒', job:'消防員', b:'🚒', place:'消防局' }, { p:'👮', job:'警察', b:'🚓', place:'警察局' },
  { p:'🧑‍🍳', job:'廚師', b:'🍜', place:'餐廳' },     { p:'🧑‍🌾', job:'農夫', b:'🌾', place:'農田' },
  { p:'🧑‍✈️', job:'機長', b:'✈️', place:'機場' },     { p:'👷', job:'工人', b:'🏗️', place:'工地' },
  { p:'🧑‍🔬', job:'科學家', b:'🔬', place:'實驗室' }, { p:'🧑‍🎨', job:'畫家', b:'🎨', place:'畫室' },
];
function qWho(lv, i, ctx){
  const m = [2, 3, 4][lv];
  if (!ctx.order){ ctx.order = shuffle(JOBS); ctx.owlAt = Math.random() < .6 ? ri(1, 4) : -1; }
  if (i === ctx.owlAt){
    const opts = shuffle(JOBS).slice(0, m - 1).map(j => ({ ok:false, html:bldCard(j.b), label:j.place, no:tPlace(j.place) }));
    opts.push({ ok:true, html:bldCard('🏘️'), label:'房子' });
    return { say:T.owlQ, scene:'<span class="k-person-bg"><img class="k-person-img" src="assets/gxt-smirk.png" alt="估小泰" draggable="false"></span>', opts:shuffle(opts), onRight:() => say(T.owlA) };
  }
  const j = ctx.order[i % ctx.order.length], others = shuffle(JOBS.filter(x => x !== j)).slice(0, m - 1);
  return { say:tJobQ(j), scene:`<span class="k-person-bg"><span class="k-person">${j.p}</span></span>`,
    opts:shuffle([j, ...others]).map(x => ({ ok:x === j, html:bldCard(x.b), label:x.place, no:tPlace(x.place) })),
    onRight:() => say(tJobA(j)) };
}

/* 🔍 找找哪裡壞掉：估價師到現場勘查 */
const CRACK = '<svg viewBox="0 0 40 40" width="46" height="46"><path d="M21 2 L14 12 L23 19 L12 29 L19 38" fill="none" stroke="#4a3b3b" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const PROBS = [
  { e:'💧', n:'漏水', z:'R', t:'屋頂在漏水，要請人來修理！' },
  { e:'🕸️', n:'蜘蛛網', z:'W', t:'好多蜘蛛網，房子要打掃了！' },
  { e:'🍄', n:'發霉', z:'W', t:'牆壁太潮濕，都長出香菇來了！' },
  { e:'🐜', n:'白蟻', z:'WG', t:'白蟻會把木頭咬壞，要趕快處理！' },
  { e:'🗑️', n:'垃圾', z:'G', t:'垃圾亂丟，要清乾淨！' },
  { e:CRACK, n:'裂縫', z:'W', t:'牆壁裂開了，估價師一定要記下來！' },
];
const NICE = [['🐦','小鳥','R'],['🐱','貓咪','RG'],['🌼','小花','G'],['🪴','盆栽','G'],['🦋','蝴蝶','RW'],['🎈','氣球','RW'],['🐶','小狗','G'],['🏮','燈籠','W'],['🧸','小熊','W']];
const SPOTS = { R:[[50,13],[37,22],[63,22]], W:[[22,58],[78,58],[27,77],[73,77],[50,52]], G:[[8,93],[28,94],[72,94],[92,93]] };
function qFix(lv, i, ctx){
  if (!ctx.probs) ctx.probs = shuffle(PROBS);
  const p = ctx.probs[i % ctx.probs.length], k = [2, 4, 6][lv];
  const free = { R:shuffle(SPOTS.R), W:shuffle(SPOTS.W), G:shuffle(SPOTS.G) };
  const take = z => { for (const c of shuffle(z.split(''))) if (free[c].length) return free[c].pop(); return null; };
  const items = [{ ok:true, e:p.e, n:p.n, pos:take(p.z) }];
  for (const d of shuffle(NICE)){ if (items.length > k) break; const pos = take(d[2]); if (pos) items.push({ ok:false, e:d[0], n:d[1], pos }); }
  return {
    say:i === 0 ? T.fixQ0 : T.fixQ1, optCls:'spot', sceneCls:'sky',
    scene:`<div class="k-fixbox">${houseSVG({ floors:1, cols:3, wall:rnd(WALLS)[0], roof:rnd(ROOFS)[0], bush:false, w:'100%' })}<div class="k-grass"></div>{{OPTS}}</div>`,
    opts:items.map(it => ({ ok:it.ok, html:`<span class="spot-e">${it.e}</span>`, style:`left:${it.pos[0]}%;top:${it.pos[1]}%`, label:it.n, no:tNotBroken(it.n) })),
    onRight: async b => { b.classList.add('found'); owl('shocked'); await say([T.found, p.t]); owl('happy'); },
  };
}

/* 🃏 翻翻卡 */
const MEM = [['🏠','房子'],['🏫','學校'],['🏥','醫院'],['🌳','公園'],['🏪','商店'],['🚉','車站'],['🏢','大樓'],['🏗️','工地'],['⛲','噴水池'],['🏰','城堡'],['🚗','車子'],['🌉','橋']];
const MEMC = ['#ffe08a','#bfe6ff','#ffd1e1','#c9f2c2','#ddd3ff','#ffdcb8'];
function startMemory(run){
  const pairs = [3, 4, 6][level('memory')], cols = pairs === 3 ? 3 : 4;
  const pick = shuffle(MEM).slice(0, pairs);
  const deck = shuffle(pick.flatMap((m, i) => [[...m, MEMC[i % MEMC.length]], [...m, MEMC[i % MEMC.length]]]));
  let open = [], done = 0, miss = 0, busy = false;
  setDots(pairs, 0);
  stage(`<section class="k-game k-memory"><div class="k-top">${guideHTML()}</div>
    <div class="k-mem" style="--c:${cols}">${deck.map((d, i) => `<button class="mcard" data-i="${i}" style="--d:${i * .05}s" aria-label="卡片"><span class="in"><span class="f"></span><span class="b" style="background:${d[2]}">${d[0]}</span></span></button>`).join('')}</div></section>`);
  QLIVE = true; prompt(T.memQ).then(armIdle);
  document.querySelectorAll('.mcard').forEach(c => c.addEventListener('click', async () => {
    if (busy || run !== RUN || c.classList.contains('open')) return;
    clearTimeout(idleT); const d = deck[+c.dataset.i];
    c.classList.add('open'); sfx.flip(); say(d[1]); open.push(c);
    if (open.length < 2) return;
    busy = true; const [a, b] = open; open = [];
    if (deck[+a.dataset.i][0] === deck[+b.dataset.i][0]){
      await sleep(420); a.classList.add('done'); b.classList.add('done'); sfx.ok(); burst(a); burst(b);
      owl(rnd(['happy','sparkle','wink'])); done++; setDots(pairs, done);
      const sp = say(T.same); busy = false;
      if (done === pairs){ QLIVE = false; await sp; await sleep(300); if (run === RUN) finish('memory', miss <= pairs ? 3 : miss <= pairs * 2 ? 2 : 1, run); }
      else armIdle();
    } else {
      miss++; await sleep(950); if (run !== RUN) return;
      sfx.no(); owl(rnd(['blank','sweat','skeptical'])); a.classList.remove('open'); b.classList.remove('open'); busy = false; armIdle();
    }
  }));
}

/* 🏠 蓋房子：選顏色、樓層、窗戶、院子，最後請估小泰估價（數金幣） */
const YARD = [['🌳','大樹'],['🌷','花'],['🐶','小狗'],['🐱','貓咪'],['🚗','車子'],['⛲','噴水池'],['🐔','小雞'],['🌻','向日葵']];
const WSTYLE = [['sq','方形窗戶'],['round','圓形窗戶'],['arch','有花的窗戶']];
const BSTEPS = [
  { k:'wall',   t:'我們來蓋房子！先選牆壁的顏色。' },
  { k:'roof',   t:'選一個屋頂的顏色。' },
  { k:'floors', t:'要蓋幾層樓呢？' },
  { k:'ws',     t:'選一種你喜歡的窗戶。' },
  { k:'yard',   t:'在院子裡放東西，最多可以放三個喔！' },
  { k:'app',    t:'房子蓋好了！按一下估小泰，請他幫你估價！' },
];
let B = null;
function startBuild(run){
  B = { run, wall:rnd(WALLS)[0], roof:rnd(ROOFS)[0], floors:1, ws:'sq', yard:[], step:0 };
  buildStep();
}
function buildStep(){
  const st = BSTEPS[B.step]; setDots(BSTEPS.length, B.step);
  stage(`<section class="k-game k-build">
    <div class="k-prev">${guideHTML(st.k === 'app' ? 'smirk' : 'normal')}<div class="k-prevbox" id="k-prevbox"></div><div class="k-coins" id="k-coins"></div></div>
    <div class="k-panel" id="k-panel"></div></section>`);
  drawPreview(); drawPanel();
  QLIVE = true; prompt(st.t).then(armIdle);
}
function drawPreview(){
  $('k-prevbox').innerHTML = `<div id="k-prev-house">${houseSVG({ floors:B.floors, cols:2, wall:B.wall, roof:B.roof, ws:B.ws, face:true, w:190 })}</div>
    <div class="k-yard" id="k-ground">${B.yard.map((k, i) => `<span id="k-y${i}">${YARD[k][0]}</span>`).join('')}</div>`;
}
function drawPanel(){
  const k = BSTEPS[B.step].k; let ch = '';
  if (k === 'wall') ch = WALLS.map(([c, n]) => `<button class="k-ch sw ${B.wall === c ? 'sel' : ''}" style="background:radial-gradient(circle at 35% 30%, #fff 0 12%, ${c} 45%, ${shade(c, -.12)})" data-v="${c}" data-n="${n}" aria-label="${n}"></button>`).join('');
  if (k === 'roof') ch = ROOFS.map(([c, n]) => `<button class="k-ch ${B.roof === c ? 'sel' : ''}" data-v="${c}" data-n="${n}" aria-label="${n}"><svg viewBox="0 0 60 44"><path d="M4 40 L30 4 L56 40 Z" fill="${c}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/></svg></button>`).join('');
  if (k === 'floors') ch = [1, 2, 3].map(f => `<button class="k-ch tall ${B.floors === f ? 'sel' : ''}" data-v="${f}" data-n="${ZH[f]}層樓" aria-label="${f}層樓">${houseSVG({ floors:f, cols:2, wall:B.wall, roof:B.roof, bush:false, smoke:false, w:'100%' })}</button>`).join('');
  if (k === 'ws') ch = WSTYLE.map(([v, n]) => `<button class="k-ch ${B.ws === v ? 'sel' : ''}" data-v="${v}" data-n="${n}" aria-label="${n}">${winIcon(v)}</button>`).join('');
  if (k === 'yard') ch = YARD.map(([e, n], i) => `<button class="k-ch ${B.yard.includes(i) ? 'sel' : ''}" data-v="${i}" data-n="${n}" aria-label="${n}">${e}</button>`).join('');
  const nav = `<div class="k-nav">${B.step > 0 ? '<button class="k-navb back" aria-label="上一步">⬅️</button>' : ''}${k === 'app' ? '' : '<button class="k-navb next" aria-label="下一步">➡️</button>'}</div>`;
  $('k-panel').innerHTML = k === 'app'
    ? `<button class="k-appbtn" id="k-appbtn" aria-label="請估小泰估價"><img src="assets/gxt-smirk.png" alt="估小泰" draggable="false"><span class="mag">🔍</span></button>${nav}`
    : `<div class="k-choices">${ch}</div>${nav}`;
  $('k-panel').querySelectorAll('.k-ch').forEach(b => b.addEventListener('click', () => pickBuild(k, b)));
  const nx = $('k-panel').querySelector('.next'); if (nx) nx.addEventListener('click', () => { sfx.pop(); clearTimeout(idleT); B.step++; buildStep(); });
  const bk = $('k-panel').querySelector('.back'); if (bk) bk.addEventListener('click', () => { sfx.pop(); clearTimeout(idleT); B.step--; buildStep(); });
  const ap = $('k-appbtn'); if (ap) ap.addEventListener('click', appraise);
}
function pickBuild(k, b){
  if (B.run !== RUN) return; clearTimeout(idleT);
  const v = b.dataset.v, n = b.dataset.n;
  if (k === 'yard'){
    const i = +v, at = B.yard.indexOf(i);
    if (at >= 0){ B.yard.splice(at, 1); sfx.flip(); say(T.take); }
    else if (B.yard.length >= 3){ sfx.no(); owl('sweat'); say(T.yardFull); armIdle(); return; }
    else { B.yard.push(i); sfx.pop(); owl(rnd(['happy','sparkle'])); say(n); }
  } else {
    B[k] = k === 'floors' ? +v : v; sfx.pop(); owl(rnd(['happy','sparkle','wink'])); say(tPick(n));
  }
  drawPreview(); drawPanel();
  const ph = $('k-prev-house'); if (ph){ ph.classList.add('boing'); }
  const nx = $('k-panel').querySelector('.next'); if (nx) nx.classList.add('go');
  armIdle();
}
async function appraise(){
  const run = RUN; QLIVE = false; clearTimeout(idleT);
  $('k-appbtn').disabled = true; $('k-panel').querySelectorAll('.k-navb').forEach(x => x.disabled = true);
  owl('normal'); await say(T.appraise);
  const tray = $('k-coins'); let total = 0;
  const add = async (el, cnt) => {
    if (el) el.classList.add('glow');
    for (let j = 0; j < cnt; j++){ if (run !== RUN) return; total++; tray.insertAdjacentHTML('beforeend', '<i class="coin"></i>'); sfx.coin(); await say(ZHC[total]); }
    if (el) el.classList.remove('glow');
  };
  await add($('k-ground'), 1);                                          // 土地
  for (let f = 0; f < B.floors; f++) await add($('k-prev-house'), 2);   // 每層樓兩個金幣
  for (let i = 0; i < B.yard.length; i++) await add($('k-y' + i), 1);   // 院子裡每樣東西一個
  if (run !== RUN) return;
  owl('sparkle'); sfx.win(); confetti();
  await say(tWorth(total));
  await sleep(500); if (run === RUN) finish('build', 3, run);
}

/* ---------- 完成：星星＋打開禮物拿貼紙 ---------- */
async function finish(id, stars, run){
  QLIVE = false; clearTimeout(idleT); setDots(0);
  setView('reward');
  const st = K.games[id] || { plays:0, best:0 }; st.plays++; st.best = Math.max(st.best, stars); K.games[id] = st;
  K.stars += stars;
  const left = STICKERS.filter(s => !K.stickers.includes(s[0])), got = left.length ? rnd(left) : null;
  if (got) K.stickers.push(got[0]);
  save(); refreshTop(true); sfx.win(); confetti(); setTimeout(() => confetti(innerWidth * .2, innerHeight * .4, 60), 350); setTimeout(() => confetti(innerWidth * .8, innerHeight * .4, 60), 700);
  stage(`<section class="k-game k-reward">
    <div class="k-bigstars">${[1, 2, 3].map(i => `<span class="${i <= stars ? 'on' : ''}" style="animation-delay:${i * .25}s">⭐</span>`).join('')}</div>
    <div class="k-giftwrap"><span class="k-rays"></span>
    ${got ? `<button class="k-gift" id="k-gift" aria-label="打開禮物"><span class="in"><span class="f">🎁</span><span class="b"><img src="assets/gxt-${got[0]}.png" alt="估小泰：${got[1]}" draggable="false"></span></span></button>`
          : `<img class="k-allstk" src="assets/gxt-moved.png" alt="估小泰" draggable="false">`}</div>
    <div class="k-row"><button class="k-bigbtn again" onclick="startGame('${id}')" aria-label="再玩一次"><span>🔁</span><small>再玩一次</small></button><button class="k-bigbtn home" onclick="goHome()" aria-label="回遊樂園"><span>🏠</span><small>回遊樂園</small></button><button class="k-bigbtn" onclick="book()" aria-label="貼紙簿"><span>📒</span><small>貼紙簿</small></button></div>
  </section>`);
  let opened = false;
  const openGift = async () => {
    if (opened || run !== RUN) return; opened = true; clearTimeout(idleT); QLIVE = false;
    $('k-gift').classList.add('open'); sfx.win(); burst($('k-gift'));
    await sleep(500); await say([T.gotSticker, got[2]]);
  };
  if (got) $('k-gift').addEventListener('click', openGift);
  await say(stars === 3 ? T.star3 : stars === 2 ? T.star2 : T.star1);
  if (run !== RUN) return;
  if (got && !opened){ lastPrompt = T.gift; QLIVE = true; await say(T.gift); armIdle(); }
  else if (!got) await say(T.allDone);
}

/* ---------- 📒 貼紙簿 ---------- */
function book(){
  stopAll(); setDots(0); sfx.pop(); setView('book');
  const n = K.stickers.length, all = STICKERS.length;
  stage(`<section class="k-game k-book">
    <div class="k-bookhead"><img src="assets/gxt-${n === all ? 'moved' : 'wink'}.png" alt="估小泰" draggable="false"><div class="k-bookbar"><i style="width:${n / all * 100}%"></i><b>${n} / ${all}</b></div></div>
    <div class="k-stks">${STICKERS.map((s, i) => `<button class="k-stk ${K.stickers.includes(s[0]) ? '' : 'no'}" data-i="${i}" style="--d:${(i % 7) * .06}s" aria-label="${K.stickers.includes(s[0]) ? s[1] : '還沒拿到'}"><img src="assets/gxt-${s[0]}.png" alt="" draggable="false" loading="lazy"></button>`).join('')}</div>
  </section>`);
  $('stage').querySelector('.k-book').insertAdjacentHTML('beforeend', BACKBTN);
  say(n ? T.bookHave : T.bookNone);
  document.querySelectorAll('.k-stk').forEach(b => b.addEventListener('click', () => {
    const s = STICKERS[+b.dataset.i];
    b.classList.remove('boing'); void b.offsetWidth; b.classList.add('boing');
    if (K.stickers.includes(s[0])){ sfx.boing(); say(s[2]); } else { sfx.no(); say(T.bookLocked); }
  }));
}

/* ---------- 產生語音檔用：列出估小泰會說的每一句話 ---------- */
function phraseGroups(){
  const G = (g, tip, list) => ({ g, tip, list:list.flat(Infinity).filter(Boolean).map(x => typeof x === 'string' ? { t:x } : x) });
  return [
    G('開場與選單', '親切、有精神，像在跟小朋友打招呼', [T.welcome, T.homeAgain, T.starsHave, T.starsNone, T.soundOn, T.bookHave, T.bookNone, T.bookLocked]),
    G('稱讚與鼓勵', '答對時很開心；答錯時溫柔、不責備', [PRAISE, TRYAGAIN, T.countNo]),
    G('完成與禮物', '興奮、驚喜', [T.star3, T.star2, T.star1, T.gift, T.gotSticker, T.allDone]),
    G('遊戲開場', '活潑，像要開始玩遊戲', GAMES.map(g => g.intro)),
    G('比大小', '問題要問得好奇；答對時開心', [T.bigQ, T.smallQ, T.tallQ, T.winQ, T.bigA, T.bigA2, T.smallA, [2, 3, 4].map(tTall), [3, 4, 6].map(tWin)]),
    G('數一數', '數字一個一個、清楚地念，像陪小朋友數東西', [T.winCountQ, CNT.map(c => tCountQ(c[1], c[2])), ZHC.slice(1), ZHC.slice(1).map((_, i) => tCountA(i + 1))]),
    G('去哪裡上班', '像在講故事，帶一點好奇', [T.owlQ, T.owlA, JOBS.map(j => [tJobQ(j), tJobA(j), tPlace(j.place)])]),
    G('找找哪裡壞掉', '「找到了」要有發現的驚喜感', [T.fixQ0, T.fixQ1, T.found, PROBS.map(p => p.t), NICE.map(d => tNotBroken(d[1]))]),
    G('翻翻卡', '翻卡時念出名稱，短短的、清楚', [T.memQ, T.same, MEM.map(m => m[1])]),
    G('蓋房子', '選東西時開心地念出來；估價時數金幣要有節奏', [BSTEPS.map(s => s.t), WALLS.map(w => tPick(w[1])), ROOFS.map(r => tPick(r[1])), [1, 2, 3].map(f => tPick(`${ZH[f]}層樓`)), WSTYLE.map(w => tPick(w[1])), YARD.map(y => y[1]), T.take, T.yardFull, T.appraise, ZHC.slice(1).map((_, i) => tWorth(i + 1))]),
    G('估小泰貼紙', '照著貼紙上估小泰的表情演出來', STICKERS.map(s => ({ t:s[2], img:'assets/gxt-' + s[0] + '.png' }))),
  ];
}
/* 產生語音檔用：列出估小泰會說的每一句話（不重複） */
function allPhrases(){ const L = new Set(); phraseGroups().forEach(g => g.list.forEach(x => L.add(x.t))); return [...L]; }

/* ---------- 上方按鈕、開始 ---------- */
function init(){
  $('k-home').addEventListener('click', goHome);
  window.addEventListener('popstate', () => { if (skipPop){ skipPop = false; return; } if (VIEW !== 'home'){ home(); say(T.homeAgain); } });
  $('k-stars').addEventListener('click', () => { sfx.coin(); say(K.stars ? T.starsHave : T.starsNone); });
  $('k-book').addEventListener('click', book);
  $('k-sound').addEventListener('click', () => { K.sound = !K.sound; save(); refreshTop(); if (K.sound){ sfx.pop(); say(T.soundOn); } else stopVoice(); });
  $('k-play').addEventListener('click', () => {
    ac(); $('k-start').classList.add('hide');
    home(); say(T.welcome);                       // 在按鈕當下開始播放，iPad／手機才會允許出聲
    setTimeout(() => prefetchVoice([...ZHC.slice(1), ...PRAISE, ...TRYAGAIN, ...BSTEPS.map(s => s.t)]), 2500);
  });
  document.addEventListener('pointerdown', e => { if (!e.target.closest('.k-start')) sparkle(e.clientX, e.clientY); }, { passive:true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopVoice(); });
  document.addEventListener('contextmenu', e => { if (e.target.closest('img')) e.preventDefault(); });
  refreshTop();
}
if (HAS_DOM && document.getElementById('k-home')) init();
if (typeof module !== 'undefined') module.exports = { allPhrases, phraseGroups, vh };
