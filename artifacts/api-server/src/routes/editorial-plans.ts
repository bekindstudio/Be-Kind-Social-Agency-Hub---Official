import { Router, type IRouter } from "express";
import { eq, and, desc, asc, sql, isNull } from "drizzle-orm";
import {
  db,
  editorialPlansTable,
  editorialSlotsTable,
  contentCategoriesTable,
  slotCommentsTable,
  editorialTemplatesTable,
  clientsTable,
} from "@workspace/db";
import { getUserId, isEnvAdmin, getAccessibleClientIds } from "../lib/access-control";
import { softDeleteRecord } from "../lib/trash-service";

const router: IRouter = Router();

function serializePlan(p: any) {
  return {
    ...p,
    platformsJson: typeof p.platformsJson === "string" ? JSON.parse(p.platformsJson) : p.platformsJson,
    createdAt: p.createdAt?.toISOString?.() ?? p.createdAt,
    updatedAt: p.updatedAt?.toISOString?.() ?? p.updatedAt,
    approvedAt: p.approvedAt?.toISOString?.() ?? null,
    sentToClientAt: p.sentToClientAt?.toISOString?.() ?? null,
    confirmedByClientAt: p.confirmedByClientAt?.toISOString?.() ?? null,
  };
}

function serializeSlot(s: any) {
  return {
    ...s,
    hashtagsJson: typeof s.hashtagsJson === "string" ? JSON.parse(s.hashtagsJson) : s.hashtagsJson,
    createdAt: s.createdAt?.toISOString?.() ?? s.createdAt,
    updatedAt: s.updatedAt?.toISOString?.() ?? s.updatedAt,
  };
}

router.get("/editorial-plans", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  let plans = await db
    .select({
      plan: editorialPlansTable,
      clientName: clientsTable.name,
      clientColor: clientsTable.color,
    })
    .from(editorialPlansTable)
    .leftJoin(clientsTable, eq(editorialPlansTable.clientId, clientsTable.id))
    .where(isNull(editorialPlansTable.deletedAt))
    .orderBy(desc(editorialPlansTable.updatedAt));

  if (userId && !isEnvAdmin(userId)) {
    const accessible = await getAccessibleClientIds(userId);
    if (accessible !== "all") {
      plans = plans.filter((p) => accessible.includes(p.plan.clientId));
    }
  }

  const slotsCount = await db
    .select({
      planId: editorialSlotsTable.planId,
      total: sql<number>`count(*)`.as("total"),
    })
    .from(editorialSlotsTable)
    .where(isNull(editorialSlotsTable.deletedAt))
    .groupBy(editorialSlotsTable.planId);

  const countsMap = new Map(slotsCount.map((s) => [s.planId, Number(s.total)]));

  res.json(
    plans.map((p) => ({
      ...serializePlan(p.plan),
      clientName: p.clientName,
      clientColor: p.clientColor,
      totalSlots: countsMap.get(p.plan.id) ?? 0,
    }))
  );
});

router.get("/editorial-plans/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }

  const [row] = await db
    .select({
      plan: editorialPlansTable,
      clientName: clientsTable.name,
      clientColor: clientsTable.color,
      clientLogo: clientsTable.logoUrl,
    })
    .from(editorialPlansTable)
    .leftJoin(clientsTable, eq(editorialPlansTable.clientId, clientsTable.id))
    .where(and(eq(editorialPlansTable.id, id), isNull(editorialPlansTable.deletedAt)));

  if (!row) { res.status(404).json({ error: "Piano non trovato" }); return; }

  const userId = getUserId(req);
  if (userId && !isEnvAdmin(userId)) {
    const accessible = await getAccessibleClientIds(userId);
    if (accessible !== "all" && !accessible.includes(row.plan.clientId)) {
      res.status(403).json({ error: "Accesso negato" }); return;
    }
  }

  const slots = await db
    .select()
    .from(editorialSlotsTable)
    .where(and(eq(editorialSlotsTable.planId, id), isNull(editorialSlotsTable.deletedAt)))
    .orderBy(asc(editorialSlotsTable.position), asc(editorialSlotsTable.publishDate));

  res.json({
    ...serializePlan(row.plan),
    clientName: row.clientName,
    clientColor: row.clientColor,
    clientLogo: row.clientLogo,
    slots: slots.map(serializeSlot),
  });
});

