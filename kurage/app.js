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
  { id: 'today', emoji: '🗞', title: '今日の話題ニュース10', c1: '#0e5a8a', c2: '#06263d', count: 10,
    prompt: '今日、人と話すときの話題になる日本と世界のニュース10個（政治・経済・社会・スポーツ・エンタメ・科学などバランスよく）' },
  { id: 'phyto', emoji: '🌿', title: '植物療法（フィトテラピー）', c1: '#2f7a5b', c2: '#0d3326', count: 4,
    prompt: '植物療法（フィトテラピー・メディカルハーブ）業界の最近の話題やニュース。研究、協会・学会、商品、規制、安全性の情報' },
  { id: 'aroma', emoji: '🌸', title: 'アロマ', c1: '#8a4f7d', c2: '#2e1430', count: 4,
    prompt: 'アロマテラピー・精油業界の最近の話題やニュース。市場、新商品、研究、協会の動き、安全な使い方' },
  { id: 'sports', emoji: '⚾', title: 'スポーツ業界', c1: '#b5542b', c2: '#3a160a', count: 4,
    prompt: 'スポーツ業界の今日の話題やニュース。試合結果だけでなく、リーグ経営・移籍・スポーツビジネスの動きも' },
  { id: 'realestate', emoji: '🏠', title: '不動産・賃貸オーナーの学び', c1: '#6b6b2a', c2: '#23230b', count: 4,
    prompt: '不動産・賃貸オーナーが知っておくべき最近のニュースやトレンド。家賃相場、空室、金利、法改正、税制、管理の工夫' },
  { id: 'music', emoji: '🎵', title: '音楽', c1: '#5a3d9a', c2: '#1b1036', count: 4,
    prompt: '今話題の音楽ニュース。チャート、新曲・新作、ライブ、アーティストの話題（日本中心、世界も少し）' },
  { id: 'season', emoji: '🍁', title: '日本の四季', c1: '#a3472f', c2: '#35130b', count: 4,
    prompt: '日本の四季・季節のニュース。天気、桜や紅葉、旬、季節の行事、自然の話題（今日の時期に合ったもの）' },
  { id: 'sekki', emoji: '🌗', title: '二十四節気・七十二候', c1: '#2b5f7a', c2: '#0a2230', auto: true },
  { id: 'fortune', emoji: '🔮', title: '今日の占い・運気', c1: '#4a3a8a', c2: '#120c30', auto: true },
  { id: 'nutrition', emoji: '💊', title: '分子栄養学・オーソモレキュラー', c1: '#2f6f86', c2: '#0b2833', count: 4,
    prompt: '分子栄養学・オーソモレキュラー・栄養素（ビタミン、ミネラル、脂肪酸など）に関する最近の研究やニュース。エビデンスの強さも一言添えて' },
];

const DEFAULT_STATE = {
  order: BUILTIN.map((s) => s.id),
  hidden: {},
  custom: [],
  userItems: {},
  // 生年月日などの個人情報はプログラムには書かず、「⚙️ 設定」で入れてもらいます（この端末の中にだけ保存）
  birth: { date: '', time: '', place: '', lat: null, lon: null, tz: 9, placeName: '' },
  voice: 'male',
  rate: 1,
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
const save = () => saveJSON(STORE_KEY, state);

let aiCache = loadJSON(AI_KEY, { sections: {} });

const allSections = () => [...BUILTIN, ...state.custom.map((c) => ({ ...c, custom: true, c1: '#1f5f6f', c2: '#08242b', count: 4 }))];
const sectionById = (id) => allSections().find((s) => s.id === id);
const orderedSections = () => state.order.map(sectionById).filter(Boolean);

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const jpDate = (s) => { const [y, m, d] = s.split('-').map(Number); return `${y}年${m}月${d}日`; };
const WEEK = '日月火水木金土';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '');

function today() { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }

function birthForCalc() {
  const b = state.birth;
  const [y, m, d] = b.date.split('-').map(Number);
  const coord = (v) => (v === null || v === '' || v === undefined ? NaN : Number(v));
  return { y, m, d, time: b.time || '', lat: coord(b.lat), lon: coord(b.lon), tz: Number(b.tz ?? 9), placeName: b.placeName || '' };
}

// ---------- 各項目の記事を集める ----------
function itemsFor(sec) {
  const t = today();
  const todayStr = ymd(t);
  let items = [];
  if (sec.id === 'fortune') {
    items = state.birth.date ? KurageFortune.fortuneItems(birthForCalc(), t) : [{
      telop: '生年月日を入れてね',
      title: '「🎂 生年月日を変える」から、生年月日・生まれた時間・場所を入れてください',
      summary: '入れると、西洋占星術・数秘術・九星気学と風水・クラゲの直感リーディングで、あなたの今日の運気を毎日お届けします。',
      detail: '生年月日などはこの端末のブラウザの中にだけ保存され、インターネットには送られません。',
      kind: 'fortune',
    }];
  }
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

// ---------- 表示 ----------
function renderHeader() {
  const t = new Date();
  $('todayLabel').textContent = `${t.getFullYear()}年${t.getMonth() + 1}月${t.getDate()}日（${WEEK[t.getDay()]}）`;
  document.querySelector('.brand-kurage').innerHTML = kurageSVG();
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
      (items.length ? `<button type="button" class="small" data-act="readsec">▶ この項目を読む</button>` : '') +
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
    wrap.appendChild(sec);
  });
  buildPlaylist();
}

