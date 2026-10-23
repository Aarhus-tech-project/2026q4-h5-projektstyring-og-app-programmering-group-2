import createClient from "openapi-fetch";
import * as SecureStore from "expo-secure-store";
import type { paths } from "./api-types";

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