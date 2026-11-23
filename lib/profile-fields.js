// Shared validation for self-service account photo / name / status updates.

function normalizeName(value) {
  if (typeof value !== 'string') return null;
  const name = value.trim().replace(/\s+/g, ' ');
  return name.length >= 2 && name.length <= 80 ? name : null;
}

function normalizeStatus(value) {
  if (typeof value !== 'string') return null;
  const status = value.trim();
  return status.length <= 120 ? status : null;
}

function normalizePhoto(value) {
  if (value === '') return '';
  if (typeof value !== 'string' || value.length > 400000) return null;
  if (!/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(value)) return null;
  return value;
}

function validate(body) {
  const input = body || {};
  const errors = {};
  const name = normalizeName(input.name);
  const status = normalizeStatus(input.status === undefined ? '' : input.status);
  const photo = normalizePhoto(input.photo === undefined ? '' : input.photo);
  if (name === null) errors.name = 'Name must be 2–80 characters.';
  if (status === null) errors.status = 'Status must be 120 characters or fewer.';
  if (photo === null) errors.photo = 'Choose a small JPG, PNG, WebP or GIF image.';
  return { errors, values: { name, status, photo } };
}

module.exports = { normalizeName, normalizeStatus, normalizePhoto, validate };
