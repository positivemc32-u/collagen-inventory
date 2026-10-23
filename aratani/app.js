/* 荒谷町 会計帳簿アプリ
 * サーバー不要。データはこのパソコン（ブラウザ）の中に保存し、
 * Excel とバックアップファイルで持ち出し・引き継ぎをする。
 */
'use strict';

const STORE_KEY = 'aratani-kaikei-v1';
const APP_VERSION = 1;
const MANUAL = '__manual__';
const KURIKOSHI = '前年度繰越金';

/* ---------- 初期値 ---------- */
const DEFAULT_ACCOUNTS = [
  { id: 'ku', name: '区会計', fullName: '荒谷区会計', layout: 'tate' },
  { id: 'rindo', name: '林道会計', fullName: '林道1号会計', layout: 'yoko' },
  { id: 'tokko', name: '篤行会計', fullName: '篤行財産会計', layout: 'yoko' },
  { id: 'kendo', name: '県道会計', fullName: '県道会計', layout: 'yoko' },
  { id: 'tokubetsu', name: '特別会計', fullName: '区長資金特別会計', layout: 'yoko' },
];

const DEFAULT_SUBJECTS_IN = [
  KURIKOSHI, '区費', '負担金', '負担金精算', '補助金', '協力金', '利息', '賃付',
  '返金', '寄付', '祝儀・御花', '納税報奨金', '補償金', '事務連絡委託', '会計間繰入',
];
const DEFAULT_SUBJECTS_OUT = [
  '電気料', '水道料', '公租公課', '事務費', '会議費', '集会所管理費', '除雪機維持費',
  '除雪手当', '林道維持管理費', '草刈り', '役員手当', '賃金', '保険料', '祭り経費',
  '慶弔費', '消防費', '各種募金', '各種負担金', '振込手数料', '会計間繰出',
];
// 帳簿の科目 → 決算書の項目（ここにないものは科目名のまま決算書に出る）
const DEFAULT_KESSAN = {
  区費: '負担金（区費）', 利息: '預金利息', 賃付: '貸付・使用料', 寄付: '寄付金',
  電気料: '光熱水費', 水道料: '光熱水費', 集会所管理費: '集会場等維持管理費',
  除雪機維持費: '除雪清掃対策費', 除雪手当: '除雪清掃対策費', 事務費: '事務経費', 会議費: '事務経費',
};

const DEFAULT_PARTNERS = [
  'NTT西日本', '加賀市', '北陸電力', '加賀市上下水道', 'JA加賀', '日本赤十字社',
  '加賀市社会福祉協議会', '町内会協議会', '神社',
];
const DEFAULT_TEMPLATES = [
  '電気料', '水道料', '固定資産税', '火災保険料', '切手代', 'コピー代', 'お茶代',
  'ガソリン代', '混合燃料', '振込手数料', '普通貯金利息',
];

function defaultState() {
  return {
    version: APP_VERSION,
    accounts: DEFAULT_ACCOUNTS.map(a => ({ ...a })),
    subjects: [
      ...DEFAULT_SUBJECTS_IN.map(name => ({ name, type: 'in', kessan: DEFAULT_KESSAN[name] || name })),
      ...DEFAULT_SUBJECTS_OUT.map(name => ({ name, type: 'out', kessan: DEFAULT_KESSAN[name] || name })),
    ],
    people: [],
    partners: DEFAULT_PARTNERS.slice(),
    templates: DEFAULT_TEMPLATES.slice(),
    entries: [],
    books: {},
    settings: { inputMode: 'pick' },
    lastBackup: null,
    seq: 1,
  };
}

/* ---------- 保存 ---------- */
let state = load();
const ui = {
  tab: 'ledger',
  account: state.accounts[0].id,
  year: fiscalYearOf(todayISO()),
  editingId: null,
  draft: null,
  pendingNew: [],
  pickMode: {},
};

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return migrate(Object.assign(defaultState(), JSON.parse(raw)));
  } catch (e) { console.warn(e); }
  return defaultState();
}
// 古い形式で保存されたデータに、あとから増えた設定を補う
function migrate(st) {
  for (const a of st.accounts) {
    if (!a.layout) a.layout = (DEFAULT_ACCOUNTS.find(d => d.id === a.id) || { layout: 'tate' }).layout;
  }
  return st;
}
function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (e) {
    alert('保存できませんでした。ブラウザの設定を確認してください。\n' + e.message);
  }
}

/* ---------- 共通の道具 ---------- */
const $ = sel => document.querySelector(sel);
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function yen(n) { return n ? Number(n).toLocaleString('ja-JP') : ''; }
function yenAlways(n) { return Number(n || 0).toLocaleString('ja-JP'); }
function toNum(v) {
  if (v == null || v === '') return 0;
  const n = Number(String(v).replace(/[,，円\s¥￥-]+$/g, '').replace(/[,，¥￥\s]/g, '')
    .replace(/[０-９]/g, d => String.fromCharCode(d.charCodeAt(0) - 0xFEE0)));
  return Number.isFinite(n) ? Math.round(n) : 0;
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
// 年度は3月21日の繰越から始まり、翌年3月20日ごろまで
function fiscalYearOf(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return (m > 3 || (m === 3 && d >= 21)) ? y : y - 1;
}
function reiwa(y) { return y - 2018; }
function yearLabel(y) { return `令和${reiwa(y)}年度（${y}年度）`; }
function shortDate(iso) {
  if (!iso) return '';
  const [, m, d] = iso.split('-').map(Number);
  return `${m}/${d}`;
}
function fullDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `令和${y - 2018}年${m}月${d}日`;
}
function accountById(id) { return state.accounts.find(a => a.id === id) || state.accounts[0]; }
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 2500);
}

/* ---------- 帳簿の計算 ---------- */
function bookEntries(account, year) {
  return state.entries
    .filter(e => e.account === account && e.year === year)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.seq - b.seq));
}
function withBalance(list) {
  let bal = 0;
  return list.map(e => {
    bal += (e.income || 0) - (e.expense || 0);
    return { ...e, balance: bal };
  });
}
function closingBalance(account, year) {
  return bookEntries(account, year).reduce((s, e) => s + (e.income || 0) - (e.expense || 0), 0);
}
function bookKey(account, year) { return `${account}-${year}`; }
function allYears() {
  const ys = new Set(state.entries.map(e => e.year));
  ys.add(fiscalYearOf(todayISO()));
  ys.add(ui.year);
  return [...ys].sort((a, b) => b - a);
}

/* ---------- 候補リスト ---------- */
function subjectNames() { return state.subjects.map(s => s.name); }
function subjectGroups() {
  return [
    { label: '収入の科目', items: state.subjects.filter(s => s.type === 'in').map(s => s.name) },
    { label: '支出の科目', items: state.subjects.filter(s => s.type === 'out').map(s => s.name) },
  ];
}
function pastTekiyo(account) {
  const seen = new Set();
  const list = [];
  for (let i = state.entries.length - 1; i >= 0 && list.length < 60; i--) {
    const e = state.entries[i];
    if (e.account === account && e.tekiyo && !seen.has(e.tekiyo)) { seen.add(e.tekiyo); list.push(e.tekiyo); }
  }
  return list;
}
function tekiyoGroups(account) {
  const known = new Set([...state.people.map(p => p.name), ...state.partners, ...state.templates]);
  return [
    { label: '人名', items: state.people.map(p => p.name), kana: Object.fromEntries(state.people.map(p => [p.name, p.kana])) },
    { label: '取引先', items: state.partners },
    { label: 'よく使う摘要', items: state.templates },
    { label: '最近使った摘要', items: pastTekiyo(account).filter(t => !known.has(t)) },
  ];
}
function allCandidates(groups) { return groups.flatMap(g => g.items); }

