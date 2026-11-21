// =============================================================
// app.js … 画面の表示とボタン操作
// =============================================================

let db = loadDb();
const state = {
  tab: 'scan',
  queue: [], // まだ読み取っていない写真
  draft: null, // いま確認・修正しているレシート
  draftImageUrl: '', // その写真（表示用）
  draftImageBlob: null, // 新しく撮った写真（保存するときに IndexedDB へ）
  progress: null, // 読み取り中の表示 { label, pct }
  ocrAbort: null, // 読み取りを途中でやめるため
  month: todayStr().slice(0, 7), // 一覧で見る月（'all' ならすべて）
  book: 'biz', // 一覧で見る帳簿（'biz' 事業・弥生 / 'chonai' 町内会）
};
state.book = db.settings.lastBook === 'chonai' ? 'chonai' : 'biz';

const BOOKS = { biz: '事業（弥生）', chonai: '町内会' };

const $ = (sel) => document.querySelector(sel);
const main = $('#main');

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function persist() { saveDb(db); }
function settings() { return db.settings; }
function clone(o) { return JSON.parse(JSON.stringify(o)); }

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.hidden = true; }, 2600);
}

function blankEntry() {
  const s = settings();
  const book = s.lastBook === 'chonai' ? 'chonai' : 'biz';
  return {
    id: '', book, kaikei: book === 'chonai' ? defaultKaikei() : '',
    date: todayStr(), store: '', regNo: '', memo: '', credit: s.defaultCredit,
    lines: [{ account: book === 'chonai' ? s.chonaiDefault : s.defaultAccount, rate: book === 'chonai' ? 0 : 10, amount: '' }],
    hasImage: false, exportedAt: '', createdAt: '', ocrText: '',
  };
}
function defaultKaikei() {
  const list = settings().chonaiAccounts;
  return list.includes(settings().lastKaikei) ? settings().lastKaikei : (list[0] || '');
}

// 帳簿を切り替えたとき：金額は合計1行にまとめ、科目はその帳簿のものを選び直す
function switchDraftBook(book) {
  const d = state.draft;
  if (bookOf(d) === book) return;
  const total = d.lines.reduce((sum, l) => sum + parseAmount(l.amount), 0) || '';
  d.book = book;
  if (book === 'chonai') {
    d.kaikei = defaultKaikei();
    d.lines = [{ account: guessChonaiSubject(d.store, db), rate: 0, amount: total }];
  } else {
    d.kaikei = '';
    d.lines = [{ account: guessAccount(d.store, d.ocrText, db), rate: 10, amount: total }];
  }
  render();
}

function setDraftImage(blobOrNull) {
  if (state.draftImageUrl) URL.revokeObjectURL(state.draftImageUrl);
  state.draftImageUrl = blobOrNull ? URL.createObjectURL(blobOrNull) : '';
}

// ---------- 全体の描画 ----------
const TITLES = { scan: 'レシート読み取り', list: '一覧・書き出し', settings: '設定' };

