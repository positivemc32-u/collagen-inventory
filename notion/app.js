// =============================================================
// app.js … Notionメモ
//   文字か声で書いたメモを、iPhone の「ショートカット」アプリ経由で Notion に送ります。
//   ・Notion の鍵（シークレット）はこのアプリには入れません。ショートカットの中だけに入れます。
//   ・このアプリが持つのは「送り先のページ／データベースの場所」と下書き・送った記録だけで、
//     どちらもこの端末のブラウザの中（localStorage）にだけ保存されます。
// =============================================================
'use strict';

const $ = (s) => document.querySelector(s);
const main = $('#main');
const KEY = 'notion-memo-v1';
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const IS_STANDALONE = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;

const DEFAULTS = {
  settings: {
    target: '',          // Notion のページ／データベースの URL（または ID）
    kind: 'database',    // 'database' | 'page'
    titleProp: '名前',   // データベースのタイトル列の名前
    dateProp: '',        // （任意）日付の列の名前
    tagProp: '',         // （任意）マルチセレクトの列の名前
    shortcutName: 'Notionに送る',
    addTime: false,      // 本文の最初に日時を入れる
    returnBack: !IS_STANDALONE, // 送ったあと、このページに戻ってくる
  },
  draft: { title: '', body: '', tags: '' },
  history: [],
};

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (d) return { settings: { ...DEFAULTS.settings, ...d.settings }, draft: { ...DEFAULTS.draft, ...d.draft }, history: d.history || [] };
  } catch (e) { /* 読めないときは最初から */ }
  return JSON.parse(JSON.stringify(DEFAULTS));
}
const db = load();
function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* 保存できない環境 */ } }

