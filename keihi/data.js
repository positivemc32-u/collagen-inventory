// =============================================================
// data.js … 設定・レシートの保存（localStorage）と画像の保存（IndexedDB）
// データはこのブラウザの中にだけ保存されます。
// =============================================================

const STORAGE_KEY = 'keihi-v1';

// やよいの青色申告の標準の勘定科目（経費でよく使うもの）。「⚙️ 設定」で増やせます。
const DEFAULT_ACCOUNTS = [
  '消耗品費', '旅費交通費', '通信費', '荷造運賃', '会議費', '接待交際費', '新聞図書費',
  '水道光熱費', '広告宣伝費', '支払手数料', '租税公課', '修繕費', '福利厚生費', '地代家賃', '仕入高', '雑費',
];
// 支払い方法（弥生の「貸方勘定科目」になります）
// 個人のお財布・個人のカードで払った経費は「事業主借」
const DEFAULT_CREDITS = ['現金', '事業主借', '普通預金', '未払金'];

// 税率 → 弥生の税区分（税込で入力するので「内」）
const RATES = [
  { rate: 10, label: '10%', kbn: '課対仕入内10%' },
  { rate: 8, label: '8%（軽減）', kbn: '課対仕入内軽減8%' },
  { rate: 0, label: '対象外', kbn: '対象外' },
];

// 店名・レシートの文字から勘定科目を推測するための言葉（上から順に調べます）
const ACCOUNT_HINTS = [
  ['租税公課', ['収入印紙', '印紙']],
  ['荷造運賃', ['ヤマト運輸', '宅急便', '佐川', 'ゆうパック', 'ゆうパケット', '西濃', '福山通運', 'クロネコ']],
  ['通信費', ['郵便', '切手', 'レターパック', 'はがき', 'ドコモ', 'ソフトバンク', '楽天モバイル', 'ワイモバイル']],
  ['旅費交通費', ['JR', '鉄道', '駅', '乗車券', '特急', 'バス', 'タクシー', '交通', '駐車', 'パーキング', 'コインパーク', 'タイムズ', '高速', 'NEXCO', 'ETC', 'ガソリン', 'ENEOS', 'エネオス', '出光', 'コスモ石油', '石油', 'レギュラー', 'ハイオク', '軽油', 'ホテル', '旅館', '宿泊']],
  ['新聞図書費', ['書店', '書房', '本屋', 'ブックオフ', 'BOOKOFF', 'TSUTAYA', '蔦屋', '紀伊國屋', '紀伊国屋', '未来屋', '新聞']],
  ['会議費', ['カフェ', 'CAFE', 'Cafe', 'コーヒー', '珈琲', 'スターバックス', 'STARBUCKS', 'ドトール', 'コメダ', 'タリーズ', 'サンマルク', 'ミスタードーナツ']],
  ['接待交際費', ['居酒屋', '寿司', '焼肉', 'レストラン', '御祝', 'ご祝儀', '香典', '菓子折']],
  ['水道光熱費', ['電力', '水道局', '灯油']],
  ['支払手数料', ['手数料', '振込']],
  ['消耗品費', ['ダイソー', 'DAISO', 'セリア', 'キャンドゥ', '100円', 'ホームセンター', 'カインズ', 'コメリ', 'コーナン', 'DCM', 'ニトリ', '無印', 'ヨドバシ', 'ビックカメラ', 'ケーズ', 'ヤマダ', 'エディオン', '文具', 'ロフト', 'ドラッグ', 'ドラッグストア', 'クスリ', 'Amazon', 'アマゾン']],
];

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function pad2(n) { return String(n).padStart(2, '0'); }
function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}
function yen(n) { return '¥' + Math.round(Number(n) || 0).toLocaleString('ja-JP'); }

function defaultDb() {
  return {
    entries: [], // { id, date, store, regNo, memo, credit, lines:[{account, rate, amount}], hasImage, exportedAt, createdAt }
    storeMap: {}, // 店名 → 前に選んだ勘定科目（次から自動で選ばれます）
    settings: {
      accounts: DEFAULT_ACCOUNTS.slice(),
      credits: DEFAULT_CREDITS.slice(),
      defaultAccount: '消耗品費',
      defaultCredit: '現金',
      // 登録番号（T＋13けた）のないレシートに、経過措置の税区分（区80% / 区50%）を付けるか
      keika: false,
    },
  };
}

function loadDb() {
  const base = defaultDb();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const d = JSON.parse(raw);
    return { ...base, ...d, settings: { ...base.settings, ...(d.settings || {}) } };
  } catch (e) {
    return base;
  }
}
function saveDb(db) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    return true;
  } catch (e) {
    alert('保存できませんでした。ブラウザの容量がいっぱいかもしれません。');
    return false;
  }
}

function entryTotal(e) { return e.lines.reduce((s, l) => s + (Number(l.amount) || 0), 0); }

// 税区分（弥生に書き出す文字）
// 経過措置：登録番号のない（適格請求書でない）レシートは、2026年9月までは「区80%」、10月からは「区50%」
function taxKbn(rate, entry, settings) {
  const r = RATES.find((x) => x.rate === Number(rate)) || RATES[0];
  if (r.rate === 0 || !settings.keika || (entry.regNo || '').trim()) return r.kbn;
  return r.kbn + (entry.date >= '2026-10-01' ? '区50%' : '区80%');
}

function guessAccount(store, text, db) {
  const key = normStore(store);
  if (key && db.storeMap[key]) return db.storeMap[key];
  const hay = (store || '') + '\n' + (text || '');
  for (const [acc, words] of ACCOUNT_HINTS) {
    if (words.some((w) => hay.includes(w)) && db.settings.accounts.includes(acc)) return acc;
  }
  return db.settings.defaultAccount;
}
function normStore(s) { return String(s || '').replace(/\s+/g, '').trim(); }

// ---------- 画像（IndexedDB） ----------
// 写真は大きいので localStorage ではなく IndexedDB に入れます。
const imageStore = (() => {
  let dbp = null;
  function open() {
    if (!dbp) {
      dbp = new Promise((resolve, reject) => {
        const req = indexedDB.open('keihi-images', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('images');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbp;
  }
  async function run(mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('images', mode);
      const req = fn(tx.objectStore('images'));
      tx.oncomplete = () => resolve(req && req.result);
      tx.onerror = () => reject(tx.error);
    });
  }
  return {
    put: (id, blob) => run('readwrite', (s) => s.put(blob, id)),
    get: (id) => run('readonly', (s) => s.get(id)),
    del: (id) => run('readwrite', (s) => s.delete(id)),
    clear: () => run('readwrite', (s) => s.clear()),
  };
})();
