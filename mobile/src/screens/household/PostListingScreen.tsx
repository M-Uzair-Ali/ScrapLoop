import React, { useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { TextField } from "../../components/TextField";
import { createListing, ListingItemInput } from "../../api/listings";
import { ApiError } from "../../api/client";
import { colors, radius, spacing, type } from "../../theme/tokens";
import { Coords, SCRAP_CATEGORIES, ScrapCategory } from "../../types";
import { HouseholdStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<HouseholdStackParamList, "PostListing">;

interface DraftItem extends ListingItemInput {
  key: string;
}

export function PostListingScreen({ navigation }: Props) {
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [pendingCategory, setPendingCategory] = useState<ScrapCategory | null>(null);
  const [pendingWeight, setPendingWeight] = useState("");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const MAX_PHOTOS = 4;

  const requestLocation = async () => {
    setLocationError(null);
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setLocationError("Location permission is needed so nearby collectors can be matched.");
      return;
    }
    const pos = await Location.getCurrentPositionAsync({});
    setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
  };

  const pickPhotos = async () => {
    setPhotoError(null);
    if (photos.length >= MAX_PHOTOS) {
      setPhotoError(`You can add up to ${MAX_PHOTOS} photos.`);
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      setPhotoError("Photo library permission is needed to add pictures.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - photos.length,
      quality: 0.5, // keep payload small — see note in createListing on transport
      base64: true,
    });
    if (result.canceled) return;

    const newUris = result.assets
      .filter((a) => !!a.base64)
      .map((a) => `data:image/jpeg;base64,${a.base64}`);
    setPhotos((prev) => [...prev, ...newUris].slice(0, MAX_PHOTOS));
  };

  const takePhoto = async () => {
    setPhotoError(null);
    if (photos.length >= MAX_PHOTOS) {
      setPhotoError(`You can add up to ${MAX_PHOTOS} photos.`);
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      setPhotoError("Camera permission is needed to take a photo.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.5, base64: true });
    if (result.canceled || !result.assets[0]?.base64) return;
    setPhotos((prev) => [...prev, `data:image/jpeg;base64,${result.assets[0].base64}`].slice(0, MAX_PHOTOS));
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const addItem = () => {
    const weight = Number(pendingWeight);
    if (!pendingCategory) {
      setError("Pick a category for this item.");
      return;
    }
    if (!weight || weight <= 0) {
      setError("Enter a rough weight in kg for this item.");
      return;
    }
    setError(null);
    setItems((prev) => [
      ...prev,
      { key: `${pendingCategory}-${Date.now()}`, category: pendingCategory, estimated_weight_kg: weight },
    ]);
    setPendingCategory(null);
    setPendingWeight("");
  };

  const removeItem = (key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
  };

  const handleSubmit = async () => {
    setError(null);
    if (items.length === 0) {
      setError("Add at least one item before posting.");
      return;
    }
    if (!coords) {
      setError("Please share your location first.");
      return;
    }

    setLoading(true);
    try {
      const result = await createListing({
        description: description || undefined,
        location: coords,
        photo_urls: photos,
        items: items.map(({ category, estimated_weight_kg, notes }) => ({
          category,
          estimated_weight_kg,
          notes,
        })),
      });
      navigation.replace("PostListingSuccess", {
        matchedCollectors: result.matched_collectors,
        candidatesConsidered: result.candidates_considered,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't post listing. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Text style={styles.title}>What have you got?</Text>

      <View style={styles.chipRow}>
        {SCRAP_CATEGORIES.map((c) => {
          const selected = pendingCategory === c.key;
          return (
            <Pressable
              key={c.key}
              onPress={() => setPendingCategory(c.key)}
              style={[styles.chip, selected && { backgroundColor: colors.moss, borderColor: colors.moss }]}
            >
              <Text style={[styles.chipText, selected && { color: colors.white }]}>{c.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.addRow}>
        <TextInput
          style={styles.weightInput}
          placeholder="Weight (kg)"
          placeholderTextColor={colors.inkMuted}
          keyboardType="numeric"
          value={pendingWeight}
          onChangeText={setPendingWeight}
        />
        <Button label="+ Add item" variant="secondary" onPress={addItem} style={styles.addButton} />
      </View>

      {items.length > 0 && (
        <View style={styles.itemsList}>
          {items.map((item) => {
            const label = SCRAP_CATEGORIES.find((c) => c.key === item.category)?.label ?? item.category;
            return (
              <View key={item.key} style={styles.itemRow}>
                <Text style={styles.itemText}>
                  {label} — {item.estimated_weight_kg} kg
                </Text>
                <Pressable onPress={() => removeItem(item.key)}>
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      )}

      <Text style={styles.label}>Photos (optional, up to {MAX_PHOTOS})</Text>
      <View style={styles.photoRow}>
        {photos.map((uri, idx) => (
          <View key={idx} style={styles.photoThumbWrap}>
            <Image source={{ uri }} style={styles.photoThumb} />
            <Pressable style={styles.photoRemove} onPress={() => removePhoto(idx)}>
              <Text style={styles.photoRemoveText}>×</Text>
            </Pressable>
          </View>
        ))}
        {photos.length < MAX_PHOTOS && (
          <View style={styles.photoAddButtons}>
            <Pressable style={styles.photoAddTile} onPress={pickPhotos}>
              <Text style={styles.photoAddText}>+ Library</Text>
            </Pressable>
            <Pressable style={styles.photoAddTile} onPress={takePhoto}>
              <Text style={styles.photoAddText}>📷 Camera</Text>
            </Pressable>
          </View>
        )}
      </View>
      {photoError ? <Text style={styles.error}>{photoError}</Text> : null}

      <TextField
        label="Anything collectors should know? (optional)"
        value={description}
        onChangeText={setDescription}
        placeholder="e.g. pickup anytime after 5pm, second floor"
        multiline
      />

      <Text style={styles.label}>Pickup location</Text>
      <Button
        label={coords ? "Location captured ✓" : "Share current location"}
        variant="secondary"
        onPress={requestLocation}
        style={{ marginBottom: spacing.md }}
      />
      {locationError ? <Text style={styles.error}>{locationError}</Text> : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        label="Post scrap"
        accentColor={colors.moss}
        onPress={handleSubmit}
        loading={loading}
        style={{ marginTop: spacing.sm }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...type.title, color: colors.ink, marginBottom: spacing.md },
  label: { ...type.label, color: colors.inkMuted, marginBottom: spacing.sm, marginTop: spacing.xs },
  error: { color: colors.danger, marginBottom: spacing.md, ...type.caption },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
  },
  chipText: { ...type.label, color: colors.ink },
  addRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md, alignItems: "stretch" },
  weightInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
    color: colors.ink,
  },
  addButton: { flexShrink: 0 },
  itemsList: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemText: { ...type.body, color: colors.ink },
  removeText: { ...type.caption, color: colors.danger },
  photoRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.sm },
  photoThumbWrap: { position: "relative" },
  photoThumb: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    backgroundColor: colors.kraft,
  },
  photoRemove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  photoRemoveText: { color: colors.white, fontSize: 14, lineHeight: 16, fontWeight: "700" },
  photoAddButtons: { flexDirection: "row", gap: spacing.sm },
  photoAddTile: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  photoAddText: { ...type.caption, color: colors.inkMuted, textAlign: "center" },
});
