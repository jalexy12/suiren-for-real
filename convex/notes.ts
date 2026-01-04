import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Helper to get authenticated user ID or throw
async function getAuthenticatedUserId(ctx: { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }
  return identity.subject;
}

export const list = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const authenticatedUserId = await getAuthenticatedUserId(ctx);
    if (authenticatedUserId !== userId) {
      throw new Error("Unauthorized: Cannot access other user's notes");
    }

    return await ctx.db
      .query("notes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { noteId: v.id("notes") },
  handler: async (ctx, { noteId }) => {
    const authenticatedUserId = await getAuthenticatedUserId(ctx);
    const note = await ctx.db.get(noteId);
    if (!note || note.userId !== authenticatedUserId) {
      throw new Error("Unauthorized: Cannot access this note");
    }
    return note;
  },
});

export const create = mutation({
  args: { userId: v.string(), title: v.optional(v.string()) },
  handler: async (ctx, { userId, title }) => {
    const authenticatedUserId = await getAuthenticatedUserId(ctx);
    if (authenticatedUserId !== userId) {
      throw new Error("Unauthorized: Cannot create note for other user");
    }

    const now = Date.now();
    return await ctx.db.insert("notes", {
      userId,
      title: title || "Untitled",
      content: "",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    noteId: v.id("notes"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
  },
  handler: async (ctx, { noteId, title, content }) => {
    const authenticatedUserId = await getAuthenticatedUserId(ctx);
    const note = await ctx.db.get(noteId);
    if (!note || note.userId !== authenticatedUserId) {
      throw new Error("Unauthorized: Cannot update this note");
    }

    const updates: { title?: string; content?: string; updatedAt: number } = {
      updatedAt: Date.now(),
    };
    if (title !== undefined) updates.title = title;
    if (content !== undefined) updates.content = content;
    await ctx.db.patch(noteId, updates);
  },
});

export const remove = mutation({
  args: { noteId: v.id("notes") },
  handler: async (ctx, { noteId }) => {
    const authenticatedUserId = await getAuthenticatedUserId(ctx);
    const note = await ctx.db.get(noteId);
    if (!note || note.userId !== authenticatedUserId) {
      throw new Error("Unauthorized: Cannot delete this note");
    }

    await ctx.db.delete(noteId);
  },
});
