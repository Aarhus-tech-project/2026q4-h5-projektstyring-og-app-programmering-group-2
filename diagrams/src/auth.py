import textwrap

from svg import Svg, MONO, INK, MUTED, FAINT, LINE, BG
from services import Box, arrow, tag, frame, APP, COMPUTE, DATA, CI
from media import card

FAIL = "#dc2626"


def diamond(s, cx, cy, w, h, text, color):
    s.add('<g filter="url(#shadow)">')
    s.add(f'<path d="M {cx} {cy - h / 2} L {cx + w / 2} {cy} L {cx} {cy + h / 2} L {cx - w / 2} {cy} Z" '
          f'fill="{BG}" stroke="{color}" stroke-width="1.8" stroke-linejoin="round"/>')
    s.add('</g>')
    lines = text.split("\n")
    for i, ln in enumerate(lines):
        s.text(cx, cy + (i - (len(lines) - 1) / 2) * 16, ln, size=12.5, weight="700", anchor="middle")


def pill(s, cx, cy, w, h, text, color):
    s.add('<g filter="url(#shadow)">')
    s.rect(cx - w / 2, cy - h / 2, w, h, fill=color, rx=h / 2)
    s.add('</g>')
    s.text(cx, cy, text, size=13.5, weight="700", fill="#fff", anchor="middle")


def info(s, x, y, w, title, color, badge, items):
    wrapped = [textwrap.wrap(item, 46) for item in items]
    h = 52 + sum(len(l) * 16 + 7 for l in wrapped) + 8
    card(s, x, y, w, h, title, color, badge)
    yy = y + 52
    for lines in wrapped:
        s.circle(x + 22, yy, 2.2, MUTED, MUTED, 0)
        for j, ln in enumerate(lines):
            s.text(x + 31, yy + j * 16, ln, size=12, fill=INK)
        yy += len(lines) * 16 + 7
    return y + h


