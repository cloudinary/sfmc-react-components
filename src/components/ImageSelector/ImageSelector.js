import React, { useState, useEffect, useReducer, useRef } from 'react';
import types from 'prop-types';
import t from '../../services/i18n';
import cx from 'classnames';
import { RadioButtons } from '../RadioButtons/RadioButtons';
import { default as ImageScale } from '../ImageScale/ImageScale';
import { applyDefaults } from '../../utils';
import { Input } from '../Input/Input';

import { default as CldAssetSelector } from '../CldAssetSelector';
import { default as MediaEditor } from '../CldMediaEditor';
import ToggleSwitch from '../ToggleSwitch';
import Checkbox from '../Checkbox';
import { withFormsy } from 'formsy-react';
import { default as isEmpty } from 'lodash.isempty';
import { useDebouncedCallback } from 'use-debounce';
import { calcAspects } from '../../utils';

import { IoMdUndo } from 'react-icons/io';

import './ImageSelector.scss';
import { ReactComponent as IcLeft } from '../../assets/align-horizontal-left.svg';
import { ReactComponent as IcCenter } from '../../assets/align-horizontal-center.svg';
import { ReactComponent as IcRight } from '../../assets/align-horizontal-right.svg';

// PropTypes
// https://reactjs.org/docs/typechecking-with-proptypes.html#proptypes
ImageSelector.propTypes = {
  title: types.string,
  label: types.string,
  showPlaceholder: types.bool,
  placeholder: types.string,
  placeholderItems: types.array,
  altPlaceholder: types.string,
  altLabel: types.string,
  showImageLink: types.bool,
  imageLinkLabel: types.string,
  imageLinkDefault: types.string,
  imageSizeLabel: types.string,
  imageSizeTooltip: types.string,
  responsive: types.bool,
  breakpointsLabel: types.string,
  responsiveLabel: types.string,
  imageJs: types.bool,
  showOptimizations: types.bool,
  openCldAssetSelector: types.any,
  cloudName: types.string,
  previewServerUrl: types.string,
  initialAsset: types.string,
  width: types.number,
  height: types.number,
  lockAspectRatio: types.bool,
  setValue: types.any,
  prevValue: types.object,
  sizeLimit: types.number,
  nonEditableExts: types.arrayOf(types.string),
  analytics: types.object
};

const IMAGE_SELECTOR_DEFAULTS = {
  title: 'The Title',
  label: 'Choose Image',
  placeholder: 'none',
  altPlaceholder: 'Alt text',
  imageSizeLabel: 'Scale Image',
  breakpointsLabel: 'Enable Optimizations',
  responsiveLabel: 'Enable responsive images',
  lockAspectRatio: true,
  imageJs: false,
  width: 766,
  height: 300,
  sizeLimit: 40,
  nonEditableExts: [
    'ai',
    'gif',
    'djvu',
    'ps',
    'ept',
    'eps',
    'eps3',
    'fbx',
    'flif',
    'gif',
    'glb',
    'gltf',
    'ico',
    'indd',
    'pdf',
    'psd',
    'arw',
    'cr2',
    'svg',
    'tga',
    'tif',
    'tiff',
    'usdz'
  ],
  placeholderItems: [
    { value: 'blur', label: 'Blur' },
    { value: 'vector', label: 'Vectorize' },
    { value: 'solid', label: 'Predominant color' },
    { value: 'pixel', label: 'Pixelate' },
    { value: 'none', label: 'None' }
  ],
  showOptimizations: true
};

const imageAlignOptions = [
  { value: 'left', label: 'Left', icon: <IcLeft /> },
  { value: 'center', label: 'Center', icon: <IcCenter /> },
  { value: 'right', label: 'Right', icon: <IcRight /> }
];

