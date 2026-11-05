// =============================================================
// data.js … データの形・保存・計算・CSV をまとめたファイル
// データはこの端末のブラウザ（localStorage）にだけ保存されます。
// GitHub には一切送信・保存されません。
// =============================================================

const STORAGE_KEY = 'collagen-app-v1';
const PRE_V2_BACKUP_KEY = 'collagen-app-v1-backup-before-v2'; // 形式変更前のデータの控え
const PRE_V3_BACKUP_KEY = 'collagen-app-v2-backup-before-v3';
const DATA_VERSION = 3;
const BACKUP_REMIND_DAYS = 14; // この日数バックアップしていないとお知らせ
const MAX_LIST_MONTHS = 36; // 一覧に並べる最大の月数

const FLAVORS = ['ザクロ', 'ゆず'];
const PLANS = ['毎月', '隔月', '単発'];
const DELIVERIES = ['直送', '手渡し'];
const TIME_SLOTS = ['指定なし', '午前中', '14〜16時', '16〜18時', '18〜20時', '19〜21時'];
const STATUSES = ['未対応', '発送済み', '手渡し済み'];
const SLIPS = ['未送付', '送付済み'];
const PAYMENTS = ['未入金', '入金済み'];

// ---------- 月の計算 ----------
function ymOf(date) {
  const d = date || new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
function addMonths(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  return ymOf(new Date(y, m - 1 + n, 1));
}
function monthDiff(fromYm, toYm) {
  const [y1, m1] = fromYm.split('-').map(Number);
  const [y2, m2] = toYm.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
}
function ymLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  return y + '年' + m + '月';
}
function isValidYm(s) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(s || '');
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---------- 個数（味ごと） ----------
function emptyQty() {
  return { ザクロ: 0, ゆず: 0 };
}
function toCount(v) {
  return Math.max(0, Math.floor(Number(v)) || 0);
}
// どんな形の個数でも { ザクロ: n, ゆず: m } にそろえる
// 旧形式（flavor: 'ゆず', qty: 2）にも対応
function normalizeQty(obj) {
  const q = emptyQty();
  if (obj.qty && typeof obj.qty === 'object') {
    FLAVORS.forEach((f) => { q[f] = toCount(obj.qty[f]); });
  } else if (FLAVORS.includes(obj.flavor)) {
    q[obj.flavor] = toCount(obj.qty);
  }
  return q;
}
function totalQty(q) {
  return FLAVORS.reduce((s, f) => s + (q[f] || 0), 0);
}

// ---------- 保存と読み込み ----------
function emptyDb() {
  return { customers: [], records: {}, inventory: {}, meta: { version: DATA_VERSION, lastBackupAt: null } };
}

// 古い形式のデータを新しい形式に直す（データは消さない）
function migrateDb(db) {
  db.customers = (db.customers || []).map((c) => {
    const out = Object.assign({}, c, { qty: normalizeQty(c) });
    delete out.flavor;
    if (out.plan === 'イレギュラー') out.plan = '単発';
    return out;
  });
  const records = db.records || {};
  db.customers.forEach((c) => {
    // 以前のデータ（「送る月」の項目がない）の単発の人は、記録がある月を送る月として引き継ぐ
    if (c.shipMonths === undefined && c.plan === '単発') {
      c.shipMonths = Object.keys(records).filter((ym) => records[ym] && records[ym][c.id]);
    }
    c.shipMonths = normalizeMonths(c.shipMonths);
  });
  Object.keys(records).forEach((ym) => {
    Object.keys(records[ym] || {}).forEach((cid) => {
      const r = Object.assign({}, records[ym][cid]);
      r.qty = normalizeQty(r);
      delete r.flavor;
      records[ym][cid] = r;
    });
  });
  db.records = records;
  db.inventory = db.inventory || {};
  db.meta = Object.assign({ lastBackupAt: null }, db.meta || {}, { version: DATA_VERSION });
  return db;
}

// 「送る月」の一覧を、重複なし・古い順にそろえる
function normalizeMonths(list) {
  return Array.from(new Set((Array.isArray(list) ? list : []).filter(isValidYm))).sort();
}

function loadDb() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyDb();
    const db = JSON.parse(raw);
    const oldVersion = (db.meta && db.meta.version) || 1;
    if (oldVersion < DATA_VERSION) {
      // 念のため、形式を変える前のデータをそのまま控えておく
      const key = oldVersion < 2 ? PRE_V2_BACKUP_KEY : PRE_V3_BACKUP_KEY;
      if (!localStorage.getItem(key)) localStorage.setItem(key, raw);
      migrateDb(db);
      saveDb(db);
      return db;
    }
    return migrateDb(db);
  } catch (e) {
    console.error(e);
    return emptyDb();
  }
}

