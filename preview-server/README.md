# SFMC embargo preview server

A small standalone Express service used only for one thing: signing
short-lived preview URLs for **embargoed** Cloudinary assets (assets with a
`token` Access Control rule that automatically flips to `anonymous`/public at
a scheduled date), so an SFMC content-block author can preview them before
the embargo lifts.

This exists because `cloudinary-sfmc/` is a pure client-side app — it has no
access to any Cloudinary secret. Signing an authenticated delivery URL needs
one (the **Access Control Key**, provisioned by Cloudinary Support — distinct
from the account's API key/secret), which must never reach the browser
bundle. Hence a separate service.

## What it does

`POST /api/embargo-preview-url` with `{ publicId, resourceType, deliveryType }`:

1. Looks the asset up via the Cloudinary Admin API (server-to-server, using
   the account's own API key/secret) to read its real `access_control` rules
   — the client's claim about an asset is never trusted directly.
2. If the asset doesn't actually carry a `token` access-control rule, refuses
   with `403 not_token_restricted`. This endpoint only ever signs genuinely
   embargoed assets.
3. Otherwise returns a signed, short-lived (`PREVIEW_TTL_SECONDS`, default
   300s) authenticated delivery URL built with the official Cloudinary SDK
   and the Access Control Key, plus the matching `access_control` rule (so
   the caller can show the marketer when the embargo actually lifts).

The **final** email HTML is never built from this signed URL — only the
plain, normal Cloudinary delivery URL is saved as content, so it starts
working the moment the embargo lifts and doesn't depend on this service or
a token that will have long since expired.

## Configuration

Copy `.env.example` to `.env` and fill in:

- `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` —
  used only for the read-only Admin API lookup.
- `CLOUDINARY_ACCESS_CONTROL_KEY` — from Cloudinary Support. Keep this out of
  any client-facing config; it never leaves this service.
- `ALLOWED_ORIGINS` — comma-separated list of origins allowed to call this
  service (the deployed `cloudinary-sfmc` app's origin(s)). Leave empty only
  for local development.
- `PREVIEW_TTL_SECONDS` — how long a signed preview URL stays valid. Keep
  this short: it only needs to survive one editor session.

## Running it

```bash
yarn install
yarn dev      # node --watch index.js
# or
yarn start
```

## Testing

```bash
yarn test     # node --test, uses a fake cloudinary client — no network calls
```

## Deploying

This is a plain Express app — deploy it anywhere that runs Node 20+ (Render,
a Lambda + API Gateway, etc.). Point the `cloudinary-sfmc` app at it via the
`previewServerUrl` query parameter (see the root README).

### Render

A [Render Blueprint](https://render.com/docs/blueprint-spec) is included at
the repo root (`render.yaml`) and defines **two** services together, so
nobody needs to run anything locally to try this:

- `sfmc-embargo-preview-server` — this service (a `web`/`node` service
  rooted at `preview-server/`, health check on `/healthz`).
- `sfmc-embargo-demo` — the `cloudinary-sfmc` demo app itself, built and
  published as a static site (it's a plain Create React App). Its
  `cloudName`/`apiKey`/`previewServerUrl` are all read from the page's own
  URL query string at runtime, so the static build doesn't need to know
  preview-server's URL ahead of time — see `cloudinary-sfmc/README.md`.

To deploy both:

1. In the Render dashboard, create a new Blueprint from this repo (or a fork
   of it). Render provisions both services from the one `render.yaml`.
2. Fill in the env vars marked `sync: false` on `sfmc-embargo-preview-server`
   (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`,
   `CLOUDINARY_ACCESS_CONTROL_KEY`, `ALLOWED_ORIGINS`) directly in the
   dashboard — none of these are committed.
3. Once `sfmc-embargo-demo` has its first deploy, note its URL — Render uses
   the service's `name` as its subdomain, so this is
   `https://sfmc-embargo-demo.onrender.com` (a numeric suffix only appears
   if that subdomain is already taken by another Render account). Set that
   as `ALLOWED_ORIGINS` on `sfmc-embargo-preview-server` (exact origin, no
   trailing slash), then manually redeploy that service so it picks up the
   change. This one manual step exists because the two services deploy
   independently and each needs to reference the other's URL; leaving
   `ALLOWED_ORIGINS` blank works but allows every origin, which is fine for
   your own local testing but not once this is live for anyone to hit.
4. Share the demo's URL with the `previewServerUrl` query param appended,
   e.g. `https://sfmc-embargo-demo.onrender.com/web-image?cloudName=<cloud>&apiKey=<key>&previewServerUrl=https://sfmc-embargo-preview-server.onrender.com`
   — anyone who opens that link can try the embargo preview flow with no
   local setup at all.

## Known limitations / follow-ups

- Video-to-GIF (`Video2Gif.js`) still hard-blocks restricted source videos;
  this service and the validator change only cover the Image content block.
- A stale signed preview URL (past its TTL) is refreshed lazily: `CldAssetSelector`
  re-requests a fresh one the moment the browser fails to load the current
  one (`<img onError>`), which covers reopening a previously-saved content
  block after the token has expired. It does **not** cover an already-open
  block sitting idle past the TTL without any reload — there's no background
  timer re-signing it while mounted. The saved/sent HTML is unaffected either
  way, since it never used the signed URL.
