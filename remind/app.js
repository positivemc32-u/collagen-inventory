// =============================================================
// app.js … 画面の表示・ボタン操作・時間になったら知らせる仕組み
// =============================================================

let db = loadDb();
const state = {
  tab: 'list',
  draft: blankReminder(), // いま追加・編集しているリマインダー
  filter: 'all', // 予定一覧の色しぼり込み
  heard: '', // 音声で聞き取った文
  found: [], // 文から読み取れた内容
};
const alarms = []; // 鳴っているもの [{ id, at }]

const $ = (sel) => document.querySelector(sel);
const main = $('#main');
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const IS_IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const CAN_VIBRATE = 'vibrate' in navigator;

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function persist() { saveDb(db); }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function colorOf(id) { return COLORS.find((c) => c.id === id) || COLORS[4]; }
function colorName(id) { return (db.settings.colorNames[id] || '').trim() || colorOf(id).name; }
function byId(id) { return db.reminders.find((r) => r.id === id); }

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.hidden = true; }, 2600);
}

// ---------- 全体の描画 ----------
const TITLES = { list: 'これからの予定', edit: 'リマインダーを追加', done: '完了したもの', settings: '設定' };

function render() {
  $('#pageTitle').textContent = state.tab === 'edit' && state.draft.id ? 'リマインダーを直す' : TITLES[state.tab];
  const active = db.reminders.filter((r) => !r.done).length;
  $('#pageHint').textContent = state.tab === 'list' && active ? `${active}件` : '';
  document.querySelectorAll('.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === state.tab));
  ({ list: renderList, edit: renderEdit, done: renderDone, settings: renderSettings })[state.tab]();
  if (state.tab !== render.lastTab) window.scrollTo(0, 0);
  render.lastTab = state.tab;
}

function goTab(tab) {
  if (tab === 'edit' && state.tab !== 'edit') { state.draft = blankReminder(); state.heard = ''; state.found = []; }
  state.tab = tab;
  render();
}

// ---------- 予定の一覧 ----------
function renderList() {
  const active = db.reminders.filter((r) => !r.done).sort((a, b) => (dueOf(a) || 0) - (dueOf(b) || 0));
  const usedColors = [...new Set(active.map((r) => r.color))];
  if (state.filter !== 'all' && !usedColors.includes(state.filter)) state.filter = 'all';
  const shown = active.filter((r) => state.filter === 'all' || r.color === state.filter);

  // 日ごとにまとめる
  const groups = [];
  shown.forEach((r) => {
    const d = new Date(dueOf(r));
    const key = ymd(d);
    let g = groups.find((x) => x.key === key);
    if (!g) groups.push((g = { key, label: whenJa(d.getTime()).replace(/ \d\d:\d\d$/, ''), items: [] }));
    g.items.push(r);
  });

  main.innerHTML = `
    ${notifyBanner()}
    <button type="button" class="voice-big" data-act="voice-add">
      <span class="mic">🎤</span><span><b>話して追加</b><small>例：「明日の午後3時に歯医者」</small></span>
    </button>

    ${usedColors.length > 1 ? `
      <div class="color-filter">
        <button type="button" class="cf ${state.filter === 'all' ? 'on' : ''}" data-filter="all">すべて</button>
        ${COLORS.filter((c) => usedColors.includes(c.id)).map((c) => `
          <button type="button" class="cf ${state.filter === c.id ? 'on' : ''}" data-filter="${c.id}" style="--c:${c.hex}"><i></i>${esc(colorName(c.id))}</button>`).join('')}
      </div>` : ''}

    ${groups.length ? groups.map((g) => `
      <h3 class="day-head">${esc(g.label)}</h3>
      <div class="cards">${g.items.map(reminderCard).join('')}</div>`).join('')
    : `<p class="empty">予定はありません。<br>下の「＋ 追加」か、上の 🎤 から作れます。</p>`}
  `;
}

function reminderCard(r) {
  const due = dueOf(r);
  const late = due < Date.now();
  const rep = repeatLabel(r);
  return `
    <div class="card rem" style="--c:${colorOf(r.color).hex}">
      <button type="button" class="rem-main" data-act="edit" data-id="${r.id}">
        <span class="rem-time ${late ? 'late' : ''}">${hm(new Date(due))}</span>
        <span class="rem-title">${esc(r.title)}</span>
        <span class="rem-sub">
          <span class="${late ? 'late' : ''}">${untilJa(due)}</span>
          ${rep ? `<span class="tag">🔁 ${esc(rep)}</span>` : ''}
          ${r.snoozeAt ? `<span class="tag">💤 もう一度 ${hm(new Date(r.snoozeAt))}</span>` : ''}
          <span class="tag">${r.vibrate ? '📳 バイブ' : '🔕 バイブなし'}</span>
        </span>
      </button>
      <div class="row-actions">
        <button type="button" class="btn small" data-act="done" data-id="${r.id}">✅ 完了</button>
        <button type="button" class="btn small" data-act="ics" data-id="${r.id}">📅 カレンダーに入れる</button>
        <button type="button" class="icon-btn" data-act="delete" data-id="${r.id}" aria-label="削除">🗑</button>
      </div>
    </div>`;
}

function notifyBanner() {
  const parts = [];
  if ('Notification' in window && Notification.permission === 'default') {
    parts.push(`<div class="notice"><span>🔔 通知を許可すると、ほかのアプリを見ているときも知らせます。</span>
      <button type="button" class="btn small primary" data-act="perm">通知を許可する</button></div>`);
  }
  if (!db.settings.hideTip) {
    parts.push(`<div class="notice soft"><span>💡 このアプリは<b>開いている間（裏に置いている間も多くの場合）</b>に知らせます。
      アプリを完全に閉じたり、携帯の電源を切ったりすると鳴りません。大事な予定は「📅 カレンダーに入れる」も使うと確実です。</span>
      <button type="button" class="link" data-act="hide-tip">わかった</button></div>`);
  }
  return parts.join('');
}

// ---------- 追加・編集 ----------
function renderEdit() {
  const d = state.draft;
  const recent = recentTitles();
  const custom = d.repeat === 'custom';
  main.innerHTML = `
    <section class="panel">
      <div class="field">
        <label for="fTitle">項目</label>
        <div class="title-row">
          <input id="fTitle" type="text" data-f="title" value="${esc(d.title)}" placeholder="例：歯医者、薬を飲む" autocomplete="off" enterkeyhint="done">
          <button type="button" class="mic-btn ${state.listening ? 'on' : ''}" data-act="voice" aria-label="音声入力">🎤</button>
        </div>
        <div id="voiceArea">${voiceArea()}</div>
        <button type="button" class="link small-link" data-act="parse">✨ 文から日にち・時間を読み取る</button>
      </div>
      ${recent.length ? `
        <div class="field"><label>もう一回使う <small>前に使った項目</small></label>
          <div class="chips">${recent.map((r, i) => `<button type="button" class="chip" data-recent="${i}" style="--c:${colorOf(r.color).hex}"><i></i>${esc(r.title)}</button>`).join('')}</div>
        </div>` : ''}
      <div class="field"><label>色</label>
        <div class="colors">${COLORS.map((c) => `
          <label class="color-dot" title="${esc(colorName(c.id))}">
            <input type="radio" name="color" value="${c.id}" ${d.color === c.id ? 'checked' : ''}>
            <span style="--c:${c.hex}"></span><small>${esc(colorName(c.id))}</small>
          </label>`).join('')}
        </div>
      </div>
    </section>

    <section class="panel ${custom ? 'hidden' : ''}">
      <h2>いつ知らせる？</h2>
      <div class="field"><label>今から</label>
        <div class="chips">${SNOOZES.map((m) => `<button type="button" class="chip" data-later="${m}">${m < 60 ? m + '分後' : m / 60 + '時間後'}</button>`).join('')}</div>
      </div>
      <div class="field"><label for="fDate">日にち</label>
        <div class="date-row">
          <input id="fDate" type="date" data-f="date" value="${esc(d.date)}">
          <span class="date-ja" id="dateJa">${esc(mdJa(d.date))}</span>
        </div>
        <div class="chips">
          <button type="button" class="chip" data-day="0">今日</button>
          <button type="button" class="chip" data-day="1">明日</button>
          <button type="button" class="chip" data-day="2">あさって</button>
          <button type="button" class="chip" data-day="7">1週間後</button>
        </div>
      </div>
      <div class="field"><label>時間 <small>くるくる回して選ぶ</small></label>
        <div id="timeWheel"></div>
      </div>
    </section>

    <section class="panel">
      <h2>くり返し</h2>
      <div class="seg wrap">${REPEATS.map((x) => `
        <label><input type="radio" name="repeat" value="${x.id}" ${d.repeat === x.id ? 'checked' : ''}><span>${x.label}</span></label>`).join('')}
      </div>
      ${custom ? customPanel(d) : ''}
    </section>

    <section class="panel">
      <label class="switch">
        <input type="checkbox" data-f="vibrate" ${d.vibrate ? 'checked' : ''}>
        <span class="sw"></span>
        <span><b>📳 バイブをかける</b>
          ${IS_IOS || !CAN_VIBRATE ? `<small>${IS_IOS ? 'iPhone はブラウザからのバイブに対応していません。「📅 カレンダーに入れる」を使うと、iPhone の通知でバイブが鳴ります。' : 'この端末（パソコンなど）はバイブがありません。音と画面で知らせます。'}</small>` : ''}
        </span>
      </label>
    </section>

    <div class="summary" id="summary">${summaryHtml()}</div>

    <div class="save-bar">
      ${d.id ? `<button type="button" class="btn danger" data-act="delete" data-id="${d.id}">🗑 削除</button>` : ''}
      <button type="button" class="btn" data-act="cancel">やめる</button>
      <button type="button" class="btn primary" data-act="save">💾 保存する</button>
    </div>
  `;
  if (!custom) mountTimeWheel($('#timeWheel'), d.time, (v) => { d.time = v; updateSummary(); });
  if (custom) {
    mountTimeWheel($('#tFromWheel'), d.custom.tFrom, (v) => { d.custom.tFrom = v; updateSummary(); });
    if (Number(d.custom.every) < 1440) mountTimeWheel($('#tToWheel'), d.custom.tTo, (v) => { d.custom.tTo = v; updateSummary(); });
  }
}

function customPanel(d) {
  const c = d.custom;
  const daily = Number(c.every) >= 1440;
  return `
    <div class="custom">
      <div class="field"><label>期間 <small>終わりの日は空欄でもOK（ずっと続く）</small></label>
        <div class="range-row">
          <input type="date" data-c="from" value="${esc(c.from)}"><span>から</span>
          <input type="date" data-c="to" value="${esc(c.to)}"><span>まで</span>
        </div>
      </div>
      <div class="field"><label>間隔</label>
        <div class="chips">${CUSTOM_EVERY.map((x) => `<button type="button" class="chip ${Number(c.every) === x.min ? 'on' : ''}" data-every="${x.min}">${x.label}</button>`).join('')}</div>
      </div>
      <div class="field"><label>${daily ? '時間' : '時間帯'} <small>くるくる回して選ぶ</small></label>
        <div class="range-wheels">
          <div><div id="tFromWheel"></div>${daily ? '' : '<p class="wheel-cap">から</p>'}</div>
          ${daily ? '' : '<div><div id="tToWheel"></div><p class="wheel-cap">まで</p></div>'}
        </div>
      </div>
    </div>`;
}

function voiceArea() {
  if (state.listening) return `<p class="voice-status on">🎙 聞いています… 話してください</p>`;
  const out = [];
  if (state.heard) out.push(`<p class="voice-status">聞き取った内容：「${esc(state.heard)}」</p>`);
  if (state.found.length) out.push(`<div class="found">読み取れた：${state.found.map((f) => `<span class="tag">${esc(f)}</span>`).join('')}</div>`);
  if (!SR && !state.heard) out.push(`<p class="hint">このブラウザは 🎤 ボタンに対応していません。キーボードのマイクで話して入れてから「✨ 文から日にち・時間を読み取る」を押すと、日にちや時間も自動で入ります。</p>`);
  return out.join('');
}

function summaryHtml() {
  const d = state.draft;
  const err = draftError(d);
  if (err) return `<p class="err">⚠️ ${esc(err)}</p>`;
  const list = upcoming(d, 4, Date.now() - 30000);
  if (!list.length) return `<p class="err">⚠️ その時間はもう過ぎています。日にちか時間を変えてください。</p>`;
  return `<p>🔔 <b>${esc(whenJa(list[0]))}</b> に知らせます（${untilJa(list[0])}）</p>
    ${list.length > 1 ? `<p class="next-list">そのあと：${list.slice(1).map((t) => esc(whenJa(t))).join('、')}…</p>` : ''}`;
}
function updateSummary() {
  const el = $('#summary');
  if (el) el.innerHTML = summaryHtml();
  const dj = $('#dateJa');
  if (dj) dj.textContent = mdJa(state.draft.date);
}
function draftError(d) {
  if (d.repeat === 'custom') {
    const c = d.custom;
    if (!c.from) return '期間の「から」の日を選んでください。';
    if (c.to && c.to < c.from) return '期間の「まで」が「から」より前になっています。';
    if (Number(c.every) < 1440 && c.tTo < c.tFrom) return '時間帯の「まで」が「から」より前になっています。';
  } else if (!d.date || !d.time) return '日にちと時間を選んでください。';
  return '';
}

// 前に使った項目（同じ名前は新しいものだけ）
function recentTitles() {
  const seen = new Set();
  return [...db.reminders]
    .sort((a, b) => (b.doneAt || b.createdAt || 0) - (a.doneAt || a.createdAt || 0))
    .filter((r) => r.title && !r.test && !seen.has(r.title) && seen.add(r.title))
    .slice(0, 8);
}

function saveDraft() {
  const d = state.draft;
  d.title = (d.title || '').trim() || 'リマインダー';
  const err = draftError(d);
  if (err) { toast(err); return; }
  const next = occurrenceAfter(d, Date.now() - 30000);
  if (next == null) { toast('その時間はもう過ぎています'); return; }
  if (d.repeat === 'custom') { d.date = d.custom.from; d.time = d.custom.tFrom; }
  const r = { ...clone(d), next, snoozeAt: null, done: false, doneAt: null };
  if (r.id) {
    const i = db.reminders.findIndex((x) => x.id === r.id);
    db.reminders[i] = r;
  } else {
    r.id = uid();
    r.createdAt = Date.now();
    db.reminders.push(r);
  }
  persist();
  toast(`保存しました：${whenJa(next)}`);
  maybeAskPermission();
  state.tab = 'list';
  render();
}

// 音声や文章から読み取った内容を入力欄に入れる
function applyText(text) {
  const p = parseReminderText(text);
  const d = state.draft;
  if (p.title) d.title = p.title;
  if (p.repeat) d.repeat = p.repeat;
  if (p.custom) d.custom = p.custom;
  else if (p.date) { d.date = p.date; d.time = p.time; d.custom.from = p.date; }
  state.found = p.found;
  render();
}

// ---------- 音声入力 ----------
let recog = null;
function startVoice() {
  if (!SR) {
    toast('このブラウザは音声ボタンに対応していません。キーボードのマイクを使ってください');
    const t = $('#fTitle');
    if (t) t.focus();
    return;
  }
  if (state.listening && recog) { recog.stop(); return; }
  unlockAudio();
  recog = new SR();
  recog.lang = 'ja-JP';
  recog.interimResults = true;
  recog.continuous = false;
  let finalText = '';
  recog.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
      else interim += e.results[i][0].transcript;
    }
    const st = $('#voiceArea .voice-status');
    if (st && interim) st.textContent = `🎙 「${interim}」`;
  };
  recog.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') toast('マイクの使用が許可されていません（ブラウザの設定で許可してください）');
    else if (e.error === 'no-speech') toast('声が聞き取れませんでした。もう一度どうぞ');
  };
  recog.onend = () => {
    state.listening = false;
    if (finalText.trim()) {
      state.heard = finalText.trim();
      applyText(state.heard);
    } else if (state.tab === 'edit') {
      $('#voiceArea').innerHTML = voiceArea();
      document.querySelector('.mic-btn')?.classList.remove('on');
    }
  };
  state.listening = true;
  state.heard = '';
  state.found = [];
  if (state.tab === 'edit') {
    $('#voiceArea').innerHTML = voiceArea();
    document.querySelector('.mic-btn')?.classList.add('on');
  }
  try { recog.start(); } catch (e) { state.listening = false; toast('音声入力を始められませんでした'); }
}

