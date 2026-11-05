// =============================================================
// export.js … 弥生インポート形式の CSV（Shift-JIS）と Excel ファイルを作る
// =============================================================

// ---------- Shift-JIS へ変換 ----------
// ブラウザの TextDecoder（Shift_JIS → 文字）を使って、逆向きの表を一度だけ作ります。
let sjisTable = null;
function buildSjisTable() {
  const table = new Map();
  const dec = new TextDecoder('shift_jis');
  const leads = [];
  for (let b = 0x81; b <= 0x9f; b++) leads.push(b);
  for (let b = 0xe0; b <= 0xfc; b++) leads.push(b);
  for (const hi of leads) {
    for (let lo = 0x40; lo <= 0xfc; lo++) {
      if (lo === 0x7f) continue;
      const ch = dec.decode(new Uint8Array([hi, lo]));
      if (ch.length === 1 && ch !== '�' && !table.has(ch)) table.set(ch, [hi, lo]);
    }
  }
  for (let b = 0xa1; b <= 0xdf; b++) table.set(dec.decode(new Uint8Array([b])), [b]); // 半角カナ
  // よくある表記ゆれ
  const alias = { '−': '－', '〜': '～', '¥': '\\', '—': '―' };
  for (const [from, to] of Object.entries(alias)) {
    if (!table.has(from) && table.has(to)) table.set(from, table.get(to));
  }
  return table;
}
function toSjisBytes(str) {
  if (!sjisTable) sjisTable = buildSjisTable();
  const out = [];
  for (const ch of str) {
    const c = ch.codePointAt(0);
    if (c < 0x80) out.push(c);
    else out.push(...(sjisTable.get(ch) || [0x3f])); // Shift-JIS にない文字は「?」
  }
  return new Uint8Array(out);
}
function sjisLength(str) { return toSjisBytes(str).length; }
// 弥生の文字数制限（バイト数）に合わせて後ろを切る
function cutBytes(str, max) {
  let s = String(str || '');
  while (s && sjisLength(s) > max) s = s.slice(0, -1);
  return s;
}

// ---------- 弥生インポート形式（仕訳日記帳）----------
// 1行 = 25項目。複数行の伝票は 2110（1行目）・2100（中間）・2101（最終行）、1行だけなら 2000
function yayoiRows(entries, settings) {
  const rows = [];
  for (const e of entries) {
    const lines = e.lines.filter((l) => Number(l.amount));
    const date = e.date.replace(/-/g, '/');
    // 摘要は全角32文字（64バイト）まで。念のため「,」「"」は全角にしておく
    const tekiyo = cutBytes([e.store, e.memo].filter(Boolean).join(' ').replace(/,/g, '、').replace(/"/g, '”'), 64);
    const shiwakeMemo = cutBytes(e.regNo ? '登録番号 ' + e.regNo : '', 180);
    lines.forEach((l, i) => {
      const flag = lines.length === 1 ? '2000' : i === 0 ? '2110' : i === lines.length - 1 ? '2101' : '2100';
      const amount = Math.round(Number(l.amount));
      rows.push([
        flag, '', '', date,
        l.account, '', '', taxKbn(l.rate, e, settings), amount, '',
        e.credit, '', '', '対象外', amount, '',
        tekiyo, '', '', '0', '', shiwakeMemo, '0', '0', 'no',
      ]);
    });
  }
  return rows;
}

const YAYOI_HEADER = [
  '識別フラグ', '伝票No', '決算', '取引日付', '借方勘定科目', '借方補助科目', '借方部門', '借方税区分', '借方金額', '借方税金額',
  '貸方勘定科目', '貸方補助科目', '貸方部門', '貸方税区分', '貸方金額', '貸方税金額', '摘要', '番号', '期日', 'タイプ',
  '生成元', '仕訳メモ', '付箋1', '付箋2', '調整',
];

function csvCell(v) {
  const s = String(v == null ? '' : v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// 弥生に取り込む CSV（見出し行なし・Shift-JIS・改行は CRLF）
function makeYayoiCsv(entries, settings) {
  const text = yayoiRows(entries, settings).map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
  return new Blob([toSjisBytes(text)], { type: 'text/csv;charset=shift_jis' });
}

// Excel（.xlsx）。「一覧」シートと、同じ内容を弥生の形で並べた「弥生インポート形式」シート
function makeExcel(entries, settings) {
  const list = [['日付', '店名', '勘定科目', '税率', '税区分', '金額（税込）', '支払い', '登録番号', 'メモ']];
  let sum = 0;
  for (const e of entries) {
    for (const l of e.lines.filter((x) => Number(x.amount))) {
      const amt = Math.round(Number(l.amount));
      sum += amt;
      const [y, m, d] = e.date.split('-').map(Number);
      list.push([
        new Date(y, m - 1, d), e.store, l.account, l.rate ? l.rate + '%' : '対象外', taxKbn(l.rate, e, settings),
        amt, e.credit, e.regNo || '', e.memo || '',
      ]);
    }
  }
  list.push([], ['', '', '', '', '合計', sum]);
  const ws1 = XLSX.utils.aoa_to_sheet(list, { cellDates: true, dateNF: 'yyyy/mm/dd' });
  ws1['!cols'] = [12, 22, 12, 8, 20, 12, 10, 16, 24].map((w) => ({ wch: w }));
  for (let r = 1; r < list.length; r++) {
    const c = ws1[XLSX.utils.encode_cell({ r, c: 5 })];
    if (c && c.t === 'n') c.z = '#,##0';
    const dc = ws1[XLSX.utils.encode_cell({ r, c: 0 })];
    if (dc && dc.t === 'd') dc.z = 'yyyy/mm/dd';
  }
  const ws2 = XLSX.utils.aoa_to_sheet([YAYOI_HEADER, ...yayoiRows(entries, settings)]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, '一覧');
  XLSX.utils.book_append_sheet(wb, ws2, '弥生インポート形式');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellDates: true });
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// ファイルを渡す：スマホは共有メニュー（メール・LINE・ファイルに保存など）、できなければダウンロード
async function deliverFile(blob, filename) {
  const file = new File([blob], filename, { type: blob.type });
  const mobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
  if (mobile && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return 'shared';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancel';
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  return 'downloaded';
}
