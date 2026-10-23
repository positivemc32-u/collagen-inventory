// =============================================================
// app.js … 画面の表示とボタン操作
// =============================================================

let db = loadDb();
const state = {
  tab: 'events',
  eventId: null,
  year: 'all', // 集計画面の年
};

const $ = (sel) => document.querySelector(sel);
const main = $('#main');

// HTML に文字を入れるときの安全対策（< > などを無害化）
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function persist() { saveDb(db); }
function members() { return db.settings.members; }
function memberName(id) {
  if (!id) return '会のお金から';
  return (members().find((m) => m.id === id) || {}).name || '（削除された人）';
}
function currentEvent() { return db.events.find((e) => e.id === state.eventId); }
function sortedEvents() { return [...db.events].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)); }

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.hidden = true; }, 2200);
}

// ---------- 全体の描画 ----------
const TITLES = { events: '会の一覧', event: '会の精算', summary: '集計', settings: '設定', backup: 'バックアップ' };

function render() {
  const ev = currentEvent();
  if (state.tab === 'event' && !ev) state.tab = 'events';
  $('#pageTitle').textContent = state.tab === 'event' ? ev.name : TITLES[state.tab];
  $('#pageHint').textContent = state.tab === 'event' ? dateLabel(ev.date) : '';
  document.querySelectorAll('.tabbar button').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === state.tab);
    if (b.dataset.tab === 'event') b.disabled = !ev;
  });
  renderNotices();
  ({ events: renderEvents, event: renderEvent, summary: renderSummary, settings: renderSettings, backup: renderBackup })[state.tab]();
  window.scrollTo(0, 0);
}

function renderNotices() {
  const box = $('#notices');
  // 使い始めて（または最後のバックアップから）14日たったらお知らせ
  const days = (Date.now() - new Date(db.lastBackup || db.createdAt).getTime()) / 86400000;
  box.innerHTML = db.events.length && days > 14 && state.tab !== 'backup'
    ? `<div class="notice">💾 しばらくバックアップしていません。<button type="button" class="link" data-go="backup">バックアップする</button></div>`
    : '';
}

// ---------- 会の一覧 ----------
function renderEvents() {
  const list = sortedEvents();
  // 古い順に足して累計残高を出す
  const cum = {};
  let run = 0;
  [...list].reverse().forEach((ev) => { run += calcEvent(ev, members()).balance; cum[ev.id] = run; });

  main.innerHTML = `
    <div class="total-card">
      <div class="total-label">これまでの累計残高（${list.length}回分）</div>
      <div class="total-value ${run < 0 ? 'minus' : ''}">${yen(run)}</div>
    </div>
    <button type="button" class="btn primary block" data-act="new-event">＋ 新しい会を作る</button>
    ${list.length ? '' : '<p class="empty">まだ会がありません。「＋ 新しい会を作る」から始めてください。</p>'}
    <div class="cards">
      ${list.map((ev) => {
        const c = calcEvent(ev, members());
        return `<button type="button" class="card event-card" data-open="${ev.id}">
          <div class="event-head">
            <span class="date">${esc(dateLabel(ev.date))}</span>
            <span class="badge ${ev.kind === '体験会' ? 'kind-main' : 'kind-other'}">${esc(ev.kind)}</span>
          </div>
          <div class="event-name">${esc(ev.name)}${ev.venue ? `<small>　${esc(ev.venue)}</small>` : ''}</div>
          <div class="event-nums">
            <span>参加 ${c.people}人</span><span>売上 ${yen(c.sales)}</span>
            <span>返金・経費 ${yen(c.parking + c.material + c.expense)}</span>
          </div>
          <div class="event-bal">残高 <b class="${c.balance < 0 ? 'minus' : ''}">${yen(c.balance)}</b>
            <small>累計 ${yen(cum[ev.id])}</small></div>
        </button>`;
      }).join('')}
    </div>`;
}

