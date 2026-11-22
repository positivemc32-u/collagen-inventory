// =============================================================
// 今日のニュース（この日付の時点で調べた内容）。毎朝の自動更新で入れ替わります。
// 各項目3記事。いま話題になっている新しい情報を選んでいます。
// 記事ごとに：region（日本 か 世界）/ telop / title / summary / detail（スポーツなどの短い説明）/
//   world（日本発信のものだけ：世界からどう見られているか・世界の似たもの）/ sources
// 「今日の天気」と「占い」はアプリが自動で作るので、ここには入れません。
// 「四季と暦」は、節気と旬をアプリが自動で足すので、ここには季節のニュースを1件だけ入れます。
// =============================================================
window.KURAGE_NEWS = {
  "date": "2026-11-23",
  "sections": {
    "today": [
      {
        "region": "世界",
        "telop": "COP31 合意できず閉幕",
        "title": "国連の気候会議COP31、成果文書を採択できずに閉幕",
        "summary": "化石燃料からの脱却について書かれていない草案に、EUなどが反対しました。全会一致の合意なしで終わるのは、2009年のCOP15以来の異例の事態です。",
        "sources": [
          {
            "name": "NHK",
            "url": "https://news.web.nhk/newsweb/na/nd-20261122de79933"
          },
          {
            "name": "時事ドットコム",
            "url": "https://www.jiji.com/jc/article?k=2026112200245&g=soc&m=rss"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "印旛沼 決壊から2か月",
        "title": "千葉・印旛沼の堤防決壊から2か月。田んぼの復旧が進まず、来年のコメ作りに影響",
        "summary": "9月の台風の大雨で、管理が始まってから初めて堤防が決壊しました。被災した田んぼでは、来年に向けた準備を始められないところがあります。",
        "sources": [
          {
            "name": "NHK",
            "url": "https://news.web.nhk/newsweb/na/nd-20261122de79991"
          }
        ]
      },
      {
        "region": "世界",
        "telop": "リーマン予想 AIと解いた？",
        "title": "数学の大難問「リーマン予想」を、AIと一緒に解いたと数学者が発表",
        "summary": "AnthropicのAI「Claude」と共同で証明を見つけたと発表したと伝えられています。証明が正しいかどうかは、ほかの数学者がくわしく確かめる必要があります。",
        "detail": "リーマン予想は、素数（1とその数でしか割り切れない数）の並び方にかかわる160年以上解かれていない問題で、解いた人には100万ドルの賞金がかけられています。",
        "sources": [
          {
            "name": "ナゾロジー",
            "url": "https://nazology.kusuguru.co.jp/archives/210450"
          }
        ]
      }
    ],
    "ishikawa": [
      {
        "region": "日本",
        "telop": "志賀原発で防災訓練",
        "title": "志賀原発の重大事故を想定した原子力防災訓練。住民が避難の方法を確認",
        "summary": "志賀町で震度7の地震が起き、外部の電源がすべて失われたという想定です。およそ240の機関が参加し、今年は渋滞を減らすため避難の道を分ける手順も加えました。",
        "sources": [
          {
            "name": "NHK",
            "url": "https://news.web.nhk/newsweb/na/nd-20261122de79999"
          },
          {
            "name": "Yahoo!ニュース（テレビ金沢）",
            "url": "https://news.yahoo.co.jp/articles/4ba8e5c1cf430b80b1e3b214236521792a4ad05a"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "香林坊大和に「たねや」",
        "title": "香林坊大和の地下1階に、和菓子の「たねや」の期間限定店",
        "summary": "季節限定の「栗月下」や、もなかの「ふくみ天平」などが並びます。「とらや」の限定店と同時に、来年1月5日まで営業します。",
        "sources": [
          {
            "name": "北國新聞",
            "url": "https://www.hokkoku.co.jp/articles/-/2298626"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "寒さで転倒 けがに注意",
        "title": "寒気が強まって大荒れの天気。金沢市で80代の女性が転んで大けが",
        "summary": "山では雪も積もりました。冷えこむ朝は、足もとの凍結に気をつけましょう。",
        "sources": [
          {
            "name": "Yahoo!ニュース（MRO北陸放送）",
            "url": "https://news.yahoo.co.jp/articles/caa8495023b05ab5866e909b8d0be54826c9a9cc"
          }
        ]
      }
    ],
    "kosodate": [
      {
        "region": "日本",
        "telop": "病児保育を増やしたい",
        "title": "東京都、病気の子どもを預かる「病児保育」を増やすため、施設への支援を強化へ",
        "summary": "採算が合いにくいことや、人の配置がむずかしいことが課題になっています。",
        "sources": [
          {
            "name": "NHK",
            "url": "https://news.web.nhk/newsweb/na/nd-20261121de79474"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "里親の研修に手当",
        "title": "大阪府泉佐野市、里親になるための研修に参加した家庭に手当を出す方向",
        "summary": "1回1万円から1万5千円ほどで調整しています。「赤ちゃんポスト」の運用を目指す取り組みの一つと報じられています。",
        "sources": [
          {
            "name": "Yahoo!ニュース（共同通信）",
            "url": "https://news.yahoo.co.jp/articles/95ee1f683c9768d3f91f3397bec0fa6b7dc85339"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "12月の児童手当は2か月分",
        "title": "12月の児童手当は、10月分と11月分がまとめて振り込まれます",
        "summary": "市区町村によっては、保育料などが差し引かれることもあります。",
        "sources": [
          {
            "name": "Yahoo!ニュース（LIMO）",
            "url": "https://news.yahoo.co.jp/articles/9c7b8d17dd3e50f1e8dc5ddc0ea5135d0fdbbb69"
          }
        ]
      }
    ],
    "kids": [
      {
        "region": "日本",
        "telop": "Suicaの新キャラはウサギ",
        "title": "交通系ICカード「Suica」の新しいキャラクターは、ウサギがモデルに",
        "summary": "JR東日本が18日に発表しました。",
        "sources": [
          {
            "name": "学研キッズネット（やさしい朝日新聞）",
            "url": "https://kids.gakken.co.jp/news/113517/"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "「藪の中」の原稿",
        "title": "芥川龍之介の小説「藪の中」、最初はちがうタイトルと結末だった",
        "summary": "見つかった原稿から、題名やお話の終わり方がいまとちがっていたことがわかりました。",
        "sources": [
          {
            "name": "学研キッズネット（やさしい朝日新聞）",
            "url": "https://kids.gakken.co.jp/news/113215/"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "ネットの使い方 新しい目安",
        "title": "こども家庭庁が、子どものインターネットの使い方の新しい目安を発表",
        "summary": "年齢に合わせて、家族でルールを話し合うことが大切だとしています。",
        "sources": [
          {
            "name": "学研キッズネット（やさしい朝日新聞）",
            "url": "https://kids.gakken.co.jp/news/"
          }
        ]
      }
    ],
    "sports": [
      {
        "region": "日本",
        "telop": "大の里 2場所連続優勝",
        "title": "大相撲九州場所、横綱・大の里が優勝決定戦で若元春を破り、2場所連続7回目の優勝",
        "summary": "結びで豊昇龍を押し出し、決定戦では渡し込みで勝ちました。九州場所では初めての優勝で、「来年は全勝優勝を」と話しました。",
        "detail": "7回の優勝は、昔の名横綱・羽黒山と同じ回数です。決定戦の「渡し込み」は、相手の足を手ですくうようにして倒す技です。",
        "sources": [
          {
            "name": "NHK",
            "url": "https://news.web.nhk/newsweb/na/nd-20261122de80055"
          },
          {
            "name": "Yahoo!ニュース（共同通信）",
            "url": "https://news.yahoo.co.jp/articles/276c1c2e708063a175a1c64242bd5659d81d1769"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "FC東京 首位で抜け出す",
        "title": "サッカーJ1、FC東京がセレッソ大阪に3対0で勝ち、2位と勝ち点5差",
        "summary": "2位から7位のチームがそろって勝てず、FC東京が一歩抜け出しました。",
        "detail": "勝ちは勝ち点3、引き分けは1。シーズンを通して勝ち点がいちばん多いチームが優勝です。",
        "sources": [
          {
            "name": "Yahoo!ニュース（フットボールチャンネル）",
            "url": "https://news.yahoo.co.jp/articles/334f5167fe9569f21304886c230e14c9b5bbe03d"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "27日からNHK杯",
        "title": "フィギュアのNHK杯が27日開幕。日本女子はGP6戦全勝なるか",
        "summary": "今季のGPは日本女子が5戦全勝です。NHK杯には千葉百音選手、青木祐奈選手らが出場します。",
        "detail": "GPシリーズは6つの大会があり、NHK杯はその最後の大会。成績上位6人が12月のファイナルに進みます。",
        "sources": [
          {
            "name": "Yahoo!ニュース（スポニチ）",
            "url": "https://news.yahoo.co.jp/articles/749a227fde62f39259ebdf48393516a755f5f6bf"
          }
        ]
      }
    ],
    "music": [
      {
        "region": "日本",
        "telop": "ミスチル 来年ドームツアー",
        "title": "Mr.Children、来年ドームとスタジアムのツアー。全国6会場で12公演",
        "summary": "22日に発表されました。",
        "sources": [
          {
            "name": "音楽ナタリー",
            "url": "https://natalie.mu/music/news/699205"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "さんタク 25年目も",
        "title": "明石家さんまさんと木村拓哉さんの正月番組「さんタク」、25年目も放送",
        "summary": "22日の木村さんのライブ千葉公演にさんまさんが登場した様子も放送されます。",
        "sources": [
          {
            "name": "音楽ナタリー",
            "url": "https://natalie.mu/music/news/699204"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "長崎「BRIDGE」スタジアムへ",
        "title": "長崎の音楽イベント「BRIDGE」、初めてスタジアムで開催",
        "summary": "第1弾の出演者として、KohjiyaさんとTeteさんが発表されました。",
        "sources": [
          {
            "name": "音楽ナタリー",
            "url": "https://natalie.mu/music/news/699201"
          }
        ]
      }
    ],
    "science": [
      {
        "region": "世界",
        "telop": "131歳の魚",
        "title": "明治時代から川を泳ぎ続けた？ 131歳と推定される魚が見つかる",
        "summary": "アメリカ・モンタナ州のミズーリ川で、ブルーサッカーという淡水魚に、最長で131歳と推定される個体がいました。",
        "sources": [
          {
            "name": "ナゾロジー",
            "url": "https://nazology.kusuguru.co.jp/archives/210480"
          }
        ]
      },
      {
        "region": "世界",
        "telop": "いちばん小さな宇宙",
        "title": "世界最大の実験装置で、人類が見た中でいちばん小さな「ゼプト宇宙」を観測",
        "summary": "スイスなどにある巨大な加速器LHCを使った研究です。ゼプトは、10億分の1のさらに1兆分の1という、とても小さな単位です。",
        "sources": [
          {
            "name": "ナゾロジー",
            "url": "https://nazology.kusuguru.co.jp/archives/210384"
          }
        ]
      },
      {
        "region": "世界",
        "telop": "細菌で動くコンピューター",
        "title": "泳ぐ細菌で計算するコンピューター。細菌が増えるほど計算の力もアップ",
        "summary": "泳ぎながら分かれて増える細菌に計算をまかせ、数字の組み合わせを探す問題を解く装置がつくられました。",
        "sources": [
          {
            "name": "ナゾロジー",
            "url": "https://nazology.kusuguru.co.jp/archives/210510"
          }
        ]
      }
    ],
    "anatomy": [
      {
        "region": "世界",
        "telop": "妊娠は栄養の取り合い",
        "title": "妊娠は、お母さんと赤ちゃんの「栄養の取り合い」だったことを魚で確かめた",
        "summary": "お腹の中で子を育てる魚を調べ、親と子が栄養を取り合う関係があることが裏付けられたと伝えられています。",
        "detail": "人では「胎盤（たいばん）」が、お母さんの血液から赤ちゃんへ栄養や酸素を渡す役目をしています。胎盤は赤ちゃんと一緒にできて、出産のあとに外に出てきます。",
        "sources": [
          {
            "name": "ナゾロジー",
            "url": "https://nazology.kusuguru.co.jp/archives/209515"
          }
        ]
      },
      {
        "region": "世界",
        "telop": "赤ちゃんの言葉の覚え方",
        "title": "1人の子どもが聞いた声だけをAIに聞かせると、言葉の覚え方が見えてきた",
        "summary": "赤ちゃんの毎日を体験させるような方法で、言葉を覚える仕組みを調べた研究です。",
        "detail": "言葉を聞いて理解するのは、主に左の脳の横にある「ウェルニッケ野」、話すのは前のほうの「ブローカ野」がかかわるといわれます。",
        "sources": [
          {
            "name": "ナゾロジー",
            "url": "https://nazology.kusuguru.co.jp/archives/209438"
          }
        ]
      },
      {
        "region": "世界",
        "telop": "感情は六角形の地図？",
        "title": "脳は、感情を「六角形の地図」のように整理しているかもしれない",
        "summary": "場所を覚えるときと似た仕組みで、気持ちも整理している可能性があるという研究です。",
        "detail": "脳には、自分がどこにいるかを六角形のマス目のように表す「グリッド細胞」があります。この発見は2014年のノーベル賞になりました。",
        "sources": [
          {
            "name": "ナゾロジー",
            "url": "https://nazology.kusuguru.co.jp/archives/206391"
          }
        ]
      }
    ],
    "phyto": [
      {
        "region": "日本",
        "telop": "北海道は生薬の産地",
        "title": "漢方薬の原料となる生薬、北海道が一大産地に",
        "summary": "作付け面積は全国2位の3.4倍。若い世代のストレスや冷え症で漢方の需要が増え、大手企業の参入も進んでいると報じられています。",
        "sources": [
          {
            "name": "Yahoo!ニュース（HBC北海道放送）",
            "url": "https://news.yahoo.co.jp/articles/0b9dacac9eeb8c14c160968af5ca2653f66f82bc"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "受験シーズンと漢方",
        "title": "受験シーズンの体調管理に漢方を",
        "summary": "子どもの受験を経験した保護者の多くが、体調管理に気をつかっていたという調査が紹介されています。",
        "sources": [
          {
            "name": "薬事日報",
            "url": "https://www.yakuji.co.jp/entry141764.html"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "ゆず湯 2人に1人",
        "title": "冬至のゆず湯、2人に1人が入るという調査も。今年の冬至は12月22日",
        "summary": "ゆず湯は、体を温めて一年の健康を願う昔からの習わしです。",
        "sources": [
          {
            "name": "ウェザーニュース",
            "url": "https://weathernews.jp/s/topics/201912/210065/"
          },
          {
            "name": "日本気象協会 tenki.jp",
            "url": "https://tenki.jp/suppl/k_mochizuki/2024/12/19/32557.html"
          }
        ]
      }
    ],
    "aroma": [
      {
        "region": "日本",
        "telop": "鉄道林の杉の香り",
        "title": "JR東日本の鉄道を守ってきた森の杉から、香りのミスト",
        "summary": "鉄道林の杉の精油を使った「森と、旅と。フォレストミスト」が発売されました。12月に走りはじめる観光列車にも、同じ杉のアロマが置かれます。",
        "sources": [
          {
            "name": "PR TIMES（グリーディー）",
            "url": "https://prtimes.jp/main/html/rd/p/000000001.000194309.html"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "旅に寄りそう精油",
        "title": "旅のブランドAwwが、5種類の精油をブレンドしたオリジナルの精油と「香り守り」を発売",
        "summary": "旅先でも同じ香りで落ち着けるようにという商品です。",
        "sources": [
          {
            "name": "PR TIMES（Aww）",
            "url": "https://prtimes.jp/main/html/rd/p/000000070.000057888.html"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "精油の香りで手もとケア",
        "title": "THREEの精油科学から、ハンドケアの新しい香りとディフューザー",
        "summary": "乾燥する季節に向けて、植物の精油を使った手肌と空間のケア商品が出ました。",
        "sources": [
          {
            "name": "PR TIMES（ACRO）",
            "url": "https://prtimes.jp/main/html/rd/p/000000140.000074010.html"
          }
        ]
      }
    ],
    "realestate": [
      {
        "region": "日本",
        "telop": "単身向け家賃 全地域で上昇",
        "title": "単身者向けマンションの家賃、調べた全13地域で前の年を上回る",
        "summary": "東京23区は9.7%高い11万4460円で、2か月続けて過去最高です。費用の上昇や、募集する部屋の減少が背景です。",
        "sources": [
          {
            "name": "Yahoo!ニュース（共同通信）",
            "url": "https://news.yahoo.co.jp/articles/fa416b4e8a8d904551b3775f2e381ad73a4fa622"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "首都圏 新築マンション最少",
        "title": "首都圏の新築マンション、10月の発売は24%減。10月として過去最少",
        "summary": "発売してすぐ売れた割合も48%と、7年ぶりに50%を下回りました。",
        "sources": [
          {
            "name": "日本経済新聞",
            "url": "https://www.nikkei.com/article/DGXZQOUC193RL0Z11C26A1000000/"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "近畿も過去最低",
        "title": "近畿の新築マンション、10月の発売は803戸で過去最低",
        "summary": "価格の上がりすぎで、売る側も慎重になっています。",
        "sources": [
          {
            "name": "日本経済新聞",
            "url": "https://www.nikkei.com/article/DGXZQOUF1964Q0Z11C26A1000000/"
          }
        ]
      }
    ],
    "nutrition": [
      {
        "region": "世界",
        "telop": "ケトン食にも落とし穴",
        "title": "健康に良いと思われがちなケトン食、やり方しだいで炎症を招くことも",
        "summary": "マウスの実験で、ショートニングでつくったケトン食では、心臓や腎臓に炎症を起こす細胞がたまりました。脂の種類が大事なようです（動物実験の段階）。",
        "sources": [
          {
            "name": "ナゾロジー",
            "url": "https://nazology.kusuguru.co.jp/archives/209568"
          }
        ]
      },
      {
        "region": "世界",
        "telop": "体の年齢とサプリ",
        "title": "体の年齢を下げたのは薬と生活習慣。調べた市販サプリでは、はっきりした効果は出ず",
        "summary": "アメリカのエール大学の研究で、血液から測る「体の年齢」を調べました（人のデータを使った研究ですが、調べたサプリは一部です）。",
        "sources": [
          {
            "name": "ナゾロジー",
            "url": "https://nazology.kusuguru.co.jp/archives/209390"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "ゆずの栄養",
        "title": "冬においしいゆずは、ビタミンCが豊富",
        "summary": "果汁より皮のほうにビタミンCが多いといわれます。料理に皮を少し加えるのもおすすめです（栄養の量はよく知られた事実です）。",
        "sources": [
          {
            "name": "Yahoo!ニュース（ヨガジャーナルオンライン）",
            "url": "https://news.yahoo.co.jp/articles/37a80ba30a0d2e5122be180cd00fb6d44099e0ea"
          }
        ]
      }
    ],
    "spiritual": [
      {
        "region": "日本",
        "telop": "今日は勤労感謝の日",
        "title": "今日23日は勤労感謝の日。もとは新米を神さまに供える「新嘗祭」",
        "summary": "1948年に祝日として定められました。働く人と、その年の実りに感謝する日です。",
        "sources": [
          {
            "name": "内閣府",
            "url": "https://www8.cao.go.jp/chosei/shukujitsu/gaiyou.html"
          },
          {
            "name": "ベストカレンダー",
            "url": "https://www.bestcalendar.jp/koyomi/kinro-kansha-no-hi"
          }
        ]
      },
      {
        "region": "世界",
        "telop": "今日は下元節",
        "title": "台湾などでは今日23日が「下元節」",
        "summary": "旧暦の10月15日にあたり、水の神さまをまつる日とされます。",
        "sources": [
          {
            "name": "NOWnews",
            "url": "https://www.nownews.com/news/6893157"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "小雪のころ",
        "title": "小雪のあいだは、冬じたくを進める時期",
        "summary": "12月6日までが「小雪」の期間です。北のほうから雪の便りが増えてきます。",
        "sources": [
          {
            "name": "ベストカレンダー",
            "url": "https://www.bestcalendar.jp/koyomi/shosetsu"
          }
        ]
      }
    ],
    "legend": [
      {
        "region": "日本",
        "telop": "「耳から白い糸」はデマ",
        "title": "「耳から出た白い糸を抜くと失明する」は医学的な根拠のないデマ",
        "summary": "昔から語られてきた有名な都市伝説です。耳と目の神経はつながっていません。",
        "sources": [
          {
            "name": "Yahoo!ニュース（ウォーカープラス）",
            "url": "https://news.yahoo.co.jp/articles/98f0060ed2f3759c679ccb33e7c1132f0a026637"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "政府広報に都市伝説の人",
        "title": "安全保障の政府広報に「都市伝説」を紹介するユーチューバー。ふさわしくないと疑問の声",
        "summary": "政府は若い人に関心をもってもらうためと説明しています。うわさと事実を見分ける大切さが、あらためて話題になっています。",
        "sources": [
          {
            "name": "Yahoo!ニュース（読売新聞）",
            "url": "https://news.yahoo.co.jp/articles/e15b488622dc3d6606f9064f66db554e04ea3761"
          }
        ]
      },
      {
        "region": "世界",
        "telop": "グランドキャニオンは謎",
        "title": "グランドキャニオンがどうできたかは、まだだれにも分かっていない",
        "summary": "「川が長い時間をかけて削った」だけでは説明しきれず、いくつもの説があります。",
        "sources": [
          {
            "name": "ナゾロジー",
            "url": "https://nazology.kusuguru.co.jp/archives/210401"
          }
        ]
      }
    ],
    "season": [
      {
        "region": "日本",
        "telop": "今朝は冷えこみ 凍結注意",
        "title": "勤労感謝の日は広く晴れ。ただ朝は放射冷却で冷えこみ、凍結に注意",
        "summary": "東京や名古屋でも最低3度ほどの予想です。あす24日は全国的に雨や雪になる見込みです。",
        "sources": [
          {
            "name": "NHK",
            "url": "https://news.web.nhk/newsweb/na/nd-20261122de80033"
          },
          {
            "name": "ウェザーニュース",
            "url": "https://weathernews.jp/news/202611/220171/"
          }
        ]
      }
    ]
  }
};
