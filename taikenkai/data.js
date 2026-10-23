// =============================================================
// data.js … データの保存・計算・バックアップ
// データはこの端末のブラウザ（localStorage）の中だけに保存します。
// =============================================================

const STORAGE_KEY = 'taikenkai-db-v1';

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// 単価は「単価計算」Excel の一回分の合計から
function defaultSettings() {
  return {
    members: [
      // rate：材料の単価の何％を返金するか
      { id: 'm_kura', name: '倉', rate: 50 },
      { id: 'm_shintani', name: '新谷由起美AD', rate: 80 },
      { id: 'm_tanaka', name: '田中博明AD', rate: 80 },
      { id: 'm_other', name: 'その他', rate: 80 },
    ],
    materials: [
      { id: 'mat_kiso', name: '基礎化粧品 一回分', price: 689 },
      { id: 'mat_newkiso', name: '新基礎化粧品 一回分', price: 719 },
      { id: 'mat_biyoeki', name: '美容液 一回分', price: 561 },
      { id: 'mat_found', name: '【下地ファンデーション一回分】', price: 436 },
      { id: 'mat_top', name: '【トップメイク一回分】', price: 410 },
      { id: 'mat_parfum', name: 'パルファン 1人分', price: 10 },
      { id: 'mat_aromapack', name: 'アロマパック 1回分', price: 100 },
      { id: 'mat_clay', name: '美肌クレイパック 1回分', price: 400 },
      { id: 'mat_thalasso', name: 'タラソパック 1回分', price: 500 },
    ],
    // チラシの体験メニュー（mats：そのメニューで使う材料。設定で変えられます）
    menus: withMenuMats([
      { id: 'mn_full', name: 'セルフ天然素材のスキンケア＆メイク体験（アロマパック付き）', price: 1000 },
      { id: 'mn_skin', name: 'セルフ天然素材のスキンケア体験', price: 500 },
      { id: 'mn_make', name: 'セルフナチュラルメイク体験', price: 500 },
      { id: 'mn_head', name: 'セルフヘッドケア', price: 300 },
      { id: 'mn_hand', name: 'ハンドケア', price: 500 },
      { id: 'mn_aroma', name: 'アロマ占い（20分）', price: 1000 },
      { id: 'mn_oral', name: 'セルフ口腔ケア', price: 300 },
      { id: 'mn_op1', name: 'オプション：アロマパック', price: 100 },
      { id: 'mn_op2', name: 'オプション：美肌クレイパック', price: 400 },
      { id: 'mn_op3', name: 'オプション：潤いシートパック', price: 500 },
      { id: 'mn_op4', name: 'オプション：タラソパック', price: 500 },
      { id: 'mn_st_full', name: '小中高生：スキンケア＆メイク体験（アロマパック付き）', price: 600 },
      { id: 'mn_st_skin', name: '小中高生：スキンケア体験', price: 300 },
      { id: 'mn_st_make', name: '小中高生：ナチュラルメイク体験', price: 300 },
      { id: 'mn_beauty', name: '美容体験（お茶とお菓子付き）', price: 500 },
      { id: 'mn_beauty_st', name: '美容体験（高校生以下）', price: 300 },
    ]),
    expenseItems: ['場所代', 'お茶・お菓子代', '印刷代', 'ブラシレンタル代', '消耗品（パフ・タオルなど）', '交通費'],
    // 駐車場代の補助：2000円以上で100円、3000円以上で300円
    parking: { t1: 2000, a1: 100, t2: 3000, a2: 300 },
    defaultVenue: '松雲堂',
    rev: 4,
  };
}

// メニューごとに使う材料（アロマ占い・ヘッドケアなどは材料を使わない）
const SKIN_MATS = ['mat_kiso', 'mat_biyoeki', 'mat_parfum'];
const MAKE_MATS = ['mat_found', 'mat_top', 'mat_parfum'];
const FULL_MATS = ['mat_kiso', 'mat_biyoeki', 'mat_found', 'mat_top', 'mat_parfum', 'mat_aromapack'];
const MENU_MATS = {
  mn_full: FULL_MATS,
  mn_skin: SKIN_MATS,
  mn_make: MAKE_MATS,
  mn_op1: ['mat_aromapack'],
  mn_op2: ['mat_clay'],
  mn_op4: ['mat_thalasso'],
  mn_st_full: FULL_MATS,
  mn_st_skin: SKIN_MATS,
  mn_st_make: MAKE_MATS,
  mn_beauty: SKIN_MATS,
  mn_beauty_st: SKIN_MATS,
};

