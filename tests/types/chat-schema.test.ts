import { describe, expect, it } from "vitest";
import { ChatMessageHistorySchema, ChatRequestSchema } from "../../src/types/chat";

describe("ChatRequestSchema & Multi-Turn History Validation (Spec 07)", () => {
  it("validates compliant single-turn request", () => {
    const payload = {
      query: "What is the flood definition?",
      conversationId: "550e8400-e29b-41d4-a716-446655440000",
    };
    const parsed = ChatRequestSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.query).toBe("What is the flood definition?");
      expect(parsed.data.history).toBeUndefined();
    }
  });

  it("validates multi-turn request with up to 4 history messages", () => {
    const payload = {
      query: "Does it cover temporary accommodation?",
      conversationId: "550e8400-e29b-41d4-a716-446655440000",
      history: [
        { role: "user", content: "What does Suncorp home insurance cover for storms?" },
        { role: "assistant", content: "Suncorp covers storm damage subject to terms." },
        { role: "user", content: "What if the house becomes uninhabitable?" },
        { role: "assistant", content: "Temporary accommodation may be provided." },
      ],
    };
    const parsed = ChatRequestSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.history).toHaveLength(4);
    }
  });

  it("rejects history exceeding 4 messages to preserve edge memory limits", () => {
    const payload = {
      query: "Follow-up question",
      conversationId: "550e8400-e29b-41d4-a716-446655440000",
      history: [
        { role: "user", content: "Turn 1" },
        { role: "assistant", content: "Turn 2" },
        { role: "user", content: "Turn 3" },
        { role: "assistant", content: "Turn 4" },
        { role: "user", content: "Turn 5" },
      ],
    };
    const parsed = ChatRequestSchema.safeParse(payload);
    expect(parsed.success).toBe(false);
  });

  it("rejects history message exceeding 1000 characters", () => {
    const payload = {
      query: "Follow-up",
      conversationId: "550e8400-e29b-41d4-a716-446655440000",
      history: [{ role: "user", content: "A".repeat(1001) }],
    };
    const parsed = ChatRequestSchema.safeParse(payload);
    expect(parsed.success).toBe(false);
  });

  it("allows minimum query of 2 characters", () => {
    const payload = {
      query: "Hi",
      conversationId: "550e8400-e29b-41d4-a716-446655440000",
    };
    const parsed = ChatRequestSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });
});
