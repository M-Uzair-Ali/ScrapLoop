import React, { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { useAuth } from "../../context/AuthContext";
import {
  fetchNearbyListings,
  fetchAcceptedPickups,
  MatchedListing,
  AcceptedPickup,
} from "../../api/listings";
import { colors, radius, spacing, type } from "../../theme/tokens";
import { SCRAP_CATEGORIES } from "../../types";
import { CollectorStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<CollectorStackParamList, "CollectorHome">;

function categoryLabel(key: string) {
  return SCRAP_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

function itemsSummary(items: { category: string; estimated_weight_kg: number }[]) {
  return items.map((i) => `${categoryLabel(i.category)} (${i.estimated_weight_kg}kg)`).join(", ");
}

export function CollectorHomeScreen({ navigation }: Props) {
  const { user, signOut } = useAuth();
  const [matches, setMatches] = useState<MatchedListing[]>([]);
  const [accepted, setAccepted] = useState<AcceptedPickup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const [{ matches: fetchedMatches }, { accepted: fetchedAccepted }] = await Promise.all([
        fetchNearbyListings(),
        fetchAcceptedPickups(),
      ]);
      setMatches(fetchedMatches);
      setAccepted(fetchedAccepted);
    } catch {
      // keep last-known lists on a transient error
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <Screen scroll={false}>
      <Text style={styles.greeting}>Hi {user?.name?.split(" ")[0]},</Text>
      <Text style={styles.subtitle}>
        {loading
          ? "Checking for matches…"
          : matches.length > 0
          ? "Matched nearby"
          : "No matched listings nearby yet"}
      </Text>

      <FlatList
        data={matches}
        keyExtractor={(m) => m.match_id}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.steel} />
        }
        ListHeaderComponent={
          accepted.length > 0 ? (
            <View style={{ marginBottom: spacing.lg }}>
              <Text style={styles.sectionTitle}>Your accepted pickups</Text>
              {accepted.map((pickup) => (
                <Pressable
                  key={pickup.match_id}
                  style={styles.acceptedCard}
                  onPress={() =>
                    navigation.navigate("ListingDetail", {
                      listingId: pickup.listing_id,
                      matchId: pickup.match_id,
                      isOwnAccepted: true,
                    })
                  }
                >
                  <Text style={styles.acceptedHousehold}>{pickup.household.name}</Text>
                  <Text style={styles.listingItems}>{itemsSummary(pickup.items)}</Text>
                  {pickup.description ? (
                    <Text style={styles.listingDesc}>{pickup.description}</Text>
                  ) : null}
                </Pressable>
              ))}
              <Text style={styles.sectionTitle}>Nearby matches</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>You'll see listings here</Text>
              <Text style={styles.cardBody}>
                We'll notify you when a household nearby posts scrap in a category you buy. Pull
                down to refresh.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.listingCard}
            onPress={() =>
              navigation.navigate("ListingDetail", {
                listingId: item.listing_id,
                matchId: item.match_id,
              })
            }
          >
            <View style={styles.listingHeader}>
              <Text style={styles.listingHousehold}>{item.household.name}</Text>
              <Text style={styles.listingScore}>{Math.round(item.score * 100)}% match</Text>
            </View>
            <Text style={styles.listingItems}>{itemsSummary(item.items)}</Text>
            {item.description ? <Text style={styles.listingDesc}>{item.description}</Text> : null}
          </Pressable>
        )}
      />

      <Button label="Log out" variant="ghost" onPress={signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  greeting: { ...type.display, color: colors.ink },
  subtitle: { ...type.body, color: colors.inkMuted, marginTop: spacing.xs, marginBottom: spacing.lg },
  sectionTitle: {
    ...type.label,
    color: colors.inkMuted,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
  },
  card: {
    backgroundColor: colors.steelLight,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  cardTitle: { ...type.bodyBold, color: colors.ink, marginBottom: spacing.xs },
  cardBody: { ...type.body, color: colors.inkMuted },
  listingCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  acceptedCard: {
    backgroundColor: colors.steelLight,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.steel,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  acceptedHousehold: { ...type.bodyBold, color: colors.steel, marginBottom: spacing.xs },
  listingHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.xs },
  listingHousehold: { ...type.bodyBold, color: colors.ink },
  listingScore: { ...type.label, color: colors.steel },
  listingItems: { ...type.body, color: colors.ink, marginBottom: spacing.xs },
  listingDesc: { ...type.caption, color: colors.inkMuted },
});
