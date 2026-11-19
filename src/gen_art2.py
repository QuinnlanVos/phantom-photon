# ---- Phantom Photon art, part 2 (exec'd from gen_art.py): abyss objects, menu + level-select UI
# stars (burning hazards): white-hot core + slowly turning spiky corona
s = 128 * SS; r = radial(s); y, x = np.mgrid[0:s, 0:s]; ang = np.arctan2(y - s / 2, x - s / 2)
core = np.clip(1 - (r - 15 * SS) / (3 * SS), 0, 1)
glow_sprite(np.clip(core + np.exp(-(r / (24 * SS)) ** 2) * 0.9, 0, 1), np.array([255, 200, 90]), 'star_core.png', white_core=core)
s = 288 * SS; r = radial(s); y, x = np.mgrid[0:s, 0:s]; ang = np.arctan2(y - s / 2, x - s / 2)
rnd = np.random.RandomState(5); spikes = np.zeros_like(r)
for k, (f, a) in enumerate(((7, 1.0), (11, 0.7), (17, 0.5), (29, 0.35))):
    spikes += a * (0.5 + 0.5 * np.sin(ang * f + rnd.uniform(0, 6.28)))
spikes /= 2.55
cor = np.exp(-np.maximum(r - 16 * SS, 0) / ((22 + 40 * spikes ** 2) * SS)) * (r > 10 * SS)
cor = blur(np.clip(cor, 0, 1), 1.5 * SS)
glow_sprite(np.clip(cor * 0.95, 0, 1), np.array([255, 120, 40]), 'star_corona.png', white_core=np.exp(-(r / (20 * SS)) ** 2) * 0.6)
glow_sprite(np.exp(-(r / (70 * SS)) ** 2) * 0.5, np.array([255, 110, 30]), 'star_glow.png')

