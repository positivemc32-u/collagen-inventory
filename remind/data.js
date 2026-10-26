// =============================================================
// data.js … リマインダーの保存・次に鳴らす時刻の計算・カレンダー用ファイル
// =============================================================
// データはこの端末のブラウザ（localStorage）の中だけに保存されます。

const STORAGE_KEY = 'remind-v1';

// 色分け（名前は設定で変えられます）
const COLORS = [
  { id: 'red', hex: '#e5484d', name: '赤' },
  { id: 'orange', hex: '#f08c2e', name: 'オレンジ' },
  { id: 'yellow', hex: '#e2b714', name: '黄' },
  { id: 'green', hex: '#3e9b5f', name: '緑' },
  { id: 'blue', hex: '#3a7bd5', name: '青' },
  { id: 'purple', hex: '#8e5bd0', name: '紫' },
  { id: 'pink', hex: '#e0609e', name: 'ピンク' },
  { id: 'gray', hex: '#7d8590', name: 'グレー' },
];

// くり返し（「カスタム」は期間・時間帯・間隔を自分で決める）
const REPEATS = [
  { id: 'none', label: 'なし' },
  { id: '5m', label: '5分ごと', min: 5 },
  { id: '10m', label: '10分ごと', min: 10 },
  { id: '30m', label: '30分ごと', min: 30 },
  { id: '1h', label: '1時間ごと', min: 60 },
  { id: '1d', label: '毎日' },
  { id: '1w', label: '毎週' },
  { id: '1M', label: '毎月' },
  { id: 'custom', label: 'カスタム' },
];
// カスタムの「間隔」
const CUSTOM_EVERY = [
  { min: 5, label: '5分ごと' },
  { min: 10, label: '10分ごと' },
  { min: 15, label: '15分ごと' },
  { min: 30, label: '30分ごと' },
  { min: 60, label: '1時間ごと' },
  { min: 120, label: '2時間ごと' },
  { min: 180, label: '3時間ごと' },
  { min: 1440, label: '1日1回' },
];
const SNOOZES = [5, 10, 30, 60];

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const WEEK_JA = ['日', '月', '火', '水', '木', '金', '土'];

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function pad(n) { return String(n).padStart(2, '0'); }
function ymd(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function hm(d) { return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function todayStr() { return ymd(new Date()); }
// 'YYYY-MM-DD' と 'HH:MM' から、その端末の時刻での Date を作る
function toDate(dateStr, timeStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = (timeStr || '00:00').split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
// 月を足す（31日 → 翌月が30日までなら30日に）
function addMonthsKeepDay(base, n) {
  const y = base.getFullYear(), m = base.getMonth() + n;
  const day = Math.min(base.getDate(), daysInMonth(y, m));
  return new Date(y, m, day, base.getHours(), base.getMinutes());
}
function minutesOf(timeStr) { const [h, m] = timeStr.split(':').map(Number); return h * 60 + m; }

// ---------- 保存 ----------
function defaultDb() {
  return {
    reminders: [],
    settings: {
      sound: true, // 鳴ったときに音も出す
      colorNames: {}, // { red: '仕事', ... }
    },
  };
}
function loadDb() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultDb();
    const db = JSON.parse(raw);
    const base = defaultDb();
    return { ...base, ...db, settings: { ...base.settings, ...(db.settings || {}) }, reminders: Array.isArray(db.reminders) ? db.reminders : [] };
  } catch (e) {
    return defaultDb();
  }
}
function saveDb(db) { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); }

// 新しいリマインダーのひな形（時刻は「次のちょうどいい時刻」）
function blankReminder() {
  const d = new Date(Date.now() + 60 * MIN);
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
  return {
    id: null,
    title: '',
    color: 'blue',
    vibrate: true, // 基本はバイブあり
    date: ymd(d),
    time: hm(d),
    repeat: 'none',
    custom: { from: ymd(d), to: ymd(addDays(d, 6)), tFrom: '09:00', tTo: '18:00', every: 60 },
    next: null, // 次に鳴らす時刻（ミリ秒）
    snoozeAt: null, // 「◯分後にもう一度」の時刻
    done: false,
    doneAt: null,
    lastFired: null,
    createdAt: null,
  };
}

// ---------- 次に鳴らす時刻 ----------
// after（ミリ秒）より後で、いちばん早い時刻を返す。もう無ければ null
function occurrenceAfter(r, after) {
  if (r.repeat === 'custom') return customAfter(r.custom, after);
  const base = toDate(r.date, r.time);
  const t0 = base.getTime();
  if (t0 > after) return t0;
  const rep = REPEATS.find((x) => x.id === r.repeat);
  if (!rep || r.repeat === 'none') return null;
  if (rep.min) {
    const step = rep.min * MIN;
    return t0 + (Math.floor((after - t0) / step) + 1) * step;
  }
  if (r.repeat === '1d' || r.repeat === '1w') {
    const stepDays = r.repeat === '1d' ? 1 : 7;
    let k = Math.max(0, Math.floor((after - t0) / (stepDays * DAY)) - 1);
    let d = addDays(base, k * stepDays);
    while (d.getTime() <= after) { k++; d = addDays(base, k * stepDays); }
    return d.getTime();
  }
  if (r.repeat === '1M') {
    let k = Math.max(0, Math.floor((after - t0) / (28 * DAY)) - 2);
    let d = addMonthsKeepDay(base, k);
    while (d.getTime() <= after) { k++; d = addMonthsKeepDay(base, k); }
    return d.getTime();
  }
  return null;
}

