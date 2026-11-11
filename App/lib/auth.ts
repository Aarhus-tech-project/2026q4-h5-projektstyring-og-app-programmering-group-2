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

function randomUuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

let deviceId: Promise<string> | null = null;

export function getDeviceId() {
  return (deviceId ??= SecureStore.getItemAsync("deviceid").then(async (existing) => {
    if (existing) return existing;
    const created = randomUuid();
    await SecureStore.setItemAsync("deviceid", created);
    return created;
  }).catch((error) => {
    deviceId = null;
    throw error;
  }));
}

export function setPendingRoute(route: string | null) {
  pendingRoute = route;
}

export function peekPendingRoute() {
  return pendingRoute;
}

export function takePendingRoute() {
  const route = pendingRoute;
  pendingRoute = null;
  return route;
}