/* 「一覧から選ぶ」と「手で入力する」を切り替えられる入力欄 */
function pickerHTML(id, groups, value) {
  const all = allCandidates(groups);
  const forced = ui.pickMode[id];
  const typed = forced ? forced === 'type' : (state.settings.inputMode === 'type' || (value && !all.includes(value)));
  if (typed) {
    return `<div class="pick" data-pick="${id}" data-mode="type">
      <input type="text" id="${id}" value="${esc(value)}" list="${id}-list" autocomplete="off">
      <datalist id="${id}-list">${all.map(v => `<option value="${esc(v)}">`).join('')}</datalist>
      <button type="button" class="switch" data-switch="${id}">▼ 一覧から選ぶ</button>
    </div>`;
  }
  const opts = groups.filter(g => g.items.length).map(g => `<optgroup label="${esc(g.label)}">${
    g.items.map(v => {
      const kana = g.kana && g.kana[v] ? `（${g.kana[v]}）` : '';
      return `<option value="${esc(v)}"${v === value ? ' selected' : ''}>${esc(v)}${esc(kana)}</option>`;
    }).join('')}</optgroup>`).join('');
  return `<div class="pick" data-pick="${id}" data-mode="pick">
    <select id="${id}">
      <option value="">（選んでください）</option>
      ${opts}
      <option value="${MANUAL}">✏ 一覧にないので手で入力する…</option>
    </select>
  </div>`;
}
function bindPickers(root, rerender) {
  root.querySelectorAll('.pick[data-mode=pick] select').forEach(sel => {
    sel.addEventListener('change', () => {
      if (sel.value === MANUAL) {
        captureDraft();
        ui.draft[sel.id] = '';
        ui.pickMode[sel.id] = 'type';
        rerender();
        document.getElementById(sel.id)?.focus();
      }
    });
  });
  root.querySelectorAll('[data-switch]').forEach(btn => {
    btn.addEventListener('click', () => {
      captureDraft();
      ui.pickMode[btn.dataset.switch] = 'pick';
      ui.draft[btn.dataset.switch] = '';
      rerender();
    });
  });
}

/* ---------- 画面の切り替え ---------- */
document.getElementById('tabs').addEventListener('click', ev => {
  const b = ev.target.closest('button[data-tab]');
  if (!b) return;
  ui.tab = b.dataset.tab;
  document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('active', x === b));
  render();
});

function render() {
  renderNotices();
  const main = $('#main');
  if (ui.tab === 'ledger') renderLedger(main);
  else if (ui.tab === 'summary') renderSummary(main);
  else if (ui.tab === 'master') renderMaster(main);
  else if (ui.tab === 'excel') renderExcel(main);
  else renderHelp(main);
}

function renderNotices() {
  const box = $('#notices');
  const days = state.lastBackup ? (Date.now() - new Date(state.lastBackup).getTime()) / 86400000 : null;
  if (state.entries.length && (days === null || days > 30)) {
    box.innerHTML = `<div class="notice">💾 しばらく Excel に保存していません。「Excel・保存」から保存しておくと安心です。</div>`;
  } else {
    box.innerHTML = '';
  }
}

function bookSelectorHTML() {
  return `<div class="row no-print">
    <label>会計
      <select id="selAccount">${state.accounts.map(a => `<option value="${a.id}"${a.id === ui.account ? ' selected' : ''}>${esc(a.name)}</option>`).join('')}</select>
    </label>
    <label>年度
      <select id="selYear">${allYears().map(y => `<option value="${y}"${y === ui.year ? ' selected' : ''}>${yearLabel(y)}</option>`).join('')}</select>
    </label>
  </div>`;
}
function bindBookSelector() {
  $('#selAccount').addEventListener('change', e => { ui.account = e.target.value; resetForm(); render(); });
  $('#selYear').addEventListener('change', e => { ui.year = Number(e.target.value); resetForm(); render(); });
}

/* ---------- 📒 帳簿 ---------- */
function resetForm() { ui.editingId = null; ui.draft = null; ui.pendingNew = []; ui.pickMode = {}; }

function captureDraft() {
  const get = id => { const el = document.getElementById(id); return el ? el.value : ''; };
  if (!document.getElementById('fDate')) return;
  ui.draft = {
    fDate: get('fDate'), fSubject: get('fSubject') === MANUAL ? '' : get('fSubject'),
    fTekiyo: get('fTekiyo') === MANUAL ? '' : get('fTekiyo'),
    fIn: get('fIn'), fOut: get('fOut'), fNote: get('fNote'),
    fCheck: document.getElementById('fCheck')?.checked || false,
  };
}

function renderLedger(main) {
  const acc = accountById(ui.account);
  const rows = withBalance(bookEntries(acc.id, ui.year));
  const totalIn = rows.reduce((s, e) => s + (e.income || 0), 0);
  const totalOut = rows.reduce((s, e) => s + (e.expense || 0), 0);
  const closing = totalIn - totalOut;
  const book = state.books[bookKey(acc.id, ui.year)] || {};
  const editing = ui.editingId ? state.entries.find(e => e.id === ui.editingId) : null;

  const d = ui.draft || (editing ? {
    fDate: editing.date, fSubject: editing.subject, fTekiyo: editing.tekiyo,
    fIn: editing.income || '', fOut: editing.expense || '', fNote: editing.note || '', fCheck: !!editing.checked,
  } : { fDate: defaultDate(rows), fSubject: '', fTekiyo: '', fIn: '', fOut: '', fNote: '', fCheck: false });

  const prevYear = ui.year - 1;
  const prevClosing = closingBalance(acc.id, prevYear);
  const hasPrev = bookEntries(acc.id, prevYear).length > 0;
  const startBox = rows.length ? '' : `
    <div class="card no-print">
      <h2>この年度の帳簿はまだありません</h2>
      ${hasPrev ? `<p>${yearLabel(prevYear)}の残高 <b>${yenAlways(prevClosing)}円</b> を「${KURIKOSHI}」として書き込めます。</p>
        <button class="btn primary" id="btnCarry">前の年度から繰り越す</button>`
        : `<p>最初の行に「${KURIKOSHI}」を入れてください。下の入力欄の科目で「${KURIKOSHI}」を選び、収入金額に金額を入れます。</p>`}
    </div>`;

  main.innerHTML = `
    <div class="card">
      ${bookSelectorHTML()}
      <h2 style="margin-top:10px">${yearLabel(ui.year)}　${esc(acc.fullName)}</h2>
    </div>
    ${startBox}
    <div class="card no-print" id="formCard">
      <h2>${editing ? '✏ 行を直す' : '➕ 1行書き込む'}</h2>
      <div class="entry-form" id="entryForm">
        <label>年月日<input type="date" id="fDate" value="${esc(d.fDate)}"></label>
        <label>科目${pickerHTML('fSubject', subjectGroups(), d.fSubject)}</label>
        <label class="tekiyo">摘要（人名・取引先・内容）${pickerHTML('fTekiyo', tekiyoGroups(acc.id), d.fTekiyo)}</label>
        <label>収入金額<input type="number" inputmode="numeric" id="fIn" value="${esc(d.fIn)}" min="0" step="1"></label>
        <label>支払金額<input type="number" inputmode="numeric" id="fOut" value="${esc(d.fOut)}" min="0" step="1"></label>
        <label class="wide">備考（領収書なし など）<input type="text" id="fNote" value="${esc(d.fNote)}"></label>
        <label>検印<span><input type="checkbox" id="fCheck"${d.fCheck ? ' checked' : ''}> 確認済み</span></label>
      </div>
      <div class="entry-actions">
        <button class="btn primary" id="btnSave">${editing ? '直した内容で保存' : '書き込む'}</button>
        ${editing ? '<button class="btn" id="btnCancel">やめる</button><button class="btn danger" id="btnDelete">この行を消す</button>'
          : '<button class="btn" id="btnDitto" title="直前の行と同じ科目・摘要を入れます">〃 前の行と同じ</button><button class="btn" id="btnClear">入力欄を空にする</button>'}
      </div>
      <div id="newPrompt">${newPromptHTML()}</div>
    </div>

    <div class="card">
      <div class="row no-print" style="justify-content:space-between">
        <span class="hint">行をクリックすると直せます。</span>
        <button class="btn" onclick="window.print()">🖨 印刷</button>
      </div>
      <h2 class="print-only">${yearLabel(ui.year)}　${esc(acc.fullName)}</h2>
      <div class="table-wrap">
        <table class="ledger">
          <thead><tr><th>年月日</th><th>科目</th><th>摘要</th><th>収入金額</th><th>支払金額</th><th>差引残高</th><th>検印</th><th>備考</th></tr></thead>
          <tbody>
            ${rows.map(e => `<tr data-id="${e.id}"${e.id === ui.editingId ? ' class="editing"' : ''}>
              <td class="date">${shortDate(e.date)}</td>
              <td>${esc(e.subject)}</td>
              <td>${esc(e.tekiyo)}</td>
              <td class="num in">${yen(e.income)}</td>
              <td class="num out">${yen(e.expense)}</td>
              <td class="num">${yenAlways(e.balance)}</td>
              <td class="stamp">${e.checked ? '<span class="stamp-mark">会</span>' : ''}</td>
              <td>${esc(e.note)}</td>
            </tr>`).join('') || '<tr><td colspan="8" class="hint">まだ何も書き込まれていません。</td></tr>'}
          </tbody>
          <tfoot><tr><td colspan="3">合計</td><td class="num">${yenAlways(totalIn)}</td><td class="num">${yenAlways(totalOut)}</td><td class="num">${yenAlways(closing)}</td><td colspan="2"></td></tr></tfoot>
        </table>
      </div>
    </div>

    <div class="card no-print">
      <h2>🏦 通帳と合っているか確かめる</h2>
      <div class="row">
        <label>通帳の残高（円）<input type="number" id="bankBal" value="${book.bank ?? ''}"></label>
        <button class="btn" id="btnBank">確かめる</button>
        <span id="bankResult">${bankResultHTML(book.bank, closing)}</span>
      </div>
      <h3>年度の締め</h3>
      <p class="hint">年度末になったら押してください。今の残高 ${yenAlways(closing)}円 を ${yearLabel(ui.year + 1)} の「${KURIKOSHI}」にします。</p>
      <button class="btn" id="btnNextYear">${yearLabel(ui.year + 1)}へ繰り越す</button>
    </div>`;

  ui.draft = null;
  bindBookSelector();
  bindPickers(main, () => renderLedger(main));
  bindLedgerEvents(acc, rows, closing);
}

