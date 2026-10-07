import { getPool } from "@/lib/db/pool";
import type {
  SupportTicket,
  TicketMessage,
  TicketStatus,
} from "@/lib/profile/types";

type DbTicketRow = {
  id: string;
  user_id: string;
  subject: string;
  category: string;
  status: TicketStatus;
  priority: "low" | "normal" | "high";
  created_at: Date;
  updated_at: Date;
  last_message: string | null;
  unread_by_user: string;
};

type DbMessageRow = {
  id: string;
  ticket_id: string;
  author_type: "user" | "support";
  body: string;
  created_at: Date;
};

function rowToTicket(row: DbTicketRow): SupportTicket {
  return {
    id: row.id,
    userId: row.user_id,
    subject: row.subject,
    category: row.category,
    status: row.status,
    priority: row.priority,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    lastMessage: row.last_message,
    unreadByUser: Number(row.unread_by_user) || 0,
  };
}

function rowToMessage(row: DbMessageRow): TicketMessage {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    authorType: row.author_type,
    body: row.body,
    createdAt: row.created_at.toISOString(),
  };
}

export async function listTickets(userId: string): Promise<SupportTicket[]> {
  const pool = getPool();
  const { rows } = await pool.query<DbTicketRow>(
    `SELECT t.*,
      (SELECT body FROM ticket_messages WHERE ticket_id = t.id ORDER BY created_at DESC LIMIT 1) AS last_message,
      (SELECT COUNT(*)::text FROM ticket_messages WHERE ticket_id = t.id AND author_type = 'support') AS unread_by_user
     FROM support_tickets t
     WHERE t.user_id = $1
     ORDER BY t.updated_at DESC`,
    [userId]
  );
  return rows.map(rowToTicket);
}

export async function getTicketForUser(
  userId: string,
  ticketId: string
): Promise<SupportTicket | null> {
  const pool = getPool();
  const { rows } = await pool.query<DbTicketRow>(
    `SELECT t.*,
      (SELECT body FROM ticket_messages WHERE ticket_id = t.id ORDER BY created_at DESC LIMIT 1) AS last_message,
      '0' AS unread_by_user
     FROM support_tickets t
     WHERE t.user_id = $1 AND t.id = $2`,
    [userId, ticketId]
  );
  return rows[0] ? rowToTicket(rows[0]) : null;
}

export async function createTicket(
  userId: string,
  subject: string,
  category: string,
  body: string,
  priority: "low" | "normal" | "high" = "normal"
): Promise<{ ticket: SupportTicket; messages: TicketMessage[] }> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const ticketRes = await client.query<DbTicketRow>(
      `INSERT INTO support_tickets (user_id, subject, category, priority)
       VALUES ($1, $2, $3, $4)
       RETURNING *, NULL::text AS last_message, '0' AS unread_by_user`,
      [userId, subject.trim(), category, priority]
    );

    const msgRes = await client.query<DbMessageRow>(
      `INSERT INTO ticket_messages (ticket_id, author_type, body)
       VALUES ($1, 'user', $2)
       RETURNING *`,
      [ticketRes.rows[0].id, body.trim()]
    );

    await client.query(
      `INSERT INTO ticket_messages (ticket_id, author_type, body)
       VALUES ($1, 'support', $2)`,
      [
        ticketRes.rows[0].id,
        "Спасибо за обращение. Менеджер LUNO ответит в течение 2 часов в рабочее время.",
      ]
    );

    await client.query("COMMIT");

    const ticket = rowToTicket({
      ...ticketRes.rows[0],
      last_message: body.trim(),
    });

    return {
      ticket,
      messages: msgRes.rows.map(rowToMessage),
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function listTicketMessages(
  userId: string,
  ticketId: string
): Promise<TicketMessage[]> {
  const ticket = await getTicketForUser(userId, ticketId);
  if (!ticket) return [];

  const pool = getPool();
  const { rows } = await pool.query<DbMessageRow>(
    `SELECT * FROM ticket_messages WHERE ticket_id = $1 ORDER BY created_at ASC`,
    [ticketId]
  );
  return rows.map(rowToMessage);
}

export async function addTicketMessage(
  userId: string,
  ticketId: string,
  body: string
): Promise<TicketMessage | null> {
  const ticket = await getTicketForUser(userId, ticketId);
  if (!ticket) return null;

  const pool = getPool();
  const { rows } = await pool.query<DbMessageRow>(
    `INSERT INTO ticket_messages (ticket_id, author_type, body)
     VALUES ($1, 'user', $2)
     RETURNING *`,
    [ticketId, body.trim()]
  );

  await pool.query(
    `UPDATE support_tickets SET status = 'open', updated_at = NOW() WHERE id = $1`,
    [ticketId]
  );

  return rowToMessage(rows[0]);
}
