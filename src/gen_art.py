"""Procedural neon art for Phantom Photon (PIL + numpy). Usage: python3 gen_art.py <assets dir>
All sprites are drawn at 2x (SS) and displayed at 0.5 scale in-game for crisp edges on high-DPI phones."""
import sys, os, json, math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = sys.argv[1] if len(sys.argv) > 1 else '../project/assets'
os.makedirs(OUT, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__))
T = 48; SS = 2; M = 40          # tile (world px), supersample, level-art margin (world px)
CYAN = np.array([40, 230, 255]); MAGENTA = np.array([255, 50, 200]); VIOLET = np.array([170, 90, 255])
LIME = np.array([80, 255, 160]); GOLD = np.array([255, 210, 80]); ORANGE = np.array([255, 120, 40]); WHITE = np.array([255, 255, 255])

def arr(im): return np.asarray(im, dtype=np.float32) / 255.0
def blur(a, r):
    im = Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8), 'L').filter(ImageFilter.GaussianBlur(r))
    return arr(im)
def minf(a, n): return arr(Image.fromarray((a * 255).astype(np.uint8), 'L').filter(ImageFilter.MinFilter(n)))
def maxf(a, n): return arr(Image.fromarray((a * 255).astype(np.uint8), 'L').filter(ImageFilter.MaxFilter(n)))
def save_rgba(rgb, alpha, name, down=1):
    """rgb: HxWx3 float 0..1 (straight color), alpha: HxW 0..1"""
    a = np.clip(alpha, 0, 1)
    im = Image.fromarray(np.dstack([np.clip(rgb, 0, 1) * 255, a * 255]).astype(np.uint8), 'RGBA')
    if down > 1: im = im.resize((im.width // down, im.height // down), Image.LANCZOS)
    im.save(os.path.join(OUT, name)); return im
def glow_sprite(intensity, color, name, white_core=None):
    """Additive sprite: color tinted, alpha = intensity; optional white-hot core where white_core > 0."""
    rgb = np.ones(intensity.shape + (3,)) * (color / 255.0)
    if white_core is not None:
        w = np.clip(white_core, 0, 1)[..., None]; rgb = rgb * (1 - w) + w
        intensity = np.maximum(intensity, white_core)
    return save_rgba(rgb, intensity, name)
def radial(size, c=None):
    c = c if c is not None else (size - 1) / 2
    y, x = np.mgrid[0:size, 0:size]; return np.hypot(x - c, y - c)

# ------------------------------------------------------------------ level art
CHAPTERS = json.load(open(os.path.join(HERE, 'chapters.json')))
LEVELS = [lv for ch in CHAPTERS for lv in ch['levels']]
DARK = [ch.get('dark', False) for ch in CHAPTERS for lv in ch['levels']]
THEME = [ch.get('theme', '') for ch in CHAPTERS for lv in ch['levels']]
SKYC = np.array([90, 200, 255]); TURQ = np.array([50, 245, 215]); CORAL = np.array([255, 120, 160]); AMBER = np.array([255, 196, 80]); ROSEM = np.array([255, 70, 190])
SILVER = np.array([205, 235, 255]); MINT = np.array([70, 255, 200]); AZURE = np.array([50, 150, 255])
RAMP_TRI = {'a': ((1, 0), (1, 1), (0, 1)), 'b': ((0, 0), (1, 1), (0, 1)), 'c': ((0, 0), (1, 0), (0, 1)), 'd': ((0, 0), (1, 0), (1, 1))}
def level_art(n, lv, dark=False, theme=''):
    rows = lv['map']; w, h = len(rows[0]), len(rows)
    S = T * SS; m = M * SS; W, H = w * S + 2 * m, h * S + 2 * m
    solid = Image.new('L', (W, H), 255); d = ImageDraw.Draw(solid)
    pad = Image.new('L', (W, H), 0); dp = ImageDraw.Draw(pad)
    ramp = Image.new('L', (W, H), 0); dr = ImageDraw.Draw(ramp)
    mir = Image.new('L', (W, H), 0); dmi = ImageDraw.Draw(mir)
    dml = Image.new('L', (W, H), 0); ddl = ImageDraw.Draw(dml)
    trk = Image.new('L', (W, H), 0); dtk = ImageDraw.Draw(trk)
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            x0, y0 = m + i * S, m + j * S
            if ch == 'M': dmi.rectangle([x0, y0, x0 + S - 1, y0 + S - 1], fill=255)
            if ch == 'm': ddl.line([(x0 + 6, y0 + S - 7), (x0 + S - 7, y0 + 6)], fill=255, width=3 * SS)
            if ch == 'n': ddl.line([(x0 + 6, y0 + 6), (x0 + S - 7, y0 + S - 7)], fill=255, width=3 * SS)
            if ch not in '#PM':
                d.rectangle([x0, y0, x0 + S - 1, y0 + S - 1], fill=0)
            if ch == 'P': dp.rectangle([x0, y0, x0 + S - 1, y0 + S - 1], fill=255)
            if ch in RAMP_TRI:
                pts = [(x0 + u * S, y0 + v * S) for u, v in RAMP_TRI[ch]]
                d.polygon(pts, fill=255); dr.polygon(pts, fill=255)
    crv = Image.new('L', (W, H), 0); dcv = ImageDraw.Draw(crv)        # curved boost-wall rims
    lanes = Image.new('L', (W, H), 0); dln = ImageDraw.Draw(lanes)    # faint dashed riding lanes
    crv_t = np.zeros((H, W), np.float32); crv_w = np.zeros((H, W), np.float32)
    for cv in lv.get('curves', []):
        r = cv['r']; sx = 1 if 'E' in cv['c'] else -1; sy = 1 if 'S' in cv['c'] else -1
        bx0, by0 = m + cv['i'] * S, m + cv['j'] * S; bx1, by1 = bx0 + r * S, by0 + r * S
        cx, cy = (bx0 if sx > 0 else bx1), (by0 if sy > 0 else by1); R = r * S
        d.rectangle([bx0, by0, bx1 - 1, by1 - 1], fill=255)
        a0 = {(1, 1): 0, (-1, 1): 90, (-1, -1): 180, (1, -1): 270}[(sx, sy)]
        d.pieslice([cx - R, cy - R, cx + R, cy + R], a0, a0 + 90, fill=0)     # the open quarter disc (the wedge is exactly inside the block)
        dcv.arc([cx - R - 2 * SS, cy - R - 2 * SS, cx + R + 2 * SS, cy + R + 2 * SS], a0, a0 + 90, fill=255, width=5 * SS)
        for k in range(r):
            rr = S / 2 + k * S
            for q in range(0, 90, 6): dln.arc([cx - rr, cy - rr, cx + rr, cy + rr], a0 + q, a0 + q + 3, fill=255, width=SS)
        yy0, xx0 = np.mgrid[by0:by1, bx0:bx1]
        ang = np.arctan2((yy0 - cy) * sy, (xx0 - cx) * sx) / (np.pi / 2)
        crv_t[by0:by1, bx0:bx1] = np.clip(ang, 0, 1); crv_w[by0:by1, bx0:bx1] = 1
    for mv in lv.get('movers', []):    # faint dashed track: the whole area the platform sweeps
        x0, y0 = m + mv['i'] * S, m + mv['j'] * S
        x1 = x0 + mv['w'] * S + (mv['range'] * S if mv['axis'] == 'x' else 0); y1 = y0 + mv['h'] * S + (mv['range'] * S if mv['axis'] == 'y' else 0)
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        if mv['axis'] == 'x': dtk.line([(x0 + S / 2, cy), (x1 - S / 2, cy)], fill=255, width=2 * SS)
        else: dtk.line([(cx, y0 + S / 2), (cx, y1 - S / 2)], fill=255, width=2 * SS)
        dash = 6 * SS
        for x in range(int(x0), int(x1), dash * 2): dtk.line([(x, y0 + 2), (min(x + dash, x1), y0 + 2)], fill=150, width=SS); dtk.line([(x, y1 - 3), (min(x + dash, x1), y1 - 3)], fill=150, width=SS)
        for y in range(int(y0), int(y1), dash * 2): dtk.line([(x0 + 2, y), (x0 + 2, min(y + dash, y1))], fill=150, width=SS); dtk.line([(x1 - 3, y), (x1 - 3, min(y + dash, y1))], fill=150, width=SS)
    hz_trk = Image.new('L', (W, H), 0); dht = ImageDraw.Draw(hz_trk)       # Rocks from Space: asteroid drift tracks (dotted)
    hz_lane = Image.new('L', (W, H), 0); dhl = ImageDraw.Draw(hz_lane)     # hail lane borders (dashed) + corner brackets
    hz_brk = Image.new('L', (W, H), 0); dhb = ImageDraw.Draw(hz_brk)
    for rk in lv.get('rocks', []):
        if not rk.get('range'): continue
        x0, y0 = m + rk['i'] * S + S / 2, m + rk['j'] * S + S / 2
        x1, y1 = (x0 + rk['range'] * S, y0) if rk.get('axis', 'x') == 'x' else (x0, y0 + rk['range'] * S)
        n_ = max(2, int(math.hypot(x1 - x0, y1 - y0) / (9 * SS)))
        for q in range(n_ + 1):
            u = q / n_; px, py = x0 + (x1 - x0) * u, y0 + (y1 - y0) * u
            dht.ellipse([px - 1.6 * SS, py - 1.6 * SS, px + 1.6 * SS, py + 1.6 * SS], fill=255)
        for (px, py) in ((x0, y0), (x1, y1)): dht.ellipse([px - 4 * SS, py - 4 * SS, px + 4 * SS, py + 4 * SS], outline=255, width=SS)
    for hl in lv.get('hail', []):
        x0, y0 = m + hl['i'] * S, m + hl['j'] * S; x1, y1 = x0 + hl['w'] * S, y0 + hl['h'] * S
        dash = 7 * SS
        for x in range(int(x0), int(x1), dash * 2): dhl.line([(x, y0), (min(x + dash, x1), y0)], fill=255, width=SS); dhl.line([(x, y1), (min(x + dash, x1), y1)], fill=255, width=SS)
        for y in range(int(y0), int(y1), dash * 2): dhl.line([(x0, y), (x0, min(y + dash, y1))], fill=255, width=SS); dhl.line([(x1, y), (x1, min(y + dash, y1))], fill=255, width=SS)
        L_ = 12 * SS
        for (cx_, cy_, sx_, sy_) in ((x0, y0, 1, 1), (x1, y0, -1, 1), (x0, y1, 1, -1), (x1, y1, -1, -1)):
            dhb.line([(cx_, cy_), (cx_ + sx_ * L_, cy_)], fill=255, width=2 * SS); dhb.line([(cx_, cy_), (cx_, cy_ + sy_ * L_)], fill=255, width=2 * SS)
    hid = Image.new('L', (W, H), 0); dhd = ImageDraw.Draw(hid)        # Song of Rainbows: dotted outline of rainbows hidden until rain
    for b in lv.get('bows', []):
        if b.get('cloud', -1) < 0: continue
        cx_, cy_ = m + b['i'] * S + S / 2, m + b['j'] * S + S / 2; R_ = b['r'] * S
        t0_, t1_ = math.radians(b['a0']), math.radians(b['a1']); n_ = max(4, int(abs(t1_ - t0_) * R_ / (11 * SS)))
        for q in range(n_ + 1):
            t_ = t0_ + (t1_ - t0_) * q / n_; px, py = cx_ + R_ * math.cos(t_), cy_ + R_ * math.sin(t_)
            dhd.ellipse([px - 2.4 * SS, py - 2.4 * SS, px + 2.4 * SS, py + 2.4 * SS], fill=255)
    sm = arr(solid.filter(ImageFilter.GaussianBlur(5)))      # rounded corners
    sm = (sm > 0.5).astype(np.float32)
    inner = minf(sm, 13)
    line = np.clip(sm - inner, 0, 1)                         # ~3 world px neon tube on every wall face
    line = blur(line, 0.8)
    # colour zones: cyan walls, magenta pads, violet ramps
    padz = blur(maxf(arr(pad), 9), 3); rampz = blur(maxf(arr(ramp), 9), 3)
    col = CYAN[None, None, :] * (1 - padz[..., None]) + MAGENTA[None, None, :] * padz[..., None]
    col = col * (1 - rampz[..., None]) + VIOLET[None, None, :] * rampz[..., None]
    mirz = blur(maxf(arr(mir), 9), 3)
    if dark: col = col * (1 - (1 - padz - rampz).clip(0, 1)[..., None]) + AZURE[None, None, :] * (1 - padz - rampz).clip(0, 1)[..., None]
    if theme == 'sun':      # Solar Winds: sunrise neon - sky-cyan / turquoise up top, coral and amber lower down
        yy_, xx_ = np.mgrid[0:H, 0:W]; t = np.clip(0.75 * yy_ / H + 0.25 * xx_ / W, 0, 1)[..., None]
        stops = [SKYC, TURQ, CORAL, AMBER]; seg = np.clip(t * 3, 0, 2.999); k0 = np.floor(seg).astype(int); fr = seg - k0
        base = np.zeros((H, W, 3)); st_ = np.array(stops, dtype=np.float32)
        base = st_[k0[..., 0]] * (1 - fr) + st_[np.minimum(k0[..., 0] + 1, 3)] * fr
        nz = (1 - padz - rampz).clip(0, 1)[..., None]
        col = col * (1 - nz) + base * nz
        cz = blur(maxf(arr(crv), 9), 3) * blur(crv_w, 2)
        ccol = GOLD[None, None, :] * (1 - crv_t[..., None]) + ROSEM[None, None, :] * crv_t[..., None]
        col = col * (1 - cz[..., None]) + ccol * cz[..., None]
    if theme == 'void':     # Rocks from Space: stark icy white-cyan / brilliant silver walls; curves sear amber -> crimson
        yy_, xx_ = np.mgrid[0:H, 0:W]; t = np.clip(0.5 + 0.5 * np.sin(yy_ / H * 3.1 + xx_ / W * 2.3), 0, 1)[..., None]
        base = np.array([215, 240, 255])[None, None, :] * (1 - t) + np.array([170, 225, 255])[None, None, :] * t
        nz = (1 - padz - rampz).clip(0, 1)[..., None]
        col = col * (1 - nz) + base * nz
        cz = blur(maxf(arr(crv), 9), 3) * blur(crv_w, 2)
        ccol = np.array([255, 190, 70])[None, None, :] * (1 - crv_t[..., None]) + np.array([255, 60, 70])[None, None, :] * crv_t[..., None]
        col = col * (1 - cz[..., None]) + ccol * cz[..., None]
    if theme == 'rainbow':  # Song of Rainbows: candy rainbow tubes - the hue drifts across the level
        yy_, xx_ = np.mgrid[0:H, 0:W]; hue = (0.62 * xx_ / W + 0.38 * yy_ / H) * 1.6 % 1.0
        hsv = np.dstack([hue, np.full_like(hue, 0.88), np.full_like(hue, 0.95)])
        base = np.array(Image.fromarray((hsv * 255).astype(np.uint8), 'HSV').convert('RGB')).astype(np.float32)
        nz = (1 - padz - rampz).clip(0, 1)[..., None]
        col = col * (1 - nz) + base * nz
    col = col * (1 - mirz[..., None]) + SILVER[None, None, :] * mirz[..., None]
    col = col / 255.0
    g1 = blur(line, 8); g2 = blur(line, 22); g3 = blur(line, 52)
    outside = 1 - sm
    # wall interior: deep dark with faint diagonal hatching + inner glow from its edges
    yy, xx = np.mgrid[0:H, 0:W]
    hatch = ((xx + yy) % 22 < 2).astype(np.float32) * 0.05
    interior_rgb = np.array([0.19, 0.08, 0.23] if theme == 'sun' else [0.012, 0.016, 0.03] if theme == 'void' else [0.98, 0.95, 1.0] if theme == 'rainbow' else [0.025, 0.035, 0.09])[None, None, :] + col * (hatch[..., None] + 0.55 * blur(line, 10)[..., None])
    if theme == 'rainbow':  # soft cloud-white walls with faint candy stripes and a pastel inner glow from the rim
        stripe = (((xx + yy) % (34 * SS)) < 11 * SS).astype(np.float32) * 0.22
        past = col * 0.42 + 0.58      # pastel candy body in the local rainbow hue
        interior_rgb = past * (1 - stripe[..., None]) + np.array([1.0, 1.0, 1.0])[None, None, :] * stripe[..., None]
        ig = blur(line, 9)[..., None] * 0.6
        interior_rgb = interior_rgb * (1 - ig) + (col * 0.55 + 0.45) * ig
    padin = arr(pad) * ((((xx // 2) + (yy // 2)) % 16) < 7)        # energised stripes inside pad tiles
    interior_rgb = interior_rgb + (MAGENTA / 255.0)[None, None, :] * (padin * 0.28 + arr(pad) * 0.10)[..., None]
    sheen = arr(mir) * ((((xx - yy) % 40) < 9).astype(np.float32) * 0.35 + 0.18)        # mirror blocks: polished diagonal sheen
    interior_rgb = interior_rgb + (SILVER / 255.0)[None, None, :] * sheen[..., None]
    rgb = interior_rgb * sm[..., None]
    alpha = sm.copy() * (0.9 if theme == 'sun' else 1.0)
    # glow spilling into the open area (straight alpha)
    gl = np.clip(0.85 * g1 + 0.55 * g2 + 0.4 * g3, 0, 1) * outside
    if theme == 'sun': gl = np.clip(0.75 * g1 + 0.25 * g2, 0, 1) * outside * 0.8     # bright sky behind: keep the spill tight (no flat panels)
    if theme == 'void': gl = np.clip(0.8 * g1 + 0.06 * g2, 0, 1) * outside * 0.7   # deep space: crisp tube, short halo, the void stays black
    if theme == 'rainbow': gl = np.clip(0.9 * g1 + 0.25 * g2, 0, 1) * outside * 0.6   # bright sky: soft candy halo
    rgb = rgb + col * gl[..., None]
    alpha = alpha + gl
    # bright tube with white-hot core
    core = np.clip(minf(line, 5) * 1.2, 0, 1)        # thin white-hot centre of the tube
    wc = ((0.8 if theme == 'void' else 0.12 if theme == 'rainbow' else 0.55) - 0.35 * padz)[..., None] * core[..., None]
    tube = col * (1 - wc) + wc
    rgb = rgb * (1 - line[..., None]) + tube * line[..., None]
    alpha = np.maximum(alpha, line)
    # fade the solid area outside the map bounds so the level floats on the background
    dx = np.maximum(np.maximum(m - xx, xx - (W - m)), 0); dy = np.maximum(np.maximum(m - yy, yy - (H - m)), 0)
    fade = np.clip(1 - np.hypot(dx, dy) / (m * 0.9), 0, 1) ** 1.5
    alpha = alpha * fade
    # thin diagonal mirrors (not solid): bright silver line + glow
    dl = arr(dml); dlg = np.clip(blur(dl, 6) * 0.8 + blur(dl, 18) * 0.5, 0, 1)
    rgb = rgb * (1 - dlg[..., None]) + (SILVER / 255.0)[None, None, :] * dlg[..., None]; alpha = np.maximum(alpha, dlg)
    dlc = np.clip(dl * 1.2, 0, 1); rgb = rgb * (1 - dlc[..., None]) + dlc[..., None]; alpha = np.maximum(alpha, dlc)
    # moving-platform tracks (faint mint dashes)
    tk = blur(arr(trk), 1.0) * 0.45; tkg = blur(arr(trk), 8) * 0.25; tt = np.clip(tk + tkg, 0, 1) * (1 - sm)
    rgb = rgb * (1 - tt[..., None]) + (MINT / 255.0)[None, None, :] * tt[..., None]; alpha = np.maximum(alpha, tt)
    if theme in ('sun', 'void'):   # curve rims: extra-bright gold->magenta (void: amber->crimson) tube, plus faint golden riding lanes
        cl_ = blur(arr(crv), 1.0); clg = np.clip(blur(arr(crv), 6) * 0.9 + blur(arr(crv), 16) * 0.5, 0, 1) * (1 - sm * 0.5)
        c0_, c1_ = (GOLD, ROSEM) if theme == 'sun' else (np.array([255, 190, 70]), np.array([255, 60, 70]))
        ccol = (c0_[None, None, :] * (1 - crv_t[..., None]) + c1_[None, None, :] * crv_t[..., None]) / 255.0
        rgb = rgb * (1 - clg[..., None]) + ccol * clg[..., None]; alpha = np.maximum(alpha, clg)
        rgb = rgb * (1 - cl_[..., None]) + (ccol * 0.4 + 0.6) * cl_[..., None]; alpha = np.maximum(alpha, cl_)
        ln_ = np.clip(blur(arr(lanes), 0.8) * 0.7 + blur(arr(lanes), 5) * 0.4, 0, 1) * (1 - sm)
        rgb = rgb * (1 - ln_[..., None]) + (GOLD / 255.0)[None, None, :] * ln_[..., None]; alpha = np.maximum(alpha, ln_)
    if theme == 'void':   # hazard markings: silver dotted asteroid tracks, crimson dashed hail lanes with amber corner brackets
        ht = np.clip(blur(arr(hz_trk), 0.7) * 0.55 + blur(arr(hz_trk), 5) * 0.25, 0, 1) * (1 - sm)
        rgb = rgb * (1 - ht[..., None]) + (np.array([200, 215, 240]) / 255.0)[None, None, :] * ht[..., None]; alpha = np.maximum(alpha, ht)
        hl_ = np.clip(blur(arr(hz_lane), 0.7) * 0.5 + blur(arr(hz_lane), 5) * 0.25, 0, 1) * (1 - sm)
        rgb = rgb * (1 - hl_[..., None]) + (np.array([255, 70, 80]) / 255.0)[None, None, :] * hl_[..., None]; alpha = np.maximum(alpha, hl_)
        hb = np.clip(blur(arr(hz_brk), 0.8) * 0.95 + blur(arr(hz_brk), 6) * 0.5, 0, 1) * (1 - sm)
        rgb = rgb * (1 - hb[..., None]) + (np.array([255, 185, 90]) / 255.0)[None, None, :] * hb[..., None]; alpha = np.maximum(alpha, hb)
    if theme == 'rainbow':   # hidden rainbows: dotted white ghost of the arc (it appears for real after the rain)
        hd = np.clip(blur(arr(hid), 0.8) * 0.85 + blur(arr(hid), 4) * 0.35, 0, 1) * (1 - sm)
        rgb = rgb * (1 - hd[..., None]) + np.array([1.0, 1.0, 1.0])[None, None, :] * hd[..., None]; alpha = np.maximum(alpha, hd * 0.8)
    a = np.clip(alpha, 1e-4, 1)
    save_rgba(rgb / a[..., None] * np.minimum(alpha, 1)[..., None] / a[..., None] if False else np.clip(rgb / a[..., None], 0, 1), alpha, f'level_{n + 1}.png')
    return (W // SS, H // SS)

ONLY = os.environ.get('PP_ONLY')      # PP_ONLY=17,18 regenerates just those level images (fast iteration)
sizes = []
for n, lv in enumerate(LEVELS):
    if ONLY and str(n + 1) not in ONLY.split(','):
        im = Image.open(os.path.join(OUT, f'level_{n + 1}.png')); sizes.append((im.width // SS, im.height // SS)); continue
    sizes.append(level_art(n, lv, DARK[n], THEME[n]))

# ------------------------------------------------------------------ background
def bg_tile():
    s = 192; im = Image.new('RGBA', (s, s), (4, 6, 18, 255)); d = ImageDraw.Draw(im)
    for k in range(0, s, T):
        d.line([(k, 0), (k, s)], fill=(12, 22, 52, 255)); d.line([(0, k), (s, k)], fill=(12, 22, 52, 255))
    for x in range(0, s, T):
        for y in range(0, s, T): d.rectangle([x - 1, y - 1, x + 1, y + 1], fill=(26, 48, 100, 255))
    rnd = random.Random(3)
    for _ in range(18):
        x, y = rnd.randrange(s), rnd.randrange(s); b = rnd.randint(40, 110); d.point((x, y), fill=(b, b + 20, min(255, b + 60), 255))
    im.save(os.path.join(OUT, 'bg_tile.png'))
bg_tile()
def nebula():
    s = 512; acc = np.zeros((s, s, 3)); rnd = random.Random(7)
    for c, k in ((np.array([40, 30, 120]), 5), (np.array([10, 60, 120]), 4), (np.array([90, 20, 100]), 3)):
        for _ in range(k):
            cx, cy, r = rnd.uniform(80, 432), rnd.uniform(80, 432), rnd.uniform(60, 160)
            g = np.exp(-(radial(s) * 0 + np.hypot(*np.meshgrid(np.arange(s) - cx, np.arange(s) - cy))) ** 2 / (2 * r * r))
            acc += g[..., None] * c / 255.0 * 0.5
    edge = np.clip(1 - radial(s) / (s / 2), 0, 1) ** 1.5
    inten = np.clip(acc.max(axis=2), 0, 1) * edge
    save_rgba(acc / np.maximum(acc.max(axis=2, keepdims=True), 1e-4), inten * 0.8, 'nebula.png')
nebula()

# ------------------------------------------------------------------ orb (the photon)
s = 64 * SS; r = radial(s)
core = np.clip(1 - (r - 9 * SS) / (3 * SS), 0, 1)                 # white disc
rim = np.exp(-((r - 12 * SS) / (3.5 * SS)) ** 2)
halo = np.exp(-(r / (14 * SS)) ** 2) * 0.9
glow_sprite(np.clip(rim * 0.9 + halo, 0, 1), np.array([120, 240, 255]), 'orb.png', white_core=core)
s = 256 * SS; r = radial(s)
glow_sprite((np.exp(-(r / (40 * SS)) ** 2) * 0.55 + np.exp(-(r / (100 * SS)) ** 2) * 0.25) * np.clip((s / 2 - r) / (s * 0.12), 0, 1), CYAN, 'orb_halo.png')   # windowed: no faint square edge on black space
s = 48 * SS; r = radial(s)
glow_sprite(np.exp(-(r / (9 * SS)) ** 2), np.array([110, 230, 255]), 'trail.png', white_core=np.exp(-(r / (3.5 * SS)) ** 2) * 0.8)
s = 24 * SS; r = radial(s)
glow_sprite(np.exp(-(r / (3.5 * SS)) ** 2), np.array([160, 245, 255]), 'spark.png', white_core=np.exp(-(r / (1.5 * SS)) ** 2))
s = 32 * SS; r = radial(s)
glow_sprite(np.exp(-(r / (5 * SS)) ** 2) * 0.8, np.array([120, 170, 255]), 'mote.png')
s = 160 * SS; r = radial(s)
glow_sprite(np.exp(-((r - 62 * SS) / (5 * SS)) ** 2) + 0.5 * np.exp(-((r - 58 * SS) / (14 * SS)) ** 2), np.array([140, 240, 255]), 'ring.png')

# ------------------------------------------------------------------ exit portal (lime)
s = 160 * SS; r = radial(s); y, x = np.mgrid[0:s, 0:s]; ang = np.arctan2(y - s / 2, x - s / 2)
dash = (np.sin(ang * 6) > -0.2).astype(np.float32); dash = blur(dash, 2)
ring1 = np.exp(-((r - 30 * SS) / (2.2 * SS)) ** 2) * dash + 0.35 * np.exp(-((r - 30 * SS) / (9 * SS)) ** 2)
glow_sprite(np.clip(ring1, 0, 1), LIME, 'portal_ring.png', white_core=np.exp(-((r - 30 * SS) / (1.0 * SS)) ** 2) * dash * 0.7)
dash2 = blur((np.sin(ang * 3 + 1) > 0.3).astype(np.float32), 2)
ring2 = np.exp(-((r - 21 * SS) / (1.8 * SS)) ** 2) * dash2
glow_sprite(np.clip(ring2, 0, 1), np.array([170, 255, 120]), 'portal_ring2.png')
glow_sprite(np.exp(-(r / (16 * SS)) ** 2) * 0.9 + np.exp(-(r / (50 * SS)) ** 2) * 0.35, LIME, 'portal_core.png', white_core=np.exp(-(r / (5 * SS)) ** 2) * 0.9)

# ------------------------------------------------------------------ shard (gold diamond)
s = 64 * SS; im = Image.new('L', (s, s), 0); d = ImageDraw.Draw(im); c = s / 2; k = 11 * SS
d.polygon([(c, c - k * 1.35), (c + k, c), (c, c + k * 1.35), (c - k, c)], fill=255)
dia = arr(im); edge = np.clip(dia - minf(dia, 5), 0, 1)
inner = arr(Image.new('L', (s, s), 0)); im2 = Image.new('L', (s, s), 0); ImageDraw.Draw(im2).polygon([(c, c - k * 0.6), (c + k * 0.45, c), (c, c + k * 0.6), (c - k * 0.45, c)], fill=255)
glow_sprite(np.clip(dia * 0.45 + edge + blur(edge, 6) * 0.9, 0, 1), GOLD, 'shard.png', white_core=arr(im2) * 0.9 + edge * 0.5)

# ------------------------------------------------------------------ black hole
s = 224 * SS; r = radial(s); y, x = np.mgrid[0:s, 0:s]; ang = np.arctan2(y - s / 2, x - s / 2)
spiral = 0.55 + 0.45 * np.sin(ang * 3 + r / (9 * SS))
bright = 0.6 + 0.4 * np.cos(ang - 0.8)                                  # Doppler-ish brighter side (visible spin)
disk = np.exp(-((r - 30 * SS) / (10 * SS)) ** 2) * spiral * bright + np.exp(-((r - 24 * SS) / (2.5 * SS)) ** 2) * 1.0
t = np.clip((r - 20 * SS) / (30 * SS), 0, 1)[..., None]
colr = (np.array([255, 230, 170]) * (1 - t) + ORANGE * t * 0.6 + np.array([255, 40, 140]) * t * 0.4) / 255.0
save_rgba(colr, np.clip(disk, 0, 1), 'bh_disk.png')
glow_sprite(np.exp(-(r / (60 * SS)) ** 2) * 0.45, np.array([255, 70, 120]), 'bh_glow.png')
s2 = 384 * SS; r2 = radial(s2); y2, x2 = np.mgrid[0:s2, 0:s2]; a2 = np.arctan2(y2 - s2 / 2, x2 - s2 / 2)
arms = np.clip(np.sin(a2 * 2 + np.log(np.maximum(r2, 1) / SS) * 4.2), 0, 1) ** 3
fall = np.exp(-((r2 - 70 * SS) / (55 * SS)) ** 2) * (r2 > 26 * SS)
glow_sprite(blur(np.clip(arms * fall * 0.55, 0, 1), 3 * SS), np.array([255, 90, 150]), 'bh_swirl.png')
rng = 173 * SS; dashr = (np.sin(a2 * 24) > 0).astype(np.float32)
glow_sprite(np.clip(np.exp(-((r2 - rng) / (1.6 * SS)) ** 2) * dashr * 0.35 + np.exp(-((r2 - rng) / (12 * SS)) ** 2) * 0.08, 0, 1), np.array([255, 110, 160]), 'bh_range.png')
s = 96 * SS; r = radial(s)
corea = np.clip(1 - (r - 20 * SS) / (3 * SS), 0, 1)
rimc = np.exp(-((r - 21 * SS) / (1.6 * SS)) ** 2)
rgb = np.zeros((s, s, 3)) + (np.array([255, 200, 140]) / 255.0) * rimc[..., None]
save_rgba(rgb, np.clip(corea + np.clip(1 - (r - 20 * SS) / (16 * SS), 0, 1) * 0.6, 0, 1), 'bh_core.png')   # normal blend: dark void

# ------------------------------------------------------------------ launch pad overlay (additive, pulsing) + chevron
s = 96 * SS; y, x = np.mgrid[0:s, 0:s]; c = s / 2
bar = ((abs(x - c) < 22 * SS) & (abs(y - c) < 2.5 * SS)).astype(np.float32)   # horizontal strip, face pointing up (rotated in-game)
glow_sprite(np.clip(bar * 0.8 + blur(bar, 4 * SS) * 0.8 + blur(bar, 12 * SS) * 0.5, 0, 1), MAGENTA, 'pad_glow.png', white_core=bar * 0.2)
s = 48 * SS; im = Image.new('L', (s, s), 0); d = ImageDraw.Draw(im)
for k, off in enumerate((0, 12 * SS)):
    d.line([(10 * SS, 30 * SS - off), (24 * SS, 18 * SS - off), (38 * SS, 30 * SS - off)], fill=255, width=4 * SS, joint='curve')
chev = arr(im)
glow_sprite(np.clip(chev + blur(chev, 4) * 0.8, 0, 1), np.array([255, 120, 230]), 'pad_chevron.png', white_core=chev * 0.6)

# ------------------------------------------------------------------ UI
glow = Image.new('RGBA', (8, 8), (255, 255, 255, 255)); glow.save(os.path.join(OUT, 'flash.png'))
def neon_text(text, font_path, size, color, name, pad=60, track=0):
    font = ImageFont.truetype(font_path, size)
    tmp = Image.new('L', (10, 10)); dd = ImageDraw.Draw(tmp)
    bb = dd.textbbox((0, 0), text, font=font); w, h = bb[2] - bb[0] + track * len(text), bb[3] - bb[1]
    im = Image.new('L', (w + 2 * pad, h + 2 * pad), 0); d = ImageDraw.Draw(im)
    x = pad - bb[0]
    for ch in text:
        d.text((x, pad - bb[1]), ch, font=font, fill=255); x += d.textlength(ch, font=font) + track
    a = arr(im)
    edge = np.clip(a - minf(a, 3), 0, 1) if False else a
    inten = np.clip(a + blur(a, 6) * 0.9 + blur(a, 22) * 0.6, 0, 1)
    rgb = np.ones(a.shape + (3,)) * (color / 255.0); w_ = np.clip(a * 0.85, 0, 1)[..., None]
    rgb = rgb * (1 - w_) + w_
    return save_rgba(rgb, inten, name)
MONO = '/usr/share/fonts/truetype/sand-box/google/Monoton/Monoton-Regular.ttf'
RAJ = '/usr/share/fonts/truetype/sand-box/google/Rajdhani/Rajdhani-Bold.ttf'
neon_text('PHANTOM', MONO, 150, CYAN, 'title_phantom.png', track=6)
neon_text('PHOTON', MONO, 150, MAGENTA, 'title_photon.png', track=6)
neon_text('LEVEL CLEAR', RAJ, 120, LIME, 'txt_clear.png', track=14)
# restart icon
s = 96 * SS; im = Image.new('L', (s, s), 0); d = ImageDraw.Draw(im); c = s / 2; R = 26 * SS
d.arc([c - R, c - R, c + R, c + R], 40, 330, fill=255, width=6 * SS)
ax, ay = c + R * math.cos(math.radians(40)), c + R * math.sin(math.radians(40))
d.polygon([(ax + 12 * SS, ay - 2 * SS), (ax - 8 * SS, ay - 10 * SS), (ax - 2 * SS, ay + 12 * SS)], fill=255)
ic = arr(im); ringb = np.exp(-((radial(s) - 40 * SS) / (1.5 * SS)) ** 2) * 0.7
glow_sprite(np.clip(ic + blur(ic, 6) * 0.7 + ringb + blur(ringb, 5) * 0.5, 0, 1), CYAN, 'btn_restart.png', white_core=ic * 0.5)
exec(open(os.path.join(HERE, 'gen_art2.py')).read())
exec(open(os.path.join(HERE, 'gen_art3.py')).read())
exec(open(os.path.join(HERE, 'gen_art4.py')).read())
json.dump({'levelArtSize': sizes, 'movers': mover_sizes, 'clouds': cloud_sizes, 'cloudIndex': cloud_index, 'rings': ring_sizes, 'ringIndex': ring_index, 'rockVariants': ROCK_VARIANTS, 'bows': bow_sizes, 'bowIndex': bow_index, 'margin': M, 'tile': T, 'ss': SS}, open(os.path.join(HERE, 'art_meta.json'), 'w'))
print('art ok', sizes)