function defaultDate(rows) {
  const last = rows[rows.length - 1];
  const today = todayISO();
  if (fiscalYearOf(today) === ui.year) return today;
  return last ? last.date : `${ui.year}-03-21`;
}

function bankResultHTML(bank, closing) {
  if (bank === undefined || bank === null || bank === '') return '';
  const diff = bank - closing;
  if (diff === 0) return `<span class="diff-ok">✅ 帳簿の残高と合っています</span>`;
  return `<span class="diff-ng">⚠ 帳簿 ${yenAlways(closing)}円 と ${yenAlways(Math.abs(diff))}円 ずれています（通帳の方が${diff > 0 ? '多い' : '少ない'}）</span>`;
}

function newPromptHTML() {
  const p = ui.pendingNew[0];
  if (!p) return '';
  if (p.kind === 'subject') {
    return `<div class="notice" style="margin-top:12px">科目「<b>${esc(p.value)}</b>」は一覧にありません。次から選べるように追加しますか？
      <button class="btn small" data-add="subject-in">収入の科目に追加</button>
      <button class="btn small" data-add="subject-out">支出の科目に追加</button>
      <button class="btn small" data-add="none">追加しない</button></div>`;
  }
  return `<div class="notice" style="margin-top:12px">「<b>${esc(p.value)}</b>」は一覧にありません。次から選べるように追加しますか？
    <button class="btn small" data-add="person">人名に追加</button>
    <button class="btn small" data-add="partner">取引先に追加</button>
    <button class="btn small" data-add="template">よく使う摘要に追加</button>
    <button class="btn small" data-add="none">追加しない</button></div>`;
}

function bindLedgerEvents(acc, rows, closing) {
  const val = id => document.getElementById(id).value.trim();

  $('#btnSave').addEventListener('click', () => {
    const date = val('fDate');
    let subject = val('fSubject'); if (subject === MANUAL) subject = '';
    let tekiyo = val('fTekiyo'); if (tekiyo === MANUAL) tekiyo = '';
    const income = toNum(val('fIn'));
    const expense = toNum(val('fOut'));
    if (!date) return alert('年月日を入れてください。');
    if (!subject) return alert('科目を選ぶか、入力してください。');
    if (!income && !expense) return alert('収入金額か支払金額のどちらかを入れてください。');
    if (income && expense) return alert('収入と支払の両方に金額が入っています。どちらか一方にしてください。');
    const fy = fiscalYearOf(date);
    if (fy !== ui.year && !(subject === KURIKOSHI)) {
      if (!confirm(`${fullDate(date)} は ${yearLabel(fy)} の日付です。このまま ${yearLabel(ui.year)} の帳簿に書き込みますか？`)) return;
    }
    const data = { date, subject, tekiyo, income, expense, note: val('fNote'), checked: $('#fCheck').checked };
    if (ui.editingId) {
      Object.assign(state.entries.find(e => e.id === ui.editingId), data);
      toast('直しました');
    } else {
      state.entries.push({ id: 'e' + state.seq, seq: state.seq++, account: acc.id, year: ui.year, ...data });
      toast('書き込みました');
    }
    save();
    ui.editingId = null;
    ui.pickMode = {};
    ui.pendingNew = [];
    if (!subjectNames().includes(subject)) ui.pendingNew.push({ kind: 'subject', value: subject });
    if (tekiyo && subject !== KURIKOSHI && !allCandidates(tekiyoGroups(acc.id).slice(0, 3)).includes(tekiyo)) ui.pendingNew.push({ kind: 'tekiyo', value: tekiyo });
    ui.draft = { fDate: date, fSubject: '', fTekiyo: '', fIn: '', fOut: '', fNote: '', fCheck: false };
    renderLedger($('#main'));
  });

  $('#btnCancel')?.addEventListener('click', () => { resetForm(); renderLedger($('#main')); });
  $('#btnDelete')?.addEventListener('click', () => {
    if (!confirm('この行を消します。よろしいですか？')) return;
    state.entries = state.entries.filter(e => e.id !== ui.editingId);
    save(); resetForm(); toast('消しました'); renderLedger($('#main'));
  });
  $('#btnClear')?.addEventListener('click', () => { resetForm(); renderLedger($('#main')); });
  $('#btnDitto')?.addEventListener('click', () => {
    const last = rows[rows.length - 1];
    if (!last) return toast('前の行がありません');
    captureDraft();
    ui.draft.fSubject = last.subject;
    ui.draft.fTekiyo = last.tekiyo;
    renderLedger($('#main'));
  });

  document.querySelectorAll('.ledger tbody tr[data-id]').forEach(tr => {
    tr.addEventListener('click', () => {
      ui.editingId = tr.dataset.id; ui.draft = null; ui.pendingNew = []; ui.pickMode = {};
      renderLedger($('#main'));
      $('#formCard').scrollIntoView({ behavior: 'smooth' });
    });
  });

  document.querySelectorAll('#newPrompt [data-add]').forEach(b => {
    b.addEventListener('click', () => {
      const v = ui.pendingNew[0].value;
      const kind = b.dataset.add;
      if (kind === 'subject-in' || kind === 'subject-out') state.subjects.push({ name: v, type: kind === 'subject-in' ? 'in' : 'out', kessan: v });
      else if (kind === 'person') addPerson(v, '');
      else if (kind === 'partner') state.partners.push(v);
      else if (kind === 'template') state.templates.push(v);
      if (kind !== 'none') { save(); toast('追加しました'); }
      ui.pendingNew.shift();
      renderLedger($('#main'));
    });
  });

  $('#btnBank').addEventListener('click', () => {
    const raw = $('#bankBal').value;
    const k = bookKey(acc.id, ui.year);
    state.books[k] = state.books[k] || {};
    state.books[k].bank = raw === '' ? null : toNum(raw);
    save();
    $('#bankResult').innerHTML = bankResultHTML(state.books[k].bank, closing);
  });

  $('#btnCarry')?.addEventListener('click', () => {
    carryOver(acc.id, ui.year - 1);
    renderLedger($('#main'));
  });
  $('#btnNextYear').addEventListener('click', () => {
    const next = ui.year + 1;
    if (bookEntries(acc.id, next).some(e => e.subject === KURIKOSHI)) {
      if (!confirm(`${yearLabel(next)}にはもう「${KURIKOSHI}」があります。今の残高で書き直しますか？`)) return;
    }
    carryOver(acc.id, ui.year);
    ui.year = next;
    resetForm();
    render();
  });
}

function carryOver(account, fromYear) {
  const toYear = fromYear + 1;
  const amount = closingBalance(account, fromYear);
  const existing = state.entries.find(e => e.account === account && e.year === toYear && e.subject === KURIKOSHI);
  const data = { date: `${toYear}-03-21`, subject: KURIKOSHI, tekiyo: `令和${reiwa(fromYear)}年度より`, income: amount, expense: 0, note: '', checked: false };
  if (existing) Object.assign(existing, data);
  else state.entries.push({ id: 'e' + state.seq, seq: state.seq++, account, year: toYear, ...data });
  save();
  toast(`${yenAlways(amount)}円を繰り越しました`);
}

/* ---------- 📊 集計 ---------- */
function subjectTotals(account, year) {
  const map = new Map();
  for (const e of bookEntries(account, year)) {
    const t = map.get(e.subject) || { income: 0, expense: 0 };
    t.income += e.income || 0; t.expense += e.expense || 0;
    map.set(e.subject, t);
  }
  return map;
}

