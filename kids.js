'use strict';
/* 小小估價師大冒險・幼兒園版
   不用識字：所有指示由估小泰用語音說出，選項全部是圖片，答錯不扣分、會提示。
   進度只存在這台裝置（localStorage），不登入、不上傳。 */

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

/* ---------- 估小泰的聲音（瀏覽器內建語音） ---------- */
let VOICE = null;
function pickVoice(){
  if (!('speechSynthesis' in window)) return;
  const vs = speechSynthesis.getVoices();
  const tw = vs.filter(v => /zh[-_]TW/i.test(v.lang));
  VOICE = tw.find(v => /Yating|HsiaoChen|Hanhan|Mei-?Jia|Google/i.test(v.name)) || tw[0]
       || vs.find(v => /zh[-_](HK|Hant)/i.test(v.lang)) || vs.find(v => /^zh/i.test(v.lang)) || null;
}
if ('speechSynthesis' in window){ pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
function say(text, rate){
  return new Promise(res => {
    if (!K.sound || !text || !('speechSynthesis' in window)) { res(); return; }
    let done = false; const fin = () => { if (!done){ done = true; res(); } };
    const u = new SpeechSynthesisUtterance(text);
    u.lang = VOICE ? VOICE.lang : 'zh-TW'; if (VOICE) u.voice = VOICE;
    u.rate = rate || 0.92; u.pitch = 1.15;
    u.onend = fin; u.onerror = fin;
    setTimeout(fin, 1200 + text.length * 330);           // 有些裝置不會觸發 onend
    const wasBusy = speechSynthesis.speaking || speechSynthesis.pending;
    speechSynthesis.cancel();
    if (wasBusy) setTimeout(() => speechSynthesis.speak(u), 60); else speechSynthesis.speak(u);
  });
}
let lastPrompt = '';
function prompt(text){ lastPrompt = text; return say(text); }
function replay(){ sfx.pop(); say(lastPrompt); armIdle(); }

/* 太久沒動作，估小泰再說一次題目 */
let idleT = null, QLIVE = false;
function armIdle(){ clearTimeout(idleT); if (!QLIVE) return; idleT = setTimeout(() => { if (QLIVE && lastPrompt) say(lastPrompt); }, 15000); }

/* ---------- 音效（不需要音檔） ---------- */
let AC = null;
function ac(){ if (!AC){ try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){} } if (AC && AC.state === 'suspended') AC.resume(); return AC; }
function tone(f, t0, dur, type, vol){
  const a = ac(); if (!a || !K.sound) return;
  const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + t0;
  o.type = type || 'triangle'; o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.16, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.05);
}
const sfx = {
  pop(){ tone(660, 0, .09); },
  flip(){ tone(520, 0, .07, 'triangle', .1); tone(780, .05, .07, 'triangle', .08); },
  ok(){ [523, 659, 784, 1047].forEach((f, i) => tone(f, i * .08, .2)); },
  no(){ tone(240, 0, .16, 'sine', .14); tone(200, .14, .24, 'sine', .14); },
  coin(){ tone(988, 0, .07, 'square', .06); tone(1319, .07, .2, 'square', .06); },
  win(){ [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, i * .12, .24)); },
};

/* ---------- 彩帶 ---------- */
const CF = { parts:[], raf:0 };
function confetti(x, y, n){
  const c = $('k-confetti'); if (!c) return;
  if (c.width !== innerWidth || c.height !== innerHeight){ c.width = innerWidth; c.height = innerHeight; }
  if (x == null){ x = innerWidth / 2; y = innerHeight / 3; }
  const cols = ['#f8c008','#0098bc','#ff6b8b','#3bb273','#9b5de5','#ff8c42'];
  for (let i = 0; i < (n || 90); i++){ const a = Math.random() * Math.PI * 2, v = 3 + Math.random() * 7;
    CF.parts.push({ x, y, vx:Math.cos(a) * v, vy:Math.sin(a) * v - 4, r:5 + Math.random() * 5, c:rnd(cols), life:70 + Math.random() * 40, rot:Math.random() * 6 }); }
  if (CF.parts.length > 420) CF.parts.splice(0, CF.parts.length - 420);
  if (!CF.raf) CF.raf = requestAnimationFrame(cfStep);
}
function cfStep(){
  const c = $('k-confetti'), g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
  CF.parts = CF.parts.filter(p => --p.life > 0 && p.y < c.height + 20);
  for (const p of CF.parts){ p.vy += .25; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.rot += .2;
    g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillStyle = p.c; g.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 1.6); g.restore(); }
  CF.raf = CF.parts.length ? requestAnimationFrame(cfStep) : 0;
}
function burst(el){ const r = el.getBoundingClientRect(); confetti(r.left + r.width / 2, r.top + r.height / 2, 36); }

