import { Router, type IRouter } from "express";
import { db, usersTable, ticketsTable, ticketMessagesTable, ticketInternalNotesTable } from "@workspace/db";
import { eq, and, sql, desc, or, ilike } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

const VALID_STATUSES = ["open", "in_progress", "waiting_user", "resolved", "closed"] as const;
const VALID_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
const VALID_CATEGORIES = ["technical", "login", "reels", "account", "payment", "panel", "other"] as const;

function validateStr(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

// ─── GET /api/tickets/unread-count ───────────────────────────────────────────
router.get("/tickets/unread-count", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const role = req.user!.role;

  if (role === "admin") {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(ticketsTable)
      .where(eq(ticketsTable.isReadByAdmin, false));
    res.json({ unreadCount: row?.count ?? 0 });
  } else {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(ticketsTable)
      .where(and(eq(ticketsTable.userId, userId), eq(ticketsTable.isReadByUser, false)));
    res.json({ unreadCount: row?.count ?? 0 });
  }
});

// ─── GET /api/tickets ────────────────────────────────────────────────────────
router.get("/tickets", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const role = req.user!.role;

  const { status, priority, category, userId: qUserId, assignedAdminId: qAdmin, search } = req.query as Record<string, string>;

  let baseQuery = db
    .select({
      id: ticketsTable.id,
      ticketNo: ticketsTable.ticketNo,
      userId: ticketsTable.userId,
      userName: usersTable.name,
      userUsername: usersTable.username,
      subject: ticketsTable.subject,
      category: ticketsTable.category,
      priority: ticketsTable.priority,
      status: ticketsTable.status,
      assignedAdminId: ticketsTable.assignedAdminId,
      isReadByAdmin: ticketsTable.isReadByAdmin,
      isReadByUser: ticketsTable.isReadByUser,
      createdAt: ticketsTable.createdAt,
      updatedAt: ticketsTable.updatedAt,
      closedAt: ticketsTable.closedAt,
      messageCount: sql<number>`(SELECT count(*)::int FROM ticket_messages WHERE ticket_id = ${ticketsTable.id})`,
    })
    .from(ticketsTable)
    .leftJoin(usersTable, eq(ticketsTable.userId, usersTable.id))
    .$dynamic();

  const conditions: ReturnType<typeof eq>[] = [];

  if (role !== "admin") {
    conditions.push(eq(ticketsTable.userId, userId) as any);
  } else {
    if (qUserId) conditions.push(eq(ticketsTable.userId, parseInt(qUserId, 10)) as any);
    if (qAdmin === "unassigned") {
      conditions.push(sql`${ticketsTable.assignedAdminId} IS NULL` as any);
    } else if (qAdmin) {
      conditions.push(eq(ticketsTable.assignedAdminId, parseInt(qAdmin, 10)) as any);
    }
  }

  if (status && VALID_STATUSES.includes(status as any)) {
    conditions.push(eq(ticketsTable.status, status) as any);
  }
  if (priority && VALID_PRIORITIES.includes(priority as any)) {
    conditions.push(eq(ticketsTable.priority, priority) as any);
  }
  if (category && VALID_CATEGORIES.includes(category as any)) {
    conditions.push(eq(ticketsTable.category, category) as any);
  }
  if (search) {
    const like = `%${search}%`;
    conditions.push(or(
      ilike(ticketsTable.subject, like),
      ilike(ticketsTable.ticketNo, like),
    ) as any);
  }

  if (conditions.length > 0) {
    baseQuery = baseQuery.where(and(...(conditions as any[])));
  }

  const rows = await baseQuery.orderBy(desc(ticketsTable.updatedAt));
  res.json(rows);
});

// ─── POST /api/tickets ───────────────────────────────────────────────────────
router.post("/tickets", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;

  const subject = validateStr(req.body.subject);
  const message = validateStr(req.body.message);
  const category = validateStr(req.body.category);
  const priority = validateStr(req.body.priority);

  if (!subject) { res.status(400).json({ error: "Başlık gerekli" }); return; }
  if (!message) { res.status(400).json({ error: "İlk mesaj gerekli" }); return; }
  if (!category || !VALID_CATEGORIES.includes(category as any)) { res.status(400).json({ error: "Geçersiz kategori" }); return; }
  if (!priority || !VALID_PRIORITIES.includes(priority as any)) { res.status(400).json({ error: "Geçersiz öncelik" }); return; }

  const [ticket] = await db.insert(ticketsTable).values({
    ticketNo: "TK-TEMP",
    userId,
    subject,
    category,
    priority,
    status: "open",
    isReadByAdmin: false,
    isReadByUser: true,
  }).returning();

  const ticketNo = `TK-${ticket.id.toString().padStart(4, "0")}`;
  await db.update(ticketsTable).set({ ticketNo }).where(eq(ticketsTable.id, ticket.id));

  await db.insert(ticketMessagesTable).values({
    ticketId: ticket.id,
    senderId: userId,
    senderRole: "user",
    message,
  });

  res.status(201).json({ ...ticket, ticketNo });
});

// ─── GET /api/tickets/:id ────────────────────────────────────────────────────
router.get("/tickets/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Geçersiz ID" }); return; }

  const userId = req.user!.id;
  const role = req.user!.role;

  const [ticket] = await db
    .select({
      id: ticketsTable.id,
      ticketNo: ticketsTable.ticketNo,
      userId: ticketsTable.userId,
      userName: usersTable.name,
      userUsername: usersTable.username,
      subject: ticketsTable.subject,
      category: ticketsTable.category,
      priority: ticketsTable.priority,
      status: ticketsTable.status,
      assignedAdminId: ticketsTable.assignedAdminId,
      isReadByAdmin: ticketsTable.isReadByAdmin,
      isReadByUser: ticketsTable.isReadByUser,
      createdAt: ticketsTable.createdAt,
      updatedAt: ticketsTable.updatedAt,
      closedAt: ticketsTable.closedAt,
    })
    .from(ticketsTable)
    .leftJoin(usersTable, eq(ticketsTable.userId, usersTable.id))
    .where(eq(ticketsTable.id, id));

  if (!ticket) { res.status(404).json({ error: "Ticket bulunamadı" }); return; }
  if (role !== "admin" && ticket.userId !== userId) { res.status(403).json({ error: "Forbidden" }); return; }

  const messages = await db
    .select({
      id: ticketMessagesTable.id,
      ticketId: ticketMessagesTable.ticketId,
      senderId: ticketMessagesTable.senderId,
      senderRole: ticketMessagesTable.senderRole,
      senderName: usersTable.name,
      message: ticketMessagesTable.message,
      createdAt: ticketMessagesTable.createdAt,
    })
    .from(ticketMessagesTable)
    .leftJoin(usersTable, eq(ticketMessagesTable.senderId, usersTable.id))
    .where(eq(ticketMessagesTable.ticketId, id))
    .orderBy(ticketMessagesTable.createdAt);

  let notes: unknown[] = [];
  if (role === "admin") {
    notes = await db
      .select({
        id: ticketInternalNotesTable.id,
        ticketId: ticketInternalNotesTable.ticketId,
        adminId: ticketInternalNotesTable.adminId,
        adminName: usersTable.name,
        note: ticketInternalNotesTable.note,
        createdAt: ticketInternalNotesTable.createdAt,
      })
      .from(ticketInternalNotesTable)
      .leftJoin(usersTable, eq(ticketInternalNotesTable.adminId, usersTable.id))
      .where(eq(ticketInternalNotesTable.ticketId, id))
      .orderBy(ticketInternalNotesTable.createdAt);
  }

  // Mark as read
  if (role === "admin" && !ticket.isReadByAdmin) {
    await db.update(ticketsTable).set({ isReadByAdmin: true }).where(eq(ticketsTable.id, id));
  } else if (role !== "admin" && !ticket.isReadByUser) {
    await db.update(ticketsTable).set({ isReadByUser: true }).where(eq(ticketsTable.id, id));
  }

  // Get assigned admin name if present
  let assignedAdminName: string | null = null;
  if (ticket.assignedAdminId) {
    const [admin] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, ticket.assignedAdminId));
    assignedAdminName = admin?.name ?? null;
  }

  res.json({ ...ticket, assignedAdminName, messages, notes });
});