const state = { tab: 'write', listening: false, interim: '' };

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function toast(msg, ms = 2800) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.hidden = true; }, ms);
}
function pad(n) { return String(n).padStart(2, '0'); }
function fmt(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function isoDate(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ---------- Notion の ID を URL から取り出す ----------
function extractId(s) {
  s = String(s || '').trim();
  if (!s) return '';
  let path = s;
  try { const u = new URL(s); path = u.pathname; } catch (e) { path = s.split('?')[0]; }
  // 最後の区切り（/）のあとの部分の「おしり」にある 32 文字が ID。
  // 「Mobile-<ID>」のようにページ名の最後の文字が a〜f でも、名前の文字を ID に混ぜないようにする
  const seg = path.split('/').filter(Boolean).pop() || '';
  const m = seg.match(/([0-9a-f]{8})-?([0-9a-f]{4})-?([0-9a-f]{4})-?([0-9a-f]{4})-?([0-9a-f]{12})$/i);
  if (!m) return '';
  const h = m.slice(1).join('').toLowerCase();
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
function guessKind(s) { return /[?&]v=/.test(String(s || '')) ? 'database' : null; }

// ---------- Notion に送る中身（JSON）を作る ----------
function richText(text) {
  // Notion は 1つの文字のかたまりが 2000 文字までなので分ける
  const out = [];
  for (let i = 0; i < text.length; i += 1900) out.push({ type: 'text', text: { content: text.slice(i, i + 1900) } });
  return out;
}
function makeTitle(title, body, ts) {
  const t = title.trim();
  if (t) return t;
  const first = body.split('\n').map((l) => l.trim()).find(Boolean) || '';
  if (first) return first.length > 40 ? first.slice(0, 40) + '…' : first;
  return `${fmt(ts)} のメモ`;
}
function buildPayload(item) {
  const s = db.settings;
  const id = extractId(s.target);
  const title = makeTitle(item.title, item.body, item.at);
  let lines = item.body.replace(/\r\n?/g, '\n').split('\n');
  if (s.addTime) lines = [`🕘 ${fmt(item.at)}`, ...lines];
  // 前後の空行はけずる
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  // Notion は 1回で 100 ブロックまで。多いときは最後のブロックにまとめる
  if (lines.length > 100) lines = [...lines.slice(0, 99), lines.slice(99).join('\n')];
  const children = lines.map((l) => ({ object: 'block', type: 'paragraph', paragraph: { rich_text: l ? richText(l) : [] } }));

  const payload = { children };
  if (s.kind === 'page') {
    payload.parent = { page_id: id };
    payload.properties = { title: { title: richText(title) } };
  } else {
    payload.parent = { database_id: id };
    const props = { [s.titleProp.trim() || '名前']: { title: richText(title) } };
    if (s.dateProp.trim()) props[s.dateProp.trim()] = { date: { start: isoDate(item.at) } };
    const tags = (item.tags || '').split(/[,、，\s]+/).map((t) => t.trim()).filter(Boolean);
    if (s.tagProp.trim() && tags.length) props[s.tagProp.trim()] = { multi_select: tags.map((name) => ({ name: name.replace(/,/g, ' ') })) };
    payload.properties = props;
  }
  return JSON.stringify(payload);
}

function shortcutUrl(payloadText) {
  const name = db.settings.shortcutName.trim() || 'Notionに送る';
  const base = location.href.split('?')[0].split('#')[0];
  let url = 'shortcuts://x-callback-url/run-shortcut'
    + `?name=${encodeURIComponent(name)}&input=text&text=${encodeURIComponent(payloadText)}`;
  if (db.settings.returnBack) {
    url += `&x-success=${encodeURIComponent(base + '?r=ok')}`
      + `&x-error=${encodeURIComponent(base + '?r=err')}`
      + `&x-cancel=${encodeURIComponent(base + '?r=cancel')}`;
  }
  return url;
}

function ready() { return !!extractId(db.settings.target); }

function send(item) {
  if (!ready()) { toast('先に「設定」で送り先の Notion を入れてください'); go('settings'); return false; }
  location.href = shortcutUrl(buildPayload(item));
  return true;
}

// ---------- 画面：書く ----------
function renderWrite() {
  const d = db.draft;
  const s = db.settings;
  main.innerHTML = `
    ${ready() ? '' : `<div class="warn">はじめに <b>⚙️ 設定</b> で、送り先の Notion とショートカットを準備してください。</div>`}
    <div class="mic-wrap">
      <button type="button" class="mic-btn ${state.listening ? 'on' : ''}" id="mic" aria-label="音声入力">🎤</button>
      <div class="mic-label" id="micLabel">${state.listening ? (state.interim ? `🎙 ${esc(state.interim)}` : '聞いています…（もう一度押すと止まります）') : (SR ? '押して話す' : 'キーボードのマイク 🎙 で話してください')}</div>
    </div>
    <div class="card">
      <label class="f" for="title">タイトル <small>（空なら1行目が入ります）</small></label>
      <input type="text" id="title" value="${esc(d.title)}" placeholder="例：買い物メモ" enterkeyhint="next">
      <label class="f" for="body">本文</label>
      <textarea id="body" placeholder="ここに書くか、🎤 を押して話してください">${esc(d.body)}</textarea>
      <div class="counter" id="counter">${d.body.length} 文字</div>
      ${s.kind === 'database' && s.tagProp.trim() ? `
        <label class="f" for="tags">${esc(s.tagProp)} <small>（いくつかあるときは「、」で区切る）</small></label>
        <input type="text" id="tags" value="${esc(d.tags)}" placeholder="例：仕事、アイデア">` : ''}
      <div class="send-row">
        <button type="button" class="btn" id="clear">消す</button>
        <button type="button" class="btn primary" id="send">Notion に送る ➜</button>
      </div>
      <p class="hint">「送る」を押すと「ショートカット」アプリが開いて、Notion に保存されます。</p>
    </div>
    <div class="row">
      <button type="button" class="btn small" id="copy">📋 本文をコピー</button>
      <button type="button" class="btn small" id="openNotion">Notion を開く</button>
    </div>
  `;
  const upd = () => {
    db.draft.title = $('#title').value;
    db.draft.body = $('#body').value;
    if ($('#tags')) db.draft.tags = $('#tags').value;
    $('#counter').textContent = `${db.draft.body.length} 文字`;
    save();
  };
  ['#title', '#body', '#tags'].forEach((sel) => { const el = $(sel); if (el) el.addEventListener('input', upd); });
  $('#mic').onclick = toggleVoice;
  $('#clear').onclick = () => {
    if ((db.draft.body || db.draft.title) && !confirm('書いた内容を消しますか？')) return;
    stopVoice();
    db.draft = { ...DEFAULTS.draft };
    save();
    renderWrite();
  };
  $('#send').onclick = () => {
    upd();
    stopVoice();
    if (!db.draft.body.trim() && !db.draft.title.trim()) { toast('何も書かれていません'); return; }
    const item = { id: Date.now().toString(36), at: Date.now(), title: db.draft.title, body: db.draft.body, tags: db.draft.tags, status: 'sent' };
    if (!send(item)) return;
    db.history.unshift(item);
    db.history = db.history.slice(0, 100);
    db.draft = { ...DEFAULTS.draft, tags: db.draft.tags };
    save();
    setTimeout(renderWrite, 300);
  };
  $('#copy').onclick = async () => {
    upd();
    try { await navigator.clipboard.writeText(db.draft.body); toast('コピーしました'); } catch (e) { toast('コピーできませんでした'); }
  };
  $('#openNotion').onclick = () => {
    const id = extractId(db.settings.target);
    location.href = id ? `notion://www.notion.so/${id.replace(/-/g, '')}` : 'notion://';
  };
}

// ---------- 音声入力 ----------
let recog = null;
let voiceBase = '';
function setMicUi() {
  const b = $('#mic'); const l = $('#micLabel');
  if (!b || !l) return;
  b.classList.toggle('on', state.listening);
  l.textContent = state.listening ? (state.interim ? `🎙 ${state.interim}` : '聞いています…（もう一度押すと止まります）') : '押して話す';
}
function stopVoice() { if (recog && state.listening) { try { recog.stop(); } catch (e) { /* 無視 */ } } }
function toggleVoice() {
  if (!SR) {
    toast('この画面では音声ボタンが使えません。キーボードのマイク 🎙 で話してください', 4000);
    $('#body').focus();
    return;
  }
  if (state.listening) { stopVoice(); return; }
  recog = new SR();
  recog.lang = 'ja-JP';
  recog.interimResults = true;
  recog.continuous = true;
  const ta = $('#body');
  voiceBase = ta.value;
  if (voiceBase && !/\n$/.test(voiceBase)) voiceBase += '\n';
  let finals = '';
  recog.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) finals += e.results[i][0].transcript;
      else interim += e.results[i][0].transcript;
    }
    state.interim = interim;
    const t = $('#body');
    if (t) {
      t.value = voiceBase + finals;
      db.draft.body = t.value;
      $('#counter').textContent = `${t.value.length} 文字`;
      save();
    }
    setMicUi();
  };
  recog.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') toast('マイクが許可されていません。iPhone の「設定」→ Safari → マイク で許可するか、キーボードのマイクを使ってください', 5000);
    else if (e.error === 'no-speech') toast('声が聞き取れませんでした。もう一度どうぞ');
  };
  recog.onend = () => {
    state.listening = false;
    state.interim = '';
    setMicUi();
  };
  try {
    recog.start();
    state.listening = true;
    state.interim = '';
    setMicUi();
  } catch (e) {
    state.listening = false;
    toast('音声入力を始められませんでした');
  }
}

