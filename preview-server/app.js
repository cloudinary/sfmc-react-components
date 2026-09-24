import express from 'express';
import cors from 'cors';

const DEFAULT_PREVIEW_TTL_SECONDS = 300;

// True when a Cloudinary asset's `access_control` rules include a `token`
// entry — i.e. the asset is currently Cloudinary Access Control-restricted.
// This is the embargo pattern: `token` now, flips to `anonymous`/public on
// its own at the rule's `start` date. We treat any other reason an asset
// might be unreachable (deleted, wrong resource type, network error) as out
// of scope for this endpoint and refuse to sign it.
export function isTokenRestricted(resource) {
  return (
    Array.isArray(resource?.access_control) &&
    resource.access_control.some((rule) => rule?.access_type === 'token')
  );
}

function tokenRule(resource) {
  return resource.access_control.find((rule) => rule?.access_type === 'token');
}

// The Cloudinary Node SDK doesn't always reject with a plain Error — API
// errors often come back shaped like `{ error: { message, http_code } }`,
// where `.message` is undefined but the real reason is at `.error.message`.
// Logging `err.message` alone silently produces "undefined" for exactly the
// cases (bad/missing credentials, auth failures) most worth seeing clearly.
function describeCloudinaryError(err) {
  if (!err) return 'unknown error';
  if (typeof err === 'string') return err;
  if (err.error && err.error.message) return err.error.message;
  if (err.message) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/**
 * @param {object} deps
 * @param {object} deps.cloudinary - an initialized `cloudinary` v2 SDK instance
 *   (already `.config()`-ured with cloud_name/api_key/api_secret so
 *   `cloudinary.api.resource` can look assets up).
 * @param {string} deps.accessControlKey - the Cloudinary Access Control Key
 *   used to sign preview URLs. Distinct from the account's API secret.
 * @param {string[]} [deps.allowedOrigins] - origins allowed to call this
 *   service (the deployed SFMC content-builder app's origin(s)).
 * @param {number} [deps.previewTtlSeconds] - how long a signed preview URL
 *   stays valid.
 */
export function createApp({
  cloudinary,
  accessControlKey,
  allowedOrigins = [],
  previewTtlSeconds = DEFAULT_PREVIEW_TTL_SECONDS
}) {
  if (!cloudinary) {
    throw new Error('createApp requires a configured cloudinary SDK instance');
  }

  const app = express();
  app.use(express.json());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          // eslint-disable-next-line no-console
          console.error(
            `Rejected request from origin "${origin}" — not in ALLOWED_ORIGINS (${allowedOrigins.join(', ') || '<empty>'})`
          );
          callback(new Error('Origin not allowed'));
        }
      }
    })
  );

  app.use((req, res, next) => {
    // eslint-disable-next-line no-console
    console.log(`${req.method} ${req.path} from origin "${req.headers.origin || '<none>'}"`);
    next();
  });

  app.get('/healthz', (req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/embargo-preview-url', async (req, res) => {
    if (!accessControlKey) {
      res.status(500).json({ error: 'server_misconfigured', message: 'Access control key is not configured' });
      return;
    }

    const { publicId, resourceType = 'image', deliveryType = 'upload' } = req.body || {};
    if (!publicId) {
      res.status(400).json({ error: 'invalid_request', message: 'publicId is required' });
      return;
    }

    let resource;
    try {
      resource = await cloudinary.api.resource(publicId, {
        resource_type: resourceType,
        type: deliveryType
      });
    } catch (err) {
      const message = describeCloudinaryError(err);
      // eslint-disable-next-line no-console
      console.error(`Cloudinary resource lookup failed for ${publicId}:`, message);
      res.status(404).json({ error: 'asset_not_found', message });
      return;
    }

    if (!isTokenRestricted(resource)) {
      // Not a real embargo case — refuse rather than hand back a signed URL
      // for an asset that doesn't need one. Callers should fall back to
      // whatever normal "this asset is unavailable" handling they already
      // have for this response.
      res.status(403).json({ error: 'not_token_restricted', message: 'Asset is not embargoed' });
      return;
    }

    let url;
    try {
      url = cloudinary.url(publicId, {
        resource_type: resourceType,
        type: deliveryType,
        sign_url: true,
        auth_token: { key: accessControlKey, duration: previewTtlSeconds },
        secure: true
      });
    } catch (err) {
      const message = describeCloudinaryError(err);
      // eslint-disable-next-line no-console
      console.error('Failed to sign embargo preview url:', message);
      res.status(500).json({ error: 'sign_failed', message });
      return;
    }

    res.json({
      url,
      expiresInSeconds: previewTtlSeconds,
      accessControl: tokenRule(resource)
    });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err && err.message === 'Origin not allowed') {
      res.status(403).json({ error: 'origin_not_allowed' });
      return;
    }
    const message = describeCloudinaryError(err);
    // eslint-disable-next-line no-console
    console.error('Unhandled error in preview server:', message);
    res.status(500).json({ error: 'internal_error', message });
  });

  return app;
}
