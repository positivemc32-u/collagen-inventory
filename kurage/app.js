// =============================================================
// クラゲのニューストピック 本体
//  - 項目（セクション）と目次の表示、ドラッグでの並べ替え
//  - 音声読み上げ（ミュート・速さ・落ち着いた男性／女性の声）
//  - ニュース画像（テロップ＋クラゲ）、画面の端に出るクラゲ
// 設定や自分で書いた記事は、この端末のブラウザの中にだけ保存します。
// =============================================================
'use strict';

const $ = (id) => document.getElementById(id);
const STORE_KEY = 'kurage-news-v1';
const AI_KEY = 'kurage-news-ai-v1';
const APIKEY_KEY = 'kurage-news-apikey';
const synth = window.speechSynthesis || null;

// ---------- 最初から入っている項目 ----------
// prompt は「🤖 Claudeで更新」のときに、何を調べるかの指示です
const BUILTIN = [
  { id: 'today', emoji: '🗞', title: '今日の話題ニュース', c1: '#0e5a8a', c2: '#06263d',
    prompt: '今日、人と話すときの話題になる日本と世界のニュース（政治・経済・社会・エンタメ・科学などから）' },
  { id: 'phyto', emoji: '🌿', title: '植物療法（フィトテラピー）', c1: '#2f7a5b', c2: '#0d3326',
    prompt: '植物療法（フィトテラピー・メディカルハーブ）業界の最近の話題やニュース。研究、協会・学会、商品、規制、安全性の情報' },
  { id: 'aroma', emoji: '🌸', title: 'アロマ', c1: '#8a4f7d', c2: '#2e1430',
    prompt: 'アロマテラピー・精油業界の最近の話題やニュース。市場、新商品、研究、協会の動き、安全な使い方' },
  { id: 'sports', emoji: '⚾', title: 'スポーツ業界', c1: '#b5542b', c2: '#3a160a',
    prompt: 'スポーツ業界の今日の話題やニュース。試合結果だけでなく、リーグ経営・移籍・スポーツビジネスの動きも' },
  { id: 'realestate', emoji: '🏠', title: '不動産・賃貸オーナーの学び', c1: '#6b6b2a', c2: '#23230b',
    prompt: '不動産・賃貸オーナーが知っておくべき最近のニュースやトレンド。家賃相場、空室、金利、法改正、税制、管理の工夫' },
  { id: 'music', emoji: '🎵', title: '音楽', c1: '#5a3d9a', c2: '#1b1036',
    prompt: '今話題の音楽ニュース。チャート、新曲・新作、ライブ、アーティストの話題（日本中心、世界も少し）' },
  { id: 'season', emoji: '🍁', title: '日本の四季', c1: '#a3472f', c2: '#35130b',
    prompt: '日本の四季・季節のニュース。天気、桜や紅葉、旬、季節の行事、自然の話題（今日の時期に合ったもの）' },
  { id: 'sekki', emoji: '🌗', title: '二十四節気・七十二候', c1: '#2b5f7a', c2: '#0a2230', auto: true },
  { id: 'fortune', emoji: '🔮', title: '今日の占い・運気', c1: '#4a3a8a', c2: '#120c30', auto: true },
  { id: 'spiritual', emoji: '🔯', title: 'スピリチュアル（世界・日本）', c1: '#6a3d8f', c2: '#1d0f2e',
    prompt: 'スピリチュアルの今話題になっているもの（季節の行事・言い伝えなど定番も可）。効果を断定せず「〜とされる」「〜と言われる」と書く' },
  { id: 'legend', emoji: '👻', title: '都市伝説（世界・日本）', c1: '#3d4a5c', c2: '#0e141c',
    prompt: '都市伝説の今話題になっているもの（テレビ・SNS・ファクトチェックで取り上げられたもの、定番や「実は本当だった話」も可）。真偽がわかっているものはそれも書き、デマを事実のように書かない' },
  { id: 'nutrition', emoji: '💊', title: '分子栄養学・オーソモレキュラー', c1: '#2f6f86', c2: '#0b2833',
    prompt: '分子栄養学・オーソモレキュラー・栄養素（ビタミン、ミネラル、脂肪酸など）に関する最近の研究やニュース。エビデンスの強さも一言添えて' },
];

// 聞いてほしい人（ターゲット）。再生は基本この順（若い順・女性をまとめて先に）。設定で並べ替えられます
const TARGETS = ['30代女性', '40代女性', '50代女性', '30代男性', '40代男性', '50代男性', 'みんな'];
const TARGET_ICON = { 女性: '👩', 男性: '👨', みんな: '👥' };
const targetIcon = (t) => TARGET_ICON[(t || 'みんな').replace(/^\d+代/, '')] || '👥';

const DEFAULT_STATE = {
  order: BUILTIN.map((s) => s.id),
  hidden: {},
  custom: [],
  userItems: {},
  // ⚠️ 生年月日などの個人情報はここに書かないでください（このファイルは GitHub で公開されています）。
  //    最初は空で、「⚙️ 設定」で入れた内容はこの端末のブラウザの中だけに保存されます。
  birth: { date: '', time: '', place: '', lat: '', lon: '', tz: 9, placeName: '' },
  voice: 'male',
  voiceURI: '', // 「声をくわしく選ぶ」で選んだ端末の声
  rate: 1,
  playOrder: 'target', // target＝ターゲット順 / index＝目次の順
  targetOrder: TARGETS.slice(),
  muted: false,
  edge: true,
  readTalk: true,
};

function loadJSON(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; }
}
function saveJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* 保存できない環境でも動かす */ }
}

const state = Object.assign(structuredClone(DEFAULT_STATE), loadJSON(STORE_KEY, {}));
state.birth = Object.assign({}, DEFAULT_STATE.birth, state.birth);
// 新しく増えた最初からの項目があれば、順番の最後に足す
for (const s of BUILTIN) if (!state.order.includes(s.id)) state.order.push(s.id);
for (const c of state.custom) if (!state.order.includes(c.id)) state.order.push(c.id);
for (const t of TARGETS) if (!state.targetOrder.includes(t)) state.targetOrder.push(t);
state.targetOrder = state.targetOrder.filter((t) => TARGETS.includes(t));
const save = () => saveJSON(STORE_KEY, state);

