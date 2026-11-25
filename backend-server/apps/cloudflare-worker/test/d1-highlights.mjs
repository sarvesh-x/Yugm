import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const id = () => randomBytes(12).toString("hex");

export async function verifyD1Highlights(db, request, owner, visitor) {
  const userId = owner.user.id;
  const now = new Date().toISOString();
  const future = new Date(Date.now() + 86_400_000).toISOString();
  const storyOne = id();
  const storyTwo = id();
  const storyThree = id();
  const missingStory = id();

  await db.batch([storyOne, storyTwo, storyThree].map((story, index) => db.prepare(`INSERT INTO stories
    (source_id, user_id, media_url, media_type, caption, like_count, reply_count, expires_at, status,
     created_at, updated_at)
    VALUES (?, ?, ?, 'IMAGE', ?, 0, 0, ?, 'ACTIVE', ?, ?)`)
    .bind(story, userId, `https://fixture.test/highlight-${index}.jpg`, `Highlight ${index}`,
      future, new Date(Date.now() + index).toISOString(), now)));

  await request("/api/highlights", 401, { body: { title: "Trip", storyIds: [storyOne] } });
  assert.equal((await request("/api/highlights", 422, {
    accessToken: owner.accessToken, body: { title: "", storyIds: [] }
  })).error.code, "VALIDATION");
  assert.equal((await request("/api/highlights", 404, {
    accessToken: owner.accessToken, body: { title: "Trip", storyIds: [missingStory] }
  })).error.message, "Story not found");

  const created = await request("/api/highlights", 201, {
    accessToken: owner.accessToken, body: { title: "Trip", storyIds: [storyOne, storyTwo] }
  });
  const highlight = created.data.highlight;
  assert.equal(highlight.userId, userId);
  assert.equal(highlight.title, "Trip");
  assert.equal(highlight.coverMediaUrl, `https://fixture.test/highlight-0.jpg`);
  assert.deepEqual(highlight.storyIds.map(story => story._id), [storyOne, storyTwo]);
  assert.equal(highlight.storyIds[0].userId._id, userId);

  await request(`/api/highlights/${userId}`, 401);
  assert.equal((await request(`/api/highlights/not-an-id`, 400, {
    accessToken: owner.accessToken
  })).error.message, "Invalid user ID");
  const listed = await request(`/api/highlights/${userId}`, 200, { accessToken: visitor.accessToken });
  assert.deepEqual(listed.data.highlights.map(item => item._id), [highlight._id]);

  assert.equal((await request(`/api/highlights/${highlight._id}`, 200, {
    accessToken: owner.accessToken, method: "PUT", body: {}
  })).ok, true);
  const renamed = await request(`/api/highlights/${highlight._id}`, 200, {
    accessToken: owner.accessToken, method: "PUT", body: { title: "Renamed" }
  });
  assert.equal(renamed.data.highlight.title, "Renamed");
  assert.deepEqual(renamed.data.highlight.storyIds.map(story => story._id), [storyOne, storyTwo]);

  const replaced = await request(`/api/highlights/${highlight._id}`, 200, {
    accessToken: owner.accessToken, method: "PUT", body: { storyIds: [storyThree] }
  });
  assert.equal(replaced.data.highlight.title, "Renamed");
  assert.deepEqual(replaced.data.highlight.storyIds.map(story => story._id), [storyThree]);

  const added = await request(`/api/highlights/${highlight._id}/stories`, 200, {
    accessToken: owner.accessToken, body: { storyIds: [storyOne, storyTwo] }
  });
  assert.deepEqual(added.data.highlight.storyIds.map(story => story._id), [storyThree, storyOne, storyTwo]);

  assert.equal((await request(`/api/highlights/${highlight._id}`, 404, {
    accessToken: visitor.accessToken, method: "PUT", body: { title: "Not mine" }
  })).error.message, "Highlight not found");
  assert.equal((await request(`/api/highlights/${highlight._id}/stories`, 404, {
    accessToken: visitor.accessToken, body: { storyIds: [storyOne] }
  })).error.message, "Highlight not found");

  assert.equal((await request(`/api/highlights/${highlight._id}/stories/not-an-id`, 400, {
    accessToken: owner.accessToken, method: "DELETE"
  })).error.message, "Invalid ID");
  const pulled = await request(`/api/highlights/${highlight._id}/stories/${storyOne}`, 200, {
    accessToken: owner.accessToken, method: "DELETE"
  });
  assert.deepEqual(pulled.data.highlight.storyIds.map(story => story._id), [storyThree, storyTwo]);
  const missing = await request(`/api/highlights/${highlight._id}/stories/${storyOne}`, 200, {
    accessToken: owner.accessToken, method: "DELETE"
  });
  assert.deepEqual(missing.data.highlight.storyIds.map(story => story._id), [storyThree, storyTwo]);

  assert.equal((await request(`/api/highlights/${highlight._id}`, 404, {
    accessToken: visitor.accessToken, method: "DELETE"
  })).error.message, "Highlight not found");
  assert.equal((await request(`/api/highlights/${highlight._id}`, 200, {
    accessToken: owner.accessToken, method: "DELETE"
  })).data.deleted, true);
  assert.equal(await db.prepare("SELECT 1 FROM story_highlights WHERE source_id = ?").bind(highlight._id).first(), null);
  assert.equal((await db.prepare("SELECT COUNT(*) AS total FROM story_highlight_stories WHERE story_highlights_id = ?")
    .bind(highlight._id).first()).total, 0);
  assert.equal((await request(`/api/highlights/${highlight._id}`, 404, {
    accessToken: owner.accessToken, method: "DELETE"
  })).error.message, "Highlight not found");
}
