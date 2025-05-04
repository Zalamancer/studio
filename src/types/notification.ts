// src/types/notification.ts
import type { Timestamp } from 'firebase/firestore';

// Type of notification
export type NotificationType = 'reply' | 'mention' | 'connection_request' | 'connection_accepted';

// Represents a notification document stored in Firestore
export interface Notification {
  id: string; // Firestore document ID
  userId: string; // The ID of the user who should receive this notification
  type: NotificationType;
  senderId: string; // The ID of the user who triggered the notification
  senderName?: string; // Optional: Display name of the sender
  senderAvatar?: string; // Optional: Avatar URL of the sender
  postId?: string; // Optional: ID of the related post
  postQuestion?: string; // Optional: Question snippet from the related post
  commentId?: string; // Optional: ID of the related comment
  subCommentId?: string; // Optional: ID of the related subcomment
  textSnippet?: string; // Optional: A short snippet of the reply/mention text
  timestamp: Timestamp; // Firestore Timestamp when the notification was created
  isRead: boolean; // Whether the user has read the notification
}

// Represents notification data used on the client-side (serializable timestamp)
export interface ClientNotification extends Omit<Notification, 'timestamp'> {
  timestamp: number; // Milliseconds since epoch
}

// Data needed to create a new notification
export type NewNotificationData = Omit<Notification, 'id' | 'timestamp' | 'isRead'> & {
    // Timestamp and isRead will be set by the service/server
};