function addMonths(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// 日付を選ぶカレンダー（ほかの会がある日には印を付ける）
function calendarHtml(ym, selected, selfId) {
  const [y, m] = ym.split('-').map(Number);
  const first = new Date(y, m - 1, 1).getDay();
  const days = new Date(y, m, 0).getDate();
  const marked = new Set(db.events.filter((e) => e.id !== selfId).map((e) => e.date));
  const cells = [];
  for (let i = 0; i < first; i++) cells.push('<span></span>');
  for (let d = 1; d <= days; d++) {
    const ds = `${ym}-${String(d).padStart(2, '0')}`;
    const w = (first + d - 1) % 7;
    const cls = [w === 0 ? 'sun' : w === 6 ? 'sat' : '', ds === selected ? 'sel' : '', ds === todayStr() ? 'today' : '', marked.has(ds) ? 'has' : ''].join(' ');
    cells.push(`<button type="button" class="${cls}" data-day="${ds}">${d}</button>`);
  }
  return `<div class="cal-head">
      <button type="button" class="icon-btn" data-cal-move="-1" aria-label="前の月">◀</button>
      <b>${y}年${m}月</b>
      <button type="button" class="icon-btn" data-cal-move="1" aria-label="次の月">▶</button>
    </div>
    <div class="cal-grid">${[...WEEK].map((w, i) => `<span class="wk ${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}">${w}</span>`).join('')}${cells.join('')}</div>
    <div class="cal-foot"><button type="button" class="link" data-cal-today>今日にする</button><small>● ほかの会がある日</small></div>`;
}

function openEventForm(ev) {
  const isNew = !ev;
  const last = sortedEvents()[0];
  const v = ev || { date: todayStr(), name: last ? last.name : '体験会', kind: last ? last.kind : '体験会', venue: last ? last.venue : db.settings.defaultVenue };
  const names = [...new Set(db.events.map((e) => e.name))];
  openSheet(`
    <h2>${isNew ? '新しい会を作る' : '会の情報を変更'}</h2>
    <form id="evForm">
      <div class="field"><label>日付</label>
        <input type="hidden" name="date" value="${esc(v.date)}">
        <div class="date-picked" id="datePicked">${esc(dateLabel(v.date))}</div>
        <div class="cal" id="cal"></div></div>
      <div class="field"><label>会の名前</label><input name="name" required list="evNames" value="${esc(v.name)}" placeholder="例：なごみのたね 体験会">
        <datalist id="evNames">${names.map((n) => `<option value="${esc(n)}">`).join('')}</datalist></div>
      <div class="field"><label>種類</label>
        <select name="kind">${['体験会', 'その他の会'].map((k) => `<option${k === v.kind ? ' selected' : ''}>${k}</option>`).join('')}</select></div>
      <div class="field"><label>会場</label><input name="venue" value="${esc(v.venue)}"></div>
      ${isNew && last && last.expenses.length ? `
        <label class="check"><input type="checkbox" name="copyExp" checked> 前回（${esc(dateLabel(last.date))}）の経費を引き継ぐ
          <small>${last.expenses.map((x) => `${esc(x.name)} ${yen(x.amount)}`).join('、')}</small></label>` : ''}
      ${isNew ? '' : `<div class="field"><label>メモ</label><textarea name="memo" rows="2">${esc(v.memo)}</textarea></div>`}
      <div class="sheet-actions">
        ${isNew ? '' : '<button type="button" class="btn danger" data-act="del-event">削除</button>'}
        <button type="button" class="btn" data-act="close">キャンセル</button>
        <button type="submit" class="btn primary">${isNew ? '作成する' : '保存'}</button>
      </div>
    </form>`);
  const form = $('#evForm');
  let calYm = v.date.slice(0, 7);
  const drawCal = () => { $('#cal').innerHTML = calendarHtml(calYm, form.date.value, ev && ev.id); };
  $('#cal').onclick = (e) => {
    const mv = e.target.closest('[data-cal-move]');
    if (mv) calYm = addMonths(calYm, num(mv.dataset.calMove));
    const day = e.target.closest('[data-day]');
    if (day) {
      form.date.value = day.dataset.day;
      $('#datePicked').textContent = dateLabel(day.dataset.day);
    }
    const today = e.target.closest('[data-cal-today]');
    if (today) {
      calYm = todayStr().slice(0, 7);
      form.date.value = todayStr();
      $('#datePicked').textContent = dateLabel(todayStr());
    }
    drawCal();
  };
  drawCal();
  form.onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const vals = { date: f.get('date'), name: f.get('name').trim(), kind: f.get('kind'), venue: f.get('venue').trim() };
    if (isNew) {
      vals.expenses = f.get('copyExp') ? last.expenses : [];
      const created = newEvent(db.settings, vals);
      db.events.push(created);
      state.eventId = created.id;
      state.tab = 'event';
    } else {
      Object.assign(ev, vals, { memo: f.get('memo') });
    }
    persist();
    closeSheet();
    render();
    toast(isNew ? '会を作りました' : '保存しました');
  };
}

