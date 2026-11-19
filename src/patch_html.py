"""Post-export tweak: block browser pan/zoom/scroll gestures, dark page background, favicon."""
import sys, os
from PIL import Image
d = sys.argv[1]; p = d + '/index.html'; s = open(p).read()
tag = ('<style id="mobile-fix">html,body{margin:0;background:#04060f;overflow:hidden;position:fixed;inset:0}'
       'html,body,canvas{touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;overscroll-behavior:none;-webkit-tap-highlight-color:transparent}</style>')
if 'mobile-fix' not in s: s = s.replace('</head>', tag + '\n</head>', 1)
s = s.replace('<title>', '<meta name="theme-color" content="#04060f">\n<title>', 1) if 'theme-color' not in s else s
if 'rel="icon"' not in s: s = s.replace('</head>', '<link rel="icon" type="image/png" href="favicon.png">\n</head>', 1)
open(p, 'w').write(s)
src = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'project', 'assets', 'orb.png')
bg = Image.new('RGBA', (128, 128), (4, 6, 15, 255)); o = Image.open(src).convert('RGBA')
bg.alpha_composite(o, ((128 - o.width) // 2, (128 - o.height) // 2)); bg.resize((64, 64), Image.LANCZOS).save(d + '/favicon.png')
print('patched', p)
