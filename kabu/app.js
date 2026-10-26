// =============================================================
// app.js … 毎日のニュース（data/latest.json）を読み込んで画面に表示します。
// ニュースは毎朝、自動の作業で更新されます（kabu/UPDATE.md 参照）。
// 予算や表示の設定は、このスマホのブラウザの中（localStorage）だけに保存されます。
// =============================================================

// 毎日のデータは「kabu-data」ブランチに置かれ、ここから直接読み込みます。
// （アプリ本体を更新しなくても、ニュースだけ毎日新しくなる仕組み）
const REMOTE_BASE = 'https://raw.githubusercontent.com/positivemc32-u/collagen-inventory/kabu-data/kabu/data/';
const LOCAL_BASE = './data/';
const LS = { budget: 'kabu.budget', cache: 'kabu.cache', horizon: 'kabu.horizon', voice: 'kabu.voice' };
const DEFAULT_BUDGET = 50000;
const BUDGET_PRESETS = [10000, 30000, 50000, 100000, 300000];
const TITLES = { today: '今日のまとめ', picks: '買うなら？', calendar: '日程・配当', stories: '企業の裏話', settings: '設定' };
const HORIZON = { long: '長期向き', short: '短期向き', both: '長期・短期' };

const state = { tab: 'today', data: null, base: LOCAL_BASE, dates: [], viewing: null, horizon: 'all' };

// ---------- 保存（ブラウザの中だけ） ----------
function lsGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* 保存できない環境でも表示は続ける */ }
}
function getBudget() {
  const b = Number(lsGet(LS.budget, DEFAULT_BUDGET));
  return Number.isFinite(b) && b > 0 ? b : DEFAULT_BUDGET;
}

// ---------- 小さな道具 ----------
const $ = (sel) => document.querySelector(sel);
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const yen = (n) => '¥' + Math.round(n).toLocaleString('ja-JP');
const WD = ['日', '月', '火', '水', '木', '金', '土'];
function parseDate(s) { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); }
function mdw(s) { const d = parseDate(s); return `${d.getMonth() + 1}/${d.getDate()}(${WD[d.getDay()]})`; }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function daysBetween(a, b) { return Math.round((parseDate(b) - parseDate(a)) / 86400000); }
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => { t.hidden = true; }, 2200);
}

// ---------- 読み込み ----------
async function fetchJson(url) {
  const res = await fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now(), { cache: 'no-store' });
  if (!res.ok) throw new Error(res.status);
  return res.json();
}

// 自動更新のデータとアプリに入っているデータのうち、新しい方を使う
async function loadLatest() {
  const tries = await Promise.allSettled([fetchJson(REMOTE_BASE + 'latest.json'), fetchJson(LOCAL_BASE + 'latest.json')]);
  const remote = tries[0].status === 'fulfilled' ? tries[0].value : null;
  const local = tries[1].status === 'fulfilled' ? tries[1].value : null;
  let data = null; let base = LOCAL_BASE;
  if (remote && (!local || remote.date >= local.date)) { data = remote; base = REMOTE_BASE; } else if (local) { data = local; }
  if (data) {
    lsSet(LS.cache, { data, base });
  } else {
    const cached = lsGet(LS.cache, null);
    if (cached) { data = cached.data; base = cached.base; state.offline = true; }
  }
  state.data = data; state.base = base; state.viewing = data ? data.date : null;
  try { const idx = await fetchJson(base + 'index.json'); state.dates = (idx.dates || []).slice().sort().reverse(); } catch { state.dates = data ? [data.date] : []; }
}

async function loadDate(date) {
  try {
    const d = await fetchJson(state.base + 'archive/' + date + '.json');
    state.data = d; state.viewing = date; render(); window.scrollTo(0, 0);
  } catch { toast('その日のデータを読み込めませんでした'); }
}

