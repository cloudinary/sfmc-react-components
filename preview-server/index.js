import 'dotenv/config';
import { v2 as cloudinary } from 'cloudinary';
import { createApp } from './app.js';

// Defensive trim: a stray trailing space or newline picked up when
// copy-pasting a credential into .env silently corrupts an HMAC key while
// still looking correct when printed — this rules that class of bug out
// entirely rather than relying on the value being pasted cleanly.
function trimmedEnv(name) {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : value;
}

cloudinary.config({
  cloud_name: trimmedEnv('CLOUDINARY_CLOUD_NAME'),
  api_key: trimmedEnv('CLOUDINARY_API_KEY'),
  api_secret: trimmedEnv('CLOUDINARY_API_SECRET')
});

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = createApp({
  cloudinary,
  accessControlKey: trimmedEnv('CLOUDINARY_ACCESS_CONTROL_KEY'),
  allowedOrigins,
  previewTtlSeconds: process.env.PREVIEW_TTL_SECONDS ? Number(process.env.PREVIEW_TTL_SECONDS) : undefined
});

const port = process.env.PORT || 8787;
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Embargo preview server listening on port ${port}`);
});