/* ---------- 估小泰貼紙（21 張表情） ---------- */
const STICKERS = [
  ['happy','開心','我好開心！'], ['sparkle','眼睛發亮','哇！好漂亮的房子！'], ['wink','眨眼','嘿嘿，我知道答案喔！'],
  ['moved','感動','你好棒，我好感動！'], ['shy','害羞','被你稱讚，好害羞喔！'], ['smirk','有把握','這題交給我！'],
  ['smug','得意','我是厲害的估小泰！'], ['ok','沒問題','沒問題！'], ['normal','認真','我要認真看房子！'],
  ['surprised','驚訝','咦？這是什麼？'], ['shocked','嚇一跳','哇！嚇我一跳！'], ['blank','愣住','嗯……我想一想。'],
  ['sweat','尷尬','哎呀，弄錯了！'], ['worried','擔心','下雨了，屋頂會不會漏水？'], ['cry','哭哭','嗚嗚，房子壞掉了！'],
  ['skeptical','懷疑','真的嗎？我再看一看。'], ['deadpan','無言','好吧，我知道了。'], ['annoyed','不耐煩','不要一直催我啦！'],
  ['pout','生悶氣','哼！我要生氣三秒鐘！'], ['angry','生氣','不可以亂丟垃圾！'], ['sleepy','想睡','好睏喔，晚安！'],
];
function owl(k){ const el = $('k-owl'); if (!el) return; el.src = 'assets/gxt-' + k + '.png'; el.classList.remove('boing'); void el.offsetWidth; el.classList.add('boing'); }
function guideHTML(face){ return `<div class="k-guide"><img id="k-owl" src="assets/gxt-${face || 'normal'}.png" alt="估小泰" draggable="false" onclick="replay()"><button class="k-say" onclick="replay()" aria-label="再聽一次">🔊</button></div>`; }

/* ---------- 素材 ---------- */
const WALLS = [['#ffe8a3','黃色'],['#ffc8dd','粉紅色'],['#caffbf','綠色'],['#a0e7ff','藍色'],['#e0c3fc','紫色'],['#ffffff','白色']];
const ROOFS = [['#e63946','紅色'],['#1d70a2','藍色'],['#2a9d8f','綠色'],['#8d5524','咖啡色'],['#ff8c42','橘色'],['#6c4ab6','紫色']];
const PRAISE = ['答對了！','好棒！','你好厲害！','沒錯，就是這個！','太棒了！'];
const TRYAGAIN = ['再試試看！','不是這個喔，再看一看。','差一點點，再找找看！'];

