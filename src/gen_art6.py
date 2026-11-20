# ---- Phantom Photon art, part 6 (exec'd from gen_art.py): finale lives + new hazards
# life icon (photon), crown badge (finale nodes), lightning bolt (Song of Rainbows storms), icicle (Frozen Light)
s_ = 40 * SS; c_ = (s_ - 1) / 2; yy, xx = np.mgrid[0:s_, 0:s_].astype(np.float32); r_ = np.hypot(xx - c_, yy - c_) / c_
core = np.clip(1 - r_ / 0.42, 0, 1) ** 0.8; glow = np.clip(1 - r_, 0, 1) ** 2.2; ring_ = np.clip(1 - np.abs(r_ - 0.62) / 0.07, 0, 1) * 0.9
col = np.ones((s_, s_, 3)) * (np.array([120, 235, 255]) / 255.0); w_ = np.clip(core * 1.4, 0, 1)[..., None]
save_rgba(col * (1 - w_) + w_, np.clip(core + glow * 0.75 + ring_, 0, 1), 'life_icon.png')
# crown: gold, three points with jewels, soft dark outline so it reads on every card
W_, H_ = 64 * SS, 46 * SS; im = Image.new('RGBA', (W_, H_), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
pts = [(6, 40), (6, 14), (19, 26), (32, 6), (45, 26), (58, 14), (58, 40)]
d.polygon([(x * SS, y * SS) for x, y in pts], fill=(255, 205, 70, 255))
d.rectangle([6 * SS, 34 * SS, 58 * SS, 41 * SS], fill=(255, 170, 40, 255))
for (x, y, cc) in ((6, 12, (255, 120, 170)), (32, 5, (130, 230, 255)), (58, 12, (255, 120, 170))): d.ellipse([(x - 4) * SS, (y - 4) * SS, (x + 4) * SS, (y + 4) * SS], fill=cc + (255,))
d.ellipse([28 * SS, 33 * SS, 36 * SS, 41 * SS], fill=(150, 255, 190, 255))
a = np.asarray(im).astype(np.float32) / 255.0; al = a[..., 3]
ol = np.clip(blur(al, 1.6 * SS) * 2.5, 0, 1); rgb = a[..., :3] * al[..., None] + np.array([0.24, 0.12, 0.02]) * (1 - al[..., None])
hi = np.clip((1 - yy[:H_, :W_] / H_ if False else 0), 0, 1)
save_rgba(rgb, np.maximum(al, ol * 0.85), 'crown.png')
# lightning bolt (points right, additive): jagged white-hot core with a sunny yellow glow
W_, H_ = 256 * SS, 48 * SS; im = Image.new('L', (W_, H_), 0); d = ImageDraw.Draw(im); rs = np.random.RandomState(7)
pts = [(0, H_ / 2)]; x = 0
while x < W_ - 20 * SS: x += rs.randint(14, 30) * SS; pts.append((min(x, W_ - 1), H_ / 2 + rs.uniform(-14, 14) * SS))
d.line(pts, fill=255, width=3 * SS, joint='curve')
b_ = arr(im); glow_sprite(np.clip(b_ + blur(b_, 4 * SS) * 1.6 + blur(b_, 10 * SS) * 0.9, 0, 1), np.array([255, 220, 60]), 'bolt.png', white_core=b_)
# icicle (points right = the falling direction after rotation): pale glassy spike with a bright edge
W_, H_ = 96 * SS, 30 * SS; im = Image.new('RGBA', (W_, H_), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
d.polygon([(0, 3 * SS), (W_ - 1, H_ / 2), (0, H_ - 3 * SS)], fill=(190, 230, 255, 235))
d.polygon([(0, 7 * SS), (W_ * 0.8, H_ / 2 - 1 * SS), (0, H_ / 2)], fill=(250, 254, 255, 255))
a = np.asarray(im).astype(np.float32) / 255.0; al = a[..., 3]
ol = np.clip(blur(al, 1.2 * SS) * 2, 0, 1)
save_rgba(a[..., :3] * al[..., None] + np.array([0.2, 0.35, 0.6]) * (1 - al[..., None]), np.maximum(al, ol * 0.8), 'icicle.png')
