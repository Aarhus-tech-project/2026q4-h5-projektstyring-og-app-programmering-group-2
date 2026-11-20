from svg import Svg, SANS, INK, MUTED, FAINT, LINE, PANEL, BG, sans_width
from services import Box, arrow, tag, frame, APP, COMPUTE, DATA, CI

K = 32
WIN = DATA
LOSE = APP


def expected(a, b):
    return 1 / (1 + 10 ** ((b - a) / 400))


def photo(s, x, y, size, letter, color, won):
    s.add('<g filter="url(#shadow)">')
    s.rect(x, y, size, size, fill=color, rx=16, extra=f'fill-opacity="{0.9 if won else 0.35}"')
    s.add('</g>')
    s.text(x + size / 2, y + size / 2, letter, size=54, weight="700", fill="#fff", anchor="middle")
    if won:
        s.rect(x - 4, y - 4, size + 8, size + 8, stroke=WIN, sw=3, rx=19)
        bw = 58
        s.rect(x + size / 2 - bw / 2, y - 15, bw, 22, fill=WIN, rx=11)
        s.text(x + size / 2, y - 4, "VINDER", size=11, weight="700", fill="#fff", anchor="middle")


def scenario(s, x, y, w, h, title, sub, a, b, winner):
    frame(s, x, y, w, h, title, INK, sub, fill=BG)
    ea = expected(a, b)
    chance = {"A": ea, "B": 1 - ea}
    elo = {"A": a, "B": b}
    loser = "B" if winner == "A" else "A"
    change = K * (1 - chance[winner])
    after = {winner: elo[winner] + change, loser: elo[loser] - change}

    size = 120
    cols = {"A": x + w * 0.27, "B": x + w * 0.73}
    py = y + 74
    for p, color in (("A", "#6366f1"), ("B", "#f59e0b")):
        cx = cols[p]
        won = p == winner
        photo(s, cx - size / 2, py, size, p, color, won)
        s.text(cx, py + size + 26, f"Elo {elo[p]:.0f}", size=15, weight="700", anchor="middle")
        s.text(cx, py + size + 46, f"{chance[p] * 100:.0f}% chance for at vinde", size=12, fill=MUTED, anchor="middle")
        d = after[p] - elo[p]
        c = WIN if d > 0 else LOSE
        s.text(cx, py + size + 92, f"{'+' if d > 0 else '−'}{abs(d):.0f}", size=34, weight="700", fill=c, anchor="middle")
        s.text(cx, py + size + 122, f"{elo[p]:.0f} → {after[p]:.0f}", size=13, fill=MUTED, anchor="middle")
    s.text(x + w / 2, py + size / 2, "vs", size=18, weight="700", fill=FAINT, anchor="middle")

    by = y + h - 50
    s.rect(x + 20, by - 20, w - 40, 40, fill=PANEL, stroke=LINE, rx=10)
    s.text(x + w / 2, by, f"{winner} havde {(1 - chance[winner]) * 100:.0f}% chance for at tabe  →  "
                          f"{K} × {(1 - chance[winner]) * 100:.0f}% = {change:.0f} point går fra {loser} til {winner}",
           size=12.5, anchor="middle", weight="600")


def build():
    s = Svg()
    colors = [APP, COMPUTE, DATA, CI, INK]
    s.add('<defs><filter id="shadow" x="-5%" y="-5%" width="110%" height="120%">'
          '<feDropShadow dx="0" dy="1.5" stdDeviation="2.5" flood-color="#0f172a" flood-opacity="0.10"/></filter>'
          + "".join(f'<marker id="a-{c[1:]}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7.5" markerHeight="7.5" '
                    f'orient="auto-start-reverse"><path d="M 0 0.5 L 10 5 L 0 9.5 z" fill="{c}"/></marker>' for c in colors)
          + '</defs>')

    W = 1400
    s.text(48, 46, "Fotolo · stemmer og Elo", size=24, weight="700")
    s.text(48, 76, "Hvert opslag har en Elo-rating (nye opslag starter på 1000). Vinderen af et matchup tager point fra taberen.",
           size=13, fill=MUTED)

    s.text(48, 132, "1 · Sådan bliver en stemme talt", size=16, weight="700")
    bw, bh, gap, by = 250, 96, (W - 96 - 4 * 250) / 3, 160
    steps = [
        ("Du stemmer", ["tryk på det bedste af to fotos"], APP, None),
        ("Gemt som afventende", ["API'et gemmer kun stemmen", "Elo ændres ikke endnu"], COMPUTE, None),
        ("Vote-worker", ["tæller alle afventende stemmer,", "ældste først"], COMPUTE, "hvert minut"),
        ("Ranglister opdateres", ["ny Elo, sejre, nederlag", "og trending"], DATA, None),
    ]
    boxes = [Box(48 + i * (bw + gap), by, bw, bh, t, ls, c, badge=bd) for i, (t, ls, c, bd) in enumerate(steps)]
    for a, b in zip(boxes, boxes[1:]):
        arrow(s, [(a.r + 4, a.cy), (b.l - 4, a.cy)], INK)
    for b in boxes:
        b.draw(s)
    s.text(W / 2, by + bh + 32, "Kun én worker tæller, så hver stemme bliver talt én gang, i den rækkefølge den blev afgivet.",
           size=12.5, fill=MUTED, anchor="middle")

    s.text(48, 340, "2 · Hvad en sejr er værd", size=16, weight="700")
    s.text(48 + sans_width("2 · Hvad en sejr er værd", 16, True) + 14, 340,
           "vinderen får 32 × den chance, den havde for at tabe", size=13, fill=MUTED)
    sw_, sh = (W - 96 - 32) / 2, 420
    scenario(s, 48, 368, sw_, sh, "Forventet sejr", "favoritten vinder: lille ændring", 1200, 1000, "A")
    scenario(s, 48 + sw_ + 32, 368, sw_, sh, "Overraskelse", "underdoggen vinder: stor ændring", 1200, 1000, "B")

    return s.render(W, 368 + sh + 40, "Fotolo stemmer og Elo")


if __name__ == "__main__":
    import sys
    open(sys.argv[1], "w", encoding="utf-8").write(build())
