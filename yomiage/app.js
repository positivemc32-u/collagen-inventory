// =============================================================
// app.js … 文字の読み上げ（音声合成）と、音声の文字起こし（音声認識）
// ブラウザに入っている音声機能（Web Speech API）だけを使うので、
// 文章も声もインターネット上のこのアプリの持ち主には送られません。
// =============================================================
'use strict';

const $ = (id) => document.getElementById(id);
const STORE_KEY = 'yomiage.settings.v1';
const synth = window.speechSynthesis;

// ---------- 保存しておく設定 ----------
const settings = Object.assign(
  { presetId: 'f2', rate: 1, dict: [], tuning: {}, period: true, lisp: true, dialect: 'standard' },
  loadSettings()
);
function loadSettings() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; }
}
function saveSettings() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(settings)); } catch { /* 保存できなくても動かす */ }
}

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 2200);
}

// =============================================================
// 声の種類
// 端末に入っている日本語の声をもとに、声の高さと話す速さを変えて作ります。
// 高さを大きく変えるほど機械っぽく聞こえるので、大人の声は控えめにしています。
// =============================================================
const GROUPS = [
  { key: 'male', icon: '👨', title: '男性（大人）' },
  { key: 'female', icon: '👩', title: '女性（大人）' },
  { key: 'anime', icon: '👧', title: 'アニメの子ども役', note: '高い声で、舌足らずに話します（です→でしゅ）' },
  { key: 'obachan', icon: '👵', title: '大阪のおばちゃん', note: 'いつも関西弁で、ちょっと早口に話します' },
];
const PRESETS = [
  { id: 'm1', gender: 'male', name: '低め', desc: '低くて渋い', slot: 0, pitch: 0.82, rate: 0.95, fbPitch: 0.55 },
  { id: 'm2', gender: 'male', name: 'ふつう', desc: '落ち着いた', slot: 1, pitch: 0.95, rate: 1.0, fbPitch: 0.62 },
  { id: 'm3', gender: 'male', name: '若め', desc: 'さわやか', slot: 2, pitch: 1.08, rate: 1.05, fbPitch: 0.7 },
  { id: 'f1', gender: 'female', name: '低め', desc: '落ち着いた', slot: 0, pitch: 0.9, rate: 0.95 },
  { id: 'f2', gender: 'female', name: 'ふつう', desc: 'やさしい', slot: 1, pitch: 1.0, rate: 1.0 },
  { id: 'f3', gender: 'female', name: '若め', desc: '明るい', slot: 2, pitch: 1.15, rate: 1.05 },
  { id: 'a1', gender: 'anime', name: '甘えんぼ', desc: 'いちばん高い', slot: 0, pitch: 1.75, rate: 0.9 },
  { id: 'a2', gender: 'anime', name: '元気', desc: '高め・速め', slot: 1, pitch: 1.6, rate: 1.05 },
  { id: 'a3', gender: 'anime', name: 'おっとり', desc: '高め・ゆっくり', slot: 2, pitch: 1.5, rate: 0.85 },
  { id: 'o1', gender: 'obachan', name: '大阪のおばちゃん', desc: '関西弁・早口', slot: 0, pitch: 0.88, rate: 1.15, dialect: 'kansai' },
];
const groupOf = (p) => GROUPS.find((g) => g.key === p.gender);
const fullName = (p) => (p.gender === 'obachan' ? p.name : `${groupOf(p).title.replace(/（.*）/, '')}・${p.name}`);
const presetById = (id) => PRESETS.find((p) => p.id === id) || PRESETS[4];

// 声の名前から男性・女性を見分けるための手がかり（主な端末の日本語の声）
const MALE_RE = /otoya|ichiro|keita|daichi|naoki|masaru|hattori|takumi|kenji|hiroshi|男性|\bmale\b/i;
const FEMALE_RE = /kyoko|o-?ren|ayumi|haruka|sayaka|nanami|mayu|shiori|mizuki|kanade|hikari|aoi|google\s*日本語|女性|female/i;

let jaVoices = [];

