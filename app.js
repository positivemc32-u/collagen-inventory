// =============================================================
// app.js … 画面の表示とボタン操作
// =============================================================

let db = loadDb();
const state = {
  tab: 'list',
  ym: ymOf(),
  query: '',
  filter: 'all',
  custQuery: '',
  showPaused: true,
  allYm: 'all', // 一覧画面の年月（'all' はすべての月）
  allQuery: '',
  allFilter: 'all',
};

const $ = (sel) => document.querySelector(sel);
const main = $('#main');

// HTML に文字を入れるときの安全対策（< > などを無害化）
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function options(list, selected) {
  return list.map((v) => `<option value="${esc(v)}"${v === selected ? ' selected' : ''}>${esc(v)}</option>`).join('');
}
function flavorBadge(f, qty) {
  const cls = f === 'ザクロ' ? 'zakuro' : 'yuzu';
  return `<span class="badge ${cls}">${esc(f)}${qty != null ? ' × ' + esc(qty) : ''}</span>`;
}
// 味ごとの個数バッジ（0個の味は出さない）
function qtyBadges(q) {
  const out = FLAVORS.filter((f) => q && q[f] > 0).map((f) => flavorBadge(f, q[f]));
  return out.length ? out.join('') : '<span class="badge danger">個数未入力</span>';
}
// ザクロ・ゆずの個数入力欄（顧客登録と記録の詳細で共通）
function qtyFields(q, labelPrefix) {
  return `<div class="row2">${FLAVORS.map((f) => `
    <div class="field"><label>${labelPrefix}${f}（個）</label>
      <input type="number" name="qty_${f}" min="0" inputmode="numeric" value="${esc(q[f])}"></div>`).join('')}
  </div>`;
}
function readQty(formData) {
  const q = {};
  FLAVORS.forEach((f) => { q[f] = Math.max(0, Math.floor(Number(formData.get('qty_' + f))) || 0); });
  return q;
}
function persist() { saveDb(db); }

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.hidden = true; }, 2200);
}

// ---------- 全体の描画 ----------
const TITLES = { list: '発送リスト', all: '全記録の一覧', customers: '顧客', stock: '在庫', backup: 'バックアップ' };

// 上部に大きく表示する年月
function renderMonthHeader() {
  const label = $('#monthLabel');
  const hint = $('#monthHint');
  if (state.tab === 'all') {
    label.textContent = state.allYm === 'all' ? '全期間' : ymLabel(state.allYm);
    hint.textContent = state.allYm === 'all' ? '◀ ▶ で月を選べます' : '年月を押すと全期間に戻ります';
  } else {
    label.textContent = ymLabel(state.ym);
    hint.textContent = state.ym === ymOf() ? '今月' : '年月を押すと今月に戻ります';
  }
  label.classList.toggle('other', state.tab === 'all' ? state.allYm !== 'all' : state.ym !== ymOf());
}