function withMenuMats(menus) {
  return menus.map((m) => ({ ...m, mats: m.mats || [...(MENU_MATS[m.id] || [])] }));
}

function emptyDb() {
  return { version: 1, settings: defaultSettings(), events: [], lastBackup: null, createdAt: new Date().toISOString() };
}

function loadDb() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyDb();
    return normalizeDb(JSON.parse(raw));
  } catch (e) {
    return emptyDb();
  }
}

function normalizeDb(d) {
  const base = emptyDb();
  if (!d || typeof d !== 'object') return base;
  const s = Object.assign(base.settings, d.settings || {});
  s.parking = Object.assign(defaultSettings().parking, s.parking || {});
  // 前の版を使っていた人にも、あとから増えたメニューを足す
  if ((d.settings && d.settings.rev || 1) < 2) {
    if (!s.menus.some((m) => m.id === 'mn_hand')) {
      const i = s.menus.findIndex((m) => m.id === 'mn_head');
      s.menus.splice(i < 0 ? s.menus.length : i + 1, 0, { id: 'mn_hand', name: 'ハンドケア', price: 500 });
    }
    s.rev = 2;
  }
  // 返金の割合（倉は50％、ほかは80％）を足す
  if (s.rev < 3) {
    s.members.forEach((m) => { if (m.rate == null) m.rate = m.id === 'm_kura' ? 50 : 80; });
    s.rev = 3;
  }
  // パルファンを1人10円に、パック3種を材料に、メニューに使う材料を足す
  const upgrade4 = s.rev < 4;
  if (upgrade4) {
    s.materials = upgradeMaterials(s.materials);
    s.menus = withMenuMats(s.menus);
    s.rev = 4;
  }
  const events = Array.isArray(d.events) ? d.events.map((e) => {
    const ev = normalizeEvent(e, s);
    if (upgrade4) {
      ev.materials = upgradeMaterials(ev.materials);
      // 使用人数は参加者のメニューから自動で数える
      Object.values(ev.matUse).forEach((u) => { u.count = null; });
    }
    return ev;
  }) : [];
  return { version: 1, settings: s, events, lastBackup: d.lastBackup || null, createdAt: d.createdAt || base.createdAt };
}

function upgradeMaterials(list) {
  const out = list.map((m) => (m.id === 'mat_parfum' ? { ...m, name: 'パルファン 1人分', price: 10 } : m));
  defaultSettings().materials.forEach((m) => { if (!out.some((x) => x.id === m.id)) out.push({ ...m }); });
  return out;
}

function normalizeEvent(e, settings) {
  return {
    id: e.id || uid(),
    date: e.date || todayStr(),
    name: e.name || '体験会',
    kind: e.kind || '体験会',
    venue: e.venue || '',
    memo: e.memo || '',
    participants: (e.participants || []).map((p) => ({
      id: p.id || uid(),
      name: p.name || '',
      items: (p.items || []).map((it) => ({ menuId: it.menuId || '', name: it.name || '', price: num(it.price) })),
      extra: num(p.extra),
      extraNote: p.extraNote || '',
      parking: num(p.parking),
      memo: p.memo || '',
    })),
    materials: (e.materials || []).map((m) => ({ id: m.id || uid(), name: m.name || '', price: num(m.price) })),
    usage: e.usage && typeof e.usage === 'object' ? e.usage : {},
    // 材料ごとの使用人数と、誰の物を使ったか（mode）
    matUse: e.matUse && typeof e.matUse === 'object' ? e.matUse : legacyMatUse(e.usage),
    // 会ごとの返金の割合（作成時の設定を記録）
    rates: e.rates && typeof e.rates === 'object' ? e.rates : memberRates(settings),
    expenses: (e.expenses || []).map((x) => ({ id: x.id || uid(), name: x.name || '', amount: num(x.amount), paidBy: x.paidBy || '' })),
  };
}

function saveDb(d) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateLabel(s) {
  if (!s) return '';
  const [y, m, d] = s.split('-').map(Number);
  const w = WEEK[new Date(y, m - 1, d).getDay()];
  return `${y}年${m}月${d}日(${w})`;
}

const WEEK = '日月火水木金土';

// 2026/10/25(日) のような短い表示
function dateShort(s) {
  if (!s) return '';
  const [y, m, d] = s.split('-').map(Number);
  return `${y}/${m}/${d}(${WEEK[new Date(y, m - 1, d).getDay()]})`;
}

