// =============================================================
// data.js … 銀行・カード・毎月の支払いの設定と、月ごとの記録の保存
// データはこのブラウザの localStorage にだけ保存されます。
// =============================================================

const STORAGE_KEY = 'shiharai-v1';

// 出入りの銀行（「⚙️ 設定」で追加・名前の変更・削除ができます）
const DEFAULT_ACCOUNTS = [
  { id: 'ja-kazuko', name: 'JA 和子' },
  { id: 'ja-kotaro', name: 'JA 浩太郎' },
  { id: 'hokuriku-kazuko', name: '北陸銀行 和子' },
  { id: 'hokuriku-kotaro', name: '北陸銀行 浩太郎' },
  { id: 'hokkoku-kotaro', name: '北國銀行 浩太郎' },
  { id: 'yucho-kazuko-private', name: 'ゆうちょ銀行 和子プライベート' },
  { id: 'yucho-kazuko-work', name: 'ゆうちょ銀行 和子仕事' },
];

// カード（引き落とし口座を決めておくと、支払いで選んだときに自動で入ります）
const DEFAULT_CARDS = [
  { id: 'aeon-kazuko', name: 'イオンカード 和子', accountId: '' },
  { id: 'rakuten-kazuko', name: '楽天カード 和子', accountId: '' },
];

// 毎月の支払い（ひな形）。新しい月を開くと、ここから今月の予定が作られます
const KINDS = ['家賃', 'カード', 'キャッシング', 'シナリー', 'その他'];
const DEFAULT_TEMPLATE = [
  { id: 't-shinary', day: 10, name: 'シナリー支払い', kind: 'シナリー', accountId: '', cardId: '', amount: 0 },
  { id: 't-rent-part', day: 25, name: '家賃（一部）', kind: '家賃', accountId: '', cardId: '', amount: 0 },
  { id: 't-card-aeon', day: 27, name: 'カード決済', kind: 'カード', accountId: '', cardId: 'aeon-kazuko', amount: 0 },
  { id: 't-card-rakuten', day: 27, name: 'カード決済', kind: 'カード', accountId: '', cardId: 'rakuten-kazuko', amount: 0 },
  { id: 't-rent', day: 27, name: '家賃', kind: '家賃', accountId: '', cardId: '', amount: 0 },
];

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function clone(o) { return JSON.parse(JSON.stringify(o)); }

function defaultDb() {
  return {
    accounts: clone(DEFAULT_ACCOUNTS),
    cards: clone(DEFAULT_CARDS),
    template: clone(DEFAULT_TEMPLATE),
    months: {}, // 'YYYY-MM' → { items: [支払い], balances: {口座id: 通帳の残高}, deposits: {口座id: 入金する額}, cashing: [その月にキャッシングした分] }
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

function normalizeDb(db) {
  const def = defaultDb();
  return {
    accounts: Array.isArray(db.accounts) ? db.accounts : def.accounts,
    cards: Array.isArray(db.cards) ? db.cards : def.cards,
    template: Array.isArray(db.template) ? db.template : def.template,
    months: db.months && typeof db.months === 'object' ? db.months : {},
  };
}

function saveDb(db) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); } catch (e) { alert('保存できませんでした（容量不足など）'); }
}

// ---------- 月 ----------
function addMonth(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
function monthJa(ym) {
  const [y, m] = ym.split('-').map(Number);
  return y + '年' + m + '月';
}
function daysInMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

// その月の記録を返す（まだなければひな形から作る）。
// 金額は前の月に入れた金額を引き継ぎます（家賃など毎月同じものは入れ直さなくてよい）。
function ensureMonth(db, ym) {
  if (db.months[ym]) return db.months[ym];
  const prev = db.months[addMonth(ym, -1)];
  const items = db.template.map((t) => {
    const before = prev && prev.items.find((it) => it.templateId === t.id);
    return {
      id: uid(),
      templateId: t.id,
      day: t.day,
      name: t.name,
      kind: t.kind,
      cardId: t.cardId || '',
      accountId: t.accountId || cardAccount(db, t.cardId) || '',
      amount: before ? before.amount : (Number(t.amount) || 0),
      paid: false,
    };
  });
  // 前の月に「キャッシングした」と記録した分を、今月の「前月からのキャッシング」として入れる
  if (prev && Array.isArray(prev.cashing)) {
    prev.cashing.filter((c) => Number(c.amount)).forEach((c) => items.push(cashingItem(db, c.cardId, c.amount, c.id)));
  }
  db.months[ym] = { items, balances: {}, deposits: {}, cashing: [] };
  return db.months[ym];
}

// 「前月からのキャッシング」の支払い（カードの引き落とし日 27日 に一緒に引き落とされる想定）
function cashingItem(db, cardId, amount, fromId) {
  const card = db.cards.find((x) => x.id === cardId);
  return {
    id: uid(), templateId: '', fromCashing: fromId || '',
    day: 27, name: '前月からのキャッシング', kind: 'キャッシング',
    cardId: cardId || '', accountId: card ? card.accountId : '',
    amount: Number(amount) || 0, paid: false,
  };
}

function cardAccount(db, cardId) {
  const c = db.cards.find((x) => x.id === cardId);
  return c ? c.accountId : '';
}

// 引き落とし日（土日なら翌月曜。祝日は考えていないので通帳で確認してください）
function payDate(ym, day) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1, Math.min(day, daysInMonth(ym)));
  const orig = d.getDay();
  if (orig === 6) d.setDate(d.getDate() + 2);
  if (orig === 0) d.setDate(d.getDate() + 1);
  return { date: d, shifted: orig === 0 || orig === 6 };
}
const WEEK = ['日', '月', '火', '水', '木', '金', '土'];
function weekdayOf(ym, day) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, Math.min(day, daysInMonth(ym))).getDay();
}

// 口座ごとの集計：通帳の残高 ＋ 入金する額 − 支払いの合計 ＝ 差額
function summarize(db, ym) {
  const mon = ensureMonth(db, ym);
  const rows = db.accounts.map((a) => {
    const items = mon.items.filter((it) => it.accountId === a.id);
    const need = items.filter((it) => !it.paid).reduce((s, it) => s + (Number(it.amount) || 0), 0);
    const balance = Number(mon.balances[a.id]) || 0;
    const deposit = Number(mon.deposits[a.id]) || 0;
    return { account: a, items, need, balance, deposit, diff: balance + deposit - need, hasBalance: mon.balances[a.id] != null && mon.balances[a.id] !== '' };
  });
  const unassigned = mon.items.filter((it) => !db.accounts.some((a) => a.id === it.accountId));
  const total = mon.items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const unpaid = mon.items.filter((it) => !it.paid).reduce((s, it) => s + (Number(it.amount) || 0), 0);
  return { rows, unassigned, total, unpaid };
}

function yen(n) { return '¥' + Math.round(Number(n) || 0).toLocaleString('ja-JP'); }
// 「12,000」「１２０００」なども数字として読めるように
function toNum(s) {
  const t = String(s == null ? '' : s).replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/[,，¥￥円\s]/g, '').replace(/[ー－−]/g, '-');
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n) : 0;
}
