# ---- Phantom Photon art, part 4 (exec'd from gen_art.py): Song of Rainbows (chapter 5)
# bright pastel sky, rainbow paths (one image per rainbow, cropped to the arc), prisms, colour-glass gates,
# rain clouds, raindrops, music notes, background clouds and a faint background rainbow
RB = [np.array(c) for c in ([255, 86, 110], [255, 156, 72], [255, 214, 70], [90, 214, 120], [70, 165, 255], [150, 105, 255])]
def lerp_stops(t, stops):
    t = np.clip(t, 0, 1) * (len(stops) - 1); k = np.minimum(np.floor(t).astype(int), len(stops) - 2); f = (t - k)[..., None]
    S_ = np.array(stops, dtype=np.float32); return S_[k] * (1 - f) + S_[k + 1] * f
# sky: soft pastel gradient (sky blue -> lavender -> pink -> peach), stretched over the level in-game
hh = 512; tt = np.linspace(0, 1, hh)
sky = lerp_stops(tt, [[132, 196, 255], [176, 182, 255], [222, 178, 246], [255, 186, 214], [255, 214, 184]]) / 255.0
save_rgba(np.repeat(sky[:, None, :], 16, axis=1), np.ones((hh, 16)), 'sky_rainbow.png')
# fluffy cloud (normal blend): white puffs, soft lavender underside shading
def cloud_img(w, h, seed, name, shade=0.16, edge=1.0):
    rs = np.random.RandomState(seed); im = Image.new('L', (w, h), 0); d = ImageDraw.Draw(im)
    n = 7
    for k in range(n):
        cx = w * (0.18 + 0.64 * k / (n - 1)) + rs.uniform(-0.04, 0.04) * w
        rr = h * (0.24 + 0.16 * math.sin(math.pi * k / (n - 1))) * rs.uniform(0.9, 1.15)
        cy = h * 0.58 - rr * 0.35 + rs.uniform(-0.03, 0.03) * h
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=255)
    d.rounded_rectangle([w * 0.12, h * 0.48, w * 0.88, h * 0.8], radius=h * 0.16, fill=255)
    m_ = blur(arr(im), 1.5 * SS * edge)
    yy, xx = np.mgrid[0:h, 0:w]
    shadeI = np.clip((yy / h - 0.45) * 2.2, 0, 1) * shade
    rim = np.clip(m_ - blur(m_, 6 * SS), 0, 1)
    rgb = np.ones((h, w, 3)) * (1 - shadeI)[..., None] + np.array([0.62, 0.6, 0.86])[None, None, :] * shadeI[..., None] * 0.0
    rgb = rgb * (1 - shadeI[..., None]) + np.array([0.80, 0.78, 0.98])[None, None, :] * shadeI[..., None]
    rgb = np.clip(rgb + rim[..., None] * 0.15, 0, 1)
    save_rgba(rgb, np.clip(m_, 0, 1), name)