function renderCard(sec, it, i) {
  const card = document.createElement('article');
  card.className = 'news-card';
  card.dataset.sec = sec.id;
  card.dataset.idx = i;
  const srcs = (it.sources || []).filter((s) => safeUrl(s.url))
    .map((s) => `<a href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">${esc(s.name || s.url)}</a>`).join('、');
  const asOf = it.asOf ? jpDate(it.asOf) : '';
  card.innerHTML =
    `<div class="banner" style="--c1:${sec.c1};--c2:${sec.c2}">` +
      `<span class="banner-tag">${esc(sec.emoji || '📌')} #${i + 1}${asOf ? `　${esc(asOf)}` : ''}</span>` +
      `<div class="banner-kurage" style="animation-delay:${(-i * 0.7).toFixed(1)}s">${kurageSVG()}</div>` +
      `<div class="telop">${esc(it.telop || it.title)}</div>` +
    `</div>` +
    `<div class="card-body">` +
      `<h3>${esc(it.title)}</h3>` +
      (it.summary ? `<p class="summary">${esc(it.summary)}</p>` : '') +
      (it.detail ? `<p class="detail">${esc(it.detail)}</p>` : '') +
      (it.talk ? `<p class="talk">${esc(it.talk)}</p>` : '') +
      (srcs ? `<p class="sources">出典：${srcs}</p>` : '') +
      `<div class="card-actions"><button type="button" class="small" data-act="read">🔊 ここから読む</button>` +
      (it.mine != null ? `<button type="button" class="small" data-act="edit">✏️ 直す</button><button type="button" class="small" data-act="del">🗑 消す</button>` : '') +
      `</div>` +
    `</div>`;
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
function loadVoices() {
  const all = synth ? synth.getVoices() : [];
  jaVoices = all.filter((v) => /^ja([-_]|$)/i.test(v.lang));
  const score = (v) => (/natural|online|neural|premium|enhanced|google/i.test(v.name) ? 0 : 1);
  jaVoices.sort((a, b) => score(a) - score(b));
}
// 落ち着いた声：少し低め・少しゆっくり。男性の声が端末にない時は、声を低くして男性らしくします
function voiceSetting(kind) {
  const males = jaVoices.filter((v) => MALE_RE.test(v.name));
  const females = jaVoices.filter((v) => FEMALE_RE.test(v.name) || !MALE_RE.test(v.name));
  if (kind === 'male') {
    if (males.length) return { voice: males[0], pitch: 0.85, rate: 0.95 };
    return { voice: females[0] || jaVoices[0] || null, pitch: 0.55, rate: 0.93 };
  }
  return { voice: females[0] || jaVoices[0] || null, pitch: 0.9, rate: 0.95 };
}

function speechText(sec, it) {
  const parts = [`${sec.title}。`, it.title + '。'];
  if (it.summary) parts.push(it.summary);
  if (it.detail) parts.push(it.detail);
  if (it.talk && state.readTalk) parts.push('話すときは、' + it.talk);
  return parts.join('\n')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
    .replace(/[★☆]+/g, (m) => `星${(m.match(/★/g) || []).length}つ。`)
    .replace(/〜/g, 'から').replace(/…/g, '、').replace(/[「」『』（）()]/g, ' ');
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

const cardKey = (secId, i) => `${secId}:${i}`;
let playlist = [];
function buildPlaylist() {
  playlist = [];
  orderedSections().forEach((s) => {
    if (state.hidden[s.id]) return;
    itemsFor(s).forEach((it, i) => playlist.push({ key: cardKey(s.id, i), sec: s, it }));
  });
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
      this.speak();
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
    updatePlayerUI();
  },
  stop() {
    this.pause();
    this.idx = 0;
    this.chunk = 0;
    this.prepare();
    document.querySelectorAll('.news-card.reading').forEach((c) => c.classList.remove('reading'));
    $('nowReading').textContent = '▶ を押すと、上から順に読み上げます';
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
    $('nowReading').textContent = `${p.sec.emoji || ''} ${p.sec.title}｜${p.it.title}`;
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
  window.addEventListener('pagehide', () => synth && synth.cancel());
}

// =============================================================
// 画面の端にときどき出てくるクラゲ
// =============================================================
const KURAGE_LINES = ['ぷかぷか〜', '今日もいい日！', 'ニュース読んだ？', '深呼吸しよ', 'ふわ〜', 'やっほー', 'お水のんでね', 'クラゲだよ'];
function setupEdgeKurage() {
  const el = $('edgeKurage');
  el.innerHTML = kurageSVG();
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
    sel.add(new Option('（選んでください）', ''));
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

function saveBirth() {
  const sel = $('bPlace').value;
  const b = state.birth;
  b.date = $('bDate').value || b.date;
  b.time = $('bTimeUnknown').checked ? '' : ($('bTime').value || '');
  if (sel === 'custom') {
    b.place = 'custom';
    b.lat = Number($('bLat').value) || 0;
    b.lon = Number($('bLon').value) || 0;
    b.tz = Number($('bTz').value);
    if (!isFinite(b.tz)) b.tz = 9;
    b.placeName = $('bPlaceName').value.trim();
  } else if (!sel) {
    Object.assign(b, { place: '', lat: null, lon: null, tz: 9, placeName: '' });
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
      const items = await window.KurageAI.fetchSection({ apiKey: key, title: s.title, prompt: s.prompt, count: s.count || 4, date: new Date() });
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
  player.prepare();
  setupEdgeKurage();
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
