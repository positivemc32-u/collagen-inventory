// =============================================================
// parse.js … 音声や文章から「項目・日にち・時間・くり返し」を読み取る
// 例：「明日の午後3時に歯医者」「毎週月曜の朝8時にゴミ出し」
//     「30分後に洗濯物」「10月1日から10月7日まで9時から17時まで1時間ごとに水を飲む」
// =============================================================

const PARSE_WEEK = { 日: 0, 月: 1, 火: 2, 水: 3, 木: 4, 金: 5, 土: 6 };
const KANJI_DIGIT = { 〇: 0, 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

function kanjiToNumber(s) {
  let total = 0, cur = 0;
  for (const ch of s) {
    if (ch === '百') { total += (cur || 1) * 100; cur = 0; }
    else if (ch === '十') { total += (cur || 1) * 10; cur = 0; }
    else cur = cur * 10 + KANJI_DIGIT[ch];
  }
  return total + cur;
}

// 全角数字・漢数字（単位の前だけ）を半角数字にそろえる
function normalizeJa(text) {
  return String(text)
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[：]/g, ':').replace(/[／]/g, '/').replace(/[　]/g, ' ')
    .replace(/([〇零一二三四五六七八九十百]+)(?=\s*(時|分|日|か月|ヶ月|カ月|ヵ月|月|週|秒))/g, (m) => String(kanjiToNumber(m)));
}

function pad2(n) { return String(n).padStart(2, '0'); }
function ymdOf(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function plusDays(d, n) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; }

// 「午後3時半」「夜9時」「15:30」などを {h, m} に。ampm: 'am' | 'pm' | null
function toHour(h, ampm) {
  if (ampm === 'pm' && h < 12) return h + 12;
  if (ampm === 'am' && h === 12) return 0;
  if (!ampm && h >= 1 && h <= 6) return h + 12; // 「3時」だけなら15時とみなす（多くの人の言い方に合わせる）
  return h;
}
const AMPM_WORDS = '(午前|午後|朝|昼|夕方|夕|夜|晩|深夜|AM|PM|am|pm)?';
function ampmOf(w) {
  if (!w) return null;
  if (/午前|朝|AM|am|深夜/.test(w)) return 'am';
  return 'pm';
}
const TIME_RE = new RegExp(AMPM_WORDS + '\\s*(\\d{1,2})(?:時(?:(\\d{1,2})分|(半))?|:(\\d{2}))');
function matchTime(s) {
  const m = s.match(TIME_RE);
  if (!m) return null;
  let h = Number(m[2]);
  if (h > 24) return null;
  const min = m[3] ? Number(m[3]) : m[4] ? 30 : m[5] ? Number(m[5]) : 0;
  if (min > 59) return null;
  const word = m[1];
  h = word === '深夜' && h === 12 ? 0 : (h === 24 ? 0 : toHour(h, ampmOf(word)));
  // 「夜12時」は 0時
  if (/夜|晩/.test(word || '') && Number(m[2]) === 12) h = 0;
  return { h, m: min, text: m[0], index: m.index };
}

