import React, { useState, useEffect, useRef } from 'react';
import types from 'prop-types';
import t from '../../services/i18n';
import { withFormsy } from 'formsy-react';
import './CldAssetSelector.scss';
import cx from 'classnames';

import { IoIosFolder, IoIosTrash } from 'react-icons/io';

import { FormPanelContext } from '../../containers/FormPanel/FormPanelContext';
import Banner from '../Banner';

// PropTypes
// https://reactjs.org/docs/typechecking-with-proptypes.html#proptypes
CldAssetSelector.propTypes = {
  buttonLabel: types.string,
  value: types.object,
  setValue: types.any,
  description: types.string,
  openCldAssetSelector: types.any,
  previewServerUrl: types.string
};

// Mirrors window.fetch but never throws synchronously — some browser
// extensions patch fetch and can throw a plain TypeError instead of
// returning a rejected promise, which would otherwise escape a .catch()
// attached after the call.
function safeFetch(...fetchArgs) {
  try {
    return fetch(...fetchArgs);
  } catch (err) {
    return Promise.reject(err);
  }
}

export default function CldAssetSelector({
  buttonLabel = 'Choose Image',
  value = null,
  ...restProps
}) {
  const props = { buttonLabel, value, ...restProps };
  const { cld } = React.useContext(FormPanelContext);
  // let asset = props.value;
  // Local state
  const [previewUrl, setPreviewUrl] = useState(null);
  const [mlTransformations, setMlTransformations] = useState(null);
  // Guards against retrying forever if a freshly-signed preview URL somehow
  // also fails to load — one refresh attempt per selected asset.
  const refreshAttempted = useRef(false);

  // Lifecycle updates
  useEffect(() => {
    refreshAttempted.current = false;
    if (props.value && (props.value.secure_url || props.value.embargoPreviewUrl)) {
      let trns = {
        height: 300,
        crop: 'thumb',
        fetchFormat: 'auto',
        resource_type: props.value.resource_type
      };
      if (props.value.derived && props.value.derived.length > 0) {
        setMlTransformations(props.value.derived[0].raw_transformation);
        Object.assign(trns, { raw_transformation: props.value.derived[0].raw_transformation });
      }
      // An embargoed asset isn't publicly reachable yet, so `cld.url(...)`
      // would just 401. Use the short-lived signed preview URL the
      // isNotRestricted validator attached instead, so the author can still
      // see what they picked.
      setPreviewUrl(props.value.embargoPreviewUrl || cld.url(props.value.public_id, trns));
      if (props.setValue) {
        props.setValue(props.value);
      }
    } else {
      setPreviewUrl(null);
    }
  }, [props.value]);

  function onRemove() {
    if (props.value) {
      props.setValue('remove');
      setMlTransformations(null);
    }
  }

  function showBrokenImagePlaceholder(target) {
    target.src =
      'https://product-assets-res.cloudinary.com/image/upload/w_80,co_rgb:c23834,e_colorize:100,f_png/l_text:Arial_60_bold_text_align_center_line_spacing_8:INVALID%0ATRANSFORMATION,co_rgb:06060b,y_90,w_280/b_rgb:F3F2F2,c_lpad,w_300,h_260/PageDesigner/warning.png';
  }

  // A previously-signed embargo preview URL is only valid for a few minutes
  // (see preview-server's PREVIEW_TTL_SECONDS). Reopening this content block
  // later, after that window has passed, is the normal way this preview
  // goes stale — so on load failure for an asset we know is embargoed, try
  // once to get a fresh signed URL instead of just showing "broken image".
  function refreshEmbargoPreview(target) {
    safeFetch(`${props.previewServerUrl.replace(/\/+$/, '')}/api/embargo-preview-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publicId: props.value.public_id,
        resourceType: props.value.resource_type,
        deliveryType: props.value.type
      })
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) {
          showBrokenImagePlaceholder(target);
          return;
        }
        const refreshed = {
          ...props.value,
          embargoPreviewUrl: data.url,
          accessControl: data.accessControl
        };
        setPreviewUrl(data.url);
        if (props.setValue) {
          props.setValue(refreshed);
        }
      })
      .catch(() => showBrokenImagePlaceholder(target));
  }

  function handlePreviewError(event) {
    const target = event.currentTarget;
    if (
      props.value &&
      props.value.accessControl &&
      props.previewServerUrl &&
      !refreshAttempted.current
    ) {
      refreshAttempted.current = true;
      refreshEmbargoPreview(target);
      return;
    }
    showBrokenImagePlaceholder(target);
  }

  function embargoLiftDate() {
    const start = props.value && props.value.accessControl && props.value.accessControl.start;
    if (!start) {
      return null;
    }
    const date = new Date(start);
    return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
  }

  // Render
  return (
    <div className={cx('image-select', previewUrl ? 'has-image' : 'no-image')}>
      {previewUrl && (
        <div className="image-preview">
          <img className="preview-img" src={previewUrl} onError={handlePreviewError} />
        </div>
      )}
      {props.value && props.value.public_id ? (
        <div className="image-data">
          <div
            className="image-name"
            title={props.value.public_id + (props.value.format ? '.' + props.value.format : '')}
          >
            {props.value.public_id + (props.value.format ? '.' + props.value.format : '')}
          </div>
          <button
            className="btn btn-secondary btn-icon add"
            onClick={props.openCldAssetSelector}
            title={t('replace')}
          >
            <IoIosFolder />
            {t('replace')}
          </button>
          {previewUrl && (
            <button
              className="btn btn-secondary btn-icon remove"
              onClick={onRemove}
              title={t('remove')}
            >
              <IoIosTrash />
              {t('remove')}
            </button>
          )}
        </div>
      ) : (
        <div className="image-data">
          <button
            className="image-name-input btn btn-secondary btn-icon"
            onClick={props.openCldAssetSelector}
          >
            <IoIosFolder />
            {props.buttonLabel}
          </button>
          {props.description && <div className="description">{props.description}</div>}
        </div>
      )}
      {props.value && props.value.embargoPreviewUrl && (
        <Banner
          type="warning"
          content={
            'Temporary preview only — this asset is embargoed' +
            (embargoLiftDate() ? ` until ${embargoLiftDate()}` : '') +
            ". It won't be visible to recipients until the embargo lifts."
          }
        />
      )}
      {mlTransformations && (
        <label>
          Image Transformations<div className="ml-transformations">{mlTransformations}</div>
        </label>
      )}
    </div>
  );
}

export const formsyCldAssetSelector = withFormsy(CldAssetSelector);
