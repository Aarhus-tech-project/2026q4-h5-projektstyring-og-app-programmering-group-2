## Services

```mermaid
flowchart LR
    app["Expo app<br/>(iOS / Android)"]
    cf["Cloudflare<br/>HTTPS + cache"]

    subgraph k8s["Kubernetes (k3s / any provider)"]
        tunnel["cloudflared"]
        gw["Gateway<br/>routes by path"]

        backend["Backend API<br/>ASP.NET Core<br/>(N replicas)"]
        worker["Image worker<br/>(N replicas)"]

        db[("PostgreSQL")]
        store[("Image store<br/>local disk or S3")]

        subgraph obs["Monitoring"]
            prom[("Prometheus<br/>metrics")]
            loki[("Loki<br/>logs")]
            grafana["Grafana"]
        end
    end

    app -- "domain/api/*<br/>domain/img/*" --> cf
    cf == "tunnel" ==> tunnel
    tunnel --> gw

    gw -- "/api/*" --> backend
    gw -- "/img/*" --> store

    backend -- "SQL + image jobs" --> db
    worker -- "claims jobs" --> db
    backend -- "saves uploads" --> store
    worker -- "writes resized images" --> store

    backend -. "logs" .-> loki
    worker -. "logs" .-> loki
    prom -. "scrapes metrics" .-> backend
    prom -. "scrapes metrics" .-> worker
    grafana -.-> prom
    grafana -.-> loki
```

- **Backend and worker are stateless**, so they scale by adding replicas. All state lives in Postgres and the image store.
- **Image store** sits behind one interface in the backend: local disk to start, any S3-compatible storage later, chosen by config. With local disk, a small nginx serves `/img/*` and everything runs on one node.
- **Postgres** runs as a container (CloudNativePG in Kubernetes). Keep each pod's connection pool small (`Max Pool Size`) so replicas × pool stays under Postgres' connection limit.
- **Monitoring:** logs go to Loki, Prometheus collects metrics, and Grafana shows both. It isn't exposed publicly.
- The same images run under `docker compose` for local development.

## Image upload flow

```mermaid
sequenceDiagram
    participant App as Expo app
    participant API as Backend API
    participant DB as PostgreSQL
    participant Store as Image store
    participant W as Image worker

    App->>API: PUT /api/uploads (image)
    API->>Store: save to uploads/
    API->>DB: create job (pending)
    API-->>App: 202 Accepted + uploadId

    W->>DB: claim job (SKIP LOCKED)
    W->>Store: read upload
    W->>W: validate, strip GPS, resize
    W->>Store: write variants/{hash}/{size}.webp
    W->>DB: mark ready

    App->>API: GET /api/images/{uploadId}
    API-->>App: ready + image URLs
    App->>Store: GET /img/... (cached at Cloudflare)
```
