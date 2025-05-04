// src/types/comment.ts
import type { Timestamp } from 'firebase/firestore';

// Represents a comment document stored in Firestore subcollection posts/{postId}/comments
export interface Comment {
  id: string;
  userId: string; // ID of the user who posted the comment
  text: string; // The comment text
  timestamp: Timestamp; // Firestore Timestamp when the comment was posted
  likeCount?: number; // Number of likes (optional for backward compatibility)
  likedBy?: string[]; // Array of user IDs who liked the comment (optional)
  mentionedUserIds?: string[]; // Optional: Array of user IDs mentioned in the comment
  // Optional fields can be added later if needed (e.g., userName, userAvatar)
}

// Represents comment data used on the client-side (serializable timestamp)
export interface ClientComment extends Omit<Comment, 'timestamp' | 'likedBy' | 'mentionedUserIds'> {
  timestamp: number; // Milliseconds since epoch
  // Add optional fields needed for display
  userName?: string; // Made optional as it's fetched
  userAvatar?: string; // Made optional as it's fetched
  likedBy?: string[]; // Include likedBy array for client-side checking
  mentionedUserIds?: string[]; // Include mentioned user IDs
}

// Data needed to create a new comment (postId is implicit via subcollection path)
// Initialize likeCount and likedBy when creating
export type NewCommentData = Omit<Comment, 'id' | 'timestamp' | 'likeCount' | 'likedBy' | 'mentionedUserIds'> & {
    likeCount: number;
    likedBy: string[];
    mentionedUserIds?: string[];
};


// Represents a subcomment (reply) document stored in Firestore subcollection
// posts/{postId}/comments/{commentId}/subcomments
export interface SubComment {
  id: string;
  userId: string; // ID of the user who posted the subcomment
  text: string; // The subcomment text
  timestamp: Timestamp; // Firestore Timestamp when the subcomment was posted
  likeCount?: number; // Number of likes
  likedBy?: string[]; // Array of user IDs who liked the subcomment
  mentionedUserIds?: string[]; // Optional: Array of user IDs mentioned in the subcomment
}

// Represents subcomment data used on the client-side (serializable timestamp)
export interface ClientSubComment extends Omit<SubComment, 'timestamp' | 'mentionedUserIds'> {
  timestamp: number; // Milliseconds since epoch
  userName?: string; // Fetched for display
  userAvatar?: string; // Fetched for display
  likeCount?: number; // Include like count
  likedBy?: string[]; // Include likedBy array
  mentionedUserIds?: string[]; // Include mentioned user IDs
}

// Data needed to create a new subcomment (postId and commentId are implicit)
// Initialize like fields
export type NewSubCommentData = Omit<SubComment, 'id' | 'timestamp' | 'likeCount' | 'likedBy' | 'mentionedUserIds'> & {
    likeCount: number;
    likedBy: string[];
    mentionedUserIds?: string[];
};
