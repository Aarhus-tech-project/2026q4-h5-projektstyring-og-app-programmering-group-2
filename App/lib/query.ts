import { focusManager, onlineManager, QueryClient } from "@tanstack/react-query";
import * as Network from "expo-network";
import { AppState } from "react-native";
import { getConnectivity, recheckServer, setInternetReachable, subscribeConnectivity } from "./connectivity";
import { shouldRetry } from "./errors";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetry,
      staleTime: 30_000,
    },
    mutations: {
      retry: false,
      networkMode: "always",
    },
  },
});

function isOnline(state: Network.NetworkState) {
  return state.isConnected !== false && state.isInternetReachable !== false;
}

onlineManager.setEventListener((setOnline) => {
  const unsubscribe = subscribeConnectivity(() => setOnline(getConnectivity() === "online"));
  Network.getNetworkStateAsync()
    .then((state) => setInternetReachable(isOnline(state)))
    .catch(() => {});
  const subscription = Network.addNetworkStateListener((state) => setInternetReachable(isOnline(state)));
  return () => {
    unsubscribe();
    subscription.remove();
  };
});

focusManager.setEventListener((setFocused) => {
  const subscription = AppState.addEventListener("change", (state) => {
    setFocused(state === "active");
    if (state === "active") recheckServer();
  });
  return () => subscription.remove();
});