function loadVoices() {
  const all = synth ? synth.getVoices() : [];
  jaVoices = all.filter((v) => /^ja([-_]|$)/i.test(v.lang));
  // 人の声に近い声（Natural / Online / Google / 拡張 / プレミアム など）を先に並べる
  const score = (v) => (/natural|online|neural|premium|enhanced|siri|google|拡張|プレミアム|高品質/i.test(v.name) ? 0 : 1) + (v.localService ? 0 : -0.1);
  jaVoices.sort((a, b) => score(a) - score(b));
  renderDeviceVoices();
  renderTuning();
  renderVoiceNote();
}

function genderOf(v) {
  if (MALE_RE.test(v.name)) return 'male';
  if (FEMALE_RE.test(v.name)) return 'female';
  return 'unknown';
}

// プリセットに実際に使う「端末の声・高さ・速さ」を決める
function resolvePreset(p) {
  const tune = settings.tuning[p.id] || {};
  let voice = null;
  let fallback = false;
  if (tune.voiceURI) voice = jaVoices.find((v) => v.voiceURI === tune.voiceURI) || null;
  if (!voice && jaVoices.length) {
    const males = jaVoices.filter((v) => genderOf(v) === 'male');
    const others = jaVoices.filter((v) => genderOf(v) !== 'male');
    if (p.gender === 'male') {
      if (males.length) voice = males[p.slot % males.length];
      else { voice = jaVoices[p.slot % jaVoices.length]; fallback = true; }
    } else if (p.gender === 'anime') {
      // 声を高くする設定がよく効く、端末内の声を優先する
      const base = others.length ? others : jaVoices;
      const local = base.filter((v) => v.localService);
      const pool = local.length ? local : base;
      voice = pool[p.slot % pool.length];
    } else {
      // 女性・大阪のおばちゃん：自然な声（一覧の先頭）を優先
      const base = others.length ? others : jaVoices;
      voice = base[p.slot % base.length];
    }
  }
  // 男性の声が端末にないときは、女性の声をより低くして男性らしくする
  const autoPitch = fallback && p.fbPitch ? p.fbPitch : p.pitch;
  const pitch = typeof tune.pitch === 'number' ? tune.pitch : autoPitch;
  return { voice, pitch, rate: p.rate, autoPitch };
}

function renderVoiceGroups() {
  const wrap = $('voiceGroups');
  wrap.innerHTML = '';
  for (const g of GROUPS) {
    const box = document.createElement('div');
    box.className = `voice-group g-${g.key}`;
    box.innerHTML = `<h3><span class="g-icon">${g.icon}</span>${g.title}</h3>` +
      (g.note ? `<p class="g-note">${g.note}</p>` : '') + '<div class="voice-grid"></div>';
    const grid = box.querySelector('.voice-grid');
    for (const p of PRESETS.filter((x) => x.gender === g.key)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'voice-btn' + (p.id === settings.presetId ? ' selected' : '');
      b.innerHTML = `<span class="v-name">${p.name}</span><span class="v-desc">${p.desc}</span>`;
      b.addEventListener('click', () => {
        settings.presetId = p.id;
        saveSettings();
        renderVoiceGroups();
        if (player.playing) player.restartCurrent();
      });
      grid.appendChild(b);
    }
    wrap.appendChild(box);
  }
  const cur = presetById(settings.presetId);
  $('currentVoice').textContent = `${groupOf(cur).icon} ${fullName(cur)}`;
  renderDialect();
}

function renderVoiceNote() {
  const note = $('voiceNote');
  if (!synth) { note.textContent = 'このブラウザは読み上げに対応していません。'; return; }
  if (!jaVoices.length) {
    note.textContent = '日本語の声を読み込み中です…（出てこないときは、端末の設定で日本語の読み上げ音声を追加してください）';
    return;
  }
  const hasMale = jaVoices.some((v) => genderOf(v) === 'male');
  note.textContent = `この端末の日本語の声：${jaVoices.length}種類` +
    (hasMale ? '' : '（男性の声がないため、声を低くして男性の声にしています）') +
    '。「🔊 試し聞き」で、入れた文章の最初の文を読みます。';
}

