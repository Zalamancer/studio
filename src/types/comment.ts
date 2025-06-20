// src/types/comment.ts
import type { Timestamp } from 'firebase/firestore';

// Represents a comment document stored in Firestore subcollection posts/{postId}/comments
// OR newsArticles/{articleId}/newsComments
export interface Comment {
  id: string;
  userId: string; // ID of the user who posted the comment
  text: string; // The comment text
  timestamp: Timestamp; // Firestore Timestamp when the comment was posted
  mentionName?: string; // The generated anonymous name of the commenter at time of posting
  likeCount?: number; // Number of likes (optional for backward compatibility)
  likedBy?: string[]; // Array of user IDs who liked the comment (optional)
  mentionedUserIds?: string[]; // Optional: Array of user IDs mentioned in the comment
  isShadowBanned?: boolean; // Optional: for news article comments
}

// Represents comment data used on the client-side (serializable timestamp)
export interface ClientComment extends Omit<Comment, 'timestamp' | 'likedBy' | 'mentionedUserIds'> {
  timestamp: number; // Milliseconds since epoch
  userName?: string; // Made optional as it's fetched
  userAvatar?: string; // Made optional as it's fetched
  mentionName?: string; // Added mentionName for consistency
  likedBy?: string[]; // Include likedBy array for client-side checking
  mentionedUserIds?: string[]; // Include mentioned user IDs
  isShadowBanned?: boolean;
}

// Data needed to create a new comment (postId is implicit via subcollection path)
// Initialize likeCount and likedBy when creating
export type NewCommentData = {
    userId: string;
    text: string;
    mentionName: string; // This is now mandatory
    mentionedUserIds?: string[];
    isShadowBanned?: boolean;
    likeCount: number; // For full data object
    likedBy: string[]; // For full data object
};

// Represents a subcomment (reply) document stored in Firestore subcollection
export interface SubComment {
  id: string;
  userId: string; // ID of the user who posted the subcomment
  text: string; // The subcomment text
  timestamp: Timestamp; // Firestore Timestamp when the subcomment was posted
  mentionName?: string; // Optional for backward compat
  likeCount?: number; // Number of likes
  likedBy?: string[]; // Array of user IDs who liked the subcomment
  mentionedUserIds?: string[]; // Optional: Array of user IDs mentioned in the subcomment
  isShadowBanned?: boolean;
}

// Represents subcomment data used on the client-side (serializable timestamp)
export interface ClientSubComment extends Omit<SubComment, 'timestamp' | 'mentionedUserIds'> {
  timestamp: number; // Milliseconds since epoch
  userName?: string; // Fetched for display
  userAvatar?: string; // Fetched for display
  mentionName?: string;
  likeCount?: number;
  likedBy?: string[];
  mentionedUserIds?: string[];
  isShadowBanned?: boolean;
}

// Data needed to create a new subcomment (postId and commentId are implicit)
export type NewSubCommentData = {
    userId: string;
    text: string;
    mentionName: string; // Mandatory
    mentionedUserIds?: string[];
    isShadowBanned?: boolean;
    likeCount: number;
    likedBy: string[];
};
