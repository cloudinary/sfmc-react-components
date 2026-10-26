import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import CldAssetSelector from '../CldAssetSelector';

describe('embargo preview refresh', () => {
  beforeEach(() => {
    jest.spyOn(React, 'useContext').mockImplementation(() => ({
      cld: { url: jest.fn().mockReturnValue('https://example.com/thumb.jpg') }
    }));
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.fetch;
  });

  it('requests a fresh signed url and calls setValue when the current preview fails to load', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        url: 'https://res.cloudinary.com/demo/image/upload/signed-refreshed/pub.jpg',
        previewToken: '__cld_token__=exp=2~acl=x~hmac=y',
        embargoLiftsAt: '2026-12-01T00:00:00.000Z',
        accessControl: { access_type: 'token' }
      })
    });
    const mockSetValue = jest.fn();
    const mockValue = {
      public_id: 'pub',
      resource_type: 'image',
      type: 'upload',
      embargoPreviewUrl: 'https://res.cloudinary.com/demo/image/upload/signed-expired/pub.jpg',
      accessControl: { access_type: 'token' }
    };
    render(
      <CldAssetSelector
        value={mockValue}
        setValue={mockSetValue}
        previewServerUrl="https://preview.example.com"
      />
    );
    const img = document.querySelector('img.preview-img');
    fireEvent.error(img);

    await waitFor(() => {
      expect(mockSetValue).toHaveBeenCalledWith(
        expect.objectContaining({
          public_id: 'pub',
          embargoPreviewUrl:
            'https://res.cloudinary.com/demo/image/upload/signed-refreshed/pub.jpg',
          embargoPreviewToken: '__cld_token__=exp=2~acl=x~hmac=y',
          embargoLiftsAt: '2026-12-01T00:00:00.000Z'
        })
      );
    });
    expect(fetch).toHaveBeenCalledWith(
      'https://preview.example.com/api/embargo-preview-url',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('falls back to the broken-image placeholder if the refresh itself fails, without retrying again', async () => {
    fetch.mockResolvedValueOnce({ ok: false });
    const mockValue = {
      public_id: 'pub',
      resource_type: 'image',
      type: 'upload',
      embargoPreviewUrl: 'https://res.cloudinary.com/demo/image/upload/signed-expired/pub.jpg',
      accessControl: { access_type: 'token' }
    };
    render(<CldAssetSelector value={mockValue} previewServerUrl="https://preview.example.com" />);
    const img = document.querySelector('img.preview-img');
    fireEvent.error(img);

    await waitFor(() => {
      expect(img.src).toContain('PageDesigner/warning.png');
    });

    // A second failure (e.g. the placeholder image itself erroring) must
    // not trigger another network call — only one refresh per selection.
    fetch.mockClear();
    fireEvent.error(img);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not attempt a refresh when no previewServerUrl is configured', () => {
    const mockValue = {
      public_id: 'pub',
      embargoPreviewUrl: 'https://res.cloudinary.com/demo/image/upload/signed-expired/pub.jpg',
      accessControl: { access_type: 'token' }
    };
    render(<CldAssetSelector value={mockValue} />);
    const img = document.querySelector('img.preview-img');
    fireEvent.error(img);
    expect(fetch).not.toHaveBeenCalled();
    expect(img.src).toContain('PageDesigner/warning.png');
  });

  it('does not attempt a refresh for a plain broken image with no access_control', () => {
    const mockValue = { public_id: 'pub', secure_url: 'https://example.com/broken.jpg' };
    render(<CldAssetSelector value={mockValue} previewServerUrl="https://preview.example.com" />);
    const img = document.querySelector('img.preview-img');
    fireEvent.error(img);
    expect(fetch).not.toHaveBeenCalled();
    expect(img.src).toContain('PageDesigner/warning.png');
  });

  it('drops the embargo state when the refresh reports the asset as public', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'public' }) });
    const mockSetValue = jest.fn();
    const mockValue = {
      public_id: 'pub',
      resource_type: 'image',
      type: 'upload',
      embargoPreviewUrl: 'https://res.cloudinary.com/demo/image/upload/signed-expired/pub.jpg',
      embargoPreviewToken: '__cld_token__=exp=1~acl=x~hmac=y',
      embargoLiftsAt: '2026-10-22T12:45:00.000Z',
      accessControl: { access_type: 'token' }
    };
    render(
      <CldAssetSelector
        value={mockValue}
        setValue={mockSetValue}
        previewServerUrl="https://preview.example.com"
      />
    );
    const img = document.querySelector('img.preview-img');
    fireEvent.error(img);

    await waitFor(() => {
      expect(mockSetValue).toHaveBeenCalledWith({
        public_id: 'pub',
        resource_type: 'image',
        type: 'upload'
      });
    });
    expect(document.querySelector('img.preview-img').src).toBe('https://example.com/thumb.jpg');
  });

  it('shows the embargo lift date in the warning banner', () => {
    const liftsAt = '2026-12-01T00:00:00.000Z';
    const mockValue = {
      public_id: 'pub',
      embargoPreviewUrl: 'https://res.cloudinary.com/demo/image/upload/signed/pub.jpg',
      embargoLiftsAt: liftsAt,
      accessControl: { access_type: 'token' }
    };
    const { container } = render(<CldAssetSelector value={mockValue} />);
    expect(container.textContent).toContain(`until ${new Date(liftsAt).toLocaleString()}`);
  });
});
