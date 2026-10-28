## Services

```mermaid
flowchart LR
    app["Expo app<br/>(iOS / Android)"]
    cf["Cloudflare<br/>HTTPS"]

    subgraph azure["Azure Blob Storage"]
        uploads[("uploads<br/>private")]
        media[("media<br/>public read")]
    end

    subgraph k8s["Kubernetes (k3s / any provider)"]
        tunnel["cloudflared"]
        gw["Gateway"]

        backend["Backend API<br/>ASP.NET Core<br/>(N replicas)"]
        worker["Media worker<br/>(N replicas)"]

        db[("PostgreSQL")]

        subgraph obs["Monitoring"]
            prom[("Prometheus<br/>metrics")]
            loki[("Loki<br/>logs")]
            grafana["Grafana"]
        end
    end

    app -- "domain/api/*" --> cf
    cf == "tunnel" ==> tunnel
    tunnel --> gw
    gw -- "/api/*" --> backend

    app -- "GET media directly" --> media

    backend -- "SQL + media jobs" --> db
    worker -- "claims jobs" --> db
    backend -- "saves originals" --> uploads
    worker -- "reads originals" --> uploads
    worker -- "writes variants" --> media

    backend -. "logs" .-> loki
    worker -. "logs" .-> loki
    backend -. "metrics (OTLP)" .-> prom
    worker -. "metrics (OTLP)" .-> prom
    grafana -.-> prom
    grafana -.-> loki
    grafana -.-> db
```

- **Backend and worker are stateless**, so they scale by adding replicas. All state lives in Postgres and Azure Blob Storage.
- **Azure Blob Storage** holds all media in two containers:
  - `uploads` is private and holds the originals with metadata intact. Only the backend and worker can access it. A lifecycle rule deletes originals N days after processing.
  - `media` allows anonymous blob-level read, so blobs can be fetched by exact path but the container can't be listed. It holds the processed variants.
- **The app fetches media directly from Azure.** Media never goes through the cluster. The DB stores blob keys (`variants/{hash}/{size}.webp`), not full URLs. The API builds URLs from a `MediaBaseUrl` config value (`https://<account>.blob.core.windows.net/media`).
- **Variants are content-addressed and immutable.** They are written with `Cache-Control: public, max-age=31536000, immutable`, so the app can cache them forever.
- **Credentials:** the backend and worker authenticate with a connection string stored as a Kubernetes Secret. The app never holds storage credentials.
- **Postgres** runs as a container (CloudNativePG in Kubernetes). Keep each pod's connection pool small (`Max Pool Size`) so replicas × pool stays under Postgres' connection limit.
- **Monitoring:** the backend and worker push logs to Loki and metrics to Prometheus over OTLP. Grafana shows both, plus app data queried straight from Postgres. It isn't exposed publicly.
- **Local development** runs the same images under `docker compose`, with Azurite (the Azure Storage emulator) standing in for Blob Storage. Only the connection string and `MediaBaseUrl` differ.

## Media upload flow

```mermaid
sequenceDiagram
    participant App as Expo app
    participant API as Backend API
    participant DB as PostgreSQL
    participant Up as Blob: uploads
    participant Media as Blob: media
    participant W as Media worker

    App->>API: PUT /api/uploads (photo or video)
    API->>Up: save original
    API->>DB: create job (pending)
    API-->>App: 202 Accepted + uploadId

    W->>DB: claim job (SKIP LOCKED)
    W->>Up: read original
    W->>W: validate, strip metadata, re-encode to WebP + resize
    W->>Media: write variants/{hash}/{size}.webp
    W->>DB: mark ready

    App->>API: GET /api/media/{uploadId}
    API-->>App: ready + media URLs
    App->>Media: GET variants/... (direct from Azure)
```