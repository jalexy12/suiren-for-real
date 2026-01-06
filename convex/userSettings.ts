import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const get = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
  },
});

export const upsert = mutation({
  args: {
    userId: v.string(),
    linearApiKey: v.optional(v.string()),
    linearDefaultTeamId: v.optional(v.string()),
    linearAgentProjectId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, ...updates } = args;

    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    // Filter out undefined values
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...filteredUpdates,
        updatedAt: Date.now(),
      });
      return existing._id;
    } else {
      return await ctx.db.insert("userSettings", {
        userId,
        ...filteredUpdates,
        updatedAt: Date.now(),
      });
    }
  },
});

export const removeLinearKey = mutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        linearApiKey: undefined,
        linearDefaultTeamId: undefined,
        linearAgentProjectId: undefined,
        updatedAt: Date.now(),
      });
    }
  },
});