function saveDb(db) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

// ---------- 顧客 ----------
function newCustomer() {
  return {
    id: newId(),
    name: '',
    qty: { ザクロ: 1, ゆず: 0 },
    plan: '毎月',
    startMonth: ymOf(),
    shipMonths: [], // 単発の人が送る月（例：['2026-10', '2026-12']）
    delivery: '直送',
    timeSlot: '指定なし',
    paused: false,
    address: '',
    phone: '',
    memo: '',
    createdAt: new Date().toISOString(),
  };
}

function findCustomer(db, id) {
  return db.customers.find((c) => c.id === id);
}

// その月が「予定上の」発送月かどうか（休止は考えない）
function isScheduledMonth(c, ym) {
  if (c.plan === '単発') return (c.shipMonths || []).includes(ym);
  if (!isValidYm(c.startMonth)) return c.plan === '毎月';
  const diff = monthDiff(c.startMonth, ym);
  if (diff < 0) return false;
  if (c.plan === '毎月') return true;
  if (c.plan === '隔月') return diff % 2 === 0;
  return false;
}

// 隔月の人の次の発送月（ym を含む）
function nextScheduledMonth(c, ym) {
  for (let i = 0; i < 24; i++) {
    const t = addMonths(ym, i);
    if (isScheduledMonth(c, t)) return t;
  }
  return null;
}

// ---------- 月ごとの発送記録 ----------
function getRecord(db, ym, cid) {
  return (db.records[ym] || {})[cid] || null;
}

function makeRecord(c, irregular) {
  return {
    status: '未対応',
    slip: '未送付',
    tracking: '',
    payment: '未入金',
    memo: '',
    qty: normalizeQty(c), // 記録時点の個数（あとで顧客情報を変えても過去の記録は変わらない）
    irregular: !!irregular,
  };
}

// 記録を取得（無ければ作って保存用に返す）
function ensureRecord(db, ym, cid, irregular) {
  if (!db.records[ym]) db.records[ym] = {};
  if (!db.records[ym][cid]) {
    const c = findCustomer(db, cid);
    db.records[ym][cid] = makeRecord(c || { qty: emptyQty() }, irregular);
  }
  return db.records[ym][cid];
}

// その月に送るかどうか（休止中の人は送らない）
function shipsInMonth(c, ym) {
  return !c.paused && isScheduledMonth(c, ym);
}

// その月の発送リスト：その月に送る人だけ（記録が未作成の人は顧客情報から仮表示）
// お休みの月の人は出さない。ただし、その月に実際に発送・手渡しした記録や、
// 「その他」から臨時で追加した記録がある人は、履歴として残す。
function shipList(db, ym) {
  const recs = db.records[ym] || {};
  const list = [];
  db.customers.forEach((c) => {
    const rec = recs[c.id] || null;
    const scheduled = shipsInMonth(c, ym);
    const keepByRecord = rec && (isDone(rec.status) || (rec.irregular && c.plan !== '単発'));
    if (scheduled || keepByRecord) {
      list.push({
        customer: c,
        record: rec || makeRecord(c, false),
        saved: !!rec,
      });
    }
  });
  list.sort((a, b) => a.customer.name.localeCompare(b.customer.name, 'ja'));
  return list;
}

// 一覧画面用：記録のある月・今月までの全員分（新しい月が先）
function listMonths(db) {
  const now = ymOf();
  let first = now;
  let last = now;
  db.customers.forEach((c) => {
    if (isValidYm(c.startMonth) && c.startMonth < first) first = c.startMonth;
  });
  db.customers.forEach((c) => (c.shipMonths || []).forEach((ym) => {
    if (ym < first) first = ym;
    if (ym > last) last = ym;
  }));
  Object.keys(db.records).forEach((ym) => {
    if (!isValidYm(ym) || !Object.keys(db.records[ym] || {}).length) return;
    if (ym < first) first = ym;
    if (ym > last) last = ym;
  });
  const months = [];
  for (let ym = last; ym >= first && months.length < MAX_LIST_MONTHS; ym = addMonths(ym, -1)) months.push(ym);
  return months;
}

function allRows(db) {
  const rows = [];
  listMonths(db).forEach((ym) => {
    shipList(db, ym).forEach((it) => rows.push({ ym, customer: it.customer, record: it.record, saved: it.saved }));
  });
  return rows;
}

// ---------- 在庫 ----------
function getInventory(db, ym) {
  return db.inventory[ym] || { opening: { ザクロ: null, ゆず: null }, arrivals: [] };
}
function ensureInventory(db, ym) {
  if (!db.inventory[ym]) db.inventory[ym] = { opening: { ザクロ: null, ゆず: null }, arrivals: [] };
  return db.inventory[ym];
}