// ---------- 会の精算 ----------
function renderEvent() {
  const ev = currentEvent();
  const ms = members();
  main.innerHTML = `
    <div class="sticky-summary" id="evSummary"></div>

    <div class="row-actions">
      <button type="button" class="btn small" data-act="edit-event">✏️ 日付・会の情報</button>
      ${ev.memo ? `<span class="memo">📝 ${esc(ev.memo)}</span>` : ''}
    </div>

    <section class="panel">
      <div class="panel-head"><h2>① 参加者（売上）</h2><span data-calc="sales"></span></div>
      <div class="plist">
        ${ev.participants.map((p, i) => {
          const t = participantTotal(p);
          return `<button type="button" class="prow" data-part="${p.id}">
            <span class="pname">${esc(p.name || `${i + 1}人目`)}</span>
            <span class="pitems">${p.items.map((it) => esc(it.name)).join('、') || (p.extra ? esc(p.extraNote || 'その他') : '<em>メニュー未選択</em>')}</span>
            <span class="pamt">${yen(t)}${p.parking ? `<small>駐車場 −${yen(p.parking)}</small>` : ''}</span>
          </button>`;
        }).join('') || '<p class="empty small">参加者を追加してください</p>'}
      </div>
      <button type="button" class="btn block" data-act="add-part">＋ 参加者を追加</button>
    </section>

    <section class="panel">
      <div class="panel-head"><h2>② 材料の使用量（返金）</h2><span data-calc="material"></span></div>
      <p class="hint">材料を出した人の欄に、使った回数を入れてください。単価×回数をその人に返金します。</p>
      <div class="mat-wrap">
        <table class="mat">
          <thead><tr><th class="mname">材料（単価）</th>${ms.map((m) => `<th>${esc(m.name)}</th>`).join('')}<th>計</th></tr></thead>
          <tbody>
            ${ev.materials.map((m) => `<tr>
              <th class="mname">${esc(m.name)}<small>${yen(m.price)}</small></th>
              ${ms.map((mb) => `<td data-label="${esc(mb.name)}"><div class="stepper">
                <button type="button" class="step" data-step="-1" data-mat="${m.id}" data-mem="${mb.id}" aria-label="減らす">−</button>
                <input type="number" min="0" inputmode="numeric" class="cnt" data-mat="${m.id}" data-mem="${mb.id}" value="${usageCount(ev, m.id, mb.id) || ''}" placeholder="0">
                <button type="button" class="step" data-step="1" data-mat="${m.id}" data-mem="${mb.id}" aria-label="増やす">＋</button>
              </div></td>`).join('')}
              <td class="rowsum" data-label="計" data-calc="row-${m.id}"></td>
            </tr>`).join('')}
          </tbody>
          <tfoot><tr><th class="mname">返金額</th>${ms.map((mb) => `<td data-label="${esc(mb.name)}" data-calc="mem-${mb.id}"></td>`).join('')}<td data-label="計" data-calc="material"></td></tr></tfoot>
        </table>
      </div>
      <button type="button" class="btn small" data-act="edit-mats">材料・単価をこの会だけ変更</button>
    </section>

    <section class="panel">
      <div class="panel-head"><h2>③ 経費</h2><span data-calc="expense"></span></div>
      <datalist id="expItems">${db.settings.expenseItems.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
      <div class="exp-list">
        ${ev.expenses.map((x) => `<div class="exp-row">
          <input class="exp-name" data-exp="${x.id}" data-f="name" list="expItems" value="${esc(x.name)}" placeholder="項目（例：場所代）">
          <input class="exp-amt" type="number" inputmode="numeric" data-exp="${x.id}" data-f="amount" value="${x.amount || ''}" placeholder="金額">
          <select data-exp="${x.id}" data-f="paidBy" aria-label="立て替えた人">
            <option value="">会のお金から</option>
            ${ms.map((m) => `<option value="${m.id}"${m.id === x.paidBy ? ' selected' : ''}>${esc(m.name)}が立替</option>`).join('')}
          </select>
          <button type="button" class="icon-btn" data-del-exp="${x.id}" aria-label="削除">🗑</button>
        </div>`).join('') || '<p class="empty small">経費はまだありません</p>'}
      </div>
      <div class="chips">
        ${db.settings.expenseItems.map((n) => `<button type="button" class="chip" data-add-exp="${esc(n)}">＋ ${esc(n)}</button>`).join('')}
        <button type="button" class="chip" data-add-exp="">＋ その他</button>
      </div>
    </section>

    <section class="panel">
      <h2>④ 精算結果</h2>
      <div id="evResult"></div>
    </section>`;
  refreshCalc();
}

