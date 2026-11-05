// =============================================================
// ocr.js … 写真の縮小と、レシートの文字読み取り（Tesseract.js）・内容の推測
// 読み取りはこの端末の中で行います（写真をどこかに送ることはありません）。
// 初回だけ、文字認識のデータ（日本語）をインターネットから取り込みます。
// =============================================================

// 写真を読み込んで、長い辺が max px 以下の canvas にする（白黒・少し濃く）
async function loadImageToCanvas(file, max, gray) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error('画像を開けませんでした'));
      im.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    if (gray) {
      const d = ctx.getImageData(0, 0, c.width, c.height);
      const p = d.data;
      for (let i = 0; i < p.length; i += 4) {
        let v = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
        v = Math.max(0, Math.min(255, (v - 128) * 1.4 + 140)); // コントラストを上げる
        p[i] = p[i + 1] = p[i + 2] = v;
      }
      ctx.putImageData(d, 0, 0);
    }
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(c, quality) {
  return new Promise((resolve) => c.toBlob(resolve, 'image/jpeg', quality));
}

// ---------- 文字認識 ----------
let ocrWorkerPromise = null;
function getOcrWorker(onProgress) {
  getOcrWorker.onProgress = onProgress;
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = Tesseract.createWorker('jpn', 1, {
      workerPath: new URL('vendor/worker.min.js', location.href).href,
      logger: (m) => getOcrWorker.onProgress && getOcrWorker.onProgress(m),
      errorHandler: (e) => console.error(e),
    }).catch((e) => {
      ocrWorkerPromise = null;
      throw e;
    });
  }
  return ocrWorkerPromise;
}

// abortSignal: 「やめて手で入力」を押したとき・時間がかかりすぎたときに止めるため
async function recognizeReceipt(canvas, onProgress, abortSignal) {
  const stop = new Promise((_, reject) => {
    const timer = setTimeout(() => { ocrWorkerPromise = null; reject(new Error('timeout')); }, 180000); // 3分で読み取れなければあきらめる
    abortSignal.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('abort')); });
  });
  const run = (async () => {
    const worker = await getOcrWorker(onProgress);
    const { data } = await worker.recognize(canvas);
    return data.text || '';
  })();
  return Promise.race([run, stop]);
}

