// =============================================================
// 読み上げる文章の作り方（アプリと、毎朝の「冥鳴ひまりの音声づくり」で同じものを使います）
// 文章が1文字でも違うと、作っておいた音声は使わずに端末の声で読みます。
// =============================================================
(function (root) {
  'use strict';
  function speechText(sec, it) {
    const from = it.region ? `${it.region}発信。` : '';
    const parts = [`${sec.title}。${from}`, it.title + '。'];
    if (it.summary) parts.push(it.summary);
    if (it.detail) parts.push(it.detail);
    if (it.world) parts.push('世界から見ると、' + it.world);
    return parts.join('\n')
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
      .replace(/[★☆]+/g, (m) => `星${(m.match(/★/g) || []).length}つ。`)
      .replace(/〜/g, 'から').replace(/…/g, '、').replace(/[「」『』（）()“”]/g, ' ').replace(/[＝=]/g, 'イコール');
  }
  // 文章ごとの短い目印（FNV-1a 32bit）。音声ファイルの名前に使います
  function textKey(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0') + '-' + text.length.toString(36);
  }
  root.KurageSpeech = { speechText, textKey };
})(typeof window !== 'undefined' ? window : globalThis);