function render() {
  $('#pageTitle').textContent = TITLES[state.tab];
  renderMonthHeader();
  document.querySelectorAll('.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === state.tab));
  renderNotices();
  if (state.tab === 'list') renderList();
  else if (state.tab === 'all') renderAll();
  else if (state.tab === 'customers') renderCustomers();
  else if (state.tab === 'stock') renderStock();
  else renderBackup();
}

function renderNotices() {
  const box = $('#notices');
  let html = '';
  if (needsBackupReminder(db) && state.tab !== 'backup') {
    const d = backupDaysAgo(db);
    const msg = d === null ? 'まだ一度もバックアップしていません。' : `最後のバックアップから${d}日たっています。`;
    html += `<div class="notice warn"><span>💾</span><div class="notice-body"><b>バックアップしましょう</b>${msg}
      <div><button class="btn small" data-action="go-backup">バックアップ画面へ</button></div></div></div>`;
  }
  if (state.tab === 'list' || state.tab === 'stock') {
    const s = calcStock(db, state.ym);
    FLAVORS.forEach((f) => {
      if (s[f].shortage > 0) {
        html += `<div class="notice danger"><span>⚠️</span><div class="notice-body"><b>${esc(f)}味の在庫が足りません</b>
          未対応の発送予定 ${s[f].pending}個 に対し、在庫は ${s[f].remaining}個 です（${s[f].shortage}個 不足）。</div></div>`;
      }
    });
  }
  box.innerHTML = html;
}

// ---------- 発送リスト ----------
const FILTERS = [
  ['all', 'すべて'],
  ['pending', '未対応だけ'],
  ['hand', '手渡しだけ'],
  ['direct', '直送だけ'],
  ['unpaid', '未入金だけ'],
  ['noslip', '伝票未送付'],
  ['done', '対応済み'],
];

function matchFilter(item) {
  const { customer: c, record: r } = item;
  switch (state.filter) {
    case 'pending': return r.status === '未対応';
    case 'hand': return c.delivery === '手渡し';
    case 'direct': return c.delivery === '直送';
    case 'unpaid': return r.payment === '未入金';
    case 'noslip': return c.delivery === '直送' && r.slip === '未送付';
    case 'done': return isDone(r.status);
    default: return true;
  }
}

function renderList() {
  main.innerHTML = `
    <input class="search" type="search" placeholder="🔍 名前で検索" value="${esc(state.query)}" data-input="query">
    <div class="chips">${FILTERS.map(([k, l]) => `<button class="chip${state.filter === k ? ' active' : ''}" data-action="filter" data-key="${k}">${l}</button>`).join('')}</div>
    <div id="results"></div>
    <button class="btn block" data-action="add-irregular" style="margin-top:8px">＋ 単発の人を${ymLabel(state.ym)}に追加</button>`;
  renderListResults();
}

// 検索・絞り込みの結果部分だけを描き直す（入力中の文字が消えないように）
function renderListResults() {
  const all = shipList(db, state.ym);
  const q = state.query.trim();
  const items = all.filter((it) => (!q || it.customer.name.includes(q)) && matchFilter(it));
  const pending = all.filter((it) => it.record.status === '未対応').length;
  const unpaid = all.filter((it) => it.record.payment === '未入金').length;

  let html = `
    <div class="summary">
      <div><b>${all.length}</b>発送対象</div>
      <div><b>${pending}</b>未対応</div>
      <div><b>${all.length - pending}</b>対応済み</div>
      <div><b>${unpaid}</b>未入金</div>
    </div>`;
  if (!db.customers.length) {
    html += `<div class="empty">まだ顧客が登録されていません。<br><br><button class="btn primary" data-action="go-customers">顧客を登録する</button></div>`;
  } else if (!items.length) {
    html += `<div class="empty">${all.length ? '該当する人はいません。' : 'この月の発送対象はいません。'}</div>`;
  } else {
    html += items.map(shipCard).join('');
  }
  $('#results').innerHTML = html;
}

function shipCard({ customer: c, record: r }) {
  const done = isDone(r.status);
  const badges = [qtyBadges(r.qty)];
  badges.push(`<span class="badge">${esc(c.plan)}</span>`);
  if (c.plan === '隔月') badges.push(`<span class="badge primary">隔月・この月が発送月</span>`);
  if (r.irregular) badges.push(`<span class="badge primary">この月に追加</span>`);
  badges.push(`<span class="badge ${c.delivery === '手渡し' ? 'warn' : ''}">${esc(c.delivery)}</span>`);
  if (c.paused) badges.push(`<span class="badge">休止中</span>`);

  const info = [];
  if (c.delivery === '直送') {
    info.push('🕒 ' + esc(c.timeSlot));
    info.push('伝票：' + esc(r.slip) + (r.tracking ? '（' + esc(r.tracking) + '）' : ''));
  }
  if (r.memo) info.push('📝 ' + esc(r.memo));

  return `
  <div class="card ship${done ? ' done' : ''}${c.paused ? ' paused' : ''}">
    <div class="ship-head" data-action="edit-record" data-id="${c.id}">
      <div>
        <p class="ship-name">${esc(c.name) || '(名前なし)'}</p>
        <div class="ship-meta">${badges.join('')}</div>
      </div>
      <button class="edit-link" type="button">詳細 ›</button>
    </div>
    ${info.length ? `<div class="ship-info">${info.join('　')}</div>` : ''}
    <div class="ship-controls">
      <div><label>状況</label>
        <select class="pill st-${esc(r.status)}" data-change="record" data-id="${c.id}" data-field="status">${options(STATUSES, r.status)}</select></div>
      <div><label>入金</label>
        <select class="pill pay-${esc(r.payment)}" data-change="record" data-id="${c.id}" data-field="payment">${options(PAYMENTS, r.payment)}</select></div>
    </div>
  </div>`;
}

function updateRecordField(cid, field, value) {
  const rec = ensureRecord(db, state.ym, cid, false);
  rec[field] = value;
  persist();
}

function openRecordSheet(cid, ym) {
  ym = ym || state.ym;
  const c = findCustomer(db, cid);
  if (!c) return;
  const r = getRecord(db, ym, cid) || makeRecord(c, false);
  openSheet(`
    <p class="sheet-ym">${ymLabel(ym)}の記録</p>
    <h2>${esc(c.name)} さん</h2>
    <form class="form" id="recordForm">
      <div class="row2">
        <div class="field"><label>状況</label><select name="status">${options(STATUSES, r.status)}</select></div>
        <div class="field"><label>入金状況</label><select name="payment">${options(PAYMENTS, r.payment)}</select></div>
      </div>
      <div class="row2">
        <div class="field"><label>伝票</label><select name="slip">${options(SLIPS, r.slip)}</select></div>
        <div class="field"><label>伝票番号</label><input type="text" name="tracking" inputmode="numeric" value="${esc(r.tracking)}" placeholder="追跡番号"></div>
      </div>
      ${qtyFields(r.qty, 'この月の')}
      <div class="field"><label>メモ</label><textarea name="memo" placeholder="この月のメモ">${esc(r.memo)}</textarea></div>
      <div class="card small" style="margin:0">
        <b>${esc(c.delivery)}</b>${c.delivery === '直送' ? '　🕒 ' + esc(c.timeSlot) : ''}<br>
        ${c.address ? '🏠 ' + esc(c.address) + '<br>' : ''}
        ${c.phone ? '📞 <a href="tel:' + esc(c.phone) + '">' + esc(c.phone) + '</a><br>' : ''}
        ${c.memo ? '📝 ' + esc(c.memo) : ''}
        <div style="margin-top:8px"><button type="button" class="btn small" data-action="edit-customer" data-id="${c.id}">顧客情報を編集</button></div>
      </div>
      ${r.irregular ? `<button type="button" class="btn danger" data-action="remove-irregular" data-id="${c.id}" data-ym="${ym}">${ymLabel(ym)}のリストから外す</button>` : ''}
      <div class="sheet-actions">
        <button type="button" class="btn" data-action="close-sheet">キャンセル</button>
        <button type="submit" class="btn primary">保存</button>
      </div>
    </form>`);
  $('#recordForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const qty = readQty(f);
    if (!totalQty(qty) && !confirm('ザクロ・ゆずの個数がどちらも0個です。このまま保存しますか？')) return;
    const rec = ensureRecord(db, ym, cid, r.irregular);
    ['status', 'payment', 'slip', 'tracking', 'memo'].forEach((k) => { rec[k] = f.get(k); });
    rec.qty = qty;
    persist();
    closeSheet();
    toast('保存しました');
    render();
  });
}

