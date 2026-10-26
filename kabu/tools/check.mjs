// 毎日のデータ（data/latest.json など）の形が正しいか確かめる道具です。
// 使い方: node kabu/tools/check.mjs kabu/data/latest.json
import { readFileSync } from 'node:fs';

const file = process.argv[2] || new URL('../data/latest.json', import.meta.url).pathname;
const d = JSON.parse(readFileSync(file, 'utf8'));
const errors = [];
const need = (cond, msg) => { if (!cond) errors.push(msg); };
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');

need(isDate(d.date), 'date は YYYY-MM-DD');
need(typeof d.headline === 'string' && d.headline, 'headline が必要');
need(d.market && Array.isArray(d.market.indices) && d.market.indices.length, 'market.indices が必要');
(d.market?.indices || []).forEach((i, n) => need(['up', 'down', 'flat'].includes(i.dir), `market.indices[${n}].dir は up/down/flat`));
need(Array.isArray(d.events), 'events は配列');
(d.events || []).forEach((e, n) => {
  need(isDate(e.date), `events[${n}].date`);
  need(['決算', '金利', '権利', '指標'].includes(e.type), `events[${n}].type は 決算/金利/権利/指標`);
  need(e.title && e.why, `events[${n}] に title と why`);
});
need(Array.isArray(d.picks) && d.picks.length >= 3, 'picks は3つ以上');
(d.picks || []).forEach((p, n) => {
  need(['stock', 'fund', 'watch'].includes(p.kind), `picks[${n}].kind は stock/fund/watch`);
  need(['long', 'short', 'both'].includes(p.horizon), `picks[${n}].horizon は long/short/both`);
  need(p.name && p.reason && p.risk, `picks[${n}] に name/reason/risk`);
  if (p.kind === 'stock') need(Number(p.price) > 0 && Number(p.unit) > 0, `picks[${n}] stock は price と unit が数値`);
});
if (d.plan) {
  const sum = d.plan.parts.reduce((a, p) => a + p.ratio, 0);
  need(Math.abs(sum - 1) < 0.001, 'plan.parts の ratio の合計は 1');
}
(d.dividends || []).forEach((x, n) => need(isDate(x.lastDay), `dividends[${n}].lastDay`));
need(Array.isArray(d.stories) && d.stories.length >= 3, 'stories は3つ以上');
need(Array.isArray(d.sources) && d.sources.length >= 3, 'sources は3つ以上');

if (errors.length) { console.error('NG:\n- ' + errors.join('\n- ')); process.exit(1); }
console.log(`OK: ${file} (${d.date}) picks=${d.picks.length} events=${d.events.length} stories=${d.stories.length}`);