function kessanOf(subject) {
  const s = state.subjects.find(x => x.name === subject);
  return (s && s.kessan) || DEFAULT_KESSAN[subject] || subject;
}
function bookPeriod(account, year) {
  const list = bookEntries(account, year);
  return { from: list.length ? list[0].date : `${year}-03-21`, to: list.length ? list[list.length - 1].date : `${year + 1}-03-20` };
}
// 決算書の項目ごとにまとめる。前年度繰越金は収入の先頭に置く
function kessanData(account, year) {
  const build = field => {
    const items = new Map();
    for (const e of bookEntries(account, year)) {
      if (!e[field]) continue;
      const name = kessanOf(e.subject);
      const it = items.get(name) || { item: name, amount: 0, subjects: new Map(), tekiyo: [] };
      it.amount += e[field];
      it.subjects.set(e.subject, (it.subjects.get(e.subject) || 0) + e[field]);
      if (e.tekiyo && !it.tekiyo.includes(e.tekiyo)) it.tekiyo.push(e.tekiyo);
      items.set(name, it);
    }
    const list = [...items.values()].map(it => ({
      item: it.item,
      amount: it.amount,
      subjects: [...it.subjects.keys()],
      note: it.subjects.size > 1
        ? [...it.subjects].map(([k, v]) => `${k} ${yenAlways(v)}円`).join('、')
        : it.tekiyo.slice(0, 4).join('、') + (it.tekiyo.length > 4 ? ' ほか' : ''),
    }));
    return list.sort((a, b) => (b.subjects.includes(KURIKOSHI) ? 1 : 0) - (a.subjects.includes(KURIKOSHI) ? 1 : 0));
  };
  const ins = build('income');
  const outs = build('expense');
  return { ins, outs, sumIn: ins.reduce((s, x) => s + x.amount, 0), sumOut: outs.reduce((s, x) => s + x.amount, 0) };
}

function renderSummary(main) {
  const acc = accountById(ui.account);
  const totals = subjectTotals(acc.id, ui.year);
  const ins = [...totals].filter(([, t]) => t.income);
  const outs = [...totals].filter(([, t]) => t.expense);
  const sumIn = ins.reduce((s, [, t]) => s + t.income, 0);
  const sumOut = outs.reduce((s, [, t]) => s + t.expense, 0);
  const months = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
  const monthly = months.map((m, i) => {
    const y = i === 0 ? ui.year : (m <= 3 ? ui.year + 1 : ui.year);
    const list = bookEntries(acc.id, ui.year).filter(e => {
      const [ey, em] = e.date.split('-').map(Number);
      return ey === y && em === m;
    });
    return { label: `${m}月${i === 0 ? '（年度初め）' : ''}`, inc: list.reduce((s, e) => s + (e.income || 0), 0), exp: list.reduce((s, e) => s + (e.expense || 0), 0) };
  }).filter((r, i) => i !== 0 || r.inc || r.exp);

  main.innerHTML = `
    <div class="card">${bookSelectorHTML()}<h2 style="margin-top:10px">${yearLabel(ui.year)}　${esc(acc.fullName)}　科目別の集計</h2></div>
    <div class="master-grid">
      <div class="card"><h2>収入の部</h2>
        <table class="ledger"><thead><tr><th>科目</th><th>金額</th></tr></thead><tbody>
        ${ins.map(([k, t]) => `<tr><td>${esc(k)}</td><td class="num">${yenAlways(t.income)}</td></tr>`).join('')}
        </tbody><tfoot><tr><td>合計</td><td class="num">${yenAlways(sumIn)}</td></tr></tfoot></table>
      </div>
      <div class="card"><h2>支出の部</h2>
        <table class="ledger"><thead><tr><th>科目</th><th>金額</th></tr></thead><tbody>
        ${outs.map(([k, t]) => `<tr><td>${esc(k)}</td><td class="num">${yenAlways(t.expense)}</td></tr>`).join('')}
        </tbody><tfoot><tr><td>合計</td><td class="num">${yenAlways(sumOut)}</td></tr></tfoot></table>
      </div>
    </div>
    <div class="card"><h2>次年度への繰越額：${yenAlways(sumIn - sumOut)}円</h2>
      <p class="hint">収入合計（前年度繰越金を含む）− 支出合計 で計算しています。</p></div>
    ${kessanPreviewHTML(acc, ui.year)}
    <div class="card"><h2>月ごとの動き</h2>
      <table class="ledger"><thead><tr><th>月</th><th>収入</th><th>支出</th></tr></thead><tbody>
      ${monthly.map(r => `<tr><td>${r.label}</td><td class="num in">${yen(r.inc)}</td><td class="num out">${yen(r.exp)}</td></tr>`).join('')}
      </tbody></table>
    </div>
    <div class="card no-print"><button class="btn" onclick="window.print()">🖨 印刷</button></div>`;
  bindBookSelector();
}

function kessanPreviewHTML(acc, year) {
  const k = kessanData(acc.id, year);
  const p = bookPeriod(acc.id, year);
  const table = (title, list, sum) => `<h3>${title}</h3>
    <table class="ledger"><thead><tr><th>項目</th><th>決算額</th><th>摘要</th></tr></thead><tbody>
    ${list.map(x => `<tr><td>${esc(x.item)}</td><td class="num">${yenAlways(x.amount)}</td><td>${esc(x.note)}</td></tr>`).join('')}
    </tbody><tfoot><tr><td>合計</td><td class="num">${yenAlways(sum)}</td><td></td></tr></tfoot></table>`;
  return `<div class="card"><h2>決算書の形（${yearLabel(year)} ${esc(acc.fullName)}収支決算書）</h2>
    <p class="hint">自${fullDate(p.from)}～至${fullDate(p.to)}。科目のまとめ方は「候補の登録」→「決算書のまとめ方」で変えられます。Excel に書き出すと「決算書」シートが付きます。</p>
    ${table('収入の部', k.ins, k.sumIn)}
    ${table('支出の部', k.outs, k.sumOut)}
    <p><b>令和${reiwa(year) + 1}年度へ繰越額：${yenAlways(k.sumIn - k.sumOut)}円</b></p></div>`;
}

