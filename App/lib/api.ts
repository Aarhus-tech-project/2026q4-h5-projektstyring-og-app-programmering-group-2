import * as SecureStore from "expo-secure-store";
import createClient from "openapi-fetch";
import type { components, paths } from "./api-types";

export const api = createClient<paths>({
  baseUrl: process.env.EXPO_PUBLIC_API_URL,
});

let refreshing: Promise<string | null> | null = null;

api.use({
  async onRequest({ request }) {
    let accessToken = await SecureStore.getItemAsync("accesstoken");

    if (accessToken) {
      const exp = JSON.parse(atob(accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).exp;
      if (exp * 1000 < Date.now() + 30_000) {
        accessToken = await (refreshing ??= refresh().finally(() => (refreshing = null)));
      }
    }

    if (accessToken) request.headers.set("Authorization", `Bearer ${accessToken}`);
    return request;
  },
});

async function refresh() {
  const refreshToken = await SecureStore.getItemAsync("refreshtoken");
  if (!refreshToken) return null;

  const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}api/login/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(refreshToken),
  });
  if (!res.ok) return null;

  const data = await res.json();
  await SecureStore.setItemAsync("accesstoken", data.accessToken);
  await SecureStore.setItemAsync("refreshtoken", data.refreshToken);
  return data.accessToken;
}

// ------------------------------------------------------------
// Ranking Fetch - Top - Worst

export type RankingOrder = "top" | "worst";
export type RankedPost = components["schemas"]["PublicPostDTO"];

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
  const token = await SecureStore.getItemAsync("accesstoken")
  return token !== null;
}
// ------------------------------------------------------------

export type Matchup = components["schemas"]["MatchupDTO"];

export async function getMatchup() {
  const { data, error } = await api.GET("/api/Posts/matchup");
  if (error) throw error;
  if (!data) throw new Error("Matchup request returned no data");
  return data;
}

export async function submitVote(matchupId: string, winnerPostId: string, looserPostId: string) {
  const { error, response } = await api.POST("/api/Posts/vote", {
    body: { matchupId, winnerPostId, looserPostId },
  });
  if (!response.ok) throw error ?? new Error(`Vote failed (${response.status})`);
}
//-------------------------------------------------------------
// Get Own Profile Data

export type Profile = components["schemas"]["ProfileDTO"]

export async function getMyProfile() {
  const {data, error} = await api.GET("/api/Posts/me");
  if (error) throw error;
  return data;
}
//-------------------------------------------------------------
