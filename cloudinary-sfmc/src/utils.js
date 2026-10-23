import { default as cloudinary } from 'cloudinary-core';
import { default as isEmpty } from 'lodash.isempty';
import ReactDOMServer from 'react-dom/server';
import React from 'react';
import {default as parser} from 'ua-parser-js';

export function createMockSdk(storageKey) {
  const load = () => {
    try {
      return JSON.parse(sessionStorage.getItem(storageKey)) || {};
    } catch {
      return {};
    }
  };
  return {
    getData: (cb) => cb(load()),
    setData: (data) => sessionStorage.setItem(storageKey, JSON.stringify(data)),
    setSuperContent: () => {},
    setContent: () => {}
  };
}

export function buildHtml(imageUrl, cld, altText, align = 'center', scale, responsive, lqip) {
  let div = document.createElement('div');
  let img = document.createElement('img');
  img.src = imageUrl;
  img.alt = altText;
  img.style.padding = '0px';
  if (responsive) {
    img.dataset.srcCache = responsive;
    img.removeAttribute('src');
    img.classList.add('cld-responsive');
    let respScript = buildResponsiveScript(cld.config());
    div.appendChild(respScript);
  }
  if (lqip) {
    img.dataset.realSrc = imageUrl;
    img.src = lqip;
    img.classList.add('cld-lqip');
    let lqipScript = buildLqipScript();
    div.appendChild(lqipScript);
  }
  div.style.textAlign = align;
  if (responsive) {
    div.style.maxWidth = scale.width + 'px';
  } else {
    img.width = scale.width;
  }
  img.style.maxWidth = '100%';
  div.appendChild(img);
  return div.outerHTML;
}

export function buildResponsiveScript(conf) {
  let s = document.createElement('script');
  s.type = 'text/javascript';
  let code = `
  if (!!!document.getElementById('cldResp')) {
    function addResp() {
        window.cld = cloudinary.Cloudinary.new(${JSON.stringify(conf)});
        cld.responsive()
    }

    const script = document.createElement('script')
    script.async = true
    script.id = 'cldResp'
    document.head.appendChild(script)
    script.onload = addResp;
    script.src = 'https://unpkg.com/cloudinary-core/cloudinary-core-shrinkwrap.js'
  }
    `;
  try {
    s.appendChild(document.createTextNode(code));
  } catch (e) {
    s.text = code;
  }
  return s;

}
export function buildLqipScript() {
  let s = document.createElement('script');
  s.type = 'text/javascript';
  let code =`window.cldLqip = function() {
      document.querySelectorAll('.cld-lqip').forEach(function(el) {
        el.src = el.dataset.realSrc;
      })
    }
    document.addEventListener('DOMContentLoaded', function(event) {
      window.cldLqip();
    })
    `;
  try {
    s.appendChild(document.createTextNode(code));
  } catch (e) {
    s.text = code;
  }
  return s;
}

export function uploadToCld(svg, cldConf, cb) {
  const cldUploadUrl = `https://api.cloudinary.com/v1_1/${cldConf.cloud_name}/image/upload`;
  let uploadFD = new FormData();
  let bl = new Blob([svg], { type: 'image/svg+xml' });
  uploadFD.append('upload_preset', 'sfmc_preset');
  uploadFD.append('tags', 'sfmc_int');
  uploadFD.append('file', bl);
  fetch(cldUploadUrl, {
    method: 'POST',
    body: uploadFD
  })
    .then((res) => {
      res.json().then((data) => {
        if (data && !data.error) {
          cb({ovEd: {overlay: data}});
        }
      });
    })
    .catch((e) => {
      console.log(e);
    });
}

export function getPublicId(imageState) {
  if (imageState.imageSelect && imageState.imageSelect.asset) {
    return imageState.imageSelect.asset.public_id;
  } else {
    return null;
  }
}

export function getPlaceholderTransformation(placeholder) {
  switch (placeholder) {
    case 'vector':
      return {effect: 'vectorize', quality: 1};
    case 'pixel':
      return {effect: 'pixelate', quality: 1, fetchFormat: 'auto'};
    case 'blur':
      return {effect: 'blur:2000', quality: 1, fetchFormat: 'auto'};
    case 'solid':
      return {raw_transformation: '/w_iw_div_2/ar_1/c_pad/b_auto/c_crop/w_10/h_10/g_north_east/w_iw/h_ih/c_fill/f_auto/q_auto'};
    default:
      return {};
  }
}