let aiCache = loadJSON(AI_KEY, { sections: {} });

const allSections = () => [...BUILTIN, ...state.custom.map((c) => ({ ...c, custom: true, c1: '#1f5f6f', c2: '#08242b' }))];
const sectionById = (id) => allSections().find((s) => s.id === id);
const orderedSections = () => state.order.map(sectionById).filter(Boolean);

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const jpDate = (s) => { const [y, m, d] = s.split('-').map(Number); return `${y}年${m}月${d}日`; };
const WEEK = '日月火水木金土';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '');

function today() { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }

// 生年月日がまだ入っていないときは null（占いの代わりに「入れてください」と出す）
function birthForCalc() {
  const b = state.birth;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date || '')) return null;
  const [y, m, d] = b.date.split('-').map(Number);
  // 場所が決まっていないときは緯度・経度を使わない（アセンダントは出さない）
  const lat = b.place ? Number(b.lat) : NaN;
  const lon = b.place ? Number(b.lon) : NaN;
  return { y, m, d, time: b.time || '', lat, lon, tz: Number(b.tz ?? 9), placeName: b.placeName || '' };
}

const BIRTH_PROMPT_ITEM = {
  target: 'みんな',
  title: '🎂 生年月日を入れると、毎日の占いが出ます',
  summary: '下の「🎂 生年月日を変える」か「⚙️ 設定」で、生年月日（わかれば時間と生まれた場所も）を入れてください。',
  detail: '入れた生年月日は、この端末のブラウザの中だけに保存されます。GitHub やインターネットには載りません。',
  talk: '生年月日を教えてくれたら、毎日の運気を見てあげるね。',
};

// ---------- 各項目の記事を集める ----------
function itemsFor(sec) {
  const t = today();
  const todayStr = ymd(t);
  let items = [];
  if (sec.id === 'fortune') { const b = birthForCalc(); items = b ? KurageFortune.fortuneItems(b, t) : [{ ...BIRTH_PROMPT_ITEM }]; }
  else if (sec.id === 'sekki') items = KurageFortune.sekkiItems(t);
  else {
    const ai = aiCache.sections[sec.id];
    if (ai && ai.items && ai.items.length) items = ai.items.map((x) => ({ ...x, asOf: ai.date }));
    else if (!sec.custom && window.KURAGE_NEWS?.sections?.[sec.id]) items = KURAGE_NEWS.sections[sec.id].map((x) => ({ ...x, asOf: KURAGE_NEWS.date }));
    if (sec.id === 'season') items = [KurageFortune.shunItem(t), ...items];
  }
  const mine = (state.userItems[sec.id] || []).map((x, i) => ({ ...x, mine: i }));
  return [...items, ...mine].map((x) => ({ ...x, asOf: x.asOf || (x.kind ? todayStr : x.date) }));
}

// ---------- クラゲのピクセルキャラ ----------
const KURAGE_TOP = [
  '....XXXXX....',
  '..XHHXXXXXX..',
  '.XHXXXXXXXXX.',
  'XHXEEXXXEEXXX',
  'XXXEEXXXEEXXX',
  'XXPXXXXXXXPXX',
  '.XXXXXXXXXXX.',
];
const KURAGE_LEGS = [
  ['.X..X.X.X..X.', 'X..X..X..X..X', '.X..X...X..X.'],
  ['..X.X.X.X.X..', '.X..X...X..X.', 'X..X..X..X..X'],
];
function kurageSVG(color = '#7fd8f6') {
  const fill = { X: color, H: '#e3f9ff', E: '#0d3550', P: '#ffb3c7' };
  const rects = (rows, y0, cls) => rows.map((row, y) => [...row].map((ch, x) => (fill[ch]
    ? `<rect x="${x}" y="${y + y0}" width="1.02" height="1.02" fill="${fill[ch]}"${ch === 'E' ? ' class="eye"' : ''}/>` : '')).join('')).join('');
  return `<svg class="kurage-svg" viewBox="0 0 13 11" shape-rendering="crispEdges" aria-hidden="true">` +
    rects(KURAGE_TOP, 0) +
    `<g class="f1">${rects(KURAGE_LEGS[0], 7)}</g><g class="f2">${rects(KURAGE_LEGS[1], 7)}</g></svg>`;
}

// ---------- クラゲの日常の動き ----------
// 小さなクラゲが、ランダムにいろいろなことをします（歩く・寝る・お茶・新聞…）
const KG_ACTIONS = [
  { act: 'idle', ms: 2600 },
  { act: 'walk', ms: 2400, move: true },
  { act: 'walk', ms: 2400, move: true },
  { act: 'jump', ms: 1500 },
  { act: 'sleep', ms: 5200, prop: '💤' },
  { act: 'busy', ms: 3600, prop: '🍵' },
  { act: 'busy', ms: 3600, prop: '📰' },
  { act: 'busy', ms: 3800, prop: '💻' },
  { act: 'busy', ms: 3200, prop: '🍙' },
  { act: 'busy', ms: 3400, prop: '📱' },
  { act: 'busy', ms: 3400, prop: '🌱' },
  { act: 'dance', ms: 3000, prop: '🎵' },
  { act: 'stretch', ms: 2200 },
  { act: 'look', ms: 2400 },
  { act: 'sneeze', ms: 1700, prop: '💦' },
  { act: 'spin', ms: 1300 },
  { act: 'sway', ms: 3200, prop: '☂️' },
  { act: 'sway', ms: 3000, prop: '🎈' },
];
function kurageHTML() {
  return `<span class="kg" data-act="idle" data-dir="right"><span class="kg-flip"><span class="kg-body">${kurageSVG()}</span></span><span class="kg-prop"></span></span>`;
}
const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
function kurageTick() {
  const now = Date.now();
  const vh = window.innerHeight;
  document.querySelectorAll('.kg').forEach((kg) => {
    if (now < (kg._until || 0)) return;
    const r = kg.getBoundingClientRect();
    if (r.bottom < 0 || r.top > vh || (!r.width && !r.height)) return; // 見えていないクラゲは休ませる
    const stage = kg.parentElement.classList.contains('kg-stage') ? kg.parentElement : null;
    let a;
    do { a = KG_ACTIONS[Math.floor(Math.random() * KG_ACTIONS.length)]; } while ((a.move && !stage) || (a.act === kg.dataset.act && a.prop === kg._prop));
    kg.dataset.act = a.act;
    kg._prop = a.prop;
    kg.querySelector('.kg-prop').textContent = a.prop || '';
    kg._until = now + a.ms + Math.random() * 1200;
    if (a.move) {
      const max = Math.max(0, stage.clientWidth - kg.offsetWidth - 20);
      const cur = parseFloat(kg.style.left) || 40;
      const next = Math.round(Math.random() * max);
      kg.dataset.dir = next < cur ? 'left' : 'right';
      kg.style.left = `${next}px`;
    } else if (Math.random() < 0.3) {
      kg.dataset.dir = kg.dataset.dir === 'left' ? 'right' : 'left';
    }
  });
}
function setupKurageActors() {
  if (reduceMotion) return;
  setInterval(kurageTick, 600);
}