router.post("/editorial-plans", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const { clientId, month, year, platformsJson, packageType, notesInternal, templateId } = req.body;

  if (!clientId || !month || !year) {
    res.status(400).json({ error: "clientId, month e year sono obbligatori" });
    return;
  }

  // TRANSACTION: operazioni atomiche su editorial_plans, editorial_slots
  // Se una fallisce, tutte le modifiche vengono annullate
  const created = await db.transaction(async (tx) => {
    const [plan] = await tx
      .insert(editorialPlansTable)
      .values({
        clientId: Number(clientId),
        month: Number(month),
        year: Number(year),
        platformsJson: platformsJson ?? [],
        packageType: packageType ?? "standard",
        notesInternal: notesInternal ?? null,
        createdBy: userId,
      })
      .returning();

    if (templateId) {
      const [template] = await tx
        .select()
        .from(editorialTemplatesTable)
        .where(and(eq(editorialTemplatesTable.id, Number(templateId)), isNull(editorialTemplatesTable.deletedAt)));
      if (template && Array.isArray(template.slotsJson)) {
        const templateSlots = template.slotsJson as any[];
        const daysInMonth = new Date(Number(year), Number(month), 0).getDate();
        for (let i = 0; i < templateSlots.length; i++) {
          const ts = templateSlots[i];
          const day = Math.min(ts.publishDay ?? (i + 1) * Math.floor(daysInMonth / templateSlots.length), daysInMonth);
          const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          await tx.insert(editorialSlotsTable).values({
            planId: plan.id,
            platform: ts.platform ?? "instagram_feed",
            contentType: ts.contentType ?? "post",
            categoryId: ts.categoryId ?? null,
            publishDate: dateStr,
            publishTime: ts.publishTime ?? null,
            title: ts.title ?? null,
            caption: ts.caption ?? null,
            hashtagsJson: ts.hashtagsJson ?? [],
            callToAction: ts.callToAction ?? null,
            status: "da_creare",
            position: i,
            createdBy: userId,
          });
        }
      }
    } else {
      const platforms = Array.isArray(platformsJson) && platformsJson.length > 0 ? platformsJson : ["instagram_feed"];
      const countMap: Record<string, number> = { base: 4, standard: 8, premium: 12 };
      const totalPosts = countMap[packageType ?? "standard"] ?? 8;
      const daysInMonth = new Date(Number(year), Number(month), 0).getDate();

      const perPlatform = Math.floor(totalPosts / platforms.length);
      const remainder = totalPosts % platforms.length;

      let pos = 0;
      for (let pIdx = 0; pIdx < platforms.length; pIdx++) {
        const platform = platforms[pIdx];
        const count = perPlatform + (pIdx < remainder ? 1 : 0);
        for (let i = 0; i < count; i++) {
          const day = Math.min(Math.round((i + 1) * (daysInMonth / count)), daysInMonth);
          const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const contentType = platform.includes("reel") || platform === "tiktok" || platform === "youtube_shorts" ? "reel" : platform.includes("stor") ? "story" : "post";
          await tx.insert(editorialSlotsTable).values({
            planId: plan.id,
            platform,
            contentType,
            publishDate: dateStr,
            status: "da_creare",
            position: pos++,
            createdBy: userId,
          });
        }
      }
    }

    const slots = await tx
      .select()
      .from(editorialSlotsTable)
      .where(and(eq(editorialSlotsTable.planId, plan.id), isNull(editorialSlotsTable.deletedAt)))
      .orderBy(asc(editorialSlotsTable.position));

    return { plan, slots };
  });

  res.status(201).json({ ...serializePlan(created.plan), slots: created.slots.map(serializeSlot) });
});

