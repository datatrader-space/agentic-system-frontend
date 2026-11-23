// How closely two labellers agreed on the same photos, in plain words, for a batch (assignment rows) and a dataset
// version (version rows). The backend sends ``agreement`` (the corner distance as a fraction of the photo's diagonal),
// ``agreement_mask_iou`` (the mean pixel overlap of mask pairs, 0..1) and, for a batch, ``agreement_photos``; each is
// null when it was not measured. Only the figures that exist are said; nothing at all when neither exists.

// A share as a percent with at most one decimal: 0.0081 -> "0.8", 0.78 -> "78", 0.7856 -> "78.6".
export function percentOf(share) {
  return String(Math.round(share * 1000) / 10);
}
const figure = value => typeof value === 'number' && Number.isFinite(value);

export function agreementLines({ agreement = null, maskIou = null, photos = 0 } = {}) {
  const on = Number.isInteger(photos) && photos > 0 ? ` (${photos} photo${photos === 1 ? '' : 's'})` : '';
  const lines = [];
  if (figure(agreement)) lines.push(`Labellers agree: corners within ${percentOf(agreement)} % of the photo's diagonal${on}`);
  if (figure(maskIou)) lines.push(`Masks overlap ${percentOf(maskIou)} %${on}`);
  return lines;
}

// The figures of a row as the backend sends them.
export function agreementOf(row) {
  return { agreement: row?.agreement ?? null, maskIou: row?.agreement_mask_iou ?? null, photos: Number(row?.agreement_photos) || 0 };
}
