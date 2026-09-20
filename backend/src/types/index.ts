export type UserRole = "household" | "collector";

export type ScrapCategory =
  | "newspaper"
  | "cardboard"
  | "mixed_paper"
  | "iron"
  | "steel"
  | "aluminum"
  | "copper"
  | "plastic_bottles"
  | "mixed_plastic"
  | "glass"
  | "e_waste"
  | "other";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface AuthTokenPayload {
  userId: string;
  role: UserRole;
}

export interface UserRecord {
  id: string;
  phone_number: string;
  name: string;
  role: UserRole;
  rating_avg: string;
  rating_count: number;
  created_at: string;
}

export interface CollectorProfileInput {
  categories_bought: ScrapCategory[];
  service_radius_km: number;
  capacity_kg_per_day: number;
  vehicle_type?: string;
}
