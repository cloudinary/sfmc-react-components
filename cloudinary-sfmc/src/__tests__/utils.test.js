import { buildHtml, uploadToCld, buildImageUrl, pollImageReady, buildGifUrl, buildGifHtml, getGifDuration, embargoPreviewSourceUrl } from '../utils';
import { enableFetchMocks } from 'jest-fetch-mock';
import {default as cloudinary} from 'cloudinary-core';
enableFetchMocks();

describe('buildHtml tests', () => {
  const IMAGE_URL = 'http://example.com/image.jpg';
  const ALT = 'alt text';
  const SCALE = {width: 800, height: 1920};
  const cldMock = {
    config: jest.fn().mockReturnValue({cloud_name: 'demo', secure: true})
  };
  it('test buildHtml defaults', () => {
    const outHtml = buildHtml(IMAGE_URL, cldMock, ALT, 'center', SCALE);
    const newNode = document.createElement('div');
    newNode.innerHTML = outHtml;
    const img = newNode.querySelector('img');
    expect(img.getAttribute('src')).toBe(IMAGE_URL);
    expect(img.getAttribute('alt')).toBe(ALT);
    let d = newNode.querySelector('div');
    const css = d.getAttribute('style');
    expect(css).toBe('text-align: center;');
  });
  it('test buildHtml align', () => {
    let outHtml = buildHtml(IMAGE_URL, cldMock, ALT, 'right', SCALE, null, null);
    let newNode = document.createElement('div');
    newNode.innerHTML = outHtml;
    let d = newNode.querySelector('div');
    let css = d.getAttribute('style');
    expect(css).toBe('text-align: right;');

    outHtml = buildHtml(IMAGE_URL, cldMock, ALT, 'left', SCALE, null, null);
    newNode = document.createElement('div');
    newNode.innerHTML = outHtml;
    d = newNode.querySelector('div');
    css = d.getAttribute('style');
    expect(css).toBe('text-align: left;');
  });
  it('test buildHtml responsive', () => {
    const outHtml = buildHtml(IMAGE_URL, cldMock, ALT, null, SCALE, 'https://example.com/responsive', null);
    const newNode = document.createElement('div');
    newNode.innerHTML = outHtml;
    const img = newNode.querySelector('img');
    expect(img.getAttribute('data-src-cache')).toBe('https://example.com/responsive');
    expect(img.getAttribute('class')).toBe('cld-responsive');
    const s = newNode.querySelector('script');
    expect(s).not.toBe(null);
  });
  it('test buildHtml lqip', () => {
    const outHtml = buildHtml(IMAGE_URL, cldMock, ALT, null, SCALE, null, 'https://example.com/lqip');
    const newNode = document.createElement('div');
    newNode.innerHTML = outHtml;
    const img = newNode.querySelector('img');
    expect(img.getAttribute('src')).toBe('https://example.com/lqip');
    expect(img.getAttribute('data-real-src')).toBe(IMAGE_URL);
    expect(img.getAttribute('class')).toBe('cld-lqip');
    const s = newNode.querySelector('script');
    expect(s).not.toBe(null);
  });
});

describe('uploadToCld tests', () => {
  beforeEach(() => {
    fetch.resetMocks();
  });

  it('test upload payload', (done) => {
    const d = {asset: {public_id: 1234}};
    fetch.mockResponse(JSON.stringify(d));
    try {
      uploadToCld('dddddddddddddddd', { cloud_name: 'sfmc-test-cloud', secure: true }, (val) => {
        expect(val.ovEd.overlay).toEqual(d);
        done();
      });
    } catch (e) {
      console.log(e);
    }
  });
  it('test upload parameters', (done) => {
    const d = {asset: {public_id: 1234}};
    fetch.mockResponse(JSON.stringify(d));
    try {
      uploadToCld('dddddddddddddddd', { cloud_name: 'sfmc-test-cloud', secure: true }, () => {
        expect(fetch.mock.calls[0][0]).toEqual('https://api.cloudinary.com/v1_1/sfmc-test-cloud/image/upload');
        expect(fetch.mock.calls[0][1].method).toBe('POST');
        expect(fetch.mock.calls[0][1].body.get('tags')).toBe('sfmc_int');
        expect(fetch.mock.calls[0][1].body.get('upload_preset')).toBe('sfmc_preset');
        expect(fetch.mock.calls[0][1].body.get('file').type).toBe('image/svg+xml');
        done();
      });
    } catch (e) {
      console.log(e);
    }
  });
});

