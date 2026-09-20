import { pool } from "../db/pool";
import { ScrapCategory } from "../types";

export interface ListingForMatching {
  id: string;
  lat: number;
  lng: number;
  categories: ScrapCategory[];
  totalWeightKg: number;
}

export interface ScoredCandidate {
  collectorId: string;
  name: string;
  ratingAvg: number;
  distanceKm: number;
  categoryMatchRatio: number;
  score: number;
}

// Scoring weights — see design doc §5 for rationale. Kept as named constants
// (not magic numbers) so they're easy to tune/justify in a demo or writeup.
const WEIGHTS = {
  categoryMatch: 0.4,
  proximity: 0.3,
  weightValue: 0.15,
  rating: 0.15,
};

// A load at or above this is treated as "maximally attractive" for the weight-value term.
const REFERENCE_MAX_WEIGHT_KG = 30;

/**
 * Finds candidate collectors for a listing and scores them.
 *
 * Candidate filter (hard constraints):
 *   - role = collector, availability_status = true
 *   - at least one overlapping category between listing and collector's categories_bought
 *   - within the COLLECTOR's own configured service_radius_km (not a fixed global radius)
 *
 * Score (soft ranking, see WEIGHTS above):
 *   categoryMatchRatio  — fraction of the listing's categories this collector buys
 *   proximity           — 1 - (distance / service_radius), clamped to [0,1]
 *   weightValue         — total listing weight normalized against a reference max
 *   rating              — collector's rating_avg / 5
 */
export async function findAndScoreCandidates(
  listing: ListingForMatching
): Promise<ScoredCandidate[]> {
  const { rows } = await pool.query(
    `SELECT
       u.id AS collector_id,
       u.name,
       u.rating_avg,
       cp.categories_bought,
       cp.service_radius_km,
       ST_Distance(u.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1000.0
         AS distance_km
     FROM users u
     JOIN collector_profiles cp ON cp.user_id = u.id
     WHERE u.role = 'collector'
       AND cp.availability_status = true
       AND cp.categories_bought && $3::scrap_category[]
       AND ST_DWithin(
             u.location,
             ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
             cp.service_radius_km * 1000
           )`,
    [listing.lng, listing.lat, listing.categories]
  );

  const scored: ScoredCandidate[] = rows.map((row) => {
    const categoriesBought: ScrapCategory[] = row.categories_bought;
    const overlap = listing.categories.filter((c) => categoriesBought.includes(c)).length;
    const categoryMatchRatio = overlap / listing.categories.length;

    const distanceKm = Number(row.distance_km);
    const serviceRadiusKm = Number(row.service_radius_km);
    const proximity = Math.max(0, 1 - distanceKm / serviceRadiusKm);

    const weightValue = Math.min(1, listing.totalWeightKg / REFERENCE_MAX_WEIGHT_KG);

    const ratingAvg = Number(row.rating_avg) || 0;
    const ratingScore = ratingAvg / 5;

    const score =
      WEIGHTS.categoryMatch * categoryMatchRatio +
      WEIGHTS.proximity * proximity +
      WEIGHTS.weightValue * weightValue +
      WEIGHTS.rating * ratingScore;

    return {
      collectorId: row.collector_id,
      name: row.name,
      ratingAvg,
      distanceKm,
      categoryMatchRatio,
      score,
    };
  });

  return scored.sort((a, b) => b.score - a.score);
}

/** How many top-scored collectors get notified per listing (race-to-accept). */
export const NOTIFY_TOP_N = 3;
