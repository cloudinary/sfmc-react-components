# sfmc-react-components

React components used to build Cloudinary's Salesforce Marketing Cloud (SFMC) Content
Builder app — asset selection, image/video editing, and media library UI built on top
of Cloudinary's SDKs.

This library is published as source, not to a package registry. Build it locally and
consume it from your project:

```bash
git clone https://github.com/cloudinary/sfmc-react-components.git
cd sfmc-react-components
yarn install
yarn build          # emits dist/
```

Then reference the built output from your app — for example via `yarn link`, a
`file:` dependency, or by vendoring `dist/`.

## Usage

```jsx
import { FormPanel } from 'sf-component-lib2';
import 'sf-component-lib2/dist/index.css';

function Example() {
  return (
    <FormPanel
      cldConf={{ cloud_name: 'demo' }}
      formConfig={[/* field configuration */]}
    />
  );
}
```

## What's included

- **Components** (`src/components`) — building blocks such as `CldAssetSelector`, `CldMediaEditor`, `ImageScale`, `OverlayEditor`, `VideoSelector`, `ColorPicker`, and standard form inputs (`Select`, `Slider`, `Checkbox`, `RadioButtons`, etc).
- **Containers** (`src/containers`) — `FormPanel`, which composes components into configurable forms driven by a `formConfig` schema.
- **`cloudinary-sfmc/`** — a standalone demo app (Media Library UI) showing the components wired together end-to-end.
- **`preview-server/`** — a small standalone backend that signs short-lived preview URLs for embargoed (Access Control-restricted) assets, so they can be previewed in the content-block editor before the embargo lifts. See [preview-server/README.md](preview-server/README.md).

## Development

```bash
yarn install
yarn start          # build the library in watch mode
yarn cloudinary-sfmc # run the demo app
```

## Testing

```bash
yarn test:unit
```

## License

MIT — see [LICENSE](LICENSE).
