
// src/services/collectionService.ts
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
  getDoc,
  serverTimestamp,
  Timestamp,
  arrayUnion,
  arrayRemove,
  writeBatch,
  FieldValue,
} from 'firebase/firestore';
import type { Collection, ClientCollection, NewCollectionData } from '@/types/collection';
import { fetchUserProfileBasic } from './connectionService';
import { generateAnonymousName } from '@/lib/pseudonymUtils';

const COLLECTIONS_PATH = 'collections';
const collectionsCollectionRef = collection(db, COLLECTIONS_PATH);

export const createCollection = async (
  ownerId: string,
  name: string,
  description?: string,
  initialPostId?: string
): Promise<string> => {
  if (!ownerId || !name) {
    throw new Error("Owner ID and Collection Name are required.");
  }
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== ownerId) {
    throw new Error("Authentication error or user ID mismatch.");
  }

  const newCollectionData: Omit<Collection, 'id'> = {
    name,
    description: description || '',
    ownerId,
    postIds: initialPostId ? [initialPostId] : [],
    sharedWithUserIds: [],
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
  };

  try {
    const docRef = await addDoc(collectionsCollectionRef, newCollectionData);
    console.log(`[collectionService] Collection created by ${ownerId} with ID: ${docRef.id}`);
    return docRef.id;
  } catch (error: any) {
    console.error("[collectionService] Error creating collection:", error);
    if (error.code === 'permission-denied') {
      throw new Error('Permission denied to create collection. Check Firestore rules.');
    }
    throw new Error(error.message || "Could not create collection.");
  }
};

export const getUserCollections = async (userId: string): Promise<ClientCollection[]> => {
  if (!userId) {
    console.warn("[collectionService] getUserCollections: No userId provided.");
    return [];
  }
  const clientAuthUid = auth.currentUser?.uid;
  console.log(`%c[collectionService] getUserCollections: Fetching for userId: '${userId}'. Client Auth UID: '${clientAuthUid || 'NULL'}'`, "color: dodgerblue;");

  try {
    // Query for collections owned by the user OR shared with the user
    const qOwned = query(
      collectionsCollectionRef,
      where('ownerId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const qShared = query(
      collectionsCollectionRef,
      where('sharedWithUserIds', 'array-contains', userId),
      orderBy('createdAt', 'desc')
    );

    const [ownedSnapshot, sharedSnapshot] = await Promise.all([
      getDocs(qOwned),
      getDocs(qShared),
    ]);

    const collectionsMap = new Map<string, ClientCollection>();

    const processSnapshot = (snapshot: typeof ownedSnapshot, isSharedCollection: boolean) => {
      snapshot.forEach((docSnap) => {
        if (collectionsMap.has(docSnap.id)) return; // Avoid duplicates if a collection is owned AND shared (shouldn't happen)

        const data = docSnap.data() as Collection;
        const clientCollection: ClientCollection = {
          id: docSnap.id,
          name: data.name,
          description: data.description,
          ownerId: data.ownerId,
          postIds: data.postIds || [],
          sharedWithUserIds: data.sharedWithUserIds || [],
          createdAt: (data.createdAt as Timestamp)?.toMillis() || Date.now(),
          updatedAt: (data.updatedAt as Timestamp)?.toMillis() || Date.now(),
          isSharedWithCurrentUser: isSharedCollection,
        };
        collectionsMap.set(docSnap.id, clientCollection);
      });
    };

    processSnapshot(ownedSnapshot, false);
    processSnapshot(sharedSnapshot, true);

    // Sort combined collections by createdAt descending
    const combinedCollections = Array.from(collectionsMap.values()).sort((a, b) => b.createdAt - a.createdAt);

    console.log(`%c[collectionService] getUserCollections: Fetched ${combinedCollections.length} total collections for ${userId}.`, "color: green;");
    return combinedCollections;
  } catch (error: any) {
    console.error(`[collectionService] Error fetching collections for ${userId}:`, error);
    if (error.code === 'permission-denied') {
      throw new Error('Permission denied fetching collections. Check Firestore rules.');
    }
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
      throw new Error("Firestore query for collections requires an index. Please create it.");
    }
    throw new Error(error.message || "Could not fetch collections.");
  }
};


