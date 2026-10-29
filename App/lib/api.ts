import createClient from "openapi-fetch";
import * as SecureStore from "expo-secure-store";
import type { components, paths } from "./api-types";

export const api = createClient<paths>({
  baseUrl: process.env.EXPO_PUBLIC_API_URL,
});

api.use({
  async onRequest({ request }) {
    const token = await SecureStore.getItemAsync("accessToken");
    if (token) request.headers.set("Authorization", `Bearer ${token}`);
    return request;
  },
});

// ------------------------------------------------------------
// Ranking Fetch - Top - Worst

export type RankingOrder = "top" | "worst";
export type RankedPost = components["schemas"]["RankedPost"];

export async function getRanking(order: RankingOrder) {
  const { data, error } = await api.GET("/api/Posts/ranking", {
    params: { query: { order } },
  });

  if (error) throw error;
  return data ?? [];
}

// ------------------------------------------------------------

// ------------------------------------------------------------
// Is Logged in

export async function isLoggedIn() {
  const token = await SecureStore.getItemAsync("accessToken")
  return token !== null;
}
// ------------------------------------------------------------