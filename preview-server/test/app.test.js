import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, isTokenRestricted } from '../app.js';

function fakeCloudinary({ resource, urlResult = 'https://res.cloudinary.com/demo/image/upload/signed/test' } = {}) {
  return {
    api: {
      resource: async () => {
        // Real rejections from the Cloudinary SDK come in two shapes: a
        // plain Error, or a plain object like { error: { message, ... } }
        // with no top-level .message. Support both so tests can cover the
        // shape that previously produced "undefined" in error logs.
        if (resource instanceof Error || (resource && typeof resource === 'object' && 'error' in resource)) {
          throw resource;
        }
        return resource;
      }
    },
    url: () => urlResult
  };
}

async function withServer(app, fn) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('isTokenRestricted is true only when a token access_control rule is present', () => {
  assert.equal(isTokenRestricted({ access_control: [{ access_type: 'token' }] }), true);
  assert.equal(isTokenRestricted({ access_control: [{ access_type: 'anonymous' }] }), false);
  assert.equal(isTokenRestricted({ access_control: [] }), false);
  assert.equal(isTokenRestricted({}), false);
});

test('POST /api/embargo-preview-url returns a signed url for a token-restricted asset', async () => {
  const resource = {
    public_id: 'demo/hero',
    access_control: [{ access_type: 'token', start: '2026-12-01T00:00:00Z' }]
  };
  const app = createApp({
    cloudinary: fakeCloudinary({ resource }),
    accessControlKey: 'test-key'
  });

  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/embargo-preview-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicId: 'demo/hero' })
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.match(body.url, /^https:\/\/res\.cloudinary\.com\//);
    assert.equal(body.accessControl.access_type, 'token');
  });
});

test('POST /api/embargo-preview-url refuses assets that are not token-restricted', async () => {
  const resource = { public_id: 'demo/public-asset', access_control: [] };
  const app = createApp({
    cloudinary: fakeCloudinary({ resource }),
    accessControlKey: 'test-key'
  });

  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/embargo-preview-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicId: 'demo/public-asset' })
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error, 'not_token_restricted');
  });
});

test('POST /api/embargo-preview-url requires a publicId', async () => {
  const app = createApp({ cloudinary: fakeCloudinary({}), accessControlKey: 'test-key' });

  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/embargo-preview-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.equal(res.status, 400);
  });
});

test('POST /api/embargo-preview-url 500s clearly when the access control key is missing', async () => {
  const app = createApp({ cloudinary: fakeCloudinary({}), accessControlKey: undefined });

  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/embargo-preview-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicId: 'demo/hero' })
    });
    assert.equal(res.status, 500);
    const body = await res.json();
    assert.equal(body.error, 'server_misconfigured');
  });
});

test('POST /api/embargo-preview-url 404s when the asset lookup fails', async () => {
  const app = createApp({
    cloudinary: fakeCloudinary({ resource: new Error('not found') }),
    accessControlKey: 'test-key'
  });

  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/embargo-preview-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicId: 'demo/missing' })
    });
    assert.equal(res.status, 404);
  });
});

test('extracts a real message from a Cloudinary API-error-shaped rejection (no top-level .message)', async () => {
  // This is the shape the Cloudinary SDK actually throws for API errors
  // (e.g. missing/invalid credentials) — err.message is undefined on it,
  // which previously logged/returned the literal string "undefined".
  const app = createApp({
    cloudinary: fakeCloudinary({ resource: { error: { message: 'Invalid API key', http_code: 401 } } }),
    accessControlKey: 'test-key'
  });

  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/embargo-preview-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicId: 'demo/hero' })
    });
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.message, 'Invalid API key');
  });
});

test('rejects requests from an origin not on the allowlist', async () => {
  const resource = { public_id: 'demo/hero', access_control: [{ access_type: 'token' }] };
  const app = createApp({
    cloudinary: fakeCloudinary({ resource }),
    accessControlKey: 'test-key',
    allowedOrigins: ['https://sfmc-contentbuilder.cloudinary.com']
  });

  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/embargo-preview-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example.com' },
      body: JSON.stringify({ publicId: 'demo/hero' })
    });
    assert.equal(res.status, 403);
  });
});