function openAddIrregular() {
  const recs = db.records[state.ym] || {};
  const cands = db.customers.filter((c) => c.plan === '単発' && !recs[c.id]);
  const others = db.customers.filter((c) => c.plan !== '単発' && !shipList(db, state.ym).some((it) => it.customer.id === c.id));
  const btn = (c) => `<button type="button" class="btn" data-action="pick-irregular" data-id="${c.id}">
      <span>${esc(c.name)}${c.paused ? '（休止中）' : ''}</span><span>${qtyBadges(c.qty)}</span></button>`;
  openSheet(`
    <h2>${ymLabel(state.ym)}に追加する人</h2>
    <p class="small muted">単発の人を選ぶと、${ymLabel(state.ym)}の発送リストに入ります。</p>
    <div class="pick-list form">
      ${cands.length ? cands.map(btn).join('') : '<p class="muted">追加できる単発の人はいません。<br>顧客画面で定期便を「単発」にして登録してください。</p>'}
    </div>
    ${others.length ? `<p class="section-title">その他（この月お休みの隔月の人・休止中の人など）</p><div class="pick-list form">${others.map(btn).join('')}</div>` : ''}
    <div class="sheet-actions"><button type="button" class="btn" data-action="close-sheet">閉じる</button></div>`);
}

// ---------- 全記録の一覧 ----------
const ALL_FILTERS = [
  ['all', 'すべて'],
  ['pending', '未発送だけ'],
  ['unpaid', '未入金だけ'],
  ['noslip', '伝票未送付'],
];

function renderAll() {
  const months = listMonths(db);
  if (state.allYm !== 'all' && !months.includes(state.allYm)) months.push(state.allYm);
  months.sort().reverse();
  main.innerHTML = `
    <div class="field"><label>年月で絞り込み</label>
      <select class="pill" data-change="allYm">
        <option value="all"${state.allYm === 'all' ? ' selected' : ''}>すべての月</option>
        ${months.map((ym) => `<option value="${ym}"${state.allYm === ym ? ' selected' : ''}>${ymLabel(ym)}</option>`).join('')}
      </select></div>
    <div style="height:10px"></div>
    <input class="search" type="search" placeholder="🔍 お名前で検索" value="${esc(state.allQuery)}" data-input="allQuery">
    <div class="chips">${ALL_FILTERS.map(([k, l]) => `<button class="chip${state.allFilter === k ? ' active' : ''}" data-action="all-filter" data-key="${k}">${l}</button>`).join('')}</div>
    <div id="results"></div>`;
  renderAllResults();
}

