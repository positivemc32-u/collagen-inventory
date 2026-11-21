// =============================================================
// 今日の天気（Open-Meteo の無料の天気サービスを使います。鍵はいりません）
// 地域（市町村の名前と緯度・経度）は「⚙️ 設定」で選び、この端末の中だけに保存します。
// 天気を取るときは、選んだ場所の緯度・経度だけを Open-Meteo に送ります。
// =============================================================
(function () {
  'use strict';
  const CACHE_KEY = 'kurage-news-wx-v1';
  const FRESH_MS = 2 * 60 * 60 * 1000; // 2時間たったら取り直す

  // 天気コード（WMO）→ 絵文字と日本語
  const WMO = {
    0: ['☀️', '快晴'], 1: ['🌤', '晴れ'], 2: ['⛅', '晴れ時々くもり'], 3: ['☁️', 'くもり'],
    45: ['🌫', '霧'], 48: ['🌫', '霧'],
    51: ['🌦', '弱い霧雨'], 53: ['🌦', '霧雨'], 55: ['🌧', '強い霧雨'], 56: ['🌧', '冷たい霧雨'], 57: ['🌧', '冷たい霧雨'],
    61: ['🌧', '弱い雨'], 63: ['🌧', '雨'], 65: ['🌧', '強い雨'], 66: ['🌧', '冷たい雨'], 67: ['🌧', '冷たい強い雨'],
    71: ['🌨', '弱い雪'], 73: ['🌨', '雪'], 75: ['❄️', '大雪'], 77: ['🌨', '細かい雪'],
    80: ['🌦', 'にわか雨'], 81: ['🌧', '強いにわか雨'], 82: ['⛈', '激しいにわか雨'],
    85: ['🌨', 'にわか雪'], 86: ['❄️', '強いにわか雪'],
    95: ['⛈', '雷雨'], 96: ['⛈', 'ひょうをともなう雷雨'], 99: ['⛈', '激しい雷雨'],
  };
  const wmo = (c) => WMO[c] || ['🌡', '天気'];

  function loadCache() { try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || null; } catch { return null; } }
  function saveCache(v) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(v)); } catch { /* 保存できなくても動かす */ } }

  // 市町村の名前で場所を探す（日本の中だけ）
  async function search(name) {
    const q = String(name || '').trim();
    if (!q) return [];
    const tries = [q];
    const short = q.replace(/[市町村区]$/, '');
    if (short && short !== q) tries.push(short);
    const seen = new Set();
    const out = [];
    for (const t of tries) {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(t)}&count=10&language=ja&countryCode=JP&format=json`;
      const r = await fetch(url);
      if (!r.ok) throw new Error(`場所を探せませんでした（${r.status}）`);
      const j = await r.json();
      for (const x of j.results || []) {
        const key = `${x.latitude.toFixed(2)},${x.longitude.toFixed(2)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ name: x.name, pref: x.admin1 || '', lat: x.latitude, lon: x.longitude });
      }
      if (out.length) break;
    }
    return out;
  }

  async function fetchForecast(lat, lon) {
    const url = 'https://api.open-meteo.com/v1/forecast'
      + `?latitude=${lat}&longitude=${lon}`
      + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max'
      + '&wind_speed_unit=ms&timezone=Asia%2FTokyo&forecast_days=2';
    const r = await fetch(url);
    if (!r.ok) throw new Error(`天気を取れませんでした（${r.status}）`);
    return r.json();
  }

  let inflight = null;
  // 古ければ取り直す。取り直したら true
  async function refresh(place, todayStr) {
    if (!place || place.lat === '' || place.lat == null) return false;
    const key = `${Number(place.lat).toFixed(3)},${Number(place.lon).toFixed(3)}`;
    const c = loadCache();
    if (c && c.key === key && c.date === todayStr && Date.now() - c.at < FRESH_MS) return false;
    if (inflight) return inflight;
    inflight = fetchForecast(place.lat, place.lon)
      .then((data) => { saveCache({ key, date: todayStr, at: Date.now(), data }); return true; })
      .catch((err) => { saveCache({ key, date: todayStr, at: Date.now(), error: String(err.message || err) }); return true; })
      .finally(() => { inflight = null; });
    return inflight;
  }

  const r0 = (v) => Math.round(Number(v));
  function advice(max, min, pop, wind) {
    const tips = [];
    if (pop >= 50) tips.push('傘を持って出かけましょう');
    else if (pop >= 30) tips.push('折りたたみ傘があると安心です');
    if (min <= 3) tips.push('朝晩はかなり冷えこみます');
    else if (max - min >= 10) tips.push('朝と昼の気温差が大きいので、脱ぎ着しやすい服で');
    if (wind >= 10) tips.push('風がとても強いので注意してください');
    else if (wind >= 7) tips.push('風がやや強めです');
    return tips.length ? tips.join('。') + '。' : '';
  }
  function dayItem(place, d, i, label) {
    const [emo, desc] = wmo(d.weather_code[i]);
    const max = r0(d.temperature_2m_max[i]);
    const min = r0(d.temperature_2m_min[i]);
    const pop = r0(d.precipitation_probability_max[i] ?? 0);
    const wind = Math.round(Number(d.wind_speed_10m_max[i] ?? 0));
    return {
      telop: `${emo} ${label} ${desc}`,
      title: `${place.name}の${label}の天気は「${desc}」。最高${max}度、最低${min}度`,
      summary: `雨の降る確率は最大${pop}パーセント、風は最大で秒速${wind}メートルの予想です。${advice(max, min, pop, wind)}`,
      sources: [{ name: 'Open-Meteo（天気予報データ）', url: 'https://open-meteo.com/' }],
    };
  }

  // 今の表示用の記事（なければ null）
  function items(place, todayStr) {
    const c = loadCache();
    if (!place || place.lat === '' || place.lat == null) return null;
    const key = `${Number(place.lat).toFixed(3)},${Number(place.lon).toFixed(3)}`;
    if (!c || c.key !== key || c.date !== todayStr) return null;
    if (c.error) {
      return [{ title: '天気を読み込めませんでした', summary: `インターネットにつながっているか確認してください。（${c.error}）` }];
    }
    const d = c.data && c.data.daily;
    if (!d || !d.time || !d.time.length) return null;
    const out = [dayItem(place, d, 0, '今日')];
    if (d.time.length > 1) out.push(dayItem(place, d, 1, 'あした'));
    return out;
  }

  window.KurageWeather = { search, refresh, items };
})();
