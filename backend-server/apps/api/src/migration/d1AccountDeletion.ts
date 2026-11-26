import type { D1Database } from "@cloudflare/workers-types";
import { endD1UnavailableBonds } from "./d1Bonds.js";
import { endD1Room } from "./d1Rooms.js";

type DeleteGraphEntry = [table: string, columns: Array<[column: string, referencedTable: string, nullable: boolean]>];
type DeleteRoots = Map<string, Set<string>>;

// Child-first order derived from the applied D1 migration graph. Only seeded rows
// are deleted; nullable references are cleared, and the retained anonymized user
// stub is never a cascade target.
const D1_DELETE_GRAPH: DeleteGraphEntry[] = [["battle_pass_rewards",[["battle_passes_id","battle_passes",false]]],["admin_sessions",[["admin_id","admin_users",false]]],["admin_role_permissions",[["admin_users_id","admin_users",false]]],["admin_purchase_refunds",[["purchase_id","purchases",false],["admin_id","admin_users",false]]],["voice_poll_options",[["voice_polls_id","voice_polls",false]]],["vibe_graph_languages",[["vibe_graphs_id","vibe_graphs",false]]],["vibe_graph_interests",[["vibe_graphs_id","vibe_graphs",false]]],["user_showcased_badges",[["users_id","users",false]]],["user_safety_statuses",[["user_id","users",false],["last_reviewed_by","admin_users",true]]],["user_profile_media",[["users_id","users",false]]],["user_owned_titles",[["users_id","users",false]]],["user_owned_cosmetics",[["users_id","users",false]]],["user_missions",[["user_id","users",false],["mission_id","missions",false]]],["user_languages",[["users_id","users",false]]],["user_interests",[["users_id","users",false]]],["user_hobbies",[["users_id","users",false]]],["user_daily_answers",[["user_id","users",false],["question_id","daily_questions",false]]],["user_claimed_achievements",[["users_id","users",false]]],["user_claimed_achievement_tiers",[["users_id","users",false]]],["user_badge_grants",[["users_id","users",false]]],["user_auth_profile",[["source_id","users",true]]],["support_ticket_messages",[["sender_id","users",false],["support_tickets_id","support_tickets",false]]],["support_messages",[["ticket_id","support_tickets",false],["sender_user_id","users",true],["sender_admin_id","admin_users",true]]],["subscriptions",[["subscriber_id","users",false],["creator_id","users",false]]],["story_views",[["value","users",true],["stories_id","stories",false]]],["story_highlight_stories",[["value","stories",true],["story_highlights_id","story_highlights",false]]],["story_highlights",[["user_id","users",false]]],["story_comments",[["story_id","stories",false],["user_id","users",false],["parent_id","story_comments",true]]],["stories",[["user_id","users",false]]],["room_reactions",[["created_by","admin_users",true]]],["room_mode_scores",[["room_mode_states_id","room_mode_states",false]]],["room_mode_participants",[["value","users",true],["room_mode_states_id","room_mode_states",false]]],["relationship_users",[["value","users",false],["relationships_id","relationships",false]]],["referrals",[["referrer_id","users",false],["referred_user_id","users",true]]],["purchases",[["user_id","users",false],["credited_transaction_id","wallet_transactions",true],["credited_diamond_transaction_id","diamond_transactions",true],["refund_transaction_id","wallet_transactions",true]]],["profile_visits",[["profile_id","users",false],["visitor_id","users",false]]],["poll_votes",[["value","users",true],["polls_id","polls",false]]],["poll_options",[["polls_id","polls",false]]],["payout_reviews",[["user_id","users",false],["withdrawal_request_id","withdrawal_requests",false],["trust_verification_id","trust_verifications",true],["creator_payout_kyc_id","creator_payout_kycs",true],["reviewed_by_admin_id","admin_users",true]]],["notification_campaigns",[["created_by","admin_users",false]]],["moderation_actions",[["target_user_id","users",false],["moderator_id","users",true],["report_id","reports",true]]],["match_users",[["value","users",false],["matches_id","matches",false]]],["likes",[["liker_id","users",false],["liked_id","users",false]]],["group_messages",[["group_id","group_chats",false],["sender_id","users",false]]],["gift_inventories",[["user_id","users",false],["gift_id","gifts",false]]],["friendships",[["user_id","users",false],["friend_id","users",false]]],["face_verification_submissions",[["user_id","users",false],["verification_id","trust_verifications",false],["reviewed_by_admin_id","admin_users",true]]],["event_participants",[["value","users",true],["events_id","events",false]]],["diamond_transactions",[["user_id","users",false]]],["creator_payout_kycs",[["user_id","users",false],["reviewed_by_admin_id","admin_users",true]]],["conversation_participants",[["value","users",true],["group_chats_id","group_chats",false]]],["group_chats",[["created_by","users",false]]],["battle_passes",[["season_id","seasons",false],["user_id","users",false]]],["battle_pass_xp_grants",[["user_id","users",false],["season_id","seasons",false]]],["app_config",[["updated_by","admin_users",true]]],["admin_moderation_actions",[["admin_id","admin_users",false],["queue_id","moderation_queues",true],["report_id","reports",true],["target_user_id","users",true]]],["moderation_queues",[["report_id","reports",true],["target_user_id","users",true],["assigned_to","admin_users",true],["resolved_by","admin_users",true]]],["admin_audit_logs",[["admin_id","admin_users",true],["target_user_id","users",true]]],["direct_message_reactions_catalog",[["user_id","users",false],["direct_messages_id","direct_messages",false]]],["user_claimed_achievement_tiers_0030",[["users_id","users",false]]],["support_ticket_messages_v2",[["sender_id","users",true],["sender_admin_id","admin_users",true],["support_tickets_id","support_tickets",false]]],["support_tickets",[["user_id","users",true],["assigned_to","admin_users",true]]],["notification_push_jobs",[["notification_id","notifications",false]]],["xp_grants",[["user_id","users",false]]],["withdrawal_requests",[["user_id","users",false],["reviewed_by_admin_id","admin_users",true]]],["wishlist_items",[["user_id","users",false],["gift_id","gifts",false]]],["wave_nudges",[["sender_id","users",false],["receiver_id","users",false],["room_id","rooms",true]]],["watch_parties",[["room_id","rooms",false],["host_id","users",false]]],["wallet_transactions",[["user_id","users",false]]],["voice_verification_submissions",[["user_id","users",false],["verification_id","trust_verifications",false],["reviewed_by_admin_id","admin_users",true]]],["trust_verifications",[["user_id","users",false],["reviewed_by_admin_id","admin_users",true]]],["admin_users",[["user_id","users",true],["created_by","admin_users",true]]],["voice_poll_votes",[["value","users",true],["voice_polls_id","voice_polls",false]]],["voice_poll_ballots",[["user_id","users",false],["voice_polls_id","voice_polls",false]]],["voice_polls",[["user_id","users",false]]],["vibe_graphs",[["user_id","users",false]]],["user_moods",[["user_id","users",false],["activity_room_id","rooms",true]]],["speaker_requests",[["room_id","rooms",false],["user_id","users",false]]],["room_speakers",[["value","users",true],["rooms_id","rooms",false]]],["room_recordings",[["room_id","rooms",false],["host_id","users",false]]],["room_moderators",[["value","users",true],["rooms_id","rooms",false]]],["room_mode_states",[["room_id","rooms",false],["current_turn_user_id","users",true]]],["room_locked_seats",[["rooms_id","rooms",false]]],["room_follows",[["room_id","rooms",false],["user_id","users",false]]],["room_cohosts",[["value","users",true],["rooms_id","rooms",false]]],["room_admins",[["value","users",true],["rooms_id","rooms",false]]],["room_activities",[["room_id","rooms",false],["user_id","users",true]]],["reports",[["reporter_id","users",false],["target_user_id","users",true],["room_id","rooms",true],["reviewed_by","users",true]]],["polls",[["room_id","rooms",false],["created_by","users",false]]],["pk_votes",[["battle_id","pk_battles",false],["voter_id","users",false],["room_id","rooms",false]]],["pk_participants",[["battle_id","pk_battles",false],["user_id","users",false],["room_id","rooms",false]]],["pk_leaderboard_entries",[["battle_id","pk_battles",false],["user_id","users",false]]],["pk_invites",[["battle_id","pk_battles",false],["inviter_user_id","users",false],["invitee_user_id","users",false],["inviter_room_id","rooms",false],["invitee_room_id","rooms",false]]],["pk_events",[["battle_id","pk_battles",false],["room_id","rooms",true],["user_id","users",true],["gift_transaction_id","gift_transactions",true]]],["mini_game_challenges",[["challenger_id","users",false],["target_user_id","users",true],["clan_id","clans",true],["score_id","mini_game_scores",true]]],["mini_game_scores",[["user_id","users",false]]],["message_hidden_for",[["value","users",true],["direct_messages_id","direct_messages",false]]],["gift_transactions",[["room_id","rooms",true],["sender_id","users",false],["receiver_id","users",false],["gift_id","gifts",false]]],["friend_match_requests",[["user_id","users",false],["matched_user_id","users",true],["room_id","rooms",true]]],["events",[["host_id","users",false],["room_id","rooms",true]]],["direct_message_reactions",[["user_id","users",false],["direct_messages_id","direct_messages",false]]],["clan_message_reactions",[["user_id","users",false],["clan_messages_id","clan_messages",false]]],["room_invites",[["room_id","rooms",false],["inviter_id","users",false],["invitee_id","users",false]]],["room_participants",[["room_id","rooms",false],["user_id","users",false]]],["chat_messages",[["room_id","rooms",false],["sender_id","users",false]]],["clan_member_roles",[["user_id","users",false],["clans_id","clans",false]]],["clan_members",[["value","users",true],["clans_id","clans",false]]],["clan_invites",[["clan_id","clans",false],["inviter_id","users",false],["invitee_id","users",false]]],["clan_messages",[["clan_id","clans",false],["sender_id","users",false]]],["conversation_mutes",[["owner_id","users",false],["partner_id","users",false]]],["direct_messages",[["sender_id","users",false],["receiver_id","users",false],["room_id","rooms",true],["reply_to_author_id","users",true]]],["rooms",[["host_id","users",false],["active_pk_id","pk_battles",true]]],["pk_battles",[["selected_gift_id","gifts",true],["started_by_user_id","users",false],["left_room_id","rooms",false],["right_room_id","rooms",false],["left_host_id","users",false],["right_host_id","users",false],["winner_user_id","users",true]]],["notifications",[["user_id","users",false]]],["blocks",[["blocker_id","users",false],["blocked_user_id","users",false]]],["follows",[["follower_id","users",false],["following_id","users",false]]],["device_tokens",[["user_id","users",false]]],["auth_sessions",[["user_id","users",false]]],["users",[["clan_id","clans",true],["referred_by","users",true]]],["clans",[["owner_id","users",false]]]];