function matchAllFilter(row) {
  const { customer: c, record: r } = row;
  switch (state.allFilter) {
    case 'pending': return r.status === '未対応';
    case 'unpaid': return r.payment === '未入金';
    case 'noslip': return c.delivery === '直送' && r.slip === '未送付';
    default: return true;
  }
}

function renderAllResults() {
  const base = state.allYm === 'all'
    ? allRows(db)
    : shipList(db, state.allYm).map((it) => Object.assign({ ym: state.allYm }, it));
  const q = state.allQuery.trim();
  const rows = base.filter((row) => (!q || row.customer.name.includes(q)) && matchAllFilter(row));

  const pending = rows.filter((r) => r.record.status === '未対応').length;
  const unpaid = rows.filter((r) => r.record.payment === '未入金').length;
  let html = `<div class="summary">
      <div><b>${rows.length}</b>件</div>
      <div><b>${pending}</b>未発送</div>
      <div><b>${unpaid}</b>未入金</div>
    </div>`;
  if (!rows.length) {
    $('#results').innerHTML = html + '<div class="empty">該当する記録はありません。</div>';
    return;
  }

  // 月ごとにまとめて、月の見出しを大きく出す
  const groups = [];
  rows.forEach((row) => {
    if (!groups.length || groups[groups.length - 1].ym !== row.ym) groups.push({ ym: row.ym, rows: [] });
    groups[groups.length - 1].rows.push(row);
  });
  html += groups.map((g) => {
    const sum = { ザクロ: 0, ゆず: 0 };
    g.rows.forEach((row) => FLAVORS.forEach((f) => { sum[f] += row.record.qty[f] || 0; }));
    return `
    <h3 class="ym-head">${ymLabel(g.ym)}<span>${g.rows.length}件　ザクロ${sum.ザクロ}・ゆず${sum.ゆず}</span></h3>
    <div class="table-wrap"><table class="rec-table">
      <thead><tr><th class="sticky ym">年月</th><th class="sticky name">お名前</th><th>区分</th><th>ザクロ</th><th>ゆず</th><th>発送</th><th>伝票</th><th>入金</th></tr></thead>
      <tbody>${g.rows.map(recRow).join('')}</tbody>
    </table></div>`;
  }).join('');
  html += '<p class="small muted">※ 行を押すと、その月の記録を編集できます。表は横にスクロールできます。</p>';
  $('#results').innerHTML = html;
}

function recRow({ ym, customer: c, record: r }) {
  const [y, m] = ym.split('-');
  const statusCls = isDone(r.status) ? 'ok' : 'warn';
  const slip = c.delivery === '手渡し' ? '<span class="muted">手渡し</span>'
    : `<span class="badge ${r.slip === '送付済み' ? 'ok' : 'warn'}">${esc(r.slip)}</span>`;
  return `<tr data-action="edit-record" data-id="${c.id}" data-ym="${ym}">
    <td class="sticky ym">${y}年<br>${Number(m)}月</td>
    <td class="sticky name">${esc(c.name) || '(名前なし)'}</td>
    <td class="nowrap">${esc(c.plan)}</td>
    <td class="num">${r.qty.ザクロ || '<span class="muted">0</span>'}</td>
    <td class="num">${r.qty.ゆず || '<span class="muted">0</span>'}</td>
    <td><span class="badge ${statusCls}">${esc(r.status)}</span></td>
    <td>${slip}</td>
    <td><span class="badge ${r.payment === '入金済み' ? 'ok' : 'warn'}">${esc(r.payment)}</span></td>
  </tr>`;
}

// ---------- 顧客 ----------
function renderCustomers() {
  main.innerHTML = `
    <button class="btn primary block" data-action="new-customer">＋ 新しい顧客を登録</button>
    <div style="height:10px"></div>
    <input class="search" type="search" placeholder="🔍 名前で検索" value="${esc(state.custQuery)}" data-input="custQuery">
    <div class="chips">
      <button class="chip${state.showPaused ? ' active' : ''}" data-action="toggle-paused">休止中も表示</button>
    </div>
    <p class="small muted">登録数 ${db.customers.length}人（休止中 ${db.customers.filter((c) => c.paused).length}人）</p>
    <div id="results"></div>`;
  renderCustomerResults();
}

