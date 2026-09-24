import React, { createContext, useState, useEffect } from 'react';
import { default as sdk } from 'blocksdk';
import types from 'prop-types';
import { default as isEmpty } from 'lodash.isempty';
import {
  buildImageUrl,
  buildHtml,
  getPlaceholderTransformation,
  pollImageReady,
  buildPlaceholder,
  createMockSdk
} from './utils';
import { ReactComponent as IcClock } from './assets/clock-130.svg';

export const ImageContext = createContext([]);

async function buildContent(
  urls,
  cld,
  alt,
  imageAlignment,
  imageLink,
  scale,
  setTransformationError,
  errorImageUrl,
  embargoPreviewUrl
) {
  let content = {};
  let html;
  if (urls.imageUrl) {
    // For an embargoed asset the plain public url.imageUrl 401s until the
    // embargo lifts, by design — polling it would never succeed. Poll and
    // render the on-canvas preview against the short-lived signed preview
    // URL instead, but keep saving the plain public URL as the actual
    // content block HTML: that's the URL that needs to work once this is
    // actually sent, long after any preview token has expired.
    const previewSourceUrl = embargoPreviewUrl || urls.imageUrl;
    try {
      await pollImageReady(previewSourceUrl, 20, 4);
      content.previewHtml = buildHtml(previewSourceUrl, cld, alt, imageAlignment, scale, null, null);
      html = buildHtml(
        urls.imageUrl,
        cld,
        alt,
        imageAlignment,
        scale,
        urls.responsiveUrl,
        urls.placeholderUrl
      );
      if (imageLink) {
        html = `<a href=${imageLink}>${html}</a>`;
      }
      content.html = html;
      setTransformationError(false);
      return content;
    } catch (e) {
      console.log(e);
      content.previewHtml = buildHtml(errorImageUrl, cld, alt, imageAlignment, scale, null, null);
      setTransformationError(true);
      return content;
    }
  } else {
    //html = '<div class="photo" style="background-image: url(\'https://product-assets-res.cloudinary.com/image/upload/v1591638836/PageDesigner/image_basanq.svg\'); background-size: cover; background-color: gray; height: 100px; width: 100px;"/>';
    //content.previewHtml = html;
    content.html = '<div></div>';
    content.previewHtml = '<div></div>';
    return content;
  }
}

ImageContextProvider.propTypes = {
  qParams: types.string,
  imageSettingsDefaults: types.object,
  cld: types.object,
  errorImageUrl: types.string
};

const isLocalDev = window.location.hostname === 'localhost';

const settingsUrl = `https://${window.location.host}/advanced${window.location.search}`;

function createBlockSdk() {
  if (isLocalDev) {
    return createMockSdk('cld-image-sdk-data');
  }
  return new sdk({
    blockEditorWidth: 850,
    tabs: [{ name: 'Advanced', key: 'cld-advanced', url: settingsUrl }, 'stylingblock', 'htmlblock']
  });
}

const blocksdk = createBlockSdk();

export default function ImageContextProvider({
  errorImageUrl = 'https://product-assets-res.cloudinary.com/image/upload/w_250,co_rgb:c23834,e_colorize:100,f_png/PageDesigner/warning.png',
  ...restProps
}) {
  const props = { errorImageUrl, ...restProps };
  const [imageState, setImageState] = useState(props.imageSettingsDefaults);
  const [hasTransformationError, setTransformationError] = useState(false);
  const [previewCnt, setPreviewCnt] = useState(null);
  const [cnt, setCnt] = useState(null);
  const [imageUrls, setImageUrls] = useState(null);
  const updateState = (newState) => {
    let upState = { ...imageState, ...newState };
    setImageState(upState);
  };

  const { cld, imageSettingsDefaults } = props;
  const {
    imageSelect: {
      asset,
      width,
      height,
      cropAndResize,
      responsive,
      placeholder,
      altText: alt,
      imageAlign,
      imageLink
    },
    ovEd: { overlay },
    transOverride
  } = imageState;
  useEffect(() => {
    blocksdk.getData((d) => {
      let newData = Object.assign({}, imageSettingsDefaults, d);
      setImageState(newData);
    });
  }, [cld, errorImageUrl, imageSettingsDefaults, setPreviewCnt, setCnt]);

  /*
  useEffect(() => {
    const processing = buildPlaceholder(['Processing Image...'], '#706e6b', <IcClock />, {width: newData.imageSelect.width, height: newData.imageSelect.height});
    setPreviewCnt(processing);
    const {previewHtml, html} = await buildContent(imageUrls, cld, alt, imageAlign, imageLink, setTransformationError, errorImageUrl);
    if (previewHtml) {
      setPreviewCnt(previewHtml);
    }
    if (html) {
      setCnt(html);
    }
  })
*/

  useEffect(() => {
    if (!isEmpty(asset)) {
      const scale = { width: width, height: height };
      const urls = {
        imageUrl: buildImageUrl(asset, cld, scale, cropAndResize, transOverride, null, overlay)
      };
      if (responsive) {
        urls.responsiveUrl = buildImageUrl(
          asset,
          cld,
          scale,
          cropAndResize,
          transOverride,
          { width: 'auto', crop: 'scale' },
          overlay
        );
      }
      if (placeholder && placeholder !== 'none') {
        let placeholderTrans = getPlaceholderTransformation(placeholder);
        urls.placeholderUrl = buildImageUrl(
          asset,
          cld,
          scale,
          cropAndResize,
          transOverride,
          placeholderTrans,
          overlay
        );
      }
      setImageUrls(urls);
    } else {
      setImageUrls({ imageUrl: null, responsiveUrl: null, placeholderUrl: null });
    }
  }, [asset, cld, width, height, cropAndResize, transOverride, overlay, responsive, placeholder]);

  useEffect(() => {
    async function updateContentBlock() {
      const processing = buildPlaceholder(['Processing Image...'], '#706e6b', <IcClock />, {
        width: '50%',
        height: '100%'
      });
      setPreviewCnt(processing);
      const { previewHtml, html } = await buildContent(
        imageUrls,
        cld,
        alt,
        imageAlign,
        imageLink,
        { width: width, height: height },
        setTransformationError,
        errorImageUrl,
        asset && asset.embargoPreviewUrl
      );
      if (previewHtml) {
        setPreviewCnt(previewHtml);
      }
      if (html) {
        setCnt(html);
      }
    }
    if (!isEmpty(imageUrls)) {
      updateContentBlock();
    }
  }, [
    imageUrls,
    imageLink,
    imageAlign,
    alt,
    cld,
    height,
    width,
    errorImageUrl,
    setTransformationError,
    asset
  ]);

  useEffect(() => {
    blocksdk.setData(imageState);
  }, [imageState]);

  useEffect(() => {
    if (previewCnt) {
      blocksdk.setSuperContent(previewCnt);
    }
  }, [previewCnt]);

  useEffect(() => {
    if (cnt) {
      blocksdk.setContent(cnt);
    }
  }, [cnt]);

  return (
    <ImageContext.Provider
      value={{ imageState, setImageState: updateState, hasTransformationError }}
    >
      {props.children}
    </ImageContext.Provider>
  );
}
