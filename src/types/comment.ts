
// src/types/comment.ts
import type { Timestamp } from 'firebase/firestore';

// Represents a comment document stored in Firestore subcollection posts/{postId}/comments
// OR newsArticles/{articleId}/newsComments
export interface Comment {
  id: string;
  userId: string; // ID of the user who posted the comment
  text: string; // The comment text
  timestamp: Timestamp; // Firestore Timestamp when the comment was posted
  likeCount?: number; // Number of likes (optional for backward compatibility)
  likedBy?: string[]; // Array of user IDs who liked the comment (optional)
  mentionedUserIds?: string[]; // Optional: Array of user IDs mentioned in the comment
  isShadowBanned?: boolean; // Optional: for news article comments
  // Optional fields can be added later if needed (e.g., userName, userAvatar)
}

// Represents comment data used on the client-side (serializable timestamp)
export interface ClientComment extends Omit<Comment, 'timestamp' | 'likedBy' | 'mentionedUserIds'> {
  timestamp: number; // Milliseconds since epoch
  // Add optional fields needed for display
  userName?: string; // Made optional as it's fetched
  userAvatar?: string; // Made optional as it's fetched
  mentionName?: string; // Added mentionName for consistency
  likedBy?: string[]; // Include likedBy array for client-side checking
  mentionedUserIds?: string[]; // Include mentioned user IDs
  isShadowBanned?: boolean; // Optional: for news article comments
}

// Data needed to create a new comment (postId is implicit via subcollection path)
// Initialize likeCount and likedBy when creating
export type NewCommentData = Omit<Comment, 'id' | 'timestamp' | 'likeCount' | 'likedBy' | 'mentionedUserIds' | 'isShadowBanned'> & {
    likeCount: number;
    likedBy: string[];
    mentionedUserIds?: string[];
    isShadowBanned?: boolean; // Should be false by default
};


// Represents a subcomment (reply) document stored in Firestore subcollection
// posts/{postId}/comments/{commentId}/subcomments
// OR newsArticles/{articleId}/newsComments/{commentId}/newsSubcomments
export interface SubComment {
  id: string;
  userId: string; // ID of the user who posted the subcomment
  text: string; // The subcomment text
  timestamp: Timestamp; // Firestore Timestamp when the subcomment was posted
  likeCount?: number; // Number of likes
  likedBy?: string[]; // Array of user IDs who liked the subcomment
  mentionedUserIds?: string[]; // Optional: Array of user IDs mentioned in the subcomment
  isShadowBanned?: boolean; // Optional: for news article subcomments
}

// Represents subcomment data used on the client-side (serializable timestamp)
export interface ClientSubComment extends Omit<SubComment, 'timestamp' | 'mentionedUserIds'> {
  timestamp: number; // Milliseconds since epoch
  userName?: string; // Fetched for display
  userAvatar?: string; // Fetched for display
  mentionName?: string; // Added mentionName for consistency
  likeCount?: number; // Include like count
  likedBy?: string[]; // Include likedBy array
  mentionedUserIds?: string[]; // Include mentioned user IDs
  isShadowBanned?: boolean; // Optional: for news article subcomments
}

// Data needed to create a new subcomment (postId and commentId are implicit)
// Initialize like fields
export type NewSubCommentData = Omit<SubComment, 'id' | 'timestamp' | 'likeCount' | 'likedBy' | 'mentionedUserIds' | 'isShadowBanned'> & {
    likeCount: number;
    likedBy: string[];
    mentionedUserIds?: string[];
    isShadowBanned?: boolean; // Should be false by default
};
