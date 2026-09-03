// One approved, paid-for discount, as the app receives it.
//
// Mirrors PUBLIC_LISTING_FIELDS in backend/src/index.ts by hand - there is no
// shared types package between the app and the backend, and the backend picks
// these five columns explicitly so that a column added to BusinessListing
// later cannot leak into a response anyone with the app can read.
//
// `description` is optional to write and arrives as "" rather than null.
// `imageUrl` is null until Cloudflare R2 is configured, which is to say: on
// every listing there is today.
export type BusinessListing = {
  id: number;
  businessName: string;
  // One of the eight the backend allows. Not narrowed to a union here on
  // purpose: the app is shipped separately from the backend, and a listing
  // filed under a category added after this build went out should still
  // appear rather than fail to type. The filters are built from whatever
  // comes back, so a new one needs no change here.
  category: string;
  discountText: string;
  description: string;
  imageUrl: string | null;
};
