// src/types/review.ts
import type { Timestamp } from 'firebase/firestore';

export interface Review {
  id: string;           // Firestore document ID
  targetUserId: string; // ID of the user profile being reviewed
  reviewerId: string;   // ID of the user who wrote the review
  reviewerName: string; // Display name of the reviewer
  reviewerAvatar?: string; // Optional avatar URL of the reviewer
  rating: number;         // Star rating (1-5)
  comment: string;        // Review text
  createdAt: Timestamp;   // Firestore Timestamp of creation
  updatedAt: Timestamp;   // Firestore Timestamp of last update
}

export interface ClientReview extends Omit<Review, 'createdAt' | 'updatedAt'> {
  createdAt: number;   // Milliseconds since epoch
  updatedAt: number;   // Milliseconds since epoch
}

// Data for creating a new review.
// Reviewer name/avatar will be added by the service based on the logged-in user.
export type NewReviewData = {
  targetUserId: string;
  reviewerId: string;
  reviewerName: string;
  reviewerAvatar?: string;
  rating: number;
  comment: string;
};

// Data for updating an existing review (only rating and comment can be updated).
export type UpdateReviewData = {
  rating: number;
  comment: string;
};
