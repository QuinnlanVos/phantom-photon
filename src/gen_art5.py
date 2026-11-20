# ---- Phantom Photon art, part 5 (exec'd from gen_art.py): Frozen Light (chapter 6)
# night-blue icy sky, aurora curtain, snowflakes, lanterns (off / lit), lantern ice, glaciers, cracks, waterfall (4 frames),
# sunlight shaft through the ice, ice shard debris
hh = 512; tt = np.linspace(0, 1, hh)
skyI = lerp_stops(tt, [[5, 10, 30], [10, 26, 64], [18, 52, 104], [44, 104, 150], [96, 160, 190]]) / 255.0
save_rgba(np.repeat(skyI[:, None, :], 16, axis=1), np.ones((hh, 16)), 'sky_ice.png')
# aurora: a waving curtain with vertical rays, green at the hem fading to cyan and violet above (additive)
w, h = 768, 320; yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
hem = h * 0.72 + 26 * np.sin(xx / w * 2 * np.pi * 1.3) + 12 * np.sin(xx / w * 2 * np.pi * 3.7 + 1.1)
u = (hem - yy) / (h * 0.62)                       # 0 at the hem, 1 at the top of the curtain
body = np.clip(u, 0, 1) ** 0.5 * np.clip(1 - u, 0, 1) ** 1.6 * (u > 0)
rays = 0.55 + 0.45 * np.sin(xx / 7.0 + 2 * np.sin(xx / 53.0)) * np.sin(xx / 17.0 + 0.7)
edge = np.clip(1 - np.abs(yy - hem) / 10.0, 0, 1) * 0.22
ia = np.clip(body * (0.6 + 0.6 * rays) + edge, 0, 1) * np.clip(np.minimum(xx, w - xx) / 120.0, 0, 1)
colA = lerp_stops(np.clip(u, 0, 1), [[90, 255, 170], [70, 235, 220], [90, 170, 255], [170, 110, 255]]) / 255.0
save_rgba(colA, blur(ia, 2.0), 'aurora.png')
# snowflake: soft dot with six faint arms (additive)
s_ = 28 * SS; c_ = s_ / 2; yy, xx = np.mgrid[0:s_, 0:s_].astype(np.float32); r_ = np.hypot(xx - c_, yy - c_); an_ = np.arctan2(yy - c_, xx - c_)
arms = np.clip(1 - np.abs(np.sin(an_ * 3)) * r_ / 1.6, 0, 1) * np.clip(1 - r_ / c_, 0, 1)
dot = np.clip(1 - r_ / (c_ * 0.35), 0, 1) ** 1.5
save_rgba(np.ones((s_, s_, 3)), np.clip(dot + arms * 0.8, 0, 1), 'snowflake.png')
# lantern: iron frame + glass; 'off' = cold blue glass, 'on' = warm glowing glass with a flame
def lantern(on, name):
    W_, H_ = 44 * SS, 64 * SS; im = Image.new('RGBA', (W_, H_), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    fr = (40, 58, 88, 255); x0, x1, y0, y1 = 9 * SS, 35 * SS, 16 * SS, 54 * SS
    glass = (255, 214, 140, 235) if on else (150, 190, 230, 150)
    d.ellipse([16 * SS, 2 * SS, 28 * SS, 14 * SS], outline=fr, width=2 * SS)                    # handle ring
    d.polygon([(7 * SS, 17 * SS), (37 * SS, 17 * SS), (30 * SS, 10 * SS), (14 * SS, 10 * SS)], fill=fr)   # cap
    d.rounded_rectangle([x0, y0, x1, y1], radius=4 * SS, fill=glass)
    if on:
        d.ellipse([18 * SS, 30 * SS, 26 * SS, 46 * SS], fill=(255, 250, 220, 255)); d.ellipse([19.5 * SS, 26 * SS, 24.5 * SS, 40 * SS], fill=(255, 255, 245, 255))
    for xb in (x0, (x0 + x1) // 2, x1 - 2 * SS): d.rectangle([xb, y0, xb + 2 * SS, y1], fill=fr)
    d.rectangle([x0 - 2 * SS, y1, x1 + 2 * SS, y1 + 5 * SS], fill=fr); d.rectangle([x0 - 1 * SS, y0 - 1 * SS, x1 + 1 * SS, y0 + 2 * SS], fill=fr)
    a = np.asarray(im).astype(np.float32) / 255.0
    rim = np.clip(blur(a[..., 3], 1.5 * SS) - a[..., 3] * 0.0, 0, 1) * 0.0
    save_rgba(a[..., :3], a[..., 3], name)
lantern(False, 'lantern_off.png'); lantern(True, 'lantern_on.png')
# tiles (48 px world, drawn at SS): lantern ice (white so it can be tinted), glacier (deep blue, faceted), crack (thin fractured pane)
S_ = T * SS; yy, xx = np.mgrid[0:S_, 0:S_].astype(np.float32)
bev = np.minimum(np.minimum(xx, S_ - 1 - xx), np.minimum(yy, S_ - 1 - yy)) / S_
rs = np.random.RandomState(61)
hl = np.clip(1 - np.abs((xx + yy) - S_ * 0.55) / (S_ * 0.08), 0, 1) * 0.45 + np.clip(1 - np.abs((xx + yy) - S_ * 0.8) / (S_ * 0.03), 0, 1) * 0.35
iceA = np.clip(0.62 + 0.3 * np.clip(1 - bev / 0.12, 0, 1), 0, 1)
iceRGB = np.clip(np.array([0.86, 0.95, 1.0])[None, None, :] * (0.8 + 0.2 * blur(rs.rand(S_, S_).astype(np.float32), 4 * SS))[..., None] + hl[..., None], 0, 1)
iceRGB = iceRGB * (1 - np.clip(1 - bev / 0.05, 0, 1)[..., None] * 0.0) + np.clip(1 - bev / 0.05, 0, 1)[..., None] * 0.15
save_rgba(iceRGB, iceA, 'ice_block.png')
facets = np.zeros((S_, S_), np.float32); im = Image.new('L', (S_, S_), 0); d = ImageDraw.Draw(im)
for k in range(5):
    p = [(rs.uniform(0, S_), rs.uniform(0, S_)) for _ in range(3)]; d.polygon(p, fill=int(rs.uniform(40, 120)))
facets = blur(arr(im), 0.6 * SS)
gl_ = np.array([0.10, 0.30, 0.66])[None, None, :] + facets[..., None] * np.array([0.35, 0.4, 0.3])[None, None, :] + hl[..., None] * 0.45
gl_ = gl_ + np.clip(1 - bev / 0.06, 0, 1)[..., None] * 0.35
save_rgba(np.clip(gl_, 0, 1), np.clip(0.93 + 0.07 * (bev > 0.05), 0, 1), 'glacier.png')
im = Image.new('L', (S_, S_), 0); d = ImageDraw.Draw(im)
for k in range(7):
    x_, y_ = rs.uniform(0, S_), rs.uniform(0, S_); pts = [(x_, y_)]
    for q in range(5): x_ += rs.uniform(-12, 12) * SS; y_ += rs.uniform(-12, 12) * SS; pts.append((x_, y_))
    d.line(pts, fill=255, width=max(1, SS))
cr = blur(arr(im), 0.5 * SS)
crA = np.clip(0.28 + 0.2 * hl + cr * 0.7 + np.clip(1 - bev / 0.05, 0, 1) * 0.25, 0, 1)
save_rgba(np.clip(np.array([0.78, 0.92, 1.0])[None, None, :] + cr[..., None] * 0.3, 0, 1), crA, 'crack.png')
# waterfall: falling water streaks, 4 frames, seamless vertically (normal blend, semi-transparent)
WW, WH = T * SS, 2 * T * SS; yy, xx = np.mgrid[0:WH, 0:WW].astype(np.float32)
rs = np.random.RandomState(77); cols_ = [(rs.uniform(0, WW), rs.uniform(1.0, 2.6) * SS, rs.uniform(0.3, 1.0), rs.uniform(0, 1)) for _ in range(16)]
for f in range(4):
    a = np.zeros((WH, WW), np.float32)
    for (cx, wd, br, ph) in cols_:
        streak = np.clip(1 - np.abs(xx - cx) / wd, 0, 1)
        flow = 0.55 + 0.45 * np.sin((yy / WH + f / 4 + ph) * 2 * np.pi * 2)
        a += streak * br * flow
    side = np.clip(np.minimum(xx, WW - xx) / (8 * SS), 0, 1)
    a = np.clip(0.22 + a * 0.55, 0, 1) * side
    rgbW = np.clip(np.array([0.62, 0.84, 1.0])[None, None, :] + a[..., None] * 0.35, 0, 1)
    save_rgba(rgbW, a * 0.85, f'waterfall_{f}.png')
# sunlight shaft through the ice: warm vertical beam, soft sides, fading at both ends (additive)
SW, SH = 64 * SS, 256 * SS; yy, xx = np.mgrid[0:SH, 0:SW].astype(np.float32)
sx = np.clip(1 - np.abs(xx - SW / 2) / (SW / 2), 0, 1) ** 1.3; sy = np.clip(np.minimum(yy, SH - yy) / (SH * 0.18), 0, 1)
motes = (np.random.RandomState(5).rand(SH, SW) < 0.002).astype(np.float32); motes = np.clip(blur(motes, 1.0 * SS) * 6, 0, 1)
ia = np.clip(sx * sy * 0.75 + motes * sx * 0.8, 0, 1)
save_rgba(np.ones((SH, SW, 3)) * np.array([1.0, 0.93, 0.72])[None, None, :], ia, 'sun_shaft.png')
# ice shard debris
im = Image.new('L', (20 * SS, 20 * SS), 0); d = ImageDraw.Draw(im); d.polygon([(2 * SS, 18 * SS), (10 * SS, 1 * SS), (18 * SS, 14 * SS)], fill=255)
a = blur(arr(im), 0.6 * SS); save_rgba(np.ones(a.shape + (3,)) * np.array([0.85, 0.96, 1.0]), a, 'ice_shard.png')
