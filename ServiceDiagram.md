## Services

```mermaid
flowchart LR
    app["Expo app<br/>(iOS / Android)"]
    cf["Cloudflare<br/>HTTPS + cache"]

    subgraph k8s["Kubernetes (k3s / any provider)"]
        tunnel["cloudflared"]
        gw["Gateway<br/>routes by path"]

        backend["Backend API<br/>ASP.NET Core<br/>(N replicas)"]
        worker["Media worker<br/>(N replicas)"]

        db[("PostgreSQL")]
        store[("Media store<br/>local disk or S3")]

        subgraph obs["Monitoring"]
            prom[("Prometheus<br/>metrics")]
            loki[("Loki<br/>logs")]
            grafana["Grafana"]
        end
    end

    app -- "domain/api/*<br/>domain/media/*" --> cf
    cf == "tunnel" ==> tunnel
    tunnel --> gw

    gw -- "/api/*" --> backend
    gw -- "/media/*" --> store

    backend -- "SQL + media jobs" --> db
    worker -- "claims jobs" --> db
    backend -- "saves uploads" --> store
    worker -- "writes processed media" --> store

    backend -. "logs" .-> loki
    worker -. "logs" .-> loki
    prom -. "scrapes metrics" .-> backend
    prom -. "scrapes metrics" .-> worker
    grafana -.-> prom
    grafana -.-> loki
```

- **Backend and worker are stateless**, so they scale by adding replicas. All state lives in Postgres and the media store.
- **Media store** sits behind one interface in the backend: local disk to start, any S3-compatible storage later, chosen by config. With local disk, a small nginx serves `/media/*` and everything runs on one node.
- **Postgres** runs as a container (CloudNativePG in Kubernetes). Keep each pod's connection pool small (`Max Pool Size`) so replicas × pool stays under Postgres' connection limit.
- **Monitoring:** logs go to Loki, Prometheus collects metrics, and Grafana shows both. It isn't exposed publicly.
- The same images run under `docker compose` for local development.

## Media upload flow

```mermaid
sequenceDiagram
    participant App as Expo app
    participant API as Backend API
    participant DB as PostgreSQL
    participant Store as Media store
    participant W as Media worker

    App->>API: PUT /api/uploads (photo or video)
    API->>Store: save to uploads/
    API->>DB: create job (pending)
    API-->>App: 202 Accepted + uploadId

    W->>DB: claim job (SKIP LOCKED)
    W->>Store: read upload
    W->>W: validate, strip metadata, re-encode to WebP + resize
    W->>Store: write variants/{hash}/{size}.webp
    W->>DB: mark ready

    App->>API: GET /api/media/{uploadId}
    API-->>App: ready + media URLs
    App->>Store: GET /media/... (cached at Cloudflare)
```
