import { apiRequest } from "./client";

export function acceptMatch(matchId: string) {
  return apiRequest<{ ok: true; listing_id: string }>(`/matches/${matchId}/accept`, {
    method: "POST",
  });
}

export function declineMatch(matchId: string) {
  return apiRequest<{ ok: true }>(`/matches/${matchId}/decline`, { method: "POST" });
}
