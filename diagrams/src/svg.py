from html import escape

MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace"
SANS = "Inter, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"

BG = "#ffffff"
INK = "#0f172a"
MUTED = "#64748b"
FAINT = "#94a3b8"
LINE = "#e2e8f0"
PANEL = "#f8fafc"


def mono_width(text, size):
    return len(text) * size * 0.602


def sans_width(text, size, bold=False):
    return len(text) * size * (0.58 if bold else 0.5)


class Svg:
    def __init__(self):
        self.parts = []

    def add(self, s):
        self.parts.append(s)

    def rect(self, x, y, w, h, fill="none", stroke="none", rx=0, sw=1, dash=None, extra=""):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.add(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{d} {extra}/>')

    def text(self, x, y, s, size=12, fill=INK, family=SANS, weight="normal", anchor="start", italic=False, extra=""):
        st = ' font-style="italic"' if italic else ""
        self.add(f'<text x="{x:.1f}" y="{y:.1f}" font-family="{family}" font-size="{size}" font-weight="{weight}" fill="{fill}" text-anchor="{anchor}" dominant-baseline="central"{st} {extra}>{escape(s)}</text>')

    def line(self, x1, y1, x2, y2, stroke, sw=1.5, dash=None, cap="butt"):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.add(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{stroke}" stroke-width="{sw}" stroke-linecap="{cap}"{d}/>')

    def poly(self, pts, stroke, sw=1.6, dash=None, rounded=6):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.add(f'<path d="{rounded_path(pts, rounded)}" fill="none" stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round"{d}/>')

    def circle(self, cx, cy, r, fill, stroke, sw=1.5):
        self.add(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>')

    def render(self, w, h, title):
        head = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w:.0f}" height="{h:.0f}" viewBox="0 0 {w:.0f} {h:.0f}">'
                f'<title>{escape(title)}</title>'
                f'<rect width="100%" height="100%" fill="{BG}"/>')
        return head + "\n".join(self.parts) + "</svg>\n"


def rounded_path(pts, r):
    if len(pts) < 3 or r == 0:
        return "M " + " L ".join(f"{x:.1f} {y:.1f}" for x, y in pts)
    out = [f"M {pts[0][0]:.1f} {pts[0][1]:.1f}"]
    for i in range(1, len(pts) - 1):
        (x0, y0), (x1, y1), (x2, y2) = pts[i - 1], pts[i], pts[i + 1]
        d1 = max(abs(x1 - x0), abs(y1 - y0))
        d2 = max(abs(x2 - x1), abs(y2 - y1))
        rr = min(r, d1 / 2, d2 / 2)
        ax = x1 - rr * sign(x1 - x0)
        ay = y1 - rr * sign(y1 - y0)
        bx = x1 + rr * sign(x2 - x1)
        by = y1 + rr * sign(y2 - y1)
        out.append(f"L {ax:.1f} {ay:.1f} Q {x1:.1f} {y1:.1f} {bx:.1f} {by:.1f}")
    out.append(f"L {pts[-1][0]:.1f} {pts[-1][1]:.1f}")
    return " ".join(out)


def sign(v):
    return (v > 0) - (v < 0)
