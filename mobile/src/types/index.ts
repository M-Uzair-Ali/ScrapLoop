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

export const SCRAP_CATEGORIES: { key: ScrapCategory; label: string }[] = [
  { key: "newspaper", label: "Newspaper" },
  { key: "cardboard", label: "Cardboard" },
  { key: "mixed_paper", label: "Mixed paper" },
  { key: "iron", label: "Iron" },
  { key: "steel", label: "Steel" },
  { key: "aluminum", label: "Aluminum" },
  { key: "copper", label: "Copper" },
  { key: "plastic_bottles", label: "Plastic bottles" },
  { key: "mixed_plastic", label: "Mixed plastic" },
  { key: "glass", label: "Glass" },
  { key: "e_waste", label: "E-waste" },
  { key: "other", label: "Other" },
];

export interface AuthUser {
  id: string;
  phone_number: string;
  name: string;
  role: UserRole;
  rating_avg?: string;
  rating_count?: number;
}

export interface Coords {
  lat: number;
  lng: number;
}
