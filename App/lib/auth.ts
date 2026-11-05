import * as SecureStore from "expo-secure-store";
import { useSyncExternalStore } from "react";

export type AuthStatus = "unknown" | "signedIn" | "signedOut";

let status: AuthStatus = "unknown";
let pendingRoute: string | null = null;
const listeners = new Set<() => void>();

function emit(next: AuthStatus) {
  if (next === status) return;
  status = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

SecureStore.getItemAsync("accesstoken")
  .then((token) => emit(token ? "signedIn" : "signedOut"))
  .catch(() => emit("signedOut"));

export function useAuthStatus() {
  return useSyncExternalStore(subscribe, () => status, () => status);
}

export async function saveSession(accessToken: string, refreshToken: string) {
  await SecureStore.setItemAsync("accesstoken", accessToken);
  await SecureStore.setItemAsync("refreshtoken", refreshToken);
  emit("signedIn");
}

export async function clearSession() {
  await SecureStore.deleteItemAsync("accesstoken");
  await SecureStore.deleteItemAsync("refreshtoken");
  emit("signedOut");
}

export function setPendingRoute(route: string | null) {
  pendingRoute = route;
}

export function takePendingRoute() {
  const route = pendingRoute;
  pendingRoute = null;
  return route;
}
