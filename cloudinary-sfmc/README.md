This example was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

It is linked to the sf-component-lib2 package in the parent directory for development purposes.

## Getting Started

1. Run `yarn install` to install dependencies
2. Run `yarn start` to start the development server
3. Open the following URL in your browser:

```
https://localhost:3000/web-image?cloudName=<cloud_name>&apiKey=<api_key>
```

**Note:** Use a development or sandbox cloud for local testing — not a production
cloud. The `cloudName` and `apiKey` are passed as query parameters and are visible
in browser history, dev-server logs, and referrer headers.

### Testing embargoed-asset previews

To exercise the embargo preview flow (see [`../preview-server`](../preview-server)),
run that service locally and pass its URL as an extra query param:

```
http://localhost:3000/web-image?cloudName=<cloud_name>&apiKey=<api_key>&previewServerUrl=http://localhost:8787
```

**Use `http://`, not `https://`, for this.** `preview-server` is a plain HTTP
service; if the page itself is loaded over HTTPS (this app's default `yarn
start` sets `HTTPS=true`), Chrome silently upgrades the `fetch()` call to
`preview-server` to `https://` before sending it, which fails outright against
a plain HTTP server (`ERR_SSL_PROTOCOL_ERROR`) rather than falling back to
HTTP. Start the dev server with HTTPS disabled for this test instead of the
default `yarn start`:

```bash
HTTPS=false node ../node_modules/react-scripts/bin/react-scripts.js start
```

Then pick an asset in your sandbox cloud that has a `token` Access Control rule
(Cloudinary's embargo pattern). Without `previewServerUrl` set, embargoed assets
still show the pre-existing "This asset is restricted" block.

### Jumping straight to a known asset

By default, clicking "Choose Image" for the first time opens the Media Library
Widget on a flat list of all assets. To skip straight to one specific,
already-known asset instead (handy for repeatedly testing against the same
embargoed asset) — pass its `public_id`:

```
.../web-image?cloudName=<cloud_name>&apiKey=<api_key>&initialAsset=UTMB-D
```

This only affects the very first open, before anything has been selected —
once an asset is chosen, clicking "Replace" always reopens on that selection
regardless of `initialAsset`.