// ---------- 画面：送ったもの ----------
function renderHistory() {
  const h = db.history;
  main.innerHTML = h.length ? `
    <p class="hint">ここに出るのは「ショートカットに渡したもの」です。Notion に入っていなかったときは「もう一度送る」を押してください。</p>
    <div class="card"><ul class="hist">${h.map((it) => `
      <li data-id="${esc(it.id)}">
        <div class="t">${esc(makeTitle(it.title, it.body, it.at))}</div>
        <div class="m">${esc(fmt(it.at))}${it.tags ? ` ・ ${esc(it.tags)}` : ''}</div>
        <div class="b">${esc(it.body)}</div>
        <div class="acts">
          <button type="button" class="btn small" data-act="resend">↻ もう一度送る</button>
          <button type="button" class="btn small" data-act="edit">✏️ 直して送る</button>
          <button type="button" class="btn small danger" data-act="del">削除</button>
        </div>
      </li>`).join('')}</ul></div>
    <button type="button" class="btn small danger" id="clearAll">記録をすべて消す</button>
    <p class="hint">記録を消しても Notion に入ったメモは消えません。</p>
  ` : '<div class="empty">まだ送ったものはありません</div>';
  main.querySelectorAll('[data-act]').forEach((b) => {
    b.onclick = () => {
      const id = b.closest('li').dataset.id;
      const it = db.history.find((x) => x.id === id);
      if (!it) return;
      if (b.dataset.act === 'resend') send(it);
      else if (b.dataset.act === 'edit') {
        db.draft = { title: it.title, body: it.body, tags: it.tags || '' };
        save();
        go('write');
      } else if (b.dataset.act === 'del') {
        db.history = db.history.filter((x) => x.id !== id);
        save();
        renderHistory();
      }
    };
  });
  const ca = $('#clearAll');
  if (ca) ca.onclick = () => { if (confirm('送った記録をすべて消しますか？（Notion のメモは消えません）')) { db.history = []; save(); renderHistory(); } };
}

