"""index.html・style.css・app.js・ExcelJS を1つの HTML ファイルにまとめる。
ダブルクリックだけで開ける「荒谷町会計アプリ.html」を作るためのもの。
使い方: python3 aratani/build-single.py
"""
from pathlib import Path

d = Path(__file__).parent
html = (d / 'index.html').read_text(encoding='utf-8')


def inline(path):
    return (d / path).read_text(encoding='utf-8').replace('</script', '<\\/script')


html = html.replace('<link rel="stylesheet" href="style.css">',
                    '<style>\n' + (d / 'style.css').read_text(encoding='utf-8') + '\n</style>')
html = html.replace('<script src="vendor/exceljs.min.js"></script>',
                    '<script>\n' + inline('vendor/exceljs.min.js') + '\n</script>')
html = html.replace('<script src="app.js"></script>', '<script>\n' + inline('app.js') + '\n</script>')
assert 'src="' not in html, '外部ファイルの読み込みが残っています'
(d / '荒谷町会計アプリ.html').write_text(html, encoding='utf-8')
print('作成しました:', d / '荒谷町会計アプリ.html')