// 試し聞きは、入力された文章の最初の文だけを読む（書いていない言葉は読まない）
function sample(p) {
  if (!synth) return;
  const first = splitSentences($('ttsText').value).find((c) => hasSpeakable(cleanForSpeech(c.text)));
  if (!first) { toast('文章を入れると、その最初の文で試し聞きできます'); return; }
  if (player.playing) player.pause();
  synth.cancel();
  synth.speak(makeUtterance(first.text, p));
}

function makeUtterance(text, p) {
  const r = resolvePreset(p);
  const spoken = speechText(text, p);
  const u = new SpeechSynthesisUtterance(spoken);
  u.lang = 'ja-JP';
  if (r.voice) u.voice = r.voice;
  u.pitch = clamp(r.pitch, 0, 2);
  u.rate = clamp(settings.rate * r.rate, 0.1, 10);
  return u;
}
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

// 実際に声に出す文：読み方辞書 → 関西弁 → 記号を取りのぞく → 舌足らず の順に変える
const dialectOf = (p) => p.dialect || settings.dialect;
function speechText(text, p) {
  let t = applyDict(text);
  t = Dialect.convert(t, { dialect: dialectOf(p), obachan: p.gender === 'obachan' });
  t = cleanForSpeech(t);
  if (p.gender === 'anime' && settings.lisp) t = lisp(t);
  return t;
}

// 書いていない言葉を読まないように、端末によっては名前で読み上げてしまう
// 絵文字・かっこ・記号（「かぎかっこ」「ほし」など）を、読む前に取りのぞく
function cleanForSpeech(text) {
  return text
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}]/gu, ' ')
    .replace(/[「」『』（）()【】〔〕［］[\]｛｝{}〈〉《》≪≫"“”‘’'＂]/g, ' ')
    .replace(/[※★☆♪♫♬■□◆◇●○◎△▲▽▼→←↑↓⇒⇔・＊*＃#＿_｜|＾^`｀〓]/g, ' ')
    .replace(/[…‥]+/g, '、')
    // 「。」のない行（見出しなど）も、文の終わりとして自然に下げて区切る
    .replace(/([^。！？!?、\s])[ \t　]*\n/g, '$1。\n');
}

// 舌足らずな話し方：さ行・ざ行を「しゃ・しゅ・しぇ・しょ」に（です→でしゅ、さん→しゃん）
// 漢字のすぐ後ろのかな（話す・過ごす など）は、漢字の読み方がくずれないよう変えない。
const LISP = {
  さ: 'しゃ', す: 'しゅ', せ: 'しぇ', そ: 'しょ', ざ: 'じゃ', ず: 'じゅ', ぜ: 'じぇ', ぞ: 'じょ',
  サ: 'シャ', ス: 'シュ', セ: 'シェ', ソ: 'ショ', ザ: 'ジャ', ズ: 'ジュ', ゼ: 'ジェ', ゾ: 'ジョ',
};
function lisp(text) {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    // ただし名前の後ろの「さん・さま」は「しゃん・しゃま」にする
    const honorific = text.startsWith('さん', i) || text.startsWith('さま', i);
    const afterKanji = !honorific && i > 0 && /[\p{Script=Han}々]/u.test(text[i - 1]);
    out += LISP[c] && !afterKanji ? LISP[c] : c;
  }
  return out;
}

// =============================================================
// 読み方辞書（読み間違える言葉だけ、読み上げのときに置きかえる）
// =============================================================
function applyDict(text) {
  if (!settings.dict.length) return text;
  // 長い言葉から先に置きかえる（「東京都」が「東京」より先）
  const list = [...settings.dict].sort((a, b) => b.from.length - a.from.length);
  const re = new RegExp(list.map((d) => escapeRe(d.from)).join('|'), 'g');
  const map = new Map(list.map((d) => [d.from, d.to]));
  return text.replace(re, (m) => map.get(m) ?? m);
}
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function renderDict() {
  const ul = $('dictList');
  ul.innerHTML = '';
  if (!settings.dict.length) {
    ul.innerHTML = '<li><small>まだ登録はありません</small></li>';
    return;
  }
  settings.dict.forEach((d, i) => {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = `${d.from} → ${d.to}`;
    const play = document.createElement('button');
    play.type = 'button';
    play.textContent = '🔊';
    play.addEventListener('click', () => { synth.cancel(); synth.speak(makeUtterance(d.from, presetById(settings.presetId))); });
    const del = document.createElement('button');
    del.type = 'button';
    del.textContent = '削除';
    del.addEventListener('click', () => { settings.dict.splice(i, 1); saveSettings(); renderDict(); });
    li.append(span, play, del);
    ul.appendChild(li);
  });
}

$('btnDictAdd').addEventListener('click', () => {
  const from = $('dictFrom').value.trim();
  const to = $('dictTo').value.trim();
  if (!from || !to) { toast('言葉と読み方の両方を入れてください'); return; }
  settings.dict = settings.dict.filter((d) => d.from !== from);
  settings.dict.push({ from, to });
  saveSettings();
  $('dictFrom').value = '';
  $('dictTo').value = '';
  renderDict();
  toast(`「${from}」を「${to}」と読みます`);
});

// =============================================================
// 文章を文ごとに分ける
// 漢字の読み方は、読み上げエンジンが「文全体」を見て前後の流れから決めます。
// そのため途中で切らず、必ず文（。！？や改行）の区切りで分けて渡します。
// 長さの制限はなく、どれだけ長い文章でも文ごとに順番に読み上げます。
// =============================================================
const MAX_CHUNK = 220; // これより長い1文だけは「、」の位置で分ける

function splitSentences(text) {
  const chunks = [];
  let start = 0;
  const push = (end) => {
    if (end > start) chunks.push({ start, end, text: text.slice(start, end) });
    start = end;
  };
  // 「楽しかった！」と言った。のように、かっこの中の！や。では区切らない
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '\n') { depth = 0; push(i + 1); continue; }
    if ('「『（(【〔'.includes(c)) depth++;
    else if ('」』）)】〕'.includes(c)) depth = Math.max(0, depth - 1);
    else if (depth === 0 && '。！？!?'.includes(c)) {
      let j = i + 1;
      while (j < text.length && '！？!?。…'.includes(text[j])) j++;
      push(j);
      i = j - 1;
    }
  }
  push(text.length);

  const out = [];
  for (const ch of chunks) {
    if (ch.text.length <= MAX_CHUNK) { out.push(ch); continue; }
    let s = ch.start;
    while (ch.end - s > MAX_CHUNK) {
      const part = text.slice(s, s + MAX_CHUNK);
      let cut = Math.max(part.lastIndexOf('、'), part.lastIndexOf('，'), part.lastIndexOf(','), part.lastIndexOf(' '), part.lastIndexOf('　'));
      cut = cut > MAX_CHUNK / 3 ? cut + 1 : MAX_CHUNK;
      out.push({ start: s, end: s + cut, text: text.slice(s, s + cut) });
      s += cut;
    }
    out.push({ start: s, end: ch.end, text: text.slice(s, ch.end) });
  }
  return out;
}
const hasSpeakable = (s) => /[\p{L}\p{N}]/u.test(s);