// ---------- 画面：設定 ----------
function renderSettings() {
  const s = db.settings;
  const id = extractId(s.target);
  main.innerHTML = `
    <div class="card">
      <h2 style="margin:0 0 4px;font-size:1.05rem">① 送り先の Notion</h2>
      <p class="hint">Notion で送り先のページ（またはデータベース）を開き、右上の「…」→「リンクをコピー」で取ったリンクを貼り付けてください。</p>
      <label class="f" for="target">送り先のリンク</label>
      <input type="url" id="target" value="${esc(s.target)}" placeholder="https://www.notion.so/...">
      <div id="idMsg" class="${id ? 'idok' : 'idng'}">${id ? `✓ 読み取れました（${esc(id)}）` : (s.target ? '× リンクから場所を読み取れませんでした' : '')}</div>
      <label class="f">送り先の種類</label>
      <div class="radio">
        <label><input type="radio" name="kind" value="database" ${s.kind === 'database' ? 'checked' : ''}>データベース<br><small>1メモ＝1行</small></label>
        <label><input type="radio" name="kind" value="page" ${s.kind === 'page' ? 'checked' : ''}>ページ<br><small>中に子ページ</small></label>
      </div>
      <div id="dbOpts" ${s.kind === 'database' ? '' : 'hidden'}>
        <label class="f" for="titleProp">タイトル列の名前 <small>（ふつうは「名前」か「Name」）</small></label>
        <input type="text" id="titleProp" value="${esc(s.titleProp)}">
        <label class="f" for="dateProp">日付の列の名前 <small>（任意・日付の列があれば今日の日付が入ります）</small></label>
        <input type="text" id="dateProp" value="${esc(s.dateProp)}" placeholder="例：日付">
        <label class="f" for="tagProp">タグの列の名前 <small>（任意・マルチセレクトの列）</small></label>
        <input type="text" id="tagProp" value="${esc(s.tagProp)}" placeholder="例：タグ">
      </div>
    </div>

    <div class="card">
      <h2 style="margin:0 0 4px;font-size:1.05rem">② ショートカット</h2>
      <label class="f" for="shortcutName">ショートカットの名前 <small>（ショートカットアプリで付けた名前と同じに）</small></label>
      <input type="text" id="shortcutName" value="${esc(s.shortcutName)}">
      <label class="check"><input type="checkbox" id="returnBack" ${s.returnBack ? 'checked' : ''}><span>送ったあと、このページに戻ってくる<br><small>ホーム画面から開いている場合は Safari で開いてしまうので、オフがおすすめです</small></span></label>
      <label class="check"><input type="checkbox" id="addTime" ${s.addTime ? 'checked' : ''}><span>本文の最初に日時を入れる</span></label>
      <div class="row" style="margin-top:14px">
        <button type="button" class="btn" id="test">🧪 テストで送ってみる</button>
      </div>
    </div>

    <div class="card">
      <h2 style="margin:0 0 4px;font-size:1.05rem">はじめの準備（1回だけ）</h2>
      <ol class="steps">
        <li>パソコンかスマホで <code>https://www.notion.so/profile/integrations</code> を開き、「＋ 新規コネクト」→ 名前「メモ送信」・認証方法「APIトークン」で作成。出てきたトークン（<code>ntn_</code> で始まる文字）をコピー。</li>
        <li>Notion で送り先のページ／データベースを開き、右上「…」→「接続」→ 作った「メモ送信」を追加。</li>
        <li>iPhone の「ショートカット」アプリで ＋ → 名前を <b>${esc(s.shortcutName || 'Notionに送る')}</b> にして、アクション「<b>URLの内容を取得</b>」を1つ追加：
          <ul>
            <li>URL：<code>https://api.notion.com/v1/pages</code></li>
            <li>方法：<code>POST</code></li>
            <li>ヘッダ（3つ追加）：<br>
              <code>Authorization</code> ＝ <code>Bearer ntn_…</code>（①でコピーした文字。Bearer のあとに半角スペース）<br>
              <code>Notion-Version</code> ＝ <code>2022-06-28</code><br>
              <code>Content-Type</code> ＝ <code>application/json</code></li>
            <li>本文を要求：<b>ファイル</b> → 「ショートカットの入力」を選ぶ</li>
          </ul>
        </li>
        <li>（おすすめ）その下に「通知を表示」を追加して「Notion に送りました」と入れておくと、送れたか分かります。</li>
        <li>上の「🧪 テストで送ってみる」で Notion にテストのメモが入れば完成です。</li>
      </ol>
      <p class="hint">くわしくは README（使い方）を見てください。Notion の鍵（シークレット）はショートカットの中だけに入れ、このアプリには入れません。</p>
    </div>
  `;
  const bind = (sel, key, isCheck) => {
    const el = $(sel);
    el.addEventListener(isCheck ? 'change' : 'input', () => {
      s[key] = isCheck ? el.checked : el.value;
      save();
      if (key === 'target') {
        const g = guessKind(el.value);
        const nid = extractId(el.value);
        const msg = $('#idMsg');
        msg.className = nid ? 'idok' : 'idng';
        msg.textContent = nid ? `✓ 読み取れました（${nid}）` : (el.value ? '× リンクから場所を読み取れませんでした' : '');
        if (g && s.kind !== g) { s.kind = g; save(); document.querySelector(`input[name=kind][value=${g}]`).checked = true; $('#dbOpts').hidden = false; }
      }
    });
  };
  bind('#target', 'target');
  bind('#titleProp', 'titleProp');
  bind('#dateProp', 'dateProp');
  bind('#tagProp', 'tagProp');
  bind('#shortcutName', 'shortcutName');
  bind('#returnBack', 'returnBack', true);
  bind('#addTime', 'addTime', true);
  document.querySelectorAll('input[name=kind]').forEach((r) => r.addEventListener('change', () => {
    s.kind = r.value;
    save();
    $('#dbOpts').hidden = s.kind !== 'database';
  }));
  $('#test').onclick = () => {
    send({ id: 'test', at: Date.now(), title: 'テスト（Notionメモ）', body: 'このメモが見えたら設定は完了です 🎉', tags: '' });
  };
}

// ---------- 切りかえ ----------
const TITLES = { write: 'Notionメモ', history: '送ったもの', settings: '設定' };
function go(tab) {
  if (tab !== 'write') stopVoice();
  state.tab = tab;
  $('#pageTitle').textContent = TITLES[tab];
  document.querySelectorAll('.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  ({ write: renderWrite, history: renderHistory, settings: renderSettings })[tab]();
  window.scrollTo(0, 0);
}
document.querySelectorAll('.tabbar button').forEach((b) => { b.onclick = () => go(b.dataset.tab); });

// ショートカットから戻ってきたとき
(function handleReturn() {
  const r = new URLSearchParams(location.search).get('r');
  if (!r) return;
  history.replaceState(null, '', location.pathname);
  setTimeout(() => {
    if (r === 'ok') toast('✅ Notion に送りました');
    else if (r === 'err') toast('⚠️ ショートカットでエラーが出ました。設定を確かめてください', 4500);
    else toast('送るのを取りやめました');
  }, 200);
})();

go(ready() ? 'write' : 'settings');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
