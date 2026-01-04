import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { messagePart } from "./schema";

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
    // Verify the requesting user matches the userId parameter
    const authenticatedUserId = await getAuthenticatedUserId(ctx);
    if (authenticatedUserId !== userId) {
      throw new Error("Unauthorized: Cannot access other user's conversations");
    }

    return await ctx.db
      .query("conversations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const create = mutation({
  args: { userId: v.string(), title: v.optional(v.string()) },
  handler: async (ctx, { userId, title }) => {
    // Verify the requesting user matches the userId parameter
    const authenticatedUserId = await getAuthenticatedUserId(ctx);
    if (authenticatedUserId !== userId) {
      throw new Error("Unauthorized: Cannot create conversation for other user");
    }

    const now = Date.now();
    return await ctx.db.insert("conversations", {
      userId,
      title,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getMessages = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    // Verify the user owns this conversation
    const authenticatedUserId = await getAuthenticatedUserId(ctx);
    const conversation = await ctx.db.get(conversationId);
    if (!conversation || conversation.userId !== authenticatedUserId) {
      throw new Error("Unauthorized: Cannot access this conversation");
    }

    return await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .order("asc")
      .collect();
  },
});

export const addMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    role: v.string(),
    parts: v.array(messagePart),
  },
  handler: async (ctx, { conversationId, role, parts }) => {
    // Verify the user owns this conversation
    const authenticatedUserId = await getAuthenticatedUserId(ctx);
    const conversation = await ctx.db.get(conversationId);
    if (!conversation || conversation.userId !== authenticatedUserId) {
      throw new Error("Unauthorized: Cannot add message to this conversation");
    }

    const now = Date.now();

    await ctx.db.patch(conversationId, { updatedAt: now });

    return await ctx.db.insert("messages", {
      conversationId,
      role,
      parts,
      createdAt: now,
    });
  },
});

export const updateTitle = mutation({
  args: { conversationId: v.id("conversations"), title: v.string() },
  handler: async (ctx, { conversationId, title }) => {
    // Verify the user owns this conversation
    const authenticatedUserId = await getAuthenticatedUserId(ctx);
    const conversation = await ctx.db.get(conversationId);
    if (!conversation || conversation.userId !== authenticatedUserId) {
      throw new Error("Unauthorized: Cannot update this conversation");
    }

    await ctx.db.patch(conversationId, { title, updatedAt: Date.now() });
  },
});