// カスタム：from〜to の毎日、tFrom〜tTo の間を every 分ごと（every=1440 は tFrom に1日1回）
function customAfter(c, after) {
  if (!c || !c.from) return null;
  const start = toDate(c.from, '00:00');
  const end = c.to ? toDate(c.to, '00:00') : null;
  const a = new Date(after);
  let day = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  if (day < start) day = start;
  const f = minutesOf(c.tFrom);
  const t = c.every >= 1440 ? f : Math.max(f, minutesOf(c.tTo || c.tFrom));
  const every = Math.max(1, Number(c.every) || 60);
  for (let i = 0; i < 800; i++) {
    if (end && day > end) return null;
    for (let m = f; m <= t; m += every >= 1440 ? 1440 : every) {
      const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(m / 60), m % 60).getTime();
      if (at > after) return at;
    }
    day = addDays(day, 1);
  }
  return null;
}

// いつ鳴るか（スヌーズがあればそちらが先）
function dueOf(r) {
  const xs = [r.next, r.snoozeAt].filter((x) => x != null);
  return xs.length ? Math.min(...xs) : null;
}

// これから最大 n 回分の時刻（カレンダー書き出し・確認表示用）
function upcoming(r, n, from) {
  const out = [];
  let t = from == null ? Date.now() - 1 : from;
  for (let i = 0; i < n; i++) {
    const x = occurrenceAfter(r, t);
    if (x == null) break;
    out.push(x);
    t = x;
  }
  return out;
}

// ---------- 表示用 ----------
function repeatLabel(r) {
  if (r.repeat === 'custom') {
    const c = r.custom;
    const ev = CUSTOM_EVERY.find((x) => x.min === Number(c.every));
    const range = `${mdJa(c.from)}〜${c.to ? mdJa(c.to) : ''}`;
    if (Number(c.every) >= 1440) return `${range} 毎日${c.tFrom}`;
    return `${range} ${c.tFrom}〜${c.tTo} ${ev ? ev.label : c.every + '分ごと'}`;
  }
  const rep = REPEATS.find((x) => x.id === r.repeat);
  if (!rep || r.repeat === 'none') return '';
  if (r.repeat === '1w') return `毎週${WEEK_JA[toDate(r.date).getDay()]}曜`;
  if (r.repeat === '1M') return `毎月${Number(r.date.slice(8))}日`;
  return rep.label;
}
function mdJa(dateStr) {
  if (!dateStr) return '';
  const d = toDate(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEK_JA[d.getDay()]})`;
}
function whenJa(ms) {
  const d = new Date(ms);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - today) / DAY);
  const day = diff === 0 ? '今日' : diff === 1 ? '明日' : diff === 2 ? 'あさって' : `${d.getMonth() + 1}/${d.getDate()}(${WEEK_JA[d.getDay()]})`;
  const year = d.getFullYear() !== today.getFullYear() ? `${d.getFullYear()}年 ` : '';
  return `${year}${day} ${hm(d)}`;
}
function untilJa(ms) {
  const m = Math.round((ms - Date.now()) / MIN);
  if (m < 0) return `${fmtSpan(-m)}前`;
  if (m === 0) return 'まもなく';
  return `あと${fmtSpan(m)}`;
}
function fmtSpan(m) {
  if (m < 60) return `${m}分`;
  if (m < 1440) return `${Math.floor(m / 60)}時間${m % 60 ? (m % 60) + '分' : ''}`;
  return `${Math.floor(m / 1440)}日`;
}

// ---------- カレンダー（.ics）書き出し ----------
// 携帯のカレンダーに入れると、アプリを閉じていても携帯が確実に知らせてくれます
function icsStamp(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}
function icsEscape(s) { return String(s).replace(/\\/g, '\\\\').replace(/[,;]/g, (c) => '\\' + c).replace(/\n/g, '\\n'); }
function buildIcs(r) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//remind//JA', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  const ev = (startMs, uidSuffix, rrule) => {
    lines.push('BEGIN:VEVENT', `UID:${r.id || uid()}-${uidSuffix}@remind`, `DTSTAMP:${icsStamp(Date.now())}`,
      `DTSTART:${icsStamp(startMs)}`, `DTEND:${icsStamp(startMs + 5 * MIN)}`, `SUMMARY:${icsEscape(r.title || 'リマインダー')}`);
    if (rrule) lines.push(`RRULE:${rrule}`);
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(r.title || 'リマインダー')}`, 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT');
  };
  const simple = { '1d': 'FREQ=DAILY', '1w': 'FREQ=WEEKLY', '1M': 'FREQ=MONTHLY' }[r.repeat];
  const custEnd = r.custom && r.custom.to ? `;UNTIL=${icsStamp(toDate(r.custom.to, '23:59').getTime())}` : '';
  if (r.repeat === 'none') {
    const t = r.next || toDate(r.date, r.time).getTime();
    ev(t, '0');
  } else if (simple) {
    ev(toDate(r.date, r.time).getTime(), '0', simple);
  } else if (r.repeat === 'custom' && Number(r.custom.every) >= 1440) {
    ev(toDate(r.custom.from, r.custom.tFrom).getTime(), '0', 'FREQ=DAILY' + custEnd);
  } else {
    // 分・時間ごとは、カレンダーによって扱えないので1回ずつの予定にする（最大200回）
    upcoming(r, 200).forEach((t, i) => ev(t, String(i)));
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

if (typeof module !== 'undefined') {
  module.exports = { COLORS, REPEATS, CUSTOM_EVERY, occurrenceAfter, customAfter, upcoming, toDate, ymd, hm, repeatLabel, buildIcs, blankReminder, addMonthsKeepDay };
}
