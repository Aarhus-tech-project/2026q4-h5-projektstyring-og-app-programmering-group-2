from svg import Svg, MONO, SANS, INK, MUTED, FAINT, LINE, PANEL, BG, mono_width, sans_width

HEADER = 34
CAPTION = 22
ROW = 24
FOOT_LINE = 16
BODY = 12.5
NOTE = 11
FOOT = 11
PAD = 12
BADGE_W = 44

USERS = "#4f46e5"
SESSIONS = "#475569"
MEDIA = "#0d9488"
POSTS = "#e11d48"
MATCHUPS = "#d97706"
VOTES = "#7c3aed"
ELO = "#65a30d"
FAVS = "#0284c7"

BADGE_COLORS = {"PK": "#b45309", "FK": "#2563eb", "UK": "#7c3aed", "GEN": "#64748b"}

TABLES = {
    "users": dict(color=USERS, caption="én pr. konto · statistik genberegnes fra aktive opslag", rows=[
        ("id", "uuid", "PK", ""),
        ("username", "text", "", ""),
        ("email", "citext", "UK", "case-insensitiv"),
        ("password_hash", "text", "", ""),
        ("description", "text", "", "kan være null"),
        ("elo", "real", "", "bedste aktive opslags elo"),
        ("wins", "int", "", "sum af aktive opslag"),
        ("losses", "int", "", "sum af aktive opslag"),
        ("avatar_hash", "bytea", "FK", "null = intet profilbillede"),
        ("created_at", "timestamptz", "", ""),
    ], foot=["unique (email)", "ix (avatar_hash)"]),
    "sessions": dict(color=SESSIONS, caption="én pr. login · refresh token skiftes ved brug", rows=[
        ("id", "uuid", "PK", ""),
        ("user_id", "uuid", "FK", ""),
        ("refresh_token_hash", "text", "UK", "SHA-256 af tokenet"),
        ("device_id", "uuid", "", "tilfældig pr. app-installation"),
        ("device_name", "text", "", ""),
        ("platform", "text", "", "ios / android"),
        ("app_version", "text", "", ""),
        ("created_at", "timestamptz", "", ""),
        ("last_seen_at", "timestamptz", "", ""),
        ("revoked_at", "timestamptz", "", "null = aktiv"),
    ], foot=["unique (refresh_token_hash)", "ix (user_id)"]),
    "media": dict(color=MEDIA, caption="én pr. unik original · deles via hash", rows=[
        ("hash", "bytea", "PK", "SHA-256 af originalen"),
        ("kind", "text", "", "foto (video senere)"),
        ("width", "int", "", ""),
        ("height", "int", "", ""),
        ("thumbhash", "bytea", "", "~25 B sløret pladsholder"),
        ("original_format", "text", "", ""),
        ("original_size_bytes", "bigint", "", ""),
        ("camera_make", "text", "", "EXIF, sendes ikke til appen"),
        ("camera_model", "text", "", "EXIF, sendes ikke til appen"),
        ("taken_at", "timestamptz", "", "EXIF, sendes ikke til appen"),
        ("created_at", "timestamptz", "", ""),
    ], foot=["blobs: {hash}.webp, {hash}_thumb.webp"]),
    "posts": dict(color=POSTS, caption="et foto i konkurrencen · soft-delete", rows=[
        ("id", "uuid", "PK", ""),
        ("user_id", "uuid", "FK", ""),
        ("media_hash", "bytea", "FK", ""),
        ("elo", "real", "", "standard 1000 · kun worker"),
        ("wins", "int", "", "kun worker"),
        ("losses", "int", "", "kun worker"),
        ("rand_key", "float8", "", "random() ved oprettelse"),
        ("created_at", "timestamptz", "", ""),
        ("created_week", "date", "GEN", "mandag i created_at-ugen (UTC)"),
        ("deleted_at", "timestamptz", "", "null = aktiv"),
    ], foot=["ix (elo, rand_key)                 aktiv", "ix (rand_key)                      aktiv",
             "ix (created_week, elo, rand_key)   aktiv", "ix (user_id, created_at, id)       aktiv",
             "ix (media_hash)"]),
    "user_favorites": dict(color=FAVS, caption="en brugers gemte opslag", rows=[
        ("user_id", "uuid", "PK FK", ""),
        ("post_id", "uuid", "PK FK", ""),
        ("created_at", "timestamptz", "", ""),
    ], foot=["ix (post_id)"]),
    "matchups": dict(color=MATCHUPS, caption="to opslag vist til én vælger", rows=[
        ("id", "uuid", "PK", ""),
        ("voter_id", "uuid", "FK", ""),
        ("post_a_id", "uuid", "FK", ""),
        ("post_b_id", "uuid", "FK", ""),
        ("issued_at", "timestamptz", "", ""),
    ], foot=["ix (voter_id, issued_at)", "ix (post_a_id) · ix (post_b_id)", "check post_a_id <> post_b_id"]),
    "votes": dict(color=VOTES, caption="højst én pr. matchup · tælles senere", rows=[
        ("matchup_id", "uuid", "PK FK", ""),
        ("winner_id", "uuid", "FK", ""),
        ("loser_id", "uuid", "FK", ""),
        ("winner_was_a", "bool", "", ""),
        ("created_at", "timestamptz", "", "tællerækkefølge"),
        ("counted_at", "timestamptz", "", "null = afventer"),
        ("winner_elo_before", "real", "", "sættes ved optælling"),
        ("loser_elo_before", "real", "", "sættes ved optælling"),
    ], foot=["ix (created_at) where counted_at is null", "ix (winner_id) · ix (loser_id)",
             "check winner_id <> loser_id"]),
    "post_elo_changes": dict(color=ELO, caption="Elo-ændringer pr. time til Trending · gemmes 96 t", rows=[
        ("hour", "timestamptz", "PK", "rundet ned til hel time, UTC"),
        ("post_id", "uuid", "PK", "ingen FK-constraint"),
        ("elo_change", "real", "", "nettoændring den time"),
    ], foot=[]),
}