// ---------- 表示 ----------
function renderHeader() {
  const t = new Date();
  $('todayLabel').textContent = `${t.getFullYear()}年${t.getMonth() + 1}月${t.getDate()}日（${WEEK[t.getDay()]}）`;
  const brand = document.querySelector('.brand-kurage');
  if (!brand.firstChild) brand.innerHTML = kurageHTML();
}

function renderStale() {
  const todayStr = ymd(today());
  const usingOld = orderedSections().some((s) => !s.auto && !state.hidden[s.id] && !s.custom &&
    !(aiCache.sections[s.id]?.date === todayStr) && KURAGE_NEWS.date !== todayStr);
  const note = $('staleNote');
  if (usingOld) {
    note.hidden = false;
    note.innerHTML = `📅 ニュースは <b>${jpDate(KURAGE_NEWS.date)}</b> 時点の内容が入っています（占い・節気・旬は毎日自動で今日の内容になります）。` +
      `<br>⚙️ 設定の「🤖 Claudeで更新」を使うと、今日のニュースに入れ替えられます。`;
  } else note.hidden = true;
}

function renderIndex() {
  const list = $('indexList');
  list.innerHTML = '';
  orderedSections().forEach((s, i) => {
    const li = document.createElement('li');
    li.dataset.id = s.id;
    if (state.hidden[s.id]) li.classList.add('hidden-sec');
    const n = state.hidden[s.id] ? '非表示' : `${itemsFor(s).length}件`;
    li.innerHTML = `<span class="handle" title="ドラッグで並べ替え" aria-label="${esc(s.title)}を並べ替え">≡</span>` +
      `<span class="idx-no">${i + 1}.</span>` +
      `<a class="idx-link" href="#sec-${esc(s.id)}">${esc(s.emoji || '📌')} ${esc(s.title)}</a>` +
      `<span class="idx-count">${n}</span>`;
    list.appendChild(li);
  });
}

function renderSections() {
  const wrap = $('sections');
  wrap.innerHTML = '';
  const hasKey = !!getApiKey();
  orderedSections().forEach((s) => {
    if (state.hidden[s.id]) return;
    const items = itemsFor(s);
    const sec = document.createElement('section');
    sec.className = 'section';
    sec.id = `sec-${s.id}`;
    sec.innerHTML = `<div class="section-head"><h2>${esc(s.emoji || '📌')} ${esc(s.title)}</h2><div class="btns">` +
      (items.length ? `<button type="button" class="small" data-act="readsec">▶ ここから再生</button>` : '') +
      (!s.auto ? `<button type="button" class="small" data-act="write">✏️ 書く</button>` : '') +
      (!s.auto && hasKey ? `<button type="button" class="small" data-act="ai">🤖 今日のニュースに更新</button>` : '') +
      (s.id === 'fortune' ? `<button type="button" class="small" data-act="birth">🎂 生年月日を変える</button>` : '') +
      (s.custom ? `<button type="button" class="small" data-act="delsec">🗑 項目を消す</button>` : '') +
      `</div></div>`;
    if (!items.length) {
      const p = document.createElement('p');
      p.className = 'empty';
      p.textContent = s.custom
        ? '「✏️ 書く」で自分でニュースやメモを足せます。APIキーを設定すると「🤖 今日のニュースに更新」でClaudeが調べて入れます。'
        : 'まだ記事がありません。';
      sec.appendChild(p);
    }
    items.forEach((it, i) => sec.appendChild(renderCard(s, it, i)));
    sec.querySelector('.section-head').addEventListener('click', (e) => onSectionAction(e, s));
    sec.querySelector('.section-head h2').addEventListener('click', () => { if (items.length) player.playFrom(cardKey(s.id, 0)); });
    wrap.appendChild(sec);
  });
  buildPlaylist();
}

const regionLabel = (r) => (r === '日本' ? '🗾 日本発信' : '🌍 世界発信');

function renderCard(sec, it, i) {
  const card = document.createElement('article');
  card.className = 'news-card';
  card.dataset.sec = sec.id;
  card.dataset.idx = i;
  const srcs = (it.sources || []).filter((s) => safeUrl(s.url))
    .map((s) => `<a href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">${esc(s.name || s.url)}</a>`).join('、');
  card.innerHTML =
    `<div class="banner" style="--c1:${sec.c1};--c2:${sec.c2}">` +
      `<span class="banner-tag">${esc(sec.emoji || '📌')} #${i + 1}${it.region ? `　${regionLabel(it.region)}` : ''}${it.asOf ? `　${Number(it.asOf.slice(5, 7))}/${Number(it.asOf.slice(8, 10))}` : ''}</span>` +
      `<div class="kg-stage">${kurageHTML()}</div>` +
      `<div class="telop">${esc(it.telop || it.title)}</div>` +
    `</div>` +
    `<div class="card-body">` +
      `<p class="chips"><span class="chip">${targetIcon(it.target)} ${esc(it.target || 'みんな')}</span>` +
      (it.region ? `<span class="chip ${it.region === '日本' ? 'jp' : 'world'}">${regionLabel(it.region)}</span>` : '') +
      `<span class="tap-hint">▶ タップでここから再生</span></p>` +
      `<h3>${esc(it.title)}</h3>` +
      (it.summary ? `<p class="summary">${esc(it.summary)}</p>` : '') +
      (it.world ? `<p class="world">${esc(it.world)}</p>` : '') +
      (it.detail ? `<p class="detail">${esc(it.detail)}</p>` : '') +
      (it.talk ? `<p class="talk">${esc(it.talk)}</p>` : '') +
      (srcs ? `<p class="sources">出典：${srcs}</p>` : '') +
      `<div class="card-actions"><button type="button" class="small" data-act="read">🔊 ここから再生</button>` +
      (it.mine != null ? `<button type="button" class="small" data-act="edit">✏️ 直す</button><button type="button" class="small" data-act="del">🗑 消す</button>` : '') +
      `</div>` +
    `</div>`;
  // 記事のどこを押しても、その記事から再生（リンクや他のボタンは別）
  card.addEventListener('click', (e) => {
    if (e.target.closest('a, button, input, select, textarea')) return;
    if (window.getSelection && String(window.getSelection()).length) return; // 文字を選んでいるときは再生しない
    player.playFrom(cardKey(sec.id, i));
  });
  card.querySelector('.card-actions').addEventListener('click', (e) => {
    const act = e.target.closest('button')?.dataset.act;
    if (act === 'read') player.playFrom(cardKey(sec.id, i));
    if (act === 'edit') openItemDialog(sec.id, it.mine);
    if (act === 'del' && confirm('この記事を消しますか？')) {
      state.userItems[sec.id].splice(it.mine, 1);
      save(); renderAll();
    }
  });
  return card;
}

