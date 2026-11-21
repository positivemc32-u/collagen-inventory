// =============================================================
// 今日のニュース（この日付の時点で調べた内容）。毎朝の自動更新で入れ替わります。
// 各項目3記事。いま話題になっている新しい情報を選んでいます。
// 記事ごとに：region（日本 か 世界）/ telop / title / summary / detail（スポーツなどの短い説明）/
//   world（日本発信のものだけ：世界からどう見られているか・世界の似たもの）/ sources
// 「今日の天気」と「占い」はアプリが自動で作るので、ここには入れません。
// 「四季と暦」は、節気と旬をアプリが自動で足すので、ここには季節のニュースを1件だけ入れます。
// =============================================================
window.KURAGE_NEWS = {
  "date": "2026-11-22",
  "sections": {
    "today": [
      {
        "region": "日本",
        "telop": "藤井竜王 6連覇",
        "title": "将棋の竜王戦、藤井聡太竜王が4連勝で防衛し、6連覇",
        "summary": "宮崎県都城市で指された第4局で、挑戦者の服部慎一郎七段を94手で破りました。六冠を守り、今年のタイトル戦をすべて終えました。次は来年1月に始まる王将戦です。",
        "detail": "竜王戦は、将棋のタイトルの中でも賞金がいちばん高いといわれる大きな戦いです。七番勝負で先に4勝したほうが竜王になります。",
        "sources": [
          {
            "name": "NHK",
            "url": "https://news.web.nhk/newsweb/na/nd-20261121de79696"
          },
          {
            "name": "Yahoo!ニュース（共同通信）",
            "url": "https://news.yahoo.co.jp/articles/036ed98b5dbf4f54c886cbf3b841577d638f0b3a"
          }
        ]
      },
      {
        "region": "世界",
        "telop": "ウクライナに大規模攻撃",
        "title": "ウクライナ「ロシアから最大規模の攻撃。8人死亡、およそ30人けが」",
        "summary": "ゼレンスキー大統領が発表し、各国に防空の支援を急ぐよう求めました。",
        "sources": [
          {
            "name": "NHK",
            "url": "https://news.web.nhk/newsweb/na/nd-20261121de79482"
          }
        ]
      },
      {
        "region": "世界",
        "telop": "COP31 会期を延長",
        "title": "国連の気候会議COP31、化石燃料をめぐって対立し、会期を延長",
        "summary": "トルコで開かれている会議は20日に終わる予定でしたが、石油などの化石燃料について合意の文章にどう書くかで各国が対立し、話し合いが続いています。",
        "sources": [
          {
            "name": "Al Jazeera",
            "url": "https://www.aljazeera.com/news/2026/11/20/fossil-fuel-talks-deadlock-pushes-cop31-climate-summit-into-overtime"
          }
        ]
      }
    ],
    "ishikawa": [
      {
        "region": "日本",
        "telop": "9地点で今季いちばんの寒さ",
        "title": "今年最後の3連休初日、石川県内9地点で今季いちばんの冷えこみ",
        "summary": "金沢は最低3.7度、最高8.9度でした。雨の中、兼六園を散策する人の姿もありました。",
        "sources": [
          {
            "name": "北國新聞",
            "url": "https://www.hokkoku.co.jp/articles/-/2298129"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "能登に竜巻注意",
        "title": "21日、能登地方に竜巻注意の速報。加賀・能登とも高波に警戒",
        "summary": "発達した雨雲が近づくと突風が吹くおそれがあるとして、気象庁が発表しました。波の高さは5メートルの予想と伝えられました。",
        "sources": [
          {
            "name": "NHK",
            "url": "https://news.web.nhk/newsweb/na/nd-20261121de79639"
          },
          {
            "name": "Yahoo!ニュース（テレビ金沢）",
            "url": "https://news.yahoo.co.jp/articles/8372930ea718776f07f59b1d8dcc7c7bf6c3bf43"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "復興プラン 3割見直し",
        "title": "能登の「創造的復興プラン」、273の取り組みのおよそ3割を見直しへ",
        "summary": "県議会からは「抜本的な施策をしないと能登はなくなる」と注文が出ました。県は年内にもプランを改める予定です。",
        "sources": [
          {
            "name": "Yahoo!ニュース（MRO北陸放送）",
            "url": "https://news.yahoo.co.jp/articles/8aed78f35ab127f07d8da2416357ed5ce0a178af"
          },
          {
            "name": "NHK",
            "url": "https://news.web.nhk/newsweb/na/nd-20261111de73948"
          }
        ]
      }
    ],
    "kosodate": [
      {
        "region": "日本",
        "telop": "虐待 全国で緊急点検",
        "title": "こども家庭庁、児童相談所と市区町村の連携を全国で緊急点検",
        "summary": "大阪府枚方市や兵庫県伊丹市で子どもが亡くなる虐待事件が続いたことを受けたものです。保育所や病院からの知らせも含めて、危険を見落とさず情報を共有するよう求めました。",
        "sources": [
          {
            "name": "時事ドットコム",
            "url": "https://jiji.com/jc/article?g=pol&k=2026112000719&m=rss"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "RSウイルス 定期接種を検討",
        "title": "赤ちゃんのRSウイルス対策、抗体の薬を定期接種にする検討",
        "summary": "厚生労働省が議論のまとめを出しました。これから専門の会議で話し合われる見通しです。",
        "sources": [
          {
            "name": "リセマム",
            "url": "https://resemom.jp/article/2026/11/20/88394.html"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "SNS 年齢ごとの目安",
        "title": "子どものSNS利用、こども家庭庁が年齢に合わせた親の関わり方の目安",
        "summary": "6〜9歳はルールの理由を説明して子どもの意見を聞く、10〜12歳は家のルールづくりに子どもの意見を取り入れる、などとしています。最終的な報告は12月をめどにまとめます。",
        "sources": [
          {
            "name": "リセマム",
            "url": "https://resemom.jp/article/2026/11/11/88269.html"
          }
        ]
      }
    ],
    "kids": [
      {
        "region": "日本",
        "telop": "女性初の「棋士」",
        "title": "西山朋佳さん、将棋で女性初の「棋士」に",
        "summary": "「棋士」は「女流棋士」とは別の資格で、これまで女性はいませんでした。子ども向けの新聞でも、そのちがいが紹介されました。",
        "sources": [
          {
            "name": "学研キッズネット（朝日小学生新聞）",
            "url": "https://kids.gakken.co.jp/news/"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "国会でもタブレット",
        "title": "衆議院の本会議で、スマホやタブレットが使えるように",
        "summary": "これまで本会議の場では使えませんでした。子ども向けにやさしく書いた新聞で紹介されました。",
        "sources": [
          {
            "name": "学研キッズネット（やさしい朝日新聞）",
            "url": "https://kids.gakken.co.jp/news/"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "ネットで自分を守る",
        "title": "サイバー攻撃で個人情報の流出があいつぐ。子どもにできることは？",
        "summary": "子どもにもできる、身の守り方が紹介されています。",
        "sources": [
          {
            "name": "学研キッズネット（朝日小学生新聞）",
            "url": "https://kids.gakken.co.jp/news/"
          }
        ]
      }
    ],
    "sports": [
      {
        "region": "日本",
        "telop": "今日 千秋楽 優勝は？",
        "title": "大相撲九州場所、大の里と若元春が12勝2敗で並び、今日千秋楽",
        "summary": "横綱・大の里は金峰山を寄り切り、若元春は大関・安青錦を寄り倒しました。3敗の熱海富士が1差で追います。大の里は結びで豊昇龍と対戦します。",
        "detail": "2人とも勝つか2人とも負けると、決着は「優勝決定戦」へ。2人とも負けて熱海富士が勝つと、3人で戦う「ともえ戦」になります。大の里は豊昇龍に、これまで2勝9敗と苦手にしています。",
        "sources": [
          {
            "name": "NHK",
            "url": "https://news.web.nhk/newsweb/na/nd-20261121de79717"
          },
          {
            "name": "Yahoo!ニュース（スポーツ報知）",
            "url": "https://news.yahoo.co.jp/articles/89f728239a79ec7d213234c21e0ce49b38b8ac31"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "島田麻央 GPファイナルへ",
        "title": "フィギュア、18歳の島田麻央がグランプリ2連勝。12月のファイナル進出",
        "summary": "フィンランド大会で合計229.49点で優勝しました。シニア1年目のGP2連勝は、日本の女子では紀平梨花さん以来2人目です。今季のGPは日本の女子が5戦全勝です。",
        "detail": "島田選手は、むずかしいジャンプのトリプルアクセル（3回転半）と4回転を跳べるのが強み。GPファイナルは、6つの大会の成績上位6人だけが出られる大会です。",
        "sources": [
          {
            "name": "時事ドットコム",
            "url": "https://www.jiji.com/jc/article?k=2026112100483&g=spo&m=rss"
          },
          {
            "name": "Yahoo!ニュース（共同通信）",
            "url": "https://news.yahoo.co.jp/articles/8665e8dc3dab20f4c135bc6ebbf8735f10fe99e3"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "ラグビー 2試合続けて大敗",
        "title": "ラグビー日本代表、スコットランドに5対67で大敗",
        "summary": "イングランド戦に続いて2試合続けて60点以上を取られ、今大会は1勝5敗です。最終戦は27日から29日にイギリスで行われる順位決定戦です。",
        "detail": "ラグビーはボールを持って走り、相手のゴールラインの向こうにボールをつける「トライ」で5点。スコットランドは強豪の一つで、エディー・ジョーンズ監督は「きつい時期だと自覚している」と話しました。",
        "sources": [
          {
            "name": "Yahoo!ニュース（共同通信）",
            "url": "https://news.yahoo.co.jp/articles/0b35ba0c386f242daedc513499cd73e8423a6e17"
          },
          {
            "name": "Yahoo!ニュース（スポーツ報知）",
            "url": "https://news.yahoo.co.jp/articles/537574cafb7c28e8f3eb65fe0c6dee2effa9d1bc"
          }
        ]
      }
    ],
    "music": [
      {
        "region": "世界",
        "telop": "MAMA 大賞はBTS",
        "title": "大阪で開かれたK-POPの授賞式「MAMA」、BTSとENHYPENが大賞",
        "summary": "京セラドーム大阪で2日間開かれました。ENHYPENはファンが選ぶ大賞を受け、メンバーが涙を見せました。BIGBANGも賞を受けました。",
        "sources": [
          {
            "name": "Yahoo!ニュース（オリコン）",
            "url": "https://news.yahoo.co.jp/articles/3cb5725c2a165fde68e4b21e88c83bc312d8f133"
          },
          {
            "name": "Yahoo!ニュース（Kstyle）",
            "url": "https://news.yahoo.co.jp/articles/cdad6d57cfbbad98f0ecb0096491469abaa2e5c2"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "INI 京セラドームで受賞",
        "title": "INIが「MAMA」でアジアの人気グループ賞",
        "summary": "日本のグループのINIが「FAVORITE ASIAN GROUP」を受け、「これからも僕たち11人といい思い出を」と話しました。",
        "sources": [
          {
            "name": "Yahoo!ニュース（オリコン）",
            "url": "https://news.yahoo.co.jp/articles/ae1614f406b8fb5419a1dadb7cb11e1bb24ea6ac"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "RAPSTAR 8人が決定",
        "title": "ラップのオーディション「RAPSTAR 2026」、次のステージに進む8人が決定",
        "summary": "21日に最新回が配信され、課題曲12曲も配信が始まりました。",
        "sources": [
          {
            "name": "Yahoo!ニュース（音楽ナタリー）",
            "url": "https://news.yahoo.co.jp/articles/5fe677c45b04f8fb458aa4866c18d249185826f4"
          }
        ]
      }
    ],
    "science": [
      {
        "region": "日本",
        "telop": "H3 打ち上げを民間へ",
        "title": "H3ロケットの打ち上げ、来年1月の11号機から三菱重工業に",
        "summary": "これまでJAXAが行っていた打ち上げを、民間の会社が受け持ちます。費用を下げ、海外の衛星の打ち上げの注文を取ることがねらいです。11号機は来年1月11日に種子島から打ち上げる予定です。",
        "sources": [
          {
            "name": "NHK",
            "url": "https://news.web.nhk/newsweb/na/nd-20261120de78738"
          },
          {
            "name": "日本経済新聞",
            "url": "https://www.nikkei.com/article/DGXZQOSG202HS0Q6A121C2000000/"
          }
        ]
      },
      {
        "region": "世界",
        "telop": "放射線の帯が4本に",
        "title": "地球をとりまく放射線の帯が、観測で初めて4本に分かれていた",
        "summary": "2024年5月の大きな磁気嵐のあと、ふだんは2本の帯が4本に分かれていたことがわかりました。人工衛星を守る研究に役立ちます。",
        "sources": [
          {
            "name": "ナゾロジー",
            "url": "https://nazology.kusuguru.co.jp/archives/210140"
          }
        ]
      },
      {
        "region": "世界",
        "telop": "オスのハチも子育て",
        "title": "オスのマルハナバチ、卵や幼虫を温めて巣を育てていた",
        "summary": "これまでオスは交尾だけをすると思われていましたが、体の熱で子を温めていることが観察されました。",
        "sources": [
          {
            "name": "ナゾロジー",
            "url": "https://nazology.kusuguru.co.jp/archives/210214"
          }
        ]
      }
    ],
    "anatomy": [
      {
        "region": "世界",
        "telop": "冬に「冬眠」する女性",
        "title": "冬になると冬眠のような状態を30年くり返した女性。脳の体温を調節する仕組みに手がかり",
        "summary": "体温を調節するホルモンをつくる脳の細胞はあるのに、そのホルモンがほとんど見えなかったと報告されています。",
        "detail": "体温は、脳の奥にある「視床下部（ししょうかぶ）」が決めています。エアコンの設定温度のように、ちょうどいい体温を保つ司令塔です。",
        "sources": [
          {
            "name": "ナゾロジー",
            "url": "https://nazology.kusuguru.co.jp/archives/210174"
          }
        ]
      },
      {
        "region": "世界",
        "telop": "腸の壁がすばやく治る",
        "title": "腸の善玉菌がつくる物質が、傷ついた腸の壁の回復を早めると判明",
        "summary": "細胞の中の「NAD」という物質に注目した研究で、マウスの実験で示されました。",
        "detail": "腸の内側は、細胞が1列に並んだうすい壁でできています。この壁は数日で入れかわるほど、生まれかわりが早い場所です。",
        "sources": [
          {
            "name": "ナゾロジー",
            "url": "https://nazology.kusuguru.co.jp/archives/209628"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "受精卵の核はやわらかい",
        "title": "受精したばかりのマウスの胚では、細胞の「核」が一時的にやわらかくなる",
        "summary": "国立遺伝学研究所や九州大学のグループが発表しました。核がやわらかくなることが、胚が自分の遺伝子を働かせはじめるのに大事だとしています。",
        "detail": "核は、細胞の中で遺伝子（DNA）をしまっている部屋です。人の体はおよそ37兆個の細胞でできています。",
        "sources": [
          {
            "name": "JST",
            "url": "https://www.jst.go.jp/pr/announce/20261112/index.html"
          }
        ]
      }
    ],
    "phyto": [
      {
        "region": "日本",
        "telop": "漢方の情報を強化",
        "title": "漢方の薬、胃腸の不調や眠りの悩みの分野で情報提供を強化",
        "summary": "医薬品の専門紙の薬事日報が、20日付で伝えました。",
        "sources": [
          {
            "name": "薬事日報",
            "url": "https://www.yakuji.co.jp/entry141983.html"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "ツムラ×薬屋のひとりごと",
        "title": "ツムラの漢方シリーズと映画「薬屋のひとりごと」がコラボ",
        "summary": "11月2日からキャンペーンが行われています。",
        "sources": [
          {
            "name": "ツムラ",
            "url": "https://www.tsumura.co.jp/news/newsrelease/"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "温めとめぐりの生薬",
        "title": "日本メディカルハーブ協会が28日に「温めとめぐりの生薬」のオンライン講座",
        "summary": "寒くなる季節に合わせて、体を温める生薬などを学ぶ講座です。",
        "sources": [
          {
            "name": "日本メディカルハーブ協会",
            "url": "https://www.medicalherb.or.jp/items/353004"
          }
        ]
      }
    ],
    "aroma": [
      {
        "region": "日本",
        "telop": "肌で完成する香水",
        "title": "肌の香りと合わせて完成する香水ブランド「New Notes」が20日から本格展開",
        "summary": "香水専門店のNOSE SHOPが、濃い香りの「エキストレドパルファム」8種類を出しました。",
        "sources": [
          {
            "name": "PR TIMES（NOSE SHOP）",
            "url": "https://prtimes.jp/main/html/rd/p/000000194.000024774.html"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "今年の香り アールグレイ",
        "title": "2026年の香りのトレンドは「アールグレイ＆タイム」",
        "summary": "香りの会社が予想した今年のキーワードで、静かでぜいたくな時間を楽しむ香りとしています。",
        "sources": [
          {
            "name": "プロモツール",
            "url": "https://www.promotool.jp/251126-1/"
          }
        ]
      },
      {
        "region": "世界",
        "telop": "11月の新作香水",
        "title": "11月はシスレーやバーバリーなど、新作の香水が続々",
        "summary": "ホリデーシーズンに向けて、新しい香りの発売が続いています。",
        "sources": [
          {
            "name": "LIPS",
            "url": "https://lipscosme.com/cosmetic_calendar/categories/212"
          }
        ]
      }
    ],
    "realestate": [
      {
        "region": "日本",
        "telop": "家賃 28年ぶりの上昇率",
        "title": "民営の家賃、9月は全国で0.8%上昇。およそ28年ぶりの上昇率",
        "summary": "東京23区は2.2%の上昇でした。平均的な家賃で2年住むと、23区では約5万円負担が増える計算です。",
        "sources": [
          {
            "name": "Yahoo!ニュース（LIMO）",
            "url": "https://news.yahoo.co.jp/articles/8d3463fd4704f8be693c5bf86f4478e64c4003dd"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "単身向け家賃 最高値",
        "title": "東京23区の単身向けマンションの家賃、9月も最高値を更新",
        "summary": "ただし上がり方はゆるやかになっていて、高すぎる物件は借り手がつきにくいという声も出ています。",
        "sources": [
          {
            "name": "日本経済新聞",
            "url": "https://www.nikkei.com/article/DGXZQOUB2503W0V21C26A0000000/"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "家賃は自由に上げられない",
        "title": "オーナーが知っておきたい「家賃の値上げ」の基本",
        "summary": "借りている人が値上げに同意しないときは、オーナーは「賃料増額請求」という手続きが必要です。一方的には決められません。",
        "sources": [
          {
            "name": "健美家",
            "url": "https://www.kenbiya.com/ar/ns/jiji/legal_knowledge/9934.html"
          }
        ]
      }
    ],
    "nutrition": [
      {
        "region": "世界",
        "telop": "ケトン体と炎症",
        "title": "糖質をひかえると増える「ケトン体」に、体の炎症をおさえる働きの可能性",
        "summary": "これまでの研究をまとめた総説で、11月の学術誌に載りました。動物や細胞の研究が中心で、人での効果はまだ確かめる段階です（エビデンスは中くらい以下）。",
        "sources": [
          {
            "name": "ナゾロジー",
            "url": "https://nazology.kusuguru.co.jp/archives/205927"
          }
        ]
      },
      {
        "region": "世界",
        "telop": "長生きの方法の共通点",
        "title": "寿命をのばす5つの方法には、代謝の変化に共通点があった",
        "summary": "アメリカのミシガン大学などがマウスで調べ、11月の学術誌に発表しました。人にそのまま当てはまるかはまだわかりません（動物実験の段階）。",
        "sources": [
          {
            "name": "ナゾロジー",
            "url": "https://nazology.kusuguru.co.jp/archives/208452"
          }
        ]
      },
      {
        "region": "世界",
        "telop": "ビタミンDとマグネシウム",
        "title": "ビタミンDを活かすにはマグネシウムが欠かせない",
        "summary": "マグネシウムは、ビタミンDを体の中で働く形に変えるのに必要です。2026年の総説でも整理されています（しくみはよく知られていますが、サプリでの効果は研究が続いています）。",
        "sources": [
          {
            "name": "Drexel University（総説）",
            "url": "https://researchdiscovery.drexel.edu/esploro/outputs/journalArticle/Role-of-Magnesium-in-Vitamin-D/991022200957804721"
          }
        ]
      }
    ],
    "spiritual": [
      {
        "region": "日本",
        "telop": "今日は小雪",
        "title": "今日22日は二十四節気の「小雪」",
        "summary": "日本時間の午後4時23分に入ります。北のほうから雪がちらつきはじめるころで、冬じたくを整える節目とされます。",
        "sources": [
          {
            "name": "ベストカレンダー",
            "url": "https://www.bestcalendar.jp/koyomi/shosetsu"
          },
          {
            "name": "雑学ネタ帳",
            "url": "https://zatsuneta.com/archives/111220.html"
          }
        ]
      },
      {
        "region": "日本",
        "telop": "あした23日は新嘗祭",
        "title": "あした23日の勤労感謝の日は、新米を神さまに供える新嘗祭",
        "summary": "宮中や全国の神社で、その年の実りに感謝します。",
        "sources": [
          {
            "name": "ベストカレンダー",
            "url": "https://bestcalendar.jp/dates/kinenbi/134966"
          }
        ]
      },
      {
        "region": "世界",
        "telop": "23日は下元節",
        "title": "台湾などでは23日が「下元節」。水の神さまをまつる日とされます",
        "summary": "旧暦の10月15日にあたる日で、台湾のニュースが伝えています。",
        "sources": [
          {
            "name": "NOWnews",
            "url": "https://www.nownews.com/news/6893157"
          }
        ]
      }
    ],
    "legend": [
      {
        "region": "世界",
        "telop": "人は冬眠できる？",
        "title": "「人間も冬眠できる」って本当？",
        "summary": "マウスでは、脳の一部の細胞を働かせると冬眠に近い状態になることがわかっています。人で冬眠のような状態をくり返した例も報告されましたが、人が自由に冬眠できる方法はまだありません。",
        "sources": [
          {
            "name": "ナゾロジー",
            "url": "https://nazology.kusuguru.co.jp/archives/199231"
          },
          {
            "name": "ナゾロジー",
            "url": "https://nazology.kusuguru.co.jp/archives/210174"
          }
        ]
      },
      {
        "region": "世界",
        "telop": "「オスは働かない」はまちがい",
        "title": "「オスのハチは何もしない」は言いすぎ",
        "summary": "マルハナバチのオスが、子を温めて巣を育てていたことがわかりました。生き物の「常識」も、研究で変わることがあります。",
        "sources": [
          {
            "name": "ナゾロジー",
            "url": "https://nazology.kusuguru.co.jp/archives/210214"
          }
        ]
      },
      {
        "region": "世界",
        "telop": "「11月に宇宙船」説 残り9日",
        "title": "ババ・ヴァンガの「2026年11月に宇宙船」説、11月は残り9日",
        "summary": "本人の記録はなく、根拠は確認されていません。宇宙のニュースなら、日本のH3ロケットが民間の打ち上げに変わる話のほうが現実的です。",
        "sources": [
          {
            "name": "検証記事（スマホと暮らしのヒント）",
            "url": "https://sense-yoku.hatenablog.com/entry/2026/11/11/062706"
          }
        ]
      }
    ],
    "season": [
      {
        "region": "日本",
        "telop": "新潟 土砂災害に厳重警戒",
        "title": "強い冬型が続き、新潟県では22日にかけて土砂災害に厳重警戒",
        "summary": "柏崎市・上越市・刈羽村に「レベル4」の土砂災害危険警報が出ました。北日本や東日本の山沿いでは雪も積もっています。3連休の移動は最新の情報を確かめてください。",
        "sources": [
          {
            "name": "NHK",
            "url": "https://news.web.nhk/newsweb/na/nd-20261121de79668"
          },
          {
            "name": "NHK",
            "url": "https://news.web.nhk/newsweb/na/nd-20261121de79606"
          }
        ]
      }
    ]
  }
};
