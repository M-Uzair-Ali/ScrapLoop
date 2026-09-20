import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { colors, radius, spacing, type } from "../theme/tokens";

interface Props {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost";
  accentColor?: string; // overrides primary color, used for role-tinted CTAs
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  accentColor,
  disabled,
  loading,
  style,
}: Props) {
  const bg =
    variant === "primary" ? accentColor ?? colors.marigold : variant === "secondary" ? colors.white : "transparent";
  const border = variant === "secondary" ? colors.border : "transparent";
  const textColor = variant === "ghost" ? colors.ink : variant === "secondary" ? colors.ink : colors.white;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bg, borderColor: border, borderWidth: variant === "secondary" ? 1 : 0 },
        pressed && !disabled && { opacity: 0.85 },
        disabled && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.label, { color: textColor }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    ...type.bodyBold,
  },
});
