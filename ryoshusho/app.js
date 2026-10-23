// =============================================================
// app.js … 画面の表示とボタン操作
// =============================================================

let db = loadDb();
const state = {
  tab: 'create',
  draft: blankReceipt(db), // いま作っている（または履歴から開いた）領収書
  format: 'png', // 基本は PNG。PDF はその都度切り替え
};

const $ = (sel) => document.querySelector(sel);
const main = $('#main');

// HTML に文字を入れるときの安全対策（< > などを無害化）
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function persist() { saveDb(db); }
function issuers() { return db.settings.issuers; }
function issuerOf(r) { return issuers().find((x) => x.id === r.issuerId) || issuers()[0]; }
function clone(o) { return JSON.parse(JSON.stringify(o)); }

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.hidden = true; }, 2400);
}

// ---------- 全体の描画 ----------
const TITLES = { create: '領収書を作る', history: '発行の履歴', settings: '設定' };

function render() {
  $('#pageTitle').textContent = TITLES[state.tab];
  $('#pageHint').textContent = state.tab === 'create' && state.draft.id ? 'No.' + noLabel(state.draft.no) : '';
  document.querySelectorAll('.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === state.tab));
  ({ create: renderCreate, history: renderHistory, settings: renderSettings })[state.tab]();
  if (state.tab !== render.lastTab) window.scrollTo(0, 0);
  render.lastTab = state.tab;
}

// ---------- 作成 ----------
function renderCreate() {
  const d = state.draft;
  const usedNames = [...new Set(db.receipts.flatMap((r) => r.items.map((it) => it.name)).filter(Boolean))];
  main.innerHTML = `
    ${d.id ? `<div class="notice">No.${noLabel(d.no)}（${dateJa(d.date)}発行）を開いています。直して送り直すと、同じ番号のまま上書きされます。
      <button type="button" class="link" data-act="new">新しく作る</button></div>` : ''}

    <section class="panel">
      ${issuers().length > 1 ? `
        <div class="field"><label>発行元</label>
          <div class="seg">${issuers().map((x) => `
            <label><input type="radio" name="issuer" value="${esc(x.id)}" ${x.id === d.issuerId ? 'checked' : ''}><span>${esc(x.name)}</span></label>`).join('')}
          </div>
        </div>` : ''}
      <div class="row2">
        <div class="field"><label>発行日</label><input type="date" data-f="date" value="${esc(d.date)}"></div>
        <div class="field"><label>宛名 <small>空欄なら手書き用の線だけ</small></label>
          <input type="text" data-f="recipient" value="${esc(d.recipient)}" placeholder="空欄"></div>
      </div>
      <div class="field"><label>但し書き</label>
        <input type="text" data-f="tadashi" value="${esc(d.tadashi)}">
        <div class="chips">${TADASHI_CHOICES.map((t) => `<button type="button" class="chip" data-tadashi="${esc(t)}">${esc(t)}</button>`).join('')}</div>
      </div>
    </section>

    <section class="panel">
      <div class="panel-head"><h2>明細 <small>金額は税込。食品（コラーゲンなど）は税率8%</small></h2></div>
      <datalist id="itemNames">${usedNames.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
      <div class="items">
        ${d.items.map((it, i) => `
          <div class="item-row" data-i="${i}">
            <input class="it-name" type="text" data-it="name" list="itemNames" value="${esc(it.name)}" placeholder="品名（例：施術代）">
            <label class="it-qty"><small>数量</small><input type="number" inputmode="numeric" min="0" data-it="qty" value="${esc(it.qty)}"></label>
            <label class="it-price"><small>単価（税込）</small><input type="number" inputmode="numeric" min="0" data-it="price" value="${it.price ? esc(it.price) : ''}" placeholder="0"></label>
            <label class="it-rate"><small>税率</small><select data-it="rate">
              <option value="10" ${it.rate === 10 ? 'selected' : ''}>10%</option>
              <option value="8" ${it.rate === 8 ? 'selected' : ''}>8%</option>
            </select></label>
            <button type="button" class="icon-btn it-del" data-del="${i}" aria-label="この行を消す" ${d.items.length === 1 ? 'disabled' : ''}>✕</button>
          </div>`).join('')}
      </div>
      ${d.items.length < MAX_ITEMS ? `<button type="button" class="btn small" data-act="addItem">＋ 行を足す</button>` : `<span class="hint">明細は${MAX_ITEMS}行までです</span>`}
      <div class="totals" id="totals"></div>
      <div class="field"><label>お支払方法</label>
        <div class="seg">${PAYMENT_CHOICES.map((p) => `
          <label><input type="radio" name="payment" value="${esc(p)}" ${p === d.payment ? 'checked' : ''}><span>${p ? esc(p) : '書かない'}</span></label>`).join('')}
        </div>
      </div>
    </section>

    <section class="panel">
      <h2>できあがり</h2>
      <canvas id="preview" class="preview"></canvas>
      <div class="field">
        <div class="seg format">
          <label><input type="radio" name="format" value="png" ${state.format === 'png' ? 'checked' : ''}><span>画像（PNG）</span></label>
          <label><input type="radio" name="format" value="pdf" ${state.format === 'pdf' ? 'checked' : ''}><span>PDF</span></label>
        </div>
      </div>
      <button type="button" class="btn primary block" data-act="share">📤 LINE・メールで送る</button>
      <button type="button" class="btn block" data-act="download">⬇ この端末に保存</button>
      <span class="hint">「送る」を押すと共有の画面が出ます。LINE やメールを選んでください。送るか保存すると履歴に残ります。</span>
    </section>
  `;
  updatePreview();
}

// 入力のたびに画面全体を描き直すと入力中の文字が消えるので、プレビューと合計だけ更新する
function updatePreview() {
  const d = state.draft;
  const { total, taxes } = calcReceipt(d);
  const box = $('#totals');
  if (box) {
    box.innerHTML = `<div class="grand"><span>合計（税込）</span><b>${yen(total)}</b></div>` +
      taxes.map((t) => `<div><span>${t.rate}%対象 ${yen(t.amount)}</span><span>内消費税 ${yen(t.tax)}</span></div>`).join('');
  }
  const canvas = $('#preview');
  if (!canvas) return;
  const shown = { ...d, no: d.no == null ? db.settings.nextNo : d.no };
  drawReceipt(canvas, shown, issuerOf(d));
  prepareFile(canvas, shown);
}

// iPhone では「送る」を押してから時間がかかると共有画面が開けないので、ファイルを先に作っておく
let prepared = null;
function prepareFile(canvas, r) {
  const key = state.format + JSON.stringify(r) + JSON.stringify(issuerOf(r));
  if (prepared && prepared.key === key) return prepared.promise;
  const name = 'receipt_No' + noLabel(r.no) + '_' + r.date.replace(/-/g, '') + '.' + state.format;
  const promise = (state.format === 'pdf' ? canvasToPdf(canvas) : canvasToBlob(canvas, 'image/png'))
    .then((blob) => {
      const file = new File([blob], name, { type: blob.type });
      if (prepared && prepared.key === key) prepared.file = file;
      return file;
    });
  prepared = { key, promise, file: null };
  return promise;
}

function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// 送った・保存した領収書を履歴に残す（新しいものには番号を付ける）
function commit() {
  const d = state.draft;
  if (d.id == null) {
    d.id = uid();
    d.no = db.settings.nextNo;
    db.settings.nextNo += 1;
    d.createdAt = new Date().toISOString();
    db.receipts.push(clone(d));
  } else {
    const i = db.receipts.findIndex((r) => r.id === d.id);
    if (i >= 0) db.receipts[i] = clone(d); else db.receipts.push(clone(d));
  }
  db.settings.issuerId = d.issuerId;
  persist();
  render();
}

function checkReady() {
  if (calcReceipt(state.draft).total <= 0) { toast('明細の金額を入れてください'); return false; }
  return true;
}

async function share() {
  if (!checkReady()) return;
  const file = prepared && prepared.file;
  if (!file) { await prepared.promise; toast('準備ができました。もう一度押してください'); return; }
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: '領収書' });
      commit();
      toast('送りました（No.' + noLabel(state.draft.no) + '）');
    } catch (e) {
      if (e.name === 'AbortError') return; // 共有画面を閉じただけ
      downloadFile(file);
      commit();
      toast('共有できなかったので保存しました');
    }
  } else {
    // パソコンなど共有ができないときは保存して、メールに添付してもらう
    downloadFile(file);
    commit();
    toast('保存しました。メールやLINEに添付して送ってください');
  }
}

