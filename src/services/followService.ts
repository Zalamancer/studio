// src/services/followService.ts
import { db } from '@/lib/firebase/config';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteField,
} from 'firebase/firestore';

const FOLLOWS_COLLECTION = 'follows';

/**
 * Creates or updates a follow relationship using a map within a single document per follower.
 * The document ID is the follower's UID.
 */
export const followUser = async (followerId: string, followingId: string): Promise<void> => {
  if (followerId === followingId) throw new Error("Cannot follow yourself.");
  
  console.log(`[followService] followUser called with:
    - followerId: ${followerId} (type: ${typeof followerId})
    - followingId: ${followingId} (type: ${typeof followingId})`);

  if (!followerId || !followingId) {
    console.error("[followService] Aborting followUser: One of the IDs is missing.");
    throw new Error("Both follower and following IDs are required.");
  }

  const followDocRef = doc(db, FOLLOWS_COLLECTION, followerId);

  const dataToWrite = {
    following: {
      [followingId]: true
    },
    followerId: followerId,
  };

  console.log("[followService] Attempting to setDoc with merge. Document ref:", followDocRef.path);
  console.log("[followService] Data to write:", JSON.stringify(dataToWrite, null, 2));

  // Use setDoc with merge to create the document or add to the 'following' map.
  // The key is the user ID being followed, and the value is true for easy checking.
  await setDoc(followDocRef, dataToWrite, { merge: true });
};

/**
 * Deletes a follow relationship by removing a key from the 'following' map.
 */
export const unfollowUser = async (followerId: string, followingId: string): Promise<void> => {
  const followDocRef = doc(db, FOLLOWS_COLLECTION, followerId);
  
  // Use updateDoc and deleteField to remove a specific user from the 'following' map.
  await updateDoc(followDocRef, {
    [`following.${followingId}`]: deleteField()
  });
};

/**
 * Retrieves a list of user IDs that a given user is following.
 * Now reads a single document.
 */
export const getFollowingIds = async (userId: string): Promise<string[]> => {
  if (!userId) return [];
  try {
    const followDocRef = doc(db, FOLLOWS_COLLECTION, userId);
    const docSnap = await getDoc(followDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      // The `following` field is a map. We return its keys.
      return data.following ? Object.keys(data.following) : [];
    }
    return [];
  } catch (error: any) {
    console.error("[followService] Error getting following list:", error);
    throw error;
  }
};

/**
 * Checks if a user is following another user by checking a single document.
 */
export const isFollowingUser = async (followerId: string, followingId: string): Promise<boolean> => {
  if (!followerId || !followingId) return false;
  const followDocRef = doc(db, FOLLOWS_COLLECTION, followerId);
  const docSnap = await getDoc(followDocRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    // Check if the followingId exists as a key in the 'following' map.
    return !!(data.following && data.following[followingId]);
  }
  return false;
};

    