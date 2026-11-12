from svg import Svg, SANS, MONO, INK, MUTED, FAINT, LINE, PANEL, BG, sans_width

CLOUDFLARE = "#f38020"
COMPUTE = "#4f46e5"
DATA = "#0d9488"
OBS = "#d97706"
AZURE = "#0078d4"
CI = "#475569"
APP = "#e11d48"
EDGE_NET = "#0284c7"


class Box:
    def __init__(self, x, y, w, h, title, lines=(), color=COMPUTE, shape="rect", badge=None):
        self.x, self.y, self.w, self.h = x, y, w, h
        self.title, self.lines, self.color, self.shape, self.badge = title, list(lines), color, shape, badge

    l = property(lambda b: b.x)
    r = property(lambda b: b.x + b.w)
    t = property(lambda b: b.y)
    b = property(lambda b: b.y + b.h)
    cx = property(lambda b: b.x + b.w / 2)
    cy = property(lambda b: b.y + b.h / 2)

    def draw(self, s):
        x, y, w, h, c = self.x, self.y, self.w, self.h, self.color
        top = y
        if self.shape == "cyl":
            e = 9
            s.add('<g filter="url(#shadow)">')
            s.add(f'<path d="M {x} {y + e} A {w / 2} {e} 0 0 1 {x + w} {y + e} L {x + w} {y + h - e} '
                  f'A {w / 2} {e} 0 0 1 {x} {y + h - e} Z" fill="{BG}" stroke="{c}" stroke-width="1.6"/>')
            s.add('</g>')
            s.add(f'<ellipse cx="{x + w / 2}" cy="{y + e}" rx="{w / 2}" ry="{e}" fill="{c}" fill-opacity="0.14" stroke="{c}" stroke-width="1.6"/>')
            top = y + 2 * e - 2
        elif self.shape == "ghost":
            s.rect(x, y, w, h, fill=PANEL, stroke=c, rx=10, sw=1.4, dash="5 4")
        else:
            s.add('<g filter="url(#shadow)">')
            s.rect(x, y, w, h, fill=BG, stroke=LINE, rx=10)
            s.add('</g>')
            s.add(f'<clipPath id="c{id(self)}"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10"/></clipPath>')
            s.rect(x, y, 5, h, fill=c, extra=f'clip-path="url(#c{id(self)})"')
        n = len(self.lines)
        block = 18 + n * 15
        ty = top + (y + h - top) / 2 - block / 2 + 9
        s.text(x + w / 2, ty, self.title, size=13.5, weight="700", anchor="middle")
        for i, ln in enumerate(self.lines):
            mono = ln.startswith("`")
            s.text(x + w / 2, ty + 19 + i * 15, ln.strip("`"), size=11 if mono else 11.5,
                   fill=MUTED, anchor="middle", family=MONO if mono else SANS)
        if self.badge:
            bw = sans_width(self.badge, 10, True) + 12
            s.rect(x + w - bw - 8, y - 9, bw, 18, fill=c, rx=9)
            s.text(x + w - bw / 2 - 8, y, self.badge, size=10, weight="700", fill="#fff", anchor="middle")


def frame(s, x, y, w, h, title, color, sub=None, fill=PANEL, dash=None):
    s.rect(x, y, w, h, fill=fill, stroke=color, rx=14, sw=1.4, dash=dash, extra='stroke-opacity="0.55"')
    s.text(x + 18, y + 22, title, size=14, weight="700", fill=color)
    if sub:
        s.text(x + 18 + sans_width(title, 14, True) + 10, y + 22, sub, size=11.5, fill=MUTED)


def arrow(s, pts, color, label=None, at=None, dash=None, sw=1.7, head=True, lpos=0.5, tunnel=False):
    if tunnel:
        s.poly(pts, color, sw=7, rounded=10)
        s.poly(pts, BG, sw=3, rounded=10)
    else:
        d = f' stroke-dasharray="{dash}"' if dash else ""
        from svg import rounded_path
        m = f' marker-end="url(#a-{color[1:]})"' if head else ""
        s.add(f'<path d="{rounded_path(pts, 10)}" fill="none" stroke="{color}" stroke-width="{sw}" stroke-linejoin="round"{d}{m}/>')
    if label:
        lx, ly = at if at else midpoint(pts, lpos)
        tag(s, lx, ly, label, color)