describe('test build image url', () => {
  const SCALE = {width: 800, height: 1920};
  const ASSET ={public_id: 'test123'};
  let cld;
  let cldSpy;
  beforeEach(() => {
    cld = cloudinary.Cloudinary.new({cloud_name: 'sfmc-test-cloud', secure: true});
    cldSpy = jest.spyOn(cld, 'url');
    cldSpy.mockClear();
  });
  it('test no public id', () => {
    const state = {};
    const u = buildImageUrl(state, cld);
    expect(u).toBe(null);
  });

  it('test simple asset', () => {
    const expectedTrans = [
      {
        'fetchFormat': 'auto',
        'quality': 'auto'
      },
      {
        'crop': 'limit',
        'width': SCALE.width,
        'height': SCALE.height
      }
    ];
    const expected = `https://res.cloudinary.com/sfmc-test-cloud/image/upload/f_auto,q_auto/c_limit,h_${SCALE.height},w_${SCALE.width}/test123?_i=AI`;
    const u = buildImageUrl(ASSET, cld, SCALE);
    expect(cldSpy.mock.calls[0][0]).toEqual('test123');
    expect(cldSpy.mock.calls[0][1].transformation).toEqual(expectedTrans);
    expect(u).toBe(expected);
  });
  it('test transformation override', () => {
    const u = buildImageUrl(ASSET, cld, SCALE, null, 'a_90,e_34');
    expect(cldSpy.mock.calls[0][1].transformation[0].raw_transformation).toEqual('a_90,e_34');
    expect(u).toBeTruthy();
  });
  it('test derived transformation', () => {
    const derived = {
      'url': 'http://res.cloudinary.com/sfmc-test-cloud/image/upload/c_fill,g_auto,h_250,w_970/b_rgb:000000,e_gradient_fade,y_-0.50/c_scale,co_rgb:ffffff,fl_relative,l_text:montserrat_25_style_light_align_center:Shop%20Now,w_0.5,y_0.18/v1626265026/test123.png',
      'secure_url': 'https://res.cloudinary.com/sfmc-test-cloud/image/upload/c_fill,g_auto,h_250,w_970/b_rgb:000000,e_gradient_fade,y_-0.50/c_scale,co_rgb:ffffff,fl_relative,l_text:montserrat_25_style_light_align_center:Shop%20Now,w_0.5,y_0.18/v1626265026/test123.png',
      'raw_transformation': 'c_fill,g_auto,h_250,w_970/b_rgb:000000,e_gradient_fade,y_-0.50/c_scale,co_rgb:ffffff,fl_relative,l_text:montserrat_25_style_light_align_center:Shop%20Now,w_0.5,y_0.18'
    };
    let ast = { ...ASSET, derived: [derived] };
    const u = buildImageUrl(ast, cld, SCALE);
    expect(cldSpy.mock.calls[0][1].transformation[1].raw_transformation).toEqual(derived.raw_transformation);
    expect(u).toBeTruthy();
  });
  it('test image overlay', () => {
    const u = buildImageUrl(ASSET, cld, SCALE, null, null, null, {public_id: 'test_overlay'});
    expect(cldSpy.mock.calls[0][1].transformation[2].overlay.constructor.name).toEqual('Layer');
    expect(u).toBeTruthy();
  });
  it('test crop and resize', () => {
    const u = buildImageUrl(ASSET, cld, SCALE, {transformation: 'c_scale,h_430,w_569'}, null, null, null);
    expect(cldSpy.mock.calls[0][1].transformation[1].raw_transformation).toEqual('c_scale,h_430,w_569');
    expect(u).toBeTruthy();
  });
});

