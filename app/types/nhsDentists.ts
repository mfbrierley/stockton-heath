/** Mirrors `NhsDentist` in backend/src/nhsDentists.ts. */
export type DentistStatus =
  | "accepting"
  | "not_accepting"
  | "not_confirmed"
  | "referral_only";

export interface NhsDentist {
  odsCode: string;
  name: string;
  address: string;
  phone: string | null;
  distanceMiles: number;
  status: DentistStatus;
  /** Which groups of new NHS patients it is taking on. All false unless `status` is "accepting". */
  accepting: { adults: boolean; children: boolean; freeCare: boolean };
  urgentCare: boolean;
  /** YYYY-MM-DD the practice last confirmed its status with the NHS */
  lastConfirmed: string | null;
  /** The practice's page on nhs.uk */
  nhsUrl: string;
}

export interface NhsDentistsResponse {
  data: NhsDentist[];
  /** When the backend last read nhs.uk, in milliseconds since the epoch */
  fetchedAt: number;
}
