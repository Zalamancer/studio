// src/services/followService.ts
import { db } from '@/lib/firebase/config';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  getDoc,
  limit,
} from 'firebase/firestore';

const FOLLOWS_COLLECTION = 'follows';

/**
 * Creates a follow relationship. The document ID is followerId_followingId.
 */
export const followUser = async (followerId: string, followingId: string): Promise<void> => {
  if (followerId === followingId) throw new Error("Cannot follow yourself.");
  const followDocRef = doc(db, FOLLOWS_COLLECTION, `${followerId}_${followingId}`);
  await setDoc(followDocRef, {
    followerId,
    followingId,
    followedAt: serverTimestamp(),
  });
};

/**
 * Deletes a follow relationship.
 */
export const unfollowUser = async (followerId: string, followingId: string): Promise<void> => {
  const followDocRef = doc(db, FOLLOWS_COLLECTION, `${followerId}_${followingId}`);
  await deleteDoc(followDocRef);
};

/**
 * Retrieves a list of user IDs that a given user is following.
 * Requires a Firestore index on `followerId`.
 */
export const getFollowingIds = async (userId: string): Promise<string[]> => {
  if (!userId) return [];
  try {
    const q = query(collection(db, FOLLOWS_COLLECTION), where('followerId', '==', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data().followingId as string);
  } catch (error: any) {
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
      console.error("[followService] Firestore query for follows requires an index on 'followerId'. Please create this in the Firebase console.");
      // Return empty array to prevent app crash, but log error.
      return [];
    }
    throw error;
  }
};

/**
 * Checks if a user is following another user.
 */
export const isFollowingUser = async (followerId: string, followingId: string): Promise<boolean> => {
  if (!followerId || !followingId) return false;
  const followDocRef = doc(db, FOLLOWS_COLLECTION, `${followerId}_${followingId}`);
  const docSnap = await getDoc(followDocRef);
  return docSnap.exists();
};
