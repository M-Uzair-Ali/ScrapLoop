import { apiRequest } from "./client";
import { AuthUser, Coords, ScrapCategory, UserRole } from "../types";

interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface SignupInput {
  phone_number: string;
  password: string;
  name: string;
  role: UserRole;
  location: Coords;
  collector_profile?: {
    categories_bought: ScrapCategory[];
    service_radius_km: number;
    capacity_kg_per_day: number;
  };
}

export function signup(input: SignupInput) {
  return apiRequest<AuthResponse>("/auth/signup", { method: "POST", body: input, auth: false });
}

export function login(phone_number: string, password: string) {
  return apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: { phone_number, password },
    auth: false,
  });
}

export function fetchMe() {
  return apiRequest<{ user: AuthUser }>("/users/me");
}