def build():
    s = Svg()
    colors = [APP, COMPUTE, DATA, CI, INK, FAIL]
    s.add('<defs><filter id="shadow" x="-5%" y="-5%" width="110%" height="120%">'
          '<feDropShadow dx="0" dy="1.5" stdDeviation="2.5" flood-color="#0f172a" flood-opacity="0.10"/></filter>'
          + "".join(f'<marker id="a-{c[1:]}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7.5" markerHeight="7.5" '
                    f'orient="auto-start-reverse"><path d="M 0 0.5 L 10 5 L 0 9.5 z" fill="{c}"/></marker>' for c in colors)
          + '</defs>')

    s.text(48, 46, "Fotolo · login and tokens", size=24, weight="700")
    s.text(48, 76, "The app holds two tokens: a short-lived access token for every request, "
                   "and a refresh token that only buys new tokens.", size=13, fill=MUTED)

    top, bottom = 112, 1036
    frame(s, 48, top, 600, bottom - top, "App", APP, "Expo · tokens in SecureStore", fill="#fffafb")
    frame(s, 688, top, 500, bottom - top, "Server", COMPUTE, "AuthController", fill="#fbfbff")

    c1, c2, c3 = 190, 490, 938

    pill(s, c2, 190, 170, 42, "App opens", APP)
    diamond(s, c2, 290, 200, 92, "Tokens saved\non the phone?", APP)
    login = Box(c2 - 110, 382, 220, 76, "Login screen", ["email + password"], APP)
    s1 = Box(c3 - 150, 360, 300, 120, "POST /api/Auth/login",
             ["check email + password", "revoke this phone's old session", "new session: store only the",
              "SHA-256 of the refresh token"], COMPUTE)
    save = Box(c2 - 110, 522, 220, 76, "Save both tokens", ["in SecureStore (Keychain)"], APP)
    request = Box(c1 - 100, 522, 200, 76, "API request", ["voting, ranking, upload …"], APP)
    diamond(s, c1, 690, 210, 104, "Access token runs\nout in < 30 s?", APP)
    s2 = Box(c3 - 150, 640, 300, 100, "POST /api/Auth/refresh",
             ["find session by token hash", "not revoked, used in last 30 days?"], COMPUTE)
    send = Box(c1 - 110, 792, 220, 76, "Send the request", ["`Authorization: Bearer …`"], APP)
    s3 = Box(c3 - 150, 785, 300, 90, "Check the JWT", ["signature + expiry only", "no database lookup"], COMPUTE)
    out = Box(c2 - 120, 922, 240, 76, "Sign out on the phone", ["delete both tokens,", "show the login screen"], FAIL)

    arrow(s, [(c2, 211), (c2, 244)], INK)
    arrow(s, [(c2, 336), (c2, login.t)], INK, "no", at=(c2 + 18, 359))
    arrow(s, [(c2 - 100, 290), (c1, 290), (c1, request.t)], INK, "yes", at=((c1 + c2 - 100) / 2, 290))
    arrow(s, [(login.r, login.cy), (s1.l, login.cy)], INK, "email, password,\ndevice id", at=((login.r + s1.l) / 2, login.cy - 28))
    s.poly([(c3, s2.t), (c3, 560)], DATA, sw=1.7, rounded=0)
    arrow(s, [(c3, s1.b), (c3, 560), (save.r, 560)], DATA, "access + refresh token", at=((save.r + s1.l) / 2 + 10, 560))
    tag(s, c3, 600, "valid: new pair, old\nrefresh token stops working", DATA)
    arrow(s, [(save.l, 560), (request.r, 560)], INK)
    arrow(s, [(c1, request.b), (c1, 638)], INK)
    arrow(s, [(c1 + 105, 690), (s2.l, 690)], INK, "yes: refresh first", at=((c1 + 105 + s2.l) / 2, 674))
    arrow(s, [(c1, 742), (c1, send.t)], INK, "no", at=(c1 + 18, 767))
    arrow(s, [(send.r, 815), (s3.l, 815)], INK, "request", at=((send.r + s3.l) / 2, 801))
    arrow(s, [(s3.l, 848), (send.r, 848)], DATA, "200 + data", at=((send.r + s3.l) / 2, 862))

    s.poly([(s2.r, s2.cy), (1150, s2.cy), (1150, out.cy)], FAIL, sw=1.7, rounded=10)
    tag(s, 1150, 800, "invalid:\n401", FAIL)
    arrow(s, [(c3, s3.b), (c3, out.cy), (out.r, out.cy)], FAIL, "401", at=(c3, 902))
    s.poly([(1150, out.cy), (c3, out.cy)], FAIL, sw=1.7, rounded=0)

    for b in (login, s1, save, request, s2, send, s3, out):
        b.draw(s)

    rx, rw = 1228, 344
    y = info(s, rx, 130, rw, "Access token", COMPUTE, "15 min", [
        "a JWT signed by the server (HMAC-SHA256)",
        "holds the user id and session id",
        "sent with every request",
        "checked without touching the database, so it's fast",
    ])
    y = info(s, rx, y + 36, rw, "Refresh token", DATA, "30 days idle", [
        "32 random bytes, only sent to /refresh",
        "the server keeps only its SHA-256 hash, so a database leak can't be used to log in",
        "swapped for a new one on every refresh: each token works once",
    ])
    y = info(s, rx, y + 36, rw, "Logging out", FAIL, "revokes", [
        "logout revokes this session, so its refresh token stops working",
        "logout all revokes every session the user has",
        "logging in again on the same phone revokes its old session",
        "an access token already handed out keeps working until it runs out (at most 15 min)",
    ])
    note = textwrap.wrap("The app reads the expiry from the token before each request and refreshes if it's "
                            "almost out, so requests don't fail halfway. If several requests need a refresh at "
                            "once, they share one refresh call.", 50)
    y += 36
    s.rect(rx, y, rw, 44 + len(note) * 16, fill=BG, stroke=LINE, rx=10)
    s.text(rx + 16, y + 22, "Why refresh 30 s early?", size=12.5, weight="700", fill=APP)
    for i, ln in enumerate(note):
        s.text(rx + 16, y + 46 + i * 16, ln, size=12, fill=INK)

    return s.render(rx + rw + 48, bottom + 40, "Fotolo auth")


if __name__ == "__main__":
    import sys
    open(sys.argv[1], "w", encoding="utf-8").write(build())