function win(x, y, ws, i){
  const st = 'stroke="#3b2f2f" stroke-width="2.5"';
  if (ws === 'round') return `<g class="win" data-i="${i}"><circle class="wg" cx="${x + 13}" cy="${y + 13}" r="13" fill="#bde0fe" ${st}/><path d="M${x + 13} ${y} V${y + 26} M${x} ${y + 13} H${x + 26}" fill="none" ${st}/></g>`;
  if (ws === 'arch') return `<g class="win" data-i="${i}"><path class="wg" d="M${x} ${y + 26} V${y + 11} A13 11 0 0 1 ${x + 26} ${y + 11} V${y + 26} Z" fill="#bde0fe" ${st}/><path d="M${x + 13} ${y + 1} V${y + 26}" fill="none" ${st}/><rect x="${x - 3}" y="${y + 24}" width="32" height="7" rx="2" fill="#f4978e" ${st}/></g>`;
  return `<g class="win" data-i="${i}"><rect class="wg" x="${x}" y="${y}" width="26" height="26" rx="3" fill="#bde0fe" ${st}/><path d="M${x + 13} ${y} V${y + 26} M${x} ${y + 13} H${x + 26}" fill="none" ${st}/></g>`;
}
/* 畫一間房子：cols 每層幾扇窗、n 窗戶總數、floors 樓層 */
function houseSVG(o){
  const cols = o.cols || 2, n = o.n != null ? o.n : (o.floors || 1) * cols;
  const floors = Math.max(o.floors || 1, Math.ceil(n / cols) || 1);
  const W = cols * 40 + 20, fh = 44, gh = 58, bodyH = floors * fh + gh, roofH = 48, X = 14;
  const vbW = W + X * 2, vbH = roofH + bodyH + 4, w = o.w == null ? 150 : o.w;
  const st = 'stroke="#3b2f2f" stroke-width="3" stroke-linejoin="round"';
  let s = `<svg class="house" viewBox="0 0 ${vbW} ${vbH}" style="width:${typeof w === 'number' ? w + 'px' : w}" aria-hidden="true">`;
  s += `<rect x="${X + W * .66}" y="10" width="14" height="${roofH - 6}" fill="#b08968" ${st}/>`;
  s += `<rect x="${X}" y="${roofH}" width="${W}" height="${bodyH}" rx="5" fill="${o.wall || '#ffe8a3'}" ${st}/>`;
  s += `<path d="M${X - 10} ${roofH + 4} L${vbW / 2} 3 L${X + W + 10} ${roofH + 4} Z" fill="${o.roof || '#e63946'}" ${st}/>`;
  for (let i = 0; i < n; i++){
    const r = Math.floor(i / cols), inRow = Math.min(cols, n - r * cols), c = i % cols, off = (cols - inRow) * 20;
    s += win(X + 10 + off + c * 40 + 7, roofH + 10 + r * fh, o.ws, i);
  }
  const dx = X + W / 2 - 15, dy = roofH + bodyH - 48;
  s += `<rect x="${dx}" y="${dy}" width="30" height="48" rx="7" fill="${o.door || '#9c6644'}" ${st}/><circle cx="${dx + 23}" cy="${dy + 26}" r="3" fill="#ffd166"/>`;
  return s + '</svg>';
}
function bldCard(b){ return `<span class="bld" style="--rc:${rnd(ROOFS)[0]};--wc:${rnd(WALLS)[0]}"><span class="bld-roof"></span><span class="bld-body">${b}</span></span>`; }
function dotStr(v){ const a = '●'.repeat(Math.min(v, 5)), b = v > 5 ? '●'.repeat(v - 5) : ''; return `<span>${a}</span>${b ? `<span>${b}</span>` : ''}`; }
function starRow(n){ return '⭐'.repeat(n) + '<i>⭐</i>'.repeat(3 - n); }

/* ---------- 畫面切換 ---------- */
let RUN = 0;
function stopAll(){ RUN++; QLIVE = false; clearTimeout(idleT); try { speechSynthesis.cancel(); } catch(e){} }
function stage(html){ $('stage').innerHTML = html; window.scrollTo(0, 0); }
function setDots(n, done){ $('k-dots').innerHTML = n ? Array.from({ length:n }, (_, i) => `<i class="${i < done ? 'on' : ''}"></i>`).join('') : ''; }
function refreshTop(bump){
  $('k-star-n').textContent = K.stars; $('k-book-n').textContent = K.stickers.length;
  $('k-sound').textContent = K.sound ? '🔊' : '🔇';
  if (bump) ['k-stars','k-book'].forEach(id => { const el = $(id); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); });
}

