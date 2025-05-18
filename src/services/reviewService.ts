// src/services/reviewService.ts
// Client-side service

import { db, auth } from '@/lib/firebase/config';
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

const REVIEWS_COLLECTION = 'reviews';

export const addReview = async (reviewData: NewReviewData): Promise<string> => {
  console.log("[reviewService] addReview: Called with data:", reviewData);
  if (!reviewData.targetUserId || !reviewData.reviewerId || !reviewData.rating) {
    console.error("[reviewService] addReview: Missing required fields.");
    throw new Error("Target user, reviewer ID, and rating are required.");
  }
  const clientAuthUid = auth.currentUser?.uid;
  if (!clientAuthUid || clientAuthUid !== reviewData.reviewerId) {
      console.error(`[reviewService] addReview: Authentication mismatch or not authenticated. Client UID: ${clientAuthUid}, Reviewer ID in data: ${reviewData.reviewerId}`);
      throw new Error("Authentication error: Cannot create review for another user or without authentication.");
  }

  try {
    const docRef = await addDoc(collection(db, REVIEWS_COLLECTION), {
      ...reviewData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    console.log(`[reviewService] Review added for target ${reviewData.targetUserId} by ${reviewData.reviewerId} with ID: ${docRef.id}`);
    return docRef.id;
  } catch (error: any) {
    console.error("[reviewService] Error adding review:", error);
    if (error.code === 'permission-denied') {
      console.error(`[reviewService] PERMISSION DENIED adding review. Auth UID: ${clientAuthUid}. Data:`, reviewData);
    }
    throw new Error(error.message || "Could not add review.");
  }
};

export const getReviewsForProfile = async (targetUserId: string): Promise<ClientReview[]> => {
  if (!targetUserId) {
    console.warn("[reviewService] getReviewsForProfile: No targetUserId provided.");
    return [];
  }
  const clientAuthUid = auth.currentUser?.uid;
  console.log(`%c[reviewService] getReviewsForProfile: Fetching for targetUserId: '${targetUserId}'. Client auth UID: '${clientAuthUid || 'NULL'}'`, "color: dodgerblue;");

  try {
    const q = query(
      collection(db, REVIEWS_COLLECTION),
      where('targetUserId', '==', targetUserId),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    const reviews: ClientReview[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data() as Review;
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
    console.log(`%c[reviewService] getReviewsForProfile: Fetched ${reviews.length} reviews for profile ${targetUserId}`, "color: green;");
    return reviews;
  } catch (error: any) {
    console.error(`[reviewService] Error fetching reviews for profile ${targetUserId}:`, error);
    if (error.code === 'permission-denied') {
      console.error(`%c[reviewService] PERMISSION DENIED fetching reviews for target ${targetUserId}. Client auth UID: '${clientAuthUid || 'NULL'}'. Firestore Rule for '/reviews/{reviewId}' should be 'allow read: if request.auth != null;'. VERIFY PUBLISHED RULES.`, "color: red; font-weight: bold;");
      throw new Error('Permission denied fetching reviews. Check Firestore rules.');
    }
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
        console.error("[reviewService] Firestore query for reviews requires an index. Create a composite index on 'targetUserId' (==) and 'createdAt' (desc) in the Firebase console for the 'reviews' collection.");
        throw new Error("Firestore query requires an index for reviews. Please create it in the Firebase console.");
    }
    throw new Error(error.message || "Could not fetch reviews.");
  }
};

export const updateReview = async (reviewId: string, currentUserId: string, data: UpdateReviewData): Promise<void> => {
  console.log(`[reviewService] updateReview: Called for reviewId '${reviewId}' by userId '${currentUserId}'. Data:`, data);
  if (!reviewId || !currentUserId) {
    console.error("[reviewService] updateReview: Missing reviewId or currentUserId.");
    throw new Error("Review ID and User ID are required for update.");
  }
  const clientAuthUid = auth.currentUser?.uid;
  if (!clientAuthUid || clientAuthUid !== currentUserId) {
      console.error(`[reviewService] updateReview: Auth mismatch. Client UID: ${clientAuthUid}, currentUserId param: ${currentUserId}`);
      throw new Error("Authentication error: Cannot update review.");
  }

  const reviewDocRef = doc(db, REVIEWS_COLLECTION, reviewId);
  try {
    const reviewSnap = await getDoc(reviewDocRef);
    if (!reviewSnap.exists() || reviewSnap.data()?.reviewerId !== currentUserId) {
        console.warn(`[reviewService] updateReview: Review not found or permission denied. Reviewer ID: ${reviewSnap.data()?.reviewerId}, Current User: ${currentUserId}`);
        throw new Error("Review not found or permission denied for update.");
    }

    await updateDoc(reviewDocRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
    console.log(`[reviewService] Review ${reviewId} updated successfully by ${currentUserId}.`);
  } catch (error: any) {
    console.error(`[reviewService] Error updating review ${reviewId}:`, error);
    if (error.code === 'permission-denied') {
        console.error(`[reviewService] PERMISSION DENIED updating review ${reviewId}. Auth UID: ${clientAuthUid}.`);
    }
    throw new Error(error.message || "Could not update review.");
  }
};

export const deleteReview = async (reviewId: string, currentUserId: string): Promise<void> => {
  console.log(`[reviewService] deleteReview: Called for reviewId '${reviewId}' by userId '${currentUserId}'.`);
  if (!reviewId || !currentUserId) {
    console.error("[reviewService] deleteReview: Missing reviewId or currentUserId.");
    throw new Error("Review ID and User ID are required for deletion.");
  }
   const clientAuthUid = auth.currentUser?.uid;
   if (!clientAuthUid || clientAuthUid !== currentUserId) {
       console.error(`[reviewService] deleteReview: Auth mismatch. Client UID: ${clientAuthUid}, currentUserId param: ${currentUserId}`);
       throw new Error("Authentication error: Cannot delete review.");
   }

  const reviewDocRef = doc(db, REVIEWS_COLLECTION, reviewId);
  try {
    const reviewSnap = await getDoc(reviewDocRef);
    if (!reviewSnap.exists() || reviewSnap.data()?.reviewerId !== currentUserId) {
        console.warn(`[reviewService] deleteReview: Review not found or permission denied. Reviewer ID: ${reviewSnap.data()?.reviewerId}, Current User: ${currentUserId}`);
        throw new Error("Review not found or permission denied for deletion.");
    }
    await deleteDoc(reviewDocRef);
    console.log(`[reviewService] Review ${reviewId} deleted successfully by ${currentUserId}.`);
  } catch (error: any) {
    console.error(`[reviewService] Error deleting review ${reviewId}:`, error);
    if (error.code === 'permission-denied') {
        console.error(`[reviewService] PERMISSION DENIED deleting review ${reviewId}. Auth UID: ${clientAuthUid}.`);
    }
    throw new Error(error.message || "Could not delete review.");
  }
};