// 入力のたびに金額だけ更新（入力中の欄がリセットされないように）
function refreshCalc() {
  const ev = currentEvent();
  if (!ev) return;
  const ms = members();
  const c = calcEvent(ev, ms);
  const set = (key, text) => document.querySelectorAll(`[data-calc="${key}"]`).forEach((el) => { el.textContent = text; });
  set('sales', yen(c.sales));
  set('material', yen(c.material));
  set('expense', yen(c.expense));
  ev.materials.forEach((m) => set('row-' + m.id, c.matRow[m.id].count ? `${c.matRow[m.id].count}回 ${yen(c.matRow[m.id].amount)}` : '—'));
  ms.forEach((mb) => set('mem-' + mb.id, yen(c.matByMember[mb.id] || 0)));

  $('#evSummary').innerHTML = `
    <div class="sum-line"><span>売上</span><b>${yen(c.sales)}</b></div>
    <div class="sum-line"><span>駐車場</span><b>−${yen(c.parking)}</b></div>
    <div class="sum-line"><span>材料</span><b>−${yen(c.material)}</b></div>
    <div class="sum-line"><span>経費</span><b>−${yen(c.expense)}</b></div>
    <div class="sum-line bal"><span>残高</span><b class="${c.balance < 0 ? 'minus' : ''}">${yen(c.balance)}</b></div>`;

  const po = payouts(c, ms).filter((p) => p.total || ms.some((m) => m.id === p.id));
  $('#evResult').innerHTML = `
    <table class="result">
      <tr><th>売上（参加 ${c.people}人）</th><td>${yen(c.sales)}</td></tr>
      <tr><th>駐車場代の返金</th><td>−${yen(c.parking)}</td></tr>
      <tr><th>材料の返金</th><td>−${yen(c.material)}</td></tr>
      <tr><th>経費</th><td>−${yen(c.expense)}</td></tr>
      <tr class="bal"><th>残高</th><td class="${c.balance < 0 ? 'minus' : ''}">${yen(c.balance)}</td></tr>
    </table>
    <h3>お金を返す相手</h3>
    <table class="result payout">
      <thead><tr><th>名前</th><th>材料代</th><th>立替経費</th><th>返金合計</th></tr></thead>
      <tbody>${po.map((p) => `<tr><th>${esc(memberName(p.id))}</th><td>${yen(p.mat)}</td><td>${yen(p.exp)}</td><td><b>${yen(p.total)}</b></td></tr>`).join('')}</tbody>
    </table>
    ${c.parking ? `<p class="hint">駐車場代の返金：${ev.participants.filter((p) => p.parking).map((p) => `${esc(p.name || '参加者')} ${yen(p.parking)}`).join('、')}</p>` : ''}`;
}

function openParticipant(p) {
  const ev = currentEvent();
  const isNew = !p;
  openParticipant.editing = p ? p.id : null;
  const v = p || { name: '', items: [], extra: 0, extraNote: '', parking: 0, memo: '' };
  const picked = (mn) => v.items.some((it) => it.name === mn.name);
  // 今のメニュー表にない過去のメニューも残す
  const legacy = v.items.filter((it) => !db.settings.menus.some((mn) => mn.name === it.name));
  const allMenus = [...db.settings.menus, ...legacy.map((it, i) => ({ id: 'old' + i, name: it.name, price: it.price }))];
  const pr = db.settings.parking;
  openSheet(`
    <h2>${isNew ? '参加者を追加' : '参加者の内容'}</h2>
    <form id="pForm">
      <div class="field"><label>お名前（空欄でもOK）</label><input name="name" value="${esc(v.name)}" placeholder="例：山田さん"></div>
      <div class="field"><label>体験メニュー</label>
        <div class="menu-list">${allMenus.map((mn) => `
          <label class="menu-item"><input type="checkbox" name="menu" value="${esc(mn.id)}" data-price="${mn.price}" data-name="${esc(mn.name)}"${picked(mn) || legacy.some((it) => it.name === mn.name) ? ' checked' : ''}>
            <span>${esc(mn.name)}</span><b>${yen(mn.price)}</b></label>`).join('')}
        </div></div>
      <div class="row2">
        <div class="field"><label>その他の売上（円）</label><input type="number" inputmode="numeric" name="extra" value="${v.extra || ''}" placeholder="0"></div>
        <div class="field"><label>その他の内容</label><input name="extraNote" value="${esc(v.extraNote)}" placeholder="例：商品購入"></div>
      </div>
      <div class="total-line">合計 <b id="pTotal"></b></div>
      <div class="field"><label>駐車場代の返金 <small>（${yen(pr.t1)}以上で${yen(pr.a1)}、${yen(pr.t2)}以上で${yen(pr.a2)}）</small></label>
        <div class="seg" id="parkSeg">
          ${[0, pr.a1, pr.a2].map((a) => `<label><input type="radio" name="parking" value="${a}"${a === v.parking ? ' checked' : ''}><span>${a ? yen(a) : 'なし'}</span></label>`).join('')}
        </div>
        <small class="hint" id="parkHint"></small></div>
      <div class="field"><label>メモ</label><input name="memo" value="${esc(v.memo)}"></div>
      <div class="sheet-actions">
        ${isNew ? '' : '<button type="button" class="btn danger" data-act="del-part">削除</button>'}
        <button type="button" class="btn" data-act="close">キャンセル</button>
        <button type="submit" class="btn primary">保存</button>
      </div>
    </form>`);
  const form = $('#pForm');
  // 駐車場：手で選ぶまでは合計金額に合わせて自動で選ぶ
  let parkTouched = !isNew;
  const update = () => {
    const f = new FormData(form);
    const total = [...form.querySelectorAll('input[name=menu]:checked')].reduce((s, el) => s + num(el.dataset.price), 0) + num(f.get('extra'));
    $('#pTotal').textContent = yen(total);
    const sug = suggestParking(db.settings, total);
    if (!parkTouched) form.querySelectorAll('input[name=parking]').forEach((r) => { r.checked = num(r.value) === sug; });
    $('#parkHint').textContent = `合計 ${yen(total)} → 目安は${sug ? yen(sug) : 'なし'}`;
  };
  form.addEventListener('input', (e) => {
    if (e.target.name === 'parking') parkTouched = true;
    update();
  });
  update();
  form.onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const vals = {
      name: f.get('name').trim(),
      items: [...form.querySelectorAll('input[name=menu]:checked')].map((el) => ({ name: el.dataset.name, price: num(el.dataset.price) })),
      extra: num(f.get('extra')),
      extraNote: f.get('extraNote').trim(),
      parking: num(f.get('parking')),
      memo: f.get('memo').trim(),
    };
    if (isNew) ev.participants.push({ id: uid(), ...vals });
    else Object.assign(p, vals);
    persist();
    closeSheet();
    render();
  };
}

