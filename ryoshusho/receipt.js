// =============================================================
// receipt.js … 領収書の画像を描く・PNG / PDF にする
// 外部のライブラリは使わず、ブラウザの機能だけで作っています（オフラインでも動きます）。
// =============================================================

// A5 縦（148×210mm）を 1240×1754 ピクセルで描きます（約 213dpi）
const RC_W = 1240;
const RC_H = 1754;
const GOTHIC = '"Hiragino Kaku Gothic ProN","Hiragino Sans","Noto Sans JP","Noto Sans CJK JP","Yu Gothic","Meiryo",sans-serif';
const MINCHO = '"Hiragino Mincho ProN","Yu Mincho","Noto Serif JP","Noto Serif CJK JP","MS PMincho",serif';
const INK = '#1d2433';
const SUB = '#5b6475';
const RULE = '#9aa3b2';
const MAX_ITEMS = 8;

function drawReceipt(canvas, r, issuer) {
  canvas.width = RC_W;
  canvas.height = RC_H;
  const c = canvas.getContext('2d');
  const L = 96;
  const R = RC_W - 96;
  const { total, taxes } = calcReceipt(r);

  const font = (size, opt = {}) => { c.font = (opt.bold ? '700 ' : '400 ') + size + 'px ' + (opt.mincho ? MINCHO : GOTHIC); };
  const text = (s, x, y, align = 'left', color = INK) => { c.fillStyle = color; c.textAlign = align; c.fillText(s, x, y); };
  // 枠に収まらない長い文字は小さくする
  const fit = (s, maxW, size, opt) => {
    let sz = size;
    font(sz, opt);
    while (sz > 14 && c.measureText(s).width > maxW) { sz -= 2; font(sz, opt); }
  };
  const line = (x1, y1, x2, y2, w = 2, color = RULE) => {
    c.strokeStyle = color; c.lineWidth = w; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
  };

  c.fillStyle = '#fff';
  c.fillRect(0, 0, RC_W, RC_H);
  c.textBaseline = 'alphabetic';
  // 外枠（二重線）
  c.strokeStyle = '#3a6ea5';
  c.lineWidth = 6; c.strokeRect(40, 40, RC_W - 80, RC_H - 80);
  c.lineWidth = 2; c.strokeRect(54, 54, RC_W - 108, RC_H - 108);

  // 右上：番号・発行日
  font(30);
  text('No. ' + noLabel(r.no), R, 128, 'right', SUB);
  text('発行日　' + dateJa(r.date), R, 172, 'right', SUB);

  // タイトル
  font(88, { bold: true, mincho: true });
  text('領　収　書', RC_W / 2, 290, 'center');

  // 宛名（空欄なら手書き用の線だけ）
  if (r.recipient) { fit(r.recipient, 700, 52, { mincho: true }); text(r.recipient, L + 10, 410); }
  line(L, 430, 860, 430, 3, INK);
  font(46, { mincho: true });
  text('様', 880, 424);

  // 金額
  c.fillStyle = '#eef3f9';
  c.fillRect(L, 480, R - L, 150);
  c.strokeStyle = '#3a6ea5'; c.lineWidth = 3; c.strokeRect(L, 480, R - L, 150);
  font(34, { bold: true });
  text('金額', L + 30, 568, 'left', SUB);
  font(92, { bold: true });
  text(yen(total) + ' -', RC_W / 2 + 40, 588, 'center');
  font(28);
  text('（税込）', R - 24, 600, 'right', SUB);

  // 但し書き
  font(36, { mincho: true });
  text('但し', L + 10, 702);
  fit(r.tadashi || '', 840, 38, { mincho: true });
  text(r.tadashi || '', L + 110, 702);
  line(L, 720, R, 720, 2, RULE);
  font(32, { mincho: true });
  text('上記正に領収いたしました', L + 10, 780);

  // 明細
  const items = r.items.filter((it) => it.name || Number(it.price)).slice(0, MAX_ITEMS);
  const cols = [L, 640, 770, 950, R];
  let y = 820;
  const rowH = 54;
  c.fillStyle = '#eef3f9';
  c.fillRect(L, y, R - L, rowH);
  font(26, { bold: true });
  ['品名', '数量', '単価', '金額'].forEach((h, i) => text(h, (cols[i] + cols[i + 1]) / 2, y + 36, 'center', SUB));
  line(L, y, R, y, 2, RULE);
  y += rowH;
  const rows = Math.max(items.length, 3);
  for (let i = 0; i < rows; i++) {
    line(L, y, R, y, 1, '#d5dae3');
    const it = items[i];
    if (it) {
      const name = (it.rate === 8 ? '※ ' : '') + (it.name || '');
      fit(name, cols[1] - cols[0] - 30, 28);
      text(name, cols[0] + 14, y + 37);
      font(28);
      text(String(it.qty), cols[2] - 20, y + 37, 'right');
      text(yen(Number(it.price) || 0), cols[3] - 20, y + 37, 'right');
      text(yen(Math.round((Number(it.qty) || 0) * (Number(it.price) || 0))), cols[4] - 14, y + 37, 'right');
    }
    y += rowH;
  }
  line(L, y, R, y, 2, RULE);
  for (let i = 1; i < cols.length - 1; i++) line(cols[i], 820, cols[i], y, 1, '#d5dae3');
  line(L, 820, L, y, 2, RULE);
  line(R, 820, R, y, 2, RULE);

  // 税率ごとの内訳（インボイスの必須項目）
  y += 50;
  font(28);
  taxes.forEach((t) => {
    const label = t.rate + '%対象' + (t.rate === 8 ? '（軽減税率）' : '');
    text(label, 720, y, 'right', SUB);
    text(yen(t.amount), 900, y, 'right');
    text('（内消費税 ' + yen(t.tax) + '）', R, y, 'right', SUB);
    y += 44;
  });
  font(24);
  if (taxes.some((t) => t.rate === 8)) { text('※印は軽減税率（8%）対象です', L, y, 'left', SUB); y += 40; }
  if (r.payment) { font(26); text('お支払方法：' + r.payment, L, y + 4, 'left', SUB); }

  // 発行元（右下）
  const ix = 560;
  let iy = RC_H - 330;
  line(ix, iy - 44, R, iy - 44, 1, '#d5dae3');
  fit(issuer.name || '', R - ix, 46, { bold: true });
  text(issuer.name || '', ix, iy + 10);
  iy += 64;
  font(26);
  if (issuer.zip) { text('〒' + issuer.zip, ix, iy); iy += 40; }
  if (issuer.address) { fit(issuer.address, R - ix, 26); text(issuer.address, ix, iy); iy += 40; font(26); }
  if (issuer.tel) { text('TEL ' + issuer.tel, ix, iy); iy += 40; }
  if (issuer.regNo) { font(26, { bold: true }); text('登録番号 ' + issuer.regNo, ix, iy); }
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

// 領収書の画像（JPEG）を1枚だけ貼った A5 の PDF を作る
async function canvasToPdf(canvas) {
  const jpg = new Uint8Array(await (await canvasToBlob(canvas, 'image/jpeg', 0.93)).arrayBuffer());
  const pw = 419.53; // A5 の幅（ポイント）
  const ph = 595.28;
  const enc = (s) => new TextEncoder().encode(s);
  const content = 'q ' + pw + ' 0 0 ' + ph + ' 0 0 cm /Im0 Do Q';
  const parts = [];
  const offsets = [];
  let len = 0;
  const push = (p) => { const b = typeof p === 'string' ? enc(p) : p; parts.push(b); len += b.length; };
  push('%PDF-1.4\n');
  const obj = (n, body) => { offsets[n] = len; push(n + ' 0 obj\n'); body(); push('\nendobj\n'); };
  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'));
  obj(3, () => push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pw + ' ' + ph + '] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>'));
  obj(4, () => {
    push('<< /Type /XObject /Subtype /Image /Width ' + canvas.width + ' /Height ' + canvas.height +
      ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpg.length + ' >>\nstream\n');
    push(jpg);
    push('\nendstream');
  });
  obj(5, () => push('<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream'));
  const xref = len;
  let x = 'xref\n0 6\n0000000000 65535 f \n';
  for (let i = 1; i <= 5; i++) x += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  push(x + 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
  return new Blob(parts, { type: 'application/pdf' });
}
