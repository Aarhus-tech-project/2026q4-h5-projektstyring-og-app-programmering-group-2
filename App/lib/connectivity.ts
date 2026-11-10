import { useSyncExternalStore } from "react";

export type Connectivity = "online" | "noInternet" | "serverDown";

const baseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, "") ?? "";
const REQUEST_TIMEOUT_MS = 15_000;
const UPLOAD_TIMEOUT_MS = 120_000;
const PROBE_INTERVAL_MS = 5_000;
const UPLOAD_PATH = /\/api\/Posts(\/profile\/avatar)?(\?|$)/i;

let internetReachable = true;
let serverReachable = true;
let snapshot: Connectivity = "online";
let probeTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function emit() {
  const next: Connectivity = !internetReachable ? "noInternet" : !serverReachable ? "serverDown" : "online";
  if (next === snapshot) return;
  snapshot = next;
  listeners.forEach((listener) => listener());
}

export function subscribeConnectivity(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getConnectivity() {
  return snapshot;
}

export function useConnectivity() {
  return useSyncExternalStore(subscribeConnectivity, getConnectivity, () => "online" as const);
}

export function setInternetReachable(reachable: boolean) {
  internetReachable = reachable;
  if (reachable && !serverReachable) scheduleProbe(0);
  emit();
}

export function recheckServer() {
  if (!serverReachable) scheduleProbe(0);
}

function setServerReachable(reachable: boolean) {
  if (!reachable && !internetReachable) return;
  serverReachable = reachable;
  if (reachable) {
    if (probeTimer) clearTimeout(probeTimer);
    probeTimer = null;
  } else {
    scheduleProbe(PROBE_INTERVAL_MS);
  }
  emit();
}

function scheduleProbe(delay: number) {
  if (probeTimer) clearTimeout(probeTimer);
  probeTimer = setTimeout(probe, delay);
}

function probe() {
  probeTimer = null;
  if (serverReachable || !internetReachable || !baseUrl) return;
  apiFetch(`${baseUrl}/`).catch(() => {});
}

function isGatewayError(response: Response) {
  const gateway = [502, 503, 504].includes(response.status) || (response.status >= 520 && response.status <= 530);
  return gateway && !response.headers.get("content-type")?.includes("json");
}

export async function apiFetch(input: Request | string, init?: RequestInit): Promise<Response> {
  const request = new Request(input, init);
  const controller = new AbortController();
  const isUpload = request.method !== "GET" && UPLOAD_PATH.test(request.url);
  const timeout = setTimeout(() => controller.abort(), isUpload ? UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(request, { signal: controller.signal });
    setServerReachable(!isGatewayError(response));
    return response;
  } catch {
    setServerReachable(false);
    throw new TypeError(controller.signal.aborted ? "Network request timed out" : "Network request failed");
  } finally {
    clearTimeout(timeout);
  }
}
