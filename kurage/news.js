// =============================================================
// 今日のニュース（この日付の時点で調べた内容）。毎朝の自動更新で入れ替わります。
// 各項目3記事。いま話題になっている新しい情報を選んでいます。
// 記事ごとに：region（日本 か 世界）/ telop / title / summary / detail（スポーツなどの短い説明）/
//   world（日本発信のものだけ：世界からどう見られているか・世界の似たもの）/ sources
// 「今日の天気」と「占い」はアプリが自動で作るので、ここには入れません。
// 「四季と暦」は、節気と旬をアプリが自動で足すので、ここには季節のニュースを1件だけ入れます。
// =============================================================
window.KURAGE_NEWS = {
  "date": "2026-11-25",
  "sections": {
    "today": [
      {
        "region": "日本",
        "telop": "佐藤輝明 カブスへ",
        "title": "阪神の佐藤輝明選手、大リーグのカブスと6年総額およそ191億円で合意と報道",
        "summary": "日本人の野手として最高額になると報じられています。今季は打率3割6厘、39本塁打、106打点で三冠王でした。",
        "world": "カブスは、これまで鈴木誠也選手が所属したチームで、アメリカでも人気の名門球団です。",
        "sources": [
          {
            "name": "Yahoo!ニュース（共同通信）",
            "url": "https://news.yahoo.co.jp/articles/474785680fdfa3dba06b2c466ae2afd4ed7a944f"
          },
          {
            "name": "時事ドットコム",
            "url": "https://sp.m.jiji.com/article/show/3918628"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "関東甲信 暖冬傾向",
        "title": "関東甲信、この冬は暖冬傾向。ただ気温の変化が大きく大雪のおそれも",
        "summary": "気象庁の3か月予報で、来月からの気温は平年より高いと予想されました。寒気が流れこむと大雪になることもあります。",
        "sources": [
          {
            "name": "NHK",
            "url": "https://news.web.nhk/newsweb/na/nd-20261124de80823"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "AI活用前提で制度見直し",
        "title": "政府の「AI・デジタル改革原則」の原案。AIを使うことを前提に規制や制度を見直す",
        "summary": "AIを生かすために、古いルールを見直していく方針が示されました。",
        "sources": [
          {
            "name": "NHK",
            "url": "https://news.web.nhk/newsweb/na/nd-20261124de80568"
          }
        ]
      }
    ],
    "ishikawa": [
      {
        "region": "日本",
        "telop": "強風で外壁はがれる",
        "title": "石川県内で強風。羽咋で最大瞬間風速23メートル、金沢で21メートル",
        "summary": "金沢市では、住宅の外壁や屋根瓦が壊れたという通報が相次ぎました。加賀地方には一時、竜巻注意情報も出ました。",
        "sources": [
          {
            "name": "北國新聞",
            "url": "https://www.hokkoku.co.jp/articles/-/2300575"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "二の丸御殿 設計を変更",
        "title": "金沢城の二の丸御殿の復元で、異例の設計変更。玄関の新しい図面が見つかる",
        "summary": "県は、見つかった図面をもとに「史実どおりに」復元するとしています。",
        "sources": [
          {
            "name": "北國新聞",
            "url": "https://www.hokkoku.co.jp/articles/-/2299430"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "七尾市 民宿の新設を支援",
        "title": "七尾市が民宿の新設に上限500万円の支援。県内初の条例",
        "summary": "和倉温泉では客室が半分ほどに減り、高級な宿が増えています。泊まりやすい宿を増やして、観光客を呼びこむねらいです。",
        "sources": [
          {
            "name": "北國新聞",
            "url": "https://www.hokkoku.co.jp/articles/-/2299415"
          }
        ]
      }
    ],
    "kosodate": [
      {
        "region": "日本",
        "telop": "ゼリー事故の再発防止",
        "title": "奈良県香芝市で、保育所やこども園の職員向けに窒息事故の再発防止の研修",
        "summary": "認定こども園で、園児が凍らせたゼリーをのどにつまらせて亡くなった事故を受けたものです。",
        "detail": "小さな子は、のどが細く、かむ力や飲みこむ力も育ちきっていません。丸くてつるっとした食べ物や、かたい食べ物は特に注意が必要です。",
        "sources": [
          {
            "name": "NHK",
            "url": "https://news.web.nhk/newsweb/na/nd-20261124de80557"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "性暴力防止法 代わりの策を",
        "title": "こども性暴力防止法の施行を前に、東京都が国に代わりの策を求める緊急要望",
        "summary": "働く人の性犯罪歴を確かめる仕組みの稼働が延期されたためです。法律は12月25日に施行される予定です。",
        "sources": [
          {
            "name": "リシード",
            "url": "https://reseed.resemom.jp/article/2026/11/24/14616.html"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "子どもの自殺 防止へ",
        "title": "小中高生の自殺、1月から10月で490人。過去最多だった去年を上回るペース",
        "summary": "こども家庭庁は、自治体への支援を強めるなど総力をあげて防ぐ方針です。悩みを打ち明けられる場所を、身近な大人が知っておくことも大切です。",
        "sources": [
          {
            "name": "リシード",
            "url": "https://reseed.resemom.jp/article/2026/11/24/14615.html"
          }
        ]
      }
    ],
    "kids": [
      {
        "region": "日本",
        "telop": "勤労感謝の日のはじまり",
        "title": "23日の勤労感謝の日は、どうしてできたの？",
        "summary": "もとは、その年にとれたお米を神さまにそなえて感謝する「新嘗祭」という行事でした。いまは、働く人みんなに感謝する日です。",
        "sources": [
          {
            "name": "学研キッズネット",
            "url": "https://kids.gakken.co.jp/"
          }
        ]
      },
      {
        "region": "世界",
        "telop": "世界テレビデー",
        "title": "11月21日は国連が決めた「世界テレビデー」",
        "summary": "テレビが情報を伝える大切な役割を考える日です。子ども向けのニュースで紹介されました。",
        "sources": [
          {
            "name": "学研キッズネット",
            "url": "https://kids.gakken.co.jp/"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "学研の新キャラ総選挙",
        "title": "学研グループの80周年記念キャラクター総選挙。親子で選ぼう",
        "summary": "学研の「新しい顔」になるキャラクターを、子どもたちの投票で選びます。",
        "sources": [
          {
            "name": "学研キッズネット",
            "url": "https://kids.gakken.co.jp/parents/news/gakken-character2026/"
          }
        ]
      }
    ],
    "sports": [
      {
        "region": "世界",
        "telop": "柏 アジアで連勝",
        "title": "サッカーのアジアチャンピオンズリーグエリート、柏レイソルがオーストラリアのチームに2対1で勝利",
        "summary": "途中から出た弓場堅真選手が決勝ゴールを決めました。",
        "detail": "アジアチャンピオンズリーグエリートは、アジアのクラブチームの1番を決める大会。勝つと世界のクラブの大会にもつながります。",
        "sources": [
          {
            "name": "Yahoo!ニュース（サッカーキング）",
            "url": "https://news.yahoo.co.jp/articles/18ea71e6fa96009fc4ba3fe727e8c6e5bedbfaa6"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "王将戦 27日プレーオフ",
        "title": "将棋の王将戦、挑戦者を決めるリーグで永瀬九段と藤本七段が並び、27日にプレーオフ",
        "summary": "勝った方が、藤井聡太王将に挑みます。王将戦の七番勝負は来年1月に始まります。",
        "detail": "リーグ戦で成績が同じ人が並んだときは、もう一局指して決めます。これを「プレーオフ」といいます。",
        "sources": [
          {
            "name": "Yahoo!ニュース（日刊スポーツ）",
            "url": "https://news.yahoo.co.jp/articles/adc155dfb2a5a5800fb3a5d27165711d7857fa3b"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "卓球 松島が世界1位",
        "title": "卓球の男子世界ランキング、松島輝空選手が1位をキープ。戸上隼輔選手は自己最高の11位",
        "summary": "戸上選手は国際大会で優勝して順位を上げました。",
        "detail": "世界ランキングは、大会の成績でもらえるポイントで決まります。大きな大会ほどポイントが多くもらえます。",
        "sources": [
          {
            "name": "Yahoo!ニュース（Rallys）",
            "url": "https://news.yahoo.co.jp/articles/4e3bf653ad2d267121eee06f3e9edb50f3dfa5b3"
          }
        ]
      }
    ],
    "music": [
      {
        "region": "日本",
        "telop": "ヒゲダン×ポケモン30周年",
        "title": "Official髭男dism、ポケモン30周年のための新曲「エバーグリーン」。スペシャルMVは30日公開",
        "summary": "ポケモンの30周年を記念して書き下ろした曲です。",
        "sources": [
          {
            "name": "音楽ナタリー",
            "url": "https://natalie.mu/music/news/699389"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "M!LK 新ツアー発表",
        "title": "M!LK、結成12周年の日に新しいアリーナツアーを発表",
        "summary": "生配信の同時視聴は、グループで最も多い34万人をこえました。",
        "sources": [
          {
            "name": "音楽ナタリー",
            "url": "https://natalie.mu/music/news/699471"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "相田翔子さんとコラボ",
        "title": "Night Tempoが、Winkの相田翔子さんとのコラボ曲を配信",
        "summary": "作曲には、ASIAN KUNG-FU GENERATIONの山田貴洋さんが参加しました。新しいアルバムも発表しました。",
        "sources": [
          {
            "name": "音楽ナタリー",
            "url": "https://natalie.mu/music/news/699316"
          }
        ]
      }
    ],
    "science": [
      {
        "region": "日本",
        "telop": "海王星の外に地球級の星？",
        "title": "海王星の外側に、地球くらいの大きさの惑星がかくれているかもしれない",
        "summary": "近畿大学などの研究です。地球の1.5倍から2倍の重さの惑星があれば、遠くの氷の天体のふしぎな動きを説明できるとしています。",
        "sources": [
          {
            "name": "ナゾロジー",
            "url": "https://nazology.kusuguru.co.jp/archives/211120"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "4色問題が前進",
        "title": "地図を4色でぬり分ける174年前の難問、計算方法が30年ぶりに前進",
        "summary": "日本の国立情報学研究所などのチームが、ぬり分けの計算をとても速くする方法を見つけました。",
        "detail": "「となり合う国がちがう色になるように地図をぬるには、4色あれば足りる」という問題です。",
        "sources": [
          {
            "name": "ナゾロジー",
            "url": "https://nazology.kusuguru.co.jp/archives/210604"
          }
        ]
      },
      {
        "region": "世界",
        "telop": "10月は記録上最も暑い",
        "title": "今年の10月は、記録が残る中でいちばん暑い10月だった",
        "summary": "ヨーロッパの気候を見守るサービスが発表しました。",
        "sources": [
          {
            "name": "ナゾロジー",
            "url": "https://nazology.kusuguru.co.jp/archives/210328"
          }
        ]
      }
    ],
    "anatomy": [
      {
        "region": "世界",
        "telop": "睡眠時間のばらつき",
        "title": "睡眠時間の「ばらつき」は、心臓や血管の病気のなりやすさと結びついていた",
        "summary": "アメリカの研究で、1万人あまりの眠りを半年間記録しました。平均の長さよりも、夜ごとのばらつきのほうが関係していました。",
        "detail": "体には「体内時計」があり、脳の奥の視床下部にある小さな部分が司令塔です。毎日同じ時間に寝て起きると、体内時計が整いやすくなります。",
        "sources": [
          {
            "name": "ナゾロジー",
            "url": "https://nazology.kusuguru.co.jp/archives/210648"
          }
        ]
      },
      {
        "region": "世界",
        "telop": "194歳のカメの遺伝子",
        "title": "194歳のゾウガメ、DNAを直す遺伝子の使い方が若いカメと同じ",
        "summary": "世界最高齢の陸の動物とされる「ジョナサン」を調べた研究です。長生きのひみつのヒントになるかもしれません。",
        "detail": "人の体の細胞でも、DNAは毎日のように傷つき、そのたびに直されています。この直す力が、年をとると少しずつ弱くなります。",
        "sources": [
          {
            "name": "ナゾロジー",
            "url": "https://nazology.kusuguru.co.jp/archives/211127"
          }
        ]
      },
      {
        "region": "世界",
        "telop": "初めてなのに懐かしい",
        "title": "幻覚剤を使った人は、初めての場所でも「懐かしい」と感じやすい",
        "summary": "「デジャブ」のような感覚について調べた研究です。",
        "detail": "記憶には、脳の奥にある「海馬（かいば）」がかかわっています。タツノオトシゴのような形からその名前がつきました。",
        "sources": [
          {
            "name": "ナゾロジー",
            "url": "https://nazology.kusuguru.co.jp/archives/210324"
          }
        ]
      }
    ],
    "phyto": [
      {
        "region": "日本",
        "telop": "「藻」を健康食品に",
        "title": "愛知県豊橋市で、「藻」を健康食品にするための大量生産の実験を公開",
        "summary": "豊橋技術科学大学などが、農業用のハウスで藻を大量に育てる実験をしています。",
        "sources": [
          {
            "name": "NHK",
            "url": "https://news.web.nhk/newsweb/na/nd-20261124de80836"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "漢方の考えを香りに",
        "title": "漢方の考え方を香りにした新しいブランド「nonu」が、香りの石けんを先行販売",
        "summary": "最初の商品は、香りを楽しめる固形の石けんです。",
        "sources": [
          {
            "name": "PR TIMES",
            "url": "https://prtimes.jp/main/html/rd/p/000000296.000034018.html"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "和漢チャイにあずき",
        "title": "漢方専門店の「和漢チャイ」に、カフェインなしの「あずき」",
        "summary": "ごぼう茶をベースにしていて、夜のリラックスタイムにも飲めるとしています。",
        "sources": [
          {
            "name": "PR TIMES（薬日本堂）",
            "url": "https://prtimes.jp/main/html/rd/p/000000063.000045717.html"
          }
        ]
      }
    ],
    "aroma": [
      {
        "region": "日本",
        "telop": "1日を描く香り 完結",
        "title": "1日の移り変わりを描く5つの香り、最後の「Black Mountain」が27日発売",
        "summary": "Yohakuブランドのボタニカルアロマミストのシリーズが、これで完成します。",
        "sources": [
          {
            "name": "PR TIMES",
            "url": "https://prtimes.jp/main/html/rd/p/000000053.000043904.html"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "お茶の香りのアロマストーン",
        "title": "お茶の香りが広がる、天然石のアロマストーン",
        "summary": "石にオイルをたらして香りを楽しみます。お茶の色に合わせた石が使われています。",
        "sources": [
          {
            "name": "PR TIMES（ライフオンプロダクツ）",
            "url": "https://prtimes.jp/main/html/rd/p/000000437.000073257.html"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "精油のロールオン 完売",
        "title": "オーガニック精油を3%入れたロールオンの香油、最初の分が完売",
        "summary": "追加でつくった分を販売し、東京と長野でポップアップのお店も開きます。",
        "sources": [
          {
            "name": "PR TIMES（AWA Olfactory）",
            "url": "https://prtimes.jp/main/html/rd/p/000000010.000137117.html"
          }
        ]
      }
    ],
    "sinary": [
      {
        "region": "日本",
        "telop": "化粧水シノワーズ R2",
        "title": "シナリーの化粧水「シノワーズ R2」の155mLサイズ",
        "summary": "公式サイトで「NEW」として紹介されている、植物由来の保湿成分を配合した化粧水です。バラの花水や天然水をベースにしています。価格は税込6,270円です。",
        "sources": [
          {
            "name": "シナリー公式サイト",
            "url": "https://www.sinary.com/products/item?id=R2N"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "R2の使い方の工夫",
        "title": "シノワーズ R2は「多めにたっぷり」。重ねづけの順番も",
        "summary": "公式の使い方は、適量を朝晩のスキンケアに。販社のニュースでは、R2をたっぷり使ってからモイスチャーローションを重ね、最後にUVクリームを密着させる順番が紹介されています。くわしい量は担当のアドバイザーに相談するのがおすすめです。",
        "detail": "スキンケアは、水分の多いものから油分の多いものへ順に重ねるのが基本です。化粧水で肌をうるおしてから、美容液、乳液やクリームでふたをします。",
        "sources": [
          {
            "name": "シナリー公式サイト",
            "url": "https://www.sinary.com/products/item?id=R2N"
          },
          {
            "name": "シナリー ゆいまある（販社ニュース）",
            "url": "https://uimaru.sinary.com/News/Distributor/DistributorNewsDetails?cid=375&kind=0&sCode="
          }
        ]
      },
      {
        "region": "日本",
        "telop": "コラーゲンZJの成分",
        "title": "コラーゲンゼリー「COLLAGEN ZJ」の成分を掘り下げ：プロテオグリカン・コラーゲン複合体",
        "summary": "機能性表示食品（届出番号J915、肌の分野）として受理されたざくろ味のゼリーです。1本にコラーゲンペプチド4,000mgと、サケの鼻軟骨からとった「プロテオグリカン・コラーゲン複合体」40mgが入っています。",
        "detail": "プロテオグリカンは、もともと軟骨の中で水をたっぷり抱えこむ成分です。「非変性II型コラーゲン」は、熱を加えずにとり出して、もとの形を保ったII型コラーゲンのこと。肌などで多いI型とはちがい、II型は軟骨に多いコラーゲンです。",
        "sources": [
          {
            "name": "シナリー公式サイト",
            "url": "https://www.sinary.com/products/item.aspx?id=CZJ"
          },
          {
            "name": "機能性表示食品データベース（民間）",
            "url": "https://yakujihou-marketing.net/database/j915/"
          }
        ]
      }
    ],
    "realestate": [
      {
        "region": "日本",
        "telop": "LPガスの肩代わり禁止へ",
        "title": "賃貸物件のLPガス設備費の肩代わり、全面禁止へ",
        "summary": "ガス会社が設備費を負担し、その分を入居者のガス代に上乗せする慣行を正すねらいです。オーナーにとっても見直しが必要になります。",
        "sources": [
          {
            "name": "日本経済新聞",
            "url": "https://www.nikkei.com/article/DGXZQOUA27CKQ0X21C26A0000000/"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "オーナーの個人情報を守る",
        "title": "賃貸オーナーの個人情報は大丈夫？ ハッカーや犯罪グループから身を守る",
        "summary": "入居審査の書類にある個人情報を早めに消すことなどがすすめられています。",
        "sources": [
          {
            "name": "健美家",
            "url": "https://www.kenbiya.com/ar/ns/for_rent/chintai_keiei/10717.html"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "賃貸住宅フェア 大阪で",
        "title": "オーナーや管理会社向けの「賃貸住宅フェア2026大阪」、26日と27日に開催",
        "summary": "インテックス大阪で開かれます。",
        "sources": [
          {
            "name": "健美家",
            "url": "https://www.kenbiya.com/ar/ns/release/p_event/10726.html"
          }
        ]
      }
    ],
    "nutrition": [
      {
        "region": "日本",
        "telop": "サプリで気をつけること",
        "title": "サプリをとるときは、脂に溶けるビタミンのとりすぎに注意",
        "summary": "ビタミンA・D・E・Kは体にたまりやすく、とりすぎると体に悪いことがあります。薬との飲み合わせにも気をつけましょう（よく知られた注意点です）。",
        "sources": [
          {
            "name": "Yahoo!ニュース（ダイヤモンド・オンライン）",
            "url": "https://news.yahoo.co.jp/articles/7d0d0a8997be68b6c06e29765af46fb2a0b93f18"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "魚の缶詰でオメガ3",
        "title": "手軽にオメガ3がとれる、魚の缶詰の選び方",
        "summary": "サバやイワシなどの青魚の缶詰には、オメガ3脂肪酸が多くふくまれます（成分の量は確かなデータです）。",
        "sources": [
          {
            "name": "Yahoo!ニュース（ウィメンズヘルス）",
            "url": "https://news.yahoo.co.jp/articles/42fff0be3bfd32e2d4c7f8eb8b2bf3f41b8b0109"
          }
        ]
      },
      {
        "region": "世界",
        "telop": "マルチビタミンと老化",
        "title": "毎日のマルチビタミン・ミネラルで、老化がゆっくりになる可能性",
        "summary": "平均70歳の958人を2年間調べた、大きな試験の一部の研究です（体の年齢の指標を見たもので、病気が減るかはまだわかりません）。",
        "sources": [
          {
            "name": "ナゾロジー",
            "url": "https://nazology.kusuguru.co.jp/archives/192734"
          }
        ]
      }
    ],
    "spiritual": [
      {
        "region": "日本",
        "telop": "今日は友引",
        "title": "今日25日は六曜の「友引」",
        "summary": "お昼ごろは凶、朝と夕方は吉とされます。お祝いごとには良い日といわれます。",
        "sources": [
          {
            "name": "ベストカレンダー",
            "url": "https://bestcalendar.jp/2026/11/25"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "虹がかくれるころ",
        "title": "七十二候は「虹蔵不見（にじかくれてみえず）」のころ",
        "summary": "日ざしが弱まり、空気が乾いて、虹を見かけなくなる時期とされます。",
        "sources": [
          {
            "name": "万年暦（中国の暦）",
            "url": "https://wannianli.tianqi.com/laohuangli/2026-11-25.html"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "満月のすぐあと",
        "title": "今夜の月は、満月をすぎたばかりの月齢15.8",
        "summary": "満月のあとは、手放しや整理に向く時期だといわれます。",
        "sources": [
          {
            "name": "ベストカレンダー",
            "url": "https://bestcalendar.jp/2026/11/25"
          }
        ]
      }
    ],
    "legend": [
      {
        "region": "日本",
        "telop": "「化石賞を報じない」は誤り",
        "title": "「日本がCOP31で化石賞を受けたのにマスコミは報じない」は誤り",
        "summary": "日本ファクトチェックセンターによると、朝日新聞や読売新聞など主要なメディアの多くが報じていました。",
        "sources": [
          {
            "name": "日本ファクトチェックセンター",
            "url": "https://www.factcheckcenter.jp/fact-check/politics/cop31-fossil-award-media-coverage/"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "「年金廃止」発言はない",
        "title": "「高市首相が年金廃止を発表」という動画は誤り",
        "summary": "もとの動画に「年金」という言葉は出てきません。切り取りや作り変えに注意しましょう。",
        "sources": [
          {
            "name": "日本ファクトチェックセンター",
            "url": "https://www.factcheckcenter.jp/tag/fact-check/"
          }
        ]
      },
      {
        "region": "世界",
        "telop": "陰謀論を信じやすい人",
        "title": "「心地よい答え」を選ぶ人ほど、陰謀論やワクチンへの不信にかたむいていた",
        "summary": "信じたい答えを選びがちな人ほど、根拠のない話を信じやすい傾向があったという研究です。",
        "sources": [
          {
            "name": "ナゾロジー",
            "url": "https://nazology.kusuguru.co.jp/archives/210949"
          }
        ]
      }
    ],
    "season": [
      {
        "region": "日本",
        "telop": "新潟 荒れた天気に注意",
        "title": "新潟県では25日にかけて荒れた天気。土砂災害や強風、高波に十分注意",
        "summary": "前線と上空の寒気の影響です。佐渡市には暴風警報も出ました。",
        "sources": [
          {
            "name": "NHK",
            "url": "https://news.web.nhk/newsweb/na/nd-20261124de80422"
          }
        ]
      }
    ]
  }
};