function renderCustomerResults() {
  const q = state.custQuery.trim();
  const ym = state.ym; // 上部に表示している月を基準にする
  const mon = Number(ym.split('-')[1]) + '月';
  const list = db.customers
    .filter((c) => (!q || c.name.includes(q)) && (state.showPaused || !c.paused))
    .sort((a, b) => a.name.localeCompare(b.name, 'ja'));

  if (!list.length) {
    $('#results').innerHTML = `<div class="empty">${db.customers.length ? '該当する顧客はいません。' : '「＋ 新しい顧客を登録」から登録してください。'}</div>`;
    return;
  }
  $('#results').innerHTML = list.map((c) => {
    const badges = [qtyBadges(c.qty), `<span class="badge">${esc(c.plan)}</span>`, `<span class="badge ${c.delivery === '手渡し' ? 'warn' : ''}">${esc(c.delivery)}</span>`];
    if (c.paused) badges.push('<span class="badge">休止中</span>');
    if (c.plan === '隔月' && !c.paused) {
      if (isScheduledMonth(c, ym)) badges.push(`<span class="badge ok">✅ ${mon}は発送月</span>`);
      else {
        const nx = nextScheduledMonth(c, ym);
        badges.push(`<span class="badge">💤 ${mon}はお休み${nx ? '（次は' + Number(nx.split('-')[1]) + '月）' : ''}</span>`);
      }
    }
    return `<div class="card cust" data-action="edit-customer" data-id="${c.id}">
      <div class="cust-row"><b style="font-size:17px">${esc(c.name) || '(名前なし)'}</b><span class="muted">›</span></div>
      <div class="ship-meta">${badges.join('')}</div>
      ${c.memo ? `<div class="ship-info">📝 ${esc(c.memo)}</div>` : ''}
    </div>`;
  }).join('');
}

function openCustomerSheet(cid) {
  const isNew = !cid;
  const c = isNew ? newCustomer() : Object.assign({}, findCustomer(db, cid));
  openSheet(`
    <h2>${isNew ? '新しい顧客を登録' : '顧客情報の編集'}</h2>
    <form class="form" id="custForm">
      <div class="field"><label>顧客名</label><input type="text" name="name" required value="${esc(c.name)}" placeholder="例：山田 花子"></div>
      ${qtyFields(c.qty, '')}
      <div class="field"><div class="hint">両方の味を頼む人は、それぞれの個数を入れてください。片方だけの人は、もう片方を0にします。</div></div>
      <div class="row2">
        <div class="field"><label>定期便の種類</label><select name="plan" id="planSel">${options(PLANS, c.plan)}</select></div>
        <div class="field"><label>開始月</label><input type="month" name="startMonth" value="${esc(c.startMonth)}"></div>
      </div>
      <div class="field"><div class="hint" id="planHint"></div></div>
      <div class="row2">
        <div class="field"><label>受け渡し方法</label><select name="delivery">${options(DELIVERIES, c.delivery)}</select></div>
        <div class="field"><label>配送時間指定</label><select name="timeSlot">${options(TIME_SLOTS, c.timeSlot)}</select></div>
      </div>
      <label class="switch-field"><span>休止中</span><input type="checkbox" name="paused"${c.paused ? ' checked' : ''}></label>
      <div class="field"><label>住所 <span class="opt">(任意)</span></label><textarea name="address" rows="2">${esc(c.address)}</textarea></div>
      <div class="field"><label>電話番号 <span class="opt">(任意)</span></label><input type="tel" name="phone" value="${esc(c.phone)}"></div>
      <div class="field"><label>メモ</label><textarea name="memo">${esc(c.memo)}</textarea></div>
      ${isNew ? '' : `<button type="button" class="btn danger" data-action="delete-customer" data-id="${c.id}">この顧客を削除</button>`}
      <div class="sheet-actions">
        <button type="button" class="btn" data-action="close-sheet">キャンセル</button>
        <button type="submit" class="btn primary">保存</button>
      </div>
    </form>`);

  const form = $('#custForm');
  const updateHint = () => {
    const plan = form.plan.value;
    const start = form.startMonth.value;
    const hint = $('#planHint');
    if (plan === '隔月' && isValidYm(start)) {
      const tmp = { plan, startMonth: start };
      const months = [];
      for (let i = 0; i < 12 && months.length < 4; i++) {
        const t = addMonths(ymOf(), i);
        if (isScheduledMonth(tmp, t)) months.push(Number(t.split('-')[1]) + '月');
      }
      hint.textContent = '隔月の発送月：' + months.join('・') + ' …（開始月から2か月ごと）';
    } else if (plan === '単発') {
      hint.textContent = '単発の人は、発送リストの「＋ 単発の人を追加」から注文があった月に追加します。';
    } else hint.textContent = '開始月から毎月の発送リストに表示されます。';
  };
  form.plan.addEventListener('change', updateHint);
  form.startMonth.addEventListener('change', updateHint);
  updateHint();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const data = {
      name: (f.get('name') || '').trim(),
      qty: readQty(f),
      plan: f.get('plan'),
      startMonth: isValidYm(f.get('startMonth')) ? f.get('startMonth') : ymOf(),
      delivery: f.get('delivery'),
      timeSlot: f.get('timeSlot'),
      paused: f.get('paused') === 'on',
      address: f.get('address') || '',
      phone: f.get('phone') || '',
      memo: f.get('memo') || '',
    };
    if (!data.name) { toast('顧客名を入力してください'); return; }
    if (!totalQty(data.qty) && !confirm('ザクロ・ゆずの個数がどちらも0個です。このまま保存しますか？')) return;
    if (isNew) db.customers.push(Object.assign(c, data));
    else Object.assign(findCustomer(db, cid), data);
    persist();
    closeSheet();
    toast(isNew ? '登録しました' : '保存しました');
    render();
  });
}

