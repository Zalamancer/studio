// src/services/reviewService.ts
'use server';

import { db } from '@/lib/firebase/config';
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp,
  Timestamp,
  writeBatch,
  getDoc,
} from 'firebase/firestore';
import type { Review, NewReviewData, UpdateReviewData, ClientReview } from '@/types/review';
import { getUserProfileBasic } from './connectionService'; // To fetch reviewer avatar if needed for display elsewhere

const REVIEWS_COLLECTION = 'reviews';

/*
Firestore Security Rules for /reviews/{reviewId}:

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ... your existing rules ...

    match /reviews/{reviewId} {
      allow read: if request.auth != null; // Or `if true;` if reviews are public

      allow create: if request.auth != null
                    && request.auth.uid == request.resource.data.reviewerId
                    && request.resource.data.targetUserId != null
                    && request.resource.data.rating >= 1 && request.resource.data.rating <= 5
                    && request.resource.data.comment is string
                    && request.resource.data.reviewerName is string;

      allow update: if request.auth != null
                    && request.auth.uid == resource.data.reviewerId // Can only update their own review
                    && request.resource.data.rating >= 1 && request.resource.data.rating <= 5
                    && request.resource.data.comment is string
                    // Prevent changing immutable fields
                    && request.resource.data.reviewerId == resource.data.reviewerId
                    && request.resource.data.targetUserId == resource.data.targetUserId
                    && request.resource.data.createdAt == resource.data.createdAt;

      allow delete: if request.auth != null && request.auth.uid == resource.data.reviewerId; // Can only delete their own review
    }
  }
}
*/

export const addReview = async (reviewData: NewReviewData): Promise<string> => {
  if (!reviewData.targetUserId || !reviewData.reviewerId || !reviewData.rating) {
    throw new Error("Target user, reviewer ID, and rating are required.");
  }
  try {
    const docRef = await addDoc(collection(db, REVIEWS_COLLECTION), {
      ...reviewData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    console.log(`Review added for target ${reviewData.targetUserId} by ${reviewData.reviewerId} with ID: ${docRef.id}`);
    return docRef.id;
  } catch (error: any) {
    console.error("Error adding review:", error);
    throw new Error(error.message || "Could not add review.");
  }
};

export const getReviewsForProfile = async (targetUserId: string): Promise<ClientReview[]> => {
  if (!targetUserId) return [];
  console.log(`Fetching reviews for profile: ${targetUserId}`);
  try {
    const q = query(
      collection(db, REVIEWS_COLLECTION),
      where('targetUserId', '==', targetUserId),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    const reviews: ClientReview[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data() as Review; // Assume data matches Review structure
      reviews.push({
        id: docSnap.id,
        targetUserId: data.targetUserId,
        reviewerId: data.reviewerId,
        reviewerName: data.reviewerName,
        reviewerAvatar: data.reviewerAvatar,
        rating: data.rating,
        comment: data.comment,
        createdAt: (data.createdAt as Timestamp).toMillis(),
        updatedAt: (data.updatedAt as Timestamp).toMillis(),
      });
    });
    console.log(`Fetched ${reviews.length} reviews for profile ${targetUserId}`);
    return reviews;
  } catch (error: any) {
    console.error(`Error fetching reviews for profile ${targetUserId}:`, error);
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
        console.error("Firestore query for reviews requires an index. Create a composite index on 'targetUserId' (==) and 'createdAt' (desc) in the Firebase console for the 'reviews' collection.");
        throw new Error("Firestore query requires an index for reviews. Please create it in the Firebase console.");
    }
    throw new Error(error.message || "Could not fetch reviews.");
  }
};

export const updateReview = async (reviewId: string, currentUserId: string, data: UpdateReviewData): Promise<void> => {
  if (!reviewId || !currentUserId) {
    throw new Error("Review ID and User ID are required for update.");
  }
  const reviewDocRef = doc(db, REVIEWS_COLLECTION, reviewId);
  try {
    // Optional: Verify ownership on the server-side before update, though rules should handle this
    const reviewSnap = await getDoc(reviewDocRef);
    if (!reviewSnap.exists() || reviewSnap.data()?.reviewerId !== currentUserId) {
        throw new Error("Review not found or permission denied for update.");
    }

    await updateDoc(reviewDocRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
    console.log(`Review ${reviewId} updated successfully by ${currentUserId}.`);
  } catch (error: any) {
    console.error(`Error updating review ${reviewId}:`, error);
    throw new Error(error.message || "Could not update review.");
  }
};

export const deleteReview = async (reviewId: string, currentUserId: string): Promise<void> => {
  if (!reviewId || !currentUserId) {
    throw new Error("Review ID and User ID are required for deletion.");
  }
  const reviewDocRef = doc(db, REVIEWS_COLLECTION, reviewId);
  try {
     // Optional: Verify ownership on the server-side before delete
    const reviewSnap = await getDoc(reviewDocRef);
    if (!reviewSnap.exists() || reviewSnap.data()?.reviewerId !== currentUserId) {
        throw new Error("Review not found or permission denied for deletion.");
    }
    await deleteDoc(reviewDocRef);
    console.log(`Review ${reviewId} deleted successfully by ${currentUserId}.`);
  } catch (error: any) {
    console.error(`Error deleting review ${reviewId}:`, error);
    throw new Error(error.message || "Could not delete review.");
  }
};
