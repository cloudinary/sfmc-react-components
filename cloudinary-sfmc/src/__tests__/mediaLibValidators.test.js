import validators from '../mediaLibValidators';
import { enableFetchMocks } from 'jest-fetch-mock';
enableFetchMocks();

describe('isNotRestricted', () => {
  beforeEach(() => {
    fetch.resetMocks();
  });

  it('resolves when the plain secure_url is reachable', async () => {
    fetch.mockResponseOnce('', { status: 200 });
    const asset = { secure_url: 'https://res.cloudinary.com/demo/image/upload/pub.jpg' };
    await expect(
      validators.isNotRestricted({ asset, previewServerUrl: 'https://preview.example.com' })
    ).resolves.toBeUndefined();
    expect(fetch.mock.calls.length).toBe(1);
  });

  it('rejects when unreachable and no preview server is configured', async () => {
    fetch.mockResponseOnce('', { status: 401 });
    const asset = { secure_url: 'https://res.cloudinary.com/demo/image/upload/priv.jpg' };
    await expect(validators.isNotRestricted({ asset })).rejects.toBe('restricted');
  });

  it('resolves with a signed embargo preview url when the asset is genuinely embargoed', async () => {
    fetch.mockResponseOnce('', { status: 401 }); // the plain HEAD check
    fetch.mockResponseOnce(
      JSON.stringify({
        url: 'https://res.cloudinary.com/demo/image/upload/signed-token/pub.jpg',
        previewToken: '__cld_token__=exp=1~acl=x~hmac=y',
        embargoLiftsAt: '2026-12-01T00:00:00.000Z',
        accessControl: { access_type: 'token' }
      }),
      { status: 200 }
    );
    const asset = {
      public_id: 'pub',
      resource_type: 'image',
      type: 'upload',
      secure_url: 'https://res.cloudinary.com/demo/image/upload/pub.jpg'
    };
    await expect(
      validators.isNotRestricted({ asset, previewServerUrl: 'https://preview.example.com/' })
    ).resolves.toBeUndefined();

    expect(fetch.mock.calls[1][0]).toBe('https://preview.example.com/api/embargo-preview-url');
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({
      publicId: 'pub',
      resourceType: 'image',
      deliveryType: 'upload'
    });
    expect(asset.embargoPreviewUrl).toBe('https://res.cloudinary.com/demo/image/upload/signed-token/pub.jpg');
    expect(asset.embargoPreviewToken).toBe('__cld_token__=exp=1~acl=x~hmac=y');
    expect(asset.embargoLiftsAt).toBe('2026-12-01T00:00:00.000Z');
    expect(asset.accessControl).toEqual({ access_type: 'token' });
  });

  it('resolves as a normal asset when the preview server reports it public', async () => {
    fetch.mockResponseOnce('', { status: 403 });
    fetch.mockResponseOnce(JSON.stringify({ status: 'public' }), { status: 200 });
    const asset = {
      public_id: 'pub',
      resource_type: 'image',
      type: 'upload',
      secure_url: 'https://res.cloudinary.com/demo/image/upload/pub.jpg'
    };
    await expect(
      validators.isNotRestricted({ asset, previewServerUrl: 'https://preview.example.com' })
    ).resolves.toBeUndefined();
    expect(asset.embargoPreviewUrl).toBeUndefined();
    expect(asset.embargoLiftsAt).toBeUndefined();
    expect(asset.accessControl).toBeUndefined();
  });

  it('rejects when the preview server refuses (asset is not actually restricted)', async () => {
    fetch.mockResponseOnce('', { status: 401 });
    fetch.mockResponseOnce(JSON.stringify({ error: 'not_token_restricted' }), { status: 403 });
    const asset = {
      public_id: 'pub',
      resource_type: 'image',
      type: 'upload',
      secure_url: 'https://res.cloudinary.com/demo/image/upload/pub.jpg'
    };
    await expect(
      validators.isNotRestricted({ asset, previewServerUrl: 'https://preview.example.com' })
    ).rejects.toBe('restricted');
  });

  it('rejects when the preview server call itself errors', async () => {
    fetch.mockRejectOnce(new Error('network down'));
    const asset = {
      public_id: 'pub',
      resource_type: 'image',
      type: 'upload',
      secure_url: 'https://res.cloudinary.com/demo/image/upload/pub.jpg'
    };
    await expect(
      validators.isNotRestricted({ asset, previewServerUrl: 'https://preview.example.com' })
    ).rejects.toBe('restricted');
  });

  it('rejects (rather than throwing/unhandled-rejecting) when fetch itself throws synchronously', async () => {
    // Some browser extensions patch window.fetch and throw a plain
    // TypeError('Failed to fetch') instead of returning a rejected promise.
    fetch.mockImplementationOnce(() => {
      throw new TypeError('Failed to fetch');
    });
    fetch.mockImplementationOnce(() => {
      throw new TypeError('Failed to fetch');
    });
    const asset = {
      public_id: 'pub',
      resource_type: 'image',
      type: 'upload',
      secure_url: 'https://res.cloudinary.com/demo/image/upload/pub.jpg'
    };
    await expect(
      validators.isNotRestricted({ asset, previewServerUrl: 'https://preview.example.com' })
    ).rejects.toBe('restricted');
  });
});

describe('other validators are unaffected', () => {
  it('isNotOverSizeLimit still works', async () => {
    await expect(
      validators.isNotOverSizeLimit({ asset: { bytes: 1024 }, sizeLimit: 10 })
    ).resolves.toBeUndefined();
    await expect(
      validators.isNotOverSizeLimit({ asset: { bytes: 100 * 1024 * 1024 }, sizeLimit: 10 })
    ).rejects.toBe('tooBig');
  });
});
