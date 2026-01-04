import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

// Helper to get authenticated user ID or throw
async function getAuthenticatedUserId(ctx: { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }
  return identity.subject;
}

export const schedule = mutation({
  args: {
    userId: v.string(),
    message: v.string(),
    scheduledFor: v.number(),
  },
  handler: async (ctx, { userId, message, scheduledFor }) => {
    const authenticatedUserId = await getAuthenticatedUserId(ctx);
    if (authenticatedUserId !== userId) {
      throw new Error("Unauthorized: Cannot schedule message for other user");
    }

    const now = Date.now();

    // Create the scheduled message record
    const id = await ctx.db.insert("scheduledMessages", {
      userId,
      message,
      scheduledFor,
      sent: false,
      createdAt: now,
    });

    // Schedule the trigger function
    const scheduledFunctionId = await ctx.scheduler.runAt(
      scheduledFor,
      internal.scheduledMessages.trigger,
      { id }
    );

    // Store the scheduled function ID so we can cancel if needed
    await ctx.db.patch(id, { scheduledFunctionId });

    return id;
  },
});

export const cancel = mutation({
  args: { id: v.id("scheduledMessages") },
  handler: async (ctx, { id }) => {
    const authenticatedUserId = await getAuthenticatedUserId(ctx);
    const msg = await ctx.db.get(id);
    if (!msg) throw new Error("Scheduled message not found");
    if (msg.userId !== authenticatedUserId) {
      throw new Error("Unauthorized: Cannot cancel other user's scheduled message");
    }
    if (msg.sent) throw new Error("Message already sent");

    // Cancel the scheduled function if it exists
    if (msg.scheduledFunctionId) {
      await ctx.scheduler.cancel(msg.scheduledFunctionId);
    }

    // Delete the record
    await ctx.db.delete(id);
  },
});

export const list = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const authenticatedUserId = await getAuthenticatedUserId(ctx);
    if (authenticatedUserId !== userId) {
      throw new Error("Unauthorized: Cannot list other user's scheduled messages");
    }

    return await ctx.db
      .query("scheduledMessages")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("sent"), false))
      .order("asc")
      .collect();
  },
});

export const trigger = internalMutation({
  args: { id: v.id("scheduledMessages") },
  handler: async (ctx, { id }) => {
    const msg = await ctx.db.get(id);
    if (!msg || msg.sent) return;

    const now = Date.now();

    // Create a new conversation
    const conversationId = await ctx.db.insert("conversations", {
      userId: msg.userId,
      title: msg.message.slice(0, 50),
      createdAt: now,
      updatedAt: now,
    });

    // Add the agent's message
    await ctx.db.insert("messages", {
      conversationId,
      role: "assistant",
      parts: [{ type: "text", text: msg.message }],
      createdAt: now,
    });

    // Mark as sent and store the conversation ID
    await ctx.db.patch(id, {
      sent: true,
      conversationId,
    });
  },
});