// =============================================================
// 読み上げ（再生・一時停止・前後の文へ移動）
// 人が話すようになめらかにするため、
//  ・短い文はいくつかまとめて読む（文と文のあいだが不自然に空かない）
//  ・次のまとまりを先に順番待ちに入れておく（声の切りかえで止まらない）
// 一時停止は「今のまとまりの最初から再開」にしています（スマホでも確実に動くため）。
// =============================================================
const SEG_MAX = 150; // ひとまとめにして読む文字数のめやす

const player = {
  chunks: [],
  idx: 0,
  segEnd: 0,
  playing: false,
  token: 0,
  queuedTo: 0,
  pending: 0,
  sourceText: null,

  prepare() {
    const text = $('ttsText').value;
    if (text !== this.sourceText) {
      this.sourceText = text;
      this.chunks = splitSentences(text);
      this.idx = 0;
      renderReadView();
    }
    return this.chunks.some((c) => hasSpeakable(cleanForSpeech(c.text)));
  },

  play() {
    if (!synth) { toast('このブラウザは読み上げに対応していません'); return; }
    if (!this.prepare()) { toast('読み上げる文章を入れてください'); return; }
    if (this.idx >= this.chunks.length) this.idx = 0;
    this.playing = true;
    showReading(true);
    synth.cancel();
    this.speakFrom(this.idx);
  },

  pause() {
    this.playing = false;
    this.token++;
    synth.cancel();
    updatePlayerUI();
  },

  stop() {
    this.pause();
    this.idx = 0;
    showReading(false);
    updatePlayerUI();
  },

  jump(i) {
    if (!this.chunks.length) this.prepare();
    this.idx = clamp(i, 0, Math.max(0, this.chunks.length - 1));
    if (this.playing) this.restartCurrent();
    else updatePlayerUI();
  },

  restartCurrent() {
    this.token++;
    synth.cancel();
    // cancel の直後に話させると無視される端末があるので、少し待つ
    setTimeout(() => { if (this.playing) this.speakFrom(this.idx); }, 80);
  },

  // i 番目の文から、SEG_MAX 文字くらいまでの文をひとまとめにする
  segmentFrom(i) {
    while (i < this.chunks.length && !hasSpeakable(cleanForSpeech(this.chunks[i].text))) i++;
    if (i >= this.chunks.length) return null;
    let j = i;
    let text = '';
    while (j < this.chunks.length) {
      const t = this.chunks[j].text;
      if (j > i && text.length + t.length > SEG_MAX) break;
      text += t;
      j++;
      if (/\n\s*\n\s*$/.test(text)) break; // 段落の切れ目では区切る
    }
    return { from: i, to: j, text };
  },

  speakFrom(i) {
    const token = ++this.token;
    this.queuedTo = i;
    this.pending = 0;
    this.idx = i;
    this.segEnd = i + 1;
    this.enqueue(token);
    this.enqueue(token);
    if (!this.pending) this.finish();
    updatePlayerUI();
  },

  enqueue(token) {
    const seg = this.segmentFrom(this.queuedTo);
    if (!seg) return;
    this.queuedTo = seg.to;
    this.pending++;
    const u = makeUtterance(seg.text, presetById(settings.presetId));
    const live = () => token === this.token && this.playing;
    u.onstart = () => {
      if (!live()) return;
      this.idx = seg.from;
      this.segEnd = seg.to;
      updatePlayerUI();
    };
    const done = () => {
      if (!live()) return;
      this.pending--;
      this.idx = seg.to;
      this.enqueue(token);
      if (this.pending <= 0) this.finish();
    };
    u.onend = done;
    u.onerror = (e) => {
      if (!live()) return;
      if (e.error === 'interrupted' || e.error === 'canceled') return;
      if (e.error === 'not-allowed') { this.pause(); toast('もう一度 ▶ を押してください'); return; }
      done();
    };
    synth.speak(u);
  },

  finish() {
    this.playing = false;
    this.idx = 0;
    showReading(false);
    updatePlayerUI();
    toast('最後まで読み上げました');
  },
};

