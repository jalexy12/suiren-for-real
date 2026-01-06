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

// Create a subthread from a parent conversation
export const createSubthread = mutation({
  args: {
    parentConversationId: v.id("conversations"),
    parentMessageId: v.optional(v.id("messages")),
    title: v.string(),
  },
  handler: async (ctx, { parentConversationId, parentMessageId, title }) => {
    const authenticatedUserId = await getAuthenticatedUserId(ctx);

    // Verify the user owns the parent conversation
    const parentConversation = await ctx.db.get(parentConversationId);
    if (!parentConversation || parentConversation.userId !== authenticatedUserId) {
      throw new Error("Unauthorized: Cannot create subthread for this conversation");
    }

    // Check depth limit (max 3 levels deep)
    let depth = 0;
    let currentParent = parentConversation;
    while (currentParent.parentConversationId) {
      depth++;
      if (depth >= 3) {
        throw new Error("Maximum thread depth reached (3 levels)");
      }
      const nextParent = await ctx.db.get(currentParent.parentConversationId);
      if (!nextParent) break;
      currentParent = nextParent;
    }

    const now = Date.now();

    // Create the subthread conversation (threadPath set after we have ID)
    const subthreadId = await ctx.db.insert("conversations", {
      userId: authenticatedUserId,
      title,
      parentConversationId,
      parentMessageId,
      createdAt: now,
      updatedAt: now,
    });

    // Set thread path now that we have the ID
    const threadPath = `/home/sui/threads/${subthreadId}`;
    await ctx.db.patch(subthreadId, { threadPath });

    // Fork messages from parent into subthread
    const parentMessages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", parentConversationId))
      .order("asc")
      .collect();

    // Copy each message to the subthread, marked as forked context (hidden from UI)
    for (const msg of parentMessages) {
      await ctx.db.insert("messages", {
        conversationId: subthreadId,
        role: msg.role,
        parts: msg.parts,
        createdAt: msg.createdAt,
        isSummary: msg.isSummary,
        compactionId: msg.compactionId,
        isForkedContext: true,
      });
    }

    return {
      subthreadId,
      threadPath,
    };
  },
});

// Get child threads for a conversation
export const getChildren = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const authenticatedUserId = await getAuthenticatedUserId(ctx);

    // Verify the user owns this conversation
    const conversation = await ctx.db.get(conversationId);
    if (!conversation || conversation.userId !== authenticatedUserId) {
      throw new Error("Unauthorized: Cannot access this conversation");
    }

    return await ctx.db
      .query("conversations")
      .withIndex("by_parent", (q) => q.eq("parentConversationId", conversationId))
      .order("desc")
      .collect();
  },
});

// Detach forked context (mark as detached instead of deleting)
export const detachForkedContext = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const authenticatedUserId = await getAuthenticatedUserId(ctx);

    const conversation = await ctx.db.get(conversationId);
    if (!conversation || conversation.userId !== authenticatedUserId) {
      throw new Error("Unauthorized");
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .collect();

    const forkedMessages = messages.filter(m => m.isForkedContext && !m.isDetached);

    for (const msg of forkedMessages) {
      await ctx.db.patch(msg._id, { isDetached: true });
    }

    return { detachedCount: forkedMessages.length };
  },
});

// Get thread context (breadcrumb chain + forked context info)
export const getThreadContext = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const authenticatedUserId = await getAuthenticatedUserId(ctx);

    const conversation = await ctx.db.get(conversationId);
    if (!conversation || conversation.userId !== authenticatedUserId) {
      throw new Error("Unauthorized: Cannot access this conversation");
    }

    // Build the parent chain for breadcrumbs
    const chain: Array<{ _id: string; title: string | undefined }> = [];
    let current = conversation;

    while (current) {
      chain.unshift({ _id: current._id, title: current.title });
      if (!current.parentConversationId) break;
      const parent = await ctx.db.get(current.parentConversationId);
      if (!parent) break;
      current = parent;
    }

    // Get forked context count if this is a subthread
    let forkedContextCount = 0;
    if (conversation.parentConversationId) {
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
        .collect();
      forkedContextCount = messages.filter(m => m.isForkedContext && !m.isDetached).length;
    }

    return {
      conversation,
      breadcrumbs: chain,
      isSubthread: !!conversation.parentConversationId,
      threadPath: conversation.threadPath,
      forkedContextCount,
    };
  },
});