const DAY_MS = 86_400_000;
const RETENTION_DAYS = 30;
const DEFAULT_LIMIT = 20;

const DIRECT_DEPENDENTS: Array<[table: string, columns: string[]]> = [
  ["auth_sessions", ["user_id"]],
  ["device_tokens", ["user_id"]],
  ["follows", ["follower_id", "following_id"]],
  ["blocks", ["blocker_id", "blocked_user_id"]],
  ["notifications", ["user_id"]],
  ["conversation_mutes", ["owner_id", "partner_id"]],
  ["direct_messages", ["sender_id", "receiver_id"]],
  ["clan_invites", ["inviter_id", "invitee_id"]],
  ["clan_member_roles", ["user_id"]],
  ["clan_messages", ["sender_id"]],
  ["chat_messages", ["sender_id"]],
  ["room_participants", ["user_id"]],
  ["room_invites", ["inviter_id", "invitee_id"]]
];

function addRoots(roots: DeleteRoots, table: string, ids: string[]) {
  if (!ids.length) return;
  const existing = roots.get(table) ?? new Set<string>();
  for (const id of ids) existing.add(id);
  roots.set(table, existing);
}

function params(values: string[]) {
  return values.map(value => JSON.stringify(value));
}

async function collectIds(db: D1Database, sql: string, bindings: string[]) {
  const { results } = await db.prepare(sql).bind(...bindings).all<{ source_id: string }>();
  return results.map(row => row.source_id);
}

