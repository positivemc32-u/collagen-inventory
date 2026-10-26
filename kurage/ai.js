// =============================================================
// Claude で「今日のニュース」を調べて記事にする（任意の機能）
// APIキーはこの端末の中だけに保存し、Anthropic の API にだけ送ります。
// =============================================================
const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.133.0/+esm';
const MODEL = 'claude-opus-5-5';

let sdkPromise = null;
const loadSdk = () => (sdkPromise ||= import(SDK_URL).then((m) => m.default));

const SYSTEM = `あなたは、日本語のニュースを「端的に・正確に・面白く・人に話せるように」まとめる編集者です。
必ず web_search で最新の報道を調べ、確認できた事実だけを書いてください。推測や作り話は禁止です。
数字・日付・固有名詞は出典どおりに書き、はっきりしないことは「〜と報じられています」と書きます。
最後に、次の形の JSON 配列だけを出力してください（前後に文章やコードブロックの記号を付けない）：
[{"target":"その記事を届ける人（指示の一覧から1つ）","region":"日本 か 世界（どこ発信のニュースか）","telop":"画像に出す14文字以内のテロップ","title":"見出し（40文字以内）","summary":"何が起きたかを1〜2文で端的に","world":"日本発信のものだけ：世界からどう見られているか、または世界の似たもの（1〜2文）","talk":"人に話すときのひとこと（話し言葉で1文、ちょっと面白く）","sources":[{"name":"媒体名","url":"https://..."}]}]`;

function userPrompt({ title, prompt, count, targets, date }) {
  const d = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  return `今日は${d}です。項目「${title}」の記事を作ってください。
集めるもの：${prompt}
・今日〜ここ数日の新しいニュースを優先し、なければここ1か月の話題にしてください。
・${count}件。次の人たちに1件ずつ、この順番で：${targets.join('、')}（target にその人を入れる）。
・日本発信のものと世界発信のものを必ず両方入れてください（region に「日本」か「世界」）。
・日本発信の記事には world に「世界からどう見られているか」か「世界の似たもの」を、確かめられた事実で書いてください。
・人に話したくなるように、面白く、でも端的に。
・それぞれに実際に読んだ記事の URL を sources に入れてください。`;
}

function parseItems(text) {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start < 0 || end <= start) throw new Error('記事の形式を読み取れませんでした');
  const arr = JSON.parse(text.slice(start, end + 1));
  if (!Array.isArray(arr)) throw new Error('記事の形式を読み取れませんでした');
  const str = (v, n) => String(v ?? '').trim().slice(0, n);
  return arr.filter((x) => x && x.title).map((x) => ({
    ...(x.region === '世界' || x.region === '日本' ? { region: x.region } : {}),
    ...(/^[3-5]0代(女性|男性)$/.test(x.target || '') ? { target: x.target } : { target: 'みんな' }),
    telop: str(x.telop, 20),
    title: str(x.title, 120),
    summary: str(x.summary, 400),
    ...(x.region === '日本' && x.world ? { world: str(x.world, 400) } : {}),
    talk: str(x.talk, 200),
    sources: (Array.isArray(x.sources) ? x.sources : [])
      .filter((s) => s && /^https?:\/\//i.test(s.url || ''))
      .slice(0, 3)
      .map((s) => ({ name: str(s.name, 60), url: str(s.url, 500) })),
  }));
}

async function fetchSection({ apiKey, title, prompt, count, targets, date }) {
  const Anthropic = await loadSdk();
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const messages = [{ role: 'user', content: userPrompt({ title, prompt, count, targets, date }) }];
  const done = [];
  let res;
  // 調べものが長いと途中で一度止まる（pause_turn）ので、続きから再開する
  for (let i = 0; i < 5; i++) {
    res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium' },
      system: SYSTEM,
      tools: [{
        type: 'web_search_20260209', name: 'web_search', max_uses: 8,
        user_location: { type: 'approximate', country: 'JP', timezone: 'Asia/Tokyo' },
      }],
      messages: done.length ? [...messages, { role: 'assistant', content: done }] : messages,
    });
    done.push(...res.content);
    if (res.stop_reason !== 'pause_turn') break;
  }
  if (res.stop_reason === 'refusal') throw new Error('この項目は調べられませんでした');
  const text = done.filter((b) => b.type === 'text').map((b) => b.text).join('');
  const items = parseItems(text);
  if (!items.length) throw new Error('ニュースが見つかりませんでした');
  return items;
}

window.KurageAI = { fetchSection };