function isDone(status) {
  return status === '発送済み' || status === '手渡し済み';
}

// 味ごとの在庫計算
function calcStock(db, ym) {
  const inv = getInventory(db, ym);
  const list = shipList(db, ym);
  const result = {};
  FLAVORS.forEach((f) => {
    const opening = inv.opening && inv.opening[f] != null && inv.opening[f] !== '' ? Number(inv.opening[f]) : null;
    const arrived = (inv.arrivals || []).filter((a) => a.flavor === f).reduce((s, a) => s + (Number(a.qty) || 0), 0);
    let shipped = 0, pending = 0, planned = 0;
    list.forEach(({ record }) => {
      const q = (record.qty && record.qty[f]) || 0;
      planned += q;
      if (isDone(record.status)) shipped += q; else pending += q;
    });
    const remaining = (opening || 0) + arrived - shipped;
    result[f] = {
      opening,
      arrived,
      shipped,
      pending,
      planned,
      remaining,
      afterPlan: remaining - pending,
      shortage: pending > remaining ? pending - remaining : 0,
    };
  });
  return result;
}

// 前月の月末残り（前月の月初在庫が入力されている場合のみ）
function previousEnding(db, ym) {
  const prev = addMonths(ym, -1);
  const inv = db.inventory[prev];
  if (!inv) return null;
  const s = calcStock(db, prev);
  const out = {};
  let any = false;
  FLAVORS.forEach((f) => {
    if (s[f].opening != null) { out[f] = s[f].remaining; any = true; } else out[f] = null;
  });
  return any ? out : null;
}

// ---------- バックアップのお知らせ ----------
function backupDaysAgo(db) {
  if (!db.meta.lastBackupAt) return null;
  return Math.floor((Date.now() - new Date(db.meta.lastBackupAt).getTime()) / 86400000);
}
function needsBackupReminder(db) {
  const hasData = db.customers.length > 0;
  if (!hasData) return false;
  const d = backupDaysAgo(db);
  return d === null || d >= BACKUP_REMIND_DAYS;
}

// ---------- CSV ----------
// 1つのCSVファイルに「種別」列で4種類のデータをまとめます。
// 顧客・発送記録の個数は「ザクロ個数」「ゆず個数」列、在庫・入荷は「味」「個数」列を使います。
const CSV_COLUMNS = [
  '種別', 'ID', '月', '顧客名', 'ザクロ個数', 'ゆず個数', '味', '個数', '定期便', '開始月', '送る月', '受け渡し', '時間指定',
  '休止中', '住所', '電話番号', 'メモ', '状況', '伝票', '伝票番号', '入金', '単発追加', '日付', '登録日時',
];

function csvEscape(v) {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function toCsv(db) {
  const rows = [CSV_COLUMNS];
  const row = (obj) => CSV_COLUMNS.map((k) => (obj[k] == null ? '' : obj[k]));

  db.customers.forEach((c) => rows.push(row({
    '種別': '顧客', 'ID': c.id, '顧客名': c.name, 'ザクロ個数': c.qty.ザクロ, 'ゆず個数': c.qty.ゆず, '定期便': c.plan,
    '開始月': c.startMonth, '送る月': (c.shipMonths || []).join(' '), '受け渡し': c.delivery, '時間指定': c.timeSlot, '休止中': c.paused ? 'はい' : 'いいえ',
    '住所': c.address, '電話番号': c.phone, 'メモ': c.memo, '登録日時': c.createdAt,
  })));

  Object.keys(db.records).sort().forEach((ym) => {
    Object.keys(db.records[ym]).forEach((cid) => {
      const r = db.records[ym][cid];
      const c = findCustomer(db, cid);
      rows.push(row({
        '種別': '発送記録', 'ID': cid, '月': ym, '顧客名': c ? c.name : '', 'ザクロ個数': r.qty.ザクロ, 'ゆず個数': r.qty.ゆず,
        'メモ': r.memo, '状況': r.status, '伝票': r.slip, '伝票番号': r.tracking, '入金': r.payment,
        '単発追加': r.irregular ? 'はい' : 'いいえ',
      }));
    });
  });

  Object.keys(db.inventory).sort().forEach((ym) => {
    const inv = db.inventory[ym];
    FLAVORS.forEach((f) => {
      const v = inv.opening ? inv.opening[f] : null;
      if (v != null && v !== '') rows.push(row({ '種別': '月初在庫', '月': ym, '味': f, '個数': v }));
    });
    (inv.arrivals || []).forEach((a) => rows.push(row({
      '種別': '入荷', 'ID': a.id, '月': ym, '日付': a.date, '味': a.flavor, '個数': a.qty, 'メモ': a.memo,
    })));
  });

  if (db.meta.lastBackupAt) rows.push(row({ '種別': '設定', 'メモ': 'lastBackupAt', '日付': db.meta.lastBackupAt }));

  return '﻿' + rows.map((r) => r.map(csvEscape).join(',')).join('\r\n') + '\r\n';
}

// CSV文字列 → 2次元配列（"..." 内のカンマ・改行にも対応）
function parseCsvRows(text) {
  text = text.replace(/^﻿/, '');
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false;
      } else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v !== ''));
}