function deleteCustomer(cid) {
  const c = findCustomer(db, cid);
  if (!c) return;
  if (!confirm(`「${c.name}」さんを削除しますか？\nこの人の発送記録もすべて消えます。\n（休止にするだけなら「休止中」をオンにしてください）`)) return;
  db.customers = db.customers.filter((x) => x.id !== cid);
  Object.keys(db.records).forEach((ym) => { delete db.records[ym][cid]; });
  persist();
  closeSheet();
  toast('削除しました');
  render();
}

// ---------- 在庫 ----------
function renderStock() {
  const s = calcStock(db, state.ym);
  const inv = getInventory(db, state.ym);
  const prev = previousEnding(db, state.ym);
  let html = '';

  FLAVORS.forEach((f) => {
    const x = s[f];
    const cls = f === 'ザクロ' ? 'zakuro' : 'yuzu';
    const carry = prev && prev[f] != null && x.opening == null
      ? `<div class="small muted" style="grid-column:1/-1">前月の月末残りは ${prev[f]}個 です
          <button class="btn small" data-action="carry" data-flavor="${f}" data-val="${prev[f]}">月初在庫にする</button></div>` : '';
    html += `
    <div class="card stock-card">
      <h3><span class="badge ${cls}" style="font-size:15px">${esc(f)}味</span>
        ${x.shortage > 0 ? '<span class="badge danger">⚠️ ' + x.shortage + '個不足</span>' : ''}</h3>
      <div class="stock-grid">
        <span>月初在庫</span>
        <input type="number" min="0" inputmode="numeric" placeholder="未入力" value="${x.opening == null ? '' : x.opening}" data-change="opening" data-flavor="${f}">
        ${carry}
        <span>＋ 入荷</span><span class="val">${x.arrived}個</span>
        <span>− 発送・手渡し済み</span><span class="val">${x.shipped}個</span>
        <span class="total">月末の残り</span><span class="val total">${x.remaining}個</span>
        <span class="muted small">この月の発送予定（合計）</span><span class="val small">${x.planned}個</span>
        <span class="muted small">うち未対応</span><span class="val small">${x.pending}個</span>
        <span class="muted small">未対応分を出した後の残り</span>
        <span class="val small" style="color:${x.afterPlan < 0 ? 'var(--danger)' : 'inherit'}">${x.afterPlan}個</span>
      </div>
    </div>`;
  });

  html += `<p class="section-title">${ymLabel(state.ym)}の入荷記録</p>
    <button class="btn primary block" data-action="new-arrival">＋ 入荷を記録</button>
    <div class="card" style="margin-top:10px">`;
  const arrivals = (inv.arrivals || []).slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  html += arrivals.length
    ? arrivals.map((a) => `<div class="arrival">
        <div><b>${esc(a.date || '')}</b> ${flavorBadge(a.flavor, a.qty)}${a.memo ? `<div class="small muted">${esc(a.memo)}</div>` : ''}</div>
        <button class="btn small danger" data-action="delete-arrival" data-id="${a.id}">削除</button></div>`).join('')
    : '<p class="muted small" style="margin:0">この月の入荷はまだありません。</p>';
  html += `</div><p class="small muted">※ 発送数は、発送リストで「発送済み」「手渡し済み」にした人の個数を自動で合計しています。</p>`;
  main.innerHTML = html;
}

function openArrivalSheet() {
  const today = new Date();
  const [y, m] = state.ym.split('-');
  const def = ymOf(today) === state.ym
    ? `${y}-${m}-${String(today.getDate()).padStart(2, '0')}` : `${y}-${m}-01`;
  openSheet(`
    <h2>入荷を記録（${ymLabel(state.ym)}）</h2>
    <form class="form" id="arrForm">
      <div class="field"><label>日付</label><input type="date" name="date" value="${def}"></div>
      <div class="row2">
        <div class="field"><label>味</label><select name="flavor">${options(FLAVORS, 'ザクロ')}</select></div>
        <div class="field"><label>個数</label><input type="number" name="qty" min="1" inputmode="numeric" required></div>
      </div>
      <div class="field"><label>メモ</label><input type="text" name="memo"></div>
      <div class="sheet-actions">
        <button type="button" class="btn" data-action="close-sheet">キャンセル</button>
        <button type="submit" class="btn primary">記録する</button>
      </div>
    </form>`);
  $('#arrForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const qty = Number(f.get('qty')) || 0;
    if (qty <= 0) { toast('個数を入力してください'); return; }
    ensureInventory(db, state.ym).arrivals.push({ id: newId(), date: f.get('date'), flavor: f.get('flavor'), qty, memo: f.get('memo') || '' });
    persist();
    closeSheet();
    toast('入荷を記録しました');
    render();
  });
}