# moving platforms: one image per size used (mint neon block with chevron stripes)
mover_sizes = {}
for lv in LEVELS:
    for mv in lv.get('movers', []):
        key = f"{mv['w']}x{mv['h']}"
        if key in mover_sizes: continue
        w, h = mv['w'] * T * SS, mv['h'] * T * SS; m = 20 * SS
        im = Image.new('L', (w + 2 * m, h + 2 * m), 0); d = ImageDraw.Draw(im)
        d.rounded_rectangle([m + 2 * SS, m + 2 * SS, m + w - 2 * SS, m + h - 2 * SS], radius=8 * SS, fill=255)
        blk = arr(im); edge = np.clip(blk - minf(blk, 7), 0, 1)
        yy, xx = np.mgrid[0:blk.shape[0], 0:blk.shape[1]]
        stripes = ((((xx + yy) // (6 * SS)) % 2) == 0).astype(np.float32) * minf(blk, 17) * 0.22
        inten = np.clip(blk * 0.32 + stripes + edge + blur(edge, 5 * SS) * 0.8, 0, 1)
        glow_sprite(inten, MINT, f'mover_{key}.png', white_core=edge * 0.55)
        mover_sizes[key] = [(w + 2 * m) // SS, (h + 2 * m) // SS]
# a tiny dot for track hints
s = 16 * SS; r = radial(s); glow_sprite(np.exp(-(r / (2.2 * SS)) ** 2), MINT, 'track_dot.png')

# gas clouds: one murky swirl image per cloud rect (purple/teal), with a faint dotted rim as the fairness hint
def fbm(h, w, seed, oct=5):
    rs = np.random.RandomState(seed); acc = np.zeros((h, w)); amp = 1.0; tot = 0
    for o in range(oct):
        g = 2 ** (o + 2); n = rs.rand(g + 1, g + 1)
        im = Image.fromarray((n * 255).astype(np.uint8), 'L').resize((w, h), Image.BICUBIC)
        acc += arr(im) * amp; tot += amp; amp *= 0.55
    return acc / tot
cloud_sizes = {}; cloud_index = {}
ck = 0
for li, lv in enumerate(LEVELS):
    for cj, cl in enumerate(lv.get('clouds', [])):
        ck += 1; cloud_index[f'{li}:{cj}'] = ck
        m = 26; w, h = (cl['w'] * T + 2 * m) * SS // 2, (cl['h'] * T + 2 * m) * SS // 2     # drawn at 1x (soft image), shown at 2x
        yy, xx = np.mgrid[0:h, 0:w]
        # distance outside the rect -> soft edge
        rx0, ry0, rx1, ry1 = m * SS // 2, m * SS // 2, w - m * SS // 2, h - m * SS // 2
        dx = np.maximum(np.maximum(rx0 - xx, xx - rx1), 0); dy = np.maximum(np.maximum(ry0 - yy, yy - ry1), 0)
        out = np.hypot(dx, dy)
        n1 = fbm(h, w, 11 + ck); n2 = fbm(h, w, 40 + ck)
        body = np.clip(1 - out / (m * 0.95) + (n1 - 0.5) * 0.9, 0, 1) ** 1.4      # organic edge spilling a little past the rect
        dens = np.clip(0.55 + 0.7 * (n1 - 0.5) + 0.25 * (n2 - 0.5), 0, 1) * body
        colr = (np.array([90, 40, 140])[None, None, :] * (1 - n2[..., None]) + np.array([20, 110, 120])[None, None, :] * n2[..., None]) / 255.0
        # dotted rim on the rect border (very faint, drawn above the darkness)
        ins = np.minimum(np.minimum(xx - rx0, rx1 - xx), np.minimum(yy - ry0, ry1 - yy))
        per = ((xx + yy) // 5) % 2
        rim = np.exp(-((ins - 1) / 1.2) ** 2) * per * 0.42
        rgb = colr * (1 - rim[..., None]) + (np.array([170, 140, 255]) / 255.0)[None, None, :] * rim[..., None]
        save_rgba(rgb, np.clip(dens * 0.78 + rim, 0, 1), f'cloud_{ck}.png')
        cloud_sizes[ck] = [w * 2 // SS, h * 2 // SS]
s = 128; r = radial(s); y, x = np.mgrid[0:s, 0:s]; ang = np.arctan2(y - s / 2, x - s / 2)
puff = np.clip(np.exp(-(r / 46) ** 2) * (0.6 + 0.4 * np.sin(ang * 3 + r / 9)), 0, 1)
save_rgba(np.ones((s, s, 3)) * np.array([0.45, 0.35, 0.7]), puff * 0.5, 'cloud_puff.png')

# white (tintable) particles, soft light pool
s = 24 * SS; r = radial(s); glow_sprite(np.exp(-(r / (3.5 * SS)) ** 2), WHITE, 'spark_w.png')
s = 160 * SS; r = radial(s); glow_sprite(np.exp(-((r - 62 * SS) / (4 * SS)) ** 2) + 0.4 * np.exp(-((r - 58 * SS) / (12 * SS)) ** 2), WHITE, 'ring_w.png')
s = 256; r = radial(s); glow_sprite(np.exp(-(r / 70) ** 2), WHITE, 'soft.png')
s = 48 * SS; r = radial(s); glow_sprite(np.exp(-(r / (9 * SS)) ** 2), WHITE, 'trail_w.png', white_core=np.exp(-(r / (3.5 * SS)) ** 2) * 0.8)

# buttons (white, tinted in-game): neon pill outline + inner fill; soft glow; round button; icons
def pill(w, h, name, fill=0.16):
    im = Image.new('L', (w + 80, h + 80), 0); d = ImageDraw.Draw(im)
    d.rounded_rectangle([40, 40, 40 + w, 40 + h], radius=h // 2, fill=255)
    a = arr(im); edge = np.clip(a - minf(a, 9), 0, 1)
    inner = minf(a, 9); yy = np.mgrid[0:a.shape[0], 0:a.shape[1]][0] / a.shape[0]
    grad = inner * (fill + 0.12 * (1 - yy))
    glow_sprite(np.clip(grad + edge + blur(edge, 4) * 0.6, 0, 1), WHITE, name, white_core=edge)
pill(520, 130, 'btn_pill.png'); pill(300, 100, 'btn_pill_s.png')
def pill_glow(w, h, name):
    im = Image.new('L', (w + 240, h + 240), 0); d = ImageDraw.Draw(im)
    d.rounded_rectangle([120, 120, 120 + w, 120 + h], radius=h // 2, fill=255)
    a = arr(im); e = np.clip(a - minf(a, 9), 0, 1)
    glow_sprite(np.clip(blur(e, 14) * 1.2 + blur(a, 40) * 0.5, 0, 1), WHITE, name)
pill_glow(520, 130, 'btn_glow.png'); pill_glow(300, 100, 'btn_glow_s.png')
s = 120 * SS; r = radial(s)
rnd_edge = np.exp(-((r - 50 * SS) / (2.4 * SS)) ** 2); rnd_fill = np.clip(1 - (r - 50 * SS) / (2 * SS), 0, 1) * 0.16
glow_sprite(np.clip(rnd_fill + rnd_edge + blur(rnd_edge, 4 * SS) * 0.6, 0, 1), WHITE, 'btn_round.png', white_core=rnd_edge * 0.8)
s = 220 * SS; r = radial(s); glow_sprite(np.clip(np.exp(-((r - 50 * SS) / (14 * SS)) ** 2) * 0.9 + np.exp(-(r / (70 * SS)) ** 2) * 0.3, 0, 1), WHITE, 'btn_round_glow.png')
def icon(draw_fn, name, s=96):
    im = Image.new('L', (s * SS, s * SS), 0); d = ImageDraw.Draw(im); draw_fn(d, s * SS); a = arr(im)
    glow_sprite(np.clip(a + blur(a, 3 * SS) * 0.6, 0, 1), WHITE, name, white_core=a * 0.5)
def arrow_l(d, s): c = s / 2; d.line([(c + 10 * SS, c - 20 * SS), (c - 12 * SS, c), (c + 10 * SS, c + 20 * SS)], fill=255, width=7 * SS, joint='curve')
def arrow_r(d, s): c = s / 2; d.line([(c - 10 * SS, c - 20 * SS), (c + 12 * SS, c), (c - 10 * SS, c + 20 * SS)], fill=255, width=7 * SS, joint='curve')
def lock(d, s):
    c = s / 2; d.rounded_rectangle([c - 18 * SS, c - 4 * SS, c + 18 * SS, c + 22 * SS], radius=5 * SS, fill=255)
    d.arc([c - 12 * SS, c - 24 * SS, c + 12 * SS, c + 4 * SS], 180, 360, fill=255, width=6 * SS)
    d.line([(c - 12 * SS, c - 10 * SS), (c - 12 * SS, c - 3 * SS)], fill=255, width=6 * SS); d.line([(c + 12 * SS, c - 10 * SS), (c + 12 * SS, c - 3 * SS)], fill=255, width=6 * SS)
def check(d, s): c = s / 2; d.line([(c - 18 * SS, c + 2 * SS), (c - 5 * SS, c + 15 * SS), (c + 20 * SS, c - 14 * SS)], fill=255, width=7 * SS, joint='curve')
def back(d, s):
    c = s / 2; d.line([(c - 16 * SS, c), (c + 18 * SS, c)], fill=255, width=6 * SS)
    d.line([(c - 2 * SS, c - 16 * SS), (c - 18 * SS, c), (c - 2 * SS, c + 16 * SS)], fill=255, width=6 * SS, joint='curve')
def play(d, s): c = s / 2; d.polygon([(c - 12 * SS, c - 18 * SS), (c + 18 * SS, c), (c - 12 * SS, c + 18 * SS)], fill=255)
def grid(d, s):
    c = s / 2
    for gx in (-1, 0, 1):
        for gy in (-1, 0, 1): d.rounded_rectangle([c + gx * 14 * SS - 5 * SS, c + gy * 14 * SS - 5 * SS, c + gx * 14 * SS + 5 * SS, c + gy * 14 * SS + 5 * SS], radius=2 * SS, fill=255)
for fn, nm in ((arrow_l, 'ic_left.png'), (arrow_r, 'ic_right.png'), (lock, 'ic_lock.png'), (check, 'ic_check.png'), (back, 'ic_back.png'), (play, 'ic_play.png'), (grid, 'ic_grid.png')): icon(fn, nm)
# level node: ring + inner disc (white, tinted)
s = 120 * SS; r = radial(s)
ne = np.exp(-((r - 40 * SS) / (2.2 * SS)) ** 2); nf = np.clip(1 - (r - 38 * SS) / (2 * SS), 0, 1)
glow_sprite(np.clip(ne + blur(ne, 4 * SS) * 0.7 + nf * 0.12, 0, 1), WHITE, 'node_ring.png', white_core=ne * 0.7)
glow_sprite(nf * 0.85, WHITE, 'node_fill.png')
# chapter card frame (9-slice panel): rounded neon border + dark glassy fill
s = 160; im = Image.new('L', (s, s), 0); d = ImageDraw.Draw(im); d.rounded_rectangle([14, 14, s - 15, s - 15], radius=30, fill=255)
a = arr(im); e = np.clip(a - minf(a, 5), 0, 1); inner = minf(a, 5)
rgb = np.ones((s, s, 3)) * np.array([0.03, 0.05, 0.12]) * inner[..., None] * (1 - e[..., None]) + e[..., None] * 1.0
al = np.clip(inner * 0.78 + e + blur(e, 5) * 0.8 * (1 - inner), 0, 1)
rgb = rgb + (blur(e, 5) * (1 - inner))[..., None] * 0.9
save_rgba(np.clip(rgb / np.maximum(al, 1e-3)[..., None] * np.minimum(al, 1)[..., None] / np.maximum(np.minimum(al, 1), 1e-3)[..., None], 0, 1), al, 'card_frame.png')
neon_text('PLAY', RAJ, 110, WHITE, 'txt_play.png', pad=30, track=18)
def restart(d, s):
    c = s / 2; R = 18 * SS
    d.arc([c - R, c - R, c + R, c + R], 50, 320, fill=255, width=6 * SS)
    ax, ay = c + R * math.cos(math.radians(50)), c + R * math.sin(math.radians(50))
    d.polygon([(ax + 9 * SS, ay - 1 * SS), (ax - 6 * SS, ay - 8 * SS), (ax - 2 * SS, ay + 9 * SS)], fill=255)
icon(restart, 'ic_restart.png')
