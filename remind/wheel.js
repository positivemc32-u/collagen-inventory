// =============================================================
// wheel.js … くるくる回して時刻を選ぶ部品（スマホは指で、パソコンはマウスホイール・クリック・矢印キー）
// =============================================================

const WHEEL_ITEM_H = 44;
const WHEEL_VISIBLE = 5;

// 1本の回転ドラム。values: [{ v, label }]
class Wheel {
  constructor(values, value, onChange) {
    this.values = values;
    this.onChange = onChange;
    this.el = document.createElement('div');
    this.el.className = 'wheel';
    this.el.tabIndex = 0;
    this.el.setAttribute('role', 'listbox');
    this.list = document.createElement('div');
    this.list.className = 'wheel-list';
    this.list.innerHTML = values.map((x, i) => `<div class="wheel-item" data-i="${i}">${x.label}</div>`).join('');
    this.el.appendChild(this.list);
    this.items = [...this.list.children];
    this.index = Math.max(0, values.findIndex((x) => x.v === value));

    this.el.addEventListener('scroll', () => this.onScroll(), { passive: true });
    this.el.addEventListener('click', (e) => {
      const it = e.target.closest('.wheel-item');
      if (it) this.scrollToIndex(Number(it.dataset.i), true);
    });
    this.el.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        this.scrollToIndex(this.index + (e.key === 'ArrowUp' ? -1 : 1), true);
      }
    });
    // パソコン：マウスを押したまま上下にドラッグしても回せる
    this.el.addEventListener('mousedown', (e) => {
      const y0 = e.clientY, top0 = this.el.scrollTop;
      let moved = false;
      this.el.classList.add('dragging');
      const move = (ev) => {
        if (Math.abs(ev.clientY - y0) > 3) moved = true;
        this.el.scrollTop = top0 - (ev.clientY - y0);
      };
      const up = () => {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
        this.el.classList.remove('dragging');
        if (moved) {
          this.scrollToIndex(Math.round(this.el.scrollTop / WHEEL_ITEM_H), true);
          // ドラッグ後のクリックで別の項目が選ばれないように
          this.el.addEventListener('click', (ce) => ce.stopPropagation(), { capture: true, once: true });
        }
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    });
  }
  // DOM に入れてから呼ぶ
  mount(parent) {
    parent.appendChild(this.el);
    this.el.scrollTop = this.index * WHEEL_ITEM_H;
    this.paint();
  }
  get value() { return this.values[this.index].v; }
  set(value) {
    const i = this.values.findIndex((x) => x.v === value);
    if (i >= 0) { this.index = i; this.el.scrollTop = i * WHEEL_ITEM_H; this.paint(); }
  }
  scrollToIndex(i, smooth) {
    i = Math.max(0, Math.min(this.values.length - 1, i));
    this.el.scrollTo({ top: i * WHEEL_ITEM_H, behavior: smooth ? 'smooth' : 'auto' });
  }
  onScroll() {
    cancelAnimationFrame(this._raf);
    this._raf = requestAnimationFrame(() => this.paint());
    const i = Math.max(0, Math.min(this.values.length - 1, Math.round(this.el.scrollTop / WHEEL_ITEM_H)));
    if (i !== this.index) {
      this.index = i;
      if (navigator.vibrate) try { navigator.vibrate(3); } catch (e) { /* 無視 */ }
      this.onChange(this.value);
    }
  }
  // 中心から離れるほど傾けて小さく（くるくる回るドラムの見た目）
  paint() {
    const center = this.el.scrollTop / WHEEL_ITEM_H;
    for (let i = 0; i < this.items.length; i++) {
      const d = i - center;
      if (Math.abs(d) > 3) { this.items[i].style.transform = ''; this.items[i].style.opacity = '0'; continue; }
      this.items[i].style.transform = `rotateX(${-d * 22}deg) scale(${1 - Math.abs(d) * 0.07})`;
      this.items[i].style.opacity = String(1 - Math.abs(d) * 0.28);
      this.items[i].classList.toggle('sel', Math.round(center) === i);
    }
  }
}

const HOURS = Array.from({ length: 24 }, (_, h) => ({ v: h, label: String(h).padStart(2, '0') }));
const MINUTES = Array.from({ length: 60 }, (_, m) => ({ v: m, label: String(m).padStart(2, '0') }));

// 時と分の2本ドラム。value: 'HH:MM'
function mountTimeWheel(container, value, onChange) {
  const [h, m] = value.split(':').map(Number);
  container.innerHTML = '';
  container.classList.add('timewheel');
  const box = document.createElement('div');
  box.className = 'timewheel-box';
  const emit = () => onChange(`${String(hw.value).padStart(2, '0')}:${String(mw.value).padStart(2, '0')}`);
  const hw = new Wheel(HOURS, h, emit);
  const mw = new Wheel(MINUTES, m, emit);
  container.appendChild(box);
  hw.mount(box);
  const colon = document.createElement('div');
  colon.className = 'timewheel-colon';
  colon.textContent = ':';
  box.appendChild(colon);
  mw.mount(box);
  const band = document.createElement('div');
  band.className = 'wheel-band';
  box.appendChild(band);
  return {
    set(v) { const [a, b] = v.split(':').map(Number); hw.set(a); mw.set(b); },
  };
}
