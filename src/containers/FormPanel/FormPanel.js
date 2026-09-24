import React, { useRef } from 'react';
import cx from 'classnames';
import types from 'prop-types';
import {
  Tooltip,
  Select,
  TextArea,
  RadioButtons,
  OverlayEditor,
  ImageSelector
} from '../../components';
import Formsy from 'formsy-react';
import t from '../../services/i18n';
import { FormPanelContextProvider } from './FormPanelContext';
import { formsyImageScale as ImageScale } from '../../components/ImageScale/ImageScale';
import { formsyInput as Input } from '../../components/Input/Input';
import { formsyCldAssetSelector as CldAssetSelector } from '../../components/CldAssetSelector/CldAssetSelector';
import { formsyCldMediaEditor as CldMediaEditor } from '../../components/CldMediaEditor/CldMediaEditor';
import { formsyCheckbox as Checkbox } from '../../components/Checkbox/Checkbox';
import { formsySlider as Slider } from '../../components/Slider/Slider';

import './FormPanel.scss';

function renderFieldByType(field, assetSelector) {
  const key = field.name + field.type;
  let fieldComp;

  switch (field.type) {
    case 'imageSelect':
      fieldComp = (
        <ImageSelector
          name={'imageSelect'}
          placeholder={field.imagePlaceholder.placeholder}
          showPlaceholder={field.imagePlaceholder.show}
          altPlaceholder={field.alt.placeholder}
          altLabel={field.alt.label}
          showImageLink={field.imageLink.show}
          imageLinkLabel={field.imageLink.label}
          imageLinkDefault={field.imageLink.default}
          prevValue={field.selectState}
          cloudName={field.cloudName}
          previewServerUrl={field.previewServerUrl}
          initialAsset={field.initialAsset}
          openCldAssetSelector={assetSelector}
          analytics={field.analytics}
          nonEditableExts={field.nonEditableExts}
          showOptimizations={field.showOptimizations}
          key={key}
          sizeLimit={field.sizeLimit}
        />
      );
      break;
    case 'assetSelector':
      fieldComp = (
        <CldAssetSelector
          buttonLabel={field.buttonLabel}
          name={field.name}
          openCldAssetSelector={field.openCldAssetSelector}
          value={field.value}
          description={field.description}
          key={key}
        />
      );
      break;
    case 'mediaEditor':
      fieldComp = (
        <CldMediaEditor
          name={field.name}
          label={field.label}
          buttonLabel={field.buttonLabel}
          showReset={field.showReset}
          description={field.description}
          asset={field.asset}
          setValue={field.setValue}
          value={field.value}
          cloudName={field.cloudName}
          disabled={field.disabled}
          texts={field.texts}
          icon={field.icon}
          mewUrl={field.mewUrl}
          key={key}
        />
      );
      break;
    case 'select':
      fieldComp = (
        <Select
          options={field.options}
          pristine={field.pristine}
          disabled={field.disabled}
          name={field.name}
          label={field.label}
          fieldInfo={field.fieldInfo}
          key={key}
        />
      );
      break;
    case 'textArea':
      fieldComp = (
        <TextArea
          name={field.name}
          fieldInfo={field.fieldInfo}
          tooltipPlacement={field.tooltipPlacement}
          value={field.value}
          label={field.label}
          placeholder={field.placeholder}
          hidden={field.hidden}
          errorText={t(field.errorText)}
          isError={field.isError}
          key={key}
        />
      );
      break;
    case 'radioButtons':
      fieldComp = (
        <RadioButtons
          name={field.name}
          className={field.className}
          items={field.options}
          label={field.label}
          value={field.selected}
          key={key}
          disabled={field.disabled}
        />
      );
      break;
    case 'raw':
      fieldComp = field.content;
      break;
    case 'overlyEditor':
      fieldComp = (
        <OverlayEditor
          name={field.name}
          value={field.imageState}
          canvasWidth={field.width}
          canvasHeight={field.height}
          baseImage={field.baseImageUrl}
          cldConf={field.cldConf}
          userAgent={field.userAgent}
          hidden={field.hidden}
          key={key}
        />
      );
      break;
    case 'textInput':
      fieldComp = (
        <Input
          label={field.label}
          disabled={field.disabled}
          name={field.name}
          value={field.value}
          key={key}
        />
      );
      break;
    case 'imageScale':
      fieldComp = (
        <ImageScale
          label={field.label}
          value={field.value}
          name={field.name}
          disabled={field.disabled}
          width={field.width}
          height={field.height}
          key={key}
        />
      );
      break;
    case 'checkbox':
      fieldComp = (
        <Checkbox
          checked={field.value}
          name={field.name}
          disabled={field.disabled}
          fieldInfo={field.fieldInfo}
          tooltipPlacement={field.tooltipPlacement}
          label={field.label}
        />
      );
      break;
    case 'slider':
      fieldComp = (
        <Slider
          value={field.value}
          defaultValue={field.defaultValue}
          name={field.name}
          label={field.label}
          min={field.min}
          max={field.max}
          sliderLabels={field.sliderLabels}
          disabled={field.disabled}
          hidden={field.hidden}
          fieldInfo={field.fieldInfo}
        />
      );
      break;
  }
  return (
    <div className="field" key={key}>
      {fieldComp}
    </div>
  );
}

FormPanel.propTypes = {
  formConfig: types.array,
  cldConf: types.object,
  cld: types.any,
  updateParentState: types.func,
  children: types.object,
  openCldAssetSelector: types.func
};

function FormPanel(props) {
  const { formConfig } = props;
  const form = useRef(null);

  function handleChange(currentValues, isChanged) {
    if (isChanged) {
      props.updateParentState(currentValues);
    }
  }
  function handleKeyDown(e) {
    if (e.key === 'Enter' && e.target.type !== 'textarea') {
      // Prevent keyboard submits, allows Enter in textarea or submit buttons
      if (!['textarea', 'submit'].includes(e.target.type)) {
        e.preventDefault();
      }
    }
  }

  return (
    <FormPanelContextProvider cld={props.cld} assetPicker={props.openCldAssetSelector}>
      <Formsy
        preventDefaultSubmit={true}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        ref={form}
      >
        <div className={cx('form-container')}>
          {formConfig.map((widget, idx) => {
            const additionalClasses = widget.additionalClasses
              ? widget.additionalClasses.join()
              : '';
            return (
              <div
                key={widget.title || idx}
                className={cx(
                  'widget',
                  widget.title && 'widget-' + widget.title,
                  additionalClasses
                )}
              >
                {widget.hideHeader !== true && (
                  <div className="widget-header">
                    {widget.title && (
                      <h5 className="widget-label">
                        {t(widget.text) || widget.text || t(widget.title) || widget.title}
                        {widget.fieldSetInfo && (
                          <Tooltip key={`tooltip-${idx}`} content={t(widget.fieldSetInfo)} />
                        )}
                      </h5>
                    )}
                  </div>
                )}
                <div className="widget-body">
                  {widget.fields.map((field) => {
                    return renderFieldByType(field, props.openCldAssetSelector);
                  })}
                </div>
              </div>
            );
          })}
          <span data-iframe-height />
        </div>
      </Formsy>
    </FormPanelContextProvider>
  );
}

export default FormPanel;
