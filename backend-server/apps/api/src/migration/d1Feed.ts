import type { D1Database } from "@cloudflare/workers-types";
import { Router } from "express";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { asyncHandler, sendOk } from "../utils/http.js";
import { createD1AccessSessionReader } from "./d1AccessSession.js";
import { person, personJson } from "./d1People.js";
import { readD1LiveRoomsForHosts } from "./d1Rooms.js";
import { d1StoryProjection, presentD1Story, type D1StoryRow } from "./d1StoryPresentation.js";

type FriendshipRow = { user_id: string; friend_id: string };
type FollowRow = { following_id: string };
type ActivityRow = {
  source_id: string; room_id: string; user_id: string | null;
  type: string; label: string; metadata: string; created_at: string | null; updated_at: string | null;
  user_json: string | null; room_json: string | null;
};

function presentActivity(row: ActivityRow) {
  return {
    _id: row.source_id, roomId: row.room_json ? JSON.parse(row.room_json) : null,
    userId: row.user_json ? person(row.user_json) : null,
    type: row.type, label: row.label, metadata: JSON.parse(String(row.metadata)),
    createdAt: row.created_at ?? undefined, updatedAt: row.updated_at ?? undefined
  };
}

export function createD1FeedRouter(db: D1Database) {
  const router = Router();
  const access = createD1AccessSessionReader(db, "http");

  router.get("/feed", asyncHandler(async (req, res) => {
    const { user } = await requireHttpSession(req.headers.authorization, access);
    const [friendships, follows] = await db.batch<FriendshipRow | FollowRow>([
      db.prepare(`SELECT user_id, friend_id FROM friendships
        WHERE status = 'ACCEPTED' AND (user_id = ? OR friend_id = ?)`).bind(user.id, user.id),
      db.prepare("SELECT following_id FROM follows WHERE follower_id = ?").bind(user.id)
    ]);
    const friendIds = [...new Set((friendships.results as FriendshipRow[])
      .map(row => row.user_id === user.id ? row.friend_id : row.user_id))];
    const followingIds = (follows.results as FollowRow[]).map(row => row.following_id);
    const relevantIds = [...new Set([...friendIds, ...followingIds])];

    const [friendRooms, friendStories, activities] = await Promise.all([
      readD1LiveRoomsForHosts(db, relevantIds, user.id, 10),
      friendIds.length
        ? db.prepare(`SELECT ${d1StoryProjection} FROM stories AS s JOIN users AS u ON u.source_id = s.user_id
            WHERE s.user_id IN (SELECT value FROM json_each(?1)) AND s.status = 'ACTIVE' AND s.expires_at > ?2
            ORDER BY s.created_at DESC, s.source_id DESC LIMIT 10`)
          .bind(JSON.stringify(friendIds), new Date().toISOString()).all<D1StoryRow>()
          .then(result => result.results.map(presentD1Story))
        : Promise.resolve([]),
      relevantIds.length
        ? db.prepare(`SELECT a.*,
            (SELECT ${personJson("u")} FROM users AS u WHERE u.source_id = a.user_id) AS user_json,
            (SELECT json_object('_id', r.source_id, 'title', r.title) FROM rooms AS r WHERE r.source_id = a.room_id) AS room_json
          FROM room_activities AS a
          WHERE a.user_id IN (SELECT value FROM json_each(?1))
          ORDER BY a.created_at DESC, a.source_id DESC LIMIT 30`)
          .bind(JSON.stringify(relevantIds)).all<ActivityRow>()
          .then(result => result.results.map(presentActivity))
        : Promise.resolve([])
    ]);

    const feed = [
      ...friendRooms.map(room => ({ type: "FRIEND_LIVE", room, createdAt: room.startedAt ?? room.createdAt })),
      ...friendStories.map(story => ({ type: "FRIEND_STORY", story, createdAt: story.createdAt })),
      ...activities.map(activity => ({ type: "ACTIVITY", activity, createdAt: activity.createdAt }))
    ].sort((left, right) => new Date(right.createdAt as string).getTime() - new Date(left.createdAt as string).getTime())
      .slice(0, 50);

    sendOk(res, { feed });
  }));

  return router;
}
