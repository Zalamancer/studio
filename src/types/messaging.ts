// src/types/messaging.ts
import type { Timestamp, FieldValue } from 'firebase/firestore';

// Represents a conversation between two or more users (as stored in Firestore)
export interface Conversation {
  id: string; // Firestore document ID
  participants: string[]; // Array of user IDs participating in the conversation
  type: 'direct' | 'group'; // Type of conversation
  postId?: string | null; // Optional ID of the post this conversation is about

  // Group-specific fields (optional for direct chats)
  groupName?: string | null;
  groupAvatarUrl?: string | null;
  ownerId: string | null; // UID of the group creator/owner, MUST be set for groups
  adminIds: string[];   // UIDs of group administrators, MUST include owner for groups

  lastMessage: string | null; // Text of the last message sent
  lastMessageTimestamp: Timestamp | FieldValue | null; // Timestamp of the last message (Firestore Timestamp or serverTimestamp)
  createdAt: Timestamp | FieldValue; // When the conversation was created (Firestore Timestamp or serverTimestamp)
  updatedAt: Timestamp | FieldValue; // When the conversation was last updated (Firestore Timestamp or serverTimestamp)
  formerParticipants?: { [userId: string]: Timestamp | FieldValue }; // Map of user IDs to their leave timestamps
}

// Represents a conversation object safe to pass to Client Components (uses number for timestamps)
export interface ClientConversation extends Omit<Conversation, 'lastMessageTimestamp' | 'createdAt' | 'updatedAt' | 'adminIds' | 'formerParticipants'> {
  lastMessageTimestamp: number | null; // Milliseconds since epoch
  createdAt: number; // Milliseconds since epoch
  updatedAt?: number | null; // Milliseconds since epoch
  adminIds: string[]; // Ensure adminIds is present
  // Ensure group fields are here and consistently optional or required
  groupName?: string | null;
  groupAvatarUrl?: string | null;
  ownerId: string | null; // ownerId should be present, can be null for old direct chats
  type: 'direct' | 'group'; // Make type non-optional on client
  formerParticipants?: { [userId: string]: number }; // Milliseconds since epoch for leave times
}


// Represents a single message within a conversation (as stored in Firestore)
export interface Message {
  id: string; // Firestore document ID (within the messages subcollection)
  conversationId: string; // ID of the parent conversation
  senderId: string; // ID of the user who sent the message
  text: string; // The content of the message
  timestamp: Timestamp | FieldValue; // When the message was sent (Firestore Timestamp or serverTimestamp for new)
  read: boolean; // Indicates if the message has been read (by the recipient)
  isBotMessage?: boolean; // Optional: Indicates if the message is from a bot
  replyToMessageId?: string; // Optional: ID of the message this is a reply to
  repliedToTextSnippet?: string; // Optional: A snippet of the text of the message being replied to
}

// Represents a message with a serializable timestamp (e.g., number) for client components
export interface SerializableMessage extends Omit<Message, 'timestamp'> {
  timestamp: number; // Timestamp as milliseconds since epoch
  isBotMessage?: boolean;
}


// Type for data needed to create a new message (uses client-side data, serverTimestamp used in service)
export type NewMessageData = Omit<Message, 'id' | 'timestamp' | 'read'>;

// Type for data needed to create a new conversation
export interface NewConversationData extends Omit<Conversation, 'id' | 'createdAt' | 'lastMessage' | 'lastMessageTimestamp' | 'updatedAt' | 'formerParticipants'> {
  createdAt: FieldValue; // Always set by server
  lastMessage: string | null; // Initialized to null
  lastMessageTimestamp: FieldValue | null; // Initialized to null
  updatedAt: FieldValue; // Always set by server
  // Type will be set based on creation logic
  type: 'direct' | 'group';
  // Group specific fields are required for group type during creation
  groupName: string | null; // Required for group, null for direct
  groupAvatarUrl: string | null;
  ownerId: string | null; // Required for group, null for direct
  adminIds: string[]; // Required for group, empty for direct
  formerParticipants: {}; // Initialize as empty object
}