// パソコンの Chrome は長く話していると突然止まることがあるため、ときどき起こす
setInterval(() => {
  if (player.playing && synth.speaking && !synth.paused && /Chrome/.test(navigator.userAgent) && !/Android|Mobile/.test(navigator.userAgent)) {
    synth.pause();
    synth.resume();
  }
}, 10000);

function renderReadView() {
  const view = $('readView');
  view.innerHTML = '';
  player.chunks.forEach((c, i) => {
    const s = document.createElement('span');
    s.textContent = c.text;
    s.dataset.i = i;
    view.appendChild(s);
  });
}

$('readView').addEventListener('click', (e) => {
  const s = e.target.closest('span[data-i]');
  if (s) player.jump(Number(s.dataset.i));
});

// 読み上げ中は、今読んでいる文が分かる表示に切りかえる
function showReading(on) {
  $('ttsText').hidden = on;
  $('readView').hidden = !on;
}

function updatePlayerUI() {
  const total = player.chunks.length;
  const btn = $('btnPlay');
  btn.textContent = player.playing ? '⏸ 一時停止' : (player.idx > 0 ? '▶ つづきから' : '▶ 読み上げ');
  $('progressBar').style.width = total ? `${(player.idx / total) * 100}%` : '0';
  $('progressText').textContent = total && ($('readView').hidden === false)
    ? `${Math.min(player.idx + 1, total)} / ${total} 文目　（文を押すとそこから読みます）`
    : '';
  const spans = $('readView').children;
  for (let i = 0; i < spans.length; i++) {
    const now = i >= player.idx && i < Math.max(player.segEnd, player.idx + 1) && (player.playing || i === player.idx);
    spans[i].className = i < player.idx ? 'done' : (now ? 'now' : '');
  }
  const now = spans[player.idx];
  if (now && player.playing) {
    const view = $('readView');
    const top = now.offsetTop - view.offsetTop;
    if (top < view.scrollTop || top > view.scrollTop + view.clientHeight - 40) view.scrollTop = top - 40;
  }
}