function onSectionAction(e, s) {
  const act = e.target.closest('button')?.dataset.act;
  if (!act) return;
  if (act === 'readsec') player.playFrom(cardKey(s.id, 0));
  if (act === 'write') openItemDialog(s.id, null);
  if (act === 'birth') openSettings(true);
  if (act === 'ai') runAI([s.id]);
  if (act === 'delsec' && confirm(`「${s.title}」の項目を消しますか？（書いた記事も消えます）`)) {
    state.custom = state.custom.filter((c) => c.id !== s.id);
    state.order = state.order.filter((id) => id !== s.id);
    delete state.userItems[s.id];
    delete aiCache.sections[s.id];
    saveJSON(AI_KEY, aiCache);
    save(); renderAll();
  }
}

function renderAll() {
  const wasPlaying = player.playing;
  const key = player.currentKey();
  renderStale();
  renderIndex();
  renderSections();
  if (wasPlaying && key) player.relocate(key);
}

// ---------- 目次のドラッグ＆ドロップ（指でもマウスでも） ----------
function setupDrag() {
  const list = $('indexList');
  let drag = null;

  list.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest('.handle');
    if (!handle) return;
    e.preventDefault();
    const li = handle.closest('li');
    const rect = li.getBoundingClientRect();
    drag = { li, startY: e.clientY, offset: 0, pointerId: e.pointerId, height: rect.height };
    li.classList.add('dragging');
    handle.setPointerCapture(e.pointerId);
    if (navigator.vibrate) try { navigator.vibrate(10); } catch { /* なくてもよい */ }
  });

  list.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    e.preventDefault();
    const dy = e.clientY - drag.startY;
    drag.li.style.transform = `translateY(${dy - drag.offset}px)`;
    // となりの行と中心を越えたら入れ替える
    const prev = drag.li.previousElementSibling;
    const next = drag.li.nextElementSibling;
    const me = drag.li.getBoundingClientRect();
    const myMid = me.top + me.height / 2;
    if (prev && myMid < prev.getBoundingClientRect().top + prev.offsetHeight / 2) {
      const h = prev.getBoundingClientRect().height + 6;
      list.insertBefore(drag.li, prev);
      drag.offset -= h;
      drag.li.style.transform = `translateY(${dy - drag.offset}px)`;
    } else if (next && myMid > next.getBoundingClientRect().top + next.offsetHeight / 2) {
      const h = next.getBoundingClientRect().height + 6;
      list.insertBefore(next, drag.li);
      drag.offset += h;
      drag.li.style.transform = `translateY(${dy - drag.offset}px)`;
    }
    // 画面の端に来たら自動でスクロール
    if (e.clientY < 70) window.scrollBy(0, -8);
    else if (e.clientY > window.innerHeight - 140) window.scrollBy(0, 8);
  });

  const end = (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    drag.li.classList.remove('dragging');
    drag.li.style.transform = '';
    drag = null;
    const newOrder = [...list.children].map((li) => li.dataset.id);
    if (newOrder.join() !== state.order.join()) {
      state.order = newOrder;
      save();
      renderAll();
    }
  };
  list.addEventListener('pointerup', end);
  list.addEventListener('pointercancel', end);

  list.addEventListener('click', (e) => {
    const a = e.target.closest('.idx-link');
    if (!a) return;
    e.preventDefault();
    const id = a.closest('li').dataset.id;
    if (state.hidden[id]) { delete state.hidden[id]; save(); renderAll(); }
    $(`sec-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

// =============================================================
// 音声読み上げ
// =============================================================
const MALE_RE = /otoya|ichiro|keita|daichi|naoki|masaru|hattori|takumi|kenji|hiroshi|男性|\bmale\b/i;
const FEMALE_RE = /kyoko|o-?ren|ayumi|haruka|sayaka|nanami|mayu|shiori|mizuki|kanade|hikari|aoi|google\s*日本語|女性|female/i;
let jaVoices = [];
// 声の聞きやすさ：0 がいちばん自然（プレミアム・拡張・Natural などの高品質な声）
const voiceQuality = (v) => (/premium|enhanced|拡張|プレミアム|siri|natural|neural/i.test(v.name) ? 0
  : /online|google/i.test(v.name) ? 1 : 2);
function loadVoices() {
  const all = synth ? synth.getVoices() : [];
  jaVoices = all.filter((v) => /^ja([-_]|$)/i.test(v.lang));
  jaVoices.sort((a, b) => voiceQuality(a) - voiceQuality(b));
  renderVoicePicker();
}
// 落ち着いた声：声の高さはなるべく自然のまま（機械っぽくならないように）、少しだけゆっくり
function voiceSetting(kind) {
  const picked = state.voiceURI && jaVoices.find((v) => v.voiceURI === state.voiceURI);
  if (picked) return { voice: picked, pitch: 1, rate: 0.97 };
  const males = jaVoices.filter((v) => MALE_RE.test(v.name));
  const females = jaVoices.filter((v) => !MALE_RE.test(v.name));
  if (kind === 'male') {
    if (males.length) return { voice: males[0], pitch: 0.95, rate: 0.95 };
    // 男性の声がない端末では、女性の声を少しだけ低くする（低くしすぎると聞きにくいので控えめに）
    return { voice: females[0] || jaVoices[0] || null, pitch: 0.8, rate: 0.95 };
  }
  return { voice: females[0] || jaVoices[0] || null, pitch: 1, rate: 0.97 };
}
function renderVoicePicker() {
  const sel = $('voicePick');
  if (!sel) return;
  sel.innerHTML = '';
  sel.add(new Option('おまかせ（上の「男性／女性」から自動で選ぶ）', ''));
  for (const v of jaVoices) sel.add(new Option(`${voiceQuality(v) === 0 ? '⭐ ' : ''}${v.name}`, v.voiceURI));
  sel.value = jaVoices.some((v) => v.voiceURI === state.voiceURI) ? state.voiceURI : '';
  $('voiceNote').textContent = !jaVoices.length
    ? '日本語の声を読み込み中です（出てこないときは、端末の設定で日本語の読み上げ音声を追加してください）。'
    : jaVoices.some((v) => voiceQuality(v) === 0)
      ? '⭐ は自然で聞きやすい高品質な声です。'
      : 'もっと聞きやすくするには：iPhone は「設定 → アクセシビリティ → 読み上げコンテンツ → 声 → 日本語」で「拡張」や「プレミアム」の声をダウンロードしてください（Siri の声も選べます）。パソコンは Microsoft Edge を使うと自然な「Nanami」「Keita」の声が使えます。';
}

function speechText(sec, it) {
  const who = it.target && it.target !== 'みんな' ? `${it.target}向け、` : '';
  const from = it.region ? `${it.region}発信。` : '';
  const parts = [`${sec.title}。${who}${from}`, it.title + '。'];
  if (it.summary) parts.push(it.summary);
  if (it.world) parts.push('世界から見ると、' + it.world);
  if (it.detail) parts.push(it.detail);
  if (it.talk && state.readTalk) parts.push('話すときは、' + it.talk);
  return parts.join('\n')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
    .replace(/[★☆]+/g, (m) => `星${(m.match(/★/g) || []).length}つ。`)
    .replace(/〜/g, 'から').replace(/…/g, '、').replace(/[「」『』（）()“”]/g, ' ').replace(/[＝=]/g, 'イコール');
}
function splitChunks(text) {
  const out = [];
  for (const part of text.split(/(?<=[。！？!?\n])/)) {
    let p = part.trim();
    while (p.length > 120) { out.push(p.slice(0, 120)); p = p.slice(120); }
    if (p) out.push(p);
  }
  return out;
}

// iPhone などでは、ページが「音を再生中」になると、ほかのアプリの音楽が止まります。
// 読み上げのあいだ、無音の音声を流して音の出口をこのアプリに切り替えます。
const audioFocus = {
  el: null,
  silentUrl() {
    const rate = 8000, n = rate; // 1秒ぶんの無音（8bit）
    const buf = new ArrayBuffer(44 + n);
    const v = new DataView(buf);
    const w = (o, str) => [...str].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
    w(36, 'data'); v.setUint32(40, n, true);
    for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  },
  start() {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* 対応していないブラウザ */ }
    try {
      if (!this.el) {
        this.el = new Audio(this.silentUrl());
        this.el.loop = true;
        this.el.setAttribute('playsinline', '');
      }
      this.el.play().catch(() => {});
    } catch { /* 音声を流せない環境でも読み上げは続ける */ }
    this.updateMedia();
  },
  stop() { try { this.el && this.el.pause(); } catch { /* なにもしない */ } },
  updateMedia() {
    if (!('mediaSession' in navigator)) return;
    const p = playlist[player.idx];
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: p ? p.it.title : 'クラゲのニューストピック',
        artist: p ? `${p.sec.title}｜${p.it.target || 'みんな'}` : 'クラゲのニューストピック',
        album: 'クラゲのニューストピック',
        artwork: [{ src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }],
      });
      navigator.mediaSession.playbackState = player.playing ? 'playing' : 'paused';
    } catch { /* なにもしない */ }
  },
};

const cardKey = (secId, i) => `${secId}:${i}`;
let playlist = [];
function buildPlaylist() {
  playlist = [];
  orderedSections().forEach((s) => {
    if (state.hidden[s.id]) return;
    itemsFor(s).forEach((it, i) => playlist.push({ key: cardKey(s.id, i), sec: s, it }));
  });
  if (state.playOrder === 'target') {
    // 同じターゲットの中は目次の順のまま（安定ソート）
    const rank = (it) => { const r = state.targetOrder.indexOf(it.target || 'みんな'); return r < 0 ? 99 : r; };
    playlist = playlist.map((p, n) => ({ ...p, n })).sort((a, b) => rank(a.it) - rank(b.it) || a.n - b.n);
  }
  if (typeof player !== 'undefined' && !player.playing) {
    player.idx = Math.min(player.idx, Math.max(0, playlist.length - 1));
    player.prepare();
  }
}

const player = {
  playing: false,
  idx: 0,
  chunk: 0,
  chunks: [],
  token: 0,
  currentKey() { return playlist[this.idx]?.key; },
  playFrom(key) {
    const i = playlist.findIndex((p) => p.key === key);
    this.idx = i < 0 ? 0 : i;
    this.chunk = 0;
    this.prepare();
    if (state.muted) setMuted(false);
    this.start();
  },
  relocate(key) {
    const i = playlist.findIndex((p) => p.key === key);
    if (i >= 0) { this.idx = i; this.prepare(); this.highlight(); }
  },
  prepare() {
    const p = playlist[this.idx];
    this.chunks = p ? splitChunks(speechText(p.sec, p.it)) : [];
  },
  start() {
    if (!synth) { alert('このブラウザは音声読み上げに対応していません。'); return; }
    if (!playlist.length) return;
    this.playing = true;
    audioFocus.start();
    updatePlayerUI();
    this.highlight(true);
    this.speak();
  },
  speak() {
    synth.cancel();
    const my = ++this.token;
    if (!this.playing || state.muted) return;
    if (this.chunk >= this.chunks.length) { this.next(true); return; }
    const u = new SpeechSynthesisUtterance(this.chunks[this.chunk]);
    const vs = voiceSetting(state.voice);
    if (vs.voice) try { u.voice = vs.voice; } catch { /* 声を選べない環境ではふつうの声で */ }
    u.lang = 'ja-JP';
    u.pitch = vs.pitch;
    u.rate = Math.max(0.1, Math.min(10, vs.rate * state.rate));
    u.onend = () => {
      if (my !== this.token || !this.playing) return;
      this.chunk++;
      setTimeout(() => { if (my === this.token && this.playing) this.speak(); }, this.chunk >= this.chunks.length ? 700 : 250);
    };
    u.onerror = (e) => {
      if (my !== this.token || e.error === 'interrupted' || e.error === 'canceled') return;
      this.chunk++;
      this.speak();
    };
    synth.speak(u);
  },
  next(auto = false) {
    if (this.idx >= playlist.length - 1) {
      if (auto) { this.stop(); $('nowReading').textContent = '✅ 最後まで読みました'; return; }
      return;
    }
    this.idx++;
    this.chunk = 0;
    this.prepare();
    this.highlight(true);
    if (this.playing) this.speak();
  },
  prev() {
    this.idx = this.chunk > 0 ? this.idx : Math.max(0, this.idx - 1);
    this.chunk = 0;
    this.prepare();
    this.highlight(true);
    if (this.playing) this.speak();
  },
  pause() {
    this.playing = false;
    this.token++;
    synth && synth.cancel();
    audioFocus.stop();
    audioFocus.updateMedia();
    updatePlayerUI();
  },
  stop() {
    this.pause();
    this.idx = 0;
    this.chunk = 0;
    this.prepare();
    document.querySelectorAll('.news-card.reading').forEach((c) => c.classList.remove('reading'));
    $('nowReading').textContent = '▶ を押すか、記事をタップすると読み上げます';
  },
  restartChunk() { if (this.playing) this.speak(); },
  highlight(scroll = false) {
    document.querySelectorAll('.news-card.reading').forEach((c) => c.classList.remove('reading'));
    const p = playlist[this.idx];
    if (!p) return;
    const [sec, i] = p.key.split(':');
    const card = document.querySelector(`.news-card[data-sec="${CSS.escape(sec)}"][data-idx="${i}"]`);
    if (card) {
      card.classList.add('reading');
      if (scroll) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    $('nowReading').textContent = `${targetIcon(p.it.target)} ${p.it.target || 'みんな'}｜${p.sec.emoji || ''} ${p.it.title}`;
    audioFocus.updateMedia();
  },
};

function updatePlayerUI() {
  $('btnPlay').textContent = player.playing ? '⏸' : '▶';
  $('btnPlay').setAttribute('aria-label', player.playing ? '一時停止' : '読み上げる');
  $('btnMute').textContent = state.muted ? '🔇' : '🔊';
  $('btnMute').classList.toggle('on', state.muted);
  $('btnMute').setAttribute('aria-label', state.muted ? 'ミュートを解除' : 'ミュート');
}

function setMuted(m) {
  state.muted = m;
  save();
  if (m) { player.token++; synth && synth.cancel(); }
  else if (player.playing) player.speak();
  updatePlayerUI();
}

function setupPlayer() {
  $('voiceSel').value = state.voice;
  $('rate').value = state.rate;
  $('rateLabel').textContent = Number(state.rate).toFixed(1);
  updatePlayerUI();
  $('btnPlay').addEventListener('click', () => {
    if (player.playing) { player.pause(); return; }
    if (!player.chunks.length || player.chunk === 0) player.prepare();
    if (state.muted) setMuted(false);
    player.start();
  });
  $('btnStop').addEventListener('click', () => player.stop());
  $('btnNext').addEventListener('click', () => player.next());
  $('btnPrev').addEventListener('click', () => player.prev());
  $('btnMute').addEventListener('click', () => setMuted(!state.muted));
  $('voiceSel').addEventListener('change', (e) => { state.voice = e.target.value; save(); player.restartChunk(); });
  let rateTimer;
  $('rate').addEventListener('input', (e) => {
    state.rate = Number(e.target.value);
    $('rateLabel').textContent = state.rate.toFixed(1);
    save();
    clearTimeout(rateTimer);
    rateTimer = setTimeout(() => player.restartChunk(), 250);
  });
  if (synth) {
    loadVoices();
    synth.addEventListener?.('voiceschanged', loadVoices);
  }
  // ロック画面やイヤホンのボタンでも操作できるように
  if ('mediaSession' in navigator) {
    const h = (name, fn) => { try { navigator.mediaSession.setActionHandler(name, fn); } catch { /* 未対応 */ } };
    h('play', () => { if (!player.playing) player.start(); });
    h('pause', () => player.pause());
    h('nexttrack', () => player.next());
    h('previoustrack', () => player.prev());
  }
  window.addEventListener('pagehide', () => synth && synth.cancel());
}

// =============================================================
// 画面の端にときどき出てくるクラゲ
// =============================================================
const KURAGE_LINES = ['ぷかぷか〜', '今日もいい日！', 'ニュース読んだ？', '深呼吸しよ', 'ふわ〜', 'やっほー', 'お水のんでね', 'クラゲだよ'];
function setupEdgeKurage() {
  const el = $('edgeKurage');
  el.innerHTML = kurageHTML();
  const schedule = () => setTimeout(show, 12000 + Math.random() * 28000);
  function show() {
    if (!state.edge || document.hidden) { schedule(); return; }
    const sides = ['left', 'right', 'top', 'bottom', 'across'];
    const side = sides[Math.floor(Math.random() * sides.length)];
    el.className = 'edge-kurage';
    el.style.cssText = '';
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const playerH = document.querySelector('.player').offsetHeight;
    const y = 90 + Math.random() * Math.max(40, vh - playerH - 200);
    const x = 30 + Math.random() * Math.max(40, vw - 120);
    if (side === 'left') Object.assign(el.style, { left: '0px', top: `${y}px` });
    if (side === 'right') Object.assign(el.style, { right: '0px', top: `${y}px` });
    if (side === 'top') Object.assign(el.style, { top: '0px', left: `${x}px` });
    if (side === 'bottom') Object.assign(el.style, { bottom: `${playerH}px`, left: `${x}px` });
    if (side === 'across') Object.assign(el.style, { left: '0px', top: `${y}px` });
    el.style.setProperty('--anim', { left: 'peekLeft', right: 'peekRight', top: 'peekTop', bottom: 'floatUp', across: 'swimAcross' }[side]);
    void el.offsetWidth; // アニメーションを最初から
    el.classList.add('show');
    setTimeout(() => { el.classList.remove('show'); el.querySelector('.say')?.remove(); schedule(); }, 6600);
  }
  el.addEventListener('click', () => {
    el.querySelector('.say')?.remove();
    const say = document.createElement('span');
    say.className = 'say';
    say.textContent = KURAGE_LINES[Math.floor(Math.random() * KURAGE_LINES.length)];
    el.appendChild(say);
  });
  setTimeout(show, 4000);
}

// =============================================================
// ダイアログ（項目を足す・記事を書く・設定）
// =============================================================
function setupAddDialog() {
  $('btnAddSection').addEventListener('click', () => {
    $('addTitle').value = ''; $('addEmoji').value = ''; $('addPrompt').value = '';
    $('dlgAdd').showModal();
  });
  $('dlgAdd').addEventListener('close', () => {
    if ($('dlgAdd').returnValue !== 'ok') return;
    const title = $('addTitle').value.trim();
    if (!title) return;
    const id = 'c' + Date.now().toString(36);
    state.custom.push({ id, title, emoji: $('addEmoji').value.trim() || '📌', prompt: $('addPrompt').value.trim() || `${title}に関する今日の話題やニュース` });
    state.order.push(id);
    save();
    renderAll();
    $(`sec-${id}`)?.scrollIntoView({ behavior: 'smooth' });
  });
}

let editing = null;
function openItemDialog(secId, mineIdx) {
  editing = { secId, mineIdx };
  const it = mineIdx != null ? state.userItems[secId][mineIdx] : {};
  $('dlgItemTitle').textContent = mineIdx != null ? '✏️ 記事を直す' : `✏️ 「${sectionById(secId).title}」に書く`;
  $('itemTelop').value = it.telop || '';
  $('itemTitle').value = it.title || '';
  $('itemSummary').value = it.summary || '';
  $('itemDetail').value = it.detail || '';
  $('itemTalk').value = it.talk || '';
  $('itemUrl').value = it.sources?.[0]?.url || '';
  $('dlgItem').showModal();
}
function setupItemDialog() {
  $('dlgItem').addEventListener('close', () => {
    if ($('dlgItem').returnValue !== 'ok' || !editing) return;
    const url = $('itemUrl').value.trim();
    const item = {
      telop: $('itemTelop').value.trim(),
      title: $('itemTitle').value.trim(),
      summary: $('itemSummary').value.trim(),
      detail: $('itemDetail').value.trim(),
      talk: $('itemTalk').value.trim(),
      sources: safeUrl(url) ? [{ name: new URL(url).hostname, url }] : [],
      date: ymd(today()),
    };
    if (!item.title) return;
    const arr = (state.userItems[editing.secId] ||= []);
    if (editing.mineIdx != null) arr[editing.mineIdx] = item; else arr.push(item);
    save();
    renderAll();
  });
}

function getApiKey() { try { return localStorage.getItem(APIKEY_KEY) || ''; } catch { return ''; } }

function openSettings(focusBirth = false) {
  const b = state.birth;
  $('bDate').value = b.date;
  $('bTime').value = b.time || '';
  $('bTimeUnknown').checked = !!b.date && !b.time;
  $('bTime').disabled = $('bTimeUnknown').checked;
  const sel = $('bPlace');
  if (!sel.options.length) {
    sel.add(new Option('（生まれた場所を選ぶ）', ''));
    for (const [name] of KurageFortune.PLACES) sel.add(new Option(name, name));
    sel.add(new Option('その他（緯度・経度を自分で入れる）', 'custom'));
  }
  sel.value = !b.place ? '' : KurageFortune.PLACES.some(([n]) => n === b.place) ? b.place : 'custom';
  $('customPlace').hidden = sel.value !== 'custom';
  $('bLat').value = b.lat; $('bLon').value = b.lon; $('bTz').value = b.tz ?? 9; $('bPlaceName').value = b.placeName || '';
  $('apiKey').value = getApiKey();
  $('optEdge').checked = state.edge;
  $('optReadTalk').checked = state.readTalk;
  renderToggles();
  renderVoicePicker();
  renderPlayOrder();
  $('dlgSettings').showModal();
  if (focusBirth) $('bDate').focus();
}

function renderToggles() {
  const box = $('sectionToggles');
  box.innerHTML = '';
  orderedSections().forEach((s) => {
    const row = document.createElement('label');
    row.className = 'toggle-row';
    row.innerHTML = `<span>${esc(s.emoji || '📌')} ${esc(s.title)}</span><input type="checkbox" ${state.hidden[s.id] ? '' : 'checked'}>`;
    row.querySelector('input').addEventListener('change', (e) => {
      if (e.target.checked) delete state.hidden[s.id]; else state.hidden[s.id] = true;
      save(); renderAll();
    });
    box.appendChild(row);
  });
}

function renderPlayOrder() {
  document.querySelectorAll('input[name=playOrder]').forEach((r) => { r.checked = r.value === state.playOrder; });
  const box = $('targetOrder');
  box.innerHTML = '';
  state.targetOrder.forEach((t, i) => {
    const row = document.createElement('div');
    row.className = 'toggle-row';
    row.innerHTML = `<span>${i + 1}. ${targetIcon(t)} ${esc(t)}</span><span class="updown">` +
      `<button type="button" class="small" data-mv="-1" ${i ? '' : 'disabled'} aria-label="${esc(t)}を上へ">▲</button>` +
      `<button type="button" class="small" data-mv="1" ${i < state.targetOrder.length - 1 ? '' : 'disabled'} aria-label="${esc(t)}を下へ">▼</button></span>`;
    row.addEventListener('click', (e) => {
      const mv = Number(e.target.closest('button')?.dataset.mv || 0);
      if (!mv) return;
      const a = state.targetOrder;
      [a[i], a[i + mv]] = [a[i + mv], a[i]];
      save(); renderPlayOrder(); renderIndexNote(); buildPlaylist();
    });
    box.appendChild(row);
  });
  box.hidden = state.playOrder !== 'target';
}
function renderIndexNote() {
  $('orderNote').textContent = state.playOrder === 'target'
    ? `▶ 再生の順番：${state.targetOrder.filter((t) => t !== 'みんな').join('→')}（⚙️ 設定で変えられます）`
    : '▶ 再生の順番：目次の順（⚙️ 設定で変えられます）';
}

function saveBirth() {
  const sel = $('bPlace').value;
  const b = state.birth;
  b.date = $('bDate').value || b.date;
  b.time = $('bTimeUnknown').checked ? '' : ($('bTime').value || '');
  if (sel === '') {
    Object.assign(b, { place: '', lat: '', lon: '', tz: 9, placeName: '' });
  } else if (sel === 'custom') {
    b.place = 'custom';
    b.lat = Number($('bLat').value) || 0;
    b.lon = Number($('bLon').value) || 0;
    b.tz = Number($('bTz').value);
    if (!isFinite(b.tz)) b.tz = 9;
    b.placeName = $('bPlaceName').value.trim();
  } else {
    const p = KurageFortune.PLACES.find(([n]) => n === sel);
    Object.assign(b, { place: sel, lat: p[1], lon: p[2], tz: 9, placeName: '' });
  }
  save();
  renderAll();
}

function setupSettings() {
  $('btnSettings').addEventListener('click', () => openSettings());
  ['bDate', 'bTime', 'bLat', 'bLon', 'bTz', 'bPlaceName'].forEach((id) => $(id).addEventListener('change', saveBirth));
  $('bTimeUnknown').addEventListener('change', (e) => {
    $('bTime').disabled = e.target.checked;
    if (!e.target.checked && !$('bTime').value) $('bTime').value = '12:00';
    saveBirth();
  });
  $('bPlace').addEventListener('change', (e) => {
    $('customPlace').hidden = e.target.value !== 'custom';
    if (e.target.value === 'custom') { $('bLat').value = state.birth.lat; $('bLon').value = state.birth.lon; }
    saveBirth();
  });
  $('apiKey').addEventListener('change', (e) => {
    try {
      if (e.target.value.trim()) localStorage.setItem(APIKEY_KEY, e.target.value.trim());
      else localStorage.removeItem(APIKEY_KEY);
    } catch { /* 保存できない環境 */ }
    renderSections();
  });
  $('optEdge').addEventListener('change', (e) => { state.edge = e.target.checked; save(); });
  $('voicePick').addEventListener('change', (e) => { state.voiceURI = e.target.value; save(); player.restartChunk(); });
  $('btnVoiceTest').addEventListener('click', () => {
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance('こんにちは。クラゲのニューストピックです。今日の話題をお届けします。');
    const vs = voiceSetting(state.voice);
    if (vs.voice) try { u.voice = vs.voice; } catch { /* なにもしない */ }
    u.lang = 'ja-JP'; u.pitch = vs.pitch; u.rate = vs.rate * state.rate;
    synth.speak(u);
  });
  document.querySelectorAll('input[name=playOrder]').forEach((r) => r.addEventListener('change', (e) => {
    state.playOrder = e.target.value; save(); renderPlayOrder(); renderIndexNote(); buildPlaylist();
  }));
  $('btnResetTargets').addEventListener('click', () => {
    state.targetOrder = TARGETS.slice(); save(); renderPlayOrder(); renderIndexNote(); buildPlaylist();
  });
  $('optReadTalk').addEventListener('change', (e) => { state.readTalk = e.target.checked; save(); player.prepare(); });
  $('btnResetOrder').addEventListener('click', () => {
    state.order = [...BUILTIN.map((s) => s.id), ...state.custom.map((c) => c.id)];
    save(); renderAll(); renderToggles();
  });
  $('btnUpdateAll').addEventListener('click', () => {
    runAI(orderedSections().filter((s) => !s.auto && !state.hidden[s.id]).map((s) => s.id));
  });
}

// ---------- Claude でニュースを更新（ai.js を使います） ----------
let aiRunning = false;
async function runAI(ids) {
  const key = getApiKey();
  const status = $('aiStatus');
  if (!key) { alert('⚙️ 設定で Anthropic の APIキーを入れてください。'); openSettings(); return; }
  if (aiRunning) return;
  if (!window.KurageAI) { alert('更新の準備がまだできていません。インターネットにつながっているか確認して、少し待ってからもう一度押してください。'); return; }
  aiRunning = true;
  const todayStr = ymd(today());
  let done = 0;
  const failures = [];
  const msg = (t) => { status.textContent = t; $('nowReading').textContent = t; };
  for (const id of ids) {
    const s = sectionById(id);
    if (!s) continue;
    msg(`🤖 ${s.title} を調べています…（${done + 1}/${ids.length}）`);
    try {
      const items = await window.KurageAI.fetchSection({ apiKey: key, title: s.title, prompt: s.prompt, count: 3, targets: TARGETS.filter((t) => t !== 'みんな'), date: new Date() });
      aiCache.sections[id] = { date: todayStr, items };
      saveJSON(AI_KEY, aiCache);
      renderAll();
    } catch (err) {
      console.error(err);
      failures.push(`${s.title}：${err.message || err}`);
    }
    done++;
  }
  aiRunning = false;
  msg(failures.length ? `⚠️ 一部更新できませんでした\n${failures.join('\n')}` : `✅ ${done}項目を今日のニュースに更新しました`);
  if (failures.length) alert(status.textContent);
}

// =============================================================
// はじめに
// =============================================================
function init() {
  renderHeader();
  setupPlayer();
  setupDrag();
  setupAddDialog();
  setupItemDialog();
  setupSettings();
  renderAll();
  renderIndexNote();
  player.prepare();
  setupEdgeKurage();
  setupKurageActors();
  // 日付が変わったら、占い・節気を今日の内容に
  let lastDay = ymd(today());
  setInterval(() => {
    if (ymd(today()) !== lastDay) { lastDay = ymd(today()); renderHeader(); if (!player.playing) renderAll(); }
  }, 60000);
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}
init();
