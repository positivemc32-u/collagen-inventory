// =============================================================
// data.js … 発行元の情報・履歴の保存と、金額・消費税の計算
// データはこのブラウザの localStorage にだけ保存されます。
// =============================================================

const STORAGE_KEY = 'ryoshusho-v1';

// 発行元（領収書の右下に出る情報）。「⚙️ 設定」で変更・追加できます。
// 登録番号は「人（事業者）」ごとに1つなので、同じ人が出すならサロン名でも同じ番号を使えます。
const DEFAULT_ISSUERS = [
  {
    id: 'kurage',
    name: 'シナリーくらげ営業所',
    zip: '922-0134',
    address: '石川県加賀市山中温泉荒谷町ヌ116',
    tel: '080-5093-2579',
    regNo: 'T5810440696021',
  },
  {
    id: 'kagmian',
    name: 'kagmian',
    zip: '922-0134',
    address: '石川県加賀市山中温泉荒谷町ヌ116',
    tel: '080-5093-2579',
    regNo: 'T5810440696021',
  },
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
    return db;
  } catch (e) {
    console.warn('読み込み失敗', e);
    return defaultDb();
  }
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
