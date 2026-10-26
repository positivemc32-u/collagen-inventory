// =============================================================
// data.js … 発行元の情報・履歴の保存と、金額・消費税の計算
// データはこのブラウザの localStorage にだけ保存されます。
// =============================================================

const STORAGE_KEY = 'ryoshusho-v1';

// 発行元（領収書の右下に出る情報）。最初は空欄で、「⚙️ 設定」で入れます。
// ⚠️ 名前・住所・電話・登録番号などの個人情報は、このファイルに書かないでください。
//    このファイルは GitHub で公開されています。入れた情報はこの端末のブラウザの中だけに保存されます。
// 登録番号は「人（事業者）」ごとに1つなので、同じ人が出すならサロン名でも同じ番号を使えます。
const DEFAULT_ISSUERS = [
  { id: 'issuer1', name: '', zip: '', address: '', tel: '', regNo: '' },
];

const TADASHI_CHOICES = ['お品代として', '商品代として', '施術代として', '体験料として'];
const PAYMENT_CHOICES = ['現金', '振込', 'カード', 'PayPay', ''];
// 8% は飲食料品（コラーゲンドリンクなど）、10% は化粧品・施術など
const TAX_RATES = [10, 8];

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function defaultDb() {
  return {
    settings: {
      issuers: DEFAULT_ISSUERS.map((x) => ({ ...x })),
      issuerId: DEFAULT_ISSUERS[0].id,
      nextNo: 1,
    },
    receipts: [],
    lastBackup: null, // 最後にバックアップを書き出した日時
    backupLog: [], // バックアップ・読み込みの履歴（新しい順、最大50件）
  };
}

function loadDb() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultDb();
    const db = JSON.parse(raw);
    const def = defaultDb();
    db.settings = { ...def.settings, ...(db.settings || {}) };
    if (!db.settings.issuers || !db.settings.issuers.length) db.settings.issuers = def.settings.issuers;
    db.receipts = db.receipts || [];
    db.backupLog = db.backupLog || [];
    if (db.lastBackup === undefined) db.lastBackup = null;
    return db;
  } catch (e) {
    console.warn('読み込み失敗', e);
    return defaultDb();
  }
}

// ---------- バックアップ（.json ファイル） ----------
// 発行元・番号・領収書の履歴をまるごと1つのファイルにします。バックアップの履歴自体は入れません。
const BACKUP_KIND = 'ryoshusho-backup';

function exportJson(db) {
  const { backupLog, lastBackup, ...rest } = db;
  return JSON.stringify({ kind: BACKUP_KIND, version: 1, exportedAt: new Date().toISOString(), db: rest }, null, 1);
}

// 読み込んだファイルを確かめて、アプリで使える形にする（おかしいときはエラー）
function importJson(text) {
  let d;
  try { d = JSON.parse(text); } catch (e) { throw new Error('ファイルの形がちがいます（領収書アプリのバックアップを選んでください）'); }
  if (!d || d.kind !== BACKUP_KIND || !d.db) throw new Error('領収書アプリのバックアップではありません');
  const src = d.db;
  if (!Array.isArray(src.receipts)) throw new Error('領収書のデータが見つかりません');
  const def = defaultDb();
  const settings = { ...def.settings, ...(src.settings || {}) };
  if (!Array.isArray(settings.issuers) || !settings.issuers.length) settings.issuers = def.settings.issuers;
  const receipts = src.receipts.filter((r) => r && r.id && Array.isArray(r.items));
  const maxNo = receipts.reduce((m, r) => Math.max(m, Number(r.no) || 0), 0);
  if (!(settings.nextNo > maxNo)) settings.nextNo = maxNo + 1;
  return { db: { ...def, settings, receipts }, exportedAt: d.exportedAt || null };
}

function receiptsTotal(list) { return list.reduce((sum, r) => sum + calcReceipt(r).total, 0); }

function addBackupLog(db, entry) {
  db.backupLog.unshift({ at: new Date().toISOString(), count: db.receipts.length, total: receiptsTotal(db.receipts), ...entry });
  db.backupLog = db.backupLog.slice(0, 50);
}

function saveDb(db) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); } catch (e) { alert('保存できませんでした（容量不足など）'); }
}

function blankReceipt(db) {
  return {
    id: null,
    no: null,
    date: todayStr(),
    recipient: '', // 宛名はふだん空欄
    tadashi: TADASHI_CHOICES[0],
    items: [{ name: '', qty: 1, price: 0, rate: 10 }],
    payment: '現金',
    issuerId: db.settings.issuerId,
    // ここから下は自分用のメモ（領収書には出ません）
    customer: '', // お客様の名前
    handedDate: todayStr(), // 領収書を渡した日
    handedPlace: '', // 渡した場所
    cashPlace: '', // 現金を受け取った場所
  };
}

// 金額はすべて税込。消費税は税率ごとに合計してから1回だけ計算（1円未満切り捨て）
// ＝インボイス（適格請求書）の端数処理のルールどおり
function calcReceipt(r) {
  const byRate = {};
  let total = 0;
  r.items.forEach((it) => {
    const amt = Math.round((Number(it.qty) || 0) * (Number(it.price) || 0));
    if (!amt) return;
    total += amt;
    byRate[it.rate] = (byRate[it.rate] || 0) + amt;
  });
  const taxes = TAX_RATES.filter((rate) => byRate[rate]).map((rate) => ({
    rate,
    amount: byRate[rate],
    tax: Math.floor(byRate[rate] * rate / (100 + rate)),
  }));
  return { total, taxes };
}

function yen(n) { return '¥' + Math.round(n).toLocaleString('ja-JP'); }
function handedOf(r) { return r.handedDate || r.date; }
function noLabel(no) { return no == null ? '' : String(no).padStart(4, '0'); }
function dateJa(s) {
  const [y, m, d] = s.split('-').map(Number);
  return y + '年' + m + '月' + d + '日';
}