function pick(list, value, fallback) {
  return list.includes(value) ? value : fallback;
}

// CSVの1行から個数を読む（新形式：ザクロ個数・ゆず個数／旧形式：味＋個数）
function qtyFromCsv(o) {
  if (o['ザクロ個数'] !== undefined || o['ゆず個数'] !== undefined) {
    return { ザクロ: toCount(o['ザクロ個数']), ゆず: toCount(o['ゆず個数']) };
  }
  return normalizeQty({ flavor: o['味'], qty: o['個数'] });
}

// CSV → データ（形式がおかしいときはエラーを投げる）
function fromCsv(text) {
  const rows = parseCsvRows(text);
  if (!rows.length) throw new Error('CSVが空です');
  const header = rows[0].map((h) => h.trim());
  if (header[0] !== '種別' || !header.includes('ID')) {
    throw new Error('このアプリで書き出したCSVではないようです');
  }
  const db = emptyDb();
  const num = (v) => (v === '' || v == null ? null : Number(v));
  rows.slice(1).forEach((cells) => {
    const o = {};
    header.forEach((h, i) => { o[h] = cells[i] == null ? '' : cells[i]; });
    switch (o['種別']) {
      case '顧客':
        db.customers.push({
          id: o['ID'] || newId(),
          name: o['顧客名'],
          qty: qtyFromCsv(o),
          plan: pick(PLANS, o['定期便'] === 'イレギュラー' ? '単発' : o['定期便'], '毎月'),
          startMonth: isValidYm(o['開始月']) ? o['開始月'] : ymOf(),
          shipMonths: '送る月' in o ? (o['送る月'] || '').split(/[\s,、]+/) : undefined,
          delivery: pick(DELIVERIES, o['受け渡し'], '直送'),
          timeSlot: pick(TIME_SLOTS, o['時間指定'], '指定なし'),
          paused: o['休止中'] === 'はい',
          address: o['住所'],
          phone: o['電話番号'],
          memo: o['メモ'],
          createdAt: o['登録日時'] || new Date().toISOString(),
        });
        break;
      case '発送記録':
        if (!isValidYm(o['月']) || !o['ID']) break;
        if (!db.records[o['月']]) db.records[o['月']] = {};
        db.records[o['月']][o['ID']] = {
          status: pick(STATUSES, o['状況'], '未対応'),
          slip: pick(SLIPS, o['伝票'], '未送付'),
          tracking: o['伝票番号'],
          payment: pick(PAYMENTS, o['入金'], '未入金'),
          memo: o['メモ'],
          qty: qtyFromCsv(o),
          irregular: (o['単発追加'] || o['イレギュラー追加']) === 'はい',
        };
        break;
      case '月初在庫':
        if (!isValidYm(o['月']) || !FLAVORS.includes(o['味'])) break;
        ensureInventory(db, o['月']).opening[o['味']] = num(o['個数']);
        break;
      case '入荷':
        if (!isValidYm(o['月'])) break;
        ensureInventory(db, o['月']).arrivals.push({
          id: o['ID'] || newId(),
          date: o['日付'],
          flavor: pick(FLAVORS, o['味'], 'ザクロ'),
          qty: num(o['個数']) || 0,
          memo: o['メモ'],
        });
        break;
      case '設定':
        if (o['メモ'] === 'lastBackupAt' && o['日付']) db.meta.lastBackupAt = o['日付'];
        break;
    }
  });
  return migrateDb(db); // 以前のCSV（送る月の列がない）でも単発の人の送る月を引き継ぐ
}

// Node.js でのテスト用（ブラウザでは無視されます）
if (typeof module !== 'undefined') {
  module.exports = {
    FLAVORS, ymOf, addMonths, monthDiff, isScheduledMonth, shipList, calcStock, ensureRecord,
    ensureInventory, toCsv, fromCsv, emptyDb, newCustomer, previousEnding, needsBackupReminder,
    migrateDb, listMonths, allRows, normalizeQty, shipsInMonth, normalizeMonths, isDone,
  };
}