/* ---------- 📝 候補の登録 ---------- */
function renderMaster(main) {
  const chipList = (items, kind, cls = () => '') => `<div class="chips">${items.map((v, i) =>
    `<span class="chip ${cls(v)}">${esc(typeof v === 'string' ? v : v.name + (v.kana ? `（${v.kana}）` : ''))}<button title="消す" data-del="${kind}" data-i="${i}">×</button></span>`).join('') || '<span class="hint">まだありません</span>'}</div>`;

  main.innerHTML = `
    <div class="card">
      <h2>入力のしかた</h2>
      <label><input type="radio" name="inputMode" value="pick"${state.settings.inputMode !== 'type' ? ' checked' : ''}> 一覧から選ぶ（一覧にないときは「手で入力する」を選ぶ）</label><br>
      <label><input type="radio" name="inputMode" value="type"${state.settings.inputMode === 'type' ? ' checked' : ''}> 最初から手で打つ（打ち始めると候補が出ます）</label>
    </div>
    <div class="master-grid">
      <div class="card"><h2>科目</h2>
        <p class="hint">緑＝収入、赤＝支出</p>
        ${chipList(state.subjects, 'subject', s => s.type)}
        <div class="row"><input type="text" id="newSubject" placeholder="新しい科目">
          <select id="newSubjectType"><option value="in">収入</option><option value="out">支出</option></select>
          <button class="btn" id="addSubject">追加</button></div>
      </div>
      <div class="card"><h2>人名</h2>
        ${chipList(state.people, 'person')}
        <div class="row"><input type="text" id="newPerson" placeholder="名前（例：荒谷太郎）">
          <input type="text" id="newKana" placeholder="ふりがな（なくても可）">
          <button class="btn" id="addPerson">追加</button></div>
        <h3>まとめて登録</h3>
        <p class="hint">1行に1人ずつ貼り付けてください。「名前,ふりがな」の形でも登録できます。</p>
        <textarea id="bulkPeople" placeholder="荒谷太郎,あらたにたろう&#10;荒谷花子"></textarea>
        <button class="btn" id="addBulk">まとめて追加</button>
      </div>
      <div class="card"><h2>取引先</h2>
        ${chipList(state.partners, 'partner')}
        <div class="row"><input type="text" id="newPartner" placeholder="例：北陸電力"><button class="btn" id="addPartner">追加</button></div>
      </div>
      <div class="card"><h2>よく使う摘要</h2>
        ${chipList(state.templates, 'template')}
        <div class="row"><input type="text" id="newTemplate" placeholder="例：4月水道料"><button class="btn" id="addTemplate">追加</button></div>
      </div>
      <div class="card"><h2>会計の名前</h2>
        ${state.accounts.map((a, i) => `<div class="row" style="margin-bottom:8px">
          <label>短い名前<input type="text" data-acc="${i}" data-f="name" value="${esc(a.name)}"></label>
          <label>正式な名前<input type="text" data-acc="${i}" data-f="fullName" value="${esc(a.fullName)}"></label>
          <label>決算書の形<select data-acc="${i}" data-f="layout">
            <option value="tate"${a.layout !== 'yoko' ? ' selected' : ''}>縦（収入の部の下に支出の部）</option>
            <option value="yoko"${a.layout === 'yoko' ? ' selected' : ''}>横（左に収入、右に支出）</option>
          </select></label></div>`).join('')}
        <button class="btn" id="saveAccounts">保存</button>
      </div>
    </div>
    <div class="card"><h2>決算書のまとめ方</h2>
      <p class="hint">帳簿の科目を、決算書のどの項目にまとめるかを決めます。同じ項目名にした科目は、決算書で1行にまとまります（例：電気料と水道料 → 光熱水費）。</p>
      <datalist id="kessanItems">${[...new Set(state.subjects.map(x => x.kessan || x.name))].map(v => `<option value="${esc(v)}">`).join('')}</datalist>
      <div class="table-wrap"><table class="ledger"><thead><tr><th>帳簿の科目</th><th>収入/支出</th><th>決算書の項目</th></tr></thead><tbody>
      ${state.subjects.map((x, i) => `<tr><td>${esc(x.name)}</td><td>${x.type === 'in' ? '収入' : '支出'}</td>
        <td><input type="text" data-kessan="${i}" list="kessanItems" value="${esc(x.kessan || kessanOf(x.name))}"></td></tr>`).join('')}
      </tbody></table></div>
      <button class="btn" id="saveKessan" style="margin-top:10px">まとめ方を保存</button>
    </div>`;

  main.querySelectorAll('input[name=inputMode]').forEach(r => r.addEventListener('change', () => {
    state.settings.inputMode = r.value; save(); toast('入力のしかたを変えました');
  }));
  main.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
    const list = { subject: state.subjects, person: state.people, partner: state.partners, template: state.templates }[b.dataset.del];
    const item = list[Number(b.dataset.i)];
    const name = typeof item === 'string' ? item : item.name;
    if (!confirm(`「${name}」を一覧から消しますか？（帳簿に書いた内容は消えません）`)) return;
    list.splice(Number(b.dataset.i), 1); save(); renderMaster(main);
  }));
  const addTo = (inputId, fn) => {
    const v = document.getElementById(inputId).value.trim();
    if (!v) return;
    fn(v); save(); renderMaster(main); toast('追加しました');
  };
  $('#addSubject').addEventListener('click', () => addTo('newSubject', v => {
    if (!subjectNames().includes(v)) state.subjects.push({ name: v, type: $('#newSubjectType').value, kessan: v });
  }));
  $('#addPerson').addEventListener('click', () => addTo('newPerson', v => addPerson(v, $('#newKana').value.trim())));
  $('#addPartner').addEventListener('click', () => addTo('newPartner', v => { if (!state.partners.includes(v)) state.partners.push(v); }));
  $('#addTemplate').addEventListener('click', () => addTo('newTemplate', v => { if (!state.templates.includes(v)) state.templates.push(v); }));
  $('#addBulk').addEventListener('click', () => {
    const lines = $('#bulkPeople').value.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    let n = 0;
    for (const l of lines) {
      const [name, kana = ''] = l.split(/[,，\t]/).map(s => s.trim());
      if (name && addPerson(name, kana)) n++;
    }
    save(); renderMaster(main); toast(`${n}人を追加しました`);
  });
  $('#saveKessan').addEventListener('click', () => {
    main.querySelectorAll('[data-kessan]').forEach(inp => {
      state.subjects[Number(inp.dataset.kessan)].kessan = inp.value.trim() || state.subjects[Number(inp.dataset.kessan)].name;
    });
    save(); toast('保存しました'); renderMaster(main);
  });
  $('#saveAccounts').addEventListener('click', () => {
    main.querySelectorAll('[data-acc]').forEach(inp => {
      const v = inp.value.trim();
      if (v) state.accounts[Number(inp.dataset.acc)][inp.dataset.f] = v;
    });
    save(); toast('保存しました');
  });
}
function addPerson(name, kana) {
  if (state.people.some(p => p.name === name)) return false;
  state.people.push({ name, kana });
  return true;
}

/* ---------- 💾 Excel・保存 ---------- */
function renderExcel(main) {
  const years = allYears();
  main.innerHTML = `
    <div class="card">
      <h2>📤 Excel に書き出す</h2>
      <p>会計ごとに1枚のシートになり、手書きノートと同じ列（年月日・科目・摘要・収入金額・支払金額・差引残高）で出ます。
      Excel でも科目と摘要の欄は<b>一覧から選べ、手で打つこともできます</b>。残高は Excel の計算式で自動計算されます。</p>
      <div class="row">
        <label>年度<select id="exYear">
          <option value="all">すべての年度</option>
          ${years.map(y => `<option value="${y}"${y === ui.year ? ' selected' : ''}>${yearLabel(y)}</option>`).join('')}
        </select></label>
        <button class="btn primary" id="btnExport">Excel ファイルを作る</button>
      </div>
      <p class="hint">引き継ぎのときは、このファイルを渡してください。印刷も Excel から（ファイル → 印刷）できます。</p>
    </div>
    <div class="card">
      <h2>📥 Excel から読み込む</h2>
      <p>このアプリで書き出した Excel（Excel で書き足したものでも可）を読み込みます。
      ファイルに入っている会計・年度の帳簿は、<b>ファイルの内容で置き換わります</b>。</p>
      <input type="file" id="impFile" accept=".xlsx">
    </div>
    <div class="card">
      <h2>🗂 まるごと保存・復元（バックアップ）</h2>
      <p class="hint">候補の一覧や通帳残高なども含めて丸ごと保存します。パソコンを替えるときに使います。</p>
      <div class="row">
        <button class="btn" id="btnBackup">バックアップを保存</button>
        <label>バックアップから戻す<input type="file" id="restoreFile" accept=".json"></label>
      </div>
    </div>`;

  $('#btnExport').addEventListener('click', async () => {
    const v = $('#exYear').value;
    try {
      await exportExcel(v === 'all' ? years.slice().sort() : [Number(v)]);
    } catch (e) {
      console.error(e);
      alert('Excel を作れませんでした。\n' + e.message);
    }
  });
  $('#impFile').addEventListener('change', async e => {
    const f = e.target.files[0];
    if (!f) return;
    try { await importExcel(f); } catch (err) { console.error(err); alert('読み込めませんでした。\n' + err.message); }
    e.target.value = '';
  });
  $('#btnBackup').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' });
    download(blob, `荒谷町会計_バックアップ_${todayISO()}.json`);
    state.lastBackup = new Date().toISOString(); save(); renderNotices();
  });
  $('#restoreFile').addEventListener('change', async e => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!Array.isArray(data.entries)) throw new Error('このアプリのバックアップではないようです');
      if (!confirm(`今のデータを、このバックアップ（${data.entries.length}行）で置き換えます。よろしいですか？`)) return;
      state = migrate(Object.assign(defaultState(), data));
      save(); toast('復元しました'); render();
    } catch (err) { alert('復元できませんでした。\n' + err.message); }
    e.target.value = '';
  });
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

const SHEET_INFO = 'このファイルについて';
const SHEET_MASTER = '候補一覧';
const EXTRA_ROWS = 80;   // Excel で書き足せるように空けておく行数
const thin = { style: 'thin', color: { argb: 'FF999999' } };
const border = { top: thin, left: thin, bottom: thin, right: thin };
const HEADERS = ['年月日', '科目', '摘要', '収入金額', '支払金額', '差引残高', '検印', '備考'];

function sheetName(acc, year) { return `${acc.name} R${reiwa(year)}`.slice(0, 31); }
function isoToExcelDate(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); }

