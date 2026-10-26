// =============================================================
// app.js … 毎日のニュース（data/latest.json）を読み込んで画面に表示します。
// ニュースは毎朝、自動の作業で更新されます（kabu/UPDATE.md 参照）。
// 予算や表示の設定は、このスマホのブラウザの中（localStorage）だけに保存されます。
// =============================================================

// 毎日のデータは「kabu-data」ブランチに置かれ、ここから直接読み込みます。
// （アプリ本体を更新しなくても、ニュースだけ毎日新しくなる仕組み）
const REMOTE_BASE = 'https://raw.githubusercontent.com/positivemc32-u/collagen-inventory/kabu-data/kabu/data/';
const LOCAL_BASE = './data/';
const LS = { budget: 'kabu.budget', cache: 'kabu.cache', horizon: 'kabu.horizon' };
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
    <div class="headline">${esc(d.headline)}</div>
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
  const t = e.target.closest('button'); if (!t) return;
  if (t.closest('#tabbar')) { state.tab = t.dataset.tab; render(); window.scrollTo(0, 0); return; }
  if (t.id === 'budgetChip') { openBudgetSheet(); return; }
  if (t.id === 'dateChip') { openDateSheet(); return; }
  if (t.dataset.tabGo) { state.tab = t.dataset.tabGo; render(); window.scrollTo(0, 0); return; }
  if (t.dataset.budget) { setBudget(t.dataset.budget); return; }
  if (t.dataset.fill) { $('#budgetInput').value = t.dataset.fill; return; }
  if (t.dataset.horizon) { state.horizon = t.dataset.horizon; lsSet(LS.horizon, state.horizon); render(); return; }
  if (t.dataset.date) { closeSheet(); loadDate(t.dataset.date); return; }
  switch (t.dataset.act) {
    case 'budget': openBudgetSheet(); break;
    case 'saveBudget': if (setBudget($('#budgetInput').value)) closeSheet(); break;
    case 'close': closeSheet(); break;
    case 'latest': if (state.dates[0]) loadDate(state.dates[0]); break;
    case 'reload': init().then(() => toast('読み込み直しました')); break;
  }
});
$('#sheetBackdrop').addEventListener('click', closeSheet);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSheet();
  if (e.key === 'Enter' && e.target.id === 'budgetInput' && setBudget(e.target.value)) closeSheet();
});

async function init() {
  state.horizon = lsGet(LS.horizon, 'all');
  state.offline = false;
  await loadLatest();
  render();
}
init();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
