import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Formsy from 'formsy-react';
import ImageSelector from '../ImageSelector';

const analytics = { version: '1.0.0', environment: 'test' };

beforeEach(() => {
  jest.spyOn(React, 'useContext').mockImplementation(() => ({
    cld: { url: jest.fn().mockReturnValue('https://example.com/test.jpg') }
  }));
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('selectImage opts', () => {
  it('opens on the asset list view (search) when nothing is selected and no initialAsset is set', async () => {
    const user = userEvent.setup();
    const mockOpen = jest.fn();
    render(
      <Formsy>
        <ImageSelector
          name={'test-selector'}
          analytics={analytics}
          openCldAssetSelector={mockOpen}
        />
      </Formsy>
    );
    await user.click(screen.getByRole('button', { name: /choose image/i }));
    expect(mockOpen).toHaveBeenCalledTimes(1);
    const opts = mockOpen.mock.calls[0][1];
    expect(opts.search).toEqual({ expression: 'resource_type:image' });
    expect(opts.folder).toBeUndefined();
    expect(opts.asset).toBeUndefined();
  });

  it('opens directly on initialAsset when nothing is selected yet and initialAsset is configured', async () => {
    const user = userEvent.setup();
    const mockOpen = jest.fn();
    render(
      <Formsy>
        <ImageSelector
          name={'test-selector'}
          analytics={analytics}
          openCldAssetSelector={mockOpen}
          initialAsset="UTMB-D"
        />
      </Formsy>
    );
    await user.click(screen.getByRole('button', { name: /choose image/i }));
    const opts = mockOpen.mock.calls[0][1];
    expect(opts.asset).toEqual({ public_id: 'UTMB-D', resource_type: 'image', type: 'upload' });
    expect(opts.search).toBeUndefined();
  });

  it('opens on the already-selected asset when one is set, ignoring initialAsset', async () => {
    const user = userEvent.setup();
    const mockOpen = jest.fn();
    const mockValue = {
      asset: {
        public_id: 'already-selected',
        resource_type: 'image',
        type: 'upload',
        secure_url: 'https://example.com/test.png'
      },
      width: 400,
      height: 400
    };
    render(
      <Formsy>
        <ImageSelector
          name={'test-selector'}
          analytics={analytics}
          openCldAssetSelector={mockOpen}
          prevValue={mockValue}
          initialAsset="UTMB-D"
        />
      </Formsy>
    );
    await user.click(screen.getByRole('button', { name: /replace/i }));
    const opts = mockOpen.mock.calls[0][1];
    expect(opts.asset).toEqual({
      public_id: 'already-selected',
      resource_type: 'image',
      type: 'upload'
    });
  });
});