async function exportExcel(years) {
  const wb = new ExcelJS.Workbook();
  wb.creator = '荒谷町 会計帳簿アプリ';
  const info = wb.addWorksheet(SHEET_INFO);
  const master = wb.addWorksheet(SHEET_MASTER);

  // 候補一覧（Excel のプルダウンの元）
  const tekiyoAll = [...new Set([...state.people.map(p => p.name), ...state.partners, ...state.templates])];
  master.columns = [
    { header: '科目', width: 18 }, { header: '収入/支出', width: 10 }, { header: '決算書の項目', width: 18 },
    { header: '人名', width: 16 }, { header: 'ふりがな', width: 16 }, { header: '', width: 3 },
    { header: '取引先', width: 22 }, { header: '', width: 3 },
    { header: 'よく使う摘要', width: 18 }, { header: '', width: 3 },
    { header: '摘要の候補（まとめ）', width: 22 },
  ];
  state.subjects.forEach((s, i) => {
    master.getCell(i + 2, 1).value = s.name;
    master.getCell(i + 2, 2).value = s.type === 'in' ? '収入' : '支出';
    master.getCell(i + 2, 3).value = kessanOf(s.name);
  });
  state.people.forEach((p, i) => { master.getCell(i + 2, 4).value = p.name; master.getCell(i + 2, 5).value = p.kana || null; });
  state.partners.forEach((p, i) => { master.getCell(i + 2, 7).value = p; });
  state.templates.forEach((p, i) => { master.getCell(i + 2, 9).value = p; });
  tekiyoAll.forEach((p, i) => { master.getCell(i + 2, 11).value = p; });
  master.getRow(1).font = { bold: true };
  // 候補を書き足しても拾えるよう、余裕を持った範囲にする
  const subjRange = `'${SHEET_MASTER}'!$A$2:$A$300`;
  const tekiRange = `'${SHEET_MASTER}'!$K$2:$K$1000`;

  const listing = [];
  for (const year of years) {
    for (const acc of state.accounts) {
      const rows = bookEntries(acc.id, year);
      if (!rows.length && years.length > 1) continue;
      const name = sheetName(acc, year);
      listing.push({ name, acc, year });
      writeLedgerSheet(wb.addWorksheet(name, {
        pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '2:2' },
        views: [{ state: 'frozen', ySplit: 2 }],
      }), acc, year, rows, subjRange, tekiRange);
    }
  }

  const sum = wb.addWorksheet('科目別集計');
  writeSummarySheet(sum, listing);
  for (const year of years) {
    const accs = listing.filter(l => l.year === year && bookEntries(l.acc.id, year).length);
    if (accs.length) writeKessanSheet(wb.addWorksheet(`決算書 R${reiwa(year)}`, {
      pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true },
    }), year, accs);
  }

  info.columns = [{ width: 24 }, { width: 18 }, { width: 14 }, { width: 10 }];
  info.addRow(['荒谷町 会計帳簿（アプリから書き出し）']).font = { bold: true, size: 14 };
  info.addRow([`作成日：${fullDate(todayISO())}`]);
  info.addRow([]);
  info.addRow(['・科目と摘要の欄は▼で一覧から選べます。一覧にないものは、そのまま打ち込めます。']);
  info.addRow(['・差引残高は自動で計算されます。消さないでください。']);
  info.addRow(['・一覧を増やしたいときは「候補一覧」シートの下に書き足してください。']);
  info.addRow(['・「決算書」シートの金額は帳簿シートから自動で集計されます。摘要の文は自由に直してかまいません。']);
  info.addRow(['・下の表はアプリが読み込むときに使います。消さないでください。']);
  info.addRow([]);
  const hdr = info.addRow(['シート名', '会計', '会計ID', '年度']);
  hdr.font = { bold: true };
  for (const l of listing) info.addRow([l.name, l.acc.fullName, l.acc.id, l.year]);

  const buf = await wb.xlsx.writeBuffer();
  const label = years.length === 1 ? `令和${reiwa(years[0])}年度` : '全年度';
  download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `荒谷町会計_${label}_${todayISO()}.xlsx`);
  state.lastBackup = new Date().toISOString(); save(); renderNotices();
  toast('Excel を作りました');
}

function writeLedgerSheet(ws, acc, year, rows, subjRange, tekiRange) {
  ws.columns = [
    { width: 16 }, { width: 16 }, { width: 26 }, { width: 13 }, { width: 13 }, { width: 14 }, { width: 6 }, { width: 20 },
  ];
  ws.mergeCells('A1:H1');
  ws.getCell('A1').value = `${yearLabel(year)}　${acc.fullName}`;
  ws.getCell('A1').font = { bold: true, size: 14 };
  const head = ws.getRow(2);
  HEADERS.forEach((h, i) => {
    const c = head.getCell(i + 1);
    c.value = h; c.font = { bold: true }; c.alignment = { horizontal: 'center' }; c.border = border;
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2F5' } };
  });

  const first = 3;
  const last = first + rows.length + EXTRA_ROWS - 1;
  let bal = 0;
  for (let r = first; r <= last; r++) {
    const e = rows[r - first];
    const row = ws.getRow(r);
    if (e) {
      bal += (e.income || 0) - (e.expense || 0);
      row.getCell(1).value = isoToExcelDate(e.date);
      row.getCell(2).value = e.subject;
      row.getCell(3).value = e.tekiyo || null;
      row.getCell(4).value = e.income || null;
      row.getCell(5).value = e.expense || null;
      row.getCell(7).value = e.checked ? '会' : null;
      row.getCell(8).value = e.note || null;
    }
    // 収入・支払のどちらかに数字がある行だけ残高を出す（Excel で書き足した行も計算される）
    row.getCell(6).value = {
      formula: `IF(COUNT(D${r}:E${r})=0,"",SUM($D$${first}:D${r})-SUM($E$${first}:E${r}))`,
      result: e ? bal : '',
    };
    row.getCell(1).numFmt = '[$-411]ggge"年"m"月"d"日"';
    [4, 5, 6].forEach(c => { row.getCell(c).numFmt = '#,##0'; });
    row.getCell(7).font = { color: { argb: 'FFC62828' }, bold: true };
    row.getCell(7).alignment = { horizontal: 'center' };
    for (let c = 1; c <= 8; c++) row.getCell(c).border = border;
  }
  // プルダウン（入力規則）。一覧にない値もエラーにせず入力できるようにする
  const dv = (formula, prompt) => ({
    type: 'list', allowBlank: true, formulae: [formula],
    showErrorMessage: false, showInputMessage: true, promptTitle: '入力のしかた', prompt,
  });
  ws.dataValidations.add(`B${first}:B${last}`, dv(subjRange, '▼で科目を選ぶか、そのまま打ち込んでください'));
  ws.dataValidations.add(`C${first}:C${last}`, dv(tekiRange, '▼で選ぶか、そのまま打ち込んでください'));
  ws.dataValidations.add(`G${first}:G${last}`, { type: 'list', allowBlank: true, formulae: ['"会"'], showErrorMessage: false });
  ws.dataValidations.add(`D${first}:E${last}`, {
    type: 'whole', operator: 'greaterThanOrEqual', allowBlank: true, formulae: [0],
    showErrorMessage: true, errorTitle: '金額', error: '金額は数字で入れてください（カンマ・円は不要）',
  });
  ws.dataValidations.add(`A${first}:A${last}`, {
    type: 'date', operator: 'greaterThan', allowBlank: true, formulae: [new Date(Date.UTC(2000, 0, 1))],
    showErrorMessage: true, errorTitle: '年月日', error: '日付は 2025/4/28 のように入れてください',
  });
}

function writeSummarySheet(ws, listing) {
  ws.columns = [{ width: 22 }, { width: 18 }, { width: 14 }, { width: 14 }];
  let r = 1;
  for (const l of listing) {
    ws.getCell(r, 1).value = `${yearLabel(l.year)}　${l.acc.fullName}`;
    ws.getCell(r, 1).font = { bold: true, size: 13 };
    r++;
    ['科目', '収入/支出', '収入合計', '支払合計'].forEach((h, i) => {
      const c = ws.getCell(r, i + 1); c.value = h; c.font = { bold: true }; c.border = border;
    });
    r++;
    const totals = subjectTotals(l.acc.id, l.year);
    // Excel で書き足した行も集計されるよう、候補一覧の科目はすべて並べる
    const names = [...new Set([...subjectNames(), ...totals.keys()])];
    const startR = r;
    const q = `'${l.name}'`;
    for (const n of names) {
      const t = totals.get(n) || { income: 0, expense: 0 };
      const subj = state.subjects.find(s => s.name === n);
      ws.getCell(r, 1).value = n;
      ws.getCell(r, 2).value = subj ? (subj.type === 'in' ? '収入' : '支出') : '';
      ws.getCell(r, 3).value = { formula: `SUMIF(${q}!$B:$B,A${r},${q}!$D:$D)`, result: t.income };
      ws.getCell(r, 4).value = { formula: `SUMIF(${q}!$B:$B,A${r},${q}!$E:$E)`, result: t.expense };
      for (let c = 1; c <= 4; c++) ws.getCell(r, c).border = border;
      ws.getCell(r, 3).numFmt = '#,##0'; ws.getCell(r, 4).numFmt = '#,##0';
      r++;
    }
    const sumIn = [...totals.values()].reduce((s, t) => s + t.income, 0);
    const sumOut = [...totals.values()].reduce((s, t) => s + t.expense, 0);
    ws.getCell(r, 1).value = '合計';
    ws.getCell(r, 3).value = { formula: `SUM(C${startR}:C${r - 1})`, result: sumIn };
    ws.getCell(r, 4).value = { formula: `SUM(D${startR}:D${r - 1})`, result: sumOut };
    ws.getCell(r + 1, 1).value = '次年度へ繰越額';
    ws.getCell(r + 1, 3).value = { formula: `C${r}-D${r}`, result: sumIn - sumOut };
    for (const rr of [r, r + 1]) {
      ws.getRow(rr).font = { bold: true };
      ws.getCell(rr, 3).numFmt = '#,##0'; ws.getCell(rr, 4).numFmt = '#,##0';
    }
    r += 3;
  }
}