export const getCollectionDetails = async (collectionId: string): Promise<ClientCollection | null> => {
  if (!collectionId) {
    console.warn("[collectionService] getCollectionDetails: No collectionId provided.");
    return null;
  }
  console.log(`%c[collectionService] getCollectionDetails: Fetching for collectionId: '${collectionId}'`, "color: dodgerblue;");
  const collectionDocRef = doc(collectionsCollectionRef, collectionId);
  try {
    const docSnap = await getDoc(collectionDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as Collection;
      const clientAuthUid = auth.currentUser?.uid;
      const clientCollection: ClientCollection = {
        id: docSnap.id,
        name: data.name,
        description: data.description,
        ownerId: data.ownerId,
        postIds: data.postIds || [],
        sharedWithUserIds: data.sharedWithUserIds || [],
        createdAt: (data.createdAt as Timestamp)?.toMillis() || Date.now(),
        updatedAt: (data.updatedAt as Timestamp)?.toMillis() || Date.now(),
        isSharedWithCurrentUser: clientAuthUid ? data.sharedWithUserIds.includes(clientAuthUid) : false,
      };
      console.log(`%c[collectionService] getCollectionDetails: Found collection ${collectionId}`, "color: green;");
      return clientCollection;
    }
    console.warn(`%c[collectionService] getCollectionDetails: No collection found with ID ${collectionId}`, "color: orange;");
    return null;
  } catch (error: any) {
    console.error(`[collectionService] Error fetching collection details for ${collectionId}:`, error);
    if (error.code === 'permission-denied') {
      throw new Error('Permission denied fetching collection details. Check Firestore rules.');
    }
    throw new Error(error.message || "Could not fetch collection details.");
  }
};

export const addPostToCollection = async (collectionId: string, postId: string, currentUserId: string): Promise<void> => {
  if (!collectionId || !postId || !currentUserId) {
    throw new Error("Collection ID, Post ID, and User ID are required.");
  }
  const collectionDocRef = doc(collectionsCollectionRef, collectionId);
  const collectionSnap = await getDoc(collectionDocRef);
  if (!collectionSnap.exists()) {
    throw new Error("Collection not found.");
  }
  const collectionData = collectionSnap.data() as Collection;
  if (collectionData.ownerId !== currentUserId) {
    throw new Error("Only the collection owner can add posts.");
  }

  try {
    await updateDoc(collectionDocRef, {
      postIds: arrayUnion(postId),
      updatedAt: serverTimestamp()
    });
    console.log(`[collectionService] Post ${postId} added to collection ${collectionId}`);
  } catch (error: any) {
    console.error("[collectionService] Error adding post to collection:", error);
    if (error.code === 'permission-denied') {
      throw new Error('Permission denied. Check Firestore rules.');
    }
    throw new Error(error.message || "Could not add post to collection.");
  }
};

export const removePostFromCollection = async (collectionId: string, postId: string, currentUserId: string): Promise<void> => {
  if (!collectionId || !postId || !currentUserId) {
    throw new Error("Collection ID, Post ID, and User ID are required.");
  }
  const collectionDocRef = doc(collectionsCollectionRef, collectionId);
  const collectionSnap = await getDoc(collectionDocRef);
  if (!collectionSnap.exists()) {
    throw new Error("Collection not found.");
  }
  const collectionData = collectionSnap.data() as Collection;
  if (collectionData.ownerId !== currentUserId) {
    throw new Error("Only the collection owner can remove posts.");
  }

  try {
    await updateDoc(collectionDocRef, {
      postIds: arrayRemove(postId),
      updatedAt: serverTimestamp()
    });
    console.log(`[collectionService] Post ${postId} removed from collection ${collectionId}`);
  } catch (error: any) {
    console.error("[collectionService] Error removing post from collection:", error);
    if (error.code === 'permission-denied') {
      throw new Error('Permission denied. Check Firestore rules.');
    }
    throw new Error(error.message || "Could not remove post from collection.");
  }
};