def tag(s, x, y, text, color, anchor="middle"):
    lines = text.split("\n")
    w = max(sans_width(l, 10.5) for l in lines) + 12
    h = 6 + 14 * len(lines)
    lx = x - w / 2 if anchor == "middle" else (x if anchor == "start" else x - w)
    s.rect(lx, y - h / 2, w, h, fill=BG, rx=5, extra='fill-opacity="0.94"')
    for i, l in enumerate(lines):
        s.text(lx + w / 2, y - h / 2 + 3 + 7 + i * 14, l, size=10.5, fill=color, weight="600", anchor="middle")


def midpoint(pts, f):
    segs = list(zip(pts, pts[1:]))
    lens = [abs(b[0] - a[0]) + abs(b[1] - a[1]) for a, b in segs]
    target = sum(lens) * f
    for (a, b), L in zip(segs, lens):
        if target <= L and L:
            t = target / L
            return a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
        target -= L
    return pts[-1]


def build():
    s = Svg()
    colors = [CLOUDFLARE, COMPUTE, DATA, OBS, AZURE, CI, APP, EDGE_NET, INK, MUTED]
    s.add('<defs><filter id="shadow" x="-5%" y="-5%" width="110%" height="120%">'
          '<feDropShadow dx="0" dy="1.5" stdDeviation="2.5" flood-color="#0f172a" flood-opacity="0.10"/></filter>'
          + "".join(f'<marker id="a-{c[1:]}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7.5" markerHeight="7.5" '
                    f'orient="auto-start-reverse"><path d="M 0 0.5 L 10 5 L 0 9.5 z" fill="{c}"/></marker>' for c in colors)
          + '</defs>')

    s.text(48, 46, "Fotolo · services and data flow", size=24, weight="700")
    s.text(48, 76, "Everything server-side runs as one Docker Swarm stack. Media never passes through it: "
                   "the app fetches images straight from Azure Blob Storage.", size=13, fill=MUTED)

    SX, SY, SW, SH = 520, 112, 1196, 740
    frame(s, SX, SY, SW, SH, "Docker Swarm", COMPUTE, "stack fotolo · swarm/docker-compose.yml · stateful services pinned to the manager node", fill="#fbfbff")

    MX, MY, MW, MH = 552, 150, 1132, 222
    frame(s, MX, MY, MW, MH, "Monitoring", OBS, "Grafana dashboards: overview · logs & traces · product", fill="#fffbf3")

    grafana = Box(860, 188, 170, 62, "Grafana", ["port 3000 · firewalled / SSH"], OBS)
    loki = Box(640, 282, 160, 68, "Loki", ["logs"], OBS, "cyl")
    tempo = Box(860, 282, 170, 68, "Tempo", ["traces · service map"], OBS, "cyl")
    prom = Box(1090, 282, 170, 68, "Prometheus", ["metrics"], OBS, "cyl")
    nodeexp = Box(1330, 290, 190, 54, "node-exporter", ["host CPU / RAM / disk"], OBS, badge="global")

    edge_y, edge_h = 448, 128
    cloudflared = Box(566, 462, 164, 92, "cloudflared", ["Cloudflare Tunnel client", "outbound only"], CLOUDFLARE, badge="×2")
    vip = Box(784, 462, 170, 92, "Swarm VIP  server:8080", ["IPVS load balancer", "per TCP connection", "not a container"], EDGE_NET, "ghost")
    server = Box(1040, 456, 220, 104, "server", ["ASP.NET Core · --Role=api", "JWT · rate limits · /healthz", "rolling update, start-first"], COMPUTE, badge="×N (2)")
    worker = Box(1450, 462, 200, 92, "vote-worker", ["same image · --Role=voteworker", "no port · stop-first"], COMPUTE, badge="×1")
    postgres = Box(1290, 620, 150, 104, "PostgreSQL 18", ["single container", "volume on manager"], DATA, "cyl")
    migrate = Box(1290, 772, 150, 56, "migrate", ["EF bundle · job per deploy"], CI, badge="job")

    s.rect(552, edge_y - 18, 726, edge_h + 34, fill=EDGE_NET, stroke=EDGE_NET, rx=12, sw=1.2, dash="4 4",
           extra='fill-opacity="0.04" stroke-opacity="0.6"')
    s.text(568, edge_y + edge_h + 4, "edge overlay network · 10.250.0.0/24", size=10.5, fill=EDGE_NET, weight="600")
    s.text(568, 836, "backend overlay network: every service except cloudflared", size=10.5, fill=MUTED, weight="600")

    app = Box(48, 450, 182, 110, "Expo app", ["iOS / Android", "JWT access 15 min", "+ refresh token"], APP)
    cf = Box(290, 444, 186, 122, "Cloudflare", ["`fotolo.mesasoftware.com`", "HTTPS · tunnel route", "→ http://server:8080", "100 MB body cap (free)"], CLOUDFLARE)
    ghactions = Box(48, 152, 170, 76, "GitHub Actions", ["push to main", "amd64 + arm64 builds"], CI)
    ghcr = Box(262, 152, 170, 76, "GHCR", ["server + migrations", "images"], CI, "cyl")

    AX, AY, AW, AH = 742, 900, 520, 168
    frame(s, AX, AY, AW, AH, "Azure Blob Storage", AZURE, fill="#f5faff")
    s.text(AX + AW / 2, AY + AH - 14, "blobs are named by the SHA-256 of the original upload", size=11, fill=MUTED, anchor="middle")
    media = Box(770, 950, 220, 82, "media", ["public blob read, no listing", "`{hash}.webp  {hash}_thumb.webp`"], AZURE, "cyl")
    uploads = Box(1020, 950, 220, 82, "uploads", ["private · backend only", "originals, metadata intact"], AZURE, "cyl")

    arrow(s, [(grafana.cx, grafana.b), (tempo.cx, tempo.t)], OBS)
    arrow(s, [(grafana.l, grafana.cy), (loki.cx, grafana.cy), (loki.cx, loki.t)], OBS)
    arrow(s, [(grafana.r, grafana.cy), (prom.cx, grafana.cy), (prom.cx, prom.t)], OBS)
    arrow(s, [(tempo.r, tempo.cy + 6), (prom.l, tempo.cy + 6)], OBS, "span\nmetrics", at=((tempo.r + prom.l) / 2, tempo.cy - 22))
    arrow(s, [(prom.r, nodeexp.cy), (nodeexp.l, nodeexp.cy)], OBS, "scrapes", at=((prom.r + nodeexp.l) / 2, nodeexp.cy - 16))

    bus = 412
    s.poly([(server.cx, server.t), (server.cx, bus)], OBS, sw=1.7, dash="6 4", rounded=0)
    s.poly([(worker.cx, worker.t), (worker.cx, bus)], OBS, sw=1.7, dash="6 4", rounded=0)
    s.poly([(loki.cx, bus), (worker.cx, bus)], OBS, sw=1.7, dash="6 4", rounded=0)
    for b in (loki, tempo, prom):
        arrow(s, [(b.cx, bus), (b.cx, b.b)], OBS, dash="6 4")
    tag(s, (server.cx + worker.cx) / 2, bus, "OTLP push: logs · metrics · traces", OBS)

    arrow(s, [(grafana.cx + 40, grafana.t), (grafana.cx + 40, 172), (1668, 172), (1668, postgres.b - 24), (postgres.r, postgres.b - 24)],
          OBS, "app data (SQL)", at=(1668, 700), dash="6 4")

    arrow(s, [(ghactions.r, ghactions.cy), (ghcr.l, ghactions.cy)], CI, "push", at=((ghactions.r + ghcr.l) / 2, ghactions.cy - 14))
    arrow(s, [(ghcr.r, ghcr.cy), (SX, ghcr.cy)], CI, "stack deploy\npulls", at=((ghcr.r + SX) / 2, ghcr.cy + 26), dash="6 4")

    arrow(s, [(app.r, app.cy), (cf.l, app.cy)], APP, "/api/*", at=((app.r + cf.l) / 2, app.cy - 14))
    arrow(s, [(cf.r, cloudflared.cy), (cloudflared.l, cloudflared.cy)], CLOUDFLARE, tunnel=True)
    tag(s, (cf.r + cloudflared.l) / 2, cloudflared.cy - 20, "tunnel", CLOUDFLARE)
    arrow(s, [(cloudflared.r, cloudflared.cy), (vip.l, vip.cy)], EDGE_NET, "HTTP", at=((cloudflared.r + vip.l) / 2, cloudflared.cy - 14))
    arrow(s, [(vip.r, vip.cy), (server.l, vip.cy)], EDGE_NET, "1 replica /\nconnection", at=((vip.r + server.l) / 2, vip.cy - 26))

    arrow(s, [(server.r, server.b - 22), (postgres.cx - 20, server.b - 22), (postgres.cx - 20, postgres.t + 2)], DATA,
          "SQL: posts, matchups,\npending votes", at=(postgres.cx - 20, 596))
    arrow(s, [(worker.cx, worker.b), (worker.cx, postgres.t + 34), (postgres.r, postgres.t + 34)], DATA,
          "every minute: count votes,\nwrite Elo + trending", at=(worker.cx + 10, 590))
    arrow(s, [(migrate.cx, migrate.t), (migrate.cx, postgres.b)], CI, "migrations", at=(migrate.cx + 46, (migrate.t + postgres.b) / 2))

    arrow(s, [(server.cx + 40, server.b), (server.cx + 40, uploads.t + 2)], AZURE, "save original", at=(server.cx + 40, 830))
    arrow(s, [(server.cx - 40, server.b), (server.cx - 40, 872), (media.r - 50, 872), (media.r - 50, media.t + 2)], AZURE,
          "write WebP + thumbnail", at=((media.r - 50 + server.cx - 40) / 2, 872))
    arrow(s, [(app.cx, app.b), (app.cx, media.cy + 10), (media.l, media.cy + 10)], APP,
          "GET images directly (URLs come from the API)", at=((app.cx + media.l) / 2 + 20, media.cy + 10))

    import textwrap
    px, py, pw = 560, 612, 460
    notes = [
        "Uploads (max 25 MB) are processed inline: hash, validate ≤ 50 MP, WebP 2048 px + 400 px thumbnail, thumbhash, EXIF read. Post photos are cropped square, avatars aren't.",
        "Rate limits, in memory per replica: 100 req/min per user (or IP), 15/min per IP on login, register and refresh.",
        "Client IP comes from CF-Connecting-IP, trusted only from the edge network.",
        "The API only inserts votes. Elo, wins, losses and trending are written by the vote worker alone.",
        "The API is stateless; scale it with SERVER_REPLICAS.",
    ]
    wrapped = [textwrap.wrap(n, 76) for n in notes]
    ph = 40 + sum(len(w) * 15 + 6 for w in wrapped)
    s.rect(px, py, pw, ph, fill=BG, stroke=LINE, rx=10)
    s.text(px + 14, py + 20, "Inside the API", size=12.5, weight="700", fill=COMPUTE)
    yy = py + 42
    for w in wrapped:
        s.circle(px + 18, yy, 2.2, MUTED, MUTED, 0)
        for j, ln in enumerate(w):
            s.text(px + 27, yy + j * 15, ln, size=11, fill=INK)
        yy += len(w) * 15 + 6

    for b in (grafana, loki, tempo, prom, nodeexp, cloudflared, vip, server, worker, postgres, migrate,
              app, cf, ghactions, ghcr, media, uploads):
        b.draw(s)

    lx, ly = 1296, 880
    s.rect(lx, ly, 420, 200, fill=PANEL, stroke=LINE, rx=10)
    s.text(lx + 16, ly + 22, "Legend", size=13, weight="700")
    rows = [
        ("solid", INK, "request / data flow"),
        ("dash", INK, "telemetry, deploy, or read-only access"),
        ("tunnel", CLOUDFLARE, "Cloudflare Tunnel (cloudflared dials out)"),
        ("ghost", EDGE_NET, "Swarm built-in, not a container"),
        ("cyl", DATA, "stores data (volume or blob container)"),
    ]
    yy = ly + 48
    for kind, c, desc in rows:
        x0 = lx + 18
        if kind == "solid":
            arrow(s, [(x0, yy), (x0 + 44, yy)], c)
        elif kind == "dash":
            arrow(s, [(x0, yy), (x0 + 44, yy)], c, dash="6 4")
        elif kind == "tunnel":
            arrow(s, [(x0, yy), (x0 + 44, yy)], c, tunnel=True)
        elif kind == "ghost":
            s.rect(x0, yy - 9, 44, 18, fill=PANEL, stroke=c, rx=5, sw=1.3, dash="4 3")
        else:
            s.add(f'<path d="M {x0 + 8} {yy - 7} A 14 4 0 0 1 {x0 + 36} {yy - 7} L {x0 + 36} {yy + 7} A 14 4 0 0 1 {x0 + 8} {yy + 7} Z" fill="{BG}" stroke="{c}" stroke-width="1.4"/>')
            s.add(f'<ellipse cx="{x0 + 22}" cy="{yy - 7}" rx="14" ry="4" fill="{c}" fill-opacity="0.14" stroke="{c}" stroke-width="1.4"/>')
        s.text(lx + 78, yy, desc, size=12)
        yy += 25
    s.text(lx + 18, yy + 2, "×N = replicas · global = one per node · job = runs once per deploy", size=11, fill=MUTED)

    return s.render(1764, 1112, "Fotolo services")


if __name__ == "__main__":
    import sys
    open(sys.argv[1], "w").write(build())
