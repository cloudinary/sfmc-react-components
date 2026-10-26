import React, { useState, Suspense, useCallback } from 'react';
// import { ImageContextProvider } from './ImageContext';
import { default as cloudinary } from 'cloudinary-core';

import 'sf-component-lib2/dist/index.css';
import { BrowserRouter as Router, Switch, Route } from 'react-router-dom';

import { getVer } from './utils';
import DevNav from './DevNav';

const isLocalDev = window.location.hostname === 'localhost';
const ImageContextProvider = React.lazy(() => import('./ImageContext'));
const Video2GifContextProvider = React.lazy(() => import('./Video2GifContext'));
const Advanced = React.lazy(() => import('./Advanced'));
const AdvEditor = React.lazy(() => import('./AdvEditor'));
const WebImage = React.lazy(() => import('./WebImage'));
const MediaLib = React.lazy(() => import('./MediaLib'));
const Video2Gif = React.lazy(() => import('./Video2Gif'));
const Video2GifAdv = React.lazy(() => import('./Video2GifAdv'));

const App = () => {
  const [state, setState] = useState({});
  const parms = new URLSearchParams(window.location.search);
  const ver = getVer();

  const onMessage = useCallback(({ setAsset, showOpts, source }) => {
    return (ev) => {
      if (ev.origin !== window.location.origin) {
        return;
      }
      let data = ev.data;
      switch (data.messageType) {
        case 'asset':
          data.source = source;
          setAsset(data);
          break;
        case 'ready':
          showOpts.messageType = 'open';
          window.newTab.postMessage(showOpts, window.location.origin);
          break;
        default:
          break;
      }
    };
  }, []);

  const openMlw = (setAsset, showOpts, source) => {
    if (window.newTab && !window.newTab.closed) {
      window.newTab.focus();
    } else {
      // Each previous "Choose Image" click (once its popup was closed) left
      // its own 'message' listener attached here — they were never removed,
      // only ever added to. A single 'ready' from a new popup would then be
      // answered by every accumulated listener, so the popup received
      // multiple 'open' messages and re-ran its validators once per message.
      if (window.newTabMessageHandler) {
        window.removeEventListener('message', window.newTabMessageHandler);
      }
      window.newTab = window.open(
        document.location.origin + '/mlw' + document.location.search,
        '_blank'
      );
      const messageHandler = onMessage({ setAsset, showOpts, source });
      window.newTabMessageHandler = messageHandler;
      window.addEventListener('message', messageHandler);
    }
  };

  // eslint-disable-next-line no-undef
  let cldConf = { cloud_name: parms.get('cloudName'), secure: true, api_key: parms.get('apiKey') };
  if (parms.get('cname')) {
    cldConf.secure_distribution = parms.get('cname');
    cldConf.private_cdn = true;
  }
  if (parms.get('pCdn') === 'true') {
    cldConf.private_cdn = true;
  }
  if (parms.get('apiCname')) {
    cldConf.upload_prefix = parms.get('apiCname');
  } else {
    cldConf.upload_prefix = 'api.cloudinary.com';
  }
  const cld = cloudinary.Cloudinary.new(cldConf);
  let pr = {
    cldConf: cldConf,
    videoSizeLimit: parms.get('videoSizeLimit') ? parms.get('videoSizeLimit') : 40,
    ver: ver,
    imageSettings: {
      defaults: {
        format: 'auto',
        quality: 'auto',
        dpr: 'auto',
        transOverride: '',
        overlaySelect: 'editor',
        imageSelect: {},
        ovEd: {}
      }
    },
    setState: setState,
    state: state,
    assetSelector: openMlw,
    previewServerUrl: parms.get('previewServerUrl'),
    initialAsset: parms.get('initialAsset'),
    cld: cld
  };

  return (
    <Router>
      {isLocalDev && <DevNav />}
      <Route
        exact
        path="/mlw"
        render={(props) => (
          <Suspense fallback={<div>Loading....</div>}>
            <MediaLib
              {...props}
              cnf={cldConf}
              ver={ver}
              previewServerUrl={parms.get('previewServerUrl')}
            />
          </Suspense>
        )}
      />
      <Switch>
        <Route exact path={['/web-image', '/advanced', '/adv-edit']}>
          <Route
            exact
            path="/web-image"
            render={(props) => (
              <Suspense fallback={<div>Loading....</div>}>
                <ImageContextProvider
                  cld={cld}
                  qParams={parms.toString()}
                  imageSettingsDefaults={pr.imageSettings.defaults}
                >
                  {' '}
                  <WebImage {...props} cnf={pr} />{' '}
                </ImageContextProvider>
              </Suspense>
            )}
          />
          <Route
            exact
            path="/advanced"
            render={(props) => (
              <Suspense fallback={<div>Loading....</div>}>
                {' '}
                <ImageContextProvider
                  cld={cld}
                  qParams={parms.toString()}
                  imageSettingsDefaults={pr.imageSettings.defaults}
                >
                  {' '}
                  <Advanced {...props} cnf={pr} />{' '}
                </ImageContextProvider>
              </Suspense>
            )}
          />
          <Route
            exact
            path="/adv-edit"
            render={(props) => (
              <Suspense fallback={<div>Loading....</div>}>
                <ImageContextProvider
                  cld={cld}
                  qParams={parms.toString()}
                  imageSettingsDefaults={pr.imageSettings.defaults}
                >
                  {' '}
                  <AdvEditor {...props} cnf={pr} />{' '}
                </ImageContextProvider>
              </Suspense>
            )}
          />
        </Route>
        <Route path={['/video-2-gif', '/gif-advanced']}>
          <Route
            exact
            path="/video-2-gif"
            render={(props) => (
              <Suspense fallback={<div>Loading....</div>}>
                {' '}
                <Video2GifContextProvider cld={cld} qParams={parms.toString()}>
                  {' '}
                  <Video2Gif {...props} cnf={pr} />{' '}
                </Video2GifContextProvider>{' '}
              </Suspense>
            )}
          />
          <Route
            exact
            path="/gif-advanced"
            render={(props) => (
              <Suspense fallback={<div>Loading....</div>}>
                <Video2GifContextProvider cld={cld} qParams={parms.toString()}>
                  {' '}
                  <Video2GifAdv {...props} cnf={pr} />{' '}
                </Video2GifContextProvider>{' '}
              </Suspense>
            )}
          />
        </Route>
      </Switch>
      <div className="version">Version: {ver.version}</div>
    </Router>
    /*
  <Router>
    <React.Fragment>
      <Switch>
        <ImageContextProvider cld={cld} qParams={parms.toString()} imageSettingsDefaults={pr.imageSettings.defaults}>
          <Route exact path="/web-image" render={(props) => <WebImage {...props} cnf={pr} />} />
          <Route exact path="/advanced" render={(props) => <Advanced {...props} cnf={pr} />} />
          <Route exact path="/adv-edit" render={(props) => <AdvEditor {...props} cnf={pr} />} />
          <Route exact path="/mlw" render={(props) => <MediaLib {...props} cnf={cldConf} ver={ver} />} />
        </ImageContextProvider>
      </Switch>
    </React.Fragment>
    <React.Fragment>
      <Switch>
        <Video2GifContextProvider cld={cld} qParams={parms.toString()}>
          <Route exact path="/video-2-gif" render={(props) => <Video2Gif {...props} cnf={pr} />} />
          <Route exact path="/gif-advanced" render={(props) => <Video2GifAdv {...props} cnf={pr} />} />
        </Video2GifContextProvider>
      </Switch>
    </React.Fragment>
    <div className="version">Version: {ver.version}</div>
  </Router>
*/
  );
};

export default App;
