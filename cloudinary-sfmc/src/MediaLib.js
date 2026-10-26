import React, { useState, useEffect, useRef, useCallback } from 'react';
import { default as assetValidatitors } from './mediaLibValidators';
import { default as isEmpty } from 'lodash.isempty';
import { Banner } from 'sf-component-lib2';
import types from 'prop-types';
import './MediaLib.css';

MediaLib.propTypes = {
  cnf: types.object,
  ver: types.object,
  previewServerUrl: types.string
};

export default function MediaLib(props) {
  const mlw = useRef(null);
  let assetType = useRef('image');
  const validators = [];
  const sizeLimit = useRef(50);
  const [errors, setErrors] = useState([]);
  const [infos, setInfos] = useState([]);

  function removeError(key) {
    setErrors((errs) => errs.filter((err) => err.key !== key));
  }

  const handleMessage = useCallback(
    (event) => {
      if (event.origin !== window.location.origin) {
        return;
      }
      let data = event.data;
      if (data.messageType === 'open') {
        // Reset rather than append: `validators` is a plain array that
        // outlives a single 'open' message for as long as this popup stays
        // open, so processing 'open' more than once (e.g. a stray duplicate
        // postMessage from the opener) must not leave stale entries from a
        // previous open queued up alongside the new ones.
        validators.length = 0;
        if (data.validators && data.validators.length > 0) {
          data.validators.forEach((v) => {
            if (v in assetValidatitors) {
              validators.push(assetValidatitors[v]);
            }
          });
        }
        if (data.infos && data.infos.length > 0 && infos.length === 0) {
          const infs = data.infos.map((i) => {
            return <Banner type={'info'} content={i} key={i} />;
          });
          setInfos(infs);
        }
        if (data.sizeLimit && data.sizeLimit > 0) {
          sizeLimit.current = data.sizeLimit;
        }
        if (data.folder && data.folder.resource_type) {
          assetType.current = data.folder.resource_type;
        } else if (!isEmpty(data.asset)) {
          assetType.current = data.asset.resource_type;
        }
        mlw.current.show(data);
      }
    },
    [mlw, sizeLimit, validators, setInfos, infos]
  );

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  function TooBigMsg() {
    return (
      <span>
        This {assetType.current} exceeds the maximum file size that can be modified directly in the
        content block. To increase this limit, see{' '}
        <a
          target={'_blank'}
          rel={'noopener noreferrer'}
          href="https://cloudinary.com/documentation/salesforce_marketing_cloud_app_integration"
        >
          documentation
        </a>
      </span>
    );
  }

  useEffect(() => {
    function buildMlw() {
      let conf = {
        cloud_name: props.cnf.cloud_name,
        api_key: props.cnf.api_key,
        remove_header: true,
        inline_container: 'div.ml',
        max_files: 1,
        multiple: false,
        sandboxAttributes: ['allow-scripts', 'allow-same-origin'],
        integration: {
          type: 'sfmc_cartridge',
          platform: 'salesforce_marketing_cloud',
          version: props.ver.version,
          environment: props.ver.environment
        }
      };
      // eslint-disable-next-line no-undef
      mlw.current = cloudinary.createMediaLibrary(conf, {
        insertHandler: async (data) => {
          const errorTexts = {
            tooBig: <TooBigMsg />,
            wrongType: `Only ${assetType.current}s can be inserted into this content block`,
            restricted: 'This asset is restricted',
            noDimensions: `Something seems to be wrong with this ${assetType.current}`
          };
          let asset = data.assets[0];
          const args = {
            asset: asset,
            sizeLimit: sizeLimit.current,
            rightType: assetType.current,
            previewServerUrl: props.previewServerUrl
          };
          const validatorsRes = await Promise.allSettled(validators.map((v) => v(args)));
          let errorBanners = [];
          validatorsRes.forEach((res) => {
            if (res.status === 'rejected') {
              errorBanners.push(
                <Banner
                  type={'error'}
                  content={errorTexts[res.reason]}
                  key={res.reason}
                  click={() => removeError(res.reason)}
                />
              );
            }
          });
          setErrors(errorBanners);
          if (errorBanners.length === 0) {
            asset.messageType = 'asset';
            window.opener.postMessage(asset, window.location.origin);
            window.close();
          }
        }
      });
      window.opener.postMessage({ messageType: 'ready' }, window.location.origin);
    }
    const script = document.createElement('script');
    script.async = true;
    script.id = 'mlw';
    document.body.appendChild(script);
    script.onload = buildMlw;
    script.src =
      process.env.REACT_APP_MLW_URL || 'https://media-library.cloudinary.com/global/all.js';
    return () => {
      document.body.removeChild(script);
    };
  }, [props.cnf, props.ver, validators]);

  return (
    <React.Fragment>
      {errors && errors.length > 0 && errors}
      {infos && infos.length > 0 && infos}
      <div className="ml" />
    </React.Fragment>
  );
}