// ---------- 予算に対して買えるか ----------
function fitFor(p, budget) {
  if (p.kind === 'watch') return { cls: 'watch', text: '👀 今は買わずにニュースで見守る銘柄' };
  if (p.kind === 'fund') return { cls: 'ok', text: `✅ ${p.priceText || '100円から'}買えます。予算${yen(budget)}なら毎月少しずつ積み立てもOK` };
  const lot = p.price * (p.unit || 100);
  if (lot <= budget) {
    const lots = Math.floor(budget / lot);
    return { cls: 'ok', text: `✅ 100株＝約${yen(lot)}で予算内（残り約${yen(budget - lot)}）${lots >= 2 ? `。最大${lots * (p.unit || 100)}株まで` : ''}` };
  }
  if (p.oddLot) {
    const n = Math.floor(budget / p.price);
    if (n < 1) return { cls: 'no', text: `❌ 1株でも約${yen(p.price)}。予算を増やすと買えます` };
    return { cls: 'odd', text: `🟡 100株だと約${yen(lot)}で予算オーバー → 1株ずつ買えるサービスなら最大${n}株（約${yen(n * p.price)}）` };
  }
  return { cls: 'no', text: `❌ 100株で約${yen(lot)}。予算オーバーです` };
}

// ---------- 画面 ----------
function render() {
  const d = state.data;
  $('#pageTitle').textContent = TITLES[state.tab];
  $('#budgetChip').textContent = yen(getBudget()) + ' ✎';
  document.querySelectorAll('#tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === state.tab));
  const chip = $('#dateChip');
  if (d) {
    chip.textContent = mdw(d.date) + ' ▾';
    chip.classList.toggle('old', d.date !== (state.dates[0] || d.date));
    const at = d.updatedAt ? new Date(d.updatedAt) : null;
    $('#updatedAt').textContent = at && !isNaN(at) ? `更新 ${at.getMonth() + 1}/${at.getDate()} ${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}` : '';
  }
  renderNotices();
  const main = $('#main');
  if (!d) { main.innerHTML = '<p class="loading">ニュースを読み込めませんでした。電波のよい所でもう一度開いてください。</p>'; return; }
  main.innerHTML = ({ today: viewToday, picks: viewPicks, calendar: viewCalendar, stories: viewStories, settings: viewSettings })[state.tab]();
  syncPlayer();
}

function renderNotices() {
  const n = [];
  const d = state.data;
  if (state.offline) n.push('📴 電波がないため、前に読み込んだニュースを表示しています。');
  if (d && state.viewing === state.dates[0]) {
    const age = daysBetween(d.date, todayStr());
    if (age >= 2) n.push(`⏳ 最新のニュースが${age}日前（${mdw(d.date)}）のままです。自動更新が止まっているかもしれません。`);
  }
  if (d && state.dates.length && state.viewing !== state.dates[0]) {
    n.push(`🗂 過去のニュース（${mdw(d.date)}）を表示中です。 <button type="button" class="chip" data-act="latest">最新に戻る</button>`);
  }
  $('#notices').innerHTML = n.map((t) => `<div class="notice">${t}</div>`).join('');
}

const disclaimer = () => `<p class="disclaimer">※ この内容はニュースをもとにした勉強用のメモで、「必ず儲かる」ものではありません。株価は目安で、実際の値段は証券会社の画面で確認してください。買う・売るの最終判断はご自身で。余裕資金で、少しずつがおすすめです。</p>`;

function eventRows(list) {
  const today = todayStr();
  return list.map((e) => {
    const cls = e.date === today ? 'today' : e.date < today ? 'past' : '';
    return `<div class="ev ${cls}">
      <div class="ev-date">${esc(mdw(e.date))}${e.time ? `<small>${esc(e.time)}</small>` : ''}</div>
      <div><span class="badge t-${esc(e.type)}">${esc(e.type)}</span> <span class="ev-title">${esc(e.title)}</span>
      <div class="ev-why">${esc(e.why)}</div></div></div>`;
  }).join('');
}

function viewToday() {
  const d = state.data; const m = d.market || {};
  const base = d.date;
  const week = (d.events || []).filter((e) => { const k = daysBetween(base, e.date); return k >= 0 && k <= 7; });
  return `
    ${newsVisual(d)}
    <section class="panel">
      <h2>📈 市場の動き</h2>
      <p>${esc(m.summary)}</p>
      <div class="idx-grid">${(m.indices || []).map((i) => `
        <div class="idx ${esc(i.dir)}"><div class="n">${esc(i.name)}</div><div class="v">${esc(i.value)}</div>
        <div class="c">${i.dir === 'up' ? '▲' : i.dir === 'down' ? '▼' : '−'} ${esc(i.change)}</div><div class="note">${esc(i.note)}</div></div>`).join('')}
      </div>
      ${(m.points || []).length ? `<h3>💬 つまりどういうこと？</h3><ul class="points">${m.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
      <p class="small muted">▲は上がった、▼は下がったという意味です。</p>
    </section>
    <section class="panel">
      <h2>📅 これから1週間の大事な予定</h2>
      ${week.length ? eventRows(week) : '<p class="muted">大きな予定はありません。</p>'}
      <button type="button" class="btn block" data-tab-go="calendar">もっと先の予定・配当を見る</button>
    </section>
    <button type="button" class="btn primary block" data-tab-go="picks">💡 予算${esc(yen(getBudget()))}で買うなら？</button>
    ${d.lesson ? `<div class="lesson"><b>📘 ${esc(d.lesson.title)}</b>${esc(d.lesson.body)}</div>` : ''}
    ${disclaimer()}`;
}

function viewPicks() {
  const d = state.data; const budget = getBudget();
  const picks = (d.picks || []).filter((p) => state.horizon === 'all' || p.horizon === state.horizon || p.horizon === 'both');
  const plan = d.plan;
  return `
    <section class="panel">
      <h2>💰 ${esc(plan ? plan.title : '予算の分け方')}（予算${esc(yen(budget))}）</h2>
      ${plan ? plan.parts.map((p) => `
        <div class="plan-row"><span>${esc(p.label)}</span><span class="plan-amt">約${esc(yen(budget * p.ratio))}</span>
        <div class="plan-bar ${p.horizon === 'short' ? 'short' : ''}"><span style="width:${Math.round(p.ratio * 100)}%"></span></div></div>`).join('') : ''}
      ${plan && plan.note ? `<p class="small">${esc(plan.note)}</p>` : ''}
      <div class="chips">${BUDGET_PRESETS.map((b) => `<button type="button" class="chip ${b === budget ? 'on' : ''}" data-budget="${b}">${b / 10000}万円</button>`).join('')}
        <button type="button" class="chip" data-act="budget">金額を入力</button></div>
    </section>
    <div class="chips">
      ${[['all', 'ぜんぶ'], ['long', '🌳 長期向き'], ['short', '⚡ 短期向き']].map(([k, l]) => `<button type="button" class="chip ${state.horizon === k ? 'on' : ''}" data-horizon="${k}">${l}</button>`).join('')}
    </div>
    <p class="small muted">🌳 長期＝何年も持って、配当や成長を待つ　⚡ 短期＝数日〜数週間の値動きをねらう（初心者は少額で）</p>
    <div class="picks">${picks.map((p) => pickCard(p, budget)).join('') || '<p class="muted">該当する銘柄はありません。</p>'}</div>
    ${disclaimer()}`;
}

function pickCard(p, budget) {
  const f = fitFor(p, budget);
  const hz = p.kind === 'watch' ? '<span class="badge b-watch">見るだけ</span>' : `<span class="badge ${p.horizon === 'short' ? 'b-short' : 'b-long'}">${esc(HORIZON[p.horizon] || '')}</span>`;
  const price = p.kind === 'stock' && p.price ? `株価の目安 <b>${esc(yen(p.price))}</b>/1株${p.priceDate ? `（${esc(p.priceDate)}）` : ''}` : esc(p.priceText || '');
  return `<article class="pick">
    <div class="pick-head">${hz}${p.tag ? `<span class="badge b-tag">${esc(p.tag)}</span>` : ''}<span class="pick-code">${esc(p.code)}</span></div>
    <div class="pick-name">${esc(p.name)}</div>
    <div class="pick-price">${price}</div>
    <div class="fit ${f.cls}">${esc(f.text)}</div>
    <div class="kv"><b>理由</b>${esc(p.reason)}</div>
    <div class="kv risk"><b>注意</b>${esc(p.risk)}</div>
    ${p.dividend ? `<div class="kv"><b>配当</b>${esc(p.dividend)}</div>` : ''}
    ${p.howTo ? `<div class="kv"><b>買い方</b>${esc(p.howTo)}</div>` : ''}
  </article>`;
}

function viewCalendar() {
  const d = state.data;
  const events = (d.events || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  return `
    <section class="panel">
      <h2>📅 決算・金利などの予定</h2>
      <p class="small muted">決算＝会社の成績発表。予想より良いと株価が上がり、悪いと下がりやすい日です。</p>
      ${eventRows(events)}
    </section>
    <section class="panel">
      <h2>🎁 配当・株主優待の権利日</h2>
      <p class="small muted">「権利付き最終日」の取引終了まで株を持っていると、配当や優待をもらう権利がもらえます。次の日に売っても権利は残ります（ただし株価は配当分くらい下がりやすい）。</p>
      ${(d.dividends || []).map((x) => `
        <div class="ev"><div class="ev-date">${esc(mdw(x.lastDay))}<small>までに買う</small></div>
        <div><span class="ev-title">${esc(x.name)}</span> <span class="pick-code">${esc(x.code)}</span>
        <div class="ev-why">${esc(x.content)}</div>${x.note ? `<div class="ev-why">💡 ${esc(x.note)}</div>` : ''}</div></div>`).join('') || '<p class="muted">近い権利日はありません。</p>'}
    </section>
    ${disclaimer()}`;
}

function viewStories() {
  const d = state.data;
  return `
    ${(d.stories || []).map((s) => `<article class="story"><span class="badge b-tag">${esc(s.tag)}</span>
      <div class="story-title">${esc(s.title)}</div><div class="story-body">${esc(s.body)}</div></article>`).join('')}
    ${(d.sources || []).length ? `<section class="panel"><h2>🔗 今日の情報のもと</h2><ul class="sources">${d.sources.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a></li>`).join('')}</ul></section>` : ''}`;
}

function viewSettings() {
  const budget = getBudget();
  return `
    <section class="panel">
      <h2>💰 予算</h2>
      <p>今の予算：<b>${esc(yen(budget))}</b></p>
      <div class="chips">${BUDGET_PRESETS.map((b) => `<button type="button" class="chip ${b === budget ? 'on' : ''}" data-budget="${b}">${b / 10000}万円</button>`).join('')}</div>
      <button type="button" class="btn block" data-act="budget">好きな金額を入力する</button>
      <p class="small muted">予算はこのスマホの中だけに保存されます。銘柄の画面で「何株買えるか」の計算に使います。</p>
    </section>
    ${voiceSettings()}
    <section class="panel">
      <h2>🗂 過去のニュース</h2>
      <div class="date-list">${state.dates.map((dt) => `<button type="button" class="chip ${dt === state.viewing ? 'on' : ''}" data-date="${dt}">${esc(mdw(dt))}</button>`).join('') || '<p class="muted">まだありません。</p>'}</div>
    </section>
    <section class="panel">
      <h2>ℹ️ このアプリについて</h2>
      <p class="small">ニュースは毎朝（日本時間8時ごろ）自動で更新されます。最新にならない時は、アプリを閉じて開き直してください。</p>
      <p class="small">初めて株を買うなら：ネット証券（SBI証券・楽天証券など）で口座と「新NISA」を開くと、利益に税金がかからず、1株や100円から買えます。</p>
      <button type="button" class="btn block" data-act="reload">🔄 ニュースを読み込み直す</button>
    </section>`;
}

// ---------- ニュース画像（クラゲのキャスター＋テロップ） ----------
function tickerText(d) {
  const idx = (d.market?.indices || []).map((i) => `${i.name} ${i.value}（${i.dir === 'up' ? '▲' : i.dir === 'down' ? '▼' : ''}${i.change}）`);
  return [d.headline, ...idx].join('　｜　');
}
function newsVisual(d) {
  const t = esc(tickerText(d));
  return `<section class="newsvis" role="button" tabindex="0" aria-label="タップで今日のニュースを読み上げ">
    <div class="nv-top"><span class="nv-live">● NEWS</span><span>${esc(mdw(d.date))}のニュース</span><span class="nv-hint">タップで読み上げ ▶</span></div>
    <div class="nv-stage">
      <div class="nv-caster">${jellySVG(92, 'nv-jelly')}<div class="nv-desk"></div></div>
      <div class="nv-caption" id="nvCaption">${esc(d.headline)}</div>
    </div>
    <div class="nv-telop"><span class="nv-label" id="nvLabel">速報</span>
      <div class="nv-window"><div class="nv-track" id="nvTrack"><span>${t}</span><span aria-hidden="true">${t}</span></div>
      <div class="nv-now" id="nvNow" hidden></div></div></div>
  </section>`;
}

// ---------- 読み上げ ----------
function spokenDate(s) { const d = parseDate(s); return `${d.getMonth() + 1}月${d.getDate()}日、${WD[d.getDay()]}曜日`; }
function spokenTime(t) { return String(t || '').replace(/(\d{1,2}):(\d{2})/g, (_, h, m) => (m === '00' ? `${h}時` : `${h}時${Number(m)}分`)); }
function spokenChange(i) {
  const c = String(i.change || '');
  if (/^-/.test(c)) return `前より${c.slice(1)}下がりました`;
  if (/^\+/.test(c)) return `前より${c.slice(1)}上がりました`;
  return c;
}
const noEmoji = (s) => String(s).replace(/^[^\p{L}\p{N}]+/u, '');

// 今の画面の内容を、読み上げ用の文章にする
function buildScript(tab) {
  const d = state.data; if (!d) return [];
  const items = []; const add = (section, text) => { if (text) items.push({ section, text: String(text).replace(/([^。！？!?])$/, '$1。') }); };
  if (tab === 'today' || tab === 'settings') {
    add('今日のひと言', `${spokenDate(d.date)}のニュースです。${d.headline}`);
    add('市場の動き', d.market?.summary);
    (d.market?.indices || []).forEach((i) => add('市場の動き', `${i.name}は${i.value}。${spokenChange(i)}`));
    (d.market?.points || []).forEach((p) => add('つまり', p));
    const week = (d.events || []).filter((e) => { const k = daysBetween(d.date, e.date); return k >= 0 && k <= 7; });
    if (week.length) add('1週間の予定', 'これから1週間の大事な予定です');
    week.forEach((e) => add('1週間の予定', `${spokenDate(e.date)}${e.time ? '、' + spokenTime(e.time) : ''}。${e.title}。${e.why}`));
    if (d.lesson) add('今日の用語', `${d.lesson.title}。${d.lesson.body}`);
  } else if (tab === 'picks') {
    const budget = getBudget();
    add('買うなら', `予算${budget.toLocaleString('ja-JP')}円で買うなら、のアイデアです。${d.plan?.note || ''}`);
    (d.picks || []).filter((p) => state.horizon === 'all' || p.horizon === state.horizon || p.horizon === 'both').forEach((p) => {
      add(p.name, `${p.name}。${p.kind === 'watch' ? '見るだけの銘柄' : HORIZON[p.horizon]}です。${noEmoji(fitFor(p, budget).text)}`);
      add(p.name, `理由。${p.reason}`);
      add(p.name, `注意。${p.risk}`);
    });
    add('おわり', '最終判断はご自身でお願いします');
  } else if (tab === 'calendar') {
    (d.events || []).slice().sort((a, b) => a.date.localeCompare(b.date))
      .forEach((e) => add('予定', `${spokenDate(e.date)}${e.time ? '、' + spokenTime(e.time) : ''}。${e.title}。${e.why}`));
    (d.dividends || []).forEach((x) => add('配当・優待', `${x.name}。${spokenDate(x.lastDay)}までに買うと、${x.content}。${x.note || ''}`));
  } else if (tab === 'stories') {
    (d.stories || []).forEach((s) => add(s.tag, `${s.title}。${s.body}`));
  }
  return items;
}

const TAB_NAMES = { today: '今日のまとめ', picks: '銘柄', calendar: '日程', stories: '裏話', settings: '今日のまとめ' };
function startReading(tab) {
  const items = buildScript(tab);
  if (!items.length) { toast('読み上げる内容がありません'); return; }
  state.readingTab = tab;
  Speaker.play(items);
  if (!Speaker.supported() && !Speaker.settings.muted) toast('このブラウザは音声に対応していないため、テロップだけ流します');
}
function togglePlay() {
  if (Speaker.state === 'playing') Speaker.pause();
  else if (Speaker.state === 'paused') Speaker.resume();
  else startReading(state.tab);
}

function showLine(line, i, n) {
  $('#playerLine').textContent = `${TAB_NAMES[state.readingTab] || ''}（${i + 1}/${n}） ${line.telop}`;
  const now = $('#nvNow');
  if (now) {
    now.hidden = false; now.textContent = line.telop;
    now.classList.remove('pop'); void now.offsetWidth; now.classList.add('pop');
    $('#nvTrack').hidden = true;
    $('#nvLabel').textContent = line.section || '読み上げ中';
  }
}

function syncPlayer() {
  const st = Speaker.state; const s = Speaker.settings;
  $('#plPlay').textContent = st === 'playing' ? '⏸' : '▶';
  $('#plPlay').setAttribute('aria-label', st === 'playing' ? '一時停止' : '読み上げ');
  $('#plMute').textContent = s.muted ? '🔇' : '🔊';
  $('#plMute').classList.toggle('on', s.muted);
  $('#plRate').textContent = `${s.rate}倍`;
  $('#plVoice').textContent = s.gender === 'male' ? '👨 男性' : '👩 女性';
  document.body.classList.toggle('speaking', st === 'playing');
  if (st === 'stopped') {
    $('#playerLine').textContent = '▶ を押すと、この画面のニュースを読み上げます';
    const now = $('#nvNow'); if (now) { now.hidden = true; $('#nvTrack').hidden = false; $('#nvLabel').textContent = '速報'; }
  } else if (Speaker.lines[Speaker.index]) {
    showLine(Speaker.lines[Speaker.index], Speaker.index, Speaker.lines.length);
  }
}

function saveVoice() { lsSet(LS.voice, Speaker.settings); }

function setupPlayer() {
  $('#plPlay').addEventListener('click', togglePlay);
  $('#plStop').addEventListener('click', () => Speaker.stop());
  $('#plMute').addEventListener('click', () => {
    Speaker.setMuted(!Speaker.settings.muted); saveVoice(); syncPlayer();
    toast(Speaker.settings.muted ? 'ミュートにしました（テロップだけ流れます）' : '音を出します');
    if (state.tab === 'settings') render();
  });
  $('#plRate').addEventListener('click', () => {
    const i = RATES.indexOf(Speaker.settings.rate);
    Speaker.setRate(RATES[(i + 1) % RATES.length]); saveVoice(); syncPlayer();
    if (state.tab === 'settings') render();
  });
  $('#plVoice').addEventListener('click', () => {
    Speaker.setGender(Speaker.settings.gender === 'male' ? 'female' : 'male'); saveVoice(); syncPlayer();
    toast(`${VOICES[Speaker.settings.gender].label}の声にしました`);
    if (state.tab === 'settings') render();
  });
  // 画面を切り替えたら読み上げは止める
  document.getElementById('tabbar').addEventListener('click', () => { if (Speaker.state !== 'stopped') Speaker.stop(); }, true);
}

function voiceSettings() {
  const s = Speaker.settings;
  const opts = (g) => {
    const list = Speaker.jaVoices;
    return `<option value="">おまかせ</option>` + list.map((v) => `<option value="${esc(v.voiceURI)}" ${s.voiceURI[g] === v.voiceURI ? 'selected' : ''}>${esc(v.name)}</option>`).join('');
  };
  const note = !Speaker.supported() ? 'このブラウザは音声の読み上げに対応していません（テロップだけ流れます）。'
    : !Speaker.jaVoices.length ? '日本語の声が見つかりません。端末の設定で日本語の読み上げ音声を追加してください。'
    : Speaker.hasMale() ? '' : 'この端末には男性の声がないため、男性を選ぶと声を低くして読みます。';
  return `<section class="panel">
      <h2>🔊 読み上げ</h2>
      <h3>声の種類</h3>
      <div class="chips">
        <button type="button" class="chip ${s.gender === 'male' ? 'on' : ''}" data-gender="male">👨 落ち着いた男性</button>
        <button type="button" class="chip ${s.gender === 'female' ? 'on' : ''}" data-gender="female">👩 落ち着いた女性</button>
      </div>
      <h3>読む速さ</h3>
      <div class="chips">${RATES.map((r) => `<button type="button" class="chip ${s.rate === r ? 'on' : ''}" data-rate="${r}">${r}倍</button>`).join('')}</div>
      <h3>音</h3>
      <div class="chips">
        <button type="button" class="chip ${!s.muted ? 'on' : ''}" data-act="unmute">🔊 音を出す</button>
        <button type="button" class="chip ${s.muted ? 'on' : ''}" data-act="mute">🔇 ミュート（テロップだけ）</button>
      </div>
      ${Speaker.jaVoices.length ? `<details class="voice-detail"><summary>端末の声をくわしく選ぶ</summary>
        <label class="small muted">男性に使う声</label><select data-voice="male">${opts('male')}</select>
        <label class="small muted">女性に使う声</label><select data-voice="female">${opts('female')}</select></details>` : ''}
      ${note ? `<p class="small muted">${esc(note)}</p>` : ''}
      <button type="button" class="btn block" data-act="testVoice">🔈 試しに聞く</button>
    </section>`;
}
document.addEventListener('change', (e) => {
  const g = e.target.dataset && e.target.dataset.voice;
  if (g) { Speaker.setVoice(g, e.target.value); saveVoice(); }
});

// ---------- シート（下から出る画面） ----------
function openSheet(html) {
  $('#sheetBody').innerHTML = html; $('#sheet').hidden = false; $('#sheetBackdrop').hidden = false; document.body.classList.add('sheet-open');
}
function closeSheet() { $('#sheet').hidden = true; $('#sheetBackdrop').hidden = true; document.body.classList.remove('sheet-open'); }

function openBudgetSheet() {
  openSheet(`<h2>💰 予算を決める</h2>
    <label for="budgetInput" class="small muted">いくらから始めますか？（円）</label>
    <input id="budgetInput" type="number" inputmode="numeric" min="1000" step="1000" value="${getBudget()}">
    <div class="chips">${BUDGET_PRESETS.map((b) => `<button type="button" class="chip" data-fill="${b}">${b / 10000}万円</button>`).join('')}</div>
    <div class="sheet-actions"><button type="button" class="btn" data-act="close">やめる</button><button type="button" class="btn primary" data-act="saveBudget">決定</button></div>`);
  setTimeout(() => $('#budgetInput')?.focus(), 50);
}

function openDateSheet() {
  openSheet(`<h2>🗂 どの日のニュースを見る？</h2>
    <div class="date-list">${state.dates.map((dt) => `<button type="button" class="chip ${dt === state.viewing ? 'on' : ''}" data-date="${dt}">${esc(mdw(dt))}</button>`).join('')}</div>
    <div class="sheet-actions"><button type="button" class="btn" data-act="close">閉じる</button></div>`);
}

function setBudget(v) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < 1000) { toast('1,000円以上で入力してください'); return false; }
  lsSet(LS.budget, n); toast(`予算を${yen(n)}にしました`); render(); return true;
}

