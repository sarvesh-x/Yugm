import assert from "node:assert/strict";
import test from "node:test";
import { RealtimeKitClient } from "./realtimeKit.js";

const config = { accountId: "0".repeat(32), appId: "fixture-app", apiToken: "fixture-only-token" };
const meetingId = "daad5c31-7990-466d-aa42-a56bcea6e718";
const participantId = "0f4a329b-ea1f-4651-b4f5-0b3cf659accc";
const meetings = "https://api.cloudflare.com/client/v4/accounts/" + config.accountId + "/realtime/kit/fixture-app/meetings";

test("creates a meeting and scoped participant, then removes access and ends the meeting", async () => {
  const expiresAt = new Date(Date.now() + 60_000);
  const calls: Array<{ method?: string; url: string; body: unknown }> = [];
  const responses = [{ id: meetingId }, { id: participantId, token: "participant-token" }, {}, { status: "INACTIVE" }];
  const client = new RealtimeKitClient(config, async (url, init) => {
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer fixture-only-token");
    assert.equal(init?.redirect, "error");
    calls.push({ method: init?.method, url: String(url), body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return Response.json({ success: true, data: responses.shift() });
  });
  assert.equal(await client.createMeeting("Yugm room"), meetingId);
  assert.deepEqual(await client.addParticipant({ meetingId, userId: "yugm-user-id", name: "Yugm user",
    presetName: "voice-listener", expiresAt }), { participantId, token: "participant-token" });
  await client.removeParticipant(meetingId, participantId);
  await client.deactivateMeeting(meetingId);
  assert.deepEqual(calls, [
    { method: "POST", url: meetings, body: { title: "Yugm room", record_on_start: false, live_stream_on_start: false,
      transcribe_on_end: false, summarize_on_end: false, enable_sip: false, persist_chat: false } },
    { method: "POST", url: meetings + "/" + meetingId + "/participants", body: { custom_participant_id: "yugm-user-id",
      name: "Yugm user", preset_name: "voice-listener", token: { expires_on: expiresAt.toISOString() } } },
    { method: "DELETE", url: meetings + "/" + meetingId + "/participants/" + participantId, body: undefined },
    { method: "PATCH", url: meetings + "/" + meetingId, body: { status: "INACTIVE" } }
  ]);
});

test("does not trust unconfirmed shutdown or expose provider errors", async () => {
  const providerFailure = new RealtimeKitClient(config, async () => Response.json({ message: "provider detail" }, { status: 500 }));
  await assert.rejects(providerFailure.createMeeting("Yugm room"), { message: "RealtimeKit rejected the room operation" });
  const active = new RealtimeKitClient(config, async () => Response.json({ success: true, data: { status: "ACTIVE" } }));
  await assert.rejects(active.deactivateMeeting(meetingId), { message: "RealtimeKit did not confirm that the meeting ended" });
  await assert.rejects(active.deactivateMeeting("../"), { message: "Invalid RealtimeKit identifier" });
});