async function cascadeDeleteD1Rows(db: D1Database, roots: DeleteRoots) {
  const { results: tableRows } = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all<{ name: string }>();
  const tablesWithId = new Set<string>();
  for (const { name } of tableRows) {
    const { results: info } = await db.prepare(`PRAGMA table_info("${name}")`).all<{ name: string }>();
    if (info.some(column => column.name === "source_id")) tablesWithId.add(name);
  }
  const statements = [];
  for (const [table, columns] of D1_DELETE_GRAPH) {
    if (table === "users" || !tablesWithId.has(table)) continue;
    const matching = columns.filter(([, referencedTable]) => (roots.get(referencedTable)?.size ?? 0) > 0);
    if (!matching.length) continue;
    try {
      const required = matching.filter(([, , nullable]) => !nullable);
      if (required.length) {
        const predicate = required.map(([column], index) =>
          `${column} IN (SELECT value FROM json_each(?${index + 1}))`).join(" OR ");
        const bindings = required.map(([, referencedTable]) =>
          JSON.stringify([...roots.get(referencedTable)!]));
        const rows = await db.prepare(`SELECT source_id FROM ${table} WHERE ${predicate}`)
          .bind(...bindings).all<{ source_id: string }>();
        if (rows.results.length) {
          const ids = rows.results.map(row => row.source_id);
          addRoots(roots, table, ids);
          statements.push(db.prepare(`DELETE FROM ${table} WHERE source_id IN (SELECT value FROM json_each(?))`)
            .bind(JSON.stringify(ids)));
        }
      }
      for (const [column, referencedTable, nullable] of matching) {
        if (!nullable) continue;
        statements.push(db.prepare(`UPDATE ${table} SET ${column} = NULL
          WHERE ${column} IN (SELECT value FROM json_each(?))`)
          .bind(JSON.stringify([...roots.get(referencedTable)!])));
      }
    } catch (error) {
      throw new Error(`D1 deletion cascade failed on ${table}: ${String(error)}`);
    }
  }
  for (const [table, ids] of roots) {
    if (table === "users" || !ids.size || !tablesWithId.has(table)) continue;
    statements.push(db.prepare(`DELETE FROM ${table} WHERE source_id IN (SELECT value FROM json_each(?))`)
      .bind(JSON.stringify([...ids])));
  }
  if (statements.length) await db.batch(statements);
}