// ---------- 完了 ----------
function renderDone() {
  const done = db.reminders.filter((r) => r.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  main.innerHTML = done.length ? `
    <p class="hint">「🔁 もう一回使う」で、同じ項目・色・くり返しのまま、新しい日時で作り直せます。</p>
    <div class="cards">${done.map((r) => `
      <div class="card rem done" style="--c:${colorOf(r.color).hex}">
        <div class="rem-main static">
          <span class="rem-title">${esc(r.title)}</span>
          <span class="rem-sub">
            ${r.doneAt ? `<span>${esc(whenJa(r.doneAt))} に完了</span>` : ''}
            ${repeatLabel(r) ? `<span class="tag">🔁 ${esc(repeatLabel(r))}</span>` : ''}
          </span>
        </div>
        <div class="row-actions">
          <button type="button" class="btn small primary" data-act="reuse" data-id="${r.id}">🔁 もう一回使う</button>
          <button type="button" class="icon-btn" data-act="delete" data-id="${r.id}" aria-label="削除">🗑</button>
        </div>
      </div>`).join('')}
    </div>
    <button type="button" class="btn block" data-act="clear-done">完了したものをすべて消す</button>
  ` : `<p class="empty">完了したものはまだありません。</p>`;
}

// 前のリマインダーをもとに新しく作る（時間は同じ、日にちは今日か明日）
function reuse(id) {
  const src = byId(id);
  if (!src) return;
  const d = { ...blankReminder(), title: src.title, color: src.color, vibrate: src.vibrate, repeat: src.repeat, custom: clone(src.custom) };
  const t = toDate(todayStr(), src.time);
  d.time = src.time;
  d.date = ymd(t.getTime() > Date.now() ? t : addDays(t, 1));
  if (d.repeat === 'custom') {
    // 期間は同じ日数のまま今日からにずらす
    const len = src.custom.to ? Math.round((toDate(src.custom.to) - toDate(src.custom.from)) / DAY) : null;
    d.custom.from = todayStr();
    d.custom.to = len == null ? '' : ymd(addDays(new Date(), len));
  }
  state.draft = d;
  state.heard = '';
  state.found = [];
  state.tab = 'edit';
  render();
}

// ---------- 設定 ----------
function renderSettings() {
  const s = db.settings;
  const perm = 'Notification' in window ? Notification.permission : 'unsupported';
  main.innerHTML = `
    <section class="panel">
      <h2>🔔 知らせ方</h2>
      <p>通知：<b>${{ granted: '✅ 許可されています', denied: '❌ ブロックされています（ブラウザの設定から許可してください）', default: 'まだ許可していません', unsupported: 'このブラウザは通知に対応していません' }[perm]}</b></p>
      ${perm === 'default' ? '<button type="button" class="btn primary" data-act="perm">通知を許可する</button>' : ''}
      <label class="switch"><input type="checkbox" data-s="sound" ${s.sound ? 'checked' : ''}><span class="sw"></span><span><b>🔊 音も鳴らす</b></span></label>
      ${'wakeLock' in navigator ? `<label class="switch"><input type="checkbox" data-s="keepAwake" ${s.keepAwake ? 'checked' : ''}><span class="sw"></span>
        <span><b>💡 アプリを開いている間は画面を消さない</b><small>5分ごと・10分ごとなど、すぐ先の予定を確実に鳴らしたいときに</small></span></label>` : ''}
      <button type="button" class="btn" data-act="test">🔔 ためしに鳴らす（5秒後）</button>
    </section>

    <section class="panel">
      <h2>🎨 色の名前</h2>
      <p class="hint">「赤＝仕事」「緑＝家のこと」のように名前を付けられます。</p>
      <div class="color-names">${COLORS.map((c) => `
        <label><span class="dot" style="--c:${c.hex}"></span><input type="text" data-cname="${c.id}" value="${esc(s.colorNames[c.id] || '')}" placeholder="${esc(c.name)}"></label>`).join('')}
      </div>
    </section>

    <section class="panel">
      <h2>💾 バックアップ</h2>
      <p class="hint">リマインダーはこの端末のブラウザの中だけに保存されています。機種変更のときなどに使ってください。</p>
      <div class="row-actions">
        <button type="button" class="btn" data-act="export">📥 書き出す</button>
        <label class="btn file-btn">📂 読み込む<input type="file" accept=".json,application/json" data-act="import" hidden></label>
      </div>
    </section>

    <section class="panel">
      <h2>📱 確実に知らせるために</h2>
      <ul class="tips">
        <li><b>ホーム画面に追加</b>して、アプリとして開いてください。</li>
        <li>このアプリは<b>開いている間</b>（裏に置いている間も多くの場合）に知らせます。アプリを完全に閉じる・電源を切る・電池の節約モードなどでは鳴らないことがあります。</li>
        <li>閉じた後にあとで開くと、鳴らなかったものは「見逃し」としてまとめて出ます。</li>
        <li>大事な予定は「📅 カレンダーに入れる」で携帯のカレンダーにも入れると、アプリを閉じていても携帯が知らせてくれます（iPhone のバイブもこちらで鳴ります）。</li>
        ${IS_IOS ? '<li>iPhone で通知を出すには、iOS 16.4 以上で「ホーム画面に追加」したアプリから開く必要があります。</li>' : ''}
      </ul>
    </section>
  `;
}

// ---------- 時間になったら知らせる ----------
function check() {
  const now = Date.now();
  let changed = false;
  db.reminders.forEach((r) => {
    if (r.done) return;
    const due = dueOf(r);
    if (due == null || due > now) return;
    ring(r, due);
    if (r.snoozeAt != null && r.snoozeAt <= now) r.snoozeAt = null;
    if (r.next != null && r.next <= now) r.next = occurrenceAfter(r, now); // 見逃した分はまとめて1回にする
    if (r.next == null && r.snoozeAt == null) { r.done = true; r.doneAt = now; }
    r.lastFired = now;
    changed = true;
  });
  if (changed) {
    persist();
    if (state.tab !== 'edit') render();
  } else if (state.tab === 'list' && now - (check.lastPaint || 0) > 30000) {
    // 「あと◯分」の表示を新しくする
    check.lastPaint = now;
    render();
  }
}

function ring(r, at) {
  if (!alarms.some((a) => a.id === r.id)) alarms.push({ id: r.id, at });
  showAlarm();
  notify(r, at);
}

function showAlarm() {
  const el = $('#alarm');
  const list = alarms.map((a) => ({ a, r: byId(a.id) })).filter((x) => x.r);
  if (!list.length) { el.hidden = true; document.body.classList.remove('sheet-open'); stopRinging(); return; }
  el.hidden = false;
  document.body.classList.add('sheet-open');
  el.innerHTML = `
    <div class="alarm-box">
      <div class="alarm-bell">⏰</div>
      ${list.map(({ a, r }) => {
        const missed = Date.now() - a.at > 2 * MIN;
        return `
        <div class="alarm-item" style="--c:${colorOf(r.color).hex}">
          <div class="alarm-time">${esc(whenJa(a.at))}${missed ? ' <span class="late">（見逃し）</span>' : ''}</div>
          <div class="alarm-title">${esc(r.title)}</div>
          ${repeatLabel(r) ? `<div class="alarm-rep">🔁 ${esc(repeatLabel(r))}${r.next ? ` ・ 次は ${esc(whenJa(r.next))}` : ''}</div>` : ''}
          <div class="alarm-snooze">
            <span>もう一度：</span>
            ${SNOOZES.map((m) => `<button type="button" class="chip" data-snooze="${m}" data-id="${r.id}">${m < 60 ? m + '分後' : '1時間後'}</button>`).join('')}
          </div>
          <div class="alarm-actions">
            <button type="button" class="btn primary" data-alarm="ok" data-id="${r.id}">✅ ${r.repeat === 'none' ? '完了' : 'OK（止める）'}</button>
            ${r.repeat !== 'none' && !r.done ? `<button type="button" class="btn" data-alarm="end" data-id="${r.id}">くり返しを終わる</button>` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>`;
  startRinging(list.some(({ r }) => r.vibrate));
}

function dismissAlarm(id) {
  const i = alarms.findIndex((a) => a.id === id);
  if (i >= 0) alarms.splice(i, 1);
  // 「ためしに鳴らす」で作ったものは残さない
  const r = byId(id);
  if (r && r.test && r.done) { db.reminders = db.reminders.filter((x) => x !== r); persist(); if (state.tab === 'done') render(); }
  closeNotification(id);
  showAlarm();
}
function snooze(id, minutes) {
  const r = byId(id);
  if (!r) return;
  r.snoozeAt = Date.now() + minutes * MIN;
  r.done = false;
  r.doneAt = null;
  persist();
  dismissAlarm(id);
  toast(`${minutes < 60 ? minutes + '分' : '1時間'}後にもう一度知らせます`);
  render();
}
function finish(id) {
  const r = byId(id);
  if (!r) return;
  r.done = true;
  r.doneAt = Date.now();
  r.next = null;
  r.snoozeAt = null;
  persist();
  dismissAlarm(id);
  render();
}

// 音（ピピピッ）とバイブをくり返す。止めるまで最大1分
let ringTimer = null;
function startRinging(vibrate) {
  stopRinging();
  const started = Date.now();
  const once = () => {
    if (Date.now() - started > 60000) { stopRinging(); return; }
    if (db.settings.sound) beep();
    if (vibrate && CAN_VIBRATE) try { navigator.vibrate([400, 150, 400, 150, 400]); } catch (e) { /* 無視 */ }
  };
  once();
  ringTimer = setInterval(once, 2500);
}
function stopRinging() {
  clearInterval(ringTimer);
  ringTimer = null;
  if (CAN_VIBRATE) try { navigator.vibrate(0); } catch (e) { /* 無視 */ }
}

let audioCtx = null;
// 音はボタンを一度押したあとでないと鳴らせないので、最初のタップで準備しておく
function unlockAudio() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch (e) { /* 無視 */ }
}
function beep() {
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime;
  [0, 0.18, 0.36].forEach((dt) => {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.value = 1046;
    g.gain.setValueAtTime(0.0001, t0 + dt);
    g.gain.exponentialRampToValueAtTime(0.35, t0 + dt + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.14);
    o.connect(g).connect(audioCtx.destination);
    o.start(t0 + dt);
    o.stop(t0 + dt + 0.16);
  });
}

// ---------- 通知 ----------
async function notify(r, at) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  // 画面を見ているときはアプリの画面で知らせるので、通知は裏にいるときだけ
  if (document.visibilityState === 'visible' && document.hasFocus()) return;
  const opts = {
    body: `${whenJa(at)}${repeatLabel(r) ? ' ・ 🔁 ' + repeatLabel(r) : ''}`,
    tag: r.id,
    renotify: true,
    requireInteraction: true,
    vibrate: r.vibrate ? [400, 150, 400, 150, 400] : [],
    silent: !r.vibrate && !db.settings.sound,
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    data: { id: r.id },
    actions: [{ action: 'done', title: '✅ 完了' }, { action: 'snooze5', title: '💤 5分後' }],
  };
  try {
    const reg = navigator.serviceWorker && (await navigator.serviceWorker.getRegistration());
    if (reg) await reg.showNotification(r.title, opts);
    else new Notification(r.title, opts);
  } catch (e) {
    try { new Notification(r.title, { body: opts.body, tag: opts.tag }); } catch (e2) { /* 無視 */ }
  }
}
async function closeNotification(id) {
  try {
    const reg = navigator.serviceWorker && (await navigator.serviceWorker.getRegistration());
    if (reg) (await reg.getNotifications({ tag: id })).forEach((n) => n.close());
  } catch (e) { /* 無視 */ }
}
function handleNotifAction(id, action) {
  if (action === 'done') { const r = byId(id); if (r && r.repeat === 'none') finish(id); else dismissAlarm(id); }
  else if (action === 'snooze5') snooze(id, 5);
  else showAlarm();
}
async function askPermission() {
  if (!('Notification' in window)) { toast('このブラウザは通知に対応していません'); return; }
  const p = await Notification.requestPermission();
  toast(p === 'granted' ? '通知を許可しました' : '通知は許可されませんでした');
  render();
}
function maybeAskPermission() {
  if ('Notification' in window && Notification.permission === 'default' && !db.settings.askedPerm) {
    db.settings.askedPerm = true;
    persist();
    askPermission();
  }
}

// 画面を消さない（対応しているブラウザだけ）
let wakeLock = null;
async function applyWakeLock() {
  try {
    if (db.settings.keepAwake && 'wakeLock' in navigator && document.visibilityState === 'visible') {
      if (!wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
    } else if (wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { wakeLock = null; }
}

// ---------- ファイル ----------
function downloadFile(name, text, type) {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function exportIcs(id) {
  const r = byId(id);
  if (!r) return;
  downloadFile(`${(r.title || 'remind').replace(/[\\/:*?"<>|]/g, '').slice(0, 30) || 'remind'}.ics`, buildIcs(r), 'text/calendar;charset=utf-8');
  toast('カレンダー用のファイルを作りました。開いて「追加」を押してください');
}

// ---------- 操作 ----------
document.getElementById('tabbar').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tab]');
  if (b) { unlockAudio(); goTab(b.dataset.tab); }
});

document.addEventListener('click', (e) => {
  unlockAudio();
  const t = e.target;
  const act = t.closest('[data-act]');
  const d = state.draft;

  const sn = t.closest('[data-snooze]');
  if (sn) { snooze(sn.dataset.id, Number(sn.dataset.snooze)); return; }
  const al = t.closest('[data-alarm]');
  if (al) {
    const r = byId(al.dataset.id);
    if (al.dataset.alarm === 'end' || (r && r.repeat === 'none')) finish(al.dataset.id);
    else dismissAlarm(al.dataset.id);
    return;
  }
  const f = t.closest('[data-filter]');
  if (f) { state.filter = f.dataset.filter; render(); return; }
  const rc = t.closest('[data-recent]');
  if (rc) {
    const src = recentTitles()[Number(rc.dataset.recent)];
    Object.assign(d, { title: src.title, color: src.color, vibrate: src.vibrate });
    render();
    return;
  }
  const later = t.closest('[data-later]');
  if (later) {
    const x = new Date(Date.now() + Number(later.dataset.later) * MIN);
    d.date = ymd(x); d.time = hm(x);
    render();
    return;
  }
  const day = t.closest('[data-day]');
  if (day) { d.date = ymd(addDays(new Date(), Number(day.dataset.day))); $('#fDate').value = d.date; updateSummary(); return; }
  const ev = t.closest('[data-every]');
  if (ev) { d.custom.every = Number(ev.dataset.every); render(); return; }

  if (!act || act.tagName === 'INPUT') return;
  const id = act.dataset.id;
  switch (act.dataset.act) {
    case 'voice-add': goTab('edit'); startVoice(); break;
    case 'voice': startVoice(); break;
    case 'parse': {
      const text = $('#fTitle').value;
      if (!text.trim()) { toast('先に項目の欄に文を入れてください（例：明日の3時に電話）'); break; }
      state.heard = '';
      applyText(text);
      toast(state.found.length ? '読み取りました' : '日にち・時間は見つかりませんでした');
      break;
    }
    case 'edit': state.draft = clone(byId(id)); state.heard = ''; state.found = []; state.tab = 'edit'; render(); break;
    case 'save': saveDraft(); break;
    case 'cancel': state.tab = 'list'; render(); break;
    case 'done': finish(id); toast('完了にしました（「✅ 完了」からもう一回使えます）'); break;
    case 'delete': {
      const r = byId(id);
      if (r && confirm(`「${r.title}」を削除しますか？`)) {
        db.reminders = db.reminders.filter((x) => x.id !== id);
        persist();
        dismissAlarm(id);
        if (state.tab === 'edit') state.tab = 'list';
        render();
      }
      break;
    }
    case 'ics': exportIcs(id); break;
    case 'reuse': reuse(id); break;
    case 'clear-done':
      if (confirm('完了したものをすべて削除しますか？')) { db.reminders = db.reminders.filter((r) => !r.done); persist(); render(); }
      break;
    case 'perm': askPermission(); break;
    case 'hide-tip': db.settings.hideTip = true; persist(); render(); break;
    case 'test': {
      const r = { ...blankReminder(), id: uid(), title: 'テストのお知らせ', test: true, date: todayStr(), time: hm(new Date()), createdAt: Date.now() };
      r.next = Date.now() + 5000;
      r.vibrate = true;
      db.reminders.push(r);
      persist();
      toast('5秒後に鳴ります');
      break;
    }
    case 'export':
      downloadFile(`remind-backup-${todayStr()}.json`, JSON.stringify(db, null, 1), 'application/json');
      break;
    default: break;
  }
});

document.addEventListener('input', (e) => {
  const t = e.target;
  const d = state.draft;
  if (t.dataset.f === 'title') d.title = t.value;
  if (t.dataset.cname) { db.settings.colorNames[t.dataset.cname] = t.value; persist(); }
});

document.addEventListener('change', (e) => {
  const t = e.target;
  const d = state.draft;
  if (t.dataset.f === 'date') { d.date = t.value; updateSummary(); }
  if (t.dataset.f === 'vibrate') d.vibrate = t.checked;
  if (t.name === 'color') d.color = t.value;
  if (t.name === 'repeat') {
    if (t.value === 'custom' && d.repeat !== 'custom') d.custom = { ...d.custom, from: d.date, tFrom: d.time };
    d.repeat = t.value;
    render();
  }
  if (t.dataset.c) { d.custom[t.dataset.c] = t.value; updateSummary(); }
  if (t.dataset.s) { db.settings[t.dataset.s] = t.checked; persist(); if (t.dataset.s === 'keepAwake') applyWakeLock(); }
  if (t.dataset.act === 'import' && t.files[0]) {
    t.files[0].text().then((txt) => {
      const data = JSON.parse(txt);
      if (!Array.isArray(data.reminders)) throw new Error('bad');
      if (!confirm(`${data.reminders.length}件のリマインダーを読み込みます。いまのデータは置き換わります。よろしいですか？`)) return;
      saveDb(data);
      db = loadDb();
      toast('読み込みました');
      render();
    }).catch(() => toast('読み込めませんでした（このアプリで書き出したファイルを選んでください）'));
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'fTitle') e.target.blur();
});

document.addEventListener('visibilitychange', () => { check(); applyWakeLock(); });
window.addEventListener('focus', check);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'notif') handleNotifAction(e.data.id, e.data.action);
  });
}

// ---------- 起動 ----------
render();
check();
setInterval(check, 5000);
applyWakeLock();
{
  const q = new URLSearchParams(location.search);
  if (q.get('notif')) {
    handleNotifAction(q.get('id'), q.get('notif'));
    history.replaceState(null, '', location.pathname);
  }
}
