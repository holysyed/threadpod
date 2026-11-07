"""Generate the original 512px threadPod display texture. Requires Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT = Path(__file__).resolve().parents[1]
out = ROOT / 'textures'
out.mkdir(parents=True, exist_ok=True)
im = Image.new('RGB', (512, 384), '#e7eff0')
d = ImageDraw.Draw(im)
def font(size):
    return ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', size)
d.rectangle((0, 0, 512, 49), fill='#cfdbdf')
d.text((20, 6), 'threadPod', font=font(27), fill='#1c3444')
d.rounded_rectangle((444, 17, 486, 34), radius=3, outline='#304b56', width=2)
d.rectangle((488, 22, 492, 29), fill='#304b56')
d.rectangle((448, 21, 477, 30), fill='#417782')
d.text((22, 64), 'Now Playing', font=font(21), fill='#49606c')
# Original geometric album artwork.
d.rounded_rectangle((22, 107, 172, 257), radius=8, fill='#1d4355')
for i, c in enumerate(['#326679', '#4d8998', '#83b3b5', '#d2d4b4']):
    d.ellipse((43+i*12, 126+i*12, 151-i*6, 234-i*6), fill=c)
d.text((196, 125), 'Quiet Hours', font=font(29), fill='#193744')
d.text((198, 170), 'threadPod sessions', font=font(20), fill='#4b6670')
d.text((198, 204), 'Vol. 01 / Ambient', font=font(19), fill='#597581')
d.rounded_rectangle((24, 292, 488, 299), radius=3, fill='#b9cbd0')
d.rounded_rectangle((24, 292, 211, 299), radius=3, fill='#34768b')
d.text((24, 313), '1:42', font=font(19), fill='#45616d')
d.text((438, 313), '4:18', font=font(19), fill='#45616d')
d.polygon([(246, 338), (246, 361), (265, 350)], fill='#34768b')
target = out / 'screen.png'
if target.exists():
    from datetime import datetime
    target.rename(target.with_name('screen.backup-' + datetime.now().strftime('%Y%m%d-%H%M%S') + '.png'))
im.save(target)
print(target)