function openMaterialsForm() {
  const ev = currentEvent();
  const unused = db.settings.materials.filter((m) => !ev.materials.some((x) => x.id === m.id));
  openSheet(`
    <h2>この会の材料・単価</h2>
    <p class="hint">ここでの変更はこの会だけに反映されます。毎回の単価を変えるときは「設定」で変更してください。</p>
    <form id="matForm">
      <div id="matRows">${ev.materials.map((m) => matRowHtml(m)).join('')}</div>
      <div class="chips">
        ${unused.map((m) => `<button type="button" class="chip" data-add-mat="${m.id}">＋ ${esc(m.name)}</button>`).join('')}
        <button type="button" class="chip" data-add-mat="">＋ 新しい材料</button>
      </div>
      <div class="sheet-actions">
        <button type="button" class="btn" data-act="close">キャンセル</button>
        <button type="submit" class="btn primary">保存</button>
      </div>
    </form>`);
  $('#matForm').onclick = (e) => {
    const add = e.target.closest('[data-add-mat]');
    if (add) {
      const src = db.settings.materials.find((m) => m.id === add.dataset.addMat) || { id: uid(), name: '', price: 0 };
      $('#matRows').insertAdjacentHTML('beforeend', matRowHtml(src));
      add.remove();
    }
    const del = e.target.closest('[data-del-row]');
    if (del) del.closest('.edit-row').remove();
  };
  $('#matForm').onsubmit = (e) => {
    e.preventDefault();
    ev.materials = [...document.querySelectorAll('#matRows .edit-row')]
      .map((r) => ({ id: r.dataset.id, name: r.querySelector('[name=n]').value.trim(), price: num(r.querySelector('[name=p]').value) }))
      .filter((m) => m.name);
    persist();
    closeSheet();
    render();
  };
}

function matRowHtml(m) {
  return `<div class="edit-row" data-id="${esc(m.id)}">
    <input name="n" value="${esc(m.name)}" placeholder="材料名">
    <input name="p" type="number" inputmode="numeric" value="${m.price}" class="price" aria-label="単価">
    <button type="button" class="icon-btn" data-del-row aria-label="削除">🗑</button>
  </div>`;
}