cloud_img(192 * SS, 112 * SS, 5, 'rain_cloud.png', shade=0.5)
cloud_img(256 * SS, 120 * SS, 9, 'bg_cloud.png', shade=0.22, edge=3)
# background rainbow: huge soft arc (normal blend, faint), seen far behind the levels
w, h = 512, 280; yy, xx = np.mgrid[0:h, 0:w]; dd = np.hypot(xx - w / 2, yy - h + 8) / (w * 0.46)
band = np.clip((dd - 0.62) / 0.36, 0, 1); inb = ((dd > 0.62) & (dd < 0.98)).astype(np.float32)
col = lerp_stops(1 - band, [c for c in RB]) / 255.0
alpha = inb * np.sin(np.clip(band, 0, 1) * np.pi) ** 0.6 * 0.9 * np.clip(1 - (yy / h - 0.75) / 0.25, 0, 1)
save_rgba(col, blur(alpha, 2), 'bg_bow.png')
# rainbow paths: one image per rainbow (arc of radius R between a0..a1), cropped to the arc; origin = image centre
bow_sizes = {}; bow_index = {}; bk_ = 0
BW = 0.66 * T * SS        # band width (px at SS)
for li, lv in enumerate(LEVELS):
    for bi_, b in enumerate(lv.get('bows', [])):
        bk_ += 1; bow_index[f'{li}:{bi_}'] = bk_
        R = b['r'] * T * SS; t0, t1 = math.radians(b['a0']), math.radians(b['a1'])
        pts = [t0 + (t1 - t0) * q / 64 for q in range(65)]
        xs = [R * math.cos(t) for t in pts]; ys = [R * math.sin(t) for t in pts]
        pad = BW / 2 + 22 * SS
        x0, x1, y0, y1 = min(xs) - pad, max(xs) + pad, min(ys) - pad, max(ys) + pad
        W_, H_ = int(math.ceil(x1 - x0)) // 2 * 2, int(math.ceil(y1 - y0)) // 2 * 2
        cx, cy = -x0, -y0          # arc centre in image px
        yy, xx = np.mgrid[0:H_, 0:W_].astype(np.float32); dd = np.hypot(xx - cx, yy - cy); an = np.arctan2(yy - cy, xx - cx)
        u = np.mod(an - t0, 2 * np.pi); span = t1 - t0
        inside = (u <= span).astype(np.float32)
        # rounded caps: distance along the arc beyond each end
        e0 = np.where(u <= span, 0, np.minimum(2 * np.pi - u, 9)) * dd; e1 = np.where(u <= span, 0, np.minimum(u - span, 9)) * dd
        beyond = np.minimum(e0, e1)
        rr_ = np.abs(dd - R); radial_in = np.clip((BW / 2 - rr_) / (1.2 * SS), 0, 1)
        cap = np.clip(1 - beyond / (BW * 0.5), 0, 1) ** 0.6
        band = radial_in * np.clip(inside + (1 - inside) * cap * 0, 0, 1)
        # ends fade softly into little cloud puffs
        endfade = np.clip(np.minimum(u, span - u) * dd / (0.55 * T * SS), 0, 1) * inside
        band = band * (0.35 + 0.65 * endfade)
        t_ = np.clip((dd - (R - BW / 2)) / BW, 0, 1)         # 0 inner (violet) .. 1 outer (red)
        colr = lerp_stops(1 - t_, RB) / 255.0
        shine = np.clip(1 - np.abs(t_ - 0.78) / 0.08, 0, 1) * 0.35
        colr = np.clip(colr + shine[..., None], 0, 1)
        edge = np.clip(1 - np.abs(rr_ - BW / 2) / (1.3 * SS), 0, 1) * inside * 0.85
        rs = np.random.RandomState(500 + bk_)
        spark = (rs.rand(H_, W_) < 0.0035).astype(np.float32) * band
        spark = np.clip(blur(spark, 0.9 * SS) * 6, 0, 1)
        glow = np.clip(blur(band, 7 * SS) * 0.55, 0, 1) * (1 - band)
        rgb = colr * band[..., None] + np.ones(3) * glow[..., None]
        alpha = np.clip(band * 0.94 + glow * 0.7, 0, 1)
        rgb = rgb * (1 - edge[..., None]) + edge[..., None]; alpha = np.maximum(alpha, edge * band.clip(0.3, 1))
        rgb = rgb * (1 - spark[..., None]) + spark[..., None]; alpha = np.maximum(alpha, spark)
        # puffs at the two ends
        puff = Image.new('L', (W_, H_), 0); dpf = ImageDraw.Draw(puff)
        for t in (t0, t1):
            ex, ey = cx + R * math.cos(t), cy + R * math.sin(t)
            for (ox, oy, pr) in ((-0.36, 0.05, 0.3), (0.0, -0.12, 0.38), (0.36, 0.05, 0.3), (0.0, 0.16, 0.3)):
                pr_ = pr * T * SS; dpf.ellipse([ex + ox * T * SS - pr_, ey + oy * T * SS - pr_, ex + ox * T * SS + pr_, ey + oy * T * SS + pr_], fill=255)
        pf = blur(arr(puff), 1.2 * SS) * 0.92
        pshade = np.clip(blur(arr(puff), 5 * SS) - blur(arr(puff), 2 * SS), 0, 1)
        prgb = np.ones((H_, W_, 3)) - pshade[..., None] * np.array([0.12, 0.14, 0.02])
        a_ = np.clip(alpha, 1e-4, 1)
        rgb = (rgb / a_[..., None]) * (1 - pf[..., None]) + prgb * pf[..., None]; alpha = np.maximum(alpha, pf)
        save_rgba(np.clip(rgb, 0, 1), np.clip(alpha, 0, 1), f'bow_{bk_}.png')
        # display size (world px) + offset of the image centre from the arc centre (world px)
        bow_sizes[bk_] = [W_ // SS, H_ // SS, (W_ / 2 - cx) / SS, (H_ / 2 - cy) / SS]
# prism: glass triangle with bright edges and a little spectrum on its flank (white glass; the colour aura is tinted in-game)
s = 72 * SS; im = Image.new('L', (s, s), 0); d = ImageDraw.Draw(im); c = s / 2
tri = [(c, c - 26 * SS), (c + 24 * SS, c + 16 * SS), (c - 24 * SS, c + 16 * SS)]
d.polygon(tri, fill=255); body = blur(arr(im), 0.8 * SS)
edge = np.clip(body - minf(body, 5 * SS // 2 * 2 + 1), 0, 1)
yy, xx = np.mgrid[0:s, 0:s]
facet = np.clip(0.55 + 0.45 * ((xx - c) / (24 * SS)), 0, 1) * body
rgb = np.ones((s, s, 3)) * np.array([0.86, 0.92, 1.0]) * 0.65 + facet[..., None] * 0.3
spec = np.zeros((s, s, 3)); sa = np.zeros((s, s))
for k, cc_ in enumerate(RB):     # tiny spectrum fanning out of the right flank
    ang = math.radians(-8 + k * 5); L_ = 30 * SS
    for q in range(int(L_)):
        px, py = c + 10 * SS + q * math.cos(ang), c + 2 * SS + q * math.sin(ang)
        if 0 <= int(px) < s and 0 <= int(py) < s:
            spec[int(py), int(px)] = cc_ / 255.0; sa[int(py), int(px)] = 1 - q / L_
sa = blur(sa, 0.9 * SS) * 2.2; spec = np.dstack([blur(spec[..., k] * 1.0, 0.9 * SS) for k in range(3)]) * 2.2
alpha = np.clip(body * 0.78 + edge, 0, 1)
rgb = rgb * (1 - edge[..., None]) + edge[..., None]
glow_ = np.clip(blur(body, 5 * SS) * 0.5, 0, 1) * (1 - body)
rgb = rgb * (1 - glow_[..., None]) + glow_[..., None]; alpha = np.maximum(alpha, glow_)
sam = np.clip(sa, 0, 1) * (1 - body)
rgb = rgb * (1 - sam[..., None]) + np.clip(spec / np.maximum(sa, 1e-3)[..., None], 0, 1) * sam[..., None]; alpha = np.maximum(alpha, sam)
save_rgba(rgb, alpha, 'prism.png')
# spectrum beam: soft streak whose LEFT end sits on the image centre (so it can be rotated about the prism)
w, h = 256, 16 * SS; yy, xx = np.mgrid[0:h, 0:w]; u = (xx - w / 2) / (w / 2)
beam = np.exp(-((yy - h / 2) / (2.2 * SS)) ** 2) * np.clip(u * 8, 0, 1) * np.clip(1 - u, 0, 1) ** 0.7 * (u > 0)
glow_sprite(np.clip(beam + blur(beam, 3 * SS) * 0.5, 0, 1), WHITE, 'beam.png', white_core=np.clip(beam * 0.5, 0, 1))
# colour-glass gate pane (tinted in-game): rounded glass tile, diagonal shine, bright border
s = T * SS; im = Image.new('L', (s, s), 0); ImageDraw.Draw(im).rounded_rectangle([2 * SS, 2 * SS, s - 2 * SS, s - 2 * SS], radius=7 * SS, fill=255)
body = blur(arr(im), 0.6 * SS); edge = np.clip(body - minf(body, 7), 0, 1)
yy, xx = np.mgrid[0:s, 0:s]; shine = (((xx + yy) % (26 * SS)) < 5 * SS).astype(np.float32) * 0.5 * body
save_rgba(np.clip(np.ones((s, s, 3)) * (0.82 + 0.18 * shine[..., None]) + edge[..., None] * 0.2, 0, 1), np.clip(body * 0.62 + shine * 0.4 + edge * 0.9, 0, 1), 'gate.png')
# raindrop: short soft streak (normal blend, tinted blue in-game)
w, h = 10 * SS, 36 * SS; yy, xx = np.mgrid[0:h, 0:w]
dr = np.exp(-((xx - w / 2) / (1.5 * SS)) ** 2) * np.clip(yy / h, 0, 1) ** 1.5
save_rgba(np.ones((h, w, 3)), np.clip(dr * 1.1, 0, 1), 'raindrop.png')
# music note (eighth note) for the joyful sparkles when riding rainbows / bursting clouds
s = 40 * SS; im = Image.new('L', (s, s), 0); d = ImageDraw.Draw(im)
d.ellipse([8 * SS, 25 * SS, 20 * SS, 34 * SS], fill=255); d.rectangle([17 * SS, 6 * SS, 20 * SS, 30 * SS], fill=255)
d.polygon([(20 * SS, 6 * SS), (31 * SS, 13 * SS), (31 * SS, 18 * SS), (20 * SS, 12 * SS)], fill=255)
nm = blur(arr(im), 0.7 * SS); ol = np.clip(maxf(nm, 5) - nm, 0, 1)
save_rgba(np.ones((s, s, 3)), np.clip(nm + blur(nm, 3 * SS) * 0.5, 0, 1), 'note.png')
