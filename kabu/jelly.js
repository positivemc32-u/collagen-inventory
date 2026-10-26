// =============================================================
// jelly.js … 水色のクラゲのキャラクター（ドット絵）と、画面の端からときどき出てくる動き
// =============================================================

// ドット絵の形（X=体、E=目、P=ほっぺ、.=すきま）。足は2コマを交互に出して動かします。
const JELLY_HEAD = [
  '...XXXXX...',
  '.XXXXXXXXX.',
  'XXXXXXXXXXX',
  'XXEEXXXEEXX',
  'XXEEXXXEEXX',
  'XPXXXXXXXPX',
  'XXXXXXXXXXX',
];
const JELLY_LEGS = [
  ['.X.X.X.X.X.', 'X..X...X..X', '.X...X...X.'],
  ['X.X.X.X.X.X', '.X..X.X..X.', 'X...X.X...X'],
];
const JELLY_COLORS = { X: '#7fd8f7', E: '#16324f', P: '#ffb3c7' };

function jellyRects(rows, y0, cls) {
  let out = '';
  rows.forEach((row, y) => {
    [...row].forEach((c, x) => {
      if (c === '.') return;
      const k = c === 'E' ? ' class="j-eye"' : '';
      out += `<rect x="${x}" y="${y0 + y}" width="1.02" height="1.02" fill="${JELLY_COLORS[c]}"${k}/>`;
    });
  });
  return `<g class="${cls}">${out}</g>`;
}

// クラゲのSVG（size はピクセル）
function jellySVG(size = 64, extraClass = '') {
  const w = 11; const h = JELLY_HEAD.length + 3;
  return `<svg class="jelly ${extraClass}" viewBox="-0.5 -0.5 ${w + 1} ${h + 1}" width="${size}" height="${Math.round(size * (h + 1) / (w + 1))}" shape-rendering="crispEdges" aria-hidden="true">
    <g class="j-body">
      ${jellyRects(JELLY_HEAD, 0, 'j-head')}
      ${jellyRects(JELLY_LEGS[0], JELLY_HEAD.length, 'j-legs j-legs-a')}
      ${jellyRects(JELLY_LEGS[1], JELLY_HEAD.length, 'j-legs j-legs-b')}
    </g>
  </svg>`;
}

// ---------- 画面の端からときどき出てくるクラゲ ----------
const Peek = {
  el: null,
  timer: null,
  sides: ['left', 'right', 'bottom-left', 'bottom-right'],
  lines: [
    'こんにちは！今日もゆるっとチェックしよう',
    '一度に全部買わず、少しずつがコツだよ',
    '決算の日は株価が大きく動きやすいよ',
    '長く持つなら、配当と成長に注目！',
    'わからない言葉は「今日の用語」を見てね',
    '▶ を押すとニュースを読み上げるよ',
  ],
  init() {
    this.el = document.createElement('button');
    this.el.type = 'button';
    this.el.className = 'peek';
    this.el.setAttribute('aria-label', 'クラゲのひとこと');
    this.el.innerHTML = jellySVG(56) + '<span class="peek-bubble" hidden></span>';
    this.el.addEventListener('click', () => this.talk());
    document.body.appendChild(this.el);
    this.schedule(6000 + Math.random() * 6000);
  },
  schedule(ms) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.show(), ms);
  },
  show() {
    if (document.hidden || document.body.classList.contains('sheet-open')) { this.schedule(15000); return; }
    const side = this.sides[Math.floor(Math.random() * this.sides.length)];
    this.el.dataset.side = side;
    // 縦の位置（左右から出るとき）や横の位置（下から出るとき）を毎回すこし変える
    this.el.style.setProperty('--peek-pos', `${20 + Math.random() * 45}%`);
    this.el.classList.remove('out');
    void this.el.offsetWidth;
    this.el.classList.add('in');
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => this.hide(), 5200);
  },
  hide() {
    this.el.classList.remove('in');
    this.el.classList.add('out');
    this.el.querySelector('.peek-bubble').hidden = true;
    this.schedule(25000 + Math.random() * 45000);
  },
  talk() {
    const b = this.el.querySelector('.peek-bubble');
    const extra = typeof Peek.extraLine === 'function' ? Peek.extraLine() : '';
    const pool = extra ? [...this.lines, extra, extra] : this.lines;
    b.textContent = pool[Math.floor(Math.random() * pool.length)];
    b.hidden = false;
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => this.hide(), 4500);
  },
};