describe('test gif poller', () => {
  beforeEach(() => {
    fetch.resetMocks();
  });
  it('test polling', async () => {
    // fetch.mockResponse({ok: true});
    jest.setTimeout(30000);
    const res = await pollImageReady('https://res.cloudinary.com/sfmc-test-cloud/image/upload/404.webp', 20, 4);
    expect(res).toBe(true);
  });
  it('test polling attempts', async () => {
    fetch.mockResponses(
      [
        {ok: false}, {status: 423}
      ],
      [
        {ok: true}, {status: 200}
      ]);
    const res = await pollImageReady('https://example.com/test.png', 1, 2);
    expect(fetch.mock.calls.length).toBe(2);
    expect(res).toBe(true);
  });
  it('test polling too many attempts', async () => {
    fetch.mockResponses(
      [
        {ok: false}, {status: 423}
      ],
      [
        {ok: true}, {status: 423}
      ],
      [
        {ok: true}, {status: 200}
      ],
    );
    let res;
    try {
      res = await pollImageReady('https://example.com/test.png', 1, 2);
      expect(res).toBeFalsy();
    } catch (e) {
      expect(e.message).toBe('Exceeded max attempts');
    }
  });
  it('test polling error', async () => {
    fetch.mockResponses(
      [
        {ok: false}, {status: 400}
      ],
      [
        {ok: true}, {status: 404}
      ],
      [
        {ok: true}, {status: 404}
      ],
    );
    let res;
    try {
      res = await pollImageReady('https://example.com/test.png', 1, 2);
      expect(res).toBeFalsy();
    } catch (e) {
      expect(e.message).toBe('Error polling gif file, status code: 400');
    }
  });
});

describe('test build gif url', () => {
  let cld;
  let cldSpy;
  beforeEach(() => {
    cld = cloudinary.Cloudinary.new({cloud_name: 'sfmc-test-cloud', secure: true});
    cldSpy = jest.spyOn(cld, 'video_url');
    cldSpy.mockClear();
  });
  it('test defaults', () => {
    const expectedTrans = {
      'transformation': [
        {
          'fetchFormat': 'gif',
          'width': 200,
          'height': 150,
          'crop': 'limit'
        },
        {
          'effect': 'loop'
        },
        {
          'flags': 'lossy'
        },
        {
          'quality': 50
        },
        {
          'raw_transformation': 'eo_37,so_30.8'
        }
      ]
    };
    const asset = {public_id: 'test123'};
    const gifUrl = buildGifUrl(asset, {transformation: 'eo_37,so_30.8'} ,cld, {width: 200, height: 150}, true, true, null, 50, 'manual');
    expect(cldSpy.mock.calls[0][0]).toEqual('test123');
    expect(cldSpy.mock.calls[0][1]).toEqual(expectedTrans);
    expect(gifUrl).toEqual('https://res.cloudinary.com/sfmc-test-cloud/video/upload/c_limit,f_gif,h_150,w_200/e_loop/fl_lossy/q_50/eo_37,so_30.8/test123?_i=AI');
  });
  it('test scale', () => {
    const expectedTrans = {
      'transformation': [
        {
          'fetchFormat': 'gif',
          'width': 300,
          'height': 250,
          'crop': 'limit'
        },
        {
          'effect': 'loop'
        },
        {
          'flags': 'lossy'
        },
        {
          'quality': 50
        },
        {
          'raw_transformation': 'eo_37,so_30.8'
        }
      ]
    };
    const asset = {public_id: 'test123'};
    buildGifUrl(asset, {transformation: 'eo_37,so_30.8'} ,cld, {width: 300, height: 250}, true, true, null, 50, 'manual');
    expect(cldSpy.mock.calls[0][1]).toEqual(expectedTrans);
  });
  it('test loop', () => {
    const expectedTrans = {
      'transformation': [
        {
          'fetchFormat': 'gif',
          'width': 300,
          'height': 250,
          'crop': 'limit'
        },
        {
          'flags': 'lossy'
        },
        {
          'quality': 50
        },
        {
          'raw_transformation': 'eo_37,so_30.8'
        }
      ]
    };
    const asset = {public_id: 'test123'};
    buildGifUrl(asset, {transformation: 'eo_37,so_30.8'} ,cld, {width: 300, height: 250}, false, true, null, 50, 'manual');
    expect(cldSpy.mock.calls[0][1]).toEqual(expectedTrans);
  });
  it('test lossy', () => {
    const expectedTrans = {
      'transformation': [
        {
          'fetchFormat': 'gif',
          'width': 300,
          'height': 250,
          'crop': 'limit'
        },
        {
          'effect': 'loop'
        },
        {
          'quality': 50
        },
        {
          'raw_transformation': 'eo_37,so_30.8'
        }
      ]
    };
    const asset = {public_id: 'test123'};
    buildGifUrl(asset, {transformation: 'eo_37,so_30.8'} ,cld, {width: 300, height: 250}, true, false, null, 50, 'manual');
    expect(cldSpy.mock.calls[0][1]).toEqual(expectedTrans);
  });
  it('test custom', () => {
    const expectedTrans = {
      'transformation': [
        {
          'fetchFormat': 'gif',
          'width': 300,
          'height': 250,
          'crop': 'limit'
        },
        {
          'effect': 'loop'
        },
        {
          'flags': 'lossy'
        },
        {
          'quality': 50
        },
        {
          'raw_transformation': 'a_45'
        },
        {
          'raw_transformation': 'eo_37,so_30.8'
        }
      ]
    };
    const asset = {public_id: 'test123'};
    buildGifUrl(asset, {transformation: 'eo_37,so_30.8'} ,cld, {width: 300, height: 250}, true, true, 'a_45', 50, 'manual');
    expect(cldSpy.mock.calls[0][1]).toEqual(expectedTrans);
  });
  it('test quality type', () => {
    const expectedTrans = {
      'transformation': [
        {
          'fetchFormat': 'gif',
          'width': 300,
          'height': 250,
          'crop': 'limit'
        },
        {
          'effect': 'loop'
        },
        {
          'flags': 'lossy'
        },
        {
          'quality': 'auto:eco'
        },
        {
          'raw_transformation': 'eo_37,so_30.8'
        }
      ]
    };
    const asset = {public_id: 'test123'};
    buildGifUrl(asset, {transformation: 'eo_37,so_30.8'} ,cld, {width: 300, height: 250}, true, true, null, 50, 'eco');
    expect(cldSpy.mock.calls[0][1]).toEqual(expectedTrans);
  });
});
describe('test buildGifHtml', () => {
  const IMAGE_URL = 'https://res.cloudinary.com/sfmc-test-cloud/video/upload/c_limit,f_gif,h_150,w_200/e_loop/fl_lossy/q_50/eo_37,so_30.8/test123';
  const ALT = 'alt text';
  it('test defaults', () => {
    const gifHtml = buildGifHtml(IMAGE_URL, ALT, 'center');
    const newNode = document.createElement('div');
    newNode.innerHTML = gifHtml;
    const img = newNode.querySelector('img');
    expect(img.getAttribute('src')).toBe(IMAGE_URL);
    expect(img.getAttribute('alt')).toBe(ALT);
    let d = newNode.querySelector('div');
    const css = d.getAttribute('style');
    expect(css).toBe('text-align: center;');
  });
  it('test link', () => {
    const gifHtml = buildGifHtml(IMAGE_URL, ALT, 'center', 'https://example.com');
    const newNode = document.createElement('div');
    newNode.innerHTML = gifHtml;
    const img = newNode.querySelector('img');
    expect(img.getAttribute('src')).toBe(IMAGE_URL);
    expect(img.getAttribute('alt')).toBe(ALT);
    let d = newNode.querySelector('a');
    const h = d.getAttribute('href');
    expect(h).toEqual('https://example.com');
  });
});

