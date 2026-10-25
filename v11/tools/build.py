#!/usr/bin/env python3
"""Pack v11/index.html: one offline file, art embedded, no network."""
import base64, pathlib, re, subprocess, tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
REPO = ROOT.parent
SRC = ROOT / 'src'
V10 = REPO / 'index.html'
ART = pathlib.Path('/tmp/v11art/sheets')
WEBP = pathlib.Path('/tmp/v11webp')

V10_SHEETS = [
    'benji', 'turtle', 'jelly', 'seahorse', 'puffer', 'clown', 'cardburst',
    'tube', 'tube_opening', 'tubeElbow', 'tubeCollar', 'splash', 'clam',
    'toytile', 'puff', 'treat', 'urchin', 'urchin_warn', 'finger',
]
NEW_SHEETS = [
    'current', 'kelpgate', 'stinger', 'stingerWarn',
    'tile_deep', 'tile_kelp', 'tile_ship', 'tileGlow',
    'urchinBed', 'urchinPad', 'worldBtn',
]
BGS = [('bg_kelp', 64), ('bg_ship', 64), ('bg_deep', 64)]


def webp_bytes(png, quality=None, lossless=False):
    WEBP.mkdir(parents=True, exist_ok=True)
    tag = 'll' if lossless else str(quality)
    out = WEBP / (pathlib.Path(png).stem + '-' + tag + '.webp')
    cmd = ['ffmpeg', '-y', '-i', str(png), '-c:v', 'libwebp']
    if lossless:
        cmd += ['-lossless', '1']
    else:
        cmd += ['-quality', str(quality)]
    cmd.append(str(out))
    subprocess.check_call(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return out.read_bytes()


def data_uri(blob):
    return 'data:image/webp;base64,' + base64.b64encode(blob).decode('ascii')


def extract_v10():
    lines = V10.read_text(encoding='utf-8').splitlines()
    want = set(V10_SHEETS)
    found = []
    for line in lines:
        m = re.match(r"registerSpriteSheet\('([^']+)'", line)
        if m and m.group(1) in want:
            found.append(line)
            want.discard(m.group(1))
    if want:
        raise SystemExit('missing v10 sheets: ' + ', '.join(sorted(want)))
    text = '\n'.join(lines)
    def grab(var):
        m = re.search(var + r'\.src = "(data:image/webp;base64,[^"]+)"', text)
        if not m:
            raise SystemExit('missing ' + var)
        return m.group(1)
    return '\n'.join(found), grab('BG'), grab('BG_BOARD')


def new_sheet_calls():
    calls = []
    for name in NEW_SHEETS:
        js = (ART / f'{name}_sprites.js').read_text(encoding='utf-8')
        meta = js[js.index('{'): js.rindex('}') + 1]
        uri = data_uri(webp_bytes(ART / f'{name}.png', lossless=True))
        calls.append(f'registerSpriteSheet({name!r}, "{uri}", {meta});')
    return '\n'.join(calls)


def bg_calls():
    lines = []
    for name, q in BGS:
        uri = data_uri(webp_bytes(ART / f'{name}.png', quality=q))
        key = name.split('_', 1)[1]
        lines.append(f'loadImage({key!r}, "{uri}");')
    return '\n'.join(lines)


HEAD = r'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="theme-color" content="#0b5c8f">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Chomp Benji Chomp">
<title>Chomp Benji Chomp, Good Shark</title>
<link rel="icon" href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==">
<style>
  html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#0b5c8f;touch-action:none;
    -webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none;
    -webkit-text-size-adjust:100%;overscroll-behavior:none}
  body{position:fixed;inset:0}
  canvas{display:block;position:fixed;left:0;top:0;touch-action:none}
</style>
</head>
<body>
<canvas id="c"></canvas>
<script>
'''

TAIL = '\n</script>\n</body>\n</html>\n'


def main():
    v10_calls, bg_title, bg_reef = extract_v10()
    game = (SRC / 'game.js').read_text(encoding='utf-8')
    levels = (SRC / 'levels.js').read_text(encoding='utf-8')
    art = '\n'.join([
        v10_calls,
        new_sheet_calls(),
        f'loadImage("title", "{bg_title}");',
        f'loadImage("reef", "{bg_reef}");',
        bg_calls(),
        levels,
    ])
    if '// %%ART%%' not in game:
        raise SystemExit('game.js missing // %%ART%%')
    game = game.replace('// %%ART%%', art, 1)
    out = HEAD + game + TAIL
    dest = ROOT / 'index.html'
    dest.write_text(out, encoding='utf-8')
    print(f'wrote {dest} {dest.stat().st_size} bytes')


if __name__ == '__main__':
    main()