class Table:
    def __init__(self, name, spec):
        self.name = name
        self.color = spec["color"]
        self.caption = spec["caption"]
        self.rows = spec["rows"]
        self.foot = spec["foot"]
        self.name_w = max(mono_width(r[0], BODY) for r in self.rows)
        self.type_w = max(mono_width(r[1], BODY) for r in self.rows)
        self.note_w = max([sans_width(r[3], NOTE) for r in self.rows if r[3]] or [0])
        body = PAD + BADGE_W + self.name_w + 18 + self.type_w + (18 + self.note_w if self.note_w else 0) + PAD
        foot = max([mono_width(f, FOOT) + 2 * PAD for f in self.foot] or [0])
        cap = sans_width(self.caption, 11) + 2 * PAD
        head = sans_width(name, 15, bold=True) + 2 * PAD
        self.w = max(body, foot, cap, head, 250)
        self.h = HEADER + CAPTION + len(self.rows) * ROW + (10 + len(self.foot) * FOOT_LINE + 6 if self.foot else 4)
        self.x = self.y = 0

    def row_y(self, col):
        i = next(i for i, r in enumerate(self.rows) if r[0] == col)
        return self.y + HEADER + CAPTION + i * ROW + ROW / 2

    @property
    def left(self):
        return self.x

    @property
    def right(self):
        return self.x + self.w

    @property
    def bottom(self):
        return self.y + self.h

    def draw(self, s, refs):
        x, y, w, h = self.x, self.y, self.w, self.h
        s.add(f'<g filter="url(#shadow)">')
        s.rect(x, y, w, h, fill=BG, stroke=LINE, rx=10)
        s.add('</g>')
        s.add(f'<clipPath id="clip-{self.name}"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10"/></clipPath>')
        s.add(f'<g clip-path="url(#clip-{self.name})">')
        s.rect(x, y, w, HEADER, fill=self.color)
        s.rect(x, y + HEADER, w, CAPTION, fill=PANEL)
        s.line(x, y + HEADER + CAPTION, x + w, y + HEADER + CAPTION, LINE, 1)
        if self.foot:
            fy = y + HEADER + CAPTION + len(self.rows) * ROW
            s.rect(x, fy, w, h - (fy - y), fill=PANEL)
            s.line(x, fy, x + w, fy, LINE, 1)
        for i, (col, typ, key, note) in enumerate(self.rows):
            ry = y + HEADER + CAPTION + i * ROW
            if col in refs:
                s.rect(x, ry, w, ROW, fill=refs[col], extra='fill-opacity="0.07"')
                s.rect(x, ry, 3, ROW, fill=refs[col])
            elif i > 0:
                s.line(x + PAD, ry, x + w - PAD, ry, "#f1f5f9", 1)
        s.add('</g>')
        s.text(x + PAD, y + HEADER / 2, self.name, size=15, fill="#ffffff", weight="700", family=SANS)
        s.text(x + PAD, y + HEADER + CAPTION / 2, self.caption, size=11, fill=MUTED, italic=True)
        for i, (col, typ, key, note) in enumerate(self.rows):
            cy = y + HEADER + CAPTION + i * ROW + ROW / 2
            bx = x + PAD
            for k in key.split():
                bw = 20 if k != "GEN" else 28
                s.rect(bx, cy - 7.5, bw, 15, fill=BADGE_COLORS[k], rx=3.5, extra='fill-opacity="0.12"')
                s.text(bx + bw / 2, cy + 0.5, k, size=8.5, fill=BADGE_COLORS[k], weight="700", anchor="middle", family=SANS)
                bx += bw + 3
            nx = x + PAD + BADGE_W
            s.text(nx, cy, col, size=BODY, family=MONO, weight="700" if "PK" in key else "normal")
            tx = nx + self.name_w + 18
            s.text(tx, cy, typ, size=BODY, family=MONO, fill=MUTED)
            if note:
                s.text(x + w - PAD, cy, note, size=NOTE, fill=FAINT, anchor="end", italic=True)
        if self.foot:
            fy = y + HEADER + CAPTION + len(self.rows) * ROW + 10
            for j, f in enumerate(self.foot):
                s.text(x + PAD, fy + j * FOOT_LINE + FOOT_LINE / 2, f, size=FOOT, family=MONO, fill=MUTED)