// 決算書（総会資料の形）。金額は帳簿シートを参照する計算式なので、Excel で帳簿を直しても追従する
function writeKessanSheet(ws, year, accs) {
  ws.columns = [{ width: 5 }, { width: 24 }, { width: 15 }, { width: 26 }, { width: 15 }, { width: 22 }];
  const money = c => { c.numFmt = '#,##0'; };
  const boxed = (r, c1, c2) => { for (let c = c1; c <= c2; c++) ws.getCell(r, c).border = border; };
  const head = (r, c, text) => {
    const cell = ws.getCell(r, c);
    cell.value = text; cell.font = { bold: true }; cell.alignment = { horizontal: 'center' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2F5' } };
  };
  const sumFormula = (q, subjects, col) => subjects.map(n => `SUMIF(${q}!$B:$B,"${n.replace(/"/g, '""')}",${q}!$${col}:$${col})`).join('+');
  const totals = [];
  let r = 1;

  accs.forEach((l, idx) => {
    const k = kessanData(l.acc.id, year);
    const p = bookPeriod(l.acc.id, year);
    const q = `'${l.name}'`;
    if (idx > 0) ws.getRow(r - 1).addPageBreak();
    ws.mergeCells(r, 1, r, 6);
    ws.getCell(r, 1).value = `令和${reiwa(year)}年度　${l.acc.fullName}収支決算書`;
    ws.getCell(r, 1).font = { bold: true, size: 15 };
    ws.getCell(r, 1).alignment = { horizontal: 'center' };
    r++;
    ws.getCell(r, 2).value = `自${fullDate(p.from)}～至${fullDate(p.to)}`;
    ws.getCell(r, 6).value = '（単位：円）';
    ws.getCell(r, 6).alignment = { horizontal: 'right' };
    r += 2;
    let inTotalCell, outTotalCell;

    if (l.acc.layout === 'yoko') {
      ws.mergeCells(r, 2, r, 3); ws.mergeCells(r, 4, r, 5);
      head(r, 2, '収　入　の　部'); head(r, 4, '支　出　の　部'); boxed(r, 2, 5); r++;
      head(r, 2, '科　目'); head(r, 3, '金　額'); head(r, 4, '科　目'); head(r, 5, '金　額'); boxed(r, 2, 5); r++;
      const start = r;
      const n = Math.max(k.ins.length, k.outs.length, 1);
      for (let i = 0; i < n; i++, r++) {
        const a = k.ins[i], b = k.outs[i];
        if (a) { ws.getCell(r, 2).value = a.item; ws.getCell(r, 3).value = { formula: sumFormula(q, a.subjects, 'D'), result: a.amount }; }
        if (b) { ws.getCell(r, 4).value = b.item; ws.getCell(r, 5).value = { formula: sumFormula(q, b.subjects, 'E'), result: b.amount }; }
        money(ws.getCell(r, 3)); money(ws.getCell(r, 5)); boxed(r, 2, 5);
      }
      ws.getCell(r, 2).value = '合　計'; ws.getCell(r, 4).value = '合　計';
      ws.getCell(r, 3).value = { formula: `SUM(C${start}:C${r - 1})`, result: k.sumIn };
      ws.getCell(r, 5).value = { formula: `SUM(E${start}:E${r - 1})`, result: k.sumOut };
      inTotalCell = `C${r}`; outTotalCell = `E${r}`;
      ws.getRow(r).font = { bold: true }; money(ws.getCell(r, 3)); money(ws.getCell(r, 5)); boxed(r, 2, 5);
      r++;
      ws.getCell(r, 4).value = `令和${reiwa(year) + 1}年度へ繰越額`;
      ws.getCell(r, 5).value = { formula: `${inTotalCell}-${outTotalCell}`, result: k.sumIn - k.sumOut };
      ws.getRow(r).font = { bold: true }; money(ws.getCell(r, 5)); boxed(r, 4, 5);
      totals.push({ name: l.acc.fullName, cell: `E${r}`, value: k.sumIn - k.sumOut });
      r++;
      // 内訳（摘要）は表の下にまとめる
      const notes = [...k.ins, ...k.outs].filter(x => x.note && !x.subjects.includes(KURIKOSHI));
      if (notes.length) {
        r++;
        ws.getCell(r, 2).value = '（内訳・摘要）'; r++;
        for (const x of notes) {
          ws.getCell(r, 2).value = x.item;
          ws.mergeCells(r, 3, r, 6);
          ws.getCell(r, 3).value = x.note;
          ws.getCell(r, 3).alignment = { wrapText: true, vertical: 'top' };
          r++;
        }
      }
    } else {
      const block = (title, list, col, sum) => {
        ws.mergeCells(r, 1, r, 6); head(r, 1, title); boxed(r, 1, 6); r++;
        head(r, 1, 'No'); head(r, 2, '項　目'); head(r, 3, '決算額'); ws.mergeCells(r, 4, r, 6); head(r, 4, '摘　要'); boxed(r, 1, 6); r++;
        const start = r;
        list.forEach((x, i) => {
          ws.getCell(r, 1).value = i + 1;
          ws.getCell(r, 2).value = x.item;
          ws.getCell(r, 3).value = { formula: sumFormula(q, x.subjects, col), result: x.amount };
          ws.mergeCells(r, 4, r, 6);
          ws.getCell(r, 4).value = x.note || null;
          ws.getCell(r, 4).alignment = { wrapText: true, vertical: 'top' };
          money(ws.getCell(r, 3)); boxed(r, 1, 6);
          r++;
        });
        ws.getCell(r, 2).value = '合　計';
        ws.getCell(r, 3).value = { formula: list.length ? `SUM(C${start}:C${r - 1})` : '0', result: sum };
        ws.getRow(r).font = { bold: true }; money(ws.getCell(r, 3)); boxed(r, 1, 6);
        const cell = `C${r}`;
        r += 2;
        return cell;
      };
      inTotalCell = block('収　入　の　部', k.ins, 'D', k.sumIn);
      outTotalCell = block('支　出　の　部', k.outs, 'E', k.sumOut);
      r--;
      ws.getCell(r, 2).value = `令和${reiwa(year) + 1}年度へ繰越額`;
      ws.getCell(r, 3).value = { formula: `${inTotalCell}-${outTotalCell}`, result: k.sumIn - k.sumOut };
      ws.getRow(r).font = { bold: true }; money(ws.getCell(r, 3)); boxed(r, 2, 3);
      totals.push({ name: l.acc.fullName, cell: `C${r}`, value: k.sumIn - k.sumOut });
      r++;
    }

    // 帳簿の合計と決算書の合計が合っているかの確認（Excel で新しい科目を足したときに気づけるように）
    ws.getCell(r, 2).value = '確認（帳簿との差）';
    ws.getCell(r, 2).font = { color: { argb: 'FF888888' }, size: 9 };
    ws.mergeCells(r, 3, r, 6);
    ws.getCell(r, 3).value = {
      formula: `IF(AND(SUM(${q}!D:D)=${inTotalCell},SUM(${q}!E:E)=${outTotalCell}),"OK（帳簿と一致）","帳簿と合いません：決算書にない科目があります")`,
      result: 'OK（帳簿と一致）',
    };
    ws.getCell(r, 3).font = { color: { argb: 'FF888888' }, size: 9 };
    r += 3;
  });

  if (totals.length > 1) {
    ws.getRow(r - 1).addPageBreak();
    ws.mergeCells(r, 1, r, 6);
    ws.getCell(r, 1).value = `令和${reiwa(year)}年度　会計別の繰越額（預金）`;
    ws.getCell(r, 1).font = { bold: true, size: 14 };
    r += 2;
    head(r, 2, '会　計'); head(r, 3, '繰越額'); boxed(r, 2, 3); r++;
    const start = r;
    for (const t of totals) {
      ws.getCell(r, 2).value = t.name;
      ws.getCell(r, 3).value = { formula: t.cell, result: t.value };
      money(ws.getCell(r, 3)); boxed(r, 2, 3); r++;
    }
    ws.getCell(r, 2).value = '合　計';
    ws.getCell(r, 3).value = { formula: `SUM(C${start}:C${r - 1})`, result: totals.reduce((s, t) => s + t.value, 0) };
    ws.getRow(r).font = { bold: true }; money(ws.getCell(r, 3)); boxed(r, 2, 3);
  }
}

function cellText(v) {
  if (v == null) return '';
  if (typeof v === 'object') {
    if (v instanceof Date) return v;
    if ('result' in v) return cellText(v.result);
    if (v.richText) return v.richText.map(t => t.text).join('');
    if ('text' in v) return String(v.text);
  }
  return typeof v === 'string' ? v.trim() : v;
}
function parseDateCell(v) {
  v = cellText(v);
  if (!v) return null;
  if (v instanceof Date) return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, '0')}-${String(v.getUTCDate()).padStart(2, '0')}`;
  if (typeof v === 'number') return parseDateCell(new Date(Date.UTC(1899, 11, 30) + v * 86400000));
  const s = String(v).replace(/[０-９]/g, d => String.fromCharCode(d.charCodeAt(0) - 0xFEE0));
  let m = s.match(/(?:令和|R)\s*(\d+|元)\s*[年.\/]\s*(\d+)\s*[月.\/]\s*(\d+)/i);
  if (m) return `${(m[1] === '元' ? 1 : Number(m[1])) + 2018}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/(\d{4})\s*[年.\/-]\s*(\d+)\s*[月.\/-]\s*(\d+)/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  return null;
}

