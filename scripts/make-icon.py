from PIL import Image, ImageDraw, ImageFont
import os, sys
root = sys.argv[1]
S = 512
img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
bg = Image.new('RGBA', (S, S))
d = ImageDraw.Draw(bg)
for y in range(S):
    t = y / S
    d.line([(0, y), (S, y)], fill=(int(91 + (40 - 91) * t), int(124 + (48 - 124) * t), int(240 + (110 - 240) * t), 255))
mask = Image.new('L', (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=110, fill=255)
img.paste(bg, (0, 0), mask)
d = ImageDraw.Draw(img)
# speech bubble
d.rounded_rectangle([70, 110, 442, 360], radius=60, fill=(255, 255, 255, 255))
d.polygon([(150, 350), (130, 430), (230, 355)], fill=(255, 255, 255, 255))
font = ImageFont.truetype('/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', 150)
txt = '용어'
w = d.textlength(txt, font=font)
d.text(((S - w) / 2, 150), txt, font=font, fill=(46, 58, 140, 255))
for name, px in [('mdpi', 48), ('hdpi', 72), ('xhdpi', 96), ('xxhdpi', 144), ('xxxhdpi', 192)]:
    p = os.path.join(root, f'mipmap-{name}')
    os.makedirs(p, exist_ok=True)
    img.resize((px, px), Image.LANCZOS).save(os.path.join(p, 'ic_launcher.png'))
img.save(os.path.join(root, '..', 'icon-512.png'))