// ---------- バックアップ ----------
function renderBackup() {
  const d = backupDaysAgo(db);
  const last = db.meta.lastBackupAt ? new Date(db.meta.lastBackupAt).toLocaleString('ja-JP') : 'まだありません';
  const canShare = !!(navigator.canShare && window.File);
  main.innerHTML = `
    <div class="card">
      <b>最後のバックアップ</b>
      <p style="margin:4px 0 0">${esc(last)}${d != null ? `（${d}日前）` : ''}</p>
      ${needsBackupReminder(db) ? '<p class="small" style="color:var(--warn)">⚠️ そろそろバックアップしましょう</p>' : ''}
    </div>

    <p class="section-title">① CSVで書き出す（バックアップ）</p>
    <div class="card">
      <p class="small" style="margin-top:0">顧客・発送記録・在庫をすべて1つのCSVファイルに保存します。
      保存したファイルは、スマホの「ファイル」アプリやGoogleドライブなど<b>自分だけが見られる場所</b>に保管してください。</p>
      <div class="form">
        <button class="btn primary" data-action="export">📥 CSVをダウンロード</button>
        ${canShare ? '<button class="btn" data-action="share">📤 共有メニューから保存（iPhone向け）</button>' : ''}
      </div>
    </div>

    <p class="section-title">② CSVを読み込む（復元）</p>
    <div class="card">
      <p class="small" style="margin-top:0">以前に書き出したCSVを読み込みます。<b>今このスマホに入っているデータは、CSVの内容に置き換わります。</b></p>
      <label class="btn block">📂 CSVファイルを選ぶ
        <input type="file" accept=".csv,text/csv,text/comma-separated-values,text/plain" id="importFile" hidden>
      </label>
    </div>

    <p class="section-title">データについて</p>
    <div class="card small">
      ・データはこのスマホのブラウザの中だけに保存されています。GitHubやインターネット上には保存されません。<br>
      ・ブラウザの履歴・Webサイトデータを消去すると、データも消えます。定期的にバックアップしてください。<br>
      ・機種変更するときは、古いスマホで書き出し→新しいスマホで読み込みをしてください。<br>
      ・登録数：顧客 ${db.customers.length}人 ／ 発送記録 ${Object.keys(db.records).length}か月分
    </div>
    <button class="btn danger block" data-action="wipe" style="margin-top:12px">すべてのデータを消去</button>`;

  $('#importFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) importCsv(file);
    e.target.value = '';
  });
}

function backupFileName() {
  const t = new Date();
  return `collagen-backup-${t.getFullYear()}${String(t.getMonth() + 1).padStart(2, '0')}${String(t.getDate()).padStart(2, '0')}.csv`;
}

function markBackedUp() {
  db.meta.lastBackupAt = new Date().toISOString();
  persist();
}

function exportCsv() {
  markBackedUp();
  const blob = new Blob([toCsv(db)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = backupFileName();
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast('CSVを書き出しました');
  render();
}

async function shareCsv() {
  markBackedUp();
  const file = new File([toCsv(db)], backupFileName(), { type: 'text/csv' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'コラーゲン管理バックアップ' });
      toast('共有メニューを開きました');
    } else {
      exportCsv();
      return;
    }
  } catch (e) {
    if (e.name !== 'AbortError') toast('共有できませんでした。ダウンロードを試してください');
  }
  render();
}

function importCsv(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let next;
    try {
      next = fromCsv(String(reader.result));
    } catch (e) {
      alert('読み込めませんでした：' + e.message);
      return;
    }
    const months = Object.keys(next.records).length;
    const ok = confirm(`このCSVには\n・顧客 ${next.customers.length}人\n・発送記録 ${months}か月分\nが入っています。\n\n今のデータをこの内容に置き換えますか？`);
    if (!ok) return;
    if (db.customers.length && confirm('念のため、置き換える前に今のデータをCSVで書き出しますか？')) exportCsv();
    if (!next.meta.lastBackupAt) next.meta.lastBackupAt = new Date().toISOString();
    db = next;
    persist();
    toast('読み込みました');
    render();
  };
  reader.onerror = () => alert('ファイルを読み込めませんでした');
  reader.readAsText(file, 'utf-8');
}

