import React, { useEffect, useState } from "react";
import { Dimensions, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { fetchListing, ListingDetail } from "../../api/listings";
import { acceptMatch, declineMatch } from "../../api/matches";
import { ApiError } from "../../api/client";
import { colors, radius, spacing, type } from "../../theme/tokens";
import { SCRAP_CATEGORIES } from "../../types";
import { CollectorStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<CollectorStackParamList, "ListingDetail">;

function categoryLabel(key: string) {
  return SCRAP_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

export function ListingDetailScreen({ route, navigation }: Props) {
  const { listingId, matchId, isOwnAccepted } = route.params;
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<"accept" | "decline" | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  useEffect(() => {
    fetchListing(listingId)
      .then(({ listing: fetched }) => setListing(fetched))
      .catch(() => setActionError("Couldn't load this listing."))
      .finally(() => setLoading(false));
  }, [listingId]);

  const handleAccept = async () => {
    setActionError(null);
    setActionLoading("accept");
    try {
      await acceptMatch(matchId);
      navigation.goBack();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Couldn't accept this match. Check your connection."
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async () => {
    setActionError(null);
    setActionLoading("decline");
    try {
      await declineMatch(matchId);
      navigation.goBack();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Couldn't decline this match. Check your connection."
      );
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <Screen scroll={false}>
        <Text style={type.body}>Loading…</Text>
      </Screen>
    );
  }

  if (!listing) {
    return (
      <Screen scroll={false}>
        <Text style={styles.error}>{actionError ?? "Listing not found."}</Text>
      </Screen>
    );
  }

  const totalWeight = listing.items.reduce((sum, i) => sum + i.estimated_weight_kg, 0);

  return (
    <Screen>
      <Text style={styles.title}>{listing.household.name}</Text>
      <Text style={styles.subtitle}>
        ⭐ {listing.household.rating_avg.toFixed(1)} · {totalWeight}kg total
      </Text>

      {listing.photo_urls.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
          {listing.photo_urls.map((uri, idx) => (
            <Pressable key={idx} onPress={() => setViewerIndex(idx)}>
              <Image source={{ uri }} style={styles.photo} />
            </Pressable>
          ))}
        </ScrollView>
      )}

      <View style={styles.itemsCard}>
        {listing.items.map((item, idx) => (
          <View key={idx} style={styles.itemRow}>
            <Text style={styles.itemCategory}>{categoryLabel(item.category)}</Text>
            <Text style={styles.itemWeight}>{item.estimated_weight_kg} kg</Text>
          </View>
        ))}
      </View>

      {listing.description ? (
        <View style={styles.noteCard}>
          <Text style={styles.noteLabel}>Note from household</Text>
          <Text style={styles.noteBody}>{listing.description}</Text>
        </View>
      ) : null}

      {actionError ? <Text style={styles.error}>{actionError}</Text> : null}

      {listing.status === "accepted" ? (
        <Text style={styles.statusText}>
          {isOwnAccepted
            ? "You accepted this pickup. Head over whenever suits the pickup window."
            : "This listing has already been accepted."}
        </Text>
      ) : (
        <View style={styles.actions}>
          <Button
            label="Accept pickup"
            accentColor={colors.steel}
            onPress={handleAccept}
            loading={actionLoading === "accept"}
            disabled={actionLoading !== null}
          />
          <Button
            label="Not interested"
            variant="ghost"
            onPress={handleDecline}
            loading={actionLoading === "decline"}
            disabled={actionLoading !== null}
            style={{ marginTop: spacing.sm }}
          />
        </View>
      )}

      <Modal
        visible={viewerIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerIndex(null)}
      >
        <Pressable style={styles.viewerBackdrop} onPress={() => setViewerIndex(null)}>
          {viewerIndex !== null && (
            <Image
              source={{ uri: listing.photo_urls[viewerIndex] }}
              style={styles.viewerImage}
              resizeMode="contain"
            />
          )}
          <Pressable style={styles.viewerClose} onPress={() => setViewerIndex(null)}>
            <Text style={styles.viewerCloseText}>×</Text>
          </Pressable>

          {listing.photo_urls.length > 1 && viewerIndex !== null && (
            <>
              {viewerIndex > 0 && (
                <Pressable
                  style={[styles.viewerNav, styles.viewerNavLeft]}
                  onPress={(e) => {
                    e.stopPropagation();
                    setViewerIndex(viewerIndex - 1);
                  }}
                >
                  <Text style={styles.viewerNavText}>‹</Text>
                </Pressable>
              )}
              {viewerIndex < listing.photo_urls.length - 1 && (
                <Pressable
                  style={[styles.viewerNav, styles.viewerNavRight]}
                  onPress={(e) => {
                    e.stopPropagation();
                    setViewerIndex(viewerIndex + 1);
                  }}
                >
                  <Text style={styles.viewerNavText}>›</Text>
                </Pressable>
              )}
            </>
          )}
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...type.title, color: colors.ink },
  subtitle: { ...type.body, color: colors.inkMuted, marginBottom: spacing.md },
  photoScroll: { height: 120, marginBottom: spacing.lg },
  photo: {
    width: 120,
    height: 120,
    borderRadius: radius.md,
    marginRight: spacing.sm,
    backgroundColor: colors.kraft,
  },
  itemsCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemCategory: { ...type.body, color: colors.ink },
  itemWeight: { ...type.bodyBold, color: colors.ink },
  noteCard: {
    backgroundColor: colors.steelLight,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  noteLabel: { ...type.label, color: colors.steel, marginBottom: spacing.xs },
  noteBody: { ...type.body, color: colors.ink },
  actions: { marginTop: spacing.md },
  statusText: { ...type.body, color: colors.inkMuted, marginTop: spacing.md },
  error: { color: colors.danger, marginBottom: spacing.md, ...type.caption },
  viewerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(20, 18, 14, 0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  viewerImage: {
    width: Dimensions.get("window").width,
    height: "80%",
  },
  viewerClose: {
    position: "absolute",
    top: spacing.xl,
    right: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  viewerCloseText: { color: colors.white, fontSize: 24, lineHeight: 26 },
  viewerNav: {
    position: "absolute",
    top: "50%",
    marginTop: -24,
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  viewerNavLeft: { left: spacing.md },
  viewerNavRight: { right: spacing.md },
  viewerNavText: { color: colors.white, fontSize: 28, lineHeight: 30 },
});
