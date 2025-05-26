// src/types/messaging.ts
import type { Timestamp } from 'firebase/firestore';

// Represents a conversation between two or more users (as stored in Firestore)
export interface Conversation {
  id: string; // Firestore document ID
  participants: string[]; // Array of user IDs participating in the conversation
  postId?: string; // Optional ID of the post this conversation is about
  lastMessage: string | null; // Text of the last message sent
  lastMessageTimestamp: Timestamp | null; // Timestamp of the last message (Firestore Timestamp)
  createdAt: Timestamp; // When the conversation was created (Firestore Timestamp)
}

// Represents a conversation object safe to pass to Client Components (uses number for timestamps)
export interface ClientConversation extends Omit<Conversation, 'lastMessageTimestamp' | 'createdAt'> {
  lastMessageTimestamp: number | null; // Milliseconds since epoch
  createdAt: number; // Milliseconds since epoch
}


// Represents a single message within a conversation (as stored in Firestore)
export interface Message {
  id: string; // Firestore document ID (within the messages subcollection)
  conversationId: string; // ID of the parent conversation
  senderId: string; // ID of the user who sent the message
  text: string; // The content of the message
  timestamp: Timestamp; // When the message was sent (Firestore Timestamp)
  read: boolean; // Indicates if the message has been read (by the recipient)
  isBotMessage?: boolean; // Optional: Indicates if the message is from a bot
  replyToMessageId?: string; // Optional: ID of the message this is a reply to
  repliedToTextSnippet?: string; // Optional: A snippet of the text of the message being replied to
}

// Represents a message with a serializable timestamp (e.g., number) for client components
export interface SerializableMessage extends Omit<Message, 'timestamp'> {
  timestamp: number; // Timestamp as milliseconds since epoch
  // isBotMessage is inherited from Message via Omit if not re-declared
  // but explicitly adding it here for clarity if Message could change
  isBotMessage?: boolean; 
}


// Type for data needed to create a new message (uses client-side data, serverTimestamp used in service)
export type NewMessageData = Omit<Message, 'id' | 'timestamp' | 'read'>;
// We might need to adjust NewMessageData if isBotMessage should be settable at creation
// For now, assuming isBotMessage is determined by the backend or not set by client directly for new messages

// Type for data needed to create a new conversation
export type NewConversationData = Omit<Conversation, 'id'>;
