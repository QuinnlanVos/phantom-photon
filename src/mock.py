"""Quick static mock-up of a level (for art iteration, not used by the game)."""
import sys, json, numpy as np
from PIL import Image
A = '../project/assets/'; n = int(sys.argv[1]); LV = json.load(open('levels.json'))[n]; T = 48; M = 40
art = Image.open(A + f'level_{n+1}.png'); art = art.resize((art.width // 2, art.height // 2), Image.LANCZOS)
W, H = art.size
bg = Image.new('RGBA', (W, H)); tile = Image.open(A + 'bg_tile.png')
for x in range(-M % 192 - 192, W, 192):
    for y in range(-M % 192 - 192, H, 192): bg.paste(tile, (x + M % 192, y + M % 192))
base = np.asarray(bg.convert('RGB'), np.float32) / 255
def add(name, cx, cy, scale=0.5, alpha=1.0):
    global base
    im = Image.open(A + name); im = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.LANCZOS)
    a = np.asarray(im, np.float32) / 255; x0, y0 = int(cx - im.width / 2), int(cy - im.height / 2)
    for_ = base[max(0, y0):y0 + im.height, max(0, x0):x0 + im.width]
    sub = a[max(0, -y0):max(0, -y0) + for_.shape[0], max(0, -x0):max(0, -x0) + for_.shape[1]]
    for_ += sub[..., :3] * sub[..., 3:] * alpha
def over(im):
    global base
    a = np.asarray(im, np.float32) / 255; base = base * (1 - a[..., 3:]) + a[..., :3] * a[..., 3:]
add('nebula.png', W / 2, H / 2, 1.2, 0.6)
over(art)
def cc(i): return M + i * T + T / 2
for j, row in enumerate(LV['map']):
    for i, ch in enumerate(row):
        if ch == 'E': add('portal_core.png', cc(i), cc(j)); add('portal_ring.png', cc(i), cc(j)); add('portal_ring2.png', cc(i), cc(j))
        if ch == '*': add('shard.png', cc(i), cc(j))
        if ch == 'O':
            add('bh_range.png', cc(i), cc(j)); add('bh_swirl.png', cc(i), cc(j)); add('bh_glow.png', cc(i), cc(j)); add('bh_disk.png', cc(i), cc(j))
            c = Image.open(A + 'bh_core.png').resize((48, 48), Image.LANCZOS); tmp = Image.new('RGBA', (W, H)); tmp.paste(c, (int(cc(i) - 24), int(cc(j) - 24))); over(tmp)
        if ch == 'P': add('pad_glow.png', cc(i), cc(j) - 24); add('pad_chevron.png', cc(i), cc(j) - 50)
        if ch == 'S':
            for k in range(8): add('trail.png', cc(i) + 6 * k + 10, cc(j), 0.5 * (1 - k / 10), 0.5 * (1 - k / 8))
            add('orb_halo.png', cc(i), cc(j)); add('orb.png', cc(i), cc(j))
Image.fromarray((np.clip(base, 0, 1) * 255).astype(np.uint8)).save(f'/tmp/mock_{n}.png'); print('ok')