function updateStateReducer(selectState, val) {
  return Object.assign({}, selectState, val);
}
function ImageSelector(rawProps) {
  const props = applyDefaults(IMAGE_SELECTOR_DEFAULTS, rawProps);
  const SOURCE = 'mainImage';
  const [selectState, updateState] = useReducer(updateStateReducer, {
    width: props.width,
    height: props.height,
    placeholder: props.placeholder,
    responsive: props.responsive,
    setImageJs: props.imageJs,
    imageAlign: 'center'
  });
  const [imageAspectRatio, setImageAspectRatio] = useState({});
  const reinstate = useRef(true);

  function setResponsive(val) {
    updateState({ responsive: val });
  }

  function setPlaceholder(val) {
    updateState({ placeholder: val });
  }
  function setImageAlign(val) {
    updateState({ imageAlign: val });
  }

  function setImageJs(val) {
    updateState({ imageJs: val });
  }

  function calculateScale(asset) {
    let aspects = isEmpty(imageAspectRatio)
      ? calcAspects(asset.width, asset.height)
      : imageAspectRatio;
    //let calcWidth = Math.round(selectState.width * aspects.wAsspect);
    let width = asset.width < selectState.width ? asset.width : selectState.width;
    setImageAspectRatio(aspects);
    return {
      width: width,
      height: Math.round(width * aspects.hAsspect)
    };
  }

  function setAsset(asset) {
    if (asset === 'remove') {
      updateState({
        asset: null,
        width: props.width,
        height: props.height,
        cropAndResize: null
      });
      setImageAspectRatio(null);
    }
    if (!isEmpty(asset) && asset.source === SOURCE) {
      const { width, height } = calculateScale(asset);
      let toUpdate = {
        nonEditable: props.nonEditableExts.includes(asset.format),
        asset: asset,
        width: width,
        height: height,
        originalWidth: width,
        originalHeight: height
      };
      updateState(toUpdate);
    }
  }

  function selectImage() {
    if (props.openCldAssetSelector) {
      let opts = {
        sizeLimit: props.sizeLimit,
        validators: ['isNotRestricted', 'isNotOverSizeLimit', 'isRightType', 'hasDimensions'],
        infos: ['Select the image you want to insert']
      };
      const asset = selectState.asset;
      if (!isEmpty(asset)) {
        opts.asset = {
          public_id: asset.public_id,
          resource_type: asset.resource_type,
          type: asset.type
        };
        if (asset.derived && asset.derived.length > 0) {
          opts.transformation = { url: asset.derived[0].secure_url };
        }
      } else if (props.initialAsset) {
        // Jump straight to a known asset (e.g. for testing/demoing) instead
        // of making the first open always start from the asset list.
        opts.asset = {
          public_id: props.initialAsset,
          resource_type: 'image',
          type: 'upload'
        };
      } else {
        // Flat asset list rather than folder-tree browsing — most people
        // picking an image don't think in terms of the folder structure.
        opts.search = { expression: 'resource_type:image' };
      }
      props.openCldAssetSelector(setAsset, opts, SOURCE);
    }
  }

  function handleMediaEdChange(val) {
    if (val.transformation) {
      const { width, height } = getWidthAndHeightFromString(val.transformation);
      let aspects = calcAspects(width, height);
      let v = {
        height: height,
        width: width,
        cropAndResize: val
      };
      updateState(v);
      setImageAspectRatio(aspects);
    }
  }

  function getWidthAndHeightFromString(str) {
    const cScale = str
      .split('/')
      .filter((el) => el.startsWith('c_scale'))
      .pop();
    const regExp =
      /(c_scale,)(w_(?<width>[0-9]+)),(h_(?<height>[0-9]+))|(c_scale,)(h_(?<height1>[0-9]+)),(w_(?<width1>[0-9]+))/;
    let matches = cScale.match(regExp);
    if (matches && matches.groups) {
      return {
        width: Number(matches.groups.width || matches.groups.width1),
        height: Number(matches.groups.height || matches.groups.height1)
      };
    }
    return null;
  }

  // reinstate the state
  useEffect(() => {
    if (!isEmpty(props.prevValue) && !isEmpty(props.prevValue.asset) && reinstate.current) {
      setImageAspectRatio(calcAspects(props.prevValue.width, props.prevValue.height));
      updateState(props.prevValue);
      reinstate.current = false;
    }
  }, [props.prevValue]);

  useEffect(() => {
    if (props.setValue) {
      props.setValue(selectState);
    }
  }, [selectState]);

  const handleAltChange = useDebouncedCallback((value) => {
    updateState({ altText: value });
  }, 500);

  useEffect(
    () => () => {
      handleAltChange.flush();
    },
    [handleAltChange]
  );
  const handleImageChange = useDebouncedCallback((value) => {
    updateState({ imageLink: value });
  }, 1000);

  useEffect(
    () => () => {
      handleImageChange.flush();
    },
    [handleImageChange]
  );

  function handleResetClick() {
    updateState({
      width: selectState.originalWidth,
      height: selectState.originalHeight,
      cropAndResize: null
    });
  }

  function handleScaleChange(scale) {
    updateState({ width: scale.width, height: scale.height });
  }

  const { width, height, asset } = selectState;
  const noImage = !(asset && asset.public_id);

  // Render
  return (
    <div className={cx('image-selector', { 'no-image': noImage })}>
      <CldAssetSelector
        value={selectState.asset}
        buttonLabel={'Choose Image'}
        setValue={setAsset}
        openCldAssetSelector={selectImage}
        previewServerUrl={props.previewServerUrl}
      />
      {/* Alt text */}
      <Input
        name={'alt'}
        placeholder={props.altPlaceholder}
        label={props.altLabel}
        setValue={handleAltChange}
        value={selectState.altText}
        disabled={noImage}
      />
      {/* Image size */}
      <div className="image-edit-wrapper">
        <MediaEditor
          name={'cldMediaEditor'}
          cloudName={props.cloudName}
          asset={selectState.asset}
          setValue={handleMediaEdChange}
          value={selectState.cropAndResize}
          disabled={noImage || selectState.nonEditable}
          label={t('cropImage')}
          version={props.analytics.version}
          maxHeight={height}
          maxWidth={width}
          env={props.analytics.env}
        />
        <ImageScale
          value={{ width: width, height: height }}
          width={width}
          height={height}
          setValue={handleScaleChange}
        />
        <button
          className="btn btn-secondary btn-icon reset-button"
          onClick={handleResetClick}
          disabled={noImage}
        >
          {t('resetToOriginal')}
          <IoMdUndo />
        </button>
      </div>
      <div className="image-align">
        <RadioButtons
          name="align"
          items={imageAlignOptions}
          value={selectState.imageAlign}
          setValue={setImageAlign}
          label={t('labels.imageAlign')}
          className={'styled-buttons'}
        />
      </div>
      {/* Image link */}
      {props.showImageLink && (
        <Input
          name={'imageLink'}
          label={props.imageLinkLabel}
          setValue={handleImageChange}
          value={selectState.imageLink}
          disabled={noImage}
        />
      )}
      {props.showOptimizations && (
        <div className="image-optimizations">
          <h5 className="section-header">{t('widgetTitles.imageOptimiztions')}</h5>
          <ToggleSwitch
            onChange={setImageJs}
            checked={selectState.imageJs}
            name={'imageJs'}
            label={props.breakpointsLabel}
            disabled={noImage}
          />
          <h6 className="section-sub-header">{t('widgetTitles.noEmail')}</h6>
          <div className={cx('image-js', { hidden: !selectState.imageJs })}>
            <h6 className="section-label">{t('widgetTitles.imageBreakpoints')}</h6>
            <Checkbox
              setValue={setResponsive}
              checked={selectState.responsive}
              name={'responsive'}
              label={props.responsiveLabel}
            />
            {/* image placeholder */}
            {props.showPlaceholder && (
              <RadioButtons
                name={'placeholder'}
                items={props.placeholderItems}
                value={selectState.placeholder}
                setValue={setPlaceholder}
                label={'Placeholder'}
                className={'radio-group'}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default withFormsy(ImageSelector);
