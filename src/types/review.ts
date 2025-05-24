// src/types/review.ts
import type { Timestamp } from 'firebase/firestore';

export interface Review {
  id: string;           // Firestore document ID
  targetUserId: string; // ID of the user profile being reviewed
  reviewerId: string;   // ID of the user who wrote the review
  reviewerName: string; // Display name of the reviewer
  reviewerAvatar?: string | null; // Optional avatar URL of the reviewer, can be null
  rating: number;         // Star rating (1-5)
  comment: string;        // Review text
  reviewerHistoricalAvgRating?: number | null; // Snapshot of the reviewer's avg rating given TO OTHERS at the time of this review
  createdAt: Timestamp;   // Firestore Timestamp of creation
  updatedAt: Timestamp;   // Firestore Timestamp of last update
}

export interface ClientReview extends Omit<Review, 'createdAt' | 'updatedAt' | 'reviewerHistoricalAvgRating'> {
  createdAt: number;   // Milliseconds since epoch
  updatedAt: number;   // Milliseconds since epoch
  reviewerHistoricalAvgRating?: number | null; // Include this for potential display or debugging on client
}

// Data for creating a new review.
// Reviewer name/avatar will be added by the service based on the logged-in user.
// reviewerHistoricalAvgRating will be calculated and added by the service.
export type NewReviewData = {
  targetUserId: string;
  reviewerId: string;
  reviewerName: string;
  reviewerAvatar?: string | null;
  rating: number;
  comment: string;
};

// Data for updating an existing review (only rating and comment can be updated).
export type UpdateReviewData = {
  rating: number;
  comment: string;
};