// ---------- 集計 ----------
function renderSummary() {
  const ms = members();
  const years = [...new Set(db.events.map((e) => e.date.slice(0, 4)))].sort().reverse();
  const list = sortedEvents().filter((e) => state.year === 'all' || e.date.startsWith(state.year)).reverse();
  const tot = { people: 0, sales: 0, parking: 0, material: 0, expense: 0, balance: 0 };
  const perMember = {};
  let cum = 0;
  const rows = list.map((ev) => {
    const c = calcEvent(ev, ms);
    Object.keys(tot).forEach((k) => { tot[k] += c[k]; });
    payouts(c, ms).forEach((p) => {
      const t = perMember[p.id] || (perMember[p.id] = { mat: 0, exp: 0, total: 0 });
      t.mat += p.mat; t.exp += p.exp; t.total += p.total;
    });
    cum += c.balance;
    return `<tr data-open="${ev.id}"><td>${esc(dateShort(ev.date))}</td><td class="l">${esc(ev.name)}</td><td>${c.people}</td>
      <td>${yen(c.sales)}</td><td>${yen(c.parking)}</td><td>${yen(c.material)}</td><td>${yen(c.expense)}</td>
      <td class="${c.balance < 0 ? 'minus' : ''}"><b>${yen(c.balance)}</b></td><td>${yen(cum)}</td></tr>`;
  });
  main.innerHTML = `
    <div class="field inline"><label>期間</label>
      <select id="yearSel"><option value="all">全期間</option>${years.map((y) => `<option value="${y}"${y === state.year ? ' selected' : ''}>${y}年</option>`).join('')}</select></div>
    <div class="total-card">
      <div class="total-label">${state.year === 'all' ? '全期間' : state.year + '年'}の残高（${list.length}回・参加 ${tot.people}人）</div>
      <div class="total-value ${tot.balance < 0 ? 'minus' : ''}">${yen(tot.balance)}</div>
      <div class="total-sub">売上 ${yen(tot.sales)} − 駐車場 ${yen(tot.parking)} − 材料 ${yen(tot.material)} − 経費 ${yen(tot.expense)}</div>
    </div>
    <section class="panel">
      <h2>会ごとの精算</h2>
      <div class="table-wrap"><table class="grid">
        <thead><tr><th>日付</th><th class="l">会</th><th>人数</th><th>売上</th><th>駐車場</th><th>材料</th><th>経費</th><th>残高</th><th>累計</th></tr></thead>
        <tbody>${rows.join('') || '<tr><td colspan="9">記録がありません</td></tr>'}</tbody>
        <tfoot><tr><th></th><th class="l">合計</th><th>${tot.people}</th><th>${yen(tot.sales)}</th><th>${yen(tot.parking)}</th><th>${yen(tot.material)}</th><th>${yen(tot.expense)}</th><th>${yen(tot.balance)}</th><th></th></tr></tfoot>
      </table></div>
    </section>
    <section class="panel">
      <h2>人ごとの返金合計</h2>
      <table class="result payout">
        <thead><tr><th>名前</th><th>材料代</th><th>立替経費</th><th>合計</th></tr></thead>
        <tbody>${Object.keys(perMember).filter((id) => perMember[id].total || ms.some((m) => m.id === id)).map((id) => `<tr><th>${esc(memberName(id))}</th><td>${yen(perMember[id].mat)}</td><td>${yen(perMember[id].exp)}</td><td><b>${yen(perMember[id].total)}</b></td></tr>`).join('')}</tbody>
      </table>
    </section>`;
  $('#yearSel').onchange = (e) => { state.year = e.target.value; render(); };
}