// Placeholder for fetching full post details - assumes you have a postService
// For now, it's a simplified version, you might want to use your existing postService.
export const getPostsForCollectionPage = async (collectionId: string): Promise<any[]> => {
    if (!collectionId) return [];
    const collectionDetails = await getCollectionDetails(collectionId);
    if (!collectionDetails || !collectionDetails.postIds || collectionDetails.postIds.length === 0) {
        return [];
    }

    const postPromises = collectionDetails.postIds.map(async (postId) => {
        try {
            const postDocRef = doc(db, 'posts', postId);
            const postSnap = await getDoc(postDocRef);
            if (postSnap.exists()) {
                const data = postSnap.data();
                return {
                    id: postSnap.id,
                    ...data,
                    createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
                    deadline: (data.deadline as Timestamp)?.toDate() || undefined,
                };
            }
            return null;
        } catch (error) {
            console.error(`[collectionService] Error fetching post ${postId} for collection:`, error);
            return null;
        }
    });

    const posts = (await Promise.all(postPromises)).filter(post => post !== null);
    return posts;
};

// --- Advanced Collection Management (Placeholders - To be implemented later) ---

export const updateCollectionDetails = async (
  collectionId: string,
  ownerId: string,
  updates: { name?: string; description?: string }
): Promise<void> => {
  if (!collectionId || !ownerId || Object.keys(updates).length === 0) {
    throw new Error("Collection ID, Owner ID, and updates are required.");
  }
  const collectionDocRef = doc(collectionsCollectionRef, collectionId);
  const docSnap = await getDoc(collectionDocRef);
  if (!docSnap.exists() || docSnap.data()?.ownerId !== ownerId) {
    throw new Error("Collection not found or permission denied.");
  }
  const payload: any = { ...updates, updatedAt: serverTimestamp() };
  await updateDoc(collectionDocRef, payload);
  console.log(`[collectionService] Collection ${collectionId} details updated by owner ${ownerId}`);
};

export const deleteCollection = async (collectionId: string, ownerId: string): Promise<void> => {
  if (!collectionId || !ownerId) {
    throw new Error("Collection ID and Owner ID are required.");
  }
  const collectionDocRef = doc(collectionsCollectionRef, collectionId);
  const docSnap = await getDoc(collectionDocRef);
  if (!docSnap.exists() || docSnap.data()?.ownerId !== ownerId) {
    throw new Error("Collection not found or permission denied.");
  }
  await deleteDoc(collectionDocRef);
  console.log(`[collectionService] Collection ${collectionId} deleted by owner ${ownerId}`);
};

export const shareCollectionWithUser = async (
  collectionId: string,
  ownerId: string,
  userIdToShareWith: string
): Promise<void> => {
  if (!collectionId || !ownerId || !userIdToShareWith) {
    throw new Error("All IDs are required.");
  }
  if (ownerId === userIdToShareWith) {
    throw new Error("Cannot share a collection with its owner.");
  }
  const collectionDocRef = doc(collectionsCollectionRef, collectionId);
  const docSnap = await getDoc(collectionDocRef);
  if (!docSnap.exists() || docSnap.data()?.ownerId !== ownerId) {
    throw new Error("Collection not found or permission denied to share.");
  }
  await updateDoc(collectionDocRef, {
    sharedWithUserIds: arrayUnion(userIdToShareWith),
    updatedAt: serverTimestamp()
  });
  console.log(`[collectionService] Collection ${collectionId} shared with user ${userIdToShareWith} by owner ${ownerId}`);
};

export const unshareCollectionFromUser = async (
  collectionId: string,
  ownerId: string,
  userIdToUnshare: string
): Promise<void> => {
  if (!collectionId || !ownerId || !userIdToUnshare) {
    throw new Error("All IDs are required.");
  }
  const collectionDocRef = doc(collectionsCollectionRef, collectionId);
  const docSnap = await getDoc(collectionDocRef);
  if (!docSnap.exists() || docSnap.data()?.ownerId !== ownerId) {
    throw new Error("Collection not found or permission denied to unshare.");
  }
  await updateDoc(collectionDocRef, {
    sharedWithUserIds: arrayRemove(userIdToUnshare),
    updatedAt: serverTimestamp()
  });
  console.log(`[collectionService] Collection ${collectionId} unshared from user ${userIdToUnshare} by owner ${ownerId}`);
};

    