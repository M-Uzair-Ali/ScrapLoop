import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { colors, radius, spacing, type } from "../../theme/tokens";
import { HouseholdStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<HouseholdStackParamList, "PostListingSuccess">;

export function PostListingSuccessScreen({ navigation, route }: Props) {
  const { matchedCollectors, candidatesConsidered } = route.params;

  return (
    <Screen scroll={false}>
      <View style={styles.center}>
        <Text style={styles.emoji}>✓</Text>
        <Text style={styles.title}>Listing posted</Text>

        {matchedCollectors > 0 ? (
          <Text style={styles.body}>
            Notified <Text style={styles.bold}>{matchedCollectors}</Text> nearby collector
            {matchedCollectors === 1 ? "" : "s"} who buy{matchedCollectors === 1 ? "s" : ""} what you
            posted. You'll be matched with whoever accepts first.
          </Text>
        ) : (
          <Text style={styles.body}>
            No collectors currently match this listing nearby
            {candidatesConsidered > 0 ? ` (checked ${candidatesConsidered} in range)` : ""}. It'll
            stay open — you can check back or post again later.
          </Text>
        )}
      </View>

      <Button
        label="Back to home"
        accentColor={colors.moss}
        onPress={() => navigation.popToTop()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: spacing.xl },
  emoji: {
    fontSize: 40,
    color: colors.moss,
    marginBottom: spacing.md,
    width: 64,
    height: 64,
    textAlign: "center",
    lineHeight: 64,
    backgroundColor: colors.mossLight,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  title: { ...type.display, color: colors.ink, marginBottom: spacing.sm },
  body: { ...type.body, color: colors.inkMuted, textAlign: "center", maxWidth: 300 },
  bold: { ...type.bodyBold, color: colors.ink },
});
