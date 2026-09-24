// If the plain, unauthenticated URL isn't reachable, ask the embargo preview
// server whether that's because the asset is genuinely Cloudinary Access
// Control-restricted (our embargo case) before giving up. When it is, we
// still resolve — the asset stays selectable — but attach a short-lived
// signed preview URL (and the access_control rule, for messaging) onto the
// asset object so the editor can render a real preview while the asset
// isn't publicly reachable yet.
// A minimal wrapper around window.fetch that always returns a promise that
// rejects rather than throwing synchronously. Some browser extensions patch
// window.fetch and can throw a plain TypeError('Failed to fetch') outright
// instead of returning a rejected promise — when that happens inside a
// .then()/.catch() callback (as it does below), it turns into an unhandled
// promise rejection instead of being caught by the surrounding .catch().
function safeFetch(...fetchArgs) {
  try {
    return fetch(...fetchArgs);
  } catch (err) {
    return Promise.reject(err);
  }
}

function tryEmbargoPreview(asset, previewServerUrl, resolve, reject) {
  if (!previewServerUrl) {
    reject('restricted');
    return;
  }
  safeFetch(`${previewServerUrl.replace(/\/+$/, '')}/api/embargo-preview-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      publicId: asset.public_id,
      resourceType: asset.resource_type,
      deliveryType: asset.type
    })
  })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (!data) {
        reject('restricted');
        return;
      }
      asset.embargoPreviewUrl = data.url;
      asset.accessControl = data.accessControl;
      resolve();
    })
    .catch(() => reject('restricted'));
}

export default {
  isNotRestricted: (args) => {
    const { asset, previewServerUrl } = args;
    return new Promise((resolve, reject) => {
      safeFetch(asset.secure_url, { method: 'HEAD' })
        .then((res) => {
          if (res.ok) {
            resolve();
          } else {
            tryEmbargoPreview(asset, previewServerUrl, resolve, reject);
          }
        })
        .catch(() => {
          tryEmbargoPreview(asset, previewServerUrl, resolve, reject);
        });
    });
  },
  isNotOverSizeLimit: (args) => {
    const { asset, sizeLimit } = args;
    return new Promise((resolve, reject) => {
      if (asset.bytes / 1024 / 1024 < sizeLimit) {
        resolve();
      } else {
        reject('tooBig');
      }
    });
  },
  isRightType: (args) => {
    const { asset, rightType } = args;
    return new Promise((resolve, reject) => {
      if (asset.resource_type === rightType && asset.resource_type !== 'raw') {
        resolve();
      } else {
        reject('wrongType');
      }
    });
  },
  hasDimensions: (args) => {
    const { asset } = args;
    return new Promise((resolve, reject) => {
      if (asset.height > 0 && asset.width > 0) {
        resolve();
      } else {
        reject('noDimensions');
      }
    });
  }
};