// ---------- 設定 ----------
function renderSettings() {
  const s = db.settings;
  main.innerHTML = `
    <p class="hint">ここで変えた内容は、これから作る会と新しく入力する分に使われます（過去の会の金額は変わりません）。</p>
    <form id="setForm">
      <section class="panel">
        <h2>材料を出す人</h2>
        <div id="memRows">${s.members.map((m) => `<div class="edit-row" data-id="${esc(m.id)}">
          <input name="n" value="${esc(m.name)}"><button type="button" class="icon-btn" data-del-row aria-label="削除">🗑</button></div>`).join('')}</div>
        <button type="button" class="btn small" data-add-row="mem">＋ 人を追加</button>
      </section>
      <section class="panel">
        <h2>材料と単価（一回分）</h2>
        <div id="setMatRows">${s.materials.map((m) => matRowHtml(m)).join('')}</div>
        <button type="button" class="btn small" data-add-row="mat">＋ 材料を追加</button>
      </section>
      <section class="panel">
        <h2>体験メニューと料金</h2>
        <div id="menuRows">${s.menus.map((m) => matRowHtml(m)).join('')}</div>
        <button type="button" class="btn small" data-add-row="menu">＋ メニューを追加</button>
      </section>
      <section class="panel">
        <h2>経費の項目</h2>
        <div id="expRows">${s.expenseItems.map((n) => `<div class="edit-row"><input name="n" value="${esc(n)}"><button type="button" class="icon-btn" data-del-row aria-label="削除">🗑</button></div>`).join('')}</div>
        <button type="button" class="btn small" data-add-row="exp">＋ 項目を追加</button>
      </section>
      <section class="panel">
        <h2>駐車場代の返金</h2>
        <div class="row2">
          <div class="field"><label>この金額以上で</label><input type="number" name="t1" value="${s.parking.t1}"></div>
          <div class="field"><label>返金</label><input type="number" name="a1" value="${s.parking.a1}"></div>
          <div class="field"><label>この金額以上で</label><input type="number" name="t2" value="${s.parking.t2}"></div>
          <div class="field"><label>返金</label><input type="number" name="a2" value="${s.parking.a2}"></div>
        </div>
        <div class="field"><label>いつもの会場</label><input name="venue" value="${esc(s.defaultVenue)}"></div>
      </section>
      <button type="submit" class="btn primary block">設定を保存</button>
      <button type="button" class="btn block" data-act="reset-settings">最初の設定に戻す</button>
    </form>`;
  const form = $('#setForm');
  form.onclick = (e) => {
    const del = e.target.closest('[data-del-row]');
    if (del) del.closest('.edit-row').remove();
    const add = e.target.closest('[data-add-row]');
    if (add) {
      const k = add.dataset.addRow;
      const simple = `<div class="edit-row" data-id="${uid()}"><input name="n" placeholder="名前"><button type="button" class="icon-btn" data-del-row aria-label="削除">🗑</button></div>`;
      const box = { mem: '#memRows', mat: '#setMatRows', menu: '#menuRows', exp: '#expRows' }[k];
      $(box).insertAdjacentHTML('beforeend', k === 'mem' || k === 'exp' ? simple : matRowHtml({ id: uid(), name: '', price: 0 }));
      $(box).lastElementChild.querySelector('input').focus();
    }
  };
  const priced = (sel) => [...document.querySelectorAll(sel + ' .edit-row')]
    .map((r) => ({ id: r.dataset.id, name: r.querySelector('[name=n]').value.trim(), price: num(r.querySelector('[name=p]').value) }))
    .filter((m) => m.name);
  form.onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(form);
    s.members = [...document.querySelectorAll('#memRows .edit-row')].map((r) => ({ id: r.dataset.id, name: r.querySelector('input').value.trim() })).filter((m) => m.name);
    s.materials = priced('#setMatRows');
    s.menus = priced('#menuRows');
    s.expenseItems = [...document.querySelectorAll('#expRows input')].map((i) => i.value.trim()).filter(Boolean);
    s.parking = { t1: num(f.get('t1')), a1: num(f.get('a1')), t2: num(f.get('t2')), a2: num(f.get('a2')) };
    s.defaultVenue = f.get('venue').trim();
    persist();
    render();
    toast('設定を保存しました');
  };
}

// ---------- バックアップ ----------
function renderBackup() {
  main.innerHTML = `
    <section class="panel">
      <h2>💾 バックアップ・他の端末へ移す</h2>
      <p class="hint">データはこの端末のブラウザの中だけにあります。パソコンと携帯で同じデータを使うときは、片方で「書き出し」したファイルをもう片方で「読み込み」してください。</p>
      <p>最後のバックアップ：${db.lastBackup ? esc(new Date(db.lastBackup).toLocaleString('ja-JP')) : 'まだありません'}</p>
      <button type="button" class="btn primary block" data-act="export-json">📥 バックアップを書き出す（.json）</button>
      ${navigator.share ? '<button type="button" class="btn block" data-act="share-json">📤 共有メニューから送る（LINE・メールなど）</button>' : ''}
      <label class="btn block file-btn">📂 バックアップを読み込む<input type="file" id="importFile" accept=".json,application/json" hidden></label>
    </section>
    <section class="panel">
      <h2>📊 Excel 用に書き出す</h2>
      <p class="hint">会ごとの精算と明細を CSV で書き出します。Excel・Numbers・Google スプレッドシートで開けます。</p>
      <button type="button" class="btn block" data-act="export-csv">📥 CSV を書き出す</button>
    </section>`;
  $('#importFile').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const next = importJson(await file.text());
      if (!confirm(`${next.events.length}回分の会のデータを読み込みます。今この端末にあるデータは置き換わります。よろしいですか？`)) return;
      db = next;
      persist();
      toast('読み込みました');
      state.tab = 'events';
      render();
    } catch (err) {
      alert('読み込めませんでした：' + err.message);
    }
  };
}

function backupFile() {
  const name = `taikenkai-backup-${todayStr()}.json`;
  return new File([exportJson(db)], name, { type: 'application/json' });
}

function download(file) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

function markBackup() {
  db.lastBackup = new Date().toISOString();
  persist();
  renderBackup();
  renderNotices();
}

