"""Assemble frames from make_gif.js into a GIF (2.5x slow motion). python3 make_gif.py <framesDir> <out.gif> [crop x0,y0,x1,y1] [size]"""
import sys, json, glob
from PIL import Image
d, out = sys.argv[1], sys.argv[2]
crop = tuple(map(int, sys.argv[3].split(','))) if len(sys.argv) > 3 else None
size = int(sys.argv[4]) if len(sys.argv) > 4 else 420
times = json.load(open(d + '/times.json')); files = sorted(glob.glob(d + '/f*.png'))
frames, durs = [], []
for k, f in enumerate(files):
    im = Image.open(f).convert('RGB')
    if crop: im = im.crop(crop)
    im = im.resize((size, int(size * im.height / im.width)), Image.LANCZOS)
    frames.append(im.quantize(colors=200, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE))
    dt = (times[k + 1] - times[k]) if k + 1 < len(times) else 300
    durs.append(int(max(30, min(400, dt * 2.5))))
durs[0] = 500; durs[-1] = 900
frames[0].save(out, save_all=True, append_images=frames[1:], duration=durs, loop=0, optimize=True)
print(out, len(frames), 'frames', sum(durs), 'ms')
