# ---- compact burning-star disc (normal blend, crisp edge): white-hot centre -> gold -> orange rim, fades out by ~34 world px
import numpy as np, os, sys
from PIL import Image
_OUT = globals().get('OUT') or (sys.argv[1] if len(sys.argv) > 1 else '../project/assets')
_S = 144; _c = (_S - 1) / 2; _y, _x = np.mgrid[0:_S, 0:_S].astype(np.float32); _r = np.hypot(_x - _c, _y - _c) / 2.0   # world px (art is drawn at 0.5)
_a = np.clip((30 - _r) / 3.0, 0, 1)                       # solid disc to ~28.5 px, crisp 3 px edge
_a = np.maximum(_a, np.clip((34 - _r) / 4.0, 0, 1) * 0.35)  # thin translucent rim glow to 34 px
_t = np.clip(_r / 28.0, 0, 1)
_rgb = np.stack([np.ones_like(_t), 1 - 0.45 * _t ** 1.6, 1 - 0.85 * _t ** 1.1], -1)   # white -> gold -> orange
_rgb = np.where((_r > 26)[..., None], np.array([1.0, 0.45, 0.12]), _rgb)                 # darker orange outline ring
Image.fromarray(np.dstack([_rgb * 255, _a * 255]).astype(np.uint8), 'RGBA').save(os.path.join(_OUT, 'star_disc.png'))
