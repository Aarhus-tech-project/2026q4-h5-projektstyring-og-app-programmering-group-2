import * as SecureStore from "expo-secure-store";
import { Appearance } from "react-native";

const key = "appearance";

export async function applySavedAppearance() {
  const saved = await SecureStore.getItemAsync(key);
  if (saved === "light" || saved === "dark") Appearance.setColorScheme(saved);
}

export async function setAppearance(choice: "light" | "dark") {
  Appearance.setColorScheme(choice);
  await SecureStore.setItemAsync(key, choice);
}
