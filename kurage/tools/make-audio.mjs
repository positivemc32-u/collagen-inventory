// =============================================================
// 毎朝、その日のニュース（news.js）を「VOICEVOX:冥鳴ひまり」の声で音声ファイルにします。
// GitHub Actions（.github/workflows/kurage-pages.yml）の中で動き、
// できた音声はリポジトリには入れず、その日の GitHub Pages にだけ載せます（古い日の音声は残りません）。
//
// 使い方：node kurage/tools/make-audio.mjs <出力先> [前回の音声の置き場]
//   VOICEVOX ENGINE が http://127.0.0.1:50021 で動いている必要があります。
// =============================================================
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KURAGE = path.resolve(HERE, '..');
const OUT = path.resolve(process.argv[2] || path.join(KURAGE, 'audio'));
const CACHE = process.argv[3] ? path.resolve(process.argv[3]) : '';
const ENGINE = process.env.VOICEVOX_URL || 'http://127.0.0.1:50021';
const SPEAKER = Number(process.env.VOICEVOX_SPEAKER || 14); // 14 = 冥鳴ひまり（ノーマル）
const CREDIT = 'VOICEVOX:冥鳴ひまり';

// アプリと同じ文章の作り方（speech.js）と、その日のニュース（news.js）を読み込む
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(KURAGE, 'speech.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(KURAGE, 'news.js'), 'utf8'), ctx);
const { speechText, textKey } = ctx.window.KurageSpeech;
const news = ctx.window.KURAGE_NEWS;
if (!news || !news.sections) throw new Error('news.js を読めませんでした');

// 見出しの名前はアプリ（app.js）の BUILTIN から取る
const titles = {};
for (const m of fs.readFileSync(path.join(KURAGE, 'app.js'), 'utf8').matchAll(/\{ id: '([a-z0-9_-]+)', emoji: '[^']*', title: '([^']+)'/g)) titles[m[1]] = m[2];

const jobs = [];
for (const [id, items] of Object.entries(news.sections)) {
  if (!titles[id]) { console.warn(`見出しが見つからないので音声を作りません：${id}`); continue; }
  for (const it of items) {
    const text = speechText({ title: titles[id] }, it);
    jobs.push({ key: textKey(text), text });
  }
}

async function post(url, body) {
  const r = await fetch(url, { method: 'POST', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error(`${url} → ${r.status} ${await r.text().catch(() => '')}`);
  return r;
}

const tmp = fs.mkdtempSync(path.join(process.env.RUNNER_TEMP || '/tmp', 'kurage-vv-'));
async function synth(job) {
  // 段落ごとに作って、少し間をあけてつなぐ（長い文章でも安定して作れる）
  const paras = job.text.split('\n').map((s) => s.trim()).filter(Boolean);
  const wavs = [];
  for (const [i, p] of paras.entries()) {
    const q = await (await post(`${ENGINE}/audio_query?speaker=${SPEAKER}&text=${encodeURIComponent(p)}`)).json();
    q.postPhonemeLength = i === paras.length - 1 ? 0.2 : 0.45;
    const wav = Buffer.from(await (await post(`${ENGINE}/synthesis?speaker=${SPEAKER}`, q)).arrayBuffer());
    const f = path.join(tmp, `${job.key}-${i}.wav`);
    fs.writeFileSync(f, wav);
    wavs.push(f);
  }
  const list = path.join(tmp, `${job.key}.txt`);
  fs.writeFileSync(list, wavs.map((f) => `file '${f}'`).join('\n'));
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list,
    '-ac', '1', '-ar', '24000', '-c:a', 'libmp3lame', '-b:a', '40k', path.join(OUT, `${job.key}.mp3`)]);
  wavs.forEach((f) => fs.rmSync(f));
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const files = [];
let made = 0, reused = 0, failed = 0;
const t0 = Date.now();
for (const job of jobs) {
  const name = `${job.key}.mp3`;
  if (files.includes(name)) continue;
  const old = CACHE && path.join(CACHE, name);
  try {
    if (old && fs.existsSync(old)) { fs.copyFileSync(old, path.join(OUT, name)); reused++; }
    else { await synth(job); made++; }
    files.push(name);
  } catch (err) {
    failed++;
    console.error(`作れませんでした（${job.text.slice(0, 30)}…）：${err.message}`);
  }
}
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ date: news.date, credit: CREDIT, speaker: SPEAKER, files }, null, 1));
console.log(`音声：新しく ${made} 本、前回のものを ${reused} 本、失敗 ${failed} 本（${Math.round((Date.now() - t0) / 1000)} 秒）`);
if (!files.length && jobs.length) process.exit(1);