// ---------- 読み取った文字から、日付・店名・金額などを推測 ----------
function toHalfWidth(s) {
  return s
    // 日本語の文字認識は数字を「①②」のような丸数字で返すことがあるので普通の数字に戻す
    .replace(/[\u2460-\u2473]/g, (c) => String(c.charCodeAt(0) - 0x245f))
    .replace(/[\u24ea\u24ff]/g, '0')
    .replace(/[０-９Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[，、]/g, ',').replace(/[．。]/g, '.').replace(/[／]/g, '/').replace(/[：]/g, ':')
    .replace(/[％]/g, '%').replace(/[￥\\]/g, '¥').replace(/[－ー―‐]/g, (c) => c === 'ー' ? c : '-');
}

// 1行の中の金額（1,234 / ¥1234 など）をすべて取り出す
function amountsIn(line) {
  const out = [];
  const re = /¥?\s*(\d{1,3}(?:,\d{3})+|\d{2,7})(?!\d)(?!\s*%)/g;
  let m;
  while ((m = re.exec(line))) {
    const before = line.slice(Math.max(0, m.index - 1), m.index);
    if (before === '-' || before === ':' || before === '/') continue; // 電話番号・時刻・日付の一部はのぞく
    out.push(Number(m[1].replace(/,/g, '')));
  }
  return out;
}

function parseDate(lines) {
  const now = new Date();
  const thisYear = now.getFullYear();
  const ok = (y, mo, d) => {
    if (!(mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return null;
    if (y < thisYear - 3 || y > thisYear + 1) return null;
    return y + '-' + pad2(mo) + '-' + pad2(d);
  };
  for (const line of lines) {
    let m;
    if ((m = line.match(/(20\d{2})\s*[年/.\-]\s*(\d{1,2})\s*[月/.\-]\s*(\d{1,2})/))) {
      const r = ok(+m[1], +m[2], +m[3]); if (r) return r;
    }
    if ((m = line.match(/令和\s*(\d{1,2}|元)\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})/))) {
      const r = ok(2018 + (m[1] === '元' ? 1 : +m[1]), +m[2], +m[3]); if (r) return r;
    }
    if ((m = line.match(/R\s*(\d{1,2})\s*[./年]\s*(\d{1,2})\s*[./月]\s*(\d{1,2})/))) {
      const r = ok(2018 + +m[1], +m[2], +m[3]); if (r) return r;
    }
    if ((m = line.match(/(?:^|[^\d])(\d{2})\s*[/.年]\s*(\d{1,2})\s*[/.月]\s*(\d{1,2})(?!\d)/))) {
      const r = ok(2000 + +m[1], +m[2], +m[3]); if (r) return r;
    }
  }
  return '';
}

function parseStore(rawLines) {
  const skip = /領収|レシート|いらっしゃいませ|ありがとう|毎度|TEL|電話|〒|県|市|町|区|村|登録番号|^[\d\s\-:/.¥,()]+$/i;
  for (const line of rawLines.slice(0, 6)) {
    const s = line.replace(/\s+/g, '');
    if (s.length < 2 || s.length > 30) continue;
    if (skip.test(s)) continue;
    const letters = (s.match(/[A-Za-z぀-ヿ一-鿿]/g) || []).length;
    if (letters >= 2 && letters / s.length >= 0.5) return s;
  }
  return '';
}

function parseTotal(lines) {
  const bad = /小計|預|釣|おつり|お返し|点数|ポイント|pt|対象|税額|内税|消費税|値引|割引/;
  const keys = [/合計|総合計|お買上|お買い上げ|御買上|ご請求|領収金額|お支払|支払金額|総額/, /計/];
  for (const key of keys) {
    for (let i = 0; i < lines.length; i++) {
      if (!key.test(lines[i]) || bad.test(lines[i])) continue;
      let nums = amountsIn(lines[i]);
      if (!nums.length && lines[i + 1]) nums = amountsIn(lines[i + 1]);
      if (nums.length) return Math.max(...nums);
    }
  }
  // 見つからないときは「¥」の付いた一番大きい金額（お預かり・おつりの行はのぞく）
  let best = 0;
  for (const line of lines) {
    if (!/¥/.test(line) || /預|釣|おつり/.test(line)) continue;
    for (const n of amountsIn(line)) best = Math.max(best, n);
  }
  return best;
}

// 8%対象・10%対象の金額（レシート下の「(8%対象 ¥1,080)」など）
function parseRateSplit(lines, total) {
  const found = {};
  for (const line of lines) {
    const m = line.match(/(10|8)\s*%\s*(?:対象|対象計|対象額|課税)/) || (/軽減/.test(line) && /対象/.test(line) && [null, '8']);
    if (!m) continue;
    const nums = amountsIn(line.replace(/(10|8)\s*%/, ''));
    if (nums.length && found[m[1]] == null) found[m[1]] = nums[0];
  }
  const a10 = found['10'] || 0;
  const a8 = found['8'] || 0;
  if (!a10 && !a8) return null;
  if (a10 + a8 === total) return { a10, a8 };
  // 「対象」が税抜きで書かれているレシート
  const inc10 = Math.floor(a10 * 1.1);
  const inc8 = Math.floor(a8 * 1.08);
  if (Math.abs(inc10 + inc8 - total) <= 2) return { a10: total - inc8, a8: inc8 };
  // 片方しかない
  if (!a10 && a8) return { a10: 0, a8: total };
  if (a10 && !a8) return { a10: total, a8: 0 };
  return null;
}

function parseReceiptText(text) {
  const rawLines = String(text || '').split(/\r?\n/).map((l) => toHalfWidth(l).trim()).filter(Boolean);
  // 文字と文字のあいだに入る余計な空白を取る（数字のあいだも）
  const lines = rawLines.map((l) => l
    .replace(/([^\sA-Za-z])\s+(?=[^\sA-Za-z])/g, '$1')
    .replace(/(\d)[Oo](?=\d)/g, '$10').replace(/(\d)\.(\d{3})(?!\d)/g, '$1,$2') // 1O0 → 100、1.000 → 1,000
    .replace(/[呑含舎]計/g, '合計').replace(/[沢村]象/g, '対象'));
  const all = lines.join('\n');
  const total = parseTotal(lines);
  let reg = all.replace(/[ \t\-]/g, '').match(/T\d{13}(?!\d)/);
  if (!reg) {
    // 「T」が「1」「7」などに読み間違えられたとき（登録番号の行の 13〜14けたの数字）
    const m = all.replace(/[ \t\-]/g, '').match(/登録番号[^\d]{0,3}(\d{13,14})(?!\d)/);
    if (m) reg = ['T' + m[1].slice(-13)];
  }
  const split = total ? parseRateSplit(lines, total) : null;
  let rates;
  if (split && split.a10 && split.a8) rates = [{ rate: 10, amount: split.a10 }, { rate: 8, amount: split.a8 }];
  else if (split && split.a8) rates = [{ rate: 8, amount: total }];
  else rates = [{ rate: 10, amount: total }];
  return {
    date: parseDate(lines),
    store: parseStore(rawLines),
    regNo: reg ? reg[0] : '',
    rates,
    text: all,
  };
}