function wipeAll() {
  if (!confirm('すべてのデータ（顧客・発送記録・在庫）を消去します。\n元に戻せません。よろしいですか？')) return;
  if (!confirm('本当に消去しますか？バックアップは取りましたか？')) return;
  db = emptyDb();
  persist();
  toast('消去しました');
  render();
}

// ---------- シート（下から出る画面） ----------
function openSheet(html) {
  $('#sheetBody').innerHTML = html;
  $('#sheet').hidden = false;
  $('#sheetBackdrop').hidden = false;
  $('#sheet').scrollTop = 0;
  document.body.style.overflow = 'hidden';
}
function closeSheet() {
  $('#sheet').hidden = true;
  $('#sheetBackdrop').hidden = true;
  $('#sheetBody').innerHTML = '';
  document.body.style.overflow = '';
}

// ---------- 操作の受け付け ----------
document.addEventListener('click', (e) => {
  const tabBtn = e.target.closest('.tabbar button');
  if (tabBtn) {
    state.tab = tabBtn.dataset.tab;
    window.scrollTo(0, 0);
    render();
    return;
  }
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const id = el.dataset.id;
  switch (el.dataset.action) {
    case 'filter': state.filter = el.dataset.key; render(); break;
    case 'edit-record': openRecordSheet(id, el.dataset.ym); break;
    case 'all-filter': state.allFilter = el.dataset.key; render(); break;
    case 'add-irregular': openAddIrregular(); break;
    case 'pick-irregular': {
      const c = findCustomer(db, id);
      ensureRecord(db, state.ym, id, true);
      persist();
      closeSheet();
      toast(`${c ? c.name : ''}さんを追加しました`);
      render();
      break;
    }
    case 'remove-irregular':
      if (confirm('この月の発送リストから外しますか？（この月の記録も消えます）')) {
        delete (db.records[el.dataset.ym || state.ym] || {})[id];
        persist();
        closeSheet();
        render();
      }
      break;
    case 'go-customers': state.tab = 'customers'; render(); break;
    case 'go-backup': state.tab = 'backup'; render(); break;
    case 'new-customer': openCustomerSheet(null); break;
    case 'edit-customer': openCustomerSheet(id); break;
    case 'delete-customer': deleteCustomer(id); break;
    case 'toggle-paused': state.showPaused = !state.showPaused; render(); break;
    case 'new-arrival': openArrivalSheet(); break;
    case 'delete-arrival':
      if (confirm('この入荷記録を削除しますか？')) {
        const inv = ensureInventory(db, state.ym);
        inv.arrivals = inv.arrivals.filter((a) => a.id !== id);
        persist();
        render();
      }
      break;
    case 'carry':
      ensureInventory(db, state.ym).opening[el.dataset.flavor] = Number(el.dataset.val);
      persist();
      render();
      break;
    case 'export': exportCsv(); break;
    case 'share': shareCsv(); break;
    case 'wipe': wipeAll(); break;
    case 'close-sheet': closeSheet(); break;
  }
});

document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.change === 'record') {
    updateRecordField(el.dataset.id, el.dataset.field, el.value);
    toast(`${el.value} にしました`);
    render();
  } else if (el.dataset.change === 'allYm') {
    state.allYm = el.value;
    render();
  } else if (el.dataset.change === 'opening') {
    const v = el.value === '' ? null : Math.max(0, Number(el.value) || 0);
    ensureInventory(db, state.ym).opening[el.dataset.flavor] = v;
    persist();
    render();
  }
});

document.addEventListener('input', (e) => {
  const key = e.target.dataset.input;
  if (!key) return;
  state[key] = e.target.value;
  if (key === 'query') renderListResults();
  else if (key === 'allQuery') renderAllResults();
  else renderCustomerResults();
});

$('#sheetBackdrop').addEventListener('click', closeSheet);
// 上部の ◀ ▶ と年月（一覧画面では年月の絞り込みとして働く）
function moveMonth(n) {
  if (state.tab === 'all') state.allYm = state.allYm === 'all' ? ymOf() : addMonths(state.allYm, n);
  else state.ym = addMonths(state.ym, n);
  render();
}
$('#prevMonth').addEventListener('click', () => moveMonth(-1));
$('#nextMonth').addEventListener('click', () => moveMonth(1));
$('#monthLabel').addEventListener('click', () => {
  if (state.tab === 'all') state.allYm = 'all';
  else state.ym = ymOf();
  render();
});

// 別のタブ・ウィンドウでデータが変わったら読み直す
window.addEventListener('storage', (e) => { if (e.key === STORAGE_KEY) { db = loadDb(); render(); } });

render();

// ホーム画面に追加したときにオフラインでも開けるようにする
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service Worker 登録失敗', e));
}
