// src/types/messaging.ts
import type { Timestamp } from 'firebase/firestore';

// Represents a conversation between two or more users
export interface Conversation {
  id: string; // Firestore document ID
  participants: string[]; // Array of user IDs participating in the conversation
  // participantDetails?: { [userId: string]: { name: string; avatar?: string } }; // Optional: Store names/avatars
  lastMessage: string | null; // Text of the last message sent
  lastMessageTimestamp: Timestamp | null; // Timestamp of the last message
  createdAt: Timestamp; // When the conversation was created
  // Add other fields like unread message counts if needed
  // unreadCounts?: { [userId: string]: number };
}

// Represents a single message within a conversation
export interface Message {
  id: string; // Firestore document ID (within the messages subcollection)
  conversationId: string; // ID of the parent conversation
  senderId: string; // ID of the user who sent the message
  text: string; // The content of the message
  timestamp: Timestamp; // When the message was sent
  read: boolean; // Indicates if the message has been read (by the recipient)
  // Add other fields like reactions, attachments, etc., if needed
}

// Type for data needed to create a new message
export type NewMessageData = Omit<Message, 'id' | 'timestamp' | 'read'>;