router.patch("/editorial-plans/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }

  const [existing] = await db
    .select()
    .from(editorialPlansTable)
    .where(and(eq(editorialPlansTable.id, id), isNull(editorialPlansTable.deletedAt)));
  if (!existing) { res.status(404).json({ error: "Piano non trovato" }); return; }

  const userId = getUserId(req);
  if (userId && !isEnvAdmin(userId)) {
    const accessible = await getAccessibleClientIds(userId);
    if (accessible !== "all" && !accessible.includes(existing.clientId)) {
      res.status(403).json({ error: "Accesso negato" }); return;
    }
  }

  const { status, notesInternal, approvedBy, platformsJson, packageType } = req.body;
  const validStatuses = ["bozza", "in_revisione", "approvato", "inviato_al_cliente", "confermato"];
  if (status !== undefined && !validStatuses.includes(status)) {
    res.status(400).json({ error: "Stato non valido" }); return;
  }
  const updates: any = {};
  if (status !== undefined) updates.status = status;
  if (notesInternal !== undefined) updates.notesInternal = notesInternal;
  if (platformsJson !== undefined) updates.platformsJson = platformsJson;
  if (packageType !== undefined) updates.packageType = packageType;
  if (status === "approvato") {
    updates.approvedBy = approvedBy ?? getUserId(req);
    updates.approvedAt = new Date();
  }
  if (status === "inviato_al_cliente") updates.sentToClientAt = new Date();
  if (status === "confermato") updates.confirmedByClientAt = new Date();

  const [updated] = await db.update(editorialPlansTable).set(updates).where(eq(editorialPlansTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Piano non trovato" }); return; }
  res.json(serializePlan(updated));
});

router.delete("/editorial-plans/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }

  const [existing] = await db
    .select()
    .from(editorialPlansTable)
    .where(and(eq(editorialPlansTable.id, id), isNull(editorialPlansTable.deletedAt)));
  if (!existing) { res.status(404).json({ error: "Piano non trovato" }); return; }

  const userId = getUserId(req);
  if (userId && !isEnvAdmin(userId)) {
    const accessible = await getAccessibleClientIds(userId);
    if (accessible !== "all" && !accessible.includes(existing.clientId)) {
      res.status(403).json({ error: "Accesso negato" }); return;
    }
  }

  const r = await softDeleteRecord("editorial_plans", String(id), { deletedBy: userId });
  if (!r.ok) {
    res.status(400).json({ error: r.error });
    return;
  }
  res.json({ ok: true, trashLogId: r.trashLogId, message: "Spostato nel cestino" });
});

