// =============================================================
// 占い・節気・季節の「毎日自動で変わる」記事を作る
// （ニュースと同じ形 { telop, title, summary, detail, talk } で返します）
// =============================================================
(function (global) {
  'use strict';
  const A = global.KurageAstro;

  // 都道府県庁所在地（生まれた場所の候補）
  const PLACES = [
    ['北海道 札幌市', 43.064, 141.347], ['青森県 青森市', 40.824, 140.740], ['岩手県 盛岡市', 39.704, 141.153],
    ['宮城県 仙台市', 38.269, 140.872], ['秋田県 秋田市', 39.719, 140.102], ['山形県 山形市', 38.240, 140.364],
    ['福島県 福島市', 37.750, 140.468], ['茨城県 水戸市', 36.342, 140.447], ['栃木県 宇都宮市', 36.566, 139.884],
    ['群馬県 前橋市', 36.391, 139.061], ['埼玉県 さいたま市', 35.857, 139.649], ['千葉県 千葉市', 35.605, 140.123],
    ['東京都 新宿区', 35.690, 139.692], ['神奈川県 横浜市', 35.448, 139.642], ['新潟県 新潟市', 37.902, 139.023],
    ['富山県 富山市', 36.695, 137.211], ['石川県 金沢市', 36.561, 136.656], ['福井県 福井市', 36.065, 136.222],
    ['山梨県 甲府市', 35.664, 138.568], ['長野県 長野市', 36.651, 138.181], ['岐阜県 岐阜市', 35.391, 136.722],
    ['静岡県 静岡市', 34.977, 138.383], ['愛知県 名古屋市', 35.180, 136.907], ['三重県 津市', 34.730, 136.509],
    ['滋賀県 大津市', 35.004, 135.869], ['京都府 京都市', 35.021, 135.756], ['大阪府 大阪市', 34.686, 135.520],
    ['兵庫県 神戸市', 34.691, 135.183], ['奈良県 奈良市', 34.685, 135.833], ['和歌山県 和歌山市', 34.226, 135.168],
    ['鳥取県 鳥取市', 35.504, 134.238], ['島根県 松江市', 35.472, 133.051], ['岡山県 岡山市', 34.662, 133.935],
    ['広島県 広島市', 34.397, 132.460], ['山口県 山口市', 34.186, 131.471], ['徳島県 徳島市', 34.066, 134.559],
    ['香川県 高松市', 34.340, 134.043], ['愛媛県 松山市', 33.842, 132.766], ['高知県 高知市', 33.560, 133.531],
    ['福岡県 福岡市', 33.606, 130.418], ['佐賀県 佐賀市', 33.249, 130.299], ['長崎県 長崎市', 32.745, 129.874],
    ['熊本県 熊本市', 32.790, 130.742], ['大分県 大分市', 33.238, 131.613], ['宮崎県 宮崎市', 31.911, 131.424],
    ['鹿児島県 鹿児島市', 31.560, 130.558], ['沖縄県 那覇市', 26.212, 127.681],
  ];

  const LIFE_PATH = {
    1: '道を切りひらくリーダー。自分で決めて動くほど運が開きます。',
    2: '人と人をつなぐ調整役。やさしさと気配りが最大の武器です。',
    3: '表現と楽しさの人。笑顔と言葉で周りを明るくします。',
    4: 'コツコツ積み上げる堅実な人。続けることが必ず実を結びます。',
    5: '変化と自由を楽しむ冒険家。新しい体験が運を運んできます。',
    6: '愛情深く面倒見のよい人。誰かのために動くと運気が上がります。',
    7: '物事の本質を探る探究者。ひとりで考える静かな時間が力になります。',
    8: '現実を動かす実行力の人。お金や仕事の流れをつかむのが上手です。',
    9: '大きな心で包みこむ人。経験を人に分けるほど豊かになります。',
    11: '直感とひらめきのマスターナンバー。インスピレーションを信じて。',
    22: '大きな夢を形にするマスターナンバー。長い目で計画を。',
    33: '無償の愛のマスターナンバー。あなたの存在そのものが癒やしです。',
  };
  const PERSONAL_DAY = {
    1: '始まりの日。新しいことを1つ始めてみて。',
    2: '協力の日。誰かと一緒にやると上手くいきます。',
    3: '楽しむ日。おしゃべりや遊び心が運を呼びます。',
    4: '土台づくりの日。片づけや事務作業がはかどります。',
    5: '変化の日。いつもと違う道・お店を選んでみて。',
    6: '愛の日。家族や身近な人を大切にすると吉。',
    7: '内省の日。ひとり時間で心と体を休めて。',
    8: '実りの日。お金や仕事の決断に向いています。',
    9: '手放しの日。いらない物・考えを手放すとすっきり。',
  };
  const KYUSEI_TRAIT = [
    '水のように柔軟で、どんな環境にもなじむ人。人の気持ちを汲むのが上手。',
    '大地のように包容力があり、コツコツ努力を続けられる人。',
    '若木のように元気で、思い立ったらすぐ動ける行動派。',
    '風のように人とのご縁を運ぶ人。信用を大切にすると運が育ちます。',
    'すべての中心に立つ強い星。ここぞという時の底力があります。',
    '天のように気高く、責任感の強いリーダー気質。',
    '沢のように人を楽しませる社交家。会話と食に縁があります。',
    '山のようにどっしり。変化をチャンスに変える力があります。',
    '火のように明るく華やか。直感と美的センスに優れます。',
  ];
  const MOON_TODAY = {
    '牡羊座': 'スタートダッシュが決まる日。迷ったら先に動いた方が勝ち。',
    '牡牛座': '五感を満たすと運気アップ。おいしい物・心地よい物を選んで。',
    '双子座': '情報と会話の日。気になることは調べて、人に話してみて。',
    '蟹座': '家と心を整える日。身近な人とのんびり過ごすと吉。',
    '獅子座': '主役になれる日。思い切って自分を表現してみて。',
    '乙女座': '整理整頓の日。細かい所まで気を配るほど信頼が集まります。',
    '天秤座': 'バランスと美の日。人との約束やおしゃれに運があります。',
    '蠍座': '集中と深掘りの日。ひとつのことにじっくり向き合って。',
    '射手座': '視野を広げる日。遠くの計画や学びを始めるのに良い日。',
    '山羊座': '目標に向かう日。コツコツ進めたことが評価されます。',
    '水瓶座': 'ひらめきの日。いつもと違う発想が道を開きます。',
    '魚座': '感受性が高まる日。音楽や香りで心をゆるめて。',
  };
  const EL_TIP = {
    '木': '今日は「木」の気の日。東の方角に観葉植物や緑の物を置くと、成長と発展の運が育ちます。',
    '火': '今日は「火」の気の日。南の窓を開けて光を入れ、キャンドルや赤い小物で華やかさをプラス。',
    '土': '今日は「土」の気の日。床や玄関を拭き掃除すると、どっしりした安定運が整います。',
    '金': '今日は「金」の気の日。財布の中のレシートを出して、西側を整えると金運アップ。',
    '水': '今日は「水」の気の日。北側の水回り（洗面所・トイレ）をきれいにすると、人の縁と流れが良くなります。',
  };
  const LUCKY_COLORS = ['水色', 'ラベンダー', 'ミントグリーン', 'アイボリー', 'コーラルピンク', 'ネイビー', 'ゴールド', 'シルバー', 'テラコッタ', 'オリーブ', 'ワインレッド', 'パールホワイト'];
  const LUCKY_ITEMS = ['ハーブティー', 'お気に入りのペン', '手鏡', 'ハンカチ', '温かいスープ', '一輪の花', '精油のロールオン', 'ノート', '水晶', '小さなお菓子', '本', '音楽プレイリスト'];
  const LUCKY_ACTIONS = ['深呼吸を3回', '誰かに「ありがとう」を伝える', '靴をそろえる', '空を見上げる', '白湯を飲む', '5分だけ散歩する', '引き出しを1つ片づける', '好きな香りをかぐ', '早めに寝る', '昔の友だちに連絡する'];
  const READINGS = [
    'あなたの背中のあたりに、やわらかい光が見えます。今まで頑張ってきたことが、静かに形になり始めているサイン。焦らなくて大丈夫。',
    '海の底から、ゆっくり浮かび上がるクラゲのイメージが来ました。抱えていた悩みは、時間とともに自然とほどけていきます。',
    '胸のあたりに少し重たい雲が見えます。言えずにいる気持ちがあるなら、信頼できる人に少しだけ話してみて。',
    '足元に小さな芽が見えます。今日始めた小さなことが、来年の大きな実りにつながるかもしれません。',
    '耳のまわりがきらきらしています。今日は人の言葉の中にヒントが隠れていそう。雑談を大切に。',
    '手のひらが温かく光っています。誰かを手助けすると、その何倍もの幸運が巡ってきます。',
    '遠くに灯台の明かりが見えます。迷ったときは、最初に「こうしたい」と思った気持ちを信じて。',
    '波がおだやかに寄せては返しています。今日は無理に流れを変えず、ゆだねる方がうまくいく日。',
  ];

  function elRelation(a, b) {
    if (a === b) return { score: 2, text: '同じ性質どうしで、心がすっと落ち着く調和の日' };
    const good = { '火': '風', '風': '火', '地': '水', '水': '地' };
    if (good[a] === b) return { score: 1, text: '性質が支え合う、追い風の吹く日' };
    return { score: 0, text: 'いつもと違う刺激がもらえる、気づきの日' };
  }
  const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
  const fmtDate = (d) => `${d.getMonth() + 1}月${d.getDate()}日`;

  function placeLabel(b) {
    if (b.placeName) return b.placeName;
    if (!isFinite(b.lat) || !isFinite(b.lon)) return '場所は未設定';
    const p = PLACES.find((x) => Math.abs(x[1] - b.lat) < 0.01 && Math.abs(x[2] - b.lon) < 0.01);
    return p ? p[0] : `北緯${b.lat}・東経${b.lon}`;
  }

  // b: { y, m, d, time:'08:00' or '', lat, lon, tz, placeName }
  function fortuneItems(b, today) {
    const key = `${today.toDateString()}|${b.y}-${b.m}-${b.d}|${b.time}|${b.lat},${b.lon}`;
    const rnd = A.seeded(key);
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    const natal = A.natalChart(b);
    const moon = A.moonInfo(new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12));
    const num = A.numerology(b, today);
    const hon = A.honmei(b.y, b.m, b.d, ...(b.time ? b.time.split(':').map(Number) : [12, 0]), b.tz);
    const kanshi = A.dayKanshi(today);
    const reki = A.rekichu(today);
    const rel = elRelation(moon.sign.el, natal.sunSign.el);
    const isFull = moon.phase === '満月';
    const isNew = moon.phase === '新月';

    const score = Math.max(1, Math.min(5, 2 + rel.score + (reki.length || isFull || isNew ? 1 : 0) +
      ([1, 3, 8].includes(num.personalDay) ? 1 : 0) + (rnd() < 0.35 ? 1 : 0)));
    const birthLabel = `${b.y}年${b.m}月${b.d}日${b.time ? ` ${Number(b.time.split(':')[0])}時${b.time.split(':')[1]}分` : ''}生まれ・${placeLabel(b)}`;
    const cusp = natal.sunDeg >= 29 || natal.sunDeg < 1;
    const sunText = `太陽は${natal.sunSign.name}${natal.sunDeg}度` + (cusp ? `（となりの星座との境目「カスプ」で、両方の性質をあわせ持ちます）` : '');
    const ascText = natal.ascSign ? `、アセンダント（第一印象）は${natal.ascSign.name}` : '（生まれた時間がわからないため、アセンダントは出していません）';
    const color = pick(LUCKY_COLORS), item = pick(LUCKY_ITEMS), action = pick(LUCKY_ACTIONS);

    return [
      {
        telop: `今日の運気 ${stars(score)}`,
        title: `${fmtDate(today)}の総合運は ${stars(score)}`,
        summary: `今日は月が${moon.sign.name}を通る日。${natal.sunSign.name}生まれのあなたにとって、${rel.text}です。` +
          (isFull ? '今日は満月。物事がひとつの区切りを迎え、願いが形になりやすい日です。' : '') +
          (isNew ? '今日は新月。新しい願いごとを書き出すのにぴったりです。' : '') +
          (reki.length ? `暦の上では${reki.map((r) => r.name).join('・')}でもあります。` : ''),
        detail: `ラッキーカラーは${color}、ラッキーアイテムは${item}。おすすめの開運アクションは「${action}」です。`,
        talk: `今日は${reki.length ? reki[0].name + 'で' : ''}${isFull ? '満月だから' : ''}、何か小さく始めるのにいい日なんだって。`,
        sources: [], kind: 'fortune',
      },
      {
        telop: `月は${moon.sign.name} 占星術`,
        title: `西洋占星術：今日の月は${moon.sign.name}（月齢${moon.age.toFixed(1)}・${moon.phase}）`,
        summary: MOON_TODAY[moon.sign.name],
        detail: `あなたの生まれた時の星（${birthLabel}）：${sunText}、月は${natal.moonSign.name}${natal.moonDeg}度${ascText}。` +
          `太陽星座は「生き方」、月星座は「素の心」をあらわします。今日の月（${moon.sign.name}）と、あなたの月（${natal.moonSign.name}）が` +
          (moon.sign.name === natal.moonSign.name ? '同じ星座に重なる、心が満たされやすい日です。' : '別の場所にあるので、気持ちの切り替えを意識すると上手くいきます。'),
        talk: `今日は月が${moon.sign.name}にあるんだって。「${MOON_TODAY[moon.sign.name]}」らしいよ。`,
        sources: [], kind: 'fortune',
      },
      {
        telop: `数秘 今日は「${num.personalDay}」の日`,
        title: `数秘術：ライフパス${num.lifePath}・今日はパーソナルデー${num.personalDay}`,
        summary: `今日は${PERSONAL_DAY[num.personalDay]}`,
        detail: `生年月日の数字をすべて足したライフパスナンバーは「${num.lifePath}」。${LIFE_PATH[num.lifePath]}` +
          `今年（${today.getFullYear()}年）はパーソナルイヤー「${num.personalYear}」、今月は「${num.personalMonth}」の流れの中にいます。`,
        talk: `数秘術だと今日は「${num.personalDay}」の日。${PERSONAL_DAY[num.personalDay]}`,
        sources: [], kind: 'fortune',
      },
      {
        telop: `${hon.name} 風水`,
        title: `九星気学・風水：本命星は${hon.name}／今日は${kanshi.name}の日`,
        summary: EL_TIP[kanshi.el],
        detail: `あなたの本命星は${hon.name}（立春から数えて${hon.year}年の星）。${KYUSEI_TRAIT[hon.idx]}` +
          (reki.length ? `\n今日の暦：${reki.map((r) => `${r.name}…${r.text}`).join(' ')}` : `今日の日の干支は${kanshi.name}です。`),
        talk: `風水だと今日は「${kanshi.el}」の日。${EL_TIP[kanshi.el].split('。')[1] || ''}`,
        sources: [], kind: 'fortune',
      },
      {
        telop: 'クラゲの直感リーディング',
        title: 'クラゲの直感リーディング（霊視風メッセージ）',
        summary: pick(READINGS),
        detail: `今日のキーワードは「${pick(['ゆだねる', 'はじめる', '整える', '伝える', '受けとる', '手放す', '楽しむ', '信じる'])}」。` +
          '迷ったときは、ふわふわ漂うクラゲのように、力を抜いて流れに乗ってみてください。（エンターテインメントとしてお楽しみください）',
        talk: 'クラゲのリーディングだと、今日は力を抜いた方がうまくいくんだって。',
        sources: [], kind: 'fortune',
      },
    ];
  }

  // 二十四節気・七十二候・今日の暦
  function sekkiItems(today) {
    const s = A.seasonInfo(today);
    const moon = A.moonInfo(new Date(today.getFullYear(), today.getMonth(), today.getDate(), 21));
    const kanshi = A.dayKanshi(today);
    const reki = A.rekichu(today);
    const daysTo = Math.ceil((new Date(s.nextSekkiStart.getFullYear(), s.nextSekkiStart.getMonth(), s.nextSekkiStart.getDate()) - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
    return [
      {
        telop: `今は「${s.sekki.name}」`,
        title: `二十四節気：${s.sekki.name}（${s.sekki.yomi}）　${fmtDate(s.sekkiStart)}から`,
        summary: s.sekki.text,
        detail: `次の節気は「${s.nextSekki.name}（${s.nextSekki.yomi}）」で、${fmtDate(s.nextSekkiStart)}から。あと${daysTo}日です。${s.nextSekki.text}`,
        talk: `今は二十四節気の「${s.sekki.name}」。あと${daysTo}日で「${s.nextSekki.name}」なんだよ。`,
        sources: [], kind: 'sekki',
      },
      {
        telop: `七十二候「${s.kou.name}」`,
        title: `七十二候：${s.kou.name}（${s.kou.yomi}）`,
        summary: `${s.kou.mean}ころ。七十二候の第${s.kou.no}候で、${fmtDate(s.kouStart)}〜${fmtDate(s.kouEnd)}ごろです。`,
        detail: `七十二候は、二十四節気をさらに約5日ずつに分けて、自然の小さな変化を名前にしたもの。次は「${s.nextKou.name}（${s.nextKou.yomi}）」…${s.nextKou.mean}ころです。`,
        talk: `今は七十二候でいうと「${s.kou.yomi}」。${s.kou.mean}ころって意味なんだって。`,
        sources: [], kind: 'sekki',
      },
      {
        telop: `今日の暦 ${kanshi.name}`,
        title: `今日の暦：${kanshi.name}の日・月齢${moon.age.toFixed(1)}（${moon.phase}）`,
        summary: reki.length ? `今日は${reki.map((r) => r.name).join('・')}。${reki[0].text}` : `今日の干支は${kanshi.name}。特別な暦注のない、落ち着いた一日です。`,
        detail: `月齢は夜9時ごろで${moon.age.toFixed(1)}、${moon.phase}です。昔の人は月の満ち欠けで日にちを数えていて、満月はおよそ15日目「十五夜」にあたります。`,
        talk: reki.length ? `今日って${reki[0].name}なんだよ。` : `今日の干支は${kanshi.name}だって。`,
        sources: [], kind: 'sekki',
      },
    ];
  }

  // 月ごとの旬（四季の項目に毎日自動で入ります）
  const SHUN = [
    ['冬の旬', 'ぶり・ほうれん草・ゆず・春菊', 'お正月、七草がゆ（7日）、鏡開き（11日）'],
    ['冬の旬', 'ふきのとう・はまぐり・いよかん・菜の花', '節分（豆まき）、立春、梅のつぼみ'],
    ['春の旬', 'たけのこの走り・はまぐり・菜の花・いちご', 'ひなまつり、お彼岸、桜前線の北上'],
    ['春の旬', 'たけのこ・新玉ねぎ・初がつお・春キャベツ', 'お花見、入学式、新緑の始まり'],
    ['初夏の旬', '新茶・アスパラ・そら豆・初がつお', 'こどもの日、八十八夜の新茶、藤の花'],
    ['初夏の旬', '梅・あじ・らっきょう・さくらんぼ', '衣替え、梅仕事、梅雨入り、あじさい'],
    ['夏の旬', 'うなぎ・枝豆・とうもろこし・すいか', '七夕、海開き、土用の丑の日'],
    ['夏の旬', 'ぶどう・なす・トマト・桃', 'お盆、花火大会、夏祭り'],
    ['秋の旬', 'さんま・梨・新米・ぶどう', 'お月見（十五夜）、お彼岸、敬老の日'],
    ['秋の旬', 'さつまいも・柿・栗・きのこ・新米', '十三夜、紅葉の始まり、ハロウィン'],
    ['秋の旬', 'りんご・かぶ・ずわいがに・銀杏', '七五三、紅葉狩り、新嘗祭（勤労感謝の日）'],
    ['冬の旬', 'ぶり・白菜・大根・みかん・ゆず', '冬至のゆず湯、クリスマス、大掃除・年越し'],
  ];
  function shunItem(today) {
    const [label, food, events] = SHUN[today.getMonth()];
    return {
      telop: `${today.getMonth() + 1}月の旬と行事`,
      title: `${today.getMonth() + 1}月の${label}と季節の行事`,
      summary: `今がおいしい旬の食べもの：${food}。`,
      detail: `${today.getMonth() + 1}月の主な行事・季節のできごと：${events}。旬の食材は栄養価が高く、値段も手ごろになりやすいのがうれしいところです。`,
      talk: `今の旬は${food.split('・')[0]}。今夜のおかずにどう？`,
      sources: [], kind: 'season',
    };
  }

  global.KurageFortune = { PLACES, fortuneItems, sekkiItems, shunItem };
})(typeof window !== 'undefined' ? window : globalThis);