async function download() {
  if (!checkReady()) return;
  downloadFile(await prepared.promise);
  commit();
  toast('保存しました（No.' + noLabel(state.draft.no) + '）');
}

// ---------- 履歴 ----------
function renderHistory() {
  const list = [...db.receipts].sort((a, b) => b.no - a.no);
  main.innerHTML = list.length ? `
    <div class="cards">
      ${list.map((r) => `
        <div class="card">
          <button type="button" class="hist" data-open="${esc(r.id)}">
            <span class="hist-no">No.${noLabel(r.no)}</span>
            <span class="hist-date">${dateJa(r.date)}</span>
            <span class="hist-amt">${yen(calcReceipt(r).total)}</span>
            <span class="hist-sub">${r.recipient ? esc(r.recipient) + ' 様' : '宛名なし'} ・ ${esc(r.tadashi)} ・ ${esc(issuerOf(r).name)}</span>
          </button>
          <div class="row-actions">
            <button type="button" class="btn small" data-open="${esc(r.id)}">開く・送り直す</button>
            <button type="button" class="btn small" data-copy="${esc(r.id)}">複製して新しく</button>
            <button type="button" class="btn small danger" data-remove="${esc(r.id)}">削除</button>
          </div>
        </div>`).join('')}
    </div>
    <button type="button" class="btn block" data-act="csv">📄 履歴を CSV で書き出す</button>
  ` : '<p class="empty">まだ発行した領収書はありません</p>';
}

