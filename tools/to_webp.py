"""shots/*.png ni WebP ga aylantiradi (yoʻriqnoma rasmlari uchun)."""
import glob
import os
from PIL import Image

here = os.path.dirname(os.path.abspath(__file__))
for png in sorted(glob.glob(os.path.join(here, '..', 'shots', '*.png'))):
    out = png[:-4] + '.webp'
    Image.open(png).convert('RGB').save(out, 'WEBP', quality=82, method=6)
    print(os.path.basename(out), os.path.getsize(out) // 1024, 'KB')