function analyticsQueryParameters() {
  const parms = new URLSearchParams({
    _i: 'AI'
  });
  return parms.toString();
}

export function buildImageUrl(asset, cld, scale, cropAndResize = null, override = null, addTrans = null, overlay = null) {
  let publicId = asset.public_id;
  if (publicId) {
    let trans = [];
    if (override) {
      trans.push({raw_transformation: override});
    } else {
      let t = {
        fetchFormat: 'auto',
        quality: 'auto',
      };
      trans.push(t);
    }
    if (addTrans) {
      trans.push(addTrans);
    }
    if (asset.derived && asset.derived.length > 0) {
      trans.push({raw_transformation: asset.derived[0].raw_transformation});
    }
    if (cropAndResize) {
      trans.push({raw_transformation: cropAndResize.transformation});
    }
    if (!isEmpty(scale)) {
      let t = { crop: 'limit', width: scale.width, height: scale.height }; // could be limit
      trans.push(t);
    }
    if (!isEmpty(overlay)) {
      trans.push({overlay: new cloudinary.Layer().publicId(overlay.public_id)});
    }
    let url = cld.url(publicId, {transformation: trans});
    url += '?' + analyticsQueryParameters();
    return url;
  }
  return null;
}

export function hostNameToEnv(hostName) {
  switch (hostName) {
    case 'sfmc-contentbuilder.cloudinary.com':
      return 'production';
    case 'sfmc-contentbuilder-staging.cloudinary.com':
      return 'staging';
    case 'sfmc-contentbuilder-dev.cloudinary.com':
      return 'dev';
    default:
      return 'local';
  }
}

export function getVer() {
  return  {
    version: process.env.REACT_APP_VERSION,
    environment: hostNameToEnv(window.location.host)
  };
}

async function getGifHead(url) {
  const accept = getAcceptHeader();
  return await fetch(url, {
    method: 'HEAD',
    headers: {accept: accept},
    redirect: 'follow'
  });
}

export function embargoPreviewSourceUrl(imageUrl, embargoPreview) {
  if (embargoPreview && embargoPreview.token) {
    return `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}${embargoPreview.token}`;
  }
  return (embargoPreview && embargoPreview.url) || imageUrl;
}

export function pollImageReady(url, interval, maxAttempts) {
  console.log('Start poll...');
  let attempts = 0;

  const executePoll = async (resolve, reject) => {
    console.log('- poll');
    const result = await getGifHead(url);
    attempts++;
    if (result.ok) {
      console.log('Done Polling');
      return resolve(true);
    } else if (maxAttempts && attempts === maxAttempts) {
      return reject(new Error('Exceeded max attempts'));
    }
    else {
      if (result.status === 423) {
        setTimeout(() => {
          executePoll(resolve, reject).catch(reject);
        }, interval * 1000);
      } else {
        return reject(new Error('Error polling gif file, status code: ' + result.status));
      }
    }
  };
  return new Promise(executePoll);
}

export function buildGifTempImage(asset, cld, scale) {
  if (!scale) {
    scale = {width: asset.width, height: scale.height};
  }
  const textOverlay = [
    {overlay: new cloudinary.TextLayer().fontFamily('Cookie').fontSize(20).fontWeight('bold').text('Processing...')},
    {width: '0.6', flags: 'relative', crop: 'limit'},
    {flags: 'layer_apply'}
  ];
  const opts = [{
    fetchFormat: 'jpg',
    quality: 'auto',
    width: scale.width,
    height: scale.height,
    crop: 'limit'
  }];
  const op = opts.concat(textOverlay);
  return cld.video_url(asset.public_id, {transformation: op});
}


function getTrimDuration(trimStr) {
  const startRegExp = /(so_(?<start>[0-9]+))/;
  const endRegExp = /(eo_(?<end>[0-9]+))/;
  let sMatch = trimStr.match(startRegExp);
  let start = 0;
  let end;
  if (sMatch && sMatch.groups && sMatch.groups.start) {
    start = Number(sMatch.groups.start);
  }
  let eMatch = trimStr.match(endRegExp);
  if (eMatch && eMatch.groups && eMatch.groups.end) {
    end = Number(eMatch.groups.end);
  }
  if (start !== null && end !== null) {
    return end - start;
  }
  return 0;
}

