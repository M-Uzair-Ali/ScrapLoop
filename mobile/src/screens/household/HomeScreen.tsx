import React, { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { useAuth } from "../../context/AuthContext";
import { fetchMyListings, MyListing } from "../../api/listings";
import { colors, radius, spacing, type } from "../../theme/tokens";
import { SCRAP_CATEGORIES } from "../../types";
import { HouseholdStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<HouseholdStackParamList, "HouseholdHome">;

function categoryLabel(key: string) {
  return SCRAP_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

const STATUS_LABEL: Record<string, string> = {
  open: "Waiting for a match",
  matched: "Notified collectors — waiting to be accepted",
  accepted: "Accepted — pickup arranged",
  completed: "Completed",
  cancelled: "Cancelled",
};

function statusColor(status: string) {
  if (status === "accepted" || status === "completed") return colors.success;
  if (status === "cancelled") return colors.danger;
  return colors.marigoldDark;
}

export function HouseholdHomeScreen({ navigation }: Props) {
  const { user, signOut } = useAuth();
  const [listings, setListings] = useState<MyListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const { listings: fetched } = await fetchMyListings();
      setListings(fetched);
    } catch {
      // keep last-known list on a transient error
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
      <Text style={styles.subtitle}>Got scrap to give away?</Text>

      <Button
        label="+ Post scrap"
        accentColor={colors.moss}
        onPress={() => navigation.navigate("PostListing")}
        style={{ marginBottom: spacing.lg }}
      />

      <FlatList
        data={listings}
        keyExtractor={(l) => l.id}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.moss} />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>No listings yet</Text>
              <Text style={styles.cardBody}>
                When you post scrap, nearby collectors who buy that category will be notified —
                and you'll see the current going rate before they arrive.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.listingCard}>
            <View style={styles.listingHeader}>
              <Text style={[styles.statusText, { color: statusColor(item.status) }]}>
                {STATUS_LABEL[item.status] ?? item.status}
              </Text>
            </View>
            <Text style={styles.listingItems}>
              {item.items
                .map((i) => `${categoryLabel(i.category)} (${i.estimated_weight_kg}kg)`)
                .join(", ")}
            </Text>
            {item.description ? <Text style={styles.listingDesc}>{item.description}</Text> : null}
            {item.status === "matched" && item.pending_collectors > 0 && (
              <Text style={styles.matchInfo}>
                {item.pending_collectors} collector{item.pending_collectors === 1 ? "" : "s"} notified,
                waiting for a response
              </Text>
            )}
          </View>
        )}
      />

      <Button label="Log out" variant="ghost" onPress={signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  greeting: { ...type.display, color: colors.ink },
  subtitle: { ...type.body, color: colors.inkMuted, marginTop: spacing.xs, marginBottom: spacing.md },
  card: {
    backgroundColor: colors.mossLight,
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
  listingHeader: { marginBottom: spacing.xs },
  statusText: { ...type.label },
  listingItems: { ...type.bodyBold, color: colors.ink, marginBottom: spacing.xs },
  listingDesc: { ...type.caption, color: colors.inkMuted, marginBottom: spacing.xs },
  matchInfo: { ...type.caption, color: colors.marigoldDark },
});
