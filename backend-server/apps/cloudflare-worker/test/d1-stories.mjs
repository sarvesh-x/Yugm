import assert from "node:assert/strict";

const avatar = "https://stories.fixture/avatar.png";
const avatarParts = ["background", "clothes", "head", "mouth", "eyes", "top"];

export async function verifyD1Stories(db, request, owner, follower, outsider) {
  const ownerId = owner.user.id;
  const followerId = follower.user.id;
  const outsiderId = outsider.user.id;
  const users = [ownerId, followerId, outsiderId];
  const marks = users.map(() => "?").join(", ");
  const followSource = `stories-fixture:${ownerId}:${followerId}`;
  const avatarColumns = ["avatar", "avatar_type", ...avatarParts.map(key => `avatar_parts_${key}`)];

  async function followsBetween(followerId, followingId) {
    const { results } = await db.prepare(`SELECT source_id, follower_id, following_id, created_at, updated_at
      FROM follows WHERE follower_id = ? AND following_id = ?`).bind(followerId, followingId).all();
    return results;
  }

  async function cleanStories() {
    const { results } = await db.prepare(`SELECT source_id FROM stories WHERE user_id IN (${marks})`).bind(...users).all();
    const stories = results.map(row => row.source_id);
    const statements = [
      db.prepare(`DELETE FROM notifications WHERE user_id IN (${marks})`).bind(...users)
    ];
    if (stories.length) {
      const storyMarks = stories.map(() => "?").join(", ");
      statements.push(
        db.prepare(`DELETE FROM story_comments WHERE story_id IN (${storyMarks})`).bind(...stories),
        db.prepare(`DELETE FROM story_highlight_stories WHERE value IN (${storyMarks})`).bind(...stories),
        db.prepare(`DELETE FROM story_views WHERE stories_id IN (${storyMarks})`).bind(...stories),
        db.prepare(`DELETE FROM stories WHERE source_id IN (${storyMarks})`).bind(...stories)
      );
    }
    statements.push(db.prepare("DELETE FROM follows WHERE source_id = ?").bind(followSource));
    await db.batch(statements);
  }

  await cleanStories();
  const originals = await Promise.all(users.map(id => db.prepare(
    `SELECT ${avatarColumns.join(", ")} FROM users WHERE source_id = ?`).bind(id).first()));
  const originalFollowerFollows = await followsBetween(followerId, ownerId);
  const originalOutsiderFollows = await followsBetween(outsiderId, ownerId);
  const [ownerProfile, followerProfile] = await Promise.all([ownerId, followerId].map(id => db.prepare(
    "SELECT name, username FROM users WHERE source_id = ?").bind(id).first()));
  try {
    const time = new Date().toISOString();
    const setup = [];
    if (!originalFollowerFollows.length) {
      setup.push(db.prepare(`INSERT INTO follows (source_id, follower_id, following_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)`).bind(followSource, followerId, ownerId, time, time));
    }
    for (const row of originalOutsiderFollows) {
      setup.push(db.prepare("DELETE FROM follows WHERE source_id = ?").bind(row.source_id));
    }
    setup.push(
      db.prepare("UPDATE users SET avatar = ?, avatar_type = ?, avatar_parts_background = NULL, avatar_parts_clothes = NULL, avatar_parts_head = ?, avatar_parts_mouth = NULL, avatar_parts_eyes = NULL, avatar_parts_top = NULL WHERE source_id = ?")
        .bind(avatar, "UPLOADED", 7, ownerId),
      db.prepare("UPDATE users SET avatar = ?, avatar_type = ?, avatar_parts_background = NULL, avatar_parts_clothes = NULL, avatar_parts_head = NULL, avatar_parts_mouth = NULL, avatar_parts_eyes = NULL, avatar_parts_top = NULL WHERE source_id = ?")
        .bind(avatar, "UPLOADED", followerId)
    );
    await db.batch(setup);

    await request("/api/stories", 401, { body: {} });
    await request("/api/stories/feed", 401);
    await request("/api/stories/bad/view", 401, { body: {} });
    assert.equal((await request("/api/stories", 422, {
      accessToken: owner.accessToken, body: { mediaUrl: "", mediaType: "IMAGE" }
    })).error.code, "VALIDATION");
    assert.equal((await request("/api/stories/bad/view", 400, {
      accessToken: owner.accessToken, body: {}
    })).error.message, "Invalid identifier");
    assert.equal((await request("/api/stories/bad/comments", 400, { accessToken: owner.accessToken }))
      .error.message, "Invalid identifier");
    assert.equal((await request("/api/stories/bad", 400, {
      accessToken: owner.accessToken, method: "DELETE"
    })).error.message, "Invalid identifier");

    const created = await request("/api/stories", 200, {
      accessToken: owner.accessToken,
      body: { mediaUrl: "https://stories.fixture/a.png", mediaType: "IMAGE", caption: "  hello  ", duration: 5 }
    });
    const story = created.data.story;
    const storyId = story._id;
    assert.equal(story.userId, ownerId);
    assert.equal(story.caption, "hello");
    assert.equal(story.duration, 5);
    assert.deepEqual(story.viewedBy, []);
    assert.equal(story.likeCount, 0);
    assert.equal(story.replyCount, 0);
    assert.equal(story.status, "ACTIVE");
    assert.ok(story.expiresAt);
    assert.ok(story.createdAt);
    assert.ok(story.updatedAt);
    assert.equal(story.__v, 0);

    assert.equal(await db.prepare(`SELECT COUNT(*) AS count FROM notifications
      WHERE user_id = ? AND type = 'MOMENT' AND title = 'New story' AND body = ?
        AND json_extract(data, '$.storyId') = ?`)
      .bind(followerId, `${ownerProfile.name} shared a moment`, storyId).first("count"), 1);

    const feed = await request("/api/stories/feed", 200, { accessToken: follower.accessToken });
    assert.ok(feed.data.stories[ownerId]);
    const group = feed.data.stories[ownerId];
    assert.deepEqual(group.user, {
      _id: ownerId, name: ownerProfile.name, username: ownerProfile.username,
      avatar, avatarType: "UPLOADED", avatarParts: { head: 7 }
    });
    assert.equal(group.stories.length, 1);
    assert.deepEqual(group.stories[0].userId, group.user);
    const outsiderFeed = await request("/api/stories/feed", 200, { accessToken: outsider.accessToken });
    assert.equal(outsiderFeed.data.stories[ownerId], undefined);

    const userStories = await request(`/api/stories/user/${ownerId}?skip=0&limit=10`, 200,
      { accessToken: outsider.accessToken });
    assert.equal(userStories.data.stories.length, 1);
    assert.equal(userStories.data.stories[0]._id, storyId);
    assert.equal((await request("/api/stories/user/bad", 400, { accessToken: outsider.accessToken }))
      .error.message, "Invalid identifier");

    assert.deepEqual(await request(`/api/stories/${storyId}/view`, 200, {
      accessToken: follower.accessToken, body: {}
    }).then(value => value.data), { viewed: true, viewCount: 1 });
    assert.equal((await request(`/api/stories/${storyId}/view`, 200, {
      accessToken: follower.accessToken, body: {}
    })).data.viewCount, 1);
    assert.equal((await request(`/api/stories/${storyId}/view`, 200, {
      accessToken: outsider.accessToken, body: {}
    })).data.viewCount, 2);

    const views = (await request(`/api/stories/${storyId}/views`, 200, { accessToken: owner.accessToken })).data;
    assert.equal(views.count, 2);
    assert.deepEqual(views.viewers.map(person => person._id), [followerId, outsiderId]);
    assert.equal(views.viewers[0].avatar, avatar);
    assert.equal(views.viewers[1].avatar, undefined);

    for (let index = 0; index < 2; index += 1) {
      await request(`/api/stories/${storyId}/like`, 200, { accessToken: follower.accessToken, body: {} });
    }
    const liked = await db.prepare("SELECT like_count FROM stories WHERE source_id = ?").bind(storyId).first("like_count");
    assert.equal(liked, 2);

    const comment = (await request(`/api/stories/${storyId}/comments`, 200, {
      accessToken: follower.accessToken, body: { text: "  nice  " }
    })).data.comment;
    const commentId = comment._id;
    assert.equal(comment.storyId, storyId);
    assert.equal(comment.parentId, null);
    assert.equal(comment.text, "nice");
    assert.equal(comment.__v, 0);
    assert.deepEqual(comment.userId, {
      _id: followerId, name: followerProfile.name, username: followerProfile.username, avatar, avatarType: "UPLOADED"
    });
    assert.equal(await db.prepare(`SELECT COUNT(*) AS count FROM notifications
      WHERE user_id = ? AND type = 'COMMENT' AND title = 'New comment' AND body = ?
        AND json_extract(data, '$.commentId') = ?`)
      .bind(ownerId, `${followerProfile.name} commented on your story`, commentId).first("count"), 1);

    const reply = (await request(`/api/stories/${storyId}/comments/${commentId}/reply`, 200, {
      accessToken: owner.accessToken, body: { text: "thanks" }
    })).data.reply;
    assert.equal(reply.parentId, commentId);
    assert.equal(reply.text, "thanks");
    assert.deepEqual(reply.userId, group.user);
    assert.equal(await db.prepare(`SELECT COUNT(*) AS count FROM notifications
      WHERE user_id = ? AND type = 'COMMENT' AND title = 'New reply' AND body = ?
        AND json_extract(data, '$.replyId') = ?`)
      .bind(followerId, `${ownerProfile.name} replied to your comment`, reply._id).first("count"), 1);

    const comments = (await request(`/api/stories/${storyId}/comments?skip=0&limit=10`, 200,
      { accessToken: owner.accessToken })).data.comments;
    assert.equal(comments.length, 1);
    assert.equal(comments[0]._id, commentId);
    assert.equal(comments[0].replies.length, 1);
    assert.equal(comments[0].replies[0]._id, reply._id);
    assert.equal(await db.prepare("SELECT reply_count FROM stories WHERE source_id = ?").bind(storyId).first("reply_count"), 2);

    assert.equal((await request(`/api/comments/${commentId}`, 200, {
      accessToken: follower.accessToken, method: "DELETE"
    })).data.deleted, true);
    assert.equal((await request(`/api/stories/${storyId}/comments`, 200, { accessToken: owner.accessToken }))
      .data.comments.length, 0);
    assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM story_comments WHERE story_id = ?")
      .bind(storyId).first("count"), 0);
    assert.equal(await db.prepare("SELECT reply_count FROM stories WHERE source_id = ?").bind(storyId).first("reply_count"), 0);

    await request(`/api/stories/${storyId}/hide`, 200, { accessToken: owner.accessToken, body: {} });
    assert.equal((await request("/api/stories/feed", 200, { accessToken: follower.accessToken }))
      .data.stories[ownerId], undefined);
    assert.equal((await request(`/api/stories/${storyId}/hide`, 404, {
      accessToken: outsider.accessToken, body: {}
    })).error.message, "Story not found");

    assert.equal((await request(`/api/stories/${storyId}`, 404, {
      accessToken: outsider.accessToken, method: "DELETE"
    })).error.message, "Story not found");
    assert.equal((await request(`/api/stories/${storyId}`, 200, {
      accessToken: owner.accessToken, method: "DELETE"
    })).data.deleted, true);
    assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM stories WHERE source_id = ?")
      .bind(storyId).first("count"), 0);
    assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM story_views WHERE stories_id = ?")
      .bind(storyId).first("count"), 0);
    assert.equal((await request(`/api/stories/${storyId}/views`, 404, { accessToken: owner.accessToken }))
      .error.message, "Story not found");
    assert.equal((await request(`/api/stories/${storyId}/view`, 404, {
      accessToken: owner.accessToken, body: {}
    })).error.message, "Story not found");
  } finally {
    await cleanStories();
    await db.batch([
      ...originalOutsiderFollows.map(row => db.prepare(`INSERT OR REPLACE INTO follows
        (source_id, follower_id, following_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`)
        .bind(row.source_id, row.follower_id, row.following_id, row.created_at, row.updated_at)),
      ...users.map((id, index) => {
        const original = originals[index] ?? {};
        return db.prepare(`UPDATE users SET ${avatarColumns.map(key => `${key} = ?`).join(", ")} WHERE source_id = ?`)
          .bind(...avatarColumns.map(key => original[key] ?? null), id);
      })
    ]);
  }
}