router.post("/editorial-plans/:id/duplicate", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const userId = getUserId(req);
  const { clientId, month, year } = req.body;

  const [original] = await db
    .select()
    .from(editorialPlansTable)
    .where(and(eq(editorialPlansTable.id, id), isNull(editorialPlansTable.deletedAt)));
  if (!original) { res.status(404).json({ error: "Piano non trovato" }); return; }

  if (userId && !isEnvAdmin(userId)) {
    const accessible = await getAccessibleClientIds(userId);
    if (accessible !== "all" && !accessible.includes(original.clientId)) {
      res.status(403).json({ error: "Accesso negato" }); return;
    }
  }

  const newMonth = month ?? original.month;
  const newYear = year ?? original.year;

  // TRANSACTION: operazioni atomiche su editorial_plans, editorial_slots
  // Se una fallisce, tutte le modifiche vengono annullate
  const duplicated = await db.transaction(async (tx) => {
    const [newPlan] = await tx.insert(editorialPlansTable).values({
      clientId: clientId ?? original.clientId,
      month: Number(newMonth),
      year: Number(newYear),
      platformsJson: original.platformsJson,
      packageType: original.packageType,
      notesInternal: original.notesInternal,
      status: "bozza",
      createdBy: userId,
    }).returning();

    const originalSlots = await tx
      .select()
      .from(editorialSlotsTable)
      .where(and(eq(editorialSlotsTable.planId, id), isNull(editorialSlotsTable.deletedAt)))
      .orderBy(asc(editorialSlotsTable.position));

    for (const slot of originalSlots) {
      let newDate = slot.publishDate;
      if (newDate && (newMonth !== original.month || newYear !== original.year)) {
        const d = new Date(newDate);
        const day = Math.min(d.getDate(), new Date(Number(newYear), Number(newMonth), 0).getDate());
        newDate = `${newYear}-${String(newMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
      await tx.insert(editorialSlotsTable).values({
        planId: newPlan.id,
        platform: slot.platform,
        contentType: slot.contentType,
        categoryId: slot.categoryId,
        publishDate: newDate,
        publishTime: slot.publishTime,
        title: slot.title,
        caption: slot.caption,
        hashtagsJson: slot.hashtagsJson,
        callToAction: slot.callToAction,
        linkInBio: slot.linkInBio,
        visualUrl: slot.visualUrl,
        visualDescription: slot.visualDescription,
        notesInternal: slot.notesInternal,
        notesClient: slot.notesClient,
        status: "da_creare",
        position: slot.position,
        createdBy: userId,
      });
    }

    const slots = await tx
      .select()
      .from(editorialSlotsTable)
      .where(and(eq(editorialSlotsTable.planId, newPlan.id), isNull(editorialSlotsTable.deletedAt)))
      .orderBy(asc(editorialSlotsTable.position));

    return { newPlan, slots };
  });

  res.status(201).json({ ...serializePlan(duplicated.newPlan), slots: duplicated.slots.map(serializeSlot) });
});

router.post("/editorial-slots", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const { planId, platform, contentType, categoryId, publishDate, publishTime, title, caption, hashtagsJson, callToAction, linkInBio, visualUrl, visualDescription, notesInternal, notesClient, status, position } = req.body;

  if (!planId || !platform) { res.status(400).json({ error: "planId e platform obbligatori" }); return; }

  const [planOk] = await db
    .select()
    .from(editorialPlansTable)
    .where(and(eq(editorialPlansTable.id, Number(planId)), isNull(editorialPlansTable.deletedAt)));
  if (!planOk) { res.status(400).json({ error: "Piano non trovato o nel cestino" }); return; }

  const [slot] = await db.insert(editorialSlotsTable).values({
    planId: Number(planId),
    platform,
    contentType: contentType ?? "post",
    categoryId: categoryId ? Number(categoryId) : null,
    publishDate: publishDate ?? null,
    publishTime: publishTime ?? null,
    title: title ?? null,
    caption: caption ?? null,
    hashtagsJson: hashtagsJson ?? [],
    callToAction: callToAction ?? null,
    linkInBio: linkInBio ?? null,
    visualUrl: visualUrl ?? null,
    visualDescription: visualDescription ?? null,
    notesInternal: notesInternal ?? null,
    notesClient: notesClient ?? null,
    status: status ?? "da_creare",
    position: position ?? 0,
    createdBy: userId,
  }).returning();

  res.status(201).json(serializeSlot(slot));
});

router.patch("/editorial-slots/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }

  const allowedFields = ["platform", "contentType", "categoryId", "publishDate", "publishTime", "title", "caption", "hashtagsJson", "callToAction", "linkInBio", "visualUrl", "visualDescription", "notesInternal", "notesClient", "status", "position"];
  const updates: any = {};
  for (const key of allowedFields) {
    if (req.body[key] !== undefined) {
      if (key === "categoryId") {
        updates[key] = req.body[key] ? Number(req.body[key]) : null;
      } else {
        updates[key] = req.body[key];
      }
    }
  }

  const [slotEx] = await db
    .select()
    .from(editorialSlotsTable)
    .where(and(eq(editorialSlotsTable.id, id), isNull(editorialSlotsTable.deletedAt)));
  if (!slotEx) { res.status(404).json({ error: "Slot non trovato" }); return; }

  const [updated] = await db.update(editorialSlotsTable).set(updates).where(eq(editorialSlotsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Slot non trovato" }); return; }
  res.json(serializeSlot(updated));
});

router.delete("/editorial-slots/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }
  const userId = getUserId(req);
  const r = await softDeleteRecord("editorial_slots", String(id), { deletedBy: userId });
  if (!r.ok) {
    res.status(r.error === "Non trovato" ? 404 : 400).json({ error: r.error });
    return;
  }
  res.json({ ok: true, trashLogId: r.trashLogId, message: "Spostato nel cestino" });
});

router.get("/content-categories", async (req, res): Promise<void> => {
  const clientId = req.query.clientId ? Number(req.query.clientId) : null;
  let categories;
  if (clientId) {
    categories = await db
      .select()
      .from(contentCategoriesTable)
      .where(
        and(
          isNull(contentCategoriesTable.deletedAt),
          sql`${contentCategoriesTable.clientId} IS NULL OR ${contentCategoriesTable.clientId} = ${clientId}`,
        ),
      )
      .orderBy(asc(contentCategoriesTable.position));
  } else {
    categories = await db
      .select()
      .from(contentCategoriesTable)
      .where(isNull(contentCategoriesTable.deletedAt))
      .orderBy(asc(contentCategoriesTable.position));
  }
  res.json(categories.map((c) => ({
    ...c,
    createdAt: c.createdAt?.toISOString?.() ?? c.createdAt,
    updatedAt: c.updatedAt?.toISOString?.() ?? c.updatedAt,
  })));
});

router.post("/content-categories", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const { name, color, icon, description, clientId, position } = req.body;
  if (!name) { res.status(400).json({ error: "Nome obbligatorio" }); return; }

  const [cat] = await db.insert(contentCategoriesTable).values({
    name, color: color ?? "#7a8f5c", icon: icon ?? "Tag", description: description ?? null,
    clientId: clientId ? Number(clientId) : null, position: position ?? 0, createdBy: userId,
  }).returning();
  res.status(201).json(cat);
});

router.patch("/content-categories/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }
  const updates: any = {};
  for (const key of ["name", "color", "icon", "description", "clientId", "position"]) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  const [catEx] = await db
    .select()
    .from(contentCategoriesTable)
    .where(and(eq(contentCategoriesTable.id, id), isNull(contentCategoriesTable.deletedAt)));
  if (!catEx) { res.status(404).json({ error: "Categoria non trovata" }); return; }

  const [updated] = await db.update(contentCategoriesTable).set(updates).where(eq(contentCategoriesTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Categoria non trovata" }); return; }
  res.json(updated);
});

router.delete("/content-categories/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }
  const userId = getUserId(req);
  const r = await softDeleteRecord("content_categories", String(id), { deletedBy: userId });
  if (!r.ok) {
    res.status(r.error === "Non trovato" ? 404 : 400).json({ error: r.error });
    return;
  }
  res.json({ ok: true, trashLogId: r.trashLogId, message: "Spostato nel cestino" });
});

router.get("/slot-comments/:slotId", async (req, res): Promise<void> => {
  const slotId = Number(req.params.slotId);
  if (isNaN(slotId)) { res.status(400).json({ error: "slotId non valido" }); return; }
  const comments = await db.select().from(slotCommentsTable).where(eq(slotCommentsTable.slotId, slotId)).orderBy(asc(slotCommentsTable.createdAt));
  res.json(comments.map((c) => ({ ...c, createdAt: c.createdAt?.toISOString?.() ?? c.createdAt })));
});

router.post("/slot-comments", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const { slotId, content } = req.body;
  if (!slotId || !content) { res.status(400).json({ error: "slotId e content obbligatori" }); return; }
  const [comment] = await db.insert(slotCommentsTable).values({
    slotId: Number(slotId), authorId: userId ?? "unknown", content,
  }).returning();
  res.status(201).json(comment);
});

router.patch("/slot-comments/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }
  const updates: any = {};
  if (req.body.content !== undefined) updates.content = req.body.content;
  if (req.body.isResolved !== undefined) updates.isResolved = req.body.isResolved;
  const [updated] = await db.update(slotCommentsTable).set(updates).where(eq(slotCommentsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Commento non trovato" }); return; }
  res.json(updated);
});

router.get("/editorial-templates", async (_req, res): Promise<void> => {
  const templates = await db
    .select()
    .from(editorialTemplatesTable)
    .where(isNull(editorialTemplatesTable.deletedAt))
    .orderBy(desc(editorialTemplatesTable.isSystem), asc(editorialTemplatesTable.name));
  res.json(templates.map((t) => ({
    ...t,
    slotsJson: typeof t.slotsJson === "string" ? JSON.parse(t.slotsJson) : t.slotsJson,
    createdAt: t.createdAt?.toISOString?.() ?? t.createdAt,
  })));
});

router.post("/editorial-templates", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const { name, description, packageType, slotsJson, isSystem } = req.body;
  if (!name) { res.status(400).json({ error: "Nome obbligatorio" }); return; }
  const [template] = await db.insert(editorialTemplatesTable).values({
    name, description: description ?? null, packageType: packageType ?? "standard",
    slotsJson: slotsJson ?? [], createdBy: userId, isSystem: isSystem ?? false,
  }).returning();
  res.status(201).json(template);
});

router.delete("/editorial-templates/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }
  const userId = getUserId(req);
  const r = await softDeleteRecord("editorial_templates", String(id), { deletedBy: userId });
  if (!r.ok) {
    res.status(r.error === "Non trovato" ? 404 : 400).json({ error: r.error });
    return;
  }
  res.json({ ok: true, trashLogId: r.trashLogId, message: "Spostato nel cestino" });
});

router.post("/editorial-plans/seed-defaults", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId || !isEnvAdmin(userId)) {
    const existingCats = await db.select().from(contentCategoriesTable).where(isNull(contentCategoriesTable.deletedAt));
    const existingTemplates = await db.select().from(editorialTemplatesTable).where(isNull(editorialTemplatesTable.deletedAt));
    if (existingCats.length > 0 && existingTemplates.length > 0) {
      res.json({ success: true, skipped: true }); return;
    }
  }
  const existingCats = await db.select().from(contentCategoriesTable).where(isNull(contentCategoriesTable.deletedAt));
  if (existingCats.length === 0) {
    const defaultCategories = [
      { name: "Prodotto / Servizio", color: "#9333ea", icon: "ShoppingBag", description: "Showcase prodotti o servizi", position: 0 },
      { name: "Educativo / Tips", color: "#3b82f6", icon: "Lightbulb", description: "Contenuti educativi, how-to, consigli", position: 1 },
      { name: "Behind the Scenes", color: "#f59e0b", icon: "Camera", description: "Dietro le quinte, team, processo", position: 2 },
      { name: "User Generated Content", color: "#14b8a6", icon: "Users", description: "Repost, testimonianze, recensioni", position: 3 },
      { name: "Promozione / Offerta", color: "#ef4444", icon: "Percent", description: "Sconti, offerte, promozioni limitate", position: 4 },
      { name: "Brand Awareness", color: "#ec4899", icon: "Heart", description: "Valori del brand, mission, storytelling", position: 5 },
      { name: "Evento", color: "#f97316", icon: "Calendar", description: "Eventi, lanci, annunci", position: 6 },
      { name: "Stagionale / Ricorrenza", color: "#22c55e", icon: "Sun", description: "Contenuti stagionali, festivita, trend", position: 7 },
      { name: "Campagna Specifica", color: "#6366f1", icon: "Target", description: "Legata a una campagna ads specifica", position: 8 },
      { name: "Intrattenimento", color: "#f97316", icon: "Smile", description: "Contenuti divertenti, trending, virali", position: 9 },
      { name: "Carosello Informativo", color: "#06b6d4", icon: "Layers", description: "Carosello informativo / slide", position: 10 },
      { name: "Collaborazione", color: "#8b5cf6", icon: "Handshake", description: "Contenuti con influencer o partner", position: 11 },
    ];
    for (const cat of defaultCategories) {
      await db.insert(contentCategoriesTable).values(cat);
    }
  }

  const existingTemplates = await db.select().from(editorialTemplatesTable).where(isNull(editorialTemplatesTable.deletedAt));
  if (existingTemplates.length === 0) {
    await db.insert(editorialTemplatesTable).values({
      name: "Standard Social Media (8 post)",
      description: "8 post al mese con mix bilanciato di contenuti",
      packageType: "standard",
      isSystem: true,
      slotsJson: [
        { platform: "instagram_feed", contentType: "post", publishDay: 2, title: "Post #1" },
        { platform: "instagram_feed", contentType: "carousel", publishDay: 5, title: "Carosello #1" },
        { platform: "instagram_feed", contentType: "post", publishDay: 9, title: "Post #2" },
        { platform: "instagram_reels", contentType: "reel", publishDay: 12, title: "Reel #1" },
        { platform: "instagram_feed", contentType: "post", publishDay: 16, title: "Post #3" },
        { platform: "instagram_feed", contentType: "carousel", publishDay: 19, title: "Carosello #2" },
        { platform: "instagram_reels", contentType: "reel", publishDay: 23, title: "Reel #2" },
        { platform: "instagram_feed", contentType: "post", publishDay: 27, title: "Post #4" },
      ],
    });
    await db.insert(editorialTemplatesTable).values({
      name: "E-commerce Focus (12 post)",
      description: "12 post al mese focalizzati su prodotti e conversioni",
      packageType: "premium",
      isSystem: true,
      slotsJson: [
        { platform: "instagram_feed", contentType: "post", publishDay: 1, title: "Prodotto #1" },
        { platform: "instagram_feed", contentType: "carousel", publishDay: 3, title: "Carosello Prodotti" },
        { platform: "instagram_reels", contentType: "reel", publishDay: 5, title: "Reel Prodotto" },
        { platform: "instagram_feed", contentType: "post", publishDay: 8, title: "UGC / Recensione" },
        { platform: "instagram_feed", contentType: "post", publishDay: 10, title: "Prodotto #2" },
        { platform: "instagram_stories", contentType: "story", publishDay: 12, title: "Promo Story" },
        { platform: "instagram_feed", contentType: "carousel", publishDay: 15, title: "Guida Prodotto" },
        { platform: "instagram_reels", contentType: "reel", publishDay: 18, title: "Behind the Scenes" },
        { platform: "instagram_feed", contentType: "post", publishDay: 20, title: "Prodotto #3" },
        { platform: "facebook_feed", contentType: "post", publishDay: 22, title: "FB Post" },
        { platform: "instagram_feed", contentType: "post", publishDay: 25, title: "Brand Story" },
        { platform: "instagram_feed", contentType: "carousel", publishDay: 28, title: "Recap Mese" },
      ],
    });
  }

  res.json({ success: true });
});

export default router;