$('btnPlay').addEventListener('click', () => (player.playing ? player.pause() : player.play()));
$('btnStop').addEventListener('click', () => player.stop());
$('btnPrev').addEventListener('click', () => player.jump(player.idx - 1));
$('btnNext').addEventListener('click', () => player.jump(player.idx + 1));

$('ttsText').addEventListener('input', () => {
  updateCount();
  renderPreview();
  player.idx = 0;
});
function updateCount() {
  $('charCount').textContent = `${$('ttsText').value.length.toLocaleString()}文字`;
}

$('btnPaste').addEventListener('click', async () => {
  try {
    const t = await navigator.clipboard.readText();
    if (!t) { toast('コピーされた文字がありません'); return; }
    player.stop();
    $('ttsText').value = t;
    updateCount();
  } catch {
    toast('文章の欄を長押しして「ペースト」を選んでください');
  }
});

$('fileInput').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const buf = await f.arrayBuffer();
  let text = new TextDecoder('utf-8').decode(buf);
  // 文字化けしていたら、Windows でよく使われる Shift_JIS として読み直す
  if (text.includes('�')) {
    try { text = new TextDecoder('shift_jis').decode(buf); } catch { /* そのまま */ }
  }
  player.stop();
  $('ttsText').value = text;
  updateCount();
  e.target.value = '';
  toast(`「${f.name}」を読み込みました`);
});

$('btnClearTts').addEventListener('click', () => {
  if ($('ttsText').value && !confirm('文章を消しますか？')) return;
  player.stop();
  $('ttsText').value = '';
  updateCount();
});

// ---------- 話し方（標準語・関西弁） ----------
function renderDialect() {
  const p = presetById(settings.presetId);
  const forced = !!p.dialect;
  const cur = dialectOf(p);
  document.querySelectorAll('[data-dialect]').forEach((b) => {
    b.classList.toggle('selected', b.dataset.dialect === cur);
    b.disabled = forced && b.dataset.dialect !== cur;
  });
  $('dialectNote').textContent = forced
    ? '大阪のおばちゃんは、いつも関西弁で話します。'
    : cur === 'kansai'
      ? '「ほんまに」「〜やで」「〜へん」のように、言い回しを関西弁にして読みます（画面の文章は変わりません）。'
      : 'ふつうの標準語で読みます。';
  renderPreview();
}
document.querySelectorAll('[data-dialect]').forEach((b) => b.addEventListener('click', () => {
  settings.dialect = b.dataset.dialect;
  saveSettings();
  renderDialect();
  if (player.playing) player.restartCurrent();
}));

// 実際に声に出す言葉を確認する（関西弁・舌足らず・記号の取りのぞき後）
function renderPreview() {
  const box = $('previewBox');
  if (!box.open) return;
  const p = presetById(settings.presetId);
  const text = $('ttsText').value.slice(0, 800);
  $('previewText').textContent = text.trim()
    ? speechText(text, p) + ($('ttsText').value.length > 800 ? '…（続く）' : '')
    : '文章を入れると、ここに実際に読む言葉が出ます。';
}
$('previewBox').addEventListener('toggle', renderPreview);

$('btnSample').addEventListener('click', () => sample(presetById(settings.presetId)));
$('optLisp').checked = settings.lisp;
$('optLisp').addEventListener('change', (e) => {
  settings.lisp = e.target.checked;
  saveSettings();
  renderPreview();
  if (player.playing && presetById(settings.presetId).gender === 'anime') player.restartCurrent();
});