function parseReminderText(input, nowMs) {
  const now = new Date(nowMs == null ? Date.now() : nowMs);
  let s = normalizeJa(input).trim();
  const found = []; // 読み取れた内容（画面に表示）
  const out = { title: '', date: null, time: null, repeat: null, custom: null, found };
  const take = (re) => {
    const m = s.match(re);
    if (m) s = (s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length)).trim();
    return m;
  };
  const setDT = (d) => { out.date = ymdOf(d); out.time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };

  // ---- くり返し ----
  let everyMin = null;
  let m;
  if ((m = take(/(\d+)\s*分\s*(?:ごと|おき|毎|置き|間隔)(?:に)?/))) everyMin = Number(m[1]);
  else if ((m = take(/(\d+)\s*時間\s*(?:ごと|おき|毎|置き|間隔)(?:に)?/))) everyMin = Number(m[1]) * 60;
  else if (take(/毎時(?:間)?/)) everyMin = 60;
  if (everyMin) found.push(`${everyMin >= 60 ? everyMin / 60 + '時間' : everyMin + '分'}ごと`);

  let weeklyDow = null, monthlyDay = null, daily = false;
  if ((m = take(/毎週\s*([日月火水木金土])曜(?:日)?/))) { weeklyDow = PARSE_WEEK[m[1]]; found.push(`毎週${m[1]}曜`); }
  else if (take(/毎週/)) { weeklyDow = -1; found.push('毎週'); }
  else if ((m = take(/毎月\s*(\d{1,2})\s*日/))) { monthlyDay = Number(m[1]); found.push(`毎月${monthlyDay}日`); }
  else if (take(/毎月/)) { monthlyDay = -1; found.push('毎月'); }
  else if ((m = take(/毎(日|朝|晩|夜)/))) { daily = true; found.push('毎日'); if (m[1] !== '日') s = m[1] + s; }

  // ---- 期間（◯日から◯日まで）----
  let range = null;
  const dayTok = '(?:(\\d{1,2})\\s*月\\s*)?(\\d{1,2})\\s*日';
  if ((m = take(new RegExp(dayTok + '\\s*(?:から|～|〜|-)\\s*' + dayTok + '\\s*(?:まで)?')))) {
    const today0 = plusDays(now, 0);
    const mk = (mo, d, ref) => {
      const base = ref || now;
      let y = base.getFullYear(), mon = mo ? Number(mo) - 1 : base.getMonth();
      let x = new Date(y, mon, Number(d));
      if (x < (ref || today0)) x = mo ? new Date(y + 1, mon, Number(d)) : new Date(y, mon + 1, Number(d));
      return x;
    };
    const from = mk(m[1], m[2]);
    const to = mk(m[3], m[4], from);
    range = { from: ymdOf(from), to: ymdOf(to) };
    found.push(`${from.getMonth() + 1}/${from.getDate()}〜${to.getMonth() + 1}/${to.getDate()}`);
  } else if ((m = take(/(今日|明日)\s*から\s*(\d+)\s*日間/))) {
    const from = plusDays(now, m[1] === '明日' ? 1 : 0);
    range = { from: ymdOf(from), to: ymdOf(plusDays(from, Number(m[2]) - 1)) };
    found.push(`${m[1]}から${m[2]}日間`);
  }

  // ---- 時間帯（◯時から◯時まで）----
  let tRange = null;
  const tTok = AMPM_WORDS + '\\s*\\d{1,2}(?:時(?:\\d{1,2}分|半)?|:\\d{2})';
  if ((m = take(new RegExp('(' + tTok + ')\\s*(?:から|～|〜|-)\\s*(' + tTok + ')\\s*(?:まで)?(?:の間)?')))) {
    const a = matchTime(m[1]);
    let b = matchTime(m[3]);
    // 「午後1時から5時まで」→ 後ろも午後
    if (a && b && !m[4] && m[2] && b.h < a.h && b.h + 12 < 24) b = { ...b, h: b.h + 12 };
    if (a && b) {
      tRange = { from: `${pad2(a.h)}:${pad2(a.m)}`, to: `${pad2(b.h)}:${pad2(b.m)}` };
      found.push(`${tRange.from}〜${tRange.to}`);
    }
  }

  // ---- ◯分後・◯時間後・◯日後 ----
  let rel = null;
  if ((m = take(/(?=\d)(?:(\d+)\s*時間)?\s*(?:(\d+)\s*分|(半))?\s*後(?:に)?/)) && (m[1] || m[2] || m[3])) {
    const mins = (Number(m[1]) || 0) * 60 + (m[2] ? Number(m[2]) : m[3] ? 30 : 0);
    rel = new Date(now.getTime() + mins * 60000);
    found.push(`${mins >= 60 ? Math.floor(mins / 60) + '時間' : ''}${mins % 60 ? (mins % 60) + '分' : ''}後`);
  }

  // ---- 日にち ----
  let day = null;
  if ((m = take(/(今日|きょう|本日)/))) day = plusDays(now, 0);
  else if ((m = take(/(明後日|あさって)/))) day = plusDays(now, 2);
  else if ((m = take(/(明々後日|しあさって)/))) day = plusDays(now, 3);
  else if ((m = take(/(明日|あした|あす)/))) day = plusDays(now, 1);
  else if ((m = take(/(\d+)\s*日\s*後/))) day = plusDays(now, Number(m[1]));
  else if ((m = take(/(\d+)\s*週間\s*後/))) day = plusDays(now, Number(m[1]) * 7);
  else if ((m = take(/(再来週|来週|今週)\s*(?:の)?\s*([日月火水木金土])曜(?:日)?/))) {
    const add = { 今週: 0, 来週: 7, 再来週: 14 }[m[1]];
    const mondayIdx = (now.getDay() + 6) % 7; // 月曜=0
    const target = (PARSE_WEEK[m[2]] + 6) % 7;
    day = plusDays(now, add - mondayIdx + target);
  } else if ((m = take(/(再来週|来週)/))) day = plusDays(now, m[1] === '来週' ? 7 : 14);
  else if ((m = take(/(?:次の|今度の)?\s*([日月火水木金土])曜(?:日)?/))) {
    const diff = (PARSE_WEEK[m[1]] - now.getDay() + 7) % 7;
    day = plusDays(now, diff);
    if (diff === 0) day = { weekdayToday: true, d: day };
  } else if ((m = take(/(?:(\d{4})\s*年\s*)?(\d{1,2})\s*月\s*(\d{1,2})\s*日/)) || (m = take(/(?:(\d{4})\/)?(\d{1,2})\/(\d{1,2})/))) {
    const y = m[1] ? Number(m[1]) : now.getFullYear();
    day = new Date(y, Number(m[2]) - 1, Number(m[3]));
    if (!m[1] && day < plusDays(now, 0)) day = new Date(y + 1, Number(m[2]) - 1, Number(m[3]));
  } else if ((m = take(/(来月|今月)\s*(?:の)?\s*(\d{1,2})\s*日/))) {
    day = new Date(now.getFullYear(), now.getMonth() + (m[1] === '来月' ? 1 : 0), Number(m[2]));
  } else if ((m = take(/(?:^|[^\d])(\d{1,2})\s*日(?!間)/))) {
    day = new Date(now.getFullYear(), now.getMonth(), Number(m[1]));
    if (day < plusDays(now, 0)) day = new Date(now.getFullYear(), now.getMonth() + 1, Number(m[1]));
  }

  // ---- 時刻 ----
  let time = null;
  const tm = matchTime(s);
  if (tm) {
    s = (s.slice(0, tm.index) + ' ' + s.slice(tm.index + tm.text.length)).trim();
    time = tm;
  } else if ((m = take(/(正午|お昼)/))) time = { h: 12, m: 0 };
  else if ((m = take(/^(朝|夜|晩|夕方)|(?:の|に)(朝|夜|晩|夕方)/))) {
    const w = m[1] || m[2];
    time = { 朝: { h: 8, m: 0 }, 夕方: { h: 17, m: 0 } }[w] || { h: 20, m: 0 };
  }

  // ---- まとめ ----
  if (rel) setDT(rel);
  if (day && day.weekdayToday) {
    // 「月曜」と言った日が今日：時刻が過ぎていれば来週
    const d = day.d;
    day = d;
    if (time && new Date(d.getFullYear(), d.getMonth(), d.getDate(), time.h, time.m) <= now) day = plusDays(d, 7);
  }
  if (day) {
    out.date = ymdOf(day);
    found.push(`${day.getMonth() + 1}/${day.getDate()}`);
  }
  if (time) {
    out.time = `${pad2(time.h)}:${pad2(time.m)}`;
    found.push(out.time);
    if (!out.date) {
      // 日にちを言わなかったら、今日（過ぎていれば明日）
      const t = new Date(now.getFullYear(), now.getMonth(), now.getDate(), time.h, time.m);
      out.date = ymdOf(t > now ? t : plusDays(t, 1));
    }
  }
  if (out.date && !out.time) out.time = '09:00';

  if (weeklyDow != null) {
    out.repeat = '1w';
    if (weeklyDow >= 0) {
      const diff = (weeklyDow - now.getDay() + 7) % 7;
      let d = plusDays(now, diff);
      const t = out.time ? out.time.split(':').map(Number) : [9, 0];
      if (new Date(d.getFullYear(), d.getMonth(), d.getDate(), t[0], t[1]) <= now) d = plusDays(d, 7);
      out.date = ymdOf(d);
      out.time = out.time || '09:00';
    }
  } else if (monthlyDay != null) {
    out.repeat = '1M';
    if (monthlyDay > 0) {
      let d = new Date(now.getFullYear(), now.getMonth(), monthlyDay);
      const t = out.time ? out.time.split(':').map(Number) : [9, 0];
      if (new Date(d.getFullYear(), d.getMonth(), d.getDate(), t[0], t[1]) <= now) d = new Date(now.getFullYear(), now.getMonth() + 1, monthlyDay);
      out.date = ymdOf(d);
      out.time = out.time || '09:00';
    }
  } else if (daily) out.repeat = '1d';

  if (range || tRange) {
    // 期間か時間帯を言ったら「カスタム」
    const from = range ? range.from : out.date || ymdOf(now);
    out.repeat = 'custom';
    out.custom = {
      from,
      to: range ? range.to : '',
      tFrom: tRange ? tRange.from : out.time || '09:00',
      tTo: tRange ? tRange.to : out.time || '09:00',
      every: everyMin || (tRange ? 60 : 1440),
    };
  } else if (everyMin) {
    const map = { 5: '5m', 10: '10m', 30: '30m', 60: '1h' };
    if (map[everyMin]) out.repeat = map[everyMin];
    else {
      const start = out.date ? out.date : ymdOf(now);
      const st = out.time || `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
      out.repeat = 'custom';
      out.custom = { from: start, to: '', tFrom: st, tTo: '23:59', every: everyMin };
    }
    if (!out.date) { const d = new Date(now.getTime() + everyMin * 60000); setDT(d); }
  } else if (out.repeat === '1d' && !out.date) {
    const t = out.time ? out.time.split(':').map(Number) : [9, 0];
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), t[0], t[1]);
    out.date = ymdOf(d > now ? d : plusDays(d, 1));
    out.time = out.time || '09:00';
  }

  // ---- 残った言葉が「項目」 ----
  out.title = s
    .replace(/(って|と)?\s*(リマインド|リマインダー|通知|お知らせ|知らせ|教え|思い出させ|アラーム)(して|てね|て|する|を)?(ください|下さい|ね|お願い(します)?)?\s*[。．.!！]?$/, '')
    .replace(/(を|の)?(予定|こと)?(を)?(入れて|登録して|セットして|設定して)(ください|下さい)?$/, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s、。,.のにでをはと]+/, '')
    .replace(/[\s、。,.のにでをはと]+$/, '')
    .replace(/(って|ってこと)$/, '')
    .trim();
  return out;
}

if (typeof module !== 'undefined') module.exports = { parseReminderText, normalizeJa, kanjiToNumber };
