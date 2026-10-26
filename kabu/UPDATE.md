# 毎日のニュース更新の手順（自動作業用）

このファイルは、毎朝ニュースを更新する自動作業（Claude）が読む手順書です。

## 置き場所

- 毎日のデータは **`kabu-data` ブランチ** の `kabu/data/` に置きます（main には直接入れません）。
  - アプリは `https://raw.githubusercontent.com/positivemc32-u/collagen-inventory/kabu-data/kabu/data/latest.json` を読みます。
  - `kabu-data` ブランチがまだ無ければ、main から作ります。
- 更新するファイル
  1. `kabu/data/latest.json` … 今日の内容
  2. `kabu/data/archive/YYYY-MM-DD.json` … 同じ内容のコピー（過去ログ）
  3. `kabu/data/index.json` … `dates` に今日の日付を追加（新しい順でなくてよい。重複させない。最大120件まで残す）
- 書いたら必ず `node kabu/tools/check.mjs kabu/data/latest.json` で形を確かめてから commit・push します。

## 読む人

株を始めたばかりの人。手持ち5万円から（アプリ側で予算は変えられる）。
専門用語は使うならひと言で説明する。理由は短く、たとえ話OK。

## 調べること（毎回 WebSearch で最新を確認）

1. 前日〜当日の市場：日経平均、NYダウ、S&P500、ナスダック、ドル円、原油など（数字と上下）
2. 今日・明日・1週間の予定：主な決算（日本・米国）、日銀・FOMC、経済指標、配当・優待の権利付き最終日
3. 銘柄のアイデア 5〜8個
   - 「長期向き」（投資信託・配当株・大型株）と「短期向き」（決算・ニュースで動きそうなもの）を両方
   - 5万円で買えるもの（100株で5万円以下、または1株から買える大型株、100円からの投資信託）を中心に
   - 値動きが荒すぎるものは `kind: "watch"`（見るだけ）にする
   - 株価は検索で確認できた値と日付を `priceDate` に正直に書く（不明なら推定と書く）
4. 企業の裏話・人事：社長・CEOの交代、どこの社長だった人がどこへ行ったか、世界の企業ニュースの背景
5. 今日の用語（初心者向けに1つ）

## ルール

- 当たらなくてもよいが、**うそは書かない**。確認できない数字は「目安」「推定」と書く。
- 「必ず上がる」などの断定はしない。リスク（注意）を必ず書く。
- 前日の銘柄を全部入れ替える必要はない。理由が続いているものは残してよい。
- 終わった予定（今日より前）は events から消す。2週間〜1か月先までの大事な予定は残す。
- `sources` に使った記事のURLを3つ以上。

## JSON の形

`kabu/data/latest.json` の今の内容がお手本です。主な項目：

| 項目 | 内容 |
|---|---|
| `date` / `updatedAt` | 日付（YYYY-MM-DD）と更新時刻（+09:00） |
| `headline` | 今日のひと言まとめ |
| `market.summary / indices / points` | 市場の動き。`indices[].dir` は `up` / `down` / `flat` |
| `events[]` | `date`, `time`, `type`（決算/金利/権利/指標）, `title`, `why` |
| `plan` | 予算の分け方。`parts[].ratio` の合計は 1 |
| `picks[]` | `kind`（stock/fund/watch）, `horizon`（long/short/both）, `name`, `code`, `price`（1株の円）, `unit`（売買単位、普通100）, `priceDate`, `oddLot`（1株から買えるか）, `dividend`, `reason`, `risk`, `howTo`, `tag` |
| `dividends[]` | `name`, `code`, `lastDay`（権利付き最終日）, `content`, `note` |
| `stories[]` | `tag`（人事/裏話/世界）, `title`, `body` |
| `lesson` | `title`, `body` |
| `sources[]` | `title`, `url` |
