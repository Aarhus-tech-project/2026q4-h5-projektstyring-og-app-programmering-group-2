import { File } from "expo-file-system";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import createClient from "openapi-fetch";
import type { components, paths } from "./api-types";
import { clearSession, saveSession } from "./auth";
import { ApiError } from "./errors";

export const api = createClient<paths>({
  baseUrl: process.env.EXPO_PUBLIC_API_URL,
});

let refreshing: Promise<string | null> | null = null;

function tokenExpiresSoon(token: string) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.exp * 1000 < Date.now() + 30_000;
  } catch {
    return true;
  }
}

api.use({
  async onRequest({ request }) {
    let accessToken = await SecureStore.getItemAsync("accesstoken");
    if (accessToken && tokenExpiresSoon(accessToken)) {
      accessToken = await (refreshing ??= refresh().finally(() => (refreshing = null)));
    }
    if (accessToken) request.headers.set("Authorization", `Bearer ${accessToken}`);
    return request;
  },
  async onResponse({ request, response }) {
    if (response.status === 401 && request.headers.has("Authorization")) {
      await clearSession();
    }
  },
});

async function refresh() {
  const refreshToken = await SecureStore.getItemAsync("refreshtoken");
  if (!refreshToken) return null;

  const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, "")}/api/login/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(refreshToken),
  });
  if (res.status === 401) {
    await clearSession();
    return null;
  }
  if (!res.ok) return null;

  const data = await res.json();
  await saveSession(data.accessToken, data.refreshToken);
  return data.accessToken as string;
}

function fail(response: Response, error: unknown): never {
  throw new ApiError(response.status, error);
}

function fileForm(body: { File?: string }) {
  const form = new FormData();
  if (body.File) form.append("File", new File(body.File));
  return form;
}

// ------------------------------------------------------------
// Login - Register - Logout

export async function login(email: string, password: string, deviceName: string) {
  const { data, error, response } = await api.POST("/api/Login/login", {
    body: { email, password, deviceName, platform: Platform.OS },
  });
  if (!response.ok || !data) fail(response, error);
  await saveSession(data.accessToken, data.refreshToken);
}

export async function register(email: string, username: string, password: string) {
  const { error, response } = await api.POST("/api/Login/register", {
    body: { email, username, password },
  });
  if (!response.ok) fail(response, error);
}

export async function signOut() {
  try {
    await api.POST("/api/Login/logout");
  } finally {
    await clearSession();
  }
}

// ------------------------------------------------------------
// Ranking Fetch - Top - Worst

export type RankingPeriod = components["schemas"]["RankingPeriod"];
export type RankingOrder = components["schemas"]["RankingOrder"];
export type Post = components["schemas"]["PublicPostDTO"];
export type RankedPost = components["schemas"]["RankedPostDTO"];

export async function getRanking(period: RankingPeriod, order: RankingOrder) {
  const { data, error, response } = await api.GET("/api/Posts/ranking", {
    params: { query: { period, order } },
  });
  if (!response.ok) fail(response, error);
  return data ?? [];
}

// ------------------------------------------------------------
// Voting

export type Matchup = components["schemas"]["MatchupDTO"];

export async function getMatchup() {
  const { data, error, response } = await api.GET("/api/Posts/matchup");
  if (!response.ok || !data) fail(response, error);
  return data;
}

export async function submitVote(matchupId: string, winnerPostId: string, looserPostId: string) {
  const { error, response } = await api.POST("/api/Posts/vote", {
    body: { matchupId, winnerPostId, looserPostId },
  });
  if (!response.ok) fail(response, error);
}

//-------------------------------------------------------------
// Upload Post

export async function uploadPost(uri: string) {
  const { error, response } = await api.POST("/api/Posts", {
    body: { File: uri },
    bodySerializer: fileForm,
  });
  if (!response.ok) fail(response, error);
}

//-------------------------------------------------------------
// Get Own Profile Data

export type Profile = components["schemas"]["Profile"];

export async function getMyProfile() {
  const { data, error, response } = await api.GET("/api/Posts/profile");
  if (!response.ok || !data) fail(response, error);
  return data;
}

//-------------------------------------------------------------
// Upload Avatar

export async function uploadAvatar(uri: string) {
  const { error, response } = await api.PUT("/api/Posts/profile/avatar", {
    body: { File: uri },
    bodySerializer: fileForm,
  });
  if (!response.ok) fail(response, error);
}

//-------------------------------------------------------------
// Update Description

export async function updateDescription(description: string) {
  const { error, response } = await api.PUT("/api/Posts/profile/description", {
    body: { description },
  });
  if (!response.ok) fail(response, error);
}

//-------------------------------------------------------------
// Favorites

export async function getFavorites() {
  const { data, error, response } = await api.GET("/api/Posts/favorites");
  if (!response.ok) fail(response, error);
  return data ?? [];
}

export async function addFavorite(postId: string) {
  const { error, response } = await api.POST("/api/Posts/favorite", {
    params: { query: { postId } },
  });
  if (!response.ok) fail(response, error);
}

export async function removeFavorite(postId: string) {
  const { error, response } = await api.DELETE("/api/Posts/favorite", {
    params: { query: { postId } },
  });
  if (!response.ok) fail(response, error);
}
