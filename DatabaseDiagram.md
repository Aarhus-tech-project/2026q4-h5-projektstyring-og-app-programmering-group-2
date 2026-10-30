```mermaid
erDiagram
    users {
        uuid id PK
        text username
        citext email UK
        text password_hash
        text description
        timestamptz created_at
    }
    sessions {
        uuid id PK
        uuid user_id FK
        text refresh_token_hash UK
        text device_name
        text platform
        text app_version
        timestamptz created_at
        timestamptz last_seen_at
        timestamptz revoked_at
    }
    media {
        bytea hash PK
        text kind
        int width
        int height
        bytea thumbhash
        text original_format
        bigint original_size_bytes
        text camera_make
        text camera_model
        timestamptz taken_at
        timestamptz created_at
    }
    posts {
        uuid id PK
        uuid user_id FK
        bytea media_hash FK
        real elo
        int wins
        int losses
        timestamptz created_at
        timestamptz deleted_at
    }
    matchups {
        uuid id PK
        uuid voter_id FK
        uuid post_a_id FK
        uuid post_b_id FK
        timestamptz issued_at
    }
    votes {
        uuid matchup_id PK, FK
        uuid winner_id FK
        uuid loser_id FK
        boolean winner_was_a
        timestamptz created_at
        timestamptz counted_at "null = not counted yet"
        real winner_elo_before "set when counted"
        real loser_elo_before "set when counted"
    }

    users ||--o{ sessions : "logged in on"
    users ||--o{ posts : creates
    media ||--o{ posts : "shown in"
    users ||--o{ matchups : "is shown"
    posts ||--o{ matchups : "appears in"
    matchups ||--o| votes : "decided by"
    posts ||--o{ votes : "wins / loses"
```

- **Votes are counted later, not when they're cast.** `POST /api/posts/vote` only inserts a `votes` row with `counted_at = null`. It never touches `posts`.
- **The vote counter** (see `ServiceDiagram.md`) applies pending votes in batches. For each vote it fills in `winner_elo_before` / `loser_elo_before`, updates `posts.elo`, `wins` and `losses`, and sets `counted_at`. These columns are only ever written by the counter.
- **`matchup_id` as the primary key** still means one vote per matchup, so a matchup can't be voted on twice.
- **Index:** a partial index `votes (created_at) WHERE counted_at IS NULL` keeps finding pending votes fast, however many counted votes pile up.
- **`posts.elo` is up to one counting interval stale** (about 5 minutes). Rankings and matchups read it as-is.