export function buildGifUrl(asset, videoTrimmer, cld, scale, loop, lossy, custom, quality, qualityType) {
  if (!scale) {
    scale = {width: asset.width, height: asset.height};
  }
  let trans = [];
  const opts = {
    fetchFormat: 'gif',
    width: scale.width,
    height: scale.height,
    crop: 'limit'
  };
  trans.push(Object.assign({}, opts));
  if (loop) {
    trans.push({effect: 'loop'});
  }
  if (lossy) {
    trans.push({flags: 'lossy'});
  }
  trans.push(getQualityTransformation(quality, qualityType));
  if (custom) {
    trans.push({ raw_transformation: custom});
  }
  let url;
  if (!isEmpty(videoTrimmer)) {
    if (videoTrimmer.transformation) {
      trans.push({raw_transformation: videoTrimmer.transformation});
    }
    url =  cld.video_url(asset.public_id, {transformation: trans});
  } else if (asset.duration <= 15) {
    url = cld.video_url(asset.public_id, {transformation: trans});
  }
  return url + '?' + analyticsQueryParameters();
}

export function buildGifHtml(imageUrl, altText, align, link = null) {
  let div = document.createElement('div');
  let img = document.createElement('img');
  let a = null;
  img.src = imageUrl;
  img.alt = altText;
  img.style.padding = '0px';
  img.style.maxWidth = '100%';
  if (link) {
    a = document.createElement('a');
    a.href = link;
    a.target = '_blank';
    a.appendChild(img);
  }
  div.style.textAlign = align;
  div.appendChild(a || img);
  return div.outerHTML;
}

export function getGifDuration(asset, videoTrimmer) {
  let duration = 0;
  if (!isEmpty(videoTrimmer)) {
    duration = getTrimDuration(videoTrimmer.transformation);
  } else if (!isEmpty(asset)) {
    duration = asset.duration;
  }
  return duration;
}

export function calcAspects(width, height) {
  return {
    wAsspect: Number(width) / Number(height),
    hAsspect: Number(height) / Number(width)
  };
}

function getQualityTransformation(quality, qualityType) {
  if (qualityType === 'default') {
    return {quality: 50};
  } else if (qualityType !== 'manual') {
    return {quality: 'auto:' + qualityType};
  } else {
    return {quality: quality};
  }
}

export function buildPlaceholder(text, color, icon, scale) {
  const {height} = scale;
  return ReactDOMServer.renderToStaticMarkup(<div style={{maxWidth: '300px', height: height, textAlign: 'center', color: color, fontSize: '16px', margin: '0 auto', paddingBottom: '2em' }}>
    <div style={{position: 'relative', top: 0 }}>
      <div style={{width: '25px', height: '25px', margin: '15px auto', fill: color}}>{icon}</div>
      {text.map((t, idx) => (
        <div key={idx}>{t}</div>
      ))}
    </div>
  </div>
  );
}

function getAcceptHeader() {
  const uaParser = new parser.UAParser(navigator.userAgent);
  const browser = uaParser.getBrowser();
  if (browser.name.startsWith('Firefox')) {
    return userAgentToAcceptHeader('firefox');
  } else if (browser.name.startsWith('Chrome')) {
    return userAgentToAcceptHeader('chrome');
  } else if (browser.name.includes('Safari')) {
    const ua = browser.version < 14 ? 'safari' : 'safari_bs';
    return userAgentToAcceptHeader(ua);
  }
  return userAgentToAcceptHeader();
}

function userAgentToAcceptHeader(ua) {
  const conversion = {
    firefox: 'image/webp,*/*',
    safari: 'image/png,image/svg+xml,image/*;q=0.8,video/*;q=0.8,*/*;q=0.5',
    safari_bs: 'image/webp,image/png,image/svg+xml,image/*;q=0.8,video/*;q=0.8,*/*;q=0.5',
    chrome: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
  };
  return conversion[ua] || conversion['chrome'];

}
