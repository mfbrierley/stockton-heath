export type UPRN = string;

export interface AddressEntry {
  [address: string]: UPRN;
}

export type AddressesResponse = AddressEntry[];

export interface UserAddress {
  uprn: UPRN;
  address: string;
}