// ---------- 速さ ----------
function setRate(r) {
  settings.rate = clamp(Math.round(r * 10) / 10, 0.5, 3);
  $('rate').value = settings.rate;
  $('rateLabel').textContent = `${settings.rate.toFixed(1)}倍`;
  saveSettings();
}
$('rate').addEventListener('input', (e) => setRate(Number(e.target.value)));
$('rate').addEventListener('change', () => { if (player.playing) player.restartCurrent(); });
document.querySelectorAll('[data-rate]').forEach((b) => b.addEventListener('click', () => {
  setRate(Number(b.dataset.rate));
  if (player.playing) player.restartCurrent();
}));

// =============================================================
// 声の細かい調整（設定画面）
// =============================================================
function renderTuning() {
  const wrap = $('voiceTuning');
  wrap.innerHTML = '';
  for (const p of PRESETS) {
    const tune = settings.tuning[p.id] || {};
    const r = resolvePreset(p);
    const row = document.createElement('div');
    row.className = 'tune';
    const name = document.createElement('div');
    name.className = 't-name';
    name.innerHTML = `${groupOf(p).icon} ${fullName(p)}<br><small>${p.desc}</small>`;

    const sel = document.createElement('select');
    sel.innerHTML = `<option value="">自動${r.voice && !tune.voiceURI ? `（${escapeHtml(r.voice.name)}）` : ''}</option>` +
      jaVoices.map((v) => `<option value="${escapeHtml(v.voiceURI)}">${escapeHtml(v.name)}</option>`).join('');
    sel.value = tune.voiceURI || '';
    sel.addEventListener('change', () => { setTune(p.id, { voiceURI: sel.value || undefined }); renderTuning(); });

    const pitchBox = document.createElement('label');
    pitchBox.className = 't-pitch';
    const pitch = document.createElement('input');
    pitch.type = 'range'; pitch.min = '0.1'; pitch.max = '2'; pitch.step = '0.05';
    pitch.value = r.pitch;
    const pv = document.createElement('span');
    pv.textContent = `高さ ${Number(r.pitch).toFixed(2)}`;
    pitch.addEventListener('input', () => { pv.textContent = `高さ ${Number(pitch.value).toFixed(2)}`; });
    pitch.addEventListener('change', () => setTune(p.id, { pitch: Number(pitch.value) }));
    pitchBox.append(pv, pitch);

    const test = document.createElement('button');
    test.type = 'button';
    test.textContent = '🔊 試す';
    test.addEventListener('click', () => sample(p));

    row.append(name, sel, pitchBox, test);
    wrap.appendChild(row);
  }
}
function setTune(id, patch) {
  const t = Object.assign({}, settings.tuning[id], patch);
  Object.keys(t).forEach((k) => t[k] === undefined && delete t[k]);
  settings.tuning[id] = t;
  saveSettings();
}
$('btnResetTuning').addEventListener('click', () => {
  settings.tuning = {};
  saveSettings();
  renderTuning();
  toast('声の調整を元に戻しました');
});
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function renderDeviceVoices() {
  const ul = $('deviceVoices');
  ul.innerHTML = jaVoices.length
    ? jaVoices.map((v) => {
        const g = { male: '男性', female: '女性', unknown: '—' }[genderOf(v)];
        return `<li>・${escapeHtml(v.name)} <small>（${g}${v.localService ? '' : '・ネット接続時'}）</small></li>`;
      }).join('')
    : '<li><small>日本語の声が見つかりません</small></li>';
}

// =============================================================
// 文字起こし（音声 → 文字）
// =============================================================
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const isAndroid = /Android/i.test(navigator.userAgent);
const stt = { rec: null, listening: false };

if (!SR) {
  $('sttUnsupported').hidden = false;
  $('btnMic').disabled = true;
}

function startListening() {
  if (!SR) return;
  if (player.playing) player.pause();
  stt.listening = true;
  startRecognizer();
  updateMicUI();
}

