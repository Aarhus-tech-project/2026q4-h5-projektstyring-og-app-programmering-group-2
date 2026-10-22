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
    devices {
        uuid id PK
        uuid user_id FK
        text push_token UK
        timestamptz last_seen_at
    }
    images {
        text hash PK
        text status
        int width
        int height
        bytea thumbhash
        timestamptz created_at
    }
    posts {
        uuid id PK
        uuid user_id FK
        text image_hash FK
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
        real winner_elo_before
        real loser_elo_before
        boolean winner_was_a
        timestamptz created_at
    }

    users ||--o{ devices : has
    users ||--o{ posts : creates
    images ||--o{ posts : "shown in"
    users ||--o{ matchups : "is shown"
    posts ||--o{ matchups : "appears in"
    matchups ||--o| votes : "decided by"
    posts ||--o{ votes : "wins / loses"
```