import { io, type Socket } from "socket.io-client";
import { useAuthStore } from "@/store/auth";
import { socketUrl } from "@/lib/config";

let socket: Socket | undefined;

export function getSocket() {
  if (!socket) {
    socket = io(socketUrl, {
      autoConnect: false,
      transports: ["websocket"],
    });
  }
  socket.auth = { token: useAuthStore.getState().token };
  return socket;
}

export function reconnectSocket() {
  const token = useAuthStore.getState().token;
  if (socket) {
    socket.auth = { token };
    socket.disconnect().connect();
  }
}

export function disconnectSocket() {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket.auth = {};
}
