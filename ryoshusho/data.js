// =============================================================
// data.js … 発行元の情報・履歴の保存と、金額・消費税の計算
// データはこのブラウザの localStorage にだけ保存されます。
// =============================================================

const STORAGE_KEY = 'ryoshusho-v1';

// 発行元（領収書の右下に出る情報）。名前・住所・電話番号・登録番号は個人情報なので
// プログラムには書かず、各端末の「⚙️ 設定」で入れてもらいます（その端末の中にだけ保存）。
// 住所・電話番号・登録番号は全部の屋号で共通（business）。屋号はいくつでも登録でき、作成画面のプルダウンで選びます。
// 登録番号は「人（事業者）」ごとに1つなので、同じ人が出すなら屋号が違っても同じ番号を使えます。
// ⚠️ 名前・住所・電話・登録番号などの個人情報は、このファイルに書かないでください（GitHub で公開されています）。
const DEFAULT_ISSUERS = [
  { id: 'main', name: '', zip: '', address: '', tel: '' }, // zip・address・tel は空なら共通の情報を使う
];
const BUSINESS_FIELDS = ['zip', 'address', 'tel'];

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
      business: { zip: '', address: '', tel: '', regNo: '' },
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
    return normalizeDb(JSON.parse(raw));
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
  // 以前の「⚙️ 設定」のバックアップ（app: 'ryoshusho'）も読めるようにしておく
  if (!d || !(d.kind === BACKUP_KIND || d.app === 'ryoshusho') || !d.db) throw new Error('領収書アプリのバックアップではありません');
  const src = d.db;
  if (!Array.isArray(src.receipts)) throw new Error('領収書のデータが見つかりません');
  const receipts = src.receipts.filter((r) => r && r.id && Array.isArray(r.items));
  const db = normalizeDb({ settings: src.settings, receipts });
  db.backupLog = [];
  db.lastBackup = null;
  const maxNo = receipts.reduce((m, r) => Math.max(m, Number(r.no) || 0), 0);
  if (!(db.settings.nextNo > maxNo)) db.settings.nextNo = maxNo + 1;
  return { db, exportedAt: d.exportedAt || d.savedAt || null };
}

function receiptsTotal(list) { return list.reduce((sum, r) => sum + calcReceipt(r).total, 0); }

function addBackupLog(db, entry) {
  db.backupLog.unshift({ at: new Date().toISOString(), count: db.receipts.length, total: receiptsTotal(db.receipts), ...entry });
  db.backupLog = db.backupLog.slice(0, 50);
}

// 古い形（屋号ごとに住所・登録番号を持っていた）のデータも、いまの形にそろえる
function normalizeDb(db) {
  const def = defaultDb();
  const hadBusiness = !!(db.settings && db.settings.business);
  db.settings = { ...def.settings, ...(db.settings || {}) };
  const st = db.settings;
  if (!st.issuers || !st.issuers.length) st.issuers = def.settings.issuers;
  if (!hadBusiness) {
    const first = st.issuers[0];
    st.business = { zip: first.zip || '', address: first.address || '', tel: first.tel || '', regNo: first.regNo || '' };
  }
  st.issuers.forEach((x) => {
    BUSINESS_FIELDS.forEach((k) => { if (!x[k] || x[k] === st.business[k]) x[k] = ''; });
    delete x.regNo;
  });
  db.receipts = db.receipts || [];
  db.backupLog = db.backupLog || [];
  if (db.lastBackup === undefined) db.lastBackup = null;
  return db;
}

// 領収書に出す発行元の情報（屋号ごとの住所・電話番号がなければ共通のものを使う）
function issuerInfo(settings, id) {
  const x = settings.issuers.find((i) => i.id === id) || settings.issuers[0];
  const b = settings.business;
  return { id: x.id, name: x.name, zip: x.zip || b.zip, address: x.address || b.address, tel: x.tel || b.tel, regNo: b.regNo };
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
