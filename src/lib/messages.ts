import type { Message, MessageThread } from "../types";

/** Stable id for a conversation, whether it is with a person or a business. */
export function threadKey(thread: MessageThread): string {
  return thread.personId ? `p:${thread.personId}` : `b:${thread.businessId}`;
}

export function threadKeyOf(message: Message): string {
  return message.personId ? `p:${message.personId}` : `b:${message.businessId}`;
}

/**
 * Conversations with something arrived since the last time they were opened.
 *
 * Only messages from the other side count: your own reply must never light up
 * your own badge.
 */
export function unreadThreadKeys(
  messages: Message[],
  reads: Record<string, string> = {}
): string[] {
  const unread = new Set<string>();
  for (const message of messages) {
    if (message.sender !== "them") continue;
    const key = threadKeyOf(message);
    const readAt = reads[key];
    if (!readAt || readAt < message.timestamp) unread.add(key);
  }
  return [...unread];
}

export function unreadCount(
  messages: Message[],
  reads: Record<string, string> = {}
): number {
  return unreadThreadKeys(messages, reads).length;
}