// ---------- シート（下から出る入力画面） ----------
function openSheet(html) {
  $('#sheetBody').innerHTML = html;
  $('#sheet').hidden = false;
  $('#sheetBackdrop').hidden = false;
  document.body.classList.add('sheet-open');
}
function closeSheet() {
  $('#sheet').hidden = true;
  $('#sheetBackdrop').hidden = true;
  document.body.classList.remove('sheet-open');
}

// ---------- 操作 ----------
document.addEventListener('click', async (e) => {
  const t = e.target;
  const tab = t.closest('.tabbar button');
  if (tab && !tab.disabled) { state.tab = tab.dataset.tab; render(); return; }
  const go = t.closest('[data-go]');
  if (go) { state.tab = go.dataset.go; render(); return; }
  const open = t.closest('[data-open]');
  if (open) { state.eventId = open.dataset.open; state.tab = 'event'; render(); return; }
  if (t === $('#sheetBackdrop')) { closeSheet(); return; }

  const ev = currentEvent();
  const part = t.closest('[data-part]');
  if (part) { openParticipant(ev.participants.find((p) => p.id === part.dataset.part)); return; }

  const step = t.closest('[data-step]');
  if (step) {
    const { mat, mem } = step.dataset;
    setUsage(ev, mat, mem, usageCount(ev, mat, mem) + num(step.dataset.step));
    const input = document.querySelector(`input.cnt[data-mat="${mat}"][data-mem="${mem}"]`);
    input.value = usageCount(ev, mat, mem) || '';
    persist();
    refreshCalc();
    return;
  }
  const addExp = t.closest('[data-add-exp]');
  if (addExp) {
    ev.expenses.push({ id: uid(), name: addExp.dataset.addExp, amount: 0, paidBy: '' });
    persist();
    render();
    const last = document.querySelectorAll('.exp-row');
    const row = last[last.length - 1];
    row.scrollIntoView({ block: 'center' });
    row.querySelector(addExp.dataset.addExp ? '.exp-amt' : '.exp-name').focus();
    return;
  }
  const delExp = t.closest('[data-del-exp]');
  if (delExp) {
    ev.expenses = ev.expenses.filter((x) => x.id !== delExp.dataset.delExp);
    persist();
    render();
    return;
  }

  const act = t.closest('[data-act]');
  if (!act) return;
  switch (act.dataset.act) {
    case 'close': closeSheet(); break;
    case 'new-event': openEventForm(null); break;
    case 'edit-event': openEventForm(ev); break;
    case 'del-event':
      if (confirm(`「${ev.name}」（${dateLabel(ev.date)}）を削除します。元に戻せません。よろしいですか？`)) {
        db.events = db.events.filter((x) => x.id !== ev.id);
        state.eventId = null;
        state.tab = 'events';
        persist();
        closeSheet();
        render();
        toast('削除しました');
      }
      break;
    case 'add-part': openParticipant(null); break;
    case 'del-part': {
      const p = ev.participants.find((x) => x.id === openParticipant.editing);
      if (p && confirm(`${p.name || 'この参加者'}を削除しますか？`)) {
        ev.participants = ev.participants.filter((x) => x !== p);
        persist();
        closeSheet();
        render();
      }
      break;
    }
    case 'edit-mats': openMaterialsForm(); break;
    case 'reset-settings':
      if (confirm('材料・メニュー・人・経費項目を最初の設定に戻します。会の記録は消えません。よろしいですか？')) {
        db.settings = defaultSettings();
        persist();
        render();
        toast('最初の設定に戻しました');
      }
      break;
    case 'export-json': download(backupFile()); markBackup(); break;
    case 'share-json':
      try {
        await navigator.share({ files: [backupFile()], title: '体験会の精算 バックアップ' });
        markBackup();
      } catch (err) { /* キャンセル */ }
      break;
    case 'export-csv':
      download(new File([exportCsv(db)], `taikenkai-${todayStr()}.csv`, { type: 'text/csv' }));
      break;
  }
});

// 材料の回数・経費の入力（その場で保存して金額を更新）
main.addEventListener('input', (e) => {
  const ev = currentEvent();
  const el = e.target;
  if (!ev) return;
  if (el.classList.contains('cnt')) {
    setUsage(ev, el.dataset.mat, el.dataset.mem, el.value);
  } else if (el.dataset.exp) {
    const x = ev.expenses.find((y) => y.id === el.dataset.exp);
    x[el.dataset.f] = el.dataset.f === 'amount' ? num(el.value) : el.value;
  } else return;
  persist();
  refreshCalc();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });

render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
