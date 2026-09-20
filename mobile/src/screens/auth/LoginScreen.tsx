import React, { useState } from "react";
import { Text, StyleSheet } from "react-native";
import { Screen } from "../../components/Screen";
import { TextField } from "../../components/TextField";
import { Button } from "../../components/Button";
import { login } from "../../api/auth";
import { useAuth } from "../../context/AuthContext";
import { ApiError } from "../../api/client";
import { colors, spacing, type } from "../../theme/tokens";

export function LoginScreen() {
  const { signIn } = useAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      const { token, user } = await login(phone, password);
      await signIn(token, user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't log in. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Text style={styles.title}>Welcome back</Text>
      <TextField
        label="Phone number"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
        placeholder="03xx-xxxxxxx"
      />
      <TextField
        label="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        placeholder="••••••••"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label="Log in" onPress={handleSubmit} loading={loading} style={{ marginTop: spacing.sm }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...type.title, color: colors.ink, marginBottom: spacing.lg },
  error: { color: colors.danger, marginBottom: spacing.md, ...type.caption },
});