const GAMES = [
  { id:'build',  ico:'🏠', name:'蓋房子',       color:'#ffd166', intro:'' },
  { id:'big',    ico:'🐘', name:'比大小',       color:'#9ad1f5', intro:'我們來比一比' },
  { id:'count',  ico:'🔢', name:'數一數',       color:'#c9bdf7', intro:'我們來數一數' },
  { id:'who',    ico:'🧑‍🚒', name:'去哪裡上班', color:'#a8e6a1', intro:'猜猜看' },
  { id:'memory', ico:'🃏', name:'翻翻卡',       color:'#ffb3c7', intro:'' },
  { id:'fix',    ico:'🔍', name:'找找哪裡壞掉', color:'#ffc48c', intro:'估小泰要去看房子' },
];

function home(){
  stopAll(); setDots(0);
  stage(`<section class="k-home">
    <div class="k-hero"><img id="k-owl" src="assets/gxt-ok.png" alt="估小泰" draggable="false" onclick="heroTap()"><div class="k-bubble">👇🎮</div></div>
    <div class="k-tiles">${GAMES.map(g => `<button class="k-tile" style="--c:${g.color}" onclick="startGame('${g.id}')" aria-label="${g.name}">
      <span class="k-ico">${g.ico}</span><span class="k-starrow">${starRow((K.games[g.id] || {}).best || 0)}</span><small>${g.name}</small></button>`).join('')}</div>
  </section>`);
  refreshTop();
}
function heroTap(){ const s = rnd(STICKERS); owl(s[0]); sfx.pop(); say(s[2]); }

function startGame(id){
  stopAll(); sfx.pop(); const run = RUN;
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
      prompt((qi === 0 && g.intro ? g.intro + '！' : '') + q.say).then(armIdle);
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
    mk = (v, j) => houseSVG({ cols:2, wall:walls[j][0], roof:roofs[j][0], w:Math.round(v * 70) + '%' });
    right = k === 'big' ? Math.max(...vals) : Math.min(...vals);
    txt = k === 'big' ? '哪一間房子比較大？' : '哪一間房子比較小？';
    after = k === 'big' ? '答對了！這間比較大。' + (Math.random() < .5 ? '大房子通常比較貴喔！' : '') : '答對了！這間比較小！';
  } else if (k === 'tall'){
    vals = shuffle(m === 2 ? rnd([[1, 3], [1, 2], [2, 4]]) : [1, 2, 4]);
    mk = (v, j) => houseSVG({ floors:v, cols:2, wall:walls[j][0], roof:roofs[j][0], w:'46%' });
    right = Math.max(...vals); txt = '哪一棟房子比較高？';
    after = `答對了！這棟比較高，有${ZH[right]}層樓！`;
  } else {
    vals = shuffle(m === 2 ? rnd([[1, 4], [2, 6], [1, 3]]) : [1, 3, 6]);
    mk = (v, j) => houseSVG({ n:v, floors:2, cols:3, wall:walls[j][0], roof:roofs[j][0], w:'72%' });
    right = Math.max(...vals); txt = '哪一間房子的窗戶比較多？';
    after = `答對了！這間有${ZH[right]}扇窗戶！`;
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
    unit = '扇'; name = '窗戶'; txt = '數一數，這間房子有幾扇窗戶？';
    scene = houseSVG({ n:N, cols:N <= 4 ? 2 : 3, wall:rnd(WALLS)[0], roof:rnd(ROOFS)[0], w:'min(240px, 56vw)' });
  } else {
    const t = rnd(CNT); unit = t[1]; name = t[2]; txt = `數一數，有幾${unit}${name}？`;
    scene = `<div class="k-cntrow">${Array.from({ length:N }, () => `<span class="cnt">${t[0]}</span>`).join('')}</div>`;
  }
  const set = new Set([N]); while (set.size < 3){ const d = N + rnd([-2, -1, 1, 2]); if (d >= 1 && d <= 10) set.add(d); }
  return {
    say:txt, scene, optCls:'col',
    opts:shuffle([...set]).map(v => ({ ok:v === N, label:String(v), html:`<b class="num">${v}</b><span class="dots">${dotStr(v)}</span>`, no:`不是${ZH[v]}${unit}喔，我們再數一次。` })),
    onRight: async () => {
      const els = [...document.querySelectorAll('#k-scene .cnt, #k-scene .win')];
      const words = ZHC.slice(1, N + 1).join('、') + '，' + ZH[N] + unit + name + '！';
      const sp = say(words, 0.85);
      for (let k = 0; k < els.length; k++){ els[k].classList.add('lit'); els[k].setAttribute('data-n', k + 1); sfx.pop(); await sleep(560); }
      await sp;
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
    const opts = shuffle(JOBS).slice(0, m - 1).map(j => ({ ok:false, html:bldCard(j.b), label:j.place, no:`這是${j.place}喔，再想一想。` }));
    opts.push({ ok:true, html:bldCard('🏘️'), label:'房子' });
    return { say:'估小泰是估價師，他要去哪裡上班呢？', scene:'<img class="k-person-img" src="assets/gxt-smirk.png" alt="估小泰" draggable="false">',
      opts:shuffle(opts), onRight:() => say('答對了！估價師要去看房子，幫房子估價！') };
  }
  const j = ctx.order[i % ctx.order.length], others = shuffle(JOBS.filter(x => x !== j)).slice(0, m - 1);
  return { say:`${j.job}要去哪裡上班呢？`, scene:`<span class="k-person">${j.p}</span>`,
    opts:shuffle([j, ...others]).map(x => ({ ok:x === j, html:bldCard(x.b), label:x.place, no:`這是${x.place}，${j.job}不在這裡上班喔。` })),
    onRight:() => say(`答對了！${j.job}在${j.place}上班！`) };
}