describe('test getGifDuration', () => {
  it('test getGifDuration with trim', () => {
    const asset = {public_id: 'test123', duration: 78};
    const trim = {transformation: 'eo_37,so_30.8'};
    const d = getGifDuration(asset, trim);
    expect(d).toBe(7);
  });
  it('test getGifDuration no trim', () => {
    const asset = {public_id: 'test123', duration: 78};
    const d = getGifDuration(asset, null);
    expect(d).toBe(78);
  });
});

describe('embargoPreviewSourceUrl', () => {
  const imageUrl = 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/c_crop,w_10,h_10/v1/pub';
  const token = '__cld_token__=exp=1~acl=x~hmac=y';

  it('appends the preview token to the transformed url', () => {
    expect(embargoPreviewSourceUrl(imageUrl, { url: 'signed', token })).toBe(`${imageUrl}?${token}`);
    expect(embargoPreviewSourceUrl(`${imageUrl}?_i=AI`, { token })).toBe(`${imageUrl}?_i=AI&${token}`);
  });

  it('falls back to the signed original, then the plain url', () => {
    expect(embargoPreviewSourceUrl(imageUrl, { url: 'signed' })).toBe('signed');
    expect(embargoPreviewSourceUrl(imageUrl, { url: undefined, token: undefined })).toBe(imageUrl);
    expect(embargoPreviewSourceUrl(imageUrl, undefined)).toBe(imageUrl);
  });
});

