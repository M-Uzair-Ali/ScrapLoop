import React from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { useAuth } from "../context/AuthContext";
import { colors } from "../theme/tokens";

import { WelcomeScreen } from "../screens/auth/WelcomeScreen";
import { LoginScreen } from "../screens/auth/LoginScreen";
import { SignupScreen } from "../screens/auth/SignupScreen";
import { HouseholdHomeScreen } from "../screens/household/HomeScreen";
import { PostListingScreen } from "../screens/household/PostListingScreen";
import { PostListingSuccessScreen } from "../screens/household/PostListingSuccessScreen";
import { CollectorHomeScreen } from "../screens/collector/HomeScreen";
import { ListingDetailScreen } from "../screens/collector/ListingDetailScreen";

import { AuthStackParamList, HouseholdStackParamList, CollectorStackParamList } from "./types";

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const HouseholdStack = createNativeStackNavigator<HouseholdStackParamList>();
const CollectorStack = createNativeStackNavigator<CollectorStackParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Welcome" component={WelcomeScreen} />
      <AuthStack.Screen name="Login" component={LoginScreen} options={{ headerShown: true, title: "Log in" }} />
      <AuthStack.Screen name="Signup" component={SignupScreen} options={{ headerShown: true, title: "Sign up" }} />
    </AuthStack.Navigator>
  );
}

function HouseholdNavigator() {
  return (
    <HouseholdStack.Navigator screenOptions={{ headerShown: false }}>
      <HouseholdStack.Screen name="HouseholdHome" component={HouseholdHomeScreen} />
      <HouseholdStack.Screen
        name="PostListing"
        component={PostListingScreen}
        options={{ headerShown: true, title: "Post scrap" }}
      />
      <HouseholdStack.Screen
        name="PostListingSuccess"
        component={PostListingSuccessScreen}
        options={{ headerShown: false, gestureEnabled: false }}
      />
    </HouseholdStack.Navigator>
  );
}

function CollectorNavigator() {
  return (
    <CollectorStack.Navigator screenOptions={{ headerShown: false }}>
      <CollectorStack.Screen name="CollectorHome" component={CollectorHomeScreen} />
      <CollectorStack.Screen
        name="ListingDetail"
        component={ListingDetailScreen}
        options={{ headerShown: true, title: "Listing" }}
      />
    </CollectorStack.Navigator>
  );
}

export function RootNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas }}>
        <ActivityIndicator size="large" color={colors.marigold} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!user ? (
        <AuthNavigator />
      ) : user.role === "household" ? (
        <HouseholdNavigator />
      ) : (
        <CollectorNavigator />
      )}
    </NavigationContainer>
  );
}