def crow(s, x, y, d, color, optional=True):
    tip = x + d * 13
    for dy in (-6.5, 0, 6.5):
        s.line(tip, y, x, y + dy, color, 1.6, cap="round")
    if optional:
        s.circle(x + d * 19, y, 4, BG, color, 1.6)
    else:
        s.line(x + d * 17, y - 6.5, x + d * 17, y + 6.5, color, 1.6)


def one(s, x, y, d, color, optional=False):
    s.line(x + d * 8, y - 6.5, x + d * 8, y + 6.5, color, 1.6)
    if optional:
        s.circle(x + d * 17, y, 4, BG, color, 1.6)
    else:
        s.line(x + d * 13, y - 6.5, x + d * 13, y + 6.5, color, 1.6)


def build():
    t = {n: Table(n, spec) for n, spec in TABLES.items()}
    M = 48
    TOP = 128
    G01, G12, G23, GR = 96, 104, 132, 64

    cols = [["sessions"], ["users", "media"], ["posts"], ["user_favorites", "matchups", "votes", "post_elo_changes"]]
    widths = [max(t[n].w for n in c) for c in cols]
    xs = [M]
    for gap, w in zip([G01, G12, G23], widths):
        xs.append(xs[-1] + w + gap)
    for c, x in zip(cols, xs):
        for n in c:
            t[n].x = x
            t[n].w = widths[cols.index(c)]

    u, se, me, po = t["users"], t["sessions"], t["media"], t["posts"]
    fa, ma, vo, el = t["user_favorites"], t["matchups"], t["votes"], t["post_elo_changes"]

    u.y = TOP
    se.y = u.row_y("id") - (se.row_y("user_id") - se.y)
    me.y = u.bottom + 150
    po.y = me.row_y("hash") - (po.row_y("media_hash") - po.y)
    fa.y = TOP + 40
    ma.y = fa.bottom + 40
    vo.y = ma.bottom + 40
    el.y = vo.bottom + 40

    s = Svg()
    s.add('<defs><filter id="shadow" x="-5%" y="-5%" width="110%" height="115%">'
          '<feDropShadow dx="0" dy="1.5" stdDeviation="2.5" flood-color="#0f172a" flood-opacity="0.10"/></filter></defs>')

    s.text(M, 46, "Fotolo · PostgreSQL-skema", size=24, weight="700")
    s.text(M, 76, "8 tabeller. Hver FK-linje går fra den refererende kolonne til den nøgle, den refererer til. "
                  "Linjefarve = den tabel, der refereres til.", size=13, fill=MUTED)

    y_uid = u.row_y("id")
    y_pid = po.row_y("id")
    y_mh = me.row_y("hash")
    y_mid = ma.row_y("id")

    x_avatar = u.left - 40
    x_u12 = po.left - 52
    x_p = po.right + 46
    x_u23 = po.right + 80
    x_r = ma.right + 36

    groups = []

    users_paths = [
        [(se.right, y_uid), (u.left, y_uid)],
        [(po.left, po.row_y("user_id")), (x_u12, po.row_y("user_id")), (x_u12, y_uid), (u.right, y_uid)],
        [(fa.left, fa.row_y("user_id")), (x_u23, fa.row_y("user_id")), (x_u23, y_uid), (u.right, y_uid)],
        [(ma.left, ma.row_y("voter_id")), (x_u23, ma.row_y("voter_id")), (x_u23, y_uid), (u.right, y_uid)],
    ]
    groups.append((USERS, users_paths, []))

    media_paths = [
        [(po.left, y_mh), (me.right, y_mh)],
        [(u.left, u.row_y("avatar_hash")), (x_avatar, u.row_y("avatar_hash")), (x_avatar, y_mh), (me.left, y_mh)],
    ]
    groups.append((MEDIA, media_paths, []))

    matchup_paths = [
        [(vo.right, vo.row_y("matchup_id")), (x_r, vo.row_y("matchup_id")), (x_r, y_mid), (ma.right, y_mid)],
    ]
    groups.append((MATCHUPS, matchup_paths, []))

    def to_posts(tab, col):
        y = tab.row_y(col)
        return [(tab.left, y), (x_p, y), (x_p, y_pid), (po.right, y_pid)]

    posts_paths = [to_posts(fa, "post_id"), to_posts(ma, "post_a_id"), to_posts(ma, "post_b_id"),
                   to_posts(vo, "winner_id"), to_posts(vo, "loser_id")]
    posts_dashed = [to_posts(el, "post_id")]
    groups.append((POSTS, posts_paths, posts_dashed))

    for color, solid, dashed in groups:
        for p in solid + dashed:
            s.poly(p, BG, sw=7, rounded=8)
        for p in dashed:
            s.poly(p, color, sw=1.7, dash="5 4", rounded=8)
        for p in solid:
            s.poly(p, color, sw=1.7, rounded=8)

    refs = {
        "users": {"avatar_hash": MEDIA},
        "sessions": {"user_id": USERS},
        "posts": {"user_id": USERS, "media_hash": MEDIA},
        "user_favorites": {"user_id": USERS, "post_id": POSTS},
        "matchups": {"voter_id": USERS, "post_a_id": POSTS, "post_b_id": POSTS},
        "votes": {"matchup_id": MATCHUPS, "winner_id": POSTS, "loser_id": POSTS},
        "post_elo_changes": {"post_id": POSTS},
    }
    for n, tab in t.items():
        tab.draw(s, refs.get(n, {}))

    one(s, u.left, y_uid, -1, USERS)
    one(s, u.right, y_uid, 1, USERS)
    crow(s, se.right, y_uid, 1, USERS)
    crow(s, po.left, po.row_y("user_id"), -1, USERS)
    crow(s, fa.left, fa.row_y("user_id"), -1, USERS)
    crow(s, ma.left, ma.row_y("voter_id"), -1, USERS)

    one(s, me.right, y_mh, 1, MEDIA)
    crow(s, po.left, y_mh, -1, MEDIA)
    one(s, me.left, y_mh, -1, MEDIA, optional=True)
    crow(s, u.left, u.row_y("avatar_hash"), -1, MEDIA)

    one(s, ma.right, y_mid, 1, MATCHUPS)
    one(s, vo.right, vo.row_y("matchup_id"), 1, MATCHUPS, optional=True)

    one(s, po.right, y_pid, 1, POSTS)
    for tab, col in [(fa, "post_id"), (ma, "post_a_id"), (ma, "post_b_id"), (vo, "winner_id"), (vo, "loser_id"), (el, "post_id")]:
        crow(s, tab.left, tab.row_y(col), -1, POSTS)

    def label(x, y, text, color, anchor="middle"):
        w = sans_width(text, 10.5) + 10
        lx = x - w / 2 if anchor == "middle" else (x if anchor == "start" else x - w)
        s.rect(lx, y - 8, w, 16, fill=BG, rx=4)
        s.text(lx + w / 2, y, text, size=10.5, fill=color, anchor="middle", weight="600")

    label((se.right + u.left) / 2, y_uid - 14, "logget ind på", USERS)
    label((u.right + x_u23) / 2 + 40, y_uid - 14, "opretter · stemmer · favoritter", USERS)
    label((po.left + me.right) / 2, y_mh - 14, "vist i", MEDIA)
    label(x_avatar, (u.row_y("avatar_hash") + y_mh) / 2, "profilbillede", MEDIA)
    label(x_r, (vo.row_y("matchup_id") + y_mid) / 2, "afgjort af", MATCHUPS)
    label((el.left + x_p) / 2, el.row_y("post_id") - 13, "logisk ref.", POSTS)

    lx, ly = po.x, y_uid + 48
    lw = po.w
    lh = po.y - 36 - ly
    s.rect(lx, ly, lw, lh, fill=PANEL, stroke=LINE, rx=10)
    s.text(lx + 16, ly + 22, "Forklaring", size=13, weight="700")
    yy = ly + 50
    for k, desc in [("PK", "primærnøgle"), ("FK", "fremmednøgle"), ("UK", "unik"), ("GEN", "genereret (gemt) kolonne")]:
        bw = 20 if k != "GEN" else 28
        s.rect(lx + 16, yy - 7.5, bw, 15, fill=BADGE_COLORS[k], rx=3.5, extra='fill-opacity="0.12"')
        s.text(lx + 16 + bw / 2, yy + 0.5, k, size=8.5, fill=BADGE_COLORS[k], weight="700", anchor="middle")
        s.text(lx + 56, yy, desc, size=12, fill=INK)
        yy += 22
    yy += 6
    ex = lx + 16
    for kind, desc in [("one", "præcis én"), ("one?", "nul eller én"), ("many", "nul eller flere")]:
        s.line(ex, yy, ex + 30, yy, INK, 1.6)
        if kind == "one":
            one(s, ex, yy, 1, INK)
        elif kind == "one?":
            one(s, ex, yy, 1, INK, optional=True)
        else:
            crow(s, ex, yy, 1, INK)
        s.text(lx + 56, yy, desc, size=12)
        yy += 22
    s.line(ex, yy, ex + 30, yy, INK, 1.6, dash="5 4")
    s.text(lx + 56, yy, "reference uden FK-constraint", size=12)
    yy += 30
    for line in ["Alle FK'er er ON DELETE CASCADE, undtagen users.avatar_hash (no action).",
                 "\"aktiv\" = partielt indeks WHERE deleted_at IS NULL."]:
        s.text(lx + 16, yy, line, size=11, fill=MUTED)
        yy += 17

    nx, ny, nw = se.x, se.bottom + 40, se.w
    import textwrap
    notes = [
        "En stemme skriver én række i votes med counted_at = null. Vote-workeren tæller afventende stemmer én gang i minuttet, i created_at-rækkefølge.",
        "Kun workeren skriver posts.elo / wins / losses. For hver batch lægger den også hvert opslags nettoændring til post_elo_changes for den time.",
        "users.elo / wins / losses genberegnes fra brugerens aktive opslag (bedste elo, summerede wins / losses) og tælles aldrig bare op.",
        "Opslag soft-deletes: alle forespørgsler på aktive opslag filtrerer på deleted_at IS NULL, og rækker, medier og stemmer bliver liggende.",
        "votes.matchup_id er primærnøglen, så der kan kun stemmes én gang pr. matchup.",
        "Ranglister: altid og denne uge læser (elo, rand_key); Trending summerer de seneste 48 t af post_elo_changes.",
        "Et login tilbagekalder brugerens tidligere sessioner med samme device_id.",
    ]
    lines = []
    for n in notes:
        wrapped = textwrap.wrap(n, int((nw - 44) / (11.5 * 0.5)))
        lines.append(wrapped)
    nh = 46 + sum(len(l) * 17 + 8 for l in lines) + 6
    s.rect(nx, ny, nw, nh, fill=PANEL, stroke=LINE, rx=10)
    s.text(nx + 16, ny + 22, "Sådan flytter data sig", size=13, weight="700")
    yy = ny + 48
    for wrapped in lines:
        s.circle(nx + 20, yy, 2.5, MUTED, MUTED, 0)
        for j, l in enumerate(wrapped):
            s.text(nx + 30, yy + j * 17, l, size=11.5, fill=INK)
        yy += len(wrapped) * 17 + 8

    W = x_r + 40 + M / 2
    H = max(tab.bottom for tab in t.values()) + M
    return s.render(W, H, "Fotolo database schema")


if __name__ == "__main__":
    import sys
    open(sys.argv[1], "w").write(build())
