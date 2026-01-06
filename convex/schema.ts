import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// UI Message Part schema - matches AI SDK UIMessagePart types
// Text parts have type: 'text' and text field
// Tool parts have type: 'tool-{name}' or 'dynamic-tool' with input/output/state
// All parts must have a type field, other fields are optional based on part type
export const messagePart = v.object({
  type: v.string(),
  // Text parts
  text: v.optional(v.string()),
  // Tool parts
  toolCallId: v.optional(v.string()),
  toolName: v.optional(v.string()),
  input: v.optional(v.any()), // Tool input can be any JSON
  output: v.optional(v.any()), // Tool output can be any JSON
  state: v.optional(v.string()),
  errorText: v.optional(v.string()),
  // Reasoning parts
  // (uses text field)
  // Source parts
  sourceId: v.optional(v.string()),
  url: v.optional(v.string()),
  title: v.optional(v.string()),
  // File parts
  mediaType: v.optional(v.string()),
  data: v.optional(v.string()),
  // Provider metadata (allow any shape)
  providerMetadata: v.optional(v.any()),
});

export default defineSchema({
  conversations: defineTable({
    userId: v.string(),
    title: v.optional(v.string()),
    // Thread hierarchy
    parentConversationId: v.optional(v.id("conversations")),
    parentMessageId: v.optional(v.id("messages")),
    // Thread workspace path (e.g., "/home/sui/threads/{id}")
    threadPath: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_parent", ["parentConversationId"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    role: v.string(),
    parts: v.array(messagePart),
    createdAt: v.number(),
    // Compaction fields
    isSummary: v.optional(v.boolean()),
    compactionId: v.optional(v.string()),
    // Subthread: forked context messages (in context but hidden from UI)
    isForkedContext: v.optional(v.boolean()),
    // Detached forked context (ignored when processing)
    isDetached: v.optional(v.boolean()),
  }).index("by_conversation", ["conversationId"]),

  // Archive of original messages before compaction
  messageArchives: defineTable({
    conversationId: v.id("conversations"),
    compactionId: v.string(),
    originalMessages: v.array(
      v.object({
        role: v.string(),
        parts: v.array(messagePart),
        createdAt: v.number(),
      })
    ),
    summaryText: v.string(),
    tokensSaved: v.number(),
    createdAt: v.number(),
  }).index("by_conversation", ["conversationId"]),

  scheduledMessages: defineTable({
    userId: v.string(),
    message: v.string(),
    scheduledFor: v.number(),
    scheduledFunctionId: v.optional(v.id("_scheduled_functions")),
    sent: v.boolean(),
    conversationId: v.optional(v.id("conversations")),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  userSettings: defineTable({
    userId: v.string(),
    // Linear integration
    linearApiKey: v.optional(v.string()),
    linearDefaultTeamId: v.optional(v.string()),
    linearAgentProjectId: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),
});
