# ScrapLoop Mobile (Phase 0 + Phase 1)

React Native + Expo + TypeScript. One app, two roles (household / collector) — role is chosen at
signup and drives which navigation stack the user lands in.

## What's implemented in Phase 0

- Full auth flow: Welcome (role picker) → Signup (role-conditional form — collectors also pick
  categories they buy + service radius) → Login → session persisted via AsyncStorage.
- Location capture via `expo-location` at signup (required — it's what powers matching later).
- `AuthContext` — global session state, auto-restores session on app relaunch by calling
  `GET /users/me` with the stored token.
- Role-based root navigator: logged out → auth stack; household → household stack; collector →
  collector stack. Each currently has one home screen stub, ready for Phase 1 screens.
- A small design-token system (`src/theme/tokens.ts`) with a palette grounded in the subject matter
  (kraft paper, galvanized steel, marigold street-signage) rather than generic app defaults, and
  distinct accent colors per role so the two halves of the app read as different modes.

This has been `npm install`-ed and `tsc --noEmit`-checked in this environment with **zero type
errors**. It has not been run in an actual Expo/simulator environment here — do that on your machine.

## Setup

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go (iOS/Android), or press `i` / `a` for a simulator.

**Important:** edit `src/api/client.ts` → `API_BASE_URL`. `localhost` only works if you're running
in a web browser or an emulator with port forwarding set up. On a physical phone via Expo Go, use
your computer's LAN IP (e.g. `http://192.168.1.20:4000`) — the backend needs to be reachable from
the phone's network.

## Demo flow this already supports

1. Open the app on two devices/simulators.
2. Device A: "Continue as Household" → fill form → share location → account created, lands on
   Household home.
3. Device B: "Continue as Collector" → fill form, pick categories bought → share location →
   account created, lands on Collector home.
4. Close and reopen the app on either — session persists, no re-login needed.

That's the skeleton the "household posts / collector's phone lights up" demo gets built on top of
in Phase 1.

## What's implemented in Phase 1

- **`PostListingScreen`** (household): category chips + a weight field, "+ Add item" builds up a
  list (so one listing can be "newspapers + 2 broken fans" — multiple categories, one post),
  optional note, location capture, submit.
- **`PostListingSuccessScreen`**: shows how many nearby collectors were actually notified —
  pulled from the real matching engine's response, not a canned number.
- **Collector `HomeScreen`** (rewritten): now a real `FlatList` pulling `GET /listings/nearby`,
  pull-to-refresh, shows each matched listing's items and a match-quality percentage. Refetches
  automatically whenever the screen regains focus (`useFocusEffect`), so accepting/declining and
  coming back shows an up-to-date feed without a manual reload.
- **`ListingDetailScreen`** (collector): full item breakdown, household name + rating, Accept
  Pickup / Not Interested. Accept calls the backend's race-to-accept endpoint — if another
  collector beat you to it, you get a clear message instead of a silent failure.

## Demo flow this now supports end to end

1. Household: "+ Post scrap" → add "Newspaper, 8kg" → add "Iron, 5kg" → note "pickup after 5pm" →
   share location → post. See "Notified 1 collector nearby" (or however many actually matched).
2. Collector: pull to refresh on home screen → see the listing appear with a match % → tap in →
   see both items listed → "Accept pickup".
3. Go back to the collector home feed — the accepted listing is gone from the open feed (its
   match status is no longer `notified`/`viewed`).

This is the actual two-device demo described in the original project pitch: household posts,
collector's feed lights up, collector accepts.

## What's next (Phase 2)

- Push notifications (right now the collector sees new matches on refresh, not instantly)
- A "my listings" view for households to see status of what they've posted
- Transaction completion flow (log actual weight/price on pickup) — feeds Phase 3's pricing engine
