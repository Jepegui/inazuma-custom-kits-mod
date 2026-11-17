"""Builds app/custom-kits.html (one self-contained page) from the files in src/.

    python build.py
"""
import json, os
here = os.path.dirname(os.path.abspath(__file__))
src = lambda *p: os.path.join(here, 'src', *p)
read = lambda *p: open(src(*p), encoding='utf-8').read()

page, app = read('page.html'), read('app.js')
# the kits without sponsors (BetterQoL's AresNoSponsors) that have a shop item, and the game's kits (reference folder)
ares = [dict(c, src='ares', name=c['name'].replace(' Kit', '') + ' Kit (no sponsors)')
        for c in json.loads(read('data', 'catalog.json')) if c['item']]
ref = json.loads(read('data', 'catalog_ref.json'))
for c in ref: c.pop('size', None)
data = ('const ARES_CATALOG = ' + json.dumps(ares, separators=(',', ':'), ensure_ascii=False) + ';\n'
        'const REF_CATALOG = ' + json.dumps(ref, separators=(',', ':'), ensure_ascii=False) + ';')
busts = ('const BUST_POSES = ' + read('data', 'poses.json') + ';\n'
         'const BUST_TPL = ' + read('data', 'bust_tpl.json') + ';\n'
         'const EMBLEM_TPL = ' + read('data', 'emblem_tpl.json') + ';\n' + read('busts.js'))
js = lambda x: '<script>\n' + x + '\n</script>\n'
html = page.replace('<!--SCRIPTS-->', js(read('i18n.js')) + js(read('codec.js')) + js(read('viewer3d.js')) + js(busts) + js(data) + js(app) + js(read('emblems.js')))
out = os.path.join(here, 'app', 'custom-kits.html')
open(out, 'w', encoding='utf-8', newline='\n').write(html)
print(f'{out}: {len(html) // 1024} KB, {len(ares)} + {len(ref)} bases')
