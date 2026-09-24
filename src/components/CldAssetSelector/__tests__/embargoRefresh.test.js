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
        accessControl: { access_type: 'token', start: '2026-12-01T00:00:00Z' }
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
          embargoPreviewUrl: 'https://res.cloudinary.com/demo/image/upload/signed-refreshed/pub.jpg'
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
});