async function seedClanCleanup(db: D1Database, userId: string, roots: DeleteRoots, time: string) {
  const owned = await db.prepare("SELECT source_id FROM clans WHERE owner_id = ?").bind(userId)
    .all<{ source_id: string }>();
  for (const clan of owned.results) {
    const successor = await db.prepare(`SELECT value FROM clan_members WHERE clans_id = ? AND value <> ?
      AND value IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users WHERE source_id = value AND deletion_requested_at IS NOT NULL)
      ORDER BY position, value LIMIT 1`).bind(clan.source_id, userId).first<{ value: string }>();
    if (successor) {
      await db.batch([
        db.prepare("UPDATE clans SET owner_id = ?, updated_at = ? WHERE source_id = ?")
          .bind(successor.value, time, clan.source_id),
        db.prepare(`UPDATE clan_member_roles SET role = CASE WHEN user_id = ? THEN 'MEMBER' ELSE role END
          WHERE clans_id = ?`).bind(userId, clan.source_id),
        db.prepare(`UPDATE clan_member_roles SET role = 'LEADER', position = 0 WHERE clans_id = ? AND user_id = ?`)
          .bind(clan.source_id, successor.value),
        db.prepare(`INSERT INTO clan_member_roles (source_id, user_id, role, clans_id, position)
          SELECT ?, ?, 'LEADER', ?, 0 WHERE NOT EXISTS (
            SELECT 1 FROM clan_member_roles WHERE clans_id = ? AND user_id = ?)`)
          .bind(`${clan.source_id}:leader:${successor.value}`, successor.value, clan.source_id,
            clan.source_id, successor.value)
      ]);
    } else {
      addRoots(roots, "clans", [clan.source_id]);
    }
  }
  const memberships = await db.prepare("SELECT clans_id, source_id FROM clan_members WHERE value = ?")
    .bind(userId).all<{ clans_id: string; source_id: string }>();
  for (const membership of memberships.results) {
    await db.prepare("UPDATE clans SET member_count = MAX(0, member_count - 1), updated_at = ? WHERE source_id = ?")
      .bind(time, membership.clans_id).run();
  }
  addRoots(roots, "clan_members", memberships.results.map(row => row.source_id));
  const roles = await db.prepare("SELECT source_id FROM clan_member_roles WHERE user_id = ?").bind(userId)
    .all<{ source_id: string }>();
  addRoots(roots, "clan_member_roles", roles.results.map(row => row.source_id));
}