// ─── PATCH /api/tickets/:id ──────────────────────────────────────────────────
router.patch("/tickets/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Geçersiz ID" }); return; }

  const userId = req.user!.id;
  const role = req.user!.role;

  const [existing] = await db.select().from(ticketsTable).where(eq(ticketsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Ticket bulunamadı" }); return; }
  if (role !== "admin" && existing.userId !== userId) { res.status(403).json({ error: "Forbidden" }); return; }

  const updates: Record<string, unknown> = {};

  if (role === "admin") {
    const { status, priority, assignedAdminId } = req.body;
    if (status && VALID_STATUSES.includes(status)) {
      updates.status = status;
      if (status === "closed") updates.closedAt = new Date();
      else if (existing.status === "closed") updates.closedAt = null;
    }
    if (priority && VALID_PRIORITIES.includes(priority)) updates.priority = priority;
    if (assignedAdminId !== undefined) {
      updates.assignedAdminId = assignedAdminId ? parseInt(assignedAdminId, 10) : null;
    }
  } else {
    // User can only reopen a closed ticket
    const { status } = req.body;
    if (status === "open" && (existing.status === "closed" || existing.status === "resolved")) {
      updates.status = "open";
      updates.closedAt = null;
      updates.isReadByAdmin = false;
    } else {
      res.status(403).json({ error: "Bu işlem için yetkiniz yok" });
      return;
    }
  }

  if (Object.keys(updates).length === 0) {
    res.json(existing);
    return;
  }

  const [updated] = await db.update(ticketsTable).set(updates as any).where(eq(ticketsTable.id, id)).returning();
  res.json(updated);
});

// ─── POST /api/tickets/:id/messages ─────────────────────────────────────────
router.post("/tickets/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Geçersiz ID" }); return; }

  const userId = req.user!.id;
  const role = req.user!.role;

  const message = validateStr(req.body.message);
  if (!message) { res.status(400).json({ error: "Mesaj gerekli" }); return; }

  const [ticket] = await db.select().from(ticketsTable).where(eq(ticketsTable.id, id));
  if (!ticket) { res.status(404).json({ error: "Ticket bulunamadı" }); return; }
  if (role !== "admin" && ticket.userId !== userId) { res.status(403).json({ error: "Forbidden" }); return; }

  if (ticket.status === "closed") {
    res.status(400).json({ error: "Kapalı ticketa mesaj gönderilemez" });
    return;
  }

  const [msg] = await db.insert(ticketMessagesTable).values({
    ticketId: id,
    senderId: userId,
    senderRole: role === "admin" ? "admin" : "user",
    message,
  }).returning();

  // Update ticket read/status
  const ticketUpdates: Record<string, unknown> = {};
  if (role === "admin") {
    ticketUpdates.isReadByUser = false;
    if (req.body.updateStatus && VALID_STATUSES.includes(req.body.updateStatus)) {
      ticketUpdates.status = req.body.updateStatus;
    }
  } else {
    ticketUpdates.isReadByAdmin = false;
    if (ticket.status === "waiting_user" || ticket.status === "resolved") {
      ticketUpdates.status = "open";
    }
  }
  await db.update(ticketsTable).set(ticketUpdates).where(eq(ticketsTable.id, id));

  res.status(201).json(msg);
});

// ─── POST /api/tickets/:id/notes ─────────────────────────────────────────────
router.post("/tickets/:id/notes", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Geçersiz ID" }); return; }

  const note = validateStr(req.body.note);
  if (!note) { res.status(400).json({ error: "Not gerekli" }); return; }

  const [ticket] = await db.select().from(ticketsTable).where(eq(ticketsTable.id, id));
  if (!ticket) { res.status(404).json({ error: "Ticket bulunamadı" }); return; }

  const [created] = await db.insert(ticketInternalNotesTable).values({
    ticketId: id,
    adminId: req.user!.id,
    note,
  }).returning();

  res.status(201).json(created);
});

// ─── GET /api/tickets/admins ─────────────────────────────────────────────────
router.get("/ticket-admins", requireAdmin, async (_req, res): Promise<void> => {
  const admins = await db
    .select({ id: usersTable.id, name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.role, "admin"));
  res.json(admins);
});

export default router;