function yen(n) {
  return (n < 0 ? '−' : '') + Math.abs(Math.round(n)).toLocaleString('ja-JP') + '円';
}

// 以前の版で人ごとに回数を入れていた材料は「人ごとに入力」のまま残す
function legacyMatUse(usage) {
  const r = {};
  Object.keys(usage || {}).forEach((matId) => {
    if (Object.values(usage[matId] || {}).some((n) => num(n) > 0)) r[matId] = { count: 0, mode: 'manual' };
  });
  return r;
}

function memberRates(settings) {
  const r = {};
  (settings ? settings.members : []).forEach((m) => { r[m.id] = num(m.rate == null ? 100 : m.rate); });
  return r;
}

// 新しい会を作る（材料は設定からコピーするので、あとで単価を変えても過去の会は変わりません）
function newEvent(settings, opts) {
  return normalizeEvent({
    id: uid(),
    date: opts.date,
    name: opts.name,
    kind: opts.kind,
    venue: opts.venue,
    materials: settings.materials.map((m) => ({ ...m })),
    expenses: (opts.expenses || []).map((x) => ({ ...x, id: uid() })),
  }, settings);
}

function participantTotal(p) {
  return p.items.reduce((s, it) => s + it.price, 0) + p.extra;
}

function suggestParking(settings, total) {
  const r = settings.parking;
  if (r.t2 && total >= r.t2) return r.a2;
  if (r.t1 && total >= r.t1) return r.a1;
  return 0;
}

function usageCount(ev, matId, memberId) {
  return num(ev.usage[matId] && ev.usage[matId][memberId]);
}

function setUsage(ev, matId, memberId, n) {
  if (!ev.usage[matId]) ev.usage[matId] = {};
  ev.usage[matId][memberId] = Math.max(0, Math.floor(num(n)));
}

// その会での、その人への返金の割合（％）
function rateOf(ev, members, memberId) {
  if (ev.rates[memberId] != null) return num(ev.rates[memberId]);
  const m = members.find((x) => x.id === memberId);
  return m && m.rate != null ? num(m.rate) : 100;
}

// 1回分の返金額（1円未満は四捨五入）
function refundUnit(price, rate) {
  return Math.round(price * rate / 100);
}

// 誰の物を使ったか
//   kura   … 倉の物だけ
//   split  … 倉が半分、残りの半分を新谷・田中で割る
//   manual … 人ごとに回数を入力
const MAT_MODES = [
  { id: 'kura', label: '倉の物だけ', shares: { m_kura: 1 } },
  { id: 'split', label: '倉・新谷・田中で分ける', shares: { m_kura: 0.5, m_shintani: 0.25, m_tanaka: 0.25 } },
  { id: 'manual', label: '人ごとに入力' },
];

// count が null のときは参加者のメニューから自動で数える（手で直すと数字が入る）
function matUseOf(ev, matId) {
  if (!ev.matUse[matId]) ev.matUse[matId] = { count: null, mode: 'kura' };
  return ev.matUse[matId];
}

// 参加者が選んだメニュー（設定のメニュー表と ID か名前で照合）
function itemMenu(it, menus) {
  return menus.find((m) => (it.menuId && m.id === it.menuId)) || menus.find((m) => m.name === it.name);
}

// その材料を使うメニューを選んだ参加者の人数（1人で2つ選んでも1人と数える）
function autoCount(ev, matId, menus) {
  return ev.participants.filter((p) => p.items.some((it) => {
    const mn = itemMenu(it, menus);
    return mn && (mn.mats || []).includes(matId);
  })).length;
}

function useCount(ev, matId, menus) {
  const u = matUseOf(ev, matId);
  return u.count == null ? autoCount(ev, matId, menus) : num(u.count);
}

// 材料1つ分の、人ごとの返金（people は何人分か）
function materialShares(ev, m, members, menus) {
  const use = matUseOf(ev, m.id);
  if (use.mode === 'manual') {
    return Object.keys(ev.usage[m.id] || {}).map((mid) => {
      const n = usageCount(ev, m.id, mid);
      return { mid, people: n, amount: n * refundUnit(m.price, rateOf(ev, members, mid)) };
    }).filter((s) => s.people);
  }
  const shares = (MAT_MODES.find((x) => x.id === use.mode) || MAT_MODES[0]).shares;
  const count = useCount(ev, m.id, menus);
  if (!count) return [];
  return Object.keys(shares).map((mid) => {
    const people = count * shares[mid];
    return { mid, people, amount: Math.round(m.price * rateOf(ev, members, mid) / 100 * people) };
  });
}

