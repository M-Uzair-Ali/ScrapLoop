import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { colors, spacing, type } from "../../theme/tokens";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AuthStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "Welcome">;

export function WelcomeScreen({ navigation }: Props) {
  return (
    <Screen scroll={false}>
      <View style={styles.hero}>
        <Text style={styles.wordmark}>ScrapLoop</Text>
        <Text style={styles.tagline}>
          Post your scrap. Get matched with a nearby collector. Know the going rate before they arrive.
        </Text>
      </View>

      <View style={styles.actions}>
        <Text style={styles.sectionLabel}>I have scrap to give away</Text>
        <Button
          label="Continue as Household"
          accentColor={colors.moss}
          onPress={() => navigation.navigate("Signup", { role: "household" })}
        />

        <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>I collect and buy scrap</Text>
        <Button
          label="Continue as Collector"
          accentColor={colors.steel}
          onPress={() => navigation.navigate("Signup", { role: "collector" })}
        />

        <Button
          label="I already have an account — Log in"
          variant="ghost"
          onPress={() => navigation.navigate("Login")}
          style={{ marginTop: spacing.xl }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, justifyContent: "center", alignItems: "flex-start" },
  wordmark: { ...type.display, fontSize: 40, color: colors.ink, marginBottom: spacing.sm },
  tagline: { ...type.body, color: colors.inkMuted, maxWidth: 280 },
  actions: { paddingBottom: spacing.lg },
  sectionLabel: { ...type.label, color: colors.inkMuted, marginBottom: spacing.sm },
});