function exportCsv() {
  const rows = [['番号', '発行日', '宛名', '但し書き', '合計（税込）', '10%対象', '10%消費税', '8%対象', '8%消費税', 'お支払方法', '発行元']];
  [...db.receipts].sort((a, b) => a.no - b.no).forEach((r) => {
    const { total, taxes } = calcReceipt(r);
    const t = (rate) => taxes.find((x) => x.rate === rate) || { amount: 0, tax: 0 };
    rows.push([noLabel(r.no), r.date, r.recipient, r.tadashi, total, t(10).amount, t(10).tax, t(8).amount, t(8).tax, r.payment, issuerOf(r).name]);
  });
  const csv = '﻿' + rows.map((row) => row.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\r\n');
  downloadFile(new File([csv], 'receipt_history_' + todayStr() + '.csv', { type: 'text/csv' }));
}

// ---------- 設定 ----------
function renderSettings() {
  main.innerHTML = `
    <section class="panel">
      <h2>発行元</h2>
      <span class="hint">領収書の右下に出る情報です。登録番号は人（事業者）ごとに1つなので、同じ人が出すならどの屋号でも同じ番号を使えます。</span>
      ${issuers().map((x, i) => `
        <div class="issuer" data-iss="${i}">
          <div class="field"><label>名前（屋号）</label><input type="text" data-is="name" value="${esc(x.name)}"></div>
          <div class="row2">
            <div class="field"><label>郵便番号</label><input type="text" inputmode="numeric" data-is="zip" value="${esc(x.zip)}"></div>
            <div class="field"><label>電話番号</label><input type="tel" data-is="tel" value="${esc(x.tel)}"></div>
          </div>
          <div class="field"><label>住所</label><input type="text" data-is="address" value="${esc(x.address)}"></div>
          <div class="field"><label>登録番号（インボイス）</label><input type="text" data-is="regNo" value="${esc(x.regNo)}" placeholder="T から始まる13桁"></div>
          ${issuers().length > 1 ? `<button type="button" class="btn small danger" data-deliss="${i}">この発行元を消す</button>` : ''}
        </div>`).join('')}
      <button type="button" class="btn small" data-act="addIssuer">＋ 発行元を足す</button>
    </section>
    <section class="panel">
      <h2>番号</h2>
      <div class="field inline"><label>次に発行する番号</label>
        <input type="number" inputmode="numeric" min="1" id="nextNo" value="${db.settings.nextNo}" style="width:120px"></div>
    </section>
    <section class="panel">
      <h2>このアプリについて</h2>
      <span class="hint">履歴はこの端末のブラウザの中だけに保存されます（インターネットには送られません）。ときどき「履歴」画面から CSV を書き出して保存してください。</span>
      <span class="hint">消費税は税率ごとに合計してから計算し、1円未満は切り捨てています。</span>
    </section>
  `;
}

// ---------- 操作 ----------
main.addEventListener('input', (e) => {
  const t = e.target;
  const d = state.draft;
  if (t.dataset.f) { d[t.dataset.f] = t.value; updatePreview(); return; }
  if (t.dataset.it) {
    const it = d.items[Number(t.closest('.item-row').dataset.i)];
    const k = t.dataset.it;
    it[k] = k === 'name' ? t.value : Number(t.value) || 0;
    updatePreview();
    return;
  }
  if (t.dataset.is) {
    issuers()[Number(t.closest('.issuer').dataset.iss)][t.dataset.is] = t.value.trim();
    persist();
    return;
  }
  if (t.id === 'nextNo') {
    const n = parseInt(t.value, 10);
    if (n >= 1) { db.settings.nextNo = n; persist(); }
  }
});

main.addEventListener('change', (e) => {
  const t = e.target;
  if (t.name === 'issuer') { state.draft.issuerId = t.value; updatePreview(); }
  if (t.name === 'payment') { state.draft.payment = t.value; updatePreview(); }
  if (t.name === 'format') { state.format = t.value; updatePreview(); }
});

main.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const d = state.draft;
  if (b.dataset.tadashi) { d.tadashi = b.dataset.tadashi; renderCreate(); return; }
  if (b.dataset.del != null) { d.items.splice(Number(b.dataset.del), 1); renderCreate(); return; }
  if (b.dataset.open) { state.draft = clone(db.receipts.find((r) => r.id === b.dataset.open)); state.tab = 'create'; render(); return; }
  if (b.dataset.copy) {
    const src = db.receipts.find((r) => r.id === b.dataset.copy);
    state.draft = { ...clone(src), id: null, no: null, date: todayStr(), createdAt: undefined };
    state.tab = 'create';
    render();
    return;
  }
  if (b.dataset.remove) {
    const r = db.receipts.find((x) => x.id === b.dataset.remove);
    if (!confirm('No.' + noLabel(r.no) + ' を履歴から削除しますか？')) return;
    db.receipts = db.receipts.filter((x) => x !== r);
    if (state.draft.id === r.id) state.draft = blankReceipt(db);
    persist();
    render();
    return;
  }
  if (b.dataset.deliss != null) {
    const i = Number(b.dataset.deliss);
    if (!confirm('「' + issuers()[i].name + '」を消しますか？')) return;
    issuers().splice(i, 1);
    if (!issuers().some((x) => x.id === db.settings.issuerId)) db.settings.issuerId = issuers()[0].id;
    persist();
    render();
    return;
  }
  switch (b.dataset.act) {
    case 'new': state.draft = blankReceipt(db); render(); break;
    case 'addItem': d.items.push({ name: '', qty: 1, price: 0, rate: 10 }); renderCreate(); break;
    case 'share': share(); break;
    case 'download': download(); break;
    case 'csv': exportCsv(); break;
    case 'addIssuer':
      issuers().push({ ...issuers()[0], id: uid(), name: '' });
      persist();
      render();
      break;
  }
});

$('#tabbar').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  state.tab = b.dataset.tab;
  render();
});

render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