async function importExcel(file) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const info = wb.getWorksheet(SHEET_INFO);
  if (!info) throw new Error(`「${SHEET_INFO}」シートがありません。このアプリで書き出した Excel を選んでください。`);

  const listing = [];
  info.eachRow((row, i) => {
    const name = cellText(row.getCell(1).value);
    const id = cellText(row.getCell(3).value);
    const year = Number(cellText(row.getCell(4).value));
    if (name && id && year && wb.getWorksheet(name)) listing.push({ name, id, year, fullName: cellText(row.getCell(2).value) });
  });
  if (!listing.length) throw new Error('読み込める帳簿が見つかりませんでした。');

  const imported = [];
  const skipped = [];
  for (const l of listing) {
    const ws = wb.getWorksheet(l.name);
    const rows = [];
    ws.eachRow((row, r) => {
      if (r < 3) return;
      const subject = String(cellText(row.getCell(2).value) || '');
      const income = toNum(cellText(row.getCell(4).value));
      const expense = toNum(cellText(row.getCell(5).value));
      if (!subject && !income && !expense) return;
      const date = parseDateCell(row.getCell(1).value);
      if (!date) { skipped.push(`${l.name} ${r}行目（日付が読めません）`); return; }
      rows.push({
        date, subject, tekiyo: String(cellText(row.getCell(3).value) || ''), income, expense,
        checked: !!cellText(row.getCell(7).value), note: String(cellText(row.getCell(8).value) || ''),
      });
    });
    imported.push({ ...l, rows });
  }

  const summary = imported.map(l => `・${l.name}：${l.rows.length}行`).join('\n');
  if (!confirm(`次の帳簿を読み込みます。アプリの中の同じ会計・年度は置き換わります。\n\n${summary}${skipped.length ? `\n\n読み飛ばす行：\n${skipped.join('\n')}` : ''}\n\nよろしいですか？`)) return;

  for (const l of imported) {
    if (!state.accounts.some(a => a.id === l.id)) state.accounts.push({ id: l.id, name: l.fullName || l.id, fullName: l.fullName || l.id });
    state.entries = state.entries.filter(e => !(e.account === l.id && e.year === l.year));
    for (const r of l.rows) state.entries.push({ id: 'e' + state.seq, seq: state.seq++, account: l.id, year: l.year, ...r });
  }
  importMasters(wb.getWorksheet(SHEET_MASTER));
  save();
  toast('読み込みました');
  render();
}

function importMasters(ws) {
  if (!ws) return;
  ws.eachRow((row, r) => {
    if (r < 2) return;
    const subj = cellText(row.getCell(1).value);
    if (subj && !subjectNames().includes(String(subj))) {
      state.subjects.push({ name: String(subj), type: cellText(row.getCell(2).value) === '収入' ? 'in' : 'out' });
    }
    const item = cellText(row.getCell(3).value);
    const target = subj && state.subjects.find(x => x.name === String(subj));
    if (target && item) target.kessan = String(item);
    const person = cellText(row.getCell(4).value);
    if (person) addPerson(String(person), String(cellText(row.getCell(5).value) || ''));
    const partner = cellText(row.getCell(7).value);
    if (partner && !state.partners.includes(String(partner))) state.partners.push(String(partner));
    const tpl = cellText(row.getCell(9).value);
    if (tpl && !state.templates.includes(String(tpl))) state.templates.push(String(tpl));
  });
}

/* ---------- ❓ 使い方 ---------- */
function renderHelp(main) {
  main.innerHTML = `<div class="card help">
    <h2>使い方（1ページ）</h2>
    <h3>① 帳簿に書き込む</h3>
    <ol>
      <li>「📒 帳簿」を押し、<b>会計</b>と<b>年度</b>を選びます。</li>
      <li>年月日を選び、<b>科目</b>と<b>摘要</b>を ▼ から選びます。<br>
        一覧にないときは、▼ の一番下の「✏ 手で入力する」を選ぶと、自由に打てます。</li>
      <li>収入なら「収入金額」、支払なら「支払金額」に数字だけ入れます（カンマ・円は不要）。</li>
      <li>「書き込む」を押します。<b>差引残高は自動で計算</b>されます。</li>
      <li>前の行と同じ科目なら「〃 前の行と同じ」を押すと、科目と摘要が入ります。</li>
    </ol>
    <h3>② まちがえたとき</h3>
    <p>表の行をクリックすると上の入力欄に出てきます。直して「直した内容で保存」を押します。消すときは「この行を消す」。</p>
    <h3>③ 通帳と合わせる</h3>
    <p>帳簿の下の「通帳の残高」に通帳の数字を入れて「確かめる」を押すと、合っているか、いくらずれているかが出ます。</p>
    <h3>④ 年度が終わったら</h3>
    <p>帳簿の下の「○○年度へ繰り越す」を押すと、残高が次の年度の「前年度繰越金」になります。会計ごとに押してください。</p>
    <h3>⑤ Excel に保存する・印刷する（大切）</h3>
    <ul>
      <li>「💾 Excel・保存」→「Excel ファイルを作る」で、Excel ファイルができます（パソコンの「ダウンロード」フォルダに入ります）。</li>
      <li><b>月に1回は Excel に保存してください。</b>パソコンが壊れても Excel があれば元に戻せます。</li>
      <li>印刷は、帳簿画面の「🖨 印刷」か、Excel から行えます。</li>
      <li>Excel の「決算書」シートは、総会資料の収支決算書の形になっています。摘要の文は Excel で自由に直せます。</li>
    </ul>
    <h3>⑥ 会計係を引き継ぐとき</h3>
    <ol>
      <li>「Excel ファイルを作る」で<b>すべての年度</b>を選んで Excel を作り、次の方に渡します（印刷したものも一緒に）。</li>
      <li>次の方は、Excel だけで続けても、このアプリで「Excel から読み込む」をして続けても大丈夫です。</li>
      <li>Excel でも科目・摘要は ▼ で選べて、手で打つこともできます。残高は自動計算です。</li>
    </ol>
    <h3>⑦ 一覧（候補）を増やす・減らす</h3>
    <p>「📝 候補の登録」で、科目・人名・取引先・よく使う摘要を追加したり消したりできます。人名はまとめて貼り付けて登録できます。
    最初から手で打ちたい方は、同じ画面の「入力のしかた」で「最初から手で打つ」を選んでください。</p>
  </div>`;
}

render();
