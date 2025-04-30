// src/types/comment.ts
import type { Timestamp } from 'firebase/firestore';

// Represents a comment document stored in Firestore
export interface Comment {
  id: string;
  userId: string; // ID of the user who posted the comment
  postId: string; // ID of the post this comment belongs to
  text: string; // The comment text
  timestamp: Timestamp; // Firestore Timestamp when the comment was posted
  userName?: string; // Optional: Display name of the commenter
  userAvatar?: string; // Optional: Avatar URL of the commenter
}

// Represents comment data used on the client-side (serializable timestamp)
export interface ClientComment extends Omit<Comment, 'timestamp'> {
  timestamp: number; // Milliseconds since epoch
}

// Data needed to create a new comment
export type NewCommentData = Omit<Comment, 'id' | 'timestamp'>;
