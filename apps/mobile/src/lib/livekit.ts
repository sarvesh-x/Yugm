import { Room } from "livekit-client";
import { mediaApi } from "@/lib/api";
import { livekitUrl } from "@/lib/config";

export interface MediaSession {
  token: string;
  url: string;
  identity: string;
  roomName: string;
  role: string;
  room: Room;
  setMicrophoneEnabled: (enabled: boolean) => Promise<void>;
  setCameraEnabled: (enabled: boolean) => Promise<void>;
  flipCamera: () => void;
  disconnect: () => void;
}

export async function createLiveKitSession(roomId: string): Promise<MediaSession> {
  const session = await mediaApi.token(roomId);
  const url = session.url?.includes("localhost") ? livekitUrl : session.url;
  const room = new Room();
  await room.connect(url, session.token);
  return {
    ...session,
    url,
    room,
    setMicrophoneEnabled: async (enabled: boolean) => {
      await room.localParticipant.setMicrophoneEnabled(enabled);
    },
    setCameraEnabled: async (enabled: boolean) => {
      await room.localParticipant.setCameraEnabled(enabled);
    },
    flipCamera: () => {
      for (const publication of room.localParticipant.videoTrackPublications.values()) {
        const mediaTrack = (publication.track as any)?.mediaStreamTrack;
        if (typeof mediaTrack?._switchCamera === "function") mediaTrack._switchCamera();
      }
    },
    disconnect: () => room.disconnect()
  };
}
