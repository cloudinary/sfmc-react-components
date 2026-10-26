import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, isTokenRestricted, embargoLiftsAt, isPublicNow } from '../app.js';

const FUTURE = '2099-12-01T00:00:00.000Z';
const PAST = '2000-01-01T00:00:00.000Z';

function fakeCloudinary({ resource, urlResult = 'https://res.cloudinary.com/demo/image/upload/signed/test' } = {}) {
  return {
    config: () => ({ cloud_name: 'demo' }),
    utils: {
      generate_auth_token: ({ acl }) => `__cld_token__=exp=1~acl=${encodeURIComponent(acl)}~hmac=x`
    },
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

test('isPublicNow is true only while an anonymous window is active', () => {
  const ENDED = '2001-01-01T00:00:00.000Z';
  assert.equal(isPublicNow({ access_control: [{ access_type: 'anonymous' }] }), true);
  assert.equal(isPublicNow({ access_control: [{ access_type: 'anonymous', start: PAST }] }), true);
  assert.equal(
    isPublicNow({ access_control: [{ access_type: 'anonymous', start: PAST, end: FUTURE }] }),
    true
  );
  assert.equal(
    isPublicNow({ access_control: [{ access_type: 'anonymous', start: PAST, end: ENDED }] }),
    false
  );
  assert.equal(isPublicNow({ access_control: [{ access_type: 'anonymous', start: FUTURE }] }), false);
  assert.equal(isPublicNow({ access_control: [{ access_type: 'token' }] }), false);
  assert.equal(isPublicNow({}), false);
});

test('embargoLiftsAt returns the earliest future anonymous start, or null', () => {
  const later = '2100-01-01T00:00:00.000Z';
  assert.equal(
    embargoLiftsAt({
      access_control: [
        { access_type: 'token' },
        { access_type: 'anonymous', start: later },
        { access_type: 'anonymous', start: FUTURE }
      ]
    }),
    FUTURE
  );
  assert.equal(embargoLiftsAt({ access_control: [{ access_type: 'token', start: FUTURE }] }), null);
  assert.equal(embargoLiftsAt({ access_control: [{ access_type: 'anonymous', start: PAST }] }), null);
  assert.equal(embargoLiftsAt({}), null);
});

test('POST /api/embargo-preview-url returns a signed url for a token-restricted asset', async () => {
  const resource = {
    public_id: 'demo/hero',
    access_control: [{ access_type: 'token' }, { access_type: 'anonymous', start: FUTURE }]
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
    assert.equal(body.status, 'embargoed');
    assert.equal(body.embargoLiftsAt, FUTURE);
    assert.ok(
      body.previewToken.includes(encodeURIComponent('/demo/image/upload/*demo/hero*')),
      body.previewToken
    );
  });
});

test('POST /api/embargo-preview-url reports a lifted embargo as public, without signing', async () => {
  const resource = {
    public_id: 'demo/lifted',
    access_control: [{ access_type: 'token' }, { access_type: 'anonymous', start: PAST, end: FUTURE }]
  };
  const app = createApp({
    cloudinary: fakeCloudinary({ resource }),
    accessControlKey: 'test-key'
  });

  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/embargo-preview-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicId: 'demo/lifted' })
    });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: 'public' });
  });
});

test('POST /api/embargo-preview-url refuses token-restricted assets with no scheduled lift', async () => {
  const resource = { public_id: 'demo/private', access_control: [{ access_type: 'token' }] };
  const app = createApp({
    cloudinary: fakeCloudinary({ resource }),
    accessControlKey: 'test-key'
  });

  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/embargo-preview-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicId: 'demo/private' })
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error, 'not_embargoed');
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