// 1つの会の精算
function calcEvent(ev, members, menus) {
  const c = {
    people: ev.participants.length,
    sales: 0,
    parking: 0,
    material: 0,
    expense: 0,
    matByMember: {},
    expByMember: {},
    matRow: {},
    balance: 0,
  };
  ev.participants.forEach((p) => {
    c.sales += participantTotal(p);
    c.parking += p.parking;
  });
  ev.materials.forEach((m) => {
    const row = { count: 0, amount: 0, shares: materialShares(ev, m, members, menus) };
    row.shares.forEach((s) => {
      row.count += s.people;
      row.amount += s.amount;
      c.matByMember[s.mid] = (c.matByMember[s.mid] || 0) + s.amount;
    });
    c.matRow[m.id] = row;
    c.material += row.amount;
  });
  ev.expenses.forEach((x) => {
    c.expense += x.amount;
    if (x.paidBy) c.expByMember[x.paidBy] = (c.expByMember[x.paidBy] || 0) + x.amount;
  });
  c.balance = c.sales - c.parking - c.material - c.expense;
  return c;
}

// 返す相手ごとの金額（材料代＋立て替えた経費）
function payouts(c, members) {
  const ids = new Set([...members.map((m) => m.id), ...Object.keys(c.matByMember), ...Object.keys(c.expByMember)]);
  return [...ids].map((id) => ({
    id,
    mat: c.matByMember[id] || 0,
    exp: c.expByMember[id] || 0,
    total: (c.matByMember[id] || 0) + (c.expByMember[id] || 0),
  }));
}

// ---------- バックアップ ----------
function exportJson(d) {
  return JSON.stringify({ app: 'taikenkai', exportedAt: new Date().toISOString(), ...d }, null, 2);
}

function importJson(text) {
  const d = JSON.parse(text);
  if (!d || !Array.isArray(d.events) || !d.settings) throw new Error('体験会アプリのバックアップファイルではありません');
  return normalizeDb(d);
}

function csvCell(v) {
  const s = String(v == null ? '' : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// Excel で見る用の CSV（会ごとの精算と明細）
function exportCsv(d) {
  const members = d.settings.members;
  const mname = (id) => (members.find((m) => m.id === id) || {}).name || '（削除された人）';
  const rows = [];
  rows.push(['■ 会ごとの精算']);
  rows.push(['日付', '会の名前', '種類', '会場', '参加人数', '売上', '駐車場返金', '材料返金', '経費', '残高', ...members.map((m) => m.name + 'へ返金')]);
  const sorted = [...d.events].sort((a, b) => a.date.localeCompare(b.date));
  let cum = 0;
  sorted.forEach((ev) => {
    const c = calcEvent(ev, members, d.settings.menus);
    cum += c.balance;
    const po = payouts(c, members);
    rows.push([ev.date, ev.name, ev.kind, ev.venue, c.people, c.sales, c.parking, c.material, c.expense, c.balance,
      ...members.map((m) => (po.find((p) => p.id === m.id) || {}).total || 0)]);
  });
  rows.push(['', '', '', '', '累計残高', '', '', '', '', cum]);
  rows.push([]);
  rows.push(['■ 明細']);
  rows.push(['日付', '会の名前', '区分', '内容', '人', '数量', '単価', '金額']);
  sorted.forEach((ev) => {
    ev.participants.forEach((p) => {
      p.items.forEach((it) => rows.push([ev.date, ev.name, '売上', it.name, p.name, 1, it.price, it.price]));
      if (p.extra) rows.push([ev.date, ev.name, '売上', p.extraNote || 'その他', p.name, 1, p.extra, p.extra]);
      if (p.parking) rows.push([ev.date, ev.name, '駐車場返金', '駐車場代補助', p.name, 1, p.parking, -p.parking]);
    });
    ev.materials.forEach((m) => {
      materialShares(ev, m, members, d.settings.menus).forEach((s) => {
        const rate = rateOf(ev, members, s.mid);
        rows.push([ev.date, ev.name, '材料返金', `${m.name}（${m.price}円の${rate}%）`, mname(s.mid), s.people, refundUnit(m.price, rate), -s.amount]);
      });
    });
    ev.expenses.forEach((x) => rows.push([ev.date, ev.name, '経費', x.name, x.paidBy ? mname(x.paidBy) + '（立替）' : '', 1, x.amount, -x.amount]));
  });
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}
