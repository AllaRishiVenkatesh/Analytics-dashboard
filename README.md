# Pulse — Session Analytics

A small full-stack analytics app: a vanilla-JS tracker you drop on any page,
an Express + MongoDB API that stores and aggregates the events, and a React
dashboard for browsing sessions and click heatmaps.

Built for the CausalFunnel Full Stack Engineer assignment.

```
causalfunnel-analytics/
├── tracker/        vanilla JS tracking script (no build step, no deps)
├── demo/           static demo storefront the tracker is installed on
├── server/         Express + Mongoose API
└── client/         React (Vite) dashboard
```

## Tech stack

| Layer      | Choice                              | Why |
|------------|--------------------------------------|-----|
| Tracker    | Vanilla JS, IIFE                    | Has to run on a page that knows nothing about React/npm — zero dependencies, ~5KB unminified. |
| API        | Node.js + Express                   | Required by the brief; minimal ceremony for a handful of REST endpoints. |
| Database   | MongoDB + Mongoose                  | Events are append-only, loosely structured (click events have extra fields page views don't) — a document store fits better than forcing everything into rigid relational columns. |
| Dashboard  | React 18 + Vite + React Router      | Fast dev loop, no framework overhead the assignment doesn't need (no SSR requirement, so plain Vite over Next.js). |
| Styling    | Hand-written CSS, no UI kit         | Full control over the look, and it's small enough not to need a component library. |

## How it fits together

1. The **tracker** (`tracker/tracker.js`) is a single script tag. On load it
   assigns/reuses a `session_id` in `localStorage` (idle sessions roll over
   after 30 minutes), fires a `page_view` event, and attaches a capturing
   `click` listener for the rest of the page's life. Events are batched in
   memory and flushed every 5 seconds, on hitting a batch size of 20, and
   immediately on tab close via `navigator.sendBeacon` so nothing is lost
   when the user just closes the tab.
2. The **demo storefront** (`demo/`) is two plain HTML pages with the tracker
   installed, so there's real data to look at without needing a separate app.
3. The **API** (`server/`) exposes a small REST surface over one `events`
   collection (see below) and runs all the session/heatmap aggregation in
   MongoDB itself rather than pulling raw events into Node and crunching them
   in JS.
4. The **dashboard** (`client/`) is two views: a sessions table (click a row
   to see that session's full event timeline) and a heatmap view that loads
   the actual demo page in an iframe and overlays click positions on top of
   it, so you're looking at where people clicked on the real page, not a
   floating grid.

## Data model

Every event is one document in a single `events` collection:

```js
{
  sessionId: "sess_...",       // from the tracker's localStorage id
  type: "page_view" | "click",
  url: "http://localhost:4000/demo/product.html",
  path: "/product.html",
  referrer: "...",
  timestamp: ISODate,
  // click-only:
  x, y,                        // raw pixel position (page coordinates)
  xPercent, yPercent,          // position as % of document width/height
  viewportWidth, viewportHeight, docWidth, docHeight,
  targetTag, targetId, targetClass, targetText,
  userAgent
}
```

Indexes: `{ sessionId: 1, timestamp: 1 }` for the session timeline query, and
`{ path: 1, type: 1 }` for the heatmap query. The sessions list is computed
with a `$group` aggregation over `sessionId` rather than maintaining a
separate `sessions` collection — at this scale that keeps the write path
simple (one insert per event, no two-table consistency to manage), and the
aggregation is index-backed.

**Why percentage coordinates too?** Raw pixel coordinates only make sense
relative to the document size they were captured at. Storing `xPercent` /
`yPercent` alongside `x` / `y` means the heatmap overlay can plot clicks
captured at any viewport size onto the page at its current rendered size and
still land in the right place.

## API

| Method | Route                              | Purpose |
|--------|-------------------------------------|---------|
| POST   | `/api/events`                       | Ingest one event or `{ events: [...] }`. |
| GET    | `/api/sessions?page=&limit=`        | Sessions with aggregate counts, newest activity first. |
| GET    | `/api/sessions/:sessionId/events`   | Full ordered event timeline for one session. |
| GET    | `/api/heatmap?path=/product.html`   | Click coordinates for one page. |
| GET    | `/api/pages`                        | Distinct tracked page paths, for the heatmap selector. |
| GET    | `/health`                           | Liveness check. |

The server also serves `/tracker` and `/demo` as static files, so the
dashboard's heatmap view can iframe the real demo pages.

## Setup

Requires Node 18+ and a MongoDB instance (local, Docker, or
[Atlas](https://www.mongodb.com/atlas)).

### 1. Start MongoDB

```bash
# local install
mongod --dbpath ./data

# or Docker
docker run -d -p 27017:27017 --name pulse-mongo mongo:7
```

### 2. Start the API

```bash
cd server
cp .env.example .env   # defaults already point at localhost:27017
npm install
npm run dev             # http://localhost:4000
```

### 3. Start the dashboard

```bash
cd client
cp .env.example .env
npm install
npm run dev              # http://localhost:5173
```

### 4. Generate some data

Open `http://localhost:4000/demo/index.html` in a browser, click around,
navigate to the shop page, click a few products. Then open
`http://localhost:5173` — your session will be in the Sessions view, and
your clicks will show up in the Heatmap view once you select that page.

You can repeat this in a private/incognito window (or clear localStorage) to
generate a second, distinct session.

> The demo pages hardcode the tracker endpoint as
> `http://localhost:4000/api/events` (see the `data-endpoint` attribute on
> the `<script>` tag in `demo/index.html` / `demo/product.html`). Change that
> if you run the API on a different host or port.

## Assumptions & trade-offs

- **Sessions are derived, not stored.** There's no `sessions` collection —
  a session is just "all events sharing a `sessionId`," computed on read via
  aggregation. Simpler to keep consistent, and fast enough at this scale
  because of the compound index; a high-volume production version would
  likely maintain a denormalized `sessions` collection updated on write.
- **Click target metadata (`targetTag`, `targetText`, etc.) is best-effort.**
  It's there to make the session timeline and heatmap tooltips legible
  ("clicked the *Add to cart* button" instead of "clicked at 412, 88"), not
  as a precise DOM selector — duplicate elements with the same text aren't
  disambiguated.
- **No auth.** The assignment is a tracking demo, not a multi-tenant
  product, so there's no API key/auth layer on ingestion or the dashboard.
  In a real deployment, `/api/events` would need a per-site write key and
  the dashboard would sit behind auth.
- **The heatmap overlay assumes the page's layout is stable.** Percentage
  coordinates correct for *viewport size* but not for content that changes
  between when a click was recorded and when you're viewing the heatmap
  (e.g. a banner that's since been removed would shift everything below it).
  Fine for a static demo storefront; a production heatmap tool would
  usually snapshot the page (screenshot or DOM clone) alongside the click
  data.
- **Tracker delivery is best-effort, not guaranteed.** Events are dropped
  silently on network failure rather than retried/queued to disk — correct
  for an analytics script (it should never block or break the host page),
  but means events can be lost if the API is down for an extended period.
- **Vite, not Next.js**, for the dashboard. The brief allows either; this app
  has no routes that need server rendering or API routes of its own (it
  already has a separate Express API), so Next.js would add build
  complexity without buying anything here.

## What I'd add next

- Server-Sent Events or polling-based live updates on the Sessions view
  instead of a manual refresh.
- Pagination/infinite scroll once a session list exceeds a page.
- A date-range filter on the heatmap and sessions views.
- Rate limiting on `POST /api/events`.
