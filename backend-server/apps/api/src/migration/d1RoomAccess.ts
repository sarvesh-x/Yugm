const roles = ["room_speakers", "room_moderators", "room_admins", "room_cohosts"];

export function roomAccessFor(viewer: string, alias = "r") {
  return `${alias}.visibility = 'PUBLIC' OR ${alias}.host_id = ${viewer} OR EXISTS (
    SELECT 1 FROM room_invites WHERE room_id = ${alias}.source_id AND invitee_id = ${viewer} AND status IN ('PENDING', 'ACCEPTED')
  ) OR ${roles.map(table =>
    `EXISTS (SELECT 1 FROM ${table} WHERE rooms_id = ${alias}.source_id AND value = ${viewer})`).join(" OR ")}`;
}