/* 🔍 找找哪裡壞掉：估價師到現場勘查 */
const CRACK = '<svg viewBox="0 0 40 40" width="46" height="46"><path d="M21 2 L14 12 L23 19 L12 29 L19 38" fill="none" stroke="#3b2f2f" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const PROBS = [
  { e:'💧', n:'漏水', z:'R', t:'屋頂在漏水，要請人來修理！' },
  { e:'🕸️', n:'蜘蛛網', z:'W', t:'好多蜘蛛網，房子要打掃了！' },
  { e:'🍄', n:'發霉', z:'W', t:'牆壁太潮濕，都長出香菇來了！' },
  { e:'🐜', n:'白蟻', z:'WG', t:'白蟻會把木頭咬壞，要趕快處理！' },
  { e:'🗑️', n:'垃圾', z:'G', t:'垃圾亂丟，要清乾淨！' },
  { e:CRACK, n:'裂縫', z:'W', t:'牆壁裂開了，估價師一定要記下來！' },
];
const NICE = [['🐦','小鳥','R'],['🐱','貓咪','RG'],['🌼','小花','G'],['🪴','盆栽','G'],['🦋','蝴蝶','RW'],['🎈','氣球','RW'],['🐶','小狗','G'],['🏮','燈籠','W'],['🧸','小熊','W']];
const SPOTS = { R:[[50,12],[36,20],[64,20]], W:[[20,57],[80,57],[26,76],[74,76],[50,55]], G:[[9,93],[29,94],[71,94],[91,93]] };
function qFix(lv, i, ctx){
  if (!ctx.probs) ctx.probs = shuffle(PROBS);
  const p = ctx.probs[i % ctx.probs.length], k = [2, 4, 6][lv];
  const free = { R:shuffle(SPOTS.R), W:shuffle(SPOTS.W), G:shuffle(SPOTS.G) };
  const take = z => { for (const c of shuffle(z.split(''))) if (free[c].length) return free[c].pop(); return null; };
  const items = [{ ok:true, e:p.e, n:p.n, pos:take(p.z) }];
  for (const d of shuffle(NICE)){ if (items.length > k) break; const pos = take(d[2]); if (pos) items.push({ ok:false, e:d[0], n:d[1], pos }); }
  return {
    say:i === 0 ? '哪裡壞掉了？找找看！' : '這間房子呢？哪裡壞掉了？', optCls:'spot',
    scene:`<div class="k-fixbox">${houseSVG({ floors:1, cols:3, wall:rnd(WALLS)[0], roof:rnd(ROOFS)[0], w:'100%' })}<div class="k-grass"></div>{{OPTS}}</div>`,
    opts:items.map(it => ({ ok:it.ok, html:`<span class="spot-e">${it.e}</span>`, style:`left:${it.pos[0]}%;top:${it.pos[1]}%`, label:it.n, no:`這是${it.n}，沒有壞掉喔。` })),
    onRight: async b => { b.classList.add('found'); owl('shocked'); await say('找到了！' + p.t); owl('happy'); },
  };
}

