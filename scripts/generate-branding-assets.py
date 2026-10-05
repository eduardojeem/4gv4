"""
Script para generar los assets de marca oficiales de MiTiendaPy.com:
1. Logo claro horizontal (para fondos claros: navbar, emails, facturación, reportes).
2. Logo oscuro horizontal (para fondos oscuros: login, navbar dark, POS dark).
3. Isotipo / Favicon cuadrado (64x64, 192x192, 512x512, favicon.ico y SVG).
"""

import math
import os
from PIL import Image

def process_branding():
    input_path = r'C:/Users/EDU/.gemini/antigravity/brain/1899e2c1-2ea9-4a9d-bf06-d970f549cc4e/.user_uploaded/media_1791168486859.png'
    out_dir = r'f:/4g/4gv4/public/branding'
    icons_dir = r'f:/4g/4gv4/public/icons'
    os.makedirs(out_dir, exist_ok=True)
    os.makedirs(icons_dir, exist_ok=True)

    img = Image.open(input_path).convert('RGB')
    w, h = img.size

    # Background model for clean alpha unmixing
    def get_bg(x, y):
        dx = (x - 512) / 380.0
        dy = (y - 240) / 280.0
        d2 = dx*dx + dy*dy
        glow = math.exp(-d2 * 0.8)
        r = 0.5 * glow
        g = 3.0 + 23.0 * glow
        b = 8.0 + 46.0 * glow
        return r, g, b

    # 1. Clean extraction of artwork
    extracted = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    for y in range(h):
        for x in range(w):
            r, g, b = img.getpixel((x, y))
            bgr, bgg, bgb = get_bg(x, y)
            dr = max(0.0, r - bgr)
            dg = max(0.0, g - bgg)
            db = max(0.0, b - bgb)
            diff = max(dr, dg, db)
            if diff < 12.0:
                extracted.putpixel((x, y), (0, 0, 0, 0))
            elif diff < 48.0:
                t = (diff - 12.0) / 36.0
                alpha = int(t * 255.0)
                a_norm = max(t, 0.05)
                fr = min(255, max(0, int(bgr + dr / a_norm)))
                fg = min(255, max(0, int(bgg + dg / a_norm)))
                fb = min(255, max(0, int(bgb + db / a_norm)))
                extracted.putpixel((x, y), (fr, fg, fb, alpha))
            else:
                alpha = 255
                fr = min(255, max(0, int(r - bgr * 0.12)))
                fg = min(255, max(0, int(g - bgg * 0.12)))
                fb = min(255, max(0, int(b - bgb * 0.12)))
                extracted.putpixel((x, y), (fr, fg, fb, alpha))

    # 2. Crop Isotipo (Shopping cart icon)
    # Icon bbox: (271, 0, 777, 368) -> width 506, height 368
    icon_raw = extracted.crop((271, 0, 777, 368))

    # De-fringe icon: normalize edges to remove dark halo
    icon_clean = Image.new('RGBA', icon_raw.size, (0, 0, 0, 0))
    iw, ih = icon_raw.size
    for y in range(ih):
        for x in range(iw):
            r, g, b, a = icon_raw.getpixel((x, y))
            if a > 0:
                # Interpolate canonical gradient from left (cyan) to right (azure)
                t = min(1.0, max(0.0, x / float(iw)))
                # Gradient: cyan (0, 206, 241) to azure (0, 142, 241)
                can_r = int(0 * (1 - t) + 0 * t)
                can_g = int(206 * (1 - t) + 142 * t)
                can_b = int(241 * (1 - t) + 241 * t)

                # Blend with actual pixel to preserve subtle highlights while eliminating black bleed
                blend = a / 255.0
                fr = int(r * blend + can_r * (1 - blend))
                fg = int(g * blend + can_g * (1 - blend))
                fb = int(b * blend + can_b * (1 - blend))
                icon_clean.putpixel((x, y), (fr, fg, fb, a))

    # 3. Crop Logotipo Text ("MiTiendaPy.com")
    # Text bbox: (166, 368, 865, 466) -> width 699, height 98
    text_raw = extracted.crop((166, 368, 865, 466))
    tw, th = text_raw.size

    # 3a. Dark mode text (white "MiTienda" + gradient "Py.com")
    text_dark = Image.new('RGBA', (tw, th), (0, 0, 0, 0))
    for y in range(th):
        for x in range(tw):
            r, g, b, a = text_raw.getpixel((x, y))
            if a > 0:
                if x < 518:
                    # "MiTienda" in pure white with clean alpha
                    text_dark.putpixel((x, y), (255, 255, 255, a))
                else:
                    # "Py.com" in vibrant cyan-azure gradient
                    t = min(1.0, max(0.0, (x - 518) / float(tw - 518)))
                    can_g = int(210 * (1 - t) + 150 * t)
                    can_b = 255
                    blend = a / 255.0
                    fg = int(g * blend + can_g * (1 - blend))
                    fb = int(b * blend + can_b * (1 - blend))
                    text_dark.putpixel((x, y), (0, fg, fb, a))

    # 3b. Light mode text (slate-900 "#0F172A" "MiTienda" + vibrant "Py.com")
    text_light = Image.new('RGBA', (tw, th), (0, 0, 0, 0))
    for y in range(th):
        for x in range(tw):
            r, g, b, a = text_raw.getpixel((x, y))
            if a > 0:
                if x < 518:
                    # "MiTienda" in slate-900 (15, 23, 42)
                    text_light.putpixel((x, y), (15, 23, 42, a))
                else:
                    # "Py.com" in high-contrast cyan-blue for white backgrounds
                    t = min(1.0, max(0.0, (x - 518) / float(tw - 518)))
                    # Gradient from #00A3FF (0, 163, 255) to #0066FF (0, 102, 255)
                    cg = int(163 * (1 - t) + 102 * t)
                    cb = 255
                    text_light.putpixel((x, y), (0, cg, cb, a))

    # 4. Compose Horizontal Logos (Target 200x50, generated at high-res 800x200 and 400x100)
    # At 800x200:
    # Target height = 200
    # Icon scaled height = 152px, width = 152 * (506/368) = 209px
    # Text scaled height = 82px, width = 82 * (699/98) = 584px
    # Total width = 209 + 20(gap) + 584 = 813px
    # To fit exactly into standard 800x200 (4:1):
    # Scale factor: total width 760px, padding 20px on left/right
    canvas_w, canvas_h = 800, 200
    target_icon_h = 144
    target_icon_w = int(target_icon_h * (iw / float(ih))) # ~198px
    icon_resized = icon_clean.resize((target_icon_w, target_icon_h), Image.Resampling.LANCZOS)

    target_text_h = 76
    target_text_w = int(target_text_h * (tw / float(th))) # ~542px
    gap = 20
    total_content_w = target_icon_w + gap + target_text_w # ~760px
    start_x = (canvas_w - total_content_w) // 2

    # Vertical centering
    icon_y = (canvas_h - target_icon_h) // 2
    # Vertically align text center with cart basket center (slightly below handle)
    text_y = (canvas_h - target_text_h) // 2 + 6

    # 4a. Dark Horizontal @4x (800x200)
    dark_800 = Image.new('RGBA', (canvas_w, canvas_h), (0, 0, 0, 0))
    text_dark_resized = text_dark.resize((target_text_w, target_text_h), Image.Resampling.LANCZOS)
    dark_800.paste(icon_resized, (start_x, icon_y), icon_resized)
    dark_800.paste(text_dark_resized, (start_x + target_icon_w + gap, text_y), text_dark_resized)

    # 4b. Light Horizontal @4x (800x200)
    light_800 = Image.new('RGBA', (canvas_w, canvas_h), (0, 0, 0, 0))
    text_light_resized = text_light.resize((target_text_w, target_text_h), Image.Resampling.LANCZOS)
    light_800.paste(icon_resized, (start_x, icon_y), icon_resized)
    light_800.paste(text_light_resized, (start_x + target_icon_w + gap, text_y), text_light_resized)

    # Export @4x (800x200)
    dark_800.save(os.path.join(out_dir, 'mitiendapy-horizontal-dark@4x.png'), 'PNG')
    light_800.save(os.path.join(out_dir, 'mitiendapy-horizontal-light@4x.png'), 'PNG')

    # Export @2x (400x100)
    dark_400 = dark_800.resize((400, 100), Image.Resampling.LANCZOS)
    light_400 = light_800.resize((400, 100), Image.Resampling.LANCZOS)
    dark_400.save(os.path.join(out_dir, 'mitiendapy-horizontal-dark.png'), 'PNG')
    light_400.save(os.path.join(out_dir, 'mitiendapy-horizontal-light.png'), 'PNG')

    # Export @1x (200x50 exact as requested)
    dark_200 = dark_800.resize((200, 50), Image.Resampling.LANCZOS)
    light_200 = light_800.resize((200, 50), Image.Resampling.LANCZOS)
    dark_200.save(os.path.join(out_dir, 'mitiendapy-horizontal-dark@1x.png'), 'PNG')
    light_200.save(os.path.join(out_dir, 'mitiendapy-horizontal-light@1x.png'), 'PNG')

    # 5. Isotipo / Favicon cuadrado
    # Center icon in square canvas
    def make_square_icon(size, bg_color=None):
        sq = Image.new('RGBA', (size, size), bg_color or (0, 0, 0, 0))
        # Keep 12% padding on all sides for optimal optical centering
        pad = int(size * 0.10)
        usable = size - 2 * pad
        # Icon aspect ratio
        aspect = iw / float(ih)
        if aspect > 1.0:
            target_w = usable
            target_h = int(usable / aspect)
        else:
            target_h = usable
            target_w = int(usable * aspect)

        icon_sq = icon_clean.resize((target_w, target_h), Image.Resampling.LANCZOS)
        pos_x = (size - target_w) // 2
        pos_y = (size - target_h) // 2
        sq.paste(icon_sq, (pos_x, pos_y), icon_sq)
        return sq

    # 64x64px Favicon / Isotipo
    icon_64 = make_square_icon(64)
    icon_64.save(os.path.join(out_dir, 'mitiendapy-icon-64.png'), 'PNG')

    # 128x128px
    icon_128 = make_square_icon(128)
    icon_128.save(os.path.join(out_dir, 'mitiendapy-icon-128.png'), 'PNG')

    # 192x192px Standard PWA
    icon_192 = make_square_icon(192)
    icon_192.save(os.path.join(out_dir, 'mitiendapy-icon-192.png'), 'PNG')
    icon_192.save(os.path.join(icons_dir, 'icon-192x192.png'), 'PNG')

    # 256x256px
    icon_256 = make_square_icon(256)
    icon_256.save(os.path.join(out_dir, 'mitiendapy-icon-256.png'), 'PNG')

    # 512x512px High-Res PWA
    icon_512 = make_square_icon(512)
    icon_512.save(os.path.join(out_dir, 'mitiendapy-icon-512.png'), 'PNG')
    icon_512.save(os.path.join(icons_dir, 'icon-512x512.png'), 'PNG')

    # Apple touch icon (180x180) with modern dark squircle background
    app_icon_180 = make_square_icon(180, bg_color=(3, 11, 23, 255))
    app_icon_180.save(os.path.join(icons_dir, 'apple-touch-icon.png'), 'PNG')

    # Favicon .ico (multi-size: 16x16, 32x32, 48x48, 64x64)
    icon_16 = make_square_icon(16)
    icon_32 = make_square_icon(32)
    icon_48 = make_square_icon(48)
    icon_32.save(
        r'f:/4g/4gv4/public/favicon.ico',
        format='ICO',
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64)],
        append_images=[icon_16, icon_48, icon_64]
    )

    print('Successfully generated all PNG, ICO and branding assets!')

if __name__ == '__main__':
    process_branding()
