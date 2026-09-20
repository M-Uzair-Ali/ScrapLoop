import { apiRequest } from "./client";
import { Coords, ScrapCategory } from "../types";

export interface ListingItemInput {
  category: ScrapCategory;
  estimated_weight_kg: number;
  notes?: string;
}

export interface CreateListingInput {
  description?: string;
  photo_urls?: string[];
  location: Coords;
  items: ListingItemInput[];
}

export interface CreateListingResponse {
  listing: { id: string; created_at: string };
  matched_collectors: number;
  candidates_considered: number;
}

export function createListing(input: CreateListingInput) {
  return apiRequest<CreateListingResponse>("/listings", { method: "POST", body: input });
}

export interface MatchedListing {
  match_id: string;
  listing_id: string;
  score: number;
  match_status: string;
  listing_status: string;
  description: string | null;
  photo_urls: string[];
  location: Coords;
  household: { name: string; rating_avg: number };
  items: { category: ScrapCategory; estimated_weight_kg: number; notes: string | null }[];
}

export function fetchNearbyListings() {
  return apiRequest<{ matches: MatchedListing[] }>("/listings/nearby");
}

export interface AcceptedPickup {
  match_id: string;
  listing_id: string;
  listing_status: string;
  responded_at: string;
  description: string | null;
  photo_urls: string[];
  household: { name: string; rating_avg: number };
  items: { category: ScrapCategory; estimated_weight_kg: number; notes: string | null }[];
}

export function fetchAcceptedPickups() {
  return apiRequest<{ accepted: AcceptedPickup[] }>("/listings/accepted");
}

export interface MyListing {
  id: string;
  description: string | null;
  photo_urls: string[];
  status: string;
  created_at: string;
  items: { category: ScrapCategory; estimated_weight_kg: number; notes: string | null }[];
  pending_collectors: number;
  total_notified: number;
}

export function fetchMyListings() {
  return apiRequest<{ listings: MyListing[] }>("/listings/mine");
}

export interface ListingDetail {
  id: string;
  description: string | null;
  photo_urls: string[];
  status: string;
  created_at: string;
  location: Coords;
  household: { id: string; name: string; rating_avg: number };
  items: { category: ScrapCategory; estimated_weight_kg: number; notes: string | null }[];
}

export function fetchListing(id: string) {
  return apiRequest<{ listing: ListingDetail }>(`/listings/${id}`);
}
