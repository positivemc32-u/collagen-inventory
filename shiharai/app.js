// =============================================================
// app.js … 画面の表示とボタン操作
// =============================================================

let db = loadDb();
const state = {
  tab: 'schedule',
  month: todayStr().slice(0, 7), // 見ている月
};

const $ = (sel) => document.querySelector(sel);
const main = $('#main');

// HTML に文字を入れるときの安全対策（< > などを無害化）
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function persist() { saveDb(db); }
function mon() { return ensureMonth(db, state.month); }
function accountName(id) { const a = db.accounts.find((x) => x.id === id); return a ? a.name : ''; }
function cardName(id) { const c = db.cards.find((x) => x.id === id); return c ? c.name : ''; }
function amountValue(n) { return n ? Number(n).toLocaleString('ja-JP') : ''; }

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.hidden = true; }, 2400);
}

// ---------- 選ぶ欄（最後に「＋ 追加…」があり、その場で増やせる） ----------
function accountSelect(name, value, extra = '') {
  return `<select name="${name}" ${extra}>
    <option value="">（口座を選ぶ）</option>
    ${db.accounts.map((a) => `<option value="${esc(a.id)}" ${a.id === value ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}
    <option value="__new">＋ 銀行を追加…</option>
  </select>`;
}
function cardSelect(name, value, extra = '') {
  return `<select name="${name}" ${extra}>
    <option value="">（カードなし）</option>
    ${db.cards.map((c) => `<option value="${esc(c.id)}" ${c.id === value ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
    <option value="__new">＋ カードを追加…</option>
  </select>`;
}
function kindSelect(name, value) {
  // 前に使っていた種類（今の一覧にないもの）も選べるように残す
  const kinds = value && !KINDS.includes(value) ? [...KINDS, value] : KINDS;
  return `<select name="${name}">${kinds.map((k) => `<option ${k === value ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select>`;
}
function daySelect(name, value) {
  let o = '';
  for (let d = 1; d <= 31; d++) o += `<option value="${d}" ${d === Number(value) ? 'selected' : ''}>${d}日</option>`;
  return `<select name="${name}">${o}</select>`;
}

function addAccount() {
  const name = (prompt('追加する銀行（口座）の名前\n例：○○銀行 本人') || '').trim();
  if (!name) return '';
  const a = { id: uid(), name };
  db.accounts.push(a);
  persist();
  toast('「' + name + '」を追加しました');
  return a.id;
}
function addCard() {
  const name = (prompt('追加するカードの名前\n例：○○カード 本人') || '').trim();
  if (!name) return '';
  const c = { id: uid(), name, accountId: '' };
  db.cards.push(c);
  persist();
  toast('「' + name + '」を追加しました（引き落とし口座は「⚙️ 設定」で決められます）');
  return c.id;
}

// ---------- 全体の描画 ----------
const TITLES = { schedule: '支払いの予定', banks: '通帳と差額', backup: 'バックアップ', settings: '設定' };
const RESTORE_UNDO_KEY = STORAGE_KEY + '-before-restore';

function render() {
  $('#pageTitle').textContent = TITLES[state.tab];
  $('#monthLabel').textContent = monthJa(state.month);
  $('.month-nav').hidden = state.tab === 'settings' || state.tab === 'backup';
  document.querySelectorAll('.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === state.tab));
  ({ schedule: renderSchedule, banks: renderBanks, backup: renderBackup, settings: renderSettings })[state.tab]();
  renderNotices();
  if (state.tab !== render.lastTab) window.scrollTo(0, 0);
  render.lastTab = state.tab;
}

// ---------- 📅 予定 ----------
function sortedItems() {
  return mon().items.slice().sort((a, b) => a.day - b.day);
}

function renderSchedule() {
  const m = mon();
  const sum = summarize(db, state.month);
  const items = sortedItems();
  const groups = [];
  items.forEach((it) => {
    const g = groups[groups.length - 1];
    if (g && g.day === it.day) g.items.push(it); else groups.push({ day: it.day, items: [it] });
  });

  main.innerHTML = `
    <div class="total-card">
      <div class="total-label">${monthJa(state.month)}の支払い 合計</div>
      <div class="total-value">${yen(sum.total)}</div>
      <div class="total-sub">まだの分 ${yen(sum.unpaid)}　／　済み ${yen(sum.total - sum.unpaid)}</div>
    </div>
    ${!db.accounts.length ? `<div class="notice">🏦 はじめに「⚙️ 設定」で、使っている銀行（口座）とカードを入れてください。入れた内容はこの端末の中だけに保存されます。</div>` : ''}
    ${sum.unassigned.length ? `<div class="notice">⚠️ 口座が決まっていない支払いが ${sum.unassigned.length} 件あります。口座を選ぶと「🏦 通帳・差額」で計算されます。</div>` : ''}

    ${groups.length ? groups.map((g) => {
      const pd = payDate(state.month, g.day);
      const total = g.items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
      return `
      <section class="day-group">
        <div class="day-head">
          <span class="day-num">${g.day}日</span>
          <span class="day-week">（${WEEK[weekdayOf(state.month, g.day)]}）</span>
          ${pd.shifted ? `<span class="badge warn">土日 → ${pd.date.getMonth() + 1}/${pd.date.getDate()}（${WEEK[pd.date.getDay()]}）引き落とし</span>` : ''}
          <span class="day-total">${yen(total)}</span>
        </div>
        ${g.items.map(itemCard).join('')}
      </section>`;
    }).join('') : '<p class="empty">この月の支払いはまだありません</p>'}

    <div class="row-actions">
      <button type="button" class="btn" data-act="addItem">＋ 支払いを足す</button>
      <button type="button" class="btn" data-act="addCashingItem">＋ 前月からのキャッシング</button>
    </div>

    <section class="panel">
      <div class="panel-head"><h2>💳 この月にキャッシングした分</h2></div>
      <span class="hint">ここに入れておくと、次の月を開いたときに「前月からのキャッシング」として自動で入ります。</span>
      ${(m.cashing || []).map((c) => `
        <div class="cash-row" data-cash="${esc(c.id)}">
          ${cardSelect('cashCard', c.cardId)}
          <input name="cashAmount" inputmode="numeric" placeholder="金額" value="${esc(amountValue(c.amount))}">
          <button type="button" class="icon-btn" data-act="delCashing" aria-label="削除">🗑</button>
        </div>`).join('') || '<p class="empty small">まだありません</p>'}
      <button type="button" class="btn small" data-act="addCashing">＋ キャッシングを記録</button>
    </section>
  `;
}

function itemCard(it) {
  const showCard = it.cardId || it.kind === 'カード' || it.kind === 'キャッシング';
  return `
  <div class="item ${it.paid ? 'paid' : ''}" data-item="${esc(it.id)}">
    <div class="item-top">
      <span class="kind kind-${esc(it.kind)}">${esc(it.kind)}</span>
      <b class="item-name">${esc(it.name)}${it.cardId ? `<small>　${esc(cardName(it.cardId))}</small>` : ''}</b>
      <button type="button" class="paid-btn" data-act="togglePaid">${it.paid ? '✅ 済' : '⬜ まだ'}</button>
    </div>
    <div class="item-fields">
      <label class="f-amt"><small>金額（円）</small>
        <input name="amount" inputmode="numeric" placeholder="0" value="${esc(amountValue(it.amount))}"></label>
      <label class="f-acc"><small>引き落とし口座</small>${accountSelect('accountId', it.accountId)}</label>
      ${showCard ? `<label class="f-card"><small>カード</small>${cardSelect('cardId', it.cardId)}</label>` : ''}
    </div>
    <details class="item-more">
      <summary>直す・消す</summary>
      <div class="row2">
        <label><small>日にち</small>${daySelect('day', it.day)}</label>
        <label><small>種類</small>${kindSelect('kind', it.kind)}</label>
      </div>
      <label><small>名前</small><input name="name" value="${esc(it.name)}"></label>
      <div class="row-actions"><button type="button" class="btn small danger" data-act="delItem">🗑 この月から消す</button></div>
    </details>
  </div>`;
}

// ---------- 🏦 通帳・差額 ----------
function renderBanks() {
  const sum = summarize(db, state.month);
  const rows = sum.rows.filter((r) => r.items.length || r.hasBalance || r.deposit);
  const others = sum.rows.filter((r) => !rows.includes(r));
  const shortage = rows.filter((r) => r.diff < 0).reduce((s, r) => s - r.diff, 0);
  const totalNeed = rows.reduce((s, r) => s + r.need, 0);
  const totalHave = rows.reduce((s, r) => s + r.balance + r.deposit, 0);

  main.innerHTML = `
    <div class="total-card ${shortage ? 'short' : 'ok'}">
      <div class="total-label">${shortage ? '足りない口座の不足分 合計' : 'すべての口座で足りています'}</div>
      <div class="total-value">${shortage ? yen(shortage) : '👍 OK'}</div>
      <div class="total-sub">支払い（まだの分）${yen(totalNeed)}　／　通帳＋入金 ${yen(totalHave)}</div>
    </div>
    <span class="hint">通帳の残高と、これから入金する額を入れてください。<b>差額 ＝ 通帳の残高 ＋ 入金する額 − まだの支払い</b>（「✅ 済」にした支払いは、もう通帳から引かれている分として数えません）</span>

    ${rows.map(bankCard).join('') || '<p class="empty">支払いに口座を選ぶと、ここに出ます</p>'}

    ${others.length ? `
    <details class="panel">
      <summary><b>ほかの口座（${others.length}）</b> <small>支払いのない口座の残高も入れられます</small></summary>
      ${others.map(bankCard).join('')}
    </details>` : ''}

    ${sum.unassigned.length ? `
    <section class="panel">
      <h2>⚠️ 口座が決まっていない支払い</h2>
      ${sum.unassigned.map((it) => `<div class="pay-line"><span>${it.day}日 ${esc(it.name)}${it.cardId ? '（' + esc(cardName(it.cardId)) + '）' : ''}</span><b>${yen(it.amount)}</b></div>`).join('')}
      <span class="hint">「📅 予定」で口座を選んでください。</span>
    </section>` : ''}
  `;
}

function bankCard(r) {
  const m = mon();
  const items = r.items.slice().sort((a, b) => a.day - b.day);
  // 日にち順に、引き落とし後の残りを出す（入金は先にしておく前提）
  let rest = r.balance + r.deposit;
  return `
  <section class="bank ${r.diff < 0 ? 'short' : ''}" data-account="${esc(r.account.id)}">
    <h2>${esc(r.account.name)}</h2>
    <div class="row2">
      <label><small>通帳にある金額</small>
        <input name="balance" inputmode="numeric" placeholder="0" value="${esc(amountValue(m.balances[r.account.id]))}"></label>
      <label><small>入金する額</small>
        <input name="deposit" inputmode="numeric" placeholder="0" value="${esc(amountValue(m.deposits[r.account.id]))}"></label>
    </div>
    ${items.length ? `<div class="pay-list">
      ${items.map((it) => {
        if (!it.paid) rest -= Number(it.amount) || 0;
        return `<div class="pay-line ${it.paid ? 'done' : ''}">
          <span>${it.day}日 ${esc(it.name)}${it.cardId ? '<small>（' + esc(cardName(it.cardId)) + '）</small>' : ''}${it.paid ? ' ✅' : ''}</span>
          <b>${yen(it.amount)}</b>
          ${it.paid ? '' : `<small class="rest ${rest < 0 ? 'minus' : ''}">残り ${rest < 0 ? '−' + yen(-rest) : yen(rest)}</small>`}
        </div>`;
      }).join('')}
    </div>` : ''}
    <div class="diff-box">
      <div><span>まだの支払い</span><b>${yen(r.need)}</b></div>
      <div class="diff ${r.diff < 0 ? 'minus' : 'plus'}">
        <span>差額</span>
        <b>${r.diff < 0 ? '−' + yen(-r.diff) : yen(r.diff)}</b>
      </div>
      <div class="diff-msg">${r.diff < 0 ? `あと <b>${yen(-r.diff)}</b> 入金が必要です` : (r.need ? '足りています' : '')}</div>
      ${r.diff < 0 ? `<button type="button" class="btn small" data-act="fillDeposit">不足分を「入金する額」に足す</button>` : ''}
    </div>
  </section>`;
}

// ---------- ⚙️ 設定 ----------
function renderSettings() {
  main.innerHTML = `
    <section class="panel">
      <h2>🏦 銀行（口座）</h2>
      ${db.accounts.map((a) => `
        <div class="set-row" data-account="${esc(a.id)}">
          <input name="accName" value="${esc(a.name)}">
          <button type="button" class="icon-btn" data-act="delAccount" aria-label="削除">🗑</button>
        </div>`).join('')}
      <button type="button" class="btn small" data-act="newAccount">＋ 銀行を追加</button>
    </section>

    <section class="panel">
      <h2>💳 カード</h2>
      <span class="hint">引き落とし口座を決めておくと、支払いでカードを選んだときに口座が自動で入ります。</span>
      ${db.cards.map((c) => `
        <div class="set-row card-row" data-card="${esc(c.id)}">
          <input name="cardName" value="${esc(c.name)}">
          ${accountSelect('cardAccount', c.accountId)}
          <button type="button" class="icon-btn" data-act="delCard" aria-label="削除">🗑</button>
        </div>`).join('')}
      <button type="button" class="btn small" data-act="newCard">＋ カードを追加</button>
    </section>

    <section class="panel">
      <h2>📅 毎月の支払い（ひな形）</h2>
      <span class="hint">新しい月を開いたときに、ここから予定が作られます。金額は前の月に入れた金額を引き継ぎます（初めての月はここの金額）。
        すでに開いた月には反映されないので、その月は「📅 予定」で直してください。</span>
      ${db.template.slice().sort((a, b) => a.day - b.day).map((t) => `
        <div class="tmpl" data-tmpl="${esc(t.id)}">
          <div class="row2">
            <label><small>日にち</small>${daySelect('day', t.day)}</label>
            <label><small>種類</small>${kindSelect('kind', t.kind)}</label>
          </div>
          <label><small>名前</small><input name="name" value="${esc(t.name)}"></label>
          <div class="row2">
            <label><small>カード</small>${cardSelect('cardId', t.cardId)}</label>
            <label><small>引き落とし口座</small>${accountSelect('accountId', t.accountId)}</label>
          </div>
          <label><small>いつもの金額（円）</small><input name="amount" inputmode="numeric" placeholder="0" value="${esc(amountValue(t.amount))}"></label>
          <div class="row-actions"><button type="button" class="btn small danger" data-act="delTmpl">🗑 ひな形から消す</button></div>
        </div>`).join('')}
      <button type="button" class="btn small" data-act="newTmpl">＋ 毎月の支払いを足す</button>
    </section>

  `;
}

// ---------- 入力の反映 ----------
function findItem(el) {
  const box = el.closest('[data-item]');
  return box && mon().items.find((x) => x.id === box.dataset.item);
}

// 「＋ 追加…」が選ばれたら、その場で追加して選び直す
function pickNew(el, kind) {
  const id = kind === 'card' ? addCard() : addAccount();
  if (!id) el.value = el.dataset.prev || '';
  return id;
}

main.addEventListener('focusin', (e) => { if (e.target.tagName === 'SELECT') e.target.dataset.prev = e.target.value; });

main.addEventListener('change', (e) => {
  const el = e.target;
  if (el.id === 'importFile') { const f = el.files[0]; el.value = ''; return importBackup(f); }
  let v = el.value;
  if (v === '__new') {
    v = pickNew(el, el.name.toLowerCase().includes('card') && el.name !== 'cardAccount' ? 'card' : 'account');
    if (!v) return;
  }

  const it = findItem(el);
  if (it) {
    if (el.name === 'amount') it.amount = toNum(v);
    else if (el.name === 'accountId') it.accountId = v;
    else if (el.name === 'cardId') { it.cardId = v; const acc = cardAccount(db, v); if (acc) it.accountId = acc; }
    else if (el.name === 'day') it.day = Number(v);
    else if (el.name === 'kind') it.kind = v;
    else if (el.name === 'name') it.name = v.trim() || it.name;
    persist();
    return render();
  }

  const cash = el.closest('[data-cash]');
  if (cash) {
    const c = mon().cashing.find((x) => x.id === cash.dataset.cash);
    if (el.name === 'cashCard') c.cardId = v;
    if (el.name === 'cashAmount') c.amount = toNum(v);
    persist();
    return render();
  }

  const bank = el.closest('.bank[data-account]');
  if (bank) {
    const m = mon();
    const key = el.name === 'balance' ? 'balances' : 'deposits';
    if (String(v).trim() === '') delete m[key][bank.dataset.account]; else m[key][bank.dataset.account] = toNum(v);
    persist();
    return render();
  }

  const accRow = el.closest('.set-row[data-account]');
  if (accRow && el.name === 'accName') {
    const a = db.accounts.find((x) => x.id === accRow.dataset.account);
    if (v.trim()) a.name = v.trim();
    persist();
    return toast('保存しました');
  }

  const cardRow = el.closest('[data-card]');
  if (cardRow) {
    const c = db.cards.find((x) => x.id === cardRow.dataset.card);
    if (el.name === 'cardName' && v.trim()) c.name = v.trim();
    if (el.name === 'cardAccount') c.accountId = v;
    persist();
    return render();
  }

  const tmpl = el.closest('[data-tmpl]');
  if (tmpl) {
    const t = db.template.find((x) => x.id === tmpl.dataset.tmpl);
    if (el.name === 'amount') t.amount = toNum(v);
    else if (el.name === 'day') t.day = Number(v);
    else if (el.name === 'cardId') { t.cardId = v; const acc = cardAccount(db, v); if (acc) t.accountId = acc; }
    else if (el.name === 'name') t.name = v.trim() || t.name;
    else t[el.name] = v;
    persist();
    return render();
  }
});

// ---------- ボタン ----------
document.addEventListener('click', (e) => {
  const tabBtn = e.target.closest('.tabbar button');
  if (tabBtn) { state.tab = tabBtn.dataset.tab; return render(); }
  const go = e.target.closest('[data-go]');
  if (go) { state.tab = go.dataset.go; return render(); }
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const m = state.tab === 'settings' || state.tab === 'backup' ? null : mon();
  const it = findItem(btn);

  switch (btn.dataset.act) {
    case 'prev': state.month = addMonth(state.month, -1); break;
    case 'next': state.month = addMonth(state.month, 1); break;
    case 'thisMonth': state.month = todayStr().slice(0, 7); break;

    case 'togglePaid': it.paid = !it.paid; persist(); break;
    case 'delItem':
      if (!confirm('「' + it.name + '」を' + monthJa(state.month) + 'の予定から消しますか？\n（毎月のひな形は残ります）')) return;
      m.items = m.items.filter((x) => x !== it); persist(); break;
    case 'addItem': {
      const name = (prompt('支払いの名前（例：電気代、保険）') || '').trim();
      if (!name) return;
      const day = Number(prompt('何日に払いますか？（1〜31）', '27')) || 27;
      m.items.push({ id: uid(), templateId: '', day: Math.min(31, Math.max(1, day)), name, kind: 'その他', cardId: '', accountId: '', amount: 0, paid: false });
      persist();
      toast('毎月払うものは「⚙️ 設定」のひな形に足すと、次の月から自動で入ります');
      break;
    }
    case 'addCashingItem': m.items.push(cashingItem(db, db.cards[0] ? db.cards[0].id : '', 0)); persist(); break;
    case 'addCashing': m.cashing = m.cashing || []; m.cashing.push({ id: uid(), cardId: db.cards[0] ? db.cards[0].id : '', amount: 0 }); persist(); break;
    case 'delCashing': { const id = btn.closest('[data-cash]').dataset.cash; m.cashing = m.cashing.filter((x) => x.id !== id); persist(); break; }

    case 'fillDeposit': {
      const id = btn.closest('[data-account]').dataset.account;
      const r = summarize(db, state.month).rows.find((x) => x.account.id === id);
      m.deposits[id] = (Number(m.deposits[id]) || 0) - r.diff;
      persist();
      toast('入金する額を ' + yen(m.deposits[id]) + ' にしました');
      break;
    }

    case 'newAccount': addAccount(); break;
    case 'delAccount': {
      const id = btn.closest('[data-account]').dataset.account;
      if (!confirm('「' + accountName(id) + '」を消しますか？\n（この口座を選んでいた支払いは「口座なし」になります）')) return;
      db.accounts = db.accounts.filter((x) => x.id !== id);
      persist();
      break;
    }
    case 'newCard': addCard(); break;
    case 'delCard': {
      const id = btn.closest('[data-card]').dataset.card;
      if (!confirm('「' + cardName(id) + '」を消しますか？')) return;
      db.cards = db.cards.filter((x) => x.id !== id);
      persist();
      break;
    }
    case 'newTmpl': db.template.push({ id: uid(), day: 27, name: '新しい支払い', kind: 'その他', accountId: '', cardId: '', amount: 0 }); persist(); break;
    case 'delTmpl': {
      const id = btn.closest('[data-tmpl]').dataset.tmpl;
      const t = db.template.find((x) => x.id === id);
      if (!confirm('「' + t.name + '」を毎月のひな形から消しますか？\n（すでに開いた月の予定は残ります）')) return;
      db.template = db.template.filter((x) => x.id !== id);
      persist();
      break;
    }
    case 'backup-download': downloadFile(backupFile()); markBackup('download'); toast('この端末に保存しました'); return;
    case 'backup-share': backupShare(); return;
    case 'restore-undo': restoreUndo(); return;
    default: return;
  }
  render();
});

// ---------- バックアップ ----------
function downloadFile(file) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

// 14日以上バックアップしていないと、画面の上にお知らせを出す
function renderNotices() {
  const box = $('#notices');
  const used = Object.keys(db.months).length > 0 && db.accounts.length > 0;
  const days = db.lastBackup ? (Date.now() - new Date(db.lastBackup).getTime()) / 86400000 : Infinity;
  box.innerHTML = used && days > 14 && state.tab !== 'backup'
    ? `<div class="notice">💾 ${db.lastBackup ? Math.floor(days) + '日' : 'まだ一度も'}バックアップしていません。<button type="button" class="link" data-go="backup">バックアップする</button></div>`
    : '';
}

function fmtDateTime(iso) {
  const d = new Date(iso);
  return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

const LOG_LABEL = { download: '📥 この端末に保存', share: '📤 共有メニューで送った', restore: '📂 読み込んだ', undo: '↩️ 読み込む前に戻した' };

function hasRestoreUndo() {
  try { return !!localStorage.getItem(RESTORE_UNDO_KEY); } catch (e) { return false; }
}

function renderBackup() {
  const months = Object.keys(db.months).sort();
  main.innerHTML = `
    <section class="panel">
      <h2>💾 バックアップ・他の端末へ移す</h2>
      <span class="hint">銀行・カード・毎月の支払い（ひな形）・月ごとの記録（金額・通帳の残高など）を、まるごと1つのファイル（.json）にします。機種変更や、パソコンと携帯で同じデータを使うときは、片方で書き出したファイルをもう片方で読み込んでください。</span>
      <div class="backup-now">
        <div>いまのデータ：<b>銀行 ${db.accounts.length}・カード ${db.cards.length}・記録 ${months.length}か月分</b>${months.length ? `（${monthJa(months[0])}〜${monthJa(months[months.length - 1])}）` : ''}</div>
        <div>最後のバックアップ：<b>${db.lastBackup ? esc(fmtDateTime(db.lastBackup)) : 'まだありません'}</b></div>
      </div>
      <button type="button" class="btn primary block" data-act="backup-download">📥 バックアップをこの端末に保存</button>
      ${navigator.share ? '<button type="button" class="btn block" data-act="backup-share">📤 共有メニューから保存・送る（"ファイル"・iCloud・LINEなど）</button>' : ''}
      <span class="hint">🔒 ファイルには銀行の名前や残高が入っています。自分だけが見られる場所（iPhone の「ファイル」、iCloud Drive、Google ドライブなど）に保存してください。GitHub には入れないでください。</span>
    </section>
    <section class="panel">
      <h2>📂 バックアップから戻す</h2>
      <span class="hint">読み込むと、今この端末にあるデータがファイルの内容に置き換わります（読み込む前の状態は1回分とっておくので、すぐ元に戻せます）。</span>
      <label class="btn block file-btn">📂 バックアップファイルを選ぶ<input type="file" id="importFile" accept=".json,application/json" hidden></label>
      ${hasRestoreUndo() ? '<button type="button" class="btn block" data-act="restore-undo">↩️ 読み込む前の状態に戻す</button>' : ''}
    </section>
    <section class="panel">
      <h2>📚 バックアップの履歴</h2>
      ${db.backupLog.length ? `<table class="result">
        <tr><th>日時</th><th>したこと</th><th class="num">中身</th></tr>
        ${db.backupLog.map((l) => `<tr><td>${esc(fmtDateTime(l.at))}</td><td>${esc(LOG_LABEL[l.type] || l.type)}${l.from ? `<br><small>${esc(l.from)}</small>` : ''}</td><td class="num">${l.months}か月分<br><small>銀行 ${l.accounts}</small></td></tr>`).join('')}
      </table>` : '<p class="empty small">まだありません</p>'}
    </section>`;
}

function backupFile() {
  const d = new Date();
  const stamp = todayStr().replace(/-/g, '') + '-' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0');
  return new File([backupJson(db)], 'shiharai-backup-' + stamp + '.json', { type: 'application/json' });
}

function markBackup(type) {
  db.lastBackup = new Date().toISOString();
  addBackupLog(db, { type });
  persist();
  render();
}

async function backupShare() {
  const file = backupFile();
  if (navigator.canShare && !navigator.canShare({ files: [file] })) { downloadFile(file); markBackup('download'); toast('この端末に保存しました'); return; }
  try {
    await navigator.share({ files: [file], title: '支払い バックアップ' });
    markBackup('share');
    toast('バックアップしました');
  } catch (e) {
    if (e.name === 'AbortError') return;
    downloadFile(file);
    markBackup('download');
    toast('共有できなかったので、この端末に保存しました');
  }
}

async function importBackup(file) {
  if (!file) return;
  try {
    const { db: next, exportedAt } = parseBackup(await file.text());
    const when = exportedAt ? fmtDateTime(exportedAt) + ' に書き出した' : '';
    if (!confirm(`${when}バックアップを読み込みます。\n銀行 ${next.accounts.length}・カード ${next.cards.length}・記録 ${Object.keys(next.months).length}か月分\n\n今この端末にあるデータは置き換わります。よろしいですか？`)) return;
    try { localStorage.setItem(RESTORE_UNDO_KEY, JSON.stringify(db)); } catch (err) { /* 容量不足でも読み込みは続ける */ }
    next.lastBackup = db.lastBackup;
    next.backupLog = db.backupLog;
    db = next;
    addBackupLog(db, { type: 'restore', from: file.name });
    persist();
    toast('読み込みました');
    render();
  } catch (err) {
    alert('読み込めませんでした：' + err.message);
  }
}

function restoreUndo() {
  let prev = null;
  try { prev = JSON.parse(localStorage.getItem(RESTORE_UNDO_KEY)); } catch (e) { prev = null; }
  if (!prev) { toast('戻せるデータがありません'); return; }
  if (!confirm('読み込む前の状態に戻しますか？')) return;
  const log = db.backupLog;
  db = normalizeDb(prev);
  db.backupLog = log;
  addBackupLog(db, { type: 'undo' });
  persist();
  try { localStorage.removeItem(RESTORE_UNDO_KEY); } catch (e) { /* 消せなくても困らない */ }
  toast('元に戻しました');
  render();
}

render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
