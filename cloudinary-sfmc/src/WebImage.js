import React, {useContext} from 'react';
import { FormPanel } from 'sf-component-lib2';
import { ImageContext } from './ImageContext';
import 'sf-component-lib2/dist/index.css';

export default function WebImage({ cnf }) {
  let { imageState, setImageState} = useContext(ImageContext);
  const nonEditableExtsList = process.env.REACT_APP_NON_EDITABLE_EXT ? process.env.REACT_APP_NON_EDITABLE_EXT : null;
  let nonEditableArray;
  if (nonEditableExtsList) {
    nonEditableArray = nonEditableExtsList.split(',');
  }

  return (
    <FormPanel cldConf={cnf.cldConf} updateParentState={setImageState} openCldAssetSelector={cnf.assetSelector} cld={cnf.cld} formConfig={[{
      title: 'Image',
      fieldSetInfo: 'Select an image from your Cloudinary cloud',
      fields: [
        {
          type: 'imageSelect',
          name: 'imageSelect',
          cloudName: cnf.cldConf.cloud_name,
          previewServerUrl: cnf.previewServerUrl,
          initialAsset: cnf.initialAsset,
          selectState: imageState.imageSelect || {},
          buttonLabel: 'selectImage',
          analytics: cnf.ver,
          sizeLimit: Number(cnf.videoSizeLimit),
          nonEditableExts: nonEditableArray,
          alt: {
            label: 'Image alt text',
            placeholder: 'Description of the image',
          },
          imagePlaceholder: {
            show: true,
            placeholder: 'none'
          },
          imageLink: {
            show: true,
            label: 'Image Link',
            default: 'https://cloudinary.com'
          }
        },
      ]
    }]} />
  );
}
