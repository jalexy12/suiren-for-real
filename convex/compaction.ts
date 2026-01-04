import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

// Helper to get authenticated user ID or throw
async function getAuthenticatedUserId(ctx: { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }
  return identity.subject;
}

/**
 * Archive messages and create a summary message
 * Called from the frontend when compaction occurs
 */
export const archiveMessages = mutation({
  args: {
    conversationId: v.id("conversations"),
    messageIdsToArchive: v.array(v.id("messages")),
    summaryText: v.string(),
    tokensSaved: v.number(),
  },
  handler: async (ctx, args) => {
    // Verify the user owns this conversation
    const authenticatedUserId = await getAuthenticatedUserId(ctx);
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== authenticatedUserId) {
      throw new Error("Unauthorized: Cannot archive messages in this conversation");
    }

    const compactionId = `compact-${Date.now()}`;
    const now = Date.now();

    // 1. Fetch original messages
    const originalMessages: Array<{
      role: string;
      parts: Doc<"messages">["parts"];
      createdAt: number;
    }> = [];
    for (const msgId of args.messageIdsToArchive) {
      const msg = await ctx.db.get(msgId);
      if (msg) {
        originalMessages.push({
          role: msg.role,
          parts: msg.parts,
          createdAt: msg.createdAt,
        });
      }
    }

    // 2. Create archive record
    await ctx.db.insert("messageArchives", {
      conversationId: args.conversationId,
      compactionId,
      originalMessages,
      summaryText: args.summaryText,
      tokensSaved: args.tokensSaved,
      createdAt: now,
    });

    // 3. Delete archived messages
    for (const msgId of args.messageIdsToArchive) {
      await ctx.db.delete(msgId);
    }

    // 4. Insert summary message
    await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      role: "assistant",
      parts: [{ type: "text", text: args.summaryText }],
      createdAt: now,
      isSummary: true,
      compactionId,
    });

    // 5. Update conversation timestamp
    await ctx.db.patch(args.conversationId, { updatedAt: now });

    return { compactionId, messageCount: originalMessages.length };
  },
});

/**
 * Get archived messages for a specific compaction
 */
export const getArchivedMessages = query({
  args: { compactionId: v.string(), conversationId: v.id("conversations") },
  handler: async (ctx, { compactionId, conversationId }) => {
    // Verify the user owns this conversation
    const authenticatedUserId = await getAuthenticatedUserId(ctx);
    const conversation = await ctx.db.get(conversationId);
    if (!conversation || conversation.userId !== authenticatedUserId) {
      throw new Error("Unauthorized: Cannot access archived messages");
    }

    const archive = await ctx.db
      .query("messageArchives")
      .filter((q) => q.eq(q.field("compactionId"), compactionId))
      .first();
    return archive?.originalMessages ?? [];
  },
});

/**
 * Get compaction history for a conversation
 */
export const getCompactionHistory = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    // Verify the user owns this conversation
    const authenticatedUserId = await getAuthenticatedUserId(ctx);
    const conversation = await ctx.db.get(conversationId);
    if (!conversation || conversation.userId !== authenticatedUserId) {
      throw new Error("Unauthorized: Cannot access compaction history");
    }

    return await ctx.db
      .query("messageArchives")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", conversationId)
      )
      .order("desc")
      .collect();
  },
});
