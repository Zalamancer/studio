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
import type { Review, NewReviewData as NewReviewDataType, UpdateReviewData, ClientReview } from '@/types/review';

const REVIEWS_COLLECTION = 'reviews';

// Type for the data structure when creating a new review in Firestore
// This will include the calculated reviewerHistoricalAvgRating.
type FirestoreNewReviewData = Omit<Review, 'id' | 'createdAt' | 'updatedAt'> & {
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export const getReviewsGivenByUserId = async (reviewerId: string): Promise<ClientReview[]> => {
  if (!reviewerId) {
    console.warn("[reviewService] getReviewsGivenByUserId: No reviewerId provided.");
    return [];
  }
  const clientAuthUid = auth.currentUser?.uid;
  console.log(`%c[reviewService] getReviewsGivenByUserId: Fetching reviews given by reviewerId: '${reviewerId}'. Client auth UID: '${clientAuthUid || 'NULL'}'`, "color: dodgerblue;");

  try {
    const q = query(
      collection(db, REVIEWS_COLLECTION),
      where('reviewerId', '==', reviewerId),
      orderBy('createdAt', 'desc') // Optional, but good for consistency
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
        reviewerHistoricalAvgRating: data.reviewerHistoricalAvgRating === undefined ? null : data.reviewerHistoricalAvgRating,
        createdAt: (data.createdAt as Timestamp).toMillis(),
        updatedAt: (data.updatedAt as Timestamp).toMillis(),
      });
    });
    console.log(`%c[reviewService] getReviewsGivenByUserId: Fetched ${reviews.length} reviews given by ${reviewerId}`, "color: green;");
    return reviews;
  } catch (error: any) {
    console.error(`[reviewService] Error fetching reviews given by ${reviewerId}:`, error);
    if (error.code === 'permission-denied') {
      console.error(`[reviewService] PERMISSION DENIED fetching reviews given by ${reviewerId}. Client auth UID: '${clientAuthUid || 'NULL'}'. Check Firestore rules for reading 'reviews' collection (ensure query by reviewerId is allowed).`);
      throw new Error('Permission denied fetching reviews by user. Check Firestore rules.');
    }
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
        console.error("[reviewService] Firestore query for reviews by reviewerId requires an index. Create a composite index on 'reviewerId' (==) and 'createdAt' (desc) in the Firebase console for the 'reviews' collection.");
        throw new Error("Firestore query requires an index for reviews by user. Please create it in the Firebase console.");
    }
    throw new Error(error.message || "Could not fetch reviews by user.");
  }
};


export const addReview = async (reviewData: NewReviewDataType): Promise<string> => {
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

  // Fetch previous reviews by this reviewer to calculate their historical average rating
  let calculatedHistoricalAvgRating: number | null = null;
  try {
    console.log(`[reviewService] addReview: Fetching previous reviews given by ${reviewData.reviewerId} to calculate historical average.`);
    const previousReviewsGiven = await getReviewsGivenByUserId(reviewData.reviewerId);
    if (previousReviewsGiven.length > 0) {
      const sumOfPreviousRatings = previousReviewsGiven.reduce((sum, r) => sum + r.rating, 0);
      calculatedHistoricalAvgRating = sumOfPreviousRatings / previousReviewsGiven.length;
      console.log(`[reviewService] addReview: Calculated historical average rating for ${reviewData.reviewerId}: ${calculatedHistoricalAvgRating} based on ${previousReviewsGiven.length} reviews.`);
    } else {
      console.log(`[reviewService] addReview: No previous reviews found for ${reviewData.reviewerId}. Historical average rating will be null.`);
    }
  } catch (e) {
    console.error(`[reviewService] addReview: Error fetching previous reviews for ${reviewData.reviewerId}. Historical average rating will be null. Error:`, e);
  }

  try {
    const dataToSave: FirestoreNewReviewData = {
      targetUserId: reviewData.targetUserId,
      reviewerId: reviewData.reviewerId,
      reviewerName: reviewData.reviewerName,
      reviewerAvatar: reviewData.reviewerAvatar && reviewData.reviewerAvatar.trim() !== '' ? reviewData.reviewerAvatar : null,
      rating: reviewData.rating,
      comment: reviewData.comment,
      reviewerHistoricalAvgRating: calculatedHistoricalAvgRating, // Store the calculated historical average
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp,
    };

    console.log("[reviewService] addReview: Data being sent to Firestore:", dataToSave);

    const docRef = await addDoc(collection(db, REVIEWS_COLLECTION), dataToSave);
    console.log(`[reviewService] Review added for target ${reviewData.targetUserId} by ${reviewData.reviewerId} with ID: ${docRef.id}`);
    return docRef.id;
  } catch (error: any) {
    console.error("[reviewService] Error adding review:", error);
    if (error.code === 'permission-denied') {
      console.error(`[reviewService] PERMISSION DENIED adding review. Auth UID: ${clientAuthUid}. Data:`, reviewData);
    }
    if (error.message && error.message.includes("Unsupported field value: undefined")) {
      console.error("[reviewService] Firestore received an undefined value. Data sent:", reviewData);
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
  console.log(`%c[userPreferenceService] getUserPreferences - Internal Auth Check: auth.currentUser?.uid = ${auth.currentUser?.uid || 'NULL'}`, "color: darkgoldenrod;");
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
        reviewerHistoricalAvgRating: data.reviewerHistoricalAvgRating === undefined ? null : data.reviewerHistoricalAvgRating, // Fetch the field
        createdAt: (data.createdAt as Timestamp).toMillis(), 
        updatedAt: (data.updatedAt as Timestamp).toMillis(), 
      });
    });
    console.log(`%c[reviewService] getReviewsForProfile: Fetched ${reviews.length} reviews for profile ${targetUserId}`, "color: green;");
    return reviews;
  } catch (error: any) {
    console.error(`[reviewService] Error fetching reviews for profile ${targetUserId}:`, error);
    if (error.code === 'permission-denied') {
      console.error(`[reviewService] PERMISSION DENIED fetching reviews for target ${targetUserId}. Client auth UID: '${clientAuthUid || 'NULL'}'. Check Firestore rules for reading 'reviews' collection.`);
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

    // When updating, we don't re-calculate historical average. It's a snapshot.
    await updateDoc(reviewDocRef, {
      rating: data.rating,
      comment: data.comment,
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