function render() {
  $('#pageTitle').textContent = TITLES[state.tab];
  $('#pageHint').textContent = state.tab === 'scan' && state.queue.length ? 'あと' + state.queue.length + '枚' : '';
  document.querySelectorAll('.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === state.tab));
  ({ scan: renderScan, list: renderList, settings: renderSettings })[state.tab]();
  if (state.tab !== render.lastTab) window.scrollTo(0, 0);
  render.lastTab = state.tab;
}

// ---------- 読み取り ----------
function renderScan() {
  if (state.progress) {
    main.innerHTML = `
      <section class="panel center">
        ${state.draftImageUrl ? `<img class="photo" src="${state.draftImageUrl}" alt="">` : ''}
        <p><b>${esc(state.progress.label)}</b></p>
        <div class="bar"><div style="width:${Math.round(state.progress.pct * 100)}%"></div></div>
        <p class="hint">初めての読み取りは、文字認識のデータ（日本語）を取り込むので少し時間がかかります。</p>
        <button type="button" class="btn" data-act="stopOcr">やめて手で入力する</button>
      </section>`;
    return;
  }
  if (!state.draft) {
    const unexported = db.entries.filter((e) => !e.exportedAt && bookOf(e) === 'biz').length;
    const notPassed = db.entries.filter((e) => !e.exportedAt && bookOf(e) === 'chonai').length;
    main.innerHTML = `
      <section class="panel">
        <label class="btn primary block big file-btn">📷 レシートを撮る
          <input type="file" accept="image/*" capture="environment" data-act="pick" hidden></label>
        <label class="btn block file-btn">🖼 写真から選ぶ（何枚でも）
          <input type="file" accept="image/*" multiple data-act="pick" hidden></label>
        <button type="button" class="btn block" data-act="manual">✏️ 写真なしで手入力</button>
        <p class="hint">撮るときのコツ：レシートを暗い色の机に置き、まっすぐ・明るく・レシート全体が入るように撮ると読み取りやすくなります。
          読み取ったあと、内容を確認・修正してから保存します。</p>
      </section>
      ${unexported ? `<div class="notice">まだ書き出していないレシートが <b>${unexported}件</b> あります。「📋 一覧」から弥生用のCSV・Excelを書き出せます。</div>` : ''}
      ${notPassed ? `<div class="notice">町内会の帳簿にまだ渡していないレシートが <b>${notPassed}件</b> あります。「📋 一覧」→「町内会」からコピーできます。</div>` : ''}`;
    return;
  }
  renderEditor();
}

function renderEditor() {
  const d = state.draft;
  const s = settings();
  const chonai = bookOf(d) === 'chonai';
  const accounts = [...new Set([...(chonai ? s.chonaiSubjects : s.accounts), ...d.lines.map((l) => l.account)])];
  const credits = [...new Set([...s.credits, d.credit])];
  const kaikeis = [...new Set([...s.chonaiAccounts, d.kaikei].filter(Boolean))];
  const total = entryTotal(d);
  main.innerHTML = `
    ${d.id ? `<div class="notice">保存済みのレシートを直しています。</div>` : ''}
    ${state.draftImageUrl ? `<a href="${state.draftImageUrl}" target="_blank" rel="noopener"><img class="photo" src="${state.draftImageUrl}" alt="レシートの写真"></a>` : ''}
    <section class="panel">
      <div class="field"><label>どの帳簿のレシート？</label>
        <div class="seg">${Object.entries(BOOKS).map(([k, v]) => `
          <label><input type="radio" name="book" value="${k}" ${bookOf(d) === k ? 'checked' : ''}><span>${v}</span></label>`).join('')}
        </div>
      </div>
      <div class="row2">
        <div class="field"><label>日付</label><input type="date" data-f="date" value="${esc(d.date)}"></div>
        ${chonai ? (kaikeis.length ? `
        <div class="field"><label>会計</label>
          <select data-f="kaikei">${kaikeis.map((c) => `<option ${c === d.kaikei ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>` : '') : `
        <div class="field"><label>支払い <small>個人のお金なら事業主借</small></label>
          <select data-f="credit">${credits.map((c) => `<option ${c === d.credit ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>`}
      </div>
      <div class="field"><label>店名 <small>${chonai ? '帳簿の「摘要」になります' : '弥生の「摘要」になります'}</small></label>
        <input type="text" data-f="store" value="${esc(d.store)}" placeholder="例：ダイソー ○○店"></div>

      <div class="field"><label>${chonai ? '金額・科目' : '金額（税込）・勘定科目'}</label>
        <div class="lines">
          ${d.lines.map((l, i) => `
            <div class="line${chonai ? ' no-rate' : ''}" data-i="${i}">
              <select data-l="account" aria-label="${chonai ? '科目' : '勘定科目'}">${accounts.map((a) => `<option ${a === l.account ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select>
              ${chonai ? '' : `<select data-l="rate" aria-label="税率">${RATES.map((r) => `<option value="${r.rate}" ${r.rate === Number(l.rate) ? 'selected' : ''}>${r.label}</option>`).join('')}</select>`}
              <input type="text" inputmode="numeric" data-l="amount" value="${esc(l.amount)}" placeholder="金額" aria-label="金額">
              <button type="button" class="icon-btn" data-act="delLine" ${d.lines.length < 2 ? 'disabled' : ''} aria-label="この行を消す">✕</button>
            </div>`).join('')}
        </div>
        <button type="button" class="link" data-act="addLine">${chonai ? '＋ 科目を分ける' : '＋ 税率・科目を分ける（8%と10%が混ざったレシートなど）'}</button>
      </div>
      <div class="totals"><div class="grand"><span>合計</span><b id="draftTotal">${yen(total)}</b></div></div>

      ${chonai ? '' : `<div class="field"><label>登録番号 <small>T＋13けた（あれば）</small></label>
        <input type="text" data-f="regNo" value="${esc(d.regNo)}" placeholder="T1234567890123" autocapitalize="characters"></div>`}
      <div class="field"><label>メモ <small>摘要の店名のあとに付きます（例：${chonai ? '封筒・切手' : 'コピー用紙'}）</small></label>
        <input type="text" data-f="memo" value="${esc(d.memo)}"></div>

      ${d.ocrText ? `<details class="ocr"><summary>読み取った文字を見る</summary><pre>${esc(d.ocrText)}</pre></details>` : ''}

      <div class="row-actions">
        ${d.id ? `<button type="button" class="btn danger" data-act="delete">🗑 削除</button>` : ''}
        <button type="button" class="btn" data-act="cancel">${state.queue.length ? 'このレシートは飛ばす' : 'やめる'}</button>
        <button type="button" class="btn primary" data-act="save">💾 保存${state.queue.length ? 'して次へ' : ''}</button>
      </div>
    </section>`;
}

// 写真を選んだ／撮ったとき
async function handlePicked(files) {
  state.queue.push(...files);
  if (!state.draft && !state.progress) await nextFromQueue();
  else render();
}

async function nextFromQueue() {
  const file = state.queue.shift();
  if (!file) { state.draft = null; setDraftImage(null); state.draftImageBlob = null; render(); return; }
  state.progress = { label: '写真を準備しています…', pct: 0 };
  render();
  let parsed = { date: '', store: '', regNo: '', rates: [{ rate: 10, amount: '' }], text: '' };
  try {
    const photo = await loadImageToCanvas(file, 1400, false);
    state.draftImageBlob = await canvasToBlob(photo, 0.75);
    setDraftImage(state.draftImageBlob);
    render();
    const work = await loadImageToCanvas(file, 2000, true);
    state.ocrAbort = new AbortController();
    const text = await recognizeReceipt(work, (m) => {
      const label = m.status === 'recognizing text' ? '文字を読み取っています…' : '文字認識の準備をしています…';
      state.progress = { label, pct: m.progress || 0 };
      const bar = document.querySelector('.bar > div');
      if (bar) { bar.style.width = Math.round(state.progress.pct * 100) + '%'; bar.parentElement.previousElementSibling.querySelector('b').textContent = label; }
    }, state.ocrAbort.signal);
    parsed = parseReceiptText(text);
  } catch (e) {
    console.error(e);
    if (e.message !== 'abort') toast(e.message === 'timeout' ? '時間がかかりすぎたので止めました。手で入力してください' : 'うまく読み取れませんでした。手で入力してください');
  }
  const d = blankEntry();
  d.date = parsed.date || todayStr();
  d.store = parsed.store;
  d.regNo = parsed.regNo;
  d.ocrText = parsed.text;
  if (bookOf(d) === 'chonai') {
    // 町内会の帳簿は税率で分けないので、合計1行にする
    const sum = parsed.rates.reduce((t, r) => t + (Number(r.amount) || 0), 0);
    d.lines = [{ account: guessChonaiSubject(parsed.store, db), rate: 0, amount: sum || '' }];
  } else {
    const acc = guessAccount(parsed.store, parsed.text, db);
    d.lines = parsed.rates.map((r) => ({ account: acc, rate: r.rate, amount: r.amount || '' }));
  }
  state.draft = d;
  state.progress = null;
  render();
  if (!parsed.date || !parsed.rates[0].amount) toast('読み取れなかった項目があります。確認してください');
}

function parseAmount(v) {
  const n = Number(String(v).replace(/[^\d.\-０-９]/g, '').replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

async function saveDraft() {
  const d = state.draft;
  d.store = d.store.trim();
  d.regNo = d.regNo.replace(/\s/g, '').toUpperCase();
  d.lines = d.lines.map((l) => ({ ...l, rate: Number(l.rate), amount: parseAmount(l.amount) })).filter((l) => l.amount);
  if (!d.date) { toast('日付を入れてください'); return; }
  const chonai = bookOf(d) === 'chonai';
  if (!d.lines.length) {
    d.lines = [{ account: chonai ? settings().chonaiDefault : settings().defaultAccount, rate: chonai ? 0 : 10, amount: '' }];
    render(); toast('金額を入れてください'); return;
  }
  if (!d.store) { toast('店名を入れてください'); return; }
  const isNew = !d.id;
  if (isNew) { d.id = uid(); d.createdAt = new Date().toISOString(); }
  if (state.draftImageBlob) {
    try { await imageStore.put(d.id, state.draftImageBlob); d.hasImage = true; } catch (e) { console.error(e); }
  }
  d.book = bookOf(d);
  if (chonai) d.regNo = '';
  // 次から同じ店は同じ科目を選ぶ（町内会の分は別に覚える）。次のレシートも同じ帳簿で始める
  db.storeMap[(chonai ? 'c:' : '') + normStore(d.store)] = d.lines[0].account;
  settings().lastBook = d.book;
  if (chonai && d.kaikei) settings().lastKaikei = d.kaikei;
  state.book = d.book;
  const rec = clone(d);
  const i = db.entries.findIndex((e) => e.id === rec.id);
  if (i >= 0) { rec.exportedAt = ''; db.entries[i] = rec; } else db.entries.push(rec);
  persist();
  toast(isNew ? '保存しました' : '直しました（もう一度書き出してください）');
  state.draftImageBlob = null;
  if (!isNew) { state.draft = null; setDraftImage(null); state.tab = 'list'; render(); return; }
  await nextFromQueue();
}

async function openEntry(id) {
  const e = db.entries.find((x) => x.id === id);
  if (!e) return;
  state.draft = clone(e);
  state.draftImageBlob = null;
  setDraftImage(null);
  if (e.hasImage) {
    try { const b = await imageStore.get(id); if (b) setDraftImage(b); } catch (err) { console.error(err); }
  }
  state.tab = 'scan';
  render();
}

// ---------- 一覧・書き出し ----------
function monthLabel(m) { return m === 'all' ? 'すべて' : m.replace(/^(\d+)-0?(\d+)$/, '$1年$2月'); }
function shiftMonth(m, k) {
  const [y, mo] = (m === 'all' ? todayStr().slice(0, 7) : m).split('-').map(Number);
  const d = new Date(y, mo - 1 + k, 1);
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1);
}
function entriesInView() {
  return db.entries
    .filter((e) => bookOf(e) === state.book && (state.month === 'all' || e.date.startsWith(state.month)))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.createdAt < b.createdAt ? -1 : 1)));
}

function renderList() {
  const list = entriesInView();
  const total = list.reduce((s, e) => s + entryTotal(e), 0);
  const byAcc = {};
  for (const e of list) for (const l of e.lines) byAcc[l.account] = (byAcc[l.account] || 0) + Number(l.amount || 0);
  const notYet = list.filter((e) => !e.exportedAt).length;
  const chonai = state.book === 'chonai';
  main.innerHTML = `
    <div class="seg book-tabs">${Object.entries(BOOKS).map(([k, v]) => `
      <label><input type="radio" name="viewBook" value="${k}" ${state.book === k ? 'checked' : ''}><span>${v}</span></label>`).join('')}
    </div>
    <div class="month-nav">
      <button type="button" class="icon-btn" data-act="prevMonth" aria-label="前の月">◀</button>
      <b>${monthLabel(state.month)}</b>
      <button type="button" class="icon-btn" data-act="nextMonth" aria-label="次の月">▶</button>
      <button type="button" class="btn small" data-act="allMonths">${state.month === 'all' ? '今月' : 'すべて'}</button>
    </div>

    <div class="total-card">
      <div class="total-label">${chonai ? '町内会の支出' : '経費'}の合計（${list.length}件）</div>
      <div class="total-value">${yen(total)}</div>
      ${Object.keys(byAcc).length ? `<div class="total-sub">${Object.entries(byAcc).sort((a, b) => b[1] - a[1]).map(([a, v]) => `${esc(a)} ${yen(v)}`).join('　')}</div>` : ''}
    </div>

    ${chonai ? renderChonaiExport(list) : `
    <section class="panel">
      <h2>書き出し <small>${monthLabel(state.month)}の${list.length}件${notYet ? `（うち未書き出し ${notYet}件）` : ''}</small></h2>
      <div class="export-btns">
        <button type="button" class="btn primary" data-act="csv" ${list.length ? '' : 'disabled'}>📄 弥生用CSV</button>
        <button type="button" class="btn primary" data-act="xlsx" ${list.length ? '' : 'disabled'}>📊 Excel</button>
      </div>
      <p class="hint">弥生用CSV は「やよいの青色申告」の［帳簿・伝票］→［仕訳日記帳］→［ファイル］→［インポート］で取り込めます。
        Excel は一覧（見る用）と、弥生と同じ並びのシートが入っています。</p>
    </section>`}

    <div class="cards">
      ${list.length ? list.map((e) => `
        <button type="button" class="card entry" data-open="${esc(e.id)}">
          <span class="e-date">${esc(e.date.replace(/-/g, '/'))}</span>
          <span class="e-amt">${yen(entryTotal(e))}</span>
          <span class="e-store">${esc(e.store)}${e.memo ? ` <small>${esc(e.memo)}</small>` : ''}</span>
          <span class="e-sub">${esc([...new Set(e.lines.map((l) => l.account))].join('・'))}／${esc(chonai ? (e.kaikei || '町内会') : e.credit)}
            ${e.hasImage ? '📷' : ''} ${e.exportedAt ? `<span class="badge done">${chonai ? '帳簿に渡した' : '書き出し済み'}</span>` : `<span class="badge">${chonai ? 'まだ渡していない' : '未書き出し'}</span>`}</span>
        </button>`).join('') : '<p class="empty">この月のレシートはまだありません</p>'}
    </div>`;
}

// 町内会：会計ごとに「帳簿アプリに貼り付ける文字」をコピー・送信するボタン
function chonaiGroups(list) {
  const groups = new Map();
  for (const e of list) {
    const k = e.kaikei || '';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e);
  }
  return groups;
}
function renderChonaiExport(list) {
  const groups = [...chonaiGroups(list)];
  return `
    <section class="panel">
      <h2>町内会の帳簿に渡す <small>${monthLabel(state.month)}の${list.length}件</small></h2>
      ${groups.length ? groups.map(([k, es], gi) => {
        const notYet = es.filter((e) => !e.exportedAt).length;
        return `
        <div class="chonai-group">
          ${groups.length > 1 || k ? `<h3>${esc(k || '会計の指定なし')} <small>${es.length}件${notYet ? `（まだ渡していない ${notYet}件）` : ''}</small></h3>` : ''}
          <div class="export-btns">
            <button type="button" class="btn primary" data-act="chonaiCopy" data-g="${gi}">📋 コピー</button>
            <button type="button" class="btn primary" data-act="chonaiSend" data-g="${gi}">📤 送る</button>
          </div>
          <details class="ocr"><summary>コピーされる文字を見る</summary><pre>${esc(makeChonaiText(es))}</pre></details>
        </div>`;
      }).join('') : '<p class="empty small">この月の町内会のレシートはまだありません</p>'}
      <p class="hint">会計帳簿アプリで${groups.length > 1 ? 'その会計と' : ''}年度を選び、「📷 写真から」の欄に貼り付けて「読み取る」→ 確認して「帳簿に書き込む」。
        同じ日・同じ金額がもう帳簿にあると、帳簿アプリが知らせてくれます。
        帳簿アプリがパソコンにあるときは「送る」でメールや LINE で自分に送り、パソコンでコピーして貼り付けてください。
        年度の境目をまたぐ月は、年度ごとに分けて貼り付けてください。</p>
    </section>`;
}

async function passToChonai(gi, how) {
  const es = [...chonaiGroups(entriesInView()).values()][gi];
  if (!es || !es.length) return;
  const text = makeChonaiText(es);
  const label = state.month === 'all' ? 'all' : state.month.replace('-', '');
  let ok;
  if (how === 'copy') {
    ok = await copyText(text);
    toast(ok ? `${es.length}件をコピーしました。帳簿アプリの「写真から」に貼り付けてください` : 'コピーできませんでした。「コピーされる文字を見る」から選んでコピーしてください');
  } else {
    const res = await sendText(text, `chonai_${label}.txt`);
    ok = res !== 'cancel';
    if (ok) toast(res === 'shared' ? '送りました' : '保存しました');
  }
  if (!ok) return;
  const now = new Date().toISOString();
  for (const e of es) { const rec = db.entries.find((x) => x.id === e.id); if (rec) rec.exportedAt = now; }
  persist();
  render();
}

async function exportFile(kind) {
  const list = entriesInView();
  if (!list.length) return;
  const label = state.month === 'all' ? 'all' : state.month.replace('-', '');
  try {
    const blob = kind === 'csv' ? makeYayoiCsv(list, settings()) : makeExcel(list, settings());
    const name = kind === 'csv' ? `yayoi_${label}.csv` : `keihi_${label}.xlsx`;
    const res = await deliverFile(blob, name);
    if (res === 'cancel') return;
    const now = new Date().toISOString();
    for (const e of list) { const rec = db.entries.find((x) => x.id === e.id); if (rec) rec.exportedAt = now; }
    persist();
    render();
    toast(res === 'shared' ? name + ' を共有しました' : name + ' を保存しました');
  } catch (err) {
    console.error(err);
    alert('書き出しに失敗しました：' + err.message);
  }
}

// ---------- 設定 ----------
function renderSettings() {
  const s = settings();
  main.innerHTML = `
    <section class="panel">
      <h2>はじめに選ばれるもの</h2>
      <div class="row2">
        <div class="field"><label>勘定科目</label>
          <select data-s="defaultAccount">${s.accounts.map((a) => `<option ${a === s.defaultAccount ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select></div>
        <div class="field"><label>支払い（貸方）</label>
          <select data-s="defaultCredit">${s.credits.map((a) => `<option ${a === s.defaultCredit ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select></div>
      </div>
      <p class="hint">個人のお財布やカードで払った経費は「事業主借」、事業用の現金なら「現金」にします。</p>
    </section>

    <section class="panel">
      <h2>勘定科目 <small>1行に1つ。弥生にある科目名と同じ文字にしてください</small></h2>
      <textarea rows="8" data-s="accounts">${esc(s.accounts.join('\n'))}</textarea>
      <h3>支払い（貸方の科目）</h3>
      <textarea rows="4" data-s="credits">${esc(s.credits.join('\n'))}</textarea>
      <button type="button" class="btn block" data-act="saveLists">💾 科目を保存</button>
    </section>

    <section class="panel">
      <h2>町内会の帳簿</h2>
      <p class="hint">会計帳簿アプリの支出の科目と、同じ名前にしてください。帳簿アプリの科目を「、」や改行で区切ってまとめて貼り付けてもかまいません。</p>
      <textarea rows="6" data-s="chonaiSubjects">${esc(s.chonaiSubjects.join('\n'))}</textarea>
      <div class="field"><label>はじめに選ばれる科目</label>
        <select data-s="chonaiDefault">${s.chonaiSubjects.map((a) => `<option ${a === s.chonaiDefault ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select></div>
      <h3>会計の名前 <small>帳簿アプリで会計を分けているときだけ。1行に1つ</small></h3>
      <textarea rows="3" data-s="chonaiAccounts" placeholder="例：一般会計">${esc(s.chonaiAccounts.join('\n'))}</textarea>
      <button type="button" class="btn block" data-act="saveChonai">💾 町内会の設定を保存</button>
    </section>

    <section class="panel">
      <h2>消費税</h2>
      <label class="check"><input type="checkbox" data-s="keika" ${s.keika ? 'checked' : ''}>
        登録番号のないレシートに経過措置の税区分を付ける
        <small>本則課税でインボイスの経過措置を使う人向け。「課対仕入内10%区80%」（2026年10月からは「区50%」）のように書き出します。
          免税事業者・簡易課税・2割特例の人はチェック不要です。</small></label>
    </section>

    <section class="panel">
      <h2>バックアップ</h2>
      <p class="hint">データ（レシートの内容）はこの端末のブラウザの中だけに保存されています。機種変更の前などに書き出してください（写真は入りません）。</p>
      <div class="row-actions">
        <button type="button" class="btn" data-act="backup">⬇️ バックアップを書き出す</button>
        <label class="btn file-btn">⬆️ バックアップから戻す<input type="file" accept=".json,application/json" data-act="restore" hidden></label>
      </div>
      <div class="row-actions">
        <button type="button" class="btn danger" data-act="wipe">🗑 すべてのデータを消す</button>
      </div>
    </section>`;
}

function linesOf(text) { return [...new Set(text.split('\n').map((x) => x.trim()).filter(Boolean))]; }
// 改行・「、」・「,」・タブで区切られた一覧（帳簿アプリの科目をまとめて貼れるように）
function splitList(text) { return [...new Set(text.split(/[\n、,，\t]+/).map((x) => x.trim()).filter(Boolean))]; }

// ---------- 入力の反映 ----------
main.addEventListener('input', (ev) => {
  const t = ev.target;
  if (state.draft && t.dataset.f) state.draft[t.dataset.f] = t.value;
  if (state.draft && t.dataset.l) {
    const i = Number(t.closest('.line').dataset.i);
    state.draft.lines[i][t.dataset.l] = t.dataset.l === 'rate' ? Number(t.value) : t.value;
    const tot = $('#draftTotal');
    if (tot) tot.textContent = yen(state.draft.lines.reduce((s, l) => s + parseAmount(l.amount), 0));
  }
});

main.addEventListener('change', async (ev) => {
  const t = ev.target;
  if (t.dataset.act === 'pick') {
    const files = [...t.files];
    t.value = '';
    if (files.length) await handlePicked(files);
    return;
  }
  if (t.dataset.act === 'restore') {
    const f = t.files[0];
    t.value = '';
    if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!Array.isArray(d.entries)) throw new Error('形式が違います');
      if (!confirm(`バックアップの ${d.entries.length}件 で、いまのデータを置き換えます。よろしいですか？`)) return;
      const base = defaultDb();
      db = { ...base, ...d, settings: { ...base.settings, ...(d.settings || {}) } };
      db.entries.forEach((e) => { e.hasImage = false; });
      persist();
      render();
      toast('戻しました');
    } catch (e) {
      alert('読み込めませんでした：' + e.message);
    }
    return;
  }
  if (t.name === 'book' && state.draft) { switchDraftBook(t.value); return; }
  if (t.name === 'viewBook') { state.book = t.value; render(); return; }
  if (t.dataset.s === 'defaultAccount' || t.dataset.s === 'defaultCredit' || t.dataset.s === 'chonaiDefault') {
    settings()[t.dataset.s] = t.value; persist(); toast('保存しました');
  }
  if (t.dataset.s === 'keika') { settings().keika = t.checked; persist(); toast('保存しました'); }
});

main.addEventListener('click', async (ev) => {
  const open = ev.target.closest('[data-open]');
  if (open) { await openEntry(open.dataset.open); return; }
  const b = ev.target.closest('[data-act]');
  if (!b || b.tagName === 'INPUT') return;
  const act = b.dataset.act;
  if (act === 'stopOcr' && state.ocrAbort) state.ocrAbort.abort();
  if (act === 'manual') { state.draft = blankEntry(); setDraftImage(null); state.draftImageBlob = null; render(); }
  if (act === 'addLine') {
    const last = state.draft.lines[state.draft.lines.length - 1];
    const rate = bookOf(state.draft) === 'chonai' ? 0 : (last.rate === 10 ? 8 : 10);
    state.draft.lines.push({ account: last.account, rate, amount: '' });
    render();
  }
  if (act === 'delLine') {
    state.draft.lines.splice(Number(b.closest('.line').dataset.i), 1);
    render();
  }
  if (act === 'save') await saveDraft();
  if (act === 'cancel') {
    const wasSaved = !!state.draft.id;
    state.draftImageBlob = null;
    if (wasSaved) { state.draft = null; setDraftImage(null); state.tab = 'list'; render(); } else await nextFromQueue();
  }
  if (act === 'delete') {
    if (!confirm('このレシートを削除しますか？')) return;
    const id = state.draft.id;
    db.entries = db.entries.filter((e) => e.id !== id);
    persist();
    imageStore.del(id).catch(() => {});
    state.draft = null; setDraftImage(null);
    state.tab = 'list';
    render();
    toast('削除しました');
  }
  if (act === 'prevMonth') { state.month = shiftMonth(state.month, -1); render(); }
  if (act === 'nextMonth') { state.month = shiftMonth(state.month, 1); render(); }
  if (act === 'allMonths') { state.month = state.month === 'all' ? todayStr().slice(0, 7) : 'all'; render(); }
  if (act === 'csv') await exportFile('csv');
  if (act === 'xlsx') await exportFile('xlsx');
  if (act === 'chonaiCopy') await passToChonai(Number(b.dataset.g), 'copy');
  if (act === 'chonaiSend') await passToChonai(Number(b.dataset.g), 'send');
  if (act === 'saveChonai') {
    const subjects = splitList(main.querySelector('[data-s="chonaiSubjects"]').value);
    if (!subjects.length) { toast('科目を1つ以上入れてください'); return; }
    const s = settings();
    s.chonaiSubjects = subjects;
    s.chonaiAccounts = splitList(main.querySelector('[data-s="chonaiAccounts"]').value);
    if (!subjects.includes(s.chonaiDefault)) s.chonaiDefault = subjects[0];
    persist(); render(); toast('保存しました');
  }
  if (act === 'saveLists') {
    const acc = linesOf(main.querySelector('[data-s="accounts"]').value);
    const cr = linesOf(main.querySelector('[data-s="credits"]').value);
    if (!acc.length || !cr.length) { toast('1つ以上入れてください'); return; }
    const s = settings();
    s.accounts = acc; s.credits = cr;
    if (!acc.includes(s.defaultAccount)) s.defaultAccount = acc[0];
    if (!cr.includes(s.defaultCredit)) s.defaultCredit = cr[0];
    persist(); render(); toast('保存しました');
  }
  if (act === 'backup') {
    const blob = new Blob([JSON.stringify(db, null, 1)], { type: 'application/json' });
    await deliverFile(blob, 'keihi-backup-' + todayStr() + '.json');
  }
  if (act === 'wipe') {
    if (!confirm('すべてのレシートと写真を消します。元に戻せません。よろしいですか？')) return;
    db = defaultDb(); persist();
    imageStore.clear().catch(() => {});
    state.draft = null; setDraftImage(null);
    render(); toast('消しました');
  }
});

$('#tabbar').addEventListener('click', (ev) => {
  const b = ev.target.closest('button[data-tab]');
  if (!b || state.progress) return;
  if (state.draft && b.dataset.tab !== 'scan' && !state.draft.id && !confirm('入力中のレシートは保存されていません。移動しますか？')) return;
  if (b.dataset.tab !== 'scan') { state.draft = null; state.queue = []; setDraftImage(null); state.draftImageBlob = null; }
  state.tab = b.dataset.tab;
  render();
});

render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
