// =============================================================
// 暦と星の計算（インターネットなしで毎日自動で変わる部分）
//  - 太陽・月の位置 → 二十四節気・七十二候・月齢・星座
//  - 生まれた日時と場所 → 太陽星座・月星座・アセンダント
//  - 数秘術・九星・日の干支・暦注（一粒万倍日など）
// 精度は「占い・暦として十分」な簡易計算です（誤差は数分〜1度程度）。
// =============================================================
(function (global) {
  'use strict';

  const RAD = Math.PI / 180;
  const norm360 = (x) => ((x % 360) + 360) % 360;

  // 日本時間などの「その土地の時刻」→ ユリウス日
  function julianDay(y, mo, d, h = 0, mi = 0, tz = 9) {
    const ms = Date.UTC(y, mo - 1, d, h, mi) - tz * 3600000;
    return ms / 86400000 + 2440587.5;
  }
  const jdFromDate = (date) => date.getTime() / 86400000 + 2440587.5;

  // 太陽の黄経（度）
  function sunLongitude(jd) {
    const T = (jd - 2451545.0) / 36525;
    const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
    const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
    const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M * RAD) +
      (0.019993 - 0.000101 * T) * Math.sin(2 * M * RAD) + 0.000289 * Math.sin(3 * M * RAD);
    const omega = 125.04 - 1934.136 * T;
    return norm360(L0 + C - 0.00569 - 0.00478 * Math.sin(omega * RAD));
  }

  // 月の黄経（度）主な項だけの簡易式
  function moonLongitude(jd) {
    const T = (jd - 2451545.0) / 36525;
    const Lp = 218.3164477 + 481267.88123421 * T;
    const D = 297.8501921 + 445267.1114034 * T;
    const M = 357.5291092 + 35999.0502909 * T;
    const Mp = 134.9633964 + 477198.8675055 * T;
    const F = 93.272095 + 483202.0175233 * T;
    const s = (x) => Math.sin(x * RAD);
    const lon = Lp + 6.288774 * s(Mp) + 1.274027 * s(2 * D - Mp) + 0.658314 * s(2 * D) +
      0.213618 * s(2 * Mp) - 0.185116 * s(M) - 0.114332 * s(2 * F) + 0.058793 * s(2 * D - 2 * Mp) +
      0.057066 * s(2 * D - M - Mp) + 0.053322 * s(2 * D + Mp) + 0.045758 * s(2 * D - M) -
      0.040923 * s(M - Mp) - 0.03472 * s(D) - 0.030383 * s(M + Mp) + 0.015327 * s(2 * D - 2 * F) -
      0.012528 * s(Mp + 2 * F) + 0.01098 * s(Mp - 2 * F) + 0.010675 * s(4 * D - Mp) +
      0.010034 * s(3 * Mp) + 0.008548 * s(4 * D - 2 * Mp);
    return norm360(lon);
  }

  // アセンダント（東の地平線にある星座の度数）
  function ascendant(jd, latDeg, lonDeg) {
    const T = (jd - 2451545.0) / 36525;
    const gmst = norm360(280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T);
    const ramc = norm360(gmst + lonDeg) * RAD;
    const eps = (23.4392911 - 0.0130042 * T) * RAD;
    const phi = latDeg * RAD;
    const asc = Math.atan2(Math.cos(ramc), -(Math.sin(eps) * Math.tan(phi) + Math.cos(eps) * Math.sin(ramc)));
    return norm360(asc / RAD);
  }

  // 太陽の黄経が target 度になる日時（JD）を探す
  function findSunLongitude(target, jdStart) {
    let jd = jdStart;
    for (let i = 0; i < 60; i++) {
      let diff = norm360(target - sunLongitude(jd));
      if (diff > 180) diff -= 360;
      if (Math.abs(diff) < 1e-5) break;
      jd += diff / 0.9856;
    }
    return jd;
  }

  const SIGNS = [
    { name: '牡羊座', el: '火' }, { name: '牡牛座', el: '地' }, { name: '双子座', el: '風' },
    { name: '蟹座', el: '水' }, { name: '獅子座', el: '火' }, { name: '乙女座', el: '地' },
    { name: '天秤座', el: '風' }, { name: '蠍座', el: '水' }, { name: '射手座', el: '火' },
    { name: '山羊座', el: '地' }, { name: '水瓶座', el: '風' }, { name: '魚座', el: '水' },
  ];
  const signOf = (lon) => SIGNS[Math.floor(norm360(lon) / 30)];
  const degIn = (lon) => Math.floor(norm360(lon) % 30);

  // ---------- 二十四節気（太陽黄経 15度ごと。0度＝春分） ----------
  const SEKKI = [
    { name: '春分', yomi: 'しゅんぶん', text: '昼と夜の長さがほぼ同じになる日。お彼岸の中日で、ここから昼がどんどん長くなります。「暑さ寒さも彼岸まで」の通り、過ごしやすい季節の入口です。' },
    { name: '清明', yomi: 'せいめい', text: '「清浄明潔」の略で、万物が清らかで生き生きとするころ。桜が見ごろを迎える地域も多く、沖縄ではご先祖のお墓参り「シーミー」の季節です。' },
    { name: '穀雨', yomi: 'こくう', text: '穀物をうるおす春の雨が降るころ。この時期に摘む新茶は特に縁起がよいとされ、八十八夜はもうすぐです。' },
    { name: '立夏', yomi: 'りっか', text: '暦の上では夏の始まり。風薫る新緑の季節で、こいのぼりが空を泳ぎます。日差しが強くなり始めるので紫外線対策もここから。' },
    { name: '小満', yomi: 'しょうまん', text: '草木がすくすく育ち、天地に生命が満ちていくころ。麦の穂が実り「ほっと一安心（少し満足）」する、という意味もあります。' },
    { name: '芒種', yomi: 'ぼうしゅ', text: '「芒（のぎ）」のある稲や麦の種をまくころ。田植えが本格化し、梅雨入りも近づきます。' },
    { name: '夏至', yomi: 'げし', text: '一年でいちばん昼が長い日。梅雨の最中なので実感は少なめですが、関西ではタコを食べる習慣もあります。' },
    { name: '小暑', yomi: 'しょうしょ', text: '梅雨明けが近づき、本格的な暑さが始まるころ。暑中見舞いを出し始める時期です。七夕もこのころ。' },
    { name: '大暑', yomi: 'たいしょ', text: '一年でもっとも暑さが厳しいころ。土用の丑の日にうなぎを食べて夏バテ予防、という江戸時代からの知恵があります。' },
    { name: '立秋', yomi: 'りっしゅう', text: '暦の上では秋の始まり。まだまだ暑いですが、ここからは「残暑見舞い」に切り替わります。' },
    { name: '処暑', yomi: 'しょしょ', text: '暑さがようやく収まり始めるころ。朝晩に涼しい風を感じ、台風が増える時期でもあります。' },
    { name: '白露', yomi: 'はくろ', text: '草花に白い露が宿り始めるころ。夏から秋へ、空気が澄んで秋の気配がはっきりしてきます。' },
    { name: '秋分', yomi: 'しゅうぶん', text: '昼と夜の長さがほぼ同じになる日。秋のお彼岸の中日で、ここから夜が長くなっていきます。' },
    { name: '寒露', yomi: 'かんろ', text: '草木に冷たい露が降りるころ。空気が澄み、秋晴れと夜長が楽しめる季節。菊の花が咲き始めます。' },
    { name: '霜降', yomi: 'そうこう', text: '朝晩の冷え込みで霜が降り始めるころ。紅葉が山から里へ下りてきて、秋の最終章です。次はいよいよ立冬。' },
    { name: '立冬', yomi: 'りっとう', text: '暦の上では冬の始まり。木枯らしが吹き始め、こたつや鍋が恋しくなる時期です。' },
    { name: '小雪', yomi: 'しょうせつ', text: '山に初雪が降り始めるころ。まだ雪は少ないので「小雪」。冬支度を整える目安です。' },
    { name: '大雪', yomi: 'たいせつ', text: '山だけでなく平地にも雪が降り始めるころ。ぶりやはたはたなど冬の魚がおいしくなります。' },
    { name: '冬至', yomi: 'とうじ', text: '一年でいちばん昼が短い日。ゆず湯に入り、かぼちゃを食べて無病息災を願います。ここから「一陽来復」、運気が上向くとも。' },
    { name: '小寒', yomi: 'しょうかん', text: '「寒の入り」。ここから節分までが一年でいちばん寒い「寒の内」。寒中見舞いはこの時期に。' },
    { name: '大寒', yomi: 'だいかん', text: '寒さが最も厳しいころ。寒の水は腐りにくいとされ、味噌や酒の仕込みに使われてきました。' },
    { name: '立春', yomi: 'りっしゅん', text: '暦の上では春の始まりで、昔はここが一年のスタート。九星気学の年もここで切り替わります。' },
    { name: '雨水', yomi: 'うすい', text: '雪が雨に変わり、氷が解け始めるころ。ひな人形を飾ると良縁に恵まれるともいわれます。' },
    { name: '啓蟄', yomi: 'けいちつ', text: '冬ごもりしていた虫たちが土から顔を出すころ。春の気配がぐっと濃くなります。' },
  ];

  // ---------- 七十二候（太陽黄経 5度ごと。立春＝315度から） ----------
  const KOU = [
    ['東風解凍', 'はるかぜこおりをとく', '春の風が氷を解かし始める'],
    ['黄鶯睍睆', 'うぐいすなく', 'うぐいすが山里で鳴き始める'],
    ['魚上氷', 'うおこおりをいずる', '割れた氷の間から魚が跳ねる'],
    ['土脉潤起', 'つちのしょううるおいおこる', '雨が降って土がうるおう'],
    ['霞始靆', 'かすみはじめてたなびく', '春霞がたなびき始める'],
    ['草木萌動', 'そうもくめばえいずる', '草木が芽吹き始める'],
    ['蟄虫啓戸', 'すごもりむしとをひらく', '冬ごもりの虫が出てくる'],
    ['桃始笑', 'ももはじめてさく', '桃の花が咲き始める'],
    ['菜虫化蝶', 'なむしちょうとなる', '青虫が羽化して紋白蝶になる'],
    ['雀始巣', 'すずめはじめてすくう', '雀が巣を作り始める'],
    ['桜始開', 'さくらはじめてひらく', '桜の花が咲き始める'],
    ['雷乃発声', 'かみなりすなわちこえをはっす', '遠くで雷が鳴り始める'],
    ['玄鳥至', 'つばめきたる', 'つばめが南からやってくる'],
    ['鴻雁北', 'こうがんかえる', '雁が北へ帰っていく'],
    ['虹始見', 'にじはじめてあらわる', '雨上がりに虹が見え始める'],
    ['葭始生', 'あしはじめてしょうず', '水辺の葦が芽を吹き始める'],
    ['霜止出苗', 'しもやみてなえいずる', '霜が終わり稲の苗が育つ'],
    ['牡丹華', 'ぼたんはなさく', '牡丹の花が咲く'],
    ['蛙始鳴', 'かわずはじめてなく', '蛙が鳴き始める'],
    ['蚯蚓出', 'みみずいずる', 'みみずが地上に這い出る'],
    ['竹笋生', 'たけのこしょうず', 'たけのこが生えてくる'],
    ['蚕起食桑', 'かいこおきてくわをはむ', '蚕が桑の葉を盛んに食べる'],
    ['紅花栄', 'べにばなさかう', '紅花が盛んに咲く'],
    ['麦秋至', 'むぎのときいたる', '麦が熟し麦秋となる'],
    ['蟷螂生', 'かまきりしょうず', 'かまきりが生まれ出る'],
    ['腐草為螢', 'くされたるくさほたるとなる', '蛍が飛び交い始める'],
    ['梅子黄', 'うめのみきばむ', '梅の実が黄ばんで熟す'],
    ['乃東枯', 'なつかれくさかるる', '夏枯草（うつぼぐさ）が枯れる'],
    ['菖蒲華', 'あやめはなさく', 'あやめの花が咲く'],
    ['半夏生', 'はんげしょうず', '烏柄杓（はんげ）が生える'],
    ['温風至', 'あつかぜいたる', '暖かい風が吹いてくる'],
    ['蓮始開', 'はすはじめてひらく', '蓮の花が開き始める'],
    ['鷹乃学習', 'たかすなわちわざをならう', '鷹の幼鳥が飛ぶ技を覚える'],
    ['桐始結花', 'きりはじめてはなをむすぶ', '桐の実がなり始める'],
    ['土潤溽暑', 'つちうるおうてむしあつし', '土が湿って蒸し暑くなる'],
    ['大雨時行', 'たいうときどきにふる', '時として大雨が降る'],
    ['涼風至', 'すずかぜいたる', '涼しい風が立ち始める'],
    ['寒蝉鳴', 'ひぐらしなく', 'ひぐらしが鳴き始める'],
    ['蒙霧升降', 'ふかききりまとう', '深い霧が立ち込める'],
    ['綿柎開', 'わたのはなしべひらく', '綿を包むがくが開く'],
    ['天地始粛', 'てんちはじめてさむし', 'ようやく暑さが鎮まる'],
    ['禾乃登', 'こくものすなわちみのる', '稲が実る'],
    ['草露白', 'くさのつゆしろし', '草に降りた露が白く光る'],
    ['鶺鴒鳴', 'せきれいなく', 'せきれいが鳴き始める'],
    ['玄鳥去', 'つばめさる', 'つばめが南へ帰っていく'],
    ['雷乃収声', 'かみなりすなわちこえをおさむ', '雷が鳴らなくなる'],
    ['蟄虫坏戸', 'むしかくれてとをふさぐ', '虫が土中に隠れ入口をふさぐ'],
    ['水始涸', 'みずはじめてかるる', '田畑の水を干し始める'],
    ['鴻雁来', 'こうがんきたる', '雁が北から渡ってくる'],
    ['菊花開', 'きくのはなひらく', '菊の花が咲く'],
    ['蟋蟀在戸', 'きりぎりすとにあり', 'こおろぎが戸口で鳴く'],
    ['霜始降', 'しもはじめてふる', '霜が降り始める'],
    ['霎時施', 'こさめときどきふる', '小雨がしとしと降る'],
    ['楓蔦黄', 'もみじつたきばむ', 'もみじや蔦が色づく'],
    ['山茶始開', 'つばきはじめてひらく', '山茶花（さざんか）が咲き始める'],
    ['地始凍', 'ちはじめてこおる', '大地が凍り始める'],
    ['金盞香', 'きんせんかさく', '水仙の花が咲く'],
    ['虹蔵不見', 'にじかくれてみえず', '虹を見かけなくなる'],
    ['朔風払葉', 'きたかぜこのはをはらう', '北風が木の葉を払う'],
    ['橘始黄', 'たちばなはじめてきばむ', '橘の実が黄色くなる'],
    ['閉塞成冬', 'そらさむくふゆとなる', '天地の気がふさがり冬となる'],
    ['熊蟄穴', 'くまあなにこもる', '熊が冬眠のため穴にこもる'],
    ['鱖魚群', 'さけのうおむらがる', '鮭が群がり川をさかのぼる'],
    ['乃東生', 'なつかれくさしょうず', '夏枯草が芽を出す'],
    ['麋角解', 'さわしかつのおつる', '大鹿の角が落ちる'],
    ['雪下出麦', 'ゆきわたりてむぎのびる', '雪の下で麦が芽を出す'],
    ['芹乃栄', 'せりすなわちさかう', '芹がよく育つ'],
    ['水泉動', 'しみずあたたかをふくむ', '地中で凍った泉が動き始める'],
    ['雉始雊', 'きじはじめてなく', '雄の雉が鳴き始める'],
    ['款冬華', 'ふきのはなさく', '蕗の薹（ふきのとう）が出る'],
    ['水沢腹堅', 'さわみずこおりつめる', '沢に厚い氷が張りつめる'],
    ['鶏始乳', 'にわとりはじめてとやにつく', '鶏が卵を産み始める'],
  ];

  // 指定した日の節気・候の情報（その日のうちに切り替わる節気はその日から数える）
  function seasonInfo(date) {
    const jd = julianDay(date.getFullYear(), date.getMonth() + 1, date.getDate(), 23, 59, 9);
    const lon = sunLongitude(jd);
    const sIdx = Math.floor(lon / 15);
    const kIdx = Math.floor(norm360(lon - 315) / 5);
    const toLocal = (j) => new Date((j - 2440587.5) * 86400000);
    const startJd = findSunLongitude(sIdx * 15, jd - 8);
    const nextJd = findSunLongitude(((sIdx + 1) % 24) * 15, jd + 8);
    const kStartJd = findSunLongitude(norm360(315 + kIdx * 5), jd - 3);
    const kNextJd = findSunLongitude(norm360(315 + (kIdx + 1) * 5), jd + 3);
    return {
      sunLon: lon,
      sekki: SEKKI[sIdx], sekkiStart: toLocal(startJd),
      nextSekki: SEKKI[(sIdx + 1) % 24], nextSekkiStart: toLocal(nextJd),
      kou: { name: KOU[kIdx][0], yomi: KOU[kIdx][1], mean: KOU[kIdx][2], no: kIdx + 1 },
      kouStart: toLocal(kStartJd), kouEnd: toLocal(kNextJd - 0.5),
      nextKou: { name: KOU[(kIdx + 1) % 72][0], yomi: KOU[(kIdx + 1) % 72][1], mean: KOU[(kIdx + 1) % 72][2] },
    };
  }

  // 月齢・月の形
  function moonInfo(date) {
    const jd = jdFromDate(date);
    const elong = norm360(moonLongitude(jd) - sunLongitude(jd));
    const age = elong / 360 * 29.530589;
    const names = [
      [1, '新月'], [3.5, '三日月のころ'], [6, '若い月'], [9, '上弦の月'], [12.5, '十三夜のころ'],
      [14, '満月前夜'], [16, '満月'], [17.5, '立待月・居待月'], [21, '寝待月・更待月'], [23.5, '下弦の月'],
      [27.5, '有明の月'], [30, '新月前'],
    ];
    const phase = names.find(([d]) => age < d)[1];
    return { age, phase, lon: moonLongitude(jd), sign: signOf(moonLongitude(jd)) };
  }

  // ---------- 干支・九星・暦注 ----------
  const STEMS = '甲乙丙丁戊己庚辛壬癸';
  const BRANCHES = '子丑寅卯辰巳午未申酉戌亥';
  const STEM_EL = ['木', '木', '火', '火', '土', '土', '金', '金', '水', '水'];
  const KYUSEI = ['一白水星', '二黒土星', '三碧木星', '四緑木星', '五黄土星', '六白金星', '七赤金星', '八白土星', '九紫火星'];

  function dayKanshi(date) {
    const base = Date.UTC(2024, 0, 1); // 2024/1/1 は甲子の日
    const days = Math.round((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - base) / 86400000);
    const i = ((days % 60) + 60) % 60;
    return { idx: i, stem: STEMS[i % 10], branch: BRANCHES[i % 12], name: STEMS[i % 10] + BRANCHES[i % 12], el: STEM_EL[i % 10] };
  }

  // 本命星（立春より前の生まれは前年として数える。立春は太陽黄経315度）
  function honmei(y, mo, d, h = 12, mi = 0, tz = 9) {
    const jd = julianDay(y, mo, d, h, mi, tz);
    const risshun = findSunLongitude(315, julianDay(y, 2, 4, 12, 0, 9));
    const yy = jd < risshun ? y - 1 : y;
    // 1900年＝一白水星。そこから1年ごとに 九紫→八白… と一つずつ下がる
    const n = (9 - ((((yy - 1900) % 9) + 9) % 9)) % 9;
    return { year: yy, idx: n, name: KYUSEI[n] };
  }

  // 節月（立春＝寅月）… 暦注の判定に使う
  function setsuMonth(date) {
    const lon = seasonInfo(date).sunLon;
    return Math.floor(norm360(lon - 315) / 30); // 0=寅月, 1=卯月 ... 11=丑月
  }

  // 一粒万倍日・天赦日・寅の日・巳の日など
  function rekichu(date) {
    const k = dayKanshi(date);
    const m = setsuMonth(date);
    const ichiryu = ['丑午', '寅酉', '子卯', '卯辰', '巳午', '酉午', '子未', '卯申', '酉午', '酉戌', '亥子', '卯子'][m];
    const out = [];
    if (ichiryu.includes(k.branch)) out.push({ name: '一粒万倍日', text: '一粒の籾が万倍に実る日。何かを始める・種をまくのに良い日です（借金は増えるので控えめに）。' });
    const season = m < 3 ? 0 : m < 6 ? 1 : m < 9 ? 2 : 3; // 春夏秋冬（節月で）
    if (k.name === ['戊寅', '甲午', '戊申', '甲子'][season]) out.push({ name: '天赦日', text: '天がすべてを赦す、暦の上で最上の吉日。新しい挑戦にぴったりです。' });
    if (k.name === '甲子') out.push({ name: '甲子の日', text: '60日に一度めぐる干支の始まりの日。始めごとに良く、大黒天の縁日です。' });
    if (k.branch === '寅') out.push({ name: '寅の日', text: '「虎は千里行って千里帰る」から、お金が戻ってくる日。財布の新調や旅立ちに良いとされます。' });
    if (k.name === '己巳') out.push({ name: '己巳の日', text: '60日に一度の、弁財天にご縁がある特別な巳の日。金運・芸事のお願いに。' });
    else if (k.branch === '巳') out.push({ name: '巳の日', text: '弁財天の使いである白蛇にちなみ、金運・芸事に良い日とされます。' });
    return out;
  }

  // ---------- 数秘術 ----------
  function reduceNum(n, keepMaster = true) {
    while (n > 9 && !(keepMaster && (n === 11 || n === 22 || n === 33))) {
      n = String(n).split('').reduce((a, c) => a + Number(c), 0);
    }
    return n;
  }
  const digitSum = (s) => String(s).replace(/\D/g, '').split('').reduce((a, c) => a + Number(c), 0);
  function numerology(birth, today) {
    const lifePath = reduceNum(digitSum(`${birth.y}${birth.m}${birth.d}`));
    const py = reduceNum(digitSum(`${today.getFullYear()}${birth.m}${birth.d}`), false);
    const pm = reduceNum(py + digitSum(today.getMonth() + 1), false);
    const pd = reduceNum(pm + digitSum(today.getDate()), false);
    return { lifePath, personalYear: py, personalMonth: pm, personalDay: pd };
  }

  // ---------- 生まれた時の星の配置 ----------
  function natalChart(birth) {
    const tz = typeof birth.tz === 'number' ? birth.tz : 9;
    const hasTime = birth.time !== '' && birth.time != null;
    const [h, mi] = hasTime ? birth.time.split(':').map(Number) : [12, 0];
    const jd = julianDay(birth.y, birth.m, birth.d, h, mi, tz);
    const sun = sunLongitude(jd);
    const moon = moonLongitude(jd);
    const asc = hasTime && isFinite(birth.lat) && isFinite(birth.lon) ? ascendant(jd, birth.lat, birth.lon) : null;
    return {
      sun, moon, asc, hasTime,
      sunSign: signOf(sun), moonSign: signOf(moon), ascSign: asc == null ? null : signOf(asc),
      sunDeg: degIn(sun), moonDeg: degIn(moon), ascDeg: asc == null ? null : degIn(asc),
    };
  }

  // 同じ日なら同じ結果になる「乱数」
  function seeded(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return () => {
      h += 0x6d2b79f5;
      let t = h;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  global.KurageAstro = {
    julianDay, sunLongitude, moonLongitude, ascendant, findSunLongitude,
    SIGNS, signOf, SEKKI, KOU, seasonInfo, moonInfo,
    dayKanshi, honmei, rekichu, KYUSEI, numerology, reduceNum, natalChart, seeded,
  };
})(typeof window !== 'undefined' ? window : globalThis);
