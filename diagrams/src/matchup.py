import random

from svg import Svg, MONO, INK, MUTED, FAINT, LINE, BG, sans_width
from services import arrow, tag, frame, APP, COMPUTE, DATA, CI

A_COLOR = "#6366f1"
B_COLOR = "#f59e0b"
SKIP = APP
EACH_SIDE = 10

W = 1400
N = 60
A_INDEX = 33
NEAR_B = 39
FAR_B = 5


def ladder():
    rng = random.Random(7)
    return sorted(round(rng.gauss(1000, 90)) for _ in range(N))


def defs(s):
    colors = [APP, COMPUTE, DATA, CI, INK, A_COLOR, B_COLOR]
    s.add('<defs><filter id="shadow" x="-5%" y="-5%" width="110%" height="120%">'
          '<feDropShadow dx="0" dy="1.5" stdDeviation="2.5" flood-color="#0f172a" flood-opacity="0.10"/></filter>'
          + "".join(f'<marker id="a-{c[1:]}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7.5" markerHeight="7.5" '
                    f'orient="auto-start-reverse"><path d="M 0 0.5 L 10 5 L 0 9.5 z" fill="{c}"/></marker>' for c in colors)
          + '</defs>')


def heading(s, y, title, sub):
    s.text(48, y, title, size=16, weight="700")
    s.text(48 + sans_width(title, 16, True) + 14, y, sub, size=13, fill=MUTED)


def label(s, x, y, text, color):
    w = sans_width(text, 11, True) + 16
    s.rect(x - w / 2, y - 11, w, 22, fill=color, rx=11)
    s.text(x, y, text, size=11, weight="700", fill="#fff", anchor="middle")


def bracket(s, x0, x1, y, text, color):
    s.poly([(x0, y - 6), (x0, y), (x1, y), (x1, y - 6)], color, sw=1.6, rounded=0)
    s.text((x0 + x1) / 2, y + 16, text, size=11.5, weight="600", fill=color, anchor="middle")


def step_one(s, top):
    heading(s, top, "1 · Vælg opslag A tilfældigt", "hvert opslag får et tilfældigt tal mellem 0 og 1, når det uploades")
    frame(s, 48, top + 26, W - 96, 200, "", INK, fill=BG)

    rng = random.Random(3)
    keys = sorted(round(rng.uniform(0.02, 0.98), 2) for _ in range(22))
    roll, skip, pick = 0.58, 0.63, 0.72
    keys = [k for k in keys if not roll - 0.03 < k < pick + 0.03]

    x0, x1, ly = 120, W - 120, top + 150
    X = lambda k: x0 + k * (x1 - x0)
    s.line(x0, ly, x1, ly, LINE, sw=3, cap="round")
    for k, t in ((0, "0"), (1, "1")):
        s.line(X(k), ly - 8, X(k), ly + 8, FAINT, sw=1.5)
        s.text(X(k), ly + 24, t, size=12, fill=MUTED, anchor="middle", family=MONO)
    for k in keys:
        s.circle(X(k), ly, 6, BG, FAINT, 2)

    s.circle(X(skip), ly, 6, BG, SKIP, 2)
    s.line(X(skip) - 4, ly - 4, X(skip) + 4, ly + 4, SKIP, sw=1.8)
    s.line(X(skip) - 4, ly + 4, X(skip) + 4, ly - 4, SKIP, sw=1.8)
    s.text(X(skip), ly + 30, "dit eget opslag:", size=11, fill=SKIP, anchor="middle", weight="600")
    s.text(X(skip), ly + 45, "springes over", size=11, fill=SKIP, anchor="middle")

    s.circle(X(pick), ly, 10, A_COLOR, A_COLOR, 0)
    s.text(X(pick), ly + 0.5, "A", size=11, weight="700", fill="#fff", anchor="middle")
    s.text(X(pick), ly + 30, "første opslag på", size=11, fill=A_COLOR, anchor="middle", weight="600")
    s.text(X(pick), ly + 45, "eller over tallet", size=11, fill=A_COLOR, anchor="middle", weight="600")

    arrow(s, [(X(roll), top + 70), (X(roll), ly - 12)], INK)
    tag(s, X(roll), top + 62, f"træk et tilfældigt tal: {roll}", INK)
    arrow(s, [(X(roll) + 3, ly - 20), (X(pick) - 4, ly - 20)], A_COLOR, sw=1.6)

    s.text(x0, top + 70, "Opslag sorteret efter deres tilfældige tal", size=12, fill=MUTED)
    s.text(x0, top + 88, "(slettede opslag vælges aldrig)", size=12, fill=MUTED)
    s.text(x1, top + 70, "Intet over tallet?", size=12, fill=MUTED, anchor="end")
    s.text(x1, top + 88, "Start forfra og tag det første.", size=12, fill=MUTED, anchor="end")


