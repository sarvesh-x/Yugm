import Constants from "expo-constants";
import { Platform } from "react-native";

function devServerHost() {
  const hostUri = (Constants.expoConfig as any)?.hostUri ?? (Constants as any).manifest?.debuggerHost;
  if (!hostUri || typeof hostUri !== "string") return undefined;
  return hostUri.split(":")[0];
}

function resolveLocalUrl(rawUrl: string, port: string, protocol: "http" | "ws") {
  if (!rawUrl.includes("localhost") && !rawUrl.includes("127.0.0.1")) return rawUrl;
  if (Platform.OS === "web") return rawUrl;

  const host = devServerHost() ?? (Platform.OS === "android" ? "10.0.2.2" : "localhost");
  return `${protocol}://${host}:${port}`;
}

// NOTE: For production builds, replace "http" with "https" and "ws" with "wss" below.
const rawApi = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";
function addApi(url: string) {
  return url.endsWith("/api") ? url : `${url}/api`;
}
export const apiBaseUrl = addApi(resolveLocalUrl(rawApi, "4000", "http"));

export const socketUrl = resolveLocalUrl(process.env.EXPO_PUBLIC_SOCKET_URL ?? "http://localhost:4000", "4000", "http");
export const livekitUrl = resolveLocalUrl(process.env.EXPO_PUBLIC_LIVEKIT_URL ?? "ws://localhost:7880", "7880", "ws");
