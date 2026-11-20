# ---- Phantom Photon art, part 3 (exec'd from gen_art.py): Rocks from Space (chapter 4)
# deep-space void sky, crisp pinpoint stars, faceted asteroids with blazing rims, rings of space dust, cosmic hail
# deep-space void: near-black obsidian gradient (#030408 -> #070911), stretched over the level in-game
hh = 512; tt = np.linspace(0, 1, hh)[:, None]
vc = np.array([7, 9, 17]) * (1 - tt) + np.array([3, 4, 8]) * tt
save_rgba(np.repeat((vc / 255.0)[:, None, :], 16, axis=1), np.ones((hh, 16)), 'sky_void.png')
# pinpoint star: razor-crisp core, whisper of glow (tinted in-game: cool white / ice blue / faint gold)
s = 16 * SS; r = radial(s)
glow_sprite(np.clip(np.exp(-(r / (0.9 * SS)) ** 2) + np.exp(-(r / (2.6 * SS)) ** 2) * 0.22, 0, 1), WHITE, 'pin_star.png', white_core=np.exp(-(r / (0.7 * SS)) ** 2))
# asteroids: faceted jagged dark rock, light-side facets, blazing white-orange rim + glowing fracture lines (drawn for r = 1 tile)
ROCK_VARIANTS = 3
for v in range(ROCK_VARIANTS):
    rs = np.random.RandomState(70 + v); R0 = T * SS; pad = 26 * SS; s = int(2 * (R0 + pad)); c = s / 2
    nv = 11 + v * 2; angs = np.sort(rs.uniform(0, 2 * np.pi, nv)); angs = np.linspace(0, 2 * np.pi, nv, endpoint=False) + rs.uniform(-0.2, 0.2, nv)
    rad = R0 * rs.uniform(0.74, 0.98, nv)
    pts = [(c + rad[k] * math.cos(angs[k]), c + rad[k] * math.sin(angs[k])) for k in range(nv)]
    body = Image.new('L', (s, s), 0); ImageDraw.Draw(body).polygon(pts, fill=255); bm = arr(body)
    shade = Image.new('L', (s, s), 0); dsh = ImageDraw.Draw(shade)
    inner = (c + rs.uniform(-0.18, 0.18) * R0, c + rs.uniform(-0.18, 0.18) * R0)
    for k in range(nv):                     # facets: triangle fans lit from the upper-left
        a, b = pts[k], pts[(k + 1) % nv]; mx, my = (a[0] + b[0]) / 2 - c, (a[1] + b[1]) / 2 - c
        lit = 0.5 + 0.5 * (-(mx) * 0.7 - (my) * 0.7) / (math.hypot(mx, my) + 1e-3)
        dsh.polygon([inner, a, b], fill=int(40 + 150 * lit ** 1.6))
    sh = arr(shade) * bm
    yy, xx = np.mgrid[0:s, 0:s]
    grain = (rs.rand(s // 4 + 1, s // 4 + 1))
    grain = arr(Image.fromarray((grain * 255).astype(np.uint8), 'L').resize((s, s), Image.BICUBIC))
    craters = np.zeros((s, s), np.float32)
    for q in range(5 + v):
        cx_, cy_ = c + rs.uniform(-0.5, 0.5) * R0, c + rs.uniform(-0.5, 0.5) * R0; cr = rs.uniform(0.08, 0.17) * R0
        dd = np.hypot(xx - cx_, yy - cy_); craters += np.clip(1 - np.abs(dd - cr) / (2 * SS), 0, 1) * 0.5 - (dd < cr) * 0.25
    edge = np.clip(bm - minf(bm, 5), 0, 1)               # crisp rim
    rimL = blur(edge, 1.0)
    cracks = Image.new('L', (s, s), 0); dc = ImageDraw.Draw(cracks)
    for q in range(3 + v):                              # glowing fracture lines (molten seams)
        x_, y_ = c + rs.uniform(-0.35, 0.35) * R0, c + rs.uniform(-0.35, 0.35) * R0; a_ = rs.uniform(0, 2 * np.pi)
        seg = [(x_, y_)]
        for z in range(4): a_ += rs.uniform(-0.8, 0.8); x_ += math.cos(a_) * R0 * 0.16; y_ += math.sin(a_) * R0 * 0.16; seg.append((x_, y_))
        dc.line(seg, fill=255, width=int(1.6 * SS), joint='curve')
    ck = arr(cracks) * minf(bm, 9)
    base = np.clip(0.07 + 0.22 * sh + 0.05 * (grain - 0.5) + 0.12 * craters * bm, 0, 1)
    rock = np.dstack([base * 0.95, base * 0.97, base * 1.08])
    hot = np.array([1.0, 0.62, 0.25]); white = np.ones(3)
    ckg = blur(ck, 2.5 * SS)
    rock = rock * (1 - np.clip(ckg * 0.9, 0, 1)[..., None]) + hot * np.clip(ckg * 0.9, 0, 1)[..., None]
    rock = rock * (1 - ck[..., None]) + (hot * 0.4 + white * 0.6) * ck[..., None]
    # rim: white-hot inner line, amber outer glow spilling into space
    rg1 = blur(edge, 3 * SS); rg2 = blur(edge, 9 * SS)
    halo = np.clip(rg1 * 1.6 + rg2 * 1.1, 0, 1) * (1 - bm)
    rgb = rock * bm[..., None]
    alpha = bm.copy()
    rgb = rgb + hot * (halo * 0.9)[..., None]; alpha = np.maximum(alpha, halo * 0.85)
    rimc = np.clip(rimL * 1.4, 0, 1)
    rgb = rgb * (1 - rimc[..., None]) + (white * 0.75 + hot * 0.25) * rimc[..., None]; alpha = np.maximum(alpha, rimc)
    a = np.clip(alpha, 1e-4, 1); save_rgba(np.clip(rgb / a[..., None] * np.minimum(alpha, 1)[..., None] / a[..., None] if False else rgb / a[..., None], 0, 1), alpha, f'asteroid_{v + 1}.png')
s = 160 * SS; r = radial(s); glow_sprite(np.exp(-(r / (42 * SS)) ** 2) * 0.55 + np.exp(-(r / (20 * SS)) ** 2) * 0.25, np.array([255, 150, 70]), 'rock_glow.png')
# rings of space dust: one image per ring (gaps drawn centred on angles 2*pi*k/gaps; rotated in-game), stark pale gold / silver
ring_sizes = {}; ring_index = {}; rk_ = 0
for li, lv in enumerate(LEVELS):
    for gi_, g in enumerate(lv.get('rings', [])):
        rk_ += 1; ring_index[f'{li}:{gi_}'] = rk_
        R = g.get('r', 2.25) * T * SS; hw = g.get('w', 0.6) * T * SS / 2; gaps = g.get('gaps', 2); gap = math.radians(g.get('gap', 100))
        pad = 22 * SS; s = int(2 * (R + hw + pad)); c = (s - 1) / 2
        yy, xx = np.mgrid[0:s, 0:s]; dd = np.hypot(xx - c, yy - c); an = np.arctan2(yy - c, xx - c)
        step = 2 * np.pi / gaps; u = np.mod(an, step); off = np.minimum(u, step - u)       # angular distance to the nearest gap centre
        arcd = (off - gap / 2) * dd                                                       # >0 inside the dust arc (px along the ring)
        arcm = np.clip(arcd / (1.2 * SS), 0, 1)
        band = np.clip((hw - np.abs(dd - R)) / (1.0 * SS), 0, 1) * arcm
        rs = np.random.RandomState(300 + rk_)
        grit = (rs.rand(s, s) < 0.16).astype(np.float32) * rs.uniform(0.35, 1.0, (s, s))
        grit = np.clip(grit + blur(grit, 0.8) * 0.8, 0, 1)
        swirl = 0.5 + 0.5 * np.sin(an * 9 + dd / (5 * SS))
        edgel = np.clip(1 - np.abs(np.abs(dd - R) - hw) / (1.1 * SS), 0, 1) * arcm      # crisp inner & outer edge lines
        capl = np.clip(1 - np.abs(arcd) / (1.4 * SS), 0, 1) * np.clip((hw - np.abs(dd - R)) / SS + 1, 0, 1)   # bright caps at the gap ends
        bodyI = band * (0.07 + 0.16 * swirl ** 2 + 0.8 * grit)
        glowI = np.clip(blur(band * (0.3 + 0.7 * swirl), 5 * SS) * 0.45 + blur(band, 14 * SS) * 0.22, 0, 1)
        inten = np.clip(bodyI + edgel * 0.95 + capl * 1.0 + glowI * 0.6, 0, 1)
        t_ = np.clip((dd - (R - hw)) / (2 * hw), 0, 1)[..., None]
        colr = (np.array([255, 222, 150]) * (1 - t_) + np.array([225, 235, 255]) * t_) / 255.0
        wcore = np.clip(edgel * 0.7 + capl * 0.8 + grit * band * 0.35, 0, 1)[..., None]
        save_rgba(colr * (1 - wcore) + wcore, inten, f'dustring_{rk_}.png')
        ring_sizes[rk_] = [s // SS, s // SS]
# cosmic hail: blazing icy-white streak with electric-cyan glow (points right), telegraph shimmer line, impact flare
w, h = 120 * SS, 14 * SS; y, x = np.mgrid[0:h, 0:w]; u = x / w
st_ = np.exp(-((y - h / 2) / (1.6 * SS)) ** 2) * np.clip(u * 1.2, 0, 1) ** 2.2
head = np.exp(-(((x - w * 0.93) / (4 * SS)) ** 2 + ((y - h / 2) / (2.4 * SS)) ** 2))
glow_sprite(np.clip(st_ + head + blur(st_, 3 * SS) * 0.5, 0, 1), np.array([120, 230, 255]), 'hail_streak.png', white_core=np.clip(st_ * np.clip((u - 0.45) * 2, 0, 1) + head, 0, 1))
w, h = 256, 8 * SS; y, x = np.mgrid[0:h, 0:w]
ln_ = np.exp(-((y - h / 2) / (0.9 * SS)) ** 2) * ((x // 10) % 2 == 0)
glow_sprite(np.clip(ln_ + blur(ln_.astype(np.float32), 2 * SS) * 0.6, 0, 1), WHITE, 'hail_tele.png', white_core=ln_ * 0.4)
s = 48 * SS; r = radial(s); y, x = np.mgrid[0:s, 0:s]; c = (s - 1) / 2
burst = np.zeros((s, s))
for k in range(6):
    a_ = k * np.pi / 3 + 0.3; dxs, dys = math.cos(a_), math.sin(a_); along = (x - c) * dxs + (y - c) * dys; perp = -(x - c) * dys + (y - c) * dxs
    burst += np.exp(-(perp / (1.0 * SS)) ** 2) * np.exp(-(np.maximum(along, 0) / (11 * SS)) ** 2) * (along > 0)
glow_sprite(np.clip(burst + np.exp(-(r / (3 * SS)) ** 2), 0, 1), WHITE, 'ice_burst.png', white_core=np.exp(-(r / (2 * SS)) ** 2))
# jagged rock shard (debris particle when the photon shatters on an asteroid)
s = 24 * SS; im = Image.new('L', (s, s), 0); ImageDraw.Draw(im).polygon([(4 * SS, 12 * SS), (12 * SS, 3 * SS), (20 * SS, 9 * SS), (16 * SS, 20 * SS), (7 * SS, 18 * SS)], fill=255)
sh_ = arr(im); glow_sprite(np.clip(sh_ * 0.7 + (sh_ - minf(sh_, 3)).clip(0, 1) + blur(sh_, 2 * SS) * 0.5, 0, 1), WHITE, 'rock_bit.png', white_core=(sh_ - minf(sh_, 3)).clip(0, 1) * 0.6)