/* 🃏 翻翻卡 */
const MEM = [['🏠','房子'],['🏫','學校'],['🏥','醫院'],['🌳','公園'],['🏪','商店'],['🚉','車站'],['🏢','大樓'],['🏗️','工地'],['⛲','噴水池'],['🏰','城堡'],['🚗','車子'],['🌉','橋']];
function startMemory(run){
  const pairs = [3, 4, 6][level('memory')], cols = pairs === 3 ? 3 : 4;
  const deck = shuffle(shuffle(MEM).slice(0, pairs).flatMap(m => [m, m]));
  let open = [], done = 0, miss = 0, busy = false;
  setDots(pairs, 0);
  stage(`<section class="k-game k-memory"><div class="k-top">${guideHTML()}</div>
    <div class="k-mem" style="--c:${cols}">${deck.map((d, i) => `<button class="mcard" data-i="${i}" aria-label="卡片"><span class="in"><span class="f"></span><span class="b">${d[0]}</span></span></button>`).join('')}</div></section>`);
  QLIVE = true; prompt('翻開卡片，找出兩張一樣的！').then(armIdle);
  document.querySelectorAll('.mcard').forEach(c => c.addEventListener('click', async () => {
    if (busy || run !== RUN || c.classList.contains('open')) return;
    clearTimeout(idleT); const d = deck[+c.dataset.i];
    c.classList.add('open'); sfx.flip(); say(d[1]); open.push(c);
    if (open.length < 2) return;
    busy = true; const [a, b] = open; open = [];
    if (deck[+a.dataset.i][0] === deck[+b.dataset.i][0]){
      await sleep(420); a.classList.add('done'); b.classList.add('done'); sfx.ok(); burst(b);
      owl(rnd(['happy','sparkle','wink'])); done++; setDots(pairs, done);
      const sp = say('一樣！是' + d[1] + '！'); busy = false;
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
  $('k-prevbox').innerHTML = `<div id="k-prev-house">${houseSVG({ floors:B.floors, cols:2, wall:B.wall, roof:B.roof, ws:B.ws, w:170 })}</div>
    <div class="k-yard" id="k-ground">${B.yard.map((k, i) => `<span id="k-y${i}">${YARD[k][0]}</span>`).join('')}</div>`;
}
function drawPanel(){
  const k = BSTEPS[B.step].k; let ch = '';
  if (k === 'wall') ch = WALLS.map(([c, n]) => `<button class="k-ch sw ${B.wall === c ? 'sel' : ''}" style="background:${c}" data-v="${c}" data-n="${n}" aria-label="${n}"></button>`).join('');
  if (k === 'roof') ch = ROOFS.map(([c, n]) => `<button class="k-ch ${B.roof === c ? 'sel' : ''}" data-v="${c}" data-n="${n}" aria-label="${n}"><svg viewBox="0 0 60 44"><path d="M4 40 L30 4 L56 40 Z" fill="${c}" stroke="#3b2f2f" stroke-width="3" stroke-linejoin="round"/></svg></button>`).join('');
  if (k === 'floors') ch = [1, 2, 3].map(f => `<button class="k-ch tall ${B.floors === f ? 'sel' : ''}" data-v="${f}" data-n="${ZH[f]}層樓" aria-label="${f}層樓">${houseSVG({ floors:f, cols:2, wall:B.wall, roof:B.roof, w:'100%' })}</button>`).join('');
  if (k === 'ws') ch = WSTYLE.map(([v, n]) => `<button class="k-ch ${B.ws === v ? 'sel' : ''}" data-v="${v}" data-n="${n}" aria-label="${n}"><svg viewBox="-5 -4 36 38">${win(0, 0, v, 0)}</svg></button>`).join('');
  if (k === 'yard') ch = YARD.map(([e, n], i) => `<button class="k-ch ${B.yard.includes(i) ? 'sel' : ''}" data-v="${i}" data-n="${n}" aria-label="${n}">${e}</button>`).join('');
  const nav = `<div class="k-nav">${B.step > 0 ? '<button class="k-navb back" aria-label="上一步">⬅️</button>' : ''}${k === 'app' ? '' : '<button class="k-navb next" aria-label="下一步">➡️</button>'}</div>`;
  $('k-panel').innerHTML = k === 'app'
    ? `<button class="k-appbtn" id="k-appbtn" aria-label="請估小泰估價"><img src="assets/gxt-smirk.png" alt="估小泰" draggable="false">🔍</button>${nav}`
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
    if (at >= 0){ B.yard.splice(at, 1); sfx.flip(); say('拿走' + n); }
    else if (B.yard.length >= 3){ sfx.no(); owl('sweat'); say('院子滿了，最多放三個喔！'); armIdle(); return; }
    else { B.yard.push(i); sfx.pop(); owl(rnd(['happy','sparkle'])); say(n); }
  } else {
    B[k] = k === 'floors' ? +v : v; sfx.pop(); owl(rnd(['happy','sparkle','wink'])); say(n + '！');
  }
  drawPreview(); drawPanel();
  const nx = $('k-panel').querySelector('.next'); if (nx) nx.classList.add('go');
  armIdle();
}
async function appraise(){
  const run = RUN; QLIVE = false; clearTimeout(idleT);
  $('k-appbtn').disabled = true; $('k-panel').querySelectorAll('.k-navb').forEach(x => x.disabled = true);
  owl('normal'); await say('估小泰來估價囉！房子越大，越值錢喔！');
  const tray = $('k-coins'); let total = 0;
  const add = async (el, cnt) => {
    if (el) el.classList.add('glow');
    for (let j = 0; j < cnt; j++){ if (run !== RUN) return; total++; tray.insertAdjacentHTML('beforeend', '<i class="coin"></i>'); sfx.coin(); await say(ZHC[total], 1); }
    if (el) el.classList.remove('glow');
  };
  await add($('k-ground'), 1);                                   // 土地
  for (let f = 0; f < B.floors; f++) await add($('k-prev-house'), 2);   // 每層樓兩個金幣
  for (let i = 0; i < B.yard.length; i++) await add($('k-y' + i), 1);   // 院子裡每樣東西一個
  if (run !== RUN) return;
  owl('sparkle'); sfx.win(); confetti();
  await say(`你的房子值${ZH[total]}個金幣！`);
  await sleep(500); if (run === RUN) finish('build', 3, run);
}

/* ---------- 完成：星星＋打開禮物拿貼紙 ---------- */
async function finish(id, stars, run){
  QLIVE = false; clearTimeout(idleT); setDots(0);
  const st = K.games[id] || { plays:0, best:0 }; st.plays++; st.best = Math.max(st.best, stars); K.games[id] = st;
  K.stars += stars;
  const left = STICKERS.filter(s => !K.stickers.includes(s[0])), got = left.length ? rnd(left) : null;
  if (got) K.stickers.push(got[0]);
  save(); refreshTop(true); sfx.win(); confetti();
  stage(`<section class="k-game k-reward">
    <div class="k-bigstars">${[1, 2, 3].map(i => `<span class="${i <= stars ? 'on' : ''}" style="animation-delay:${i * .25}s">⭐</span>`).join('')}</div>
    ${got ? `<button class="k-gift" id="k-gift" aria-label="打開禮物"><span class="in"><span class="f">🎁</span><span class="b"><img src="assets/gxt-${got[0]}.png" alt="估小泰：${got[1]}" draggable="false"></span></span></button>`
          : `<img class="k-allstk" src="assets/gxt-moved.png" alt="估小泰" draggable="false">`}
    <div class="k-row"><button class="k-bigbtn again" onclick="startGame('${id}')" aria-label="再玩一次">🔁</button><button class="k-bigbtn" onclick="home()" aria-label="選別的遊戲">🏠</button><button class="k-bigbtn" onclick="book()" aria-label="貼紙簿">📒</button></div>
  </section>`);
  let opened = false;
  const openGift = async () => {
    if (opened || run !== RUN) return; opened = true; clearTimeout(idleT); QLIVE = false;
    $('k-gift').classList.add('open'); sfx.coin(); burst($('k-gift'));
    await sleep(500); await say('是' + got[1] + '的估小泰！' + got[2]);
  };
  if (got) $('k-gift').addEventListener('click', openGift);
  await say(stars === 3 ? '太厲害了！三顆星星！' : stars === 2 ? '好棒！兩顆星星！' : '完成了！你得到一顆星星！');
  if (run !== RUN) return;
  if (got && !opened){ lastPrompt = '按一下禮物，打開看看！'; QLIVE = true; await say(lastPrompt); armIdle(); }
  else if (!got) await say('所有貼紙都收集完了，你是最棒的小小估價師！');
}

/* ---------- 📒 貼紙簿 ---------- */
function book(){
  stopAll(); setDots(0); sfx.pop();
  const n = K.stickers.length, all = STICKERS.length;
  stage(`<section class="k-game k-book">
    <div class="k-bookhead"><img src="assets/gxt-${n === all ? 'moved' : 'wink'}.png" alt="估小泰" draggable="false"><div class="k-bookbar"><i style="width:${n / all * 100}%"></i><b>${n} / ${all}</b></div></div>
    <div class="k-stks">${STICKERS.map((s, i) => `<button class="k-stk ${K.stickers.includes(s[0]) ? '' : 'no'}" data-i="${i}" aria-label="${K.stickers.includes(s[0]) ? s[1] : '還沒拿到'}"><img src="assets/gxt-${s[0]}.png" alt="" draggable="false" loading="lazy"></button>`).join('')}</div>
  </section>`);
  say(n ? `你已經有${n}張貼紙了！按一下貼紙，聽估小泰說話。` : '玩遊戲就可以拿到估小泰貼紙喔！');
  document.querySelectorAll('.k-stk').forEach(b => b.addEventListener('click', () => {
    const s = STICKERS[+b.dataset.i];
    b.classList.remove('boing'); void b.offsetWidth; b.classList.add('boing');
    if (K.stickers.includes(s[0])){ sfx.pop(); say(s[2]); } else { sfx.no(); say('這張還沒拿到，去玩遊戲就可以拿到喔！'); }
  }));
}

/* ---------- 上方按鈕、大人版、開始 ---------- */
$('k-home').addEventListener('click', () => { sfx.pop(); home(); say('想玩什麼呢？選一個吧！'); });
$('k-stars').addEventListener('click', () => { sfx.coin(); say(K.stars ? `你有${K.stars}顆星星！` : '玩遊戲就可以拿到星星喔！'); });
$('k-book').addEventListener('click', book);
$('k-sound').addEventListener('click', () => { K.sound = !K.sound; save(); refreshTop(); if (K.sound){ sfx.pop(); say('聲音打開了！'); } else { try { speechSynthesis.cancel(); } catch(e){} } });
(function adultGate(){
  const b = $('k-adult'); let t = null;
  const start = e => { e.preventDefault(); b.classList.add('hold'); t = setTimeout(() => { location.href = './'; }, 1300); };
  const end = () => { if (t){ clearTimeout(t); t = null; } b.classList.remove('hold'); };
  b.addEventListener('pointerdown', start);
  ['pointerup','pointerleave','pointercancel'].forEach(ev => b.addEventListener(ev, end));
  b.addEventListener('contextmenu', e => e.preventDefault());
  b.addEventListener('keydown', e => { if (e.key === 'Enter') location.href = './'; });
})();
$('k-play').addEventListener('click', () => {
  ac(); $('k-start').classList.add('hide');
  home(); say('嗨！我是估小泰！我們一起來玩房子的遊戲。選一個你想玩的吧！');
});
document.addEventListener('visibilitychange', () => { if (document.hidden){ try { speechSynthesis.cancel(); } catch(e){} } });
document.addEventListener('contextmenu', e => { if (e.target.closest('img')) e.preventDefault(); });
refreshTop();
