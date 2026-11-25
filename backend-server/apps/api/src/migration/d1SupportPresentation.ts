export type TicketRow = {
  source_id: string;
  user_id: string | null;
  requester_email: string | null;
  assigned_to: string | null;
  category: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  last_message_at: string | null;
  closed_at: string | null;
  resolved_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export function ticketJson(row: TicketRow, messages: unknown[], user?: unknown, assignee?: unknown) {
  return {
    _id: row.source_id,
    ...(row.user_id === null ? {} : { userId: user === undefined ? row.user_id : user }),
    ...(row.requester_email === null ? {} : { requesterEmail: row.requester_email }),
    ...(row.assigned_to === null ? {} : { assignedTo: assignee === undefined ? row.assigned_to : assignee }),
    category: row.category,
    subject: row.subject,
    message: row.message,
    status: row.status,
    priority: row.priority,
    ...(row.last_message_at === null ? {} : { lastMessageAt: row.last_message_at }),
    ...(row.closed_at === null ? {} : { closedAt: row.closed_at }),
    ...(row.resolved_at === null ? {} : { resolvedAt: row.resolved_at }),
    messages,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined
  };
}
