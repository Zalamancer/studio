// src/types/comment.ts
import type { Timestamp } from 'firebase/firestore';

// Represents a comment document stored in Firestore subcollection posts/{postId}/comments
export interface Comment {
  id: string;
  userId: string; // ID of the user who posted the comment
  text: string; // The comment text
  timestamp: Timestamp; // Firestore Timestamp when the comment was posted
  // Optional fields can be added later if needed (e.g., userName, userAvatar)
}

// Represents comment data used on the client-side (serializable timestamp)
export interface ClientComment extends Omit<Comment, 'timestamp'> {
  timestamp: number; // Milliseconds since epoch
  // Add optional fields needed for display
  userName?: string; // Made optional as it's fetched
  userAvatar?: string; // Made optional as it's fetched
}

// Data needed to create a new comment (postId is implicit via subcollection path)
export type NewCommentData = Omit<Comment, 'id' | 'timestamp'>;