def strip(s, top, elos, b_index, b_note, near):
    x0 = 120
    tw, gap = 16, (W - 240 - N * 16) / (N - 1)
    X = lambda i: x0 + i * (tw + gap)
    ty = top + 92
    lo, hi = A_INDEX - EACH_SIDE, A_INDEX + EACH_SIDE

    if near:
        s.rect(X(lo) - 5, ty - 5, X(hi) + tw - X(lo) + 10, tw + 10, fill=DATA, rx=7, extra='fill-opacity="0.10"')
    for i in range(N):
        if i == A_INDEX:
            c = A_COLOR
        elif i == b_index:
            c = B_COLOR
        elif near and lo <= i <= hi:
            c = DATA
        else:
            c = None
        if c:
            s.rect(X(i), ty, tw, tw, fill=c, rx=4)
        else:
            s.rect(X(i), ty, tw, tw, fill="#e2e8f0", rx=4)

    ax, bx = X(A_INDEX) + tw / 2, X(b_index) + tw / 2
    label(s, ax, ty - 30, f"A · {elos[A_INDEX]}", A_COLOR)
    s.line(ax, ty - 19, ax, ty - 3, A_COLOR, sw=1.5)
    label(s, bx, ty - 30, f"B · {elos[b_index]}", B_COLOR)
    s.line(bx, ty - 19, bx, ty - 3, B_COLOR, sw=1.5)

    if near:
        bracket(s, X(lo), X(A_INDEX) - gap, ty + tw + 14, f"{EACH_SIDE} lige under A", DATA)
        bracket(s, X(A_INDEX + 1), X(hi) + tw, ty + tw + 14, f"{EACH_SIDE} lige over A", DATA)
    s.text(x0, ty + tw / 2, "laveste Elo ", size=11.5, fill=MUTED, anchor="end")
    s.text(X(N - 1) + tw + 6, ty + tw / 2, " højeste Elo", size=11.5, fill=MUTED)
    s.text(x0, top + 176, b_note, size=12.5, fill=INK)


def build():
    elos = ladder()
    s = Svg()
    defs(s)

    s.text(48, 46, "Fotolo · sådan vælges et matchup", size=24, weight="700")
    s.text(48, 76, "To fotos, valgt i to trin. Hvert trin læser kun omkring 20 opslag, "
                   "så det er lige så hurtigt at vælge et matchup med en million opslag.", size=13, fill=MUTED)

    step_one(s, 132)

    top2 = 410
    heading(s, top2, "2 · Vælg opslag B", "alle opslag, sorteret efter Elo")
    p1, ph = top2 + 26, 200
    frame(s, 48, p1, W - 96, ph, "90% af gangene: en tæt kamp", DATA,
          "B er et tilfældigt af de 20 opslag, der ligger tættest på A i Elo", fill=BG)
    strip(s, p1, elos, NEAR_B, "To fotos, der er omtrent lige gode: stemmen er et reelt valg, "
                               "og den sorterer midten af ranglisten præcist.", True)
    p2 = p1 + ph + 24
    frame(s, 48, p2, W - 96, ph, "10% af gangene: hvem som helst", B_COLOR,
          "B vælges tilfældigt, på samme måde som A", fill=BG)
    strip(s, p2, elos, FAR_B, "En stor Elo-forskel giver et stort udsving ved en overraskelse: et nyt eller forkert placeret foto kan springe "
                              "langt på én stemme i stedet for at kravle én plads ad gangen.", False)

    ny = p2 + ph + 40
    s.text(48, ny, "Dine egne opslag vælges aldrig. Hvis du ikke har stemt på dit seneste matchup, "
                   "får du det samme igen i stedet for et nyt.", size=12.5, fill=MUTED)
    return s.render(W, ny + 36, "Fotolo matchups")


if __name__ == "__main__":
    import sys
    open(sys.argv[1], "w", encoding="utf-8").write(build())
