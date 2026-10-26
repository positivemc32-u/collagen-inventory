// =============================================================
// speech.js … ニュースの読み上げ（スマホのブラウザに入っている声を使います）
// ミュート中は声を出さず、テロップだけが同じ速さで進みます。
// =============================================================

const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;

// 落ち着いた声の設定。男性の声が端末にないときは、ほかの声を低くして男性らしくします。
const VOICES = {
  male: { label: '落ち着いた男性', pitch: 0.85, fbPitch: 0.55, rate: 0.95 },
  female: { label: '落ち着いた女性', pitch: 0.9, rate: 0.95 },
};
const RATES = [0.75, 1, 1.25, 1.5, 2];

// 声の名前から男性・女性を見分けるための手がかり（主な端末の日本語の声）
const MALE_RE = /otoya|ichiro|keita|daichi|naoki|masaru|hattori|takumi|kenji|hiroshi|男性|\bmale\b/i;
const FEMALE_RE = /kyoko|o-?ren|ayumi|haruka|sayaka|nanami|mayu|shiori|mizuki|kanade|hikari|aoi|google\s*日本語|女性|female/i;

const Speaker = {
  settings: { gender: 'female', rate: 1, muted: false, voiceURI: { male: '', female: '' } },
  jaVoices: [],
  lines: [],
  index: 0,
  state: 'stopped', // stopped / playing / paused
  timer: null,
  token: 0,
  onLine: () => {},
  onState: () => {},

  init(saved) {
    if (saved) Object.assign(this.settings, saved, { voiceURI: { ...this.settings.voiceURI, ...(saved.voiceURI || {}) } });
    if (!synth) return;
    const load = () => {
      this.jaVoices = synth.getVoices().filter((v) => /^ja([-_]|$)/i.test(v.lang));
      const score = (v) => (/natural|online|neural|premium|enhanced|google/i.test(v.name) ? 0 : 1);
      this.jaVoices.sort((a, b) => score(a) - score(b));
      this.onState(this.state);
    };
    load();
    synth.addEventListener?.('voiceschanged', load);
  },

  supported() { return !!synth; },
  genderOf(v) { return MALE_RE.test(v.name) ? 'male' : FEMALE_RE.test(v.name) ? 'female' : 'unknown'; },
  hasMale() { return this.jaVoices.some((v) => this.genderOf(v) === 'male'); },

  // 実際に使う端末の声と高さを決める
  resolve() {
    const g = this.settings.gender; const p = VOICES[g];
    let voice = this.jaVoices.find((v) => v.voiceURI === this.settings.voiceURI[g]) || null;
    let fallback = false;
    if (!voice && this.jaVoices.length) {
      const same = this.jaVoices.filter((v) => this.genderOf(v) === g);
      const notOther = this.jaVoices.filter((v) => this.genderOf(v) !== (g === 'male' ? 'female' : 'male'));
      voice = same[0] || notOther[0] || this.jaVoices[0];
      fallback = g === 'male' && this.genderOf(voice) !== 'male';
    } else if (voice && g === 'male' && this.genderOf(voice) !== 'male') {
      fallback = true;
    }
    return { voice, pitch: fallback && p.fbPitch ? p.fbPitch : p.pitch, rate: p.rate };
  },

  // 文章を「。」ごとに分けて、1文ずつ読む（長い文章を一度に渡すと止まる端末があるため）
  play(items) {
    this.stop();
    this.lines = [];
    for (const it of items) {
      const parts = String(it.text || '').split(/(?<=[。！？!?])/).map((s) => s.trim()).filter(Boolean);
      for (const s of parts) this.lines.push({ text: s, telop: it.telop || s, section: it.section || '' });
    }
    if (!this.lines.length) return;
    this.index = 0;
    this.setState('playing');
    this.speakCurrent();
  },

  speakCurrent() {
    const my = ++this.token;
    const line = this.lines[this.index];
    if (!line) { this.stop(); return; }
    this.onLine(line, this.index, this.lines.length);
    const next = () => {
      if (my !== this.token || this.state !== 'playing') return;
      this.index += 1;
      this.speakCurrent();
    };
    if (this.settings.muted || !synth) {
      // 声を出さずに、読むのと同じくらいの時間でテロップを進める
      const ms = Math.max(1600, line.text.length * 150) / this.settings.rate;
      this.timer = setTimeout(next, ms);
      return;
    }
    const r = this.resolve();
    const u = new SpeechSynthesisUtterance(cleanForSpeech(line.text));
    u.lang = 'ja-JP';
    if (r.voice) u.voice = r.voice;
    u.pitch = r.pitch;
    u.rate = Math.min(10, Math.max(0.1, this.settings.rate * r.rate));
    u.onend = next;
    u.onerror = (e) => { if (e.error !== 'interrupted' && e.error !== 'canceled') next(); };
    synth.speak(u);
  },

  // 一時停止は「止めて、同じ文から読み直す」方式（端末によって pause が効かないため）
  pause() {
    if (this.state !== 'playing') return;
    this.token++; clearTimeout(this.timer); synth?.cancel();
    this.setState('paused');
  },
  resume() {
    if (this.state !== 'paused') return;
    this.setState('playing');
    this.speakCurrent();
  },
  stop() {
    this.token++; clearTimeout(this.timer); synth?.cancel();
    this.lines = []; this.index = 0;
    if (this.state !== 'stopped') this.setState('stopped');
  },
  // 読んでいる途中で声・速さ・ミュートを変えたら、今の文から読み直す
  restart() {
    if (this.state !== 'playing') return;
    this.token++; clearTimeout(this.timer); synth?.cancel();
    this.speakCurrent();
  },
  setMuted(m) { this.settings.muted = m; this.restart(); },
  setRate(r) { this.settings.rate = r; this.restart(); },
  setGender(g) { this.settings.gender = g; this.restart(); },
  setVoice(g, uri) { this.settings.voiceURI[g] = uri; this.restart(); },
  setState(s) { this.state = s; this.onState(s); },
};

// 絵文字・かっこ・記号を読む前に取りのぞく（端末によっては記号の名前を読んでしまうため）
function cleanForSpeech(text) {
  return String(text)
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}]/gu, ' ')
    .replace(/[「」『』（）()【】〔〕［］[\]｛｝{}〈〉《》"“”‘’'＂]/g, ' ')
    .replace(/[※★☆♪■□◆◇●○◎△▲▽▼→←↑↓⇒・＊*＃#＿_｜|＾^`｀]/g, ' ')
    .replace(/〜|～/g, 'から')
    .replace(/[…‥]+/g, '、');
}
