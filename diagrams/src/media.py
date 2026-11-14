import base64
import json
from pathlib import Path

from svg import Svg, MONO, INK, MUTED, LINE, BG, sans_width
from services import arrow, tag, APP, COMPUTE, AZURE, CI

ASSETS = Path(__file__).resolve().parent.parent / "assets"
SKELETON = "#eaeaea"


def data_uri(name, mime):
    return f"data:{mime};base64,{base64.b64encode((ASSETS / name).read_bytes()).decode()}"


def kb(n):
    if n >= 1024 * 1024:
        return f"{n / 1024 / 1024:.1f} MB"
    return f"{n / 1024:.0f} KB" if n >= 1024 else f"{n} B"


def card(s, x, y, w, h, title, color, badge):
    s.add('<g filter="url(#shadow)">')
    s.rect(x, y, w, h, fill=BG, stroke=LINE, rx=10)
    s.add('</g>')
    cid = f"card{int(x)}"
    s.add(f'<clipPath id="{cid}"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10"/></clipPath>')
    s.rect(x, y, 5, h, fill=color, extra=f'clip-path="url(#{cid})"')
    s.text(x + w / 2, y + 24, title, size=13.5, weight="700", anchor="middle")
    bw = sans_width(badge, 10, True) + 12
    s.rect(x + w - bw - 8, y - 9, bw, 18, fill=color, rx=9)
    s.text(x + w - bw / 2 - 8, y, badge, size=10, weight="700", fill="#fff", anchor="middle")


APP_CARD, APP_RADIUS = 350, 28
BORDER = "#e2e2e2"


def picture(s, x, y, size, uri):
    r = APP_RADIUS * size / APP_CARD
    s.add(f'<clipPath id="pic{int(x)}"><rect x="{x}" y="{y}" width="{size}" height="{size}" rx="{r:.1f}"/></clipPath>')
    s.add(f'<image x="{x}" y="{y}" width="{size}" height="{size}" href="{uri}" preserveAspectRatio="xMidYMid slice" clip-path="url(#pic{int(x)})"/>')
    s.rect(x, y, size, size, stroke=BORDER, sw=1, rx=f"{r:.1f}")


def original(s, x, y, size, uri, w, h):
    sc = size / max(w, h)
    iw, ih = w * sc, h * sc
    ix, iy = x + (size - iw) / 2, y + (size - ih) / 2
    s.add(f'<clipPath id="orig"><rect x="{ix:.1f}" y="{iy:.1f}" width="{iw:.1f}" height="{ih:.1f}" rx="6"/></clipPath>')
    s.add(f'<image x="{ix:.1f}" y="{iy:.1f}" width="{iw:.1f}" height="{ih:.1f}" href="{uri}" preserveAspectRatio="xMidYMid slice" clip-path="url(#orig)"/>')
    s.rect(ix, iy, iw, ih, stroke=BORDER, sw=1, rx=6)


def skeleton(s, x, y, size):
    r = APP_RADIUS * size / APP_CARD
    s.add(f'<rect class="pulse" x="{x}" y="{y}" width="{size}" height="{size}" rx="{r:.1f}" fill="{SKELETON}" stroke="{BORDER}" stroke-width="1"/>')


def build():
    st = json.loads((ASSETS / "media.json").read_text())
    s = Svg()
    colors = [APP, COMPUTE, AZURE, CI, INK]
    s.add('<defs><filter id="shadow" x="-5%" y="-5%" width="110%" height="120%">'
          '<feDropShadow dx="0" dy="1.5" stdDeviation="2.5" flood-color="#0f172a" flood-opacity="0.10"/></filter>'
          + "".join(f'<marker id="a-{c[1:]}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7.5" markerHeight="7.5" '
                    f'orient="auto-start-reverse"><path d="M 0 0.5 L 10 5 L 0 9.5 z" fill="{c}"/></marker>' for c in colors)
          + '<style>@keyframes p{0%,100%{opacity:1}50%{opacity:.5}}.pulse{animation:p 1.6s ease-in-out infinite}</style>'
          + '</defs>')

    CW, GAP, PIC = 280, 110, 248
    CY, CH = 40, 352
    ox = 48
    xs = [ox + CW + GAP + i * (CW + GAP) for i in range(4)]
    py = CY + 44

    card(s, ox, CY, CW, CH, "Original", CI, kb(st["original_bytes"]))
    original(s, ox + (CW - PIC) / 2, py, PIC, data_uri("media-original.webp", "image/webp"), st["original_w"], st["original_h"])
    for i, ln in enumerate([f"{st['original_w']} × {st['original_h']} px · {st['original_format'].upper()}", "kept in uploads, never sent to the app"]):
        s.text(ox + CW / 2, py + PIC + 22 + i * 16, ln, size=11.5, fill=MUTED, anchor="middle")
    dx = ox + CW + GAP / 2
    s.line(dx, CY + 10, dx, CY + CH - 10, LINE, sw=1.5, dash="6 5")

    stages = [
        ("Skeleton", APP, "0 B", ["shown while the posts load", "`#EAEAEA · pulse 800 ms`"]),
        ("ThumbHash", COMPUTE, f"{st['thumbhash_bytes']} B", ["decoded on the device", f"`{st['thumbhash_base64'][:22]}…`"]),
        ("Thumbnail", AZURE, kb(st["thumb_bytes"]), [f"{st['thumb_px']} px WebP · quality 80"]),
        ("Full image", AZURE, kb(st["full_bytes"]), [f"{st['full_px']} px WebP · quality 80"]),
    ]
    for x, (title, color, badge, lines) in zip(xs, stages):
        card(s, x, CY, CW, CH, title, color, badge)
        for i, ln in enumerate(lines):
            mono = ln.startswith("`")
            s.text(x + CW / 2, py + PIC + 22 + i * 16, ln.strip("`"), size=11 if mono else 11.5,
                   fill=MUTED, anchor="middle", family=MONO if mono else "Inter, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif")

    px0 = [x + (CW - PIC) / 2 for x in xs]
    skeleton(s, px0[0], py, PIC)
    picture(s, px0[1], py, PIC, data_uri("media-thumbhash.png", "image/png"))
    picture(s, px0[2], py, PIC, data_uri("media-thumb.webp", "image/webp"))
    picture(s, px0[3], py, PIC, data_uri("media-full.webp", "image/webp"))

    ay = py + PIC / 2
    for i, label in enumerate(["post JSON\narrives", "thumbnail\ndownloaded", "post\nopened"]):
        x0, x1 = xs[i] + CW, xs[i + 1]
        arrow(s, [(x0 + 4, ay), (x1 - 4, ay)], INK)
        tag(s, (x0 + x1) / 2, ay - 28, label, INK)

    return s.render(xs[3] + CW + 48, CY + CH + 40, "Fotolo media loading")


if __name__ == "__main__":
    import sys
    open(sys.argv[1], "w", encoding="utf-8").write(build())