async function purgeD1Account(db: D1Database, userId: string, cutoff: string, time: string) {
  const roots: DeleteRoots = new Map();
  await endD1UnavailableBonds(db, userId, "TERMINATED_BY_ACCOUNT_REMOVAL");

  const rooms = await db.prepare("SELECT source_id, status FROM rooms WHERE host_id = ?").bind(userId)
    .all<{ source_id: string; status: string }>();
  for (const room of rooms.results) {
    if (room.status === "LIVE") await endD1Room(db, room.source_id, time);
  }
  addRoots(roots, "rooms", rooms.results.map(row => row.source_id));

  for (const [table, columns] of DIRECT_DEPENDENTS) {
    if (table === "clan_members" || table === "clan_member_roles") continue;
    const predicate = columns.map((column, index) =>
      `${column} IN (SELECT value FROM json_each(?${index + 1}))`).join(" OR ");
    const ids = await collectIds(db, `SELECT source_id FROM ${table} WHERE ${predicate}`,
      params(columns.map(() => userId)));
    addRoots(roots, table, ids);
  }
  await seedClanCleanup(db, userId, roots, time);
  await cascadeDeleteD1Rows(db, roots);

  const committed = await db.batch([
    db.prepare("UPDATE users SET referred_by = NULL WHERE referred_by = ?").bind(userId),
    db.prepare(`UPDATE users SET name = 'Deleted User', username = 'deleted_' || source_id,
      email = NULL, phone = NULL, firebase_uid = NULL, avatar = NULL, avatar_media_id = NULL,
      avatar_type = NULL, avatar_parts_background = NULL, avatar_parts_clothes = NULL,
      avatar_parts_head = NULL, avatar_parts_mouth = NULL, avatar_parts_eyes = NULL, avatar_parts_top = NULL,
      city = NULL, state = NULL, bio = NULL, vibe_line = NULL, gender = NULL, age = NULL,
      interested_in = NULL, looking_for = NULL, dating_age_min = NULL, dating_age_max = NULL,
      dating_verified_only = 0, profile_completed_at = NULL, terms_accepted_at = NULL,
      referral_code = NULL, referred_by = NULL, clan_id = NULL, is_verified = 0, email_verified = 0,
      active_cosmetics_avatar_asset = NULL, active_cosmetics_avatar_frame = NULL,
      active_cosmetics_speaking_wave = NULL, active_cosmetics_profile_theme = NULL,
      active_cosmetics_entrance_effect = NULL, active_cosmetics_profile_badge = NULL,
      active_cosmetics_name_style = NULL, active_cosmetics_room_entry = NULL,
      active_cosmetics_mood_status = NULL, active_cosmetics_profile_music = NULL,
      active_cosmetics_voice_badge = NULL, active_cosmetics_room_theme = NULL,
      active_cosmetics_avatar_decoration = NULL, active_cosmetics_reaction_pack = NULL,
      active_cosmetics_profile_layout = NULL, active_cosmetics_profile_banner = NULL,
      active_cosmetics_intro_card = NULL, active_cosmetics_seasonal_event = NULL,
      active_cosmetics_video_call_overlay = NULL, active_cosmetics_room_badge = NULL,
      active_cosmetics_room_ambience = NULL, token_version = token_version + 1,
      updated_at = ?
      WHERE source_id = ? AND deletion_requested_at IS NOT NULL AND deletion_requested_at <= ?
      AND EXISTS (SELECT 1 FROM account_deletions WHERE source_id = ? AND hard_deleted_at IS NULL)`)
      .bind(time, userId, cutoff, userId),
    db.prepare("UPDATE account_deletions SET hard_deleted_at = ? WHERE source_id = ? AND hard_deleted_at IS NULL")
      .bind(time, userId)
  ]);
  return Boolean(committed[1]?.meta?.changes);
}

export async function purgeExpiredD1Accounts(db: D1Database, now: Date, limit = DEFAULT_LIMIT) {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * DAY_MS).toISOString();
  const due = await db.prepare(`SELECT d.source_id FROM account_deletions AS d
    JOIN users AS u ON u.source_id = d.source_id
    WHERE u.deletion_requested_at IS NOT NULL AND u.deletion_requested_at <= ? AND d.hard_deleted_at IS NULL
    ORDER BY u.deletion_requested_at, d.source_id LIMIT ?`).bind(cutoff, Math.max(1, Math.min(100, limit)))
    .all<{ source_id: string }>();
  const purged: string[] = [];
  for (const row of due.results) {
    if (await purgeD1Account(db, row.source_id, cutoff, now.toISOString())) purged.push(row.source_id);
  }
  return { purged };
}
