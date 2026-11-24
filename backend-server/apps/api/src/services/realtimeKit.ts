import { z } from "zod";
import { ErrorCode, HttpError } from "../utils/http.js";

interface RealtimeKitConfig {
  accountId: string;
  appId: string;
  apiToken: string;
}

interface ParticipantAdmission {
  meetingId: string;
  userId: string;
  name: string;
  presetName: string;
  expiresAt: Date;
}

const meetingResponse = z.object({ id: z.string().uuid() });
const participantResponse = z.object({ id: z.string().uuid(), token: z.string().min(1) });
const envelope = z.object({ success: z.literal(true), data: z.unknown() });

// Auth, role selection, usage reservations and durable shutdown belong to the
// caller. This class only speaks the provider API, and has no live entrypoint.
export class RealtimeKitClient {
  private readonly meetings: string;

  constructor(private readonly config: RealtimeKitConfig, private readonly fetchRequest: typeof fetch = fetch) {
    const { accountId, appId, apiToken } = config;
    if (!/^[a-f0-9]{32}$/i.test(accountId) || !/^[a-z0-9_-]+$/i.test(appId) || !apiToken.trim()) {
      throw new HttpError(503, "RealtimeKit credentials are not configured");
    }
    this.meetings = "https://api.cloudflare.com/client/v4/accounts/" + accountId + "/realtime/kit/" + appId + "/meetings";
  }

  async createMeeting(title: string) {
    const payload = meetingResponse.safeParse(await this.send("POST", this.meetings, {
      title,
      record_on_start: false,
      live_stream_on_start: false,
      transcribe_on_end: false,
      summarize_on_end: false,
      enable_sip: false,
      persist_chat: false
    }));
    if (!payload.success) throw new HttpError(502, "RealtimeKit returned an invalid meeting", ErrorCode.INTERNAL);
    return payload.data.id;
  }

  async addParticipant(admission: ParticipantAdmission) {
    const { meetingId, userId, name, presetName, expiresAt } = admission;
    if (!(expiresAt.getTime() > Date.now())) throw new HttpError(400, "The room admission has expired", ErrorCode.VALIDATION);
    const payload = participantResponse.safeParse(await this.send("POST", this.meetingUrl(meetingId) + "/participants", {
      custom_participant_id: userId,
      name,
      preset_name: presetName,
      token: { expires_on: expiresAt.toISOString() }
    }));
    if (!payload.success) throw new HttpError(502, "RealtimeKit returned invalid participant credentials", ErrorCode.INTERNAL);
    return { participantId: payload.data.id, token: payload.data.token };
  }

  async removeParticipant(meetingId: string, participantId: string) {
    const url = this.meetingUrl(meetingId) + "/participants/" + this.validateId(participantId);
    await this.send("DELETE", url);
  }

  async deactivateMeeting(meetingId: string) {
    const data = await this.send("PATCH", this.meetingUrl(meetingId), { status: "INACTIVE" });
    if (!z.object({ status: z.literal("INACTIVE") }).safeParse(data).success) {
      throw new HttpError(502, "RealtimeKit did not confirm that the meeting ended", ErrorCode.INTERNAL);
    }
  }

  private validateId(id: string) {
    if (!z.string().uuid().safeParse(id).success) throw new HttpError(400, "Invalid RealtimeKit identifier", ErrorCode.VALIDATION);
    return id;
  }

  private meetingUrl(id: string) {
    return this.meetings + "/" + this.validateId(id);
  }

  private async send(method: string, url: string, payload?: object) {
    let response: Response;
    try {
      response = await this.fetchRequest(url, {
        method,
        redirect: "error",
        signal: AbortSignal.timeout(5000),
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + this.config.apiToken },
        body: payload === undefined ? undefined : JSON.stringify(payload)
      });
    } catch {
      throw new HttpError(503, "RealtimeKit could not be reached", ErrorCode.INTERNAL);
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new HttpError(502, "RealtimeKit rejected the room operation", ErrorCode.INTERNAL);
    }
    const data = envelope.safeParse(await response.json().catch(() => null));
    if (!data.success) throw new HttpError(502, "RealtimeKit returned an unsuccessful response", ErrorCode.INTERNAL);
    return data.data.data;
  }
}