function startRecognizer() {
  const rec = new SR();
  rec.lang = 'ja-JP';
  rec.interimResults = true;
  // Android の Chrome は連続モードで同じ言葉が重複して出るため、1回ずつ区切って聞き直す
  rec.continuous = !isAndroid;
  rec.maxAlternatives = 1;
  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) appendFinal(r[0].transcript);
      else interim += r[0].transcript;
    }
    $('sttInterim').textContent = interim;
  };
  rec.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      stt.listening = false;
      toast('マイクの使用が許可されていません。ブラウザの設定でマイクを許可してください');
    } else if (e.error === 'audio-capture') {
      stt.listening = false;
      toast('マイクが見つかりません');
    } else if (e.error === 'network') {
      toast('文字起こしにはインターネット接続が必要です');
    }
    updateMicUI();
  };
  // 話が途切れると自動で止まるので、止めるボタンが押されるまで聞き続ける
  rec.onend = () => {
    $('sttInterim').textContent = '';
    if (stt.listening) setTimeout(() => { if (stt.listening) startRecognizer(); }, 150);
    else updateMicUI();
  };
  stt.rec = rec;
  try { rec.start(); } catch { /* すでに動いているとき */ }
}

function stopListening() {
  stt.listening = false;
  if (stt.rec) { try { stt.rec.stop(); } catch { /* 無視 */ } }
  updateMicUI();
}

function appendFinal(text) {
  text = text.trim();
  if (!text) return;
  if ($('optPeriod').checked && !/[。！？!?、]$/.test(text)) text += '。';
  const ta = $('sttText');
  ta.value += text;
  ta.scrollTop = ta.scrollHeight;
  updateSttCount();
}

function updateMicUI() {
  $('btnMic').classList.toggle('on', stt.listening);
  $('micLabel').textContent = stt.listening ? '止める' : '話しはじめる';
  $('micStatus').textContent = stt.listening
    ? '聞いています…ゆっくりはっきり話してください。'
    : 'ボタンを押してから話してください。もう一度押すと止まります。';
}
function updateSttCount() {
  $('sttCount').textContent = `${$('sttText').value.length.toLocaleString()}文字`;
}

$('btnMic').addEventListener('click', () => (stt.listening ? stopListening() : startListening()));
$('sttText').addEventListener('input', updateSttCount);
$('optPeriod').checked = settings.period;
$('optPeriod').addEventListener('change', (e) => { settings.period = e.target.checked; saveSettings(); });

$('btnCopy').addEventListener('click', async () => {
  const t = $('sttText').value;
  if (!t) { toast('文字がありません'); return; }
  try { await navigator.clipboard.writeText(t); toast('コピーしました'); }
  catch { $('sttText').select(); toast('選択した文字を長押しでコピーしてください'); }
});
$('btnToTts').addEventListener('click', () => {
  const t = $('sttText').value;
  if (!t) { toast('文字がありません'); return; }
  stopListening();
  player.stop();
  $('ttsText').value = t;
  updateCount();
  showTab('tts');
});
$('btnSaveTxt').addEventListener('click', () => {
  const t = $('sttText').value;
  if (!t) { toast('文字がありません'); return; }
  const d = new Date();
  const name = `文字起こし_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}.txt`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([t], { type: 'text/plain;charset=utf-8' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
$('btnClearStt').addEventListener('click', () => {
  if ($('sttText').value && !confirm('文字起こしの内容を消しますか？')) return;
  $('sttText').value = '';
  updateSttCount();
});

// =============================================================
// タブの切りかえ
// =============================================================
const TITLES = { tts: '文字を読み上げる', stt: '声を文字にする', settings: '設定' };
function showTab(tab) {
  document.querySelectorAll('.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.page').forEach((p) => { p.hidden = p.id !== `page-${tab}`; });
  $('pageTitle').textContent = TITLES[tab];
  window.scrollTo(0, 0);
}
document.querySelectorAll('.tabbar button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

// =============================================================
// はじめに
// =============================================================
setRate(settings.rate);
renderVoiceGroups();
renderDict();
updateCount();
updateSttCount();
updatePlayerUI();
if (synth) {
  loadVoices();
  synth.addEventListener?.('voiceschanged', loadVoices);
  // 声の一覧がすぐに出てこない端末のため、少しの間くり返し確認する
  let tries = 0;
  const poll = setInterval(() => {
    if (jaVoices.length || ++tries > 20) { clearInterval(poll); return; }
    loadVoices();
  }, 300);
} else {
  renderVoiceNote();
}
window.addEventListener('pagehide', () => synth && synth.cancel());

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
