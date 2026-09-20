import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Location from "expo-location";
import { Screen } from "../../components/Screen";
import { TextField } from "../../components/TextField";
import { Button } from "../../components/Button";
import { signup } from "../../api/auth";
import { useAuth } from "../../context/AuthContext";
import { ApiError } from "../../api/client";
import { colors, radius, roleAccent, spacing, type } from "../../theme/tokens";
import { Coords, SCRAP_CATEGORIES, ScrapCategory } from "../../types";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AuthStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "Signup">;

export function SignupScreen({ route }: Props) {
  const { role } = route.params;
  const accent = roleAccent(role);
  const { signIn } = useAuth();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [categories, setCategories] = useState<ScrapCategory[]>([]);
  const [radiusKm, setRadiusKm] = useState("3");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const requestLocation = async () => {
    setLocationError(null);
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setLocationError("Location permission is needed to match you with nearby listings.");
      return;
    }
    const pos = await Location.getCurrentPositionAsync({});
    setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
  };

  const toggleCategory = (key: ScrapCategory) => {
    setCategories((prev) => (prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]));
  };

  const handleSubmit = async () => {
    setError(null);
    if (!coords) {
      setError("Please share your location first.");
      return;
    }
    if (role === "collector" && categories.length === 0) {
      setError("Pick at least one category you buy.");
      return;
    }

    setLoading(true);
    try {
      const { token, user } = await signup({
        name,
        phone_number: phone,
        password,
        role,
        location: coords,
        collector_profile:
          role === "collector"
            ? {
                categories_bought: categories,
                service_radius_km: Number(radiusKm) || 3,
                capacity_kg_per_day: 100,
              }
            : undefined,
      });
      await signIn(token, user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't sign up. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Text style={styles.title}>
        {role === "household" ? "Set up your household account" : "Set up your collector account"}
      </Text>

      <TextField label="Name" value={name} onChangeText={setName} placeholder="Your name" />
      <TextField
        label="Phone number"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
        placeholder="03xx-xxxxxxx"
      />
      <TextField label="Password" secureTextEntry value={password} onChangeText={setPassword} />

      <Text style={styles.label}>Location</Text>
      <Button
        label={coords ? "Location captured ✓" : "Share current location"}
        variant="secondary"
        onPress={requestLocation}
        style={{ marginBottom: spacing.md }}
      />
      {locationError ? <Text style={styles.error}>{locationError}</Text> : null}

      {role === "collector" && (
        <>
          <Text style={styles.label}>What do you buy?</Text>
          <View style={styles.chipRow}>
            {SCRAP_CATEGORIES.map((c) => {
              const selected = categories.includes(c.key);
              return (
                <Pressable
                  key={c.key}
                  onPress={() => toggleCategory(c.key)}
                  style={[
                    styles.chip,
                    selected && { backgroundColor: accent, borderColor: accent },
                  ]}
                >
                  <Text style={[styles.chipText, selected && { color: colors.white }]}>{c.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <TextField
            label="Service radius (km)"
            keyboardType="numeric"
            value={radiusKm}
            onChangeText={setRadiusKm}
          />
        </>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        label="Create account"
        accentColor={accent}
        onPress={handleSubmit}
        loading={loading}
        style={{ marginTop: spacing.sm }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...type.title, color: colors.ink, marginBottom: spacing.lg },
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
});
