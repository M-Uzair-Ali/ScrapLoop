import { UserRole } from "../types";

export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Signup: { role: UserRole };
};

export type HouseholdStackParamList = {
  HouseholdHome: undefined;
  PostListing: undefined;
  PostListingSuccess: { matchedCollectors: number; candidatesConsidered: number };
};

export type CollectorStackParamList = {
  CollectorHome: undefined;
  ListingDetail: { listingId: string; matchId: string; isOwnAccepted?: boolean };
};