// ---------- ボタンの動き ----------
document.addEventListener('click', (e) => {
  if (e.target.closest('.newsvis')) { if (Speaker.state === 'stopped') startReading('today'); else togglePlay(); return; }
  const t = e.target.closest('button'); if (!t) return;
  if (t.closest('#tabbar')) { state.tab = t.dataset.tab; render(); window.scrollTo(0, 0); return; }
  if (t.id === 'budgetChip') { openBudgetSheet(); return; }
  if (t.id === 'dateChip') { openDateSheet(); return; }
  if (t.dataset.tabGo) { state.tab = t.dataset.tabGo; render(); window.scrollTo(0, 0); return; }
  if (t.dataset.budget) { setBudget(t.dataset.budget); return; }
  if (t.dataset.fill) { $('#budgetInput').value = t.dataset.fill; return; }
  if (t.dataset.horizon) { state.horizon = t.dataset.horizon; lsSet(LS.horizon, state.horizon); render(); return; }
  if (t.dataset.date) { closeSheet(); loadDate(t.dataset.date); return; }
  if (t.dataset.gender) { Speaker.setGender(t.dataset.gender); saveVoice(); render(); return; }
  if (t.dataset.rate) { Speaker.setRate(Number(t.dataset.rate)); saveVoice(); render(); return; }
  switch (t.dataset.act) {
    case 'budget': openBudgetSheet(); break;
    case 'saveBudget': if (setBudget($('#budgetInput').value)) closeSheet(); break;
    case 'close': closeSheet(); break;
    case 'mute': Speaker.setMuted(true); saveVoice(); render(); break;
    case 'unmute': Speaker.setMuted(false); saveVoice(); render(); break;
    case 'latest': if (state.dates[0]) loadDate(state.dates[0]); break;
    case 'reload': init().then(() => toast('読み込み直しました')); break;
    case 'testVoice': state.readingTab = null; Speaker.play([{ text: `こんにちは。${VOICES[Speaker.settings.gender].label}の声で、ニュースを読み上げます。` }]); break;
  }
});
$('#sheetBackdrop').addEventListener('click', closeSheet);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSheet();
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('newsvis')) { e.preventDefault(); e.target.click(); }
  if (e.key === 'Enter' && e.target.id === 'budgetInput' && setBudget(e.target.value)) closeSheet();
});

async function init() {
  state.horizon = lsGet(LS.horizon, 'all');
  Speaker.stop();
  state.offline = false;
  await loadLatest();
  render();
}
Speaker.init(lsGet(LS.voice, null));
Speaker.onLine = (line, i, n) => showLine(line, i, n);
Speaker.onState = () => syncPlayer();
Peek.extraLine = () => (state.data && state.data.lesson ? state.data.lesson.title.replace(/^今日の用語：/, '今日の用語は') + 'だよ' : '');
setupPlayer();
Peek.init();
init();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
