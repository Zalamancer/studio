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
  limit,
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
  const clientAuthUid = auth.currentUser?.uid;
  console.log(`%c[collectionService] createCollection: Called by auth UID: '${clientAuthUid || 'NULL'}'. Target ownerId: '${ownerId}', Name: '${name}'`, "color: #007bff; font-weight: bold;");

  if (!ownerId || !name) {
    console.error("[collectionService] createCollection: Owner ID and Collection Name are required.");
    throw new Error("Owner ID and Collection Name are required.");
  }
  if (!clientAuthUid || clientAuthUid !== ownerId) {
    console.error(`[collectionService] createCollection: Auth mismatch or not authenticated. Client UID: ${clientAuthUid}, ownerId param: ${ownerId}`);
    throw new Error("Authentication error or user ID mismatch. Cannot create collection.");
  }

  const newCollectionData: Omit<Collection, 'id'> = {
    name: name.trim(),
    description: description?.trim() || '',
    ownerId,
    postIds: initialPostId ? [initialPostId] : [],
    sharedWithUserIds: [],
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
  };

  console.log('%c[collectionService] createCollection: Data to be written to Firestore:', "color: #007bff;", newCollectionData);
  console.log('%c  Rule check reminder: `isAuthenticated() && request.resource.data.ownerId == request.auth.uid && isNotEmpty(request.resource.data.name) && request.resource.data.createdAt == request.time && ...`', "color: #6c757d;");

  try {
    const docRef = await addDoc(collectionsCollectionRef, newCollectionData);
    console.log(`%c[collectionService] Collection created successfully by ${ownerId} with ID: ${docRef.id}`, "color: green;");
    return docRef.id;
  } catch (error: any) {
    console.error(`%c[collectionService] Error creating collection for owner ${ownerId}:`, "color: red; font-weight: bold;", error);
    console.error(`  Error Code: ${error.code}, Message: ${error.message}`);
    if (error.code === 'permission-denied') {
      console.error("  Ensure Firestore rules allow `create` on `/collections/{collectionId}` with conditions: authenticated user, ownerId matches auth.uid, required fields present (name, timestamps, postIds list, sharedWithUserIds list), and no extra fields.");
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
    // Test 1: Basic read with just where clause
    const testQuery1 = query(
      collectionsCollectionRef,
      where('ownerId', '==', userId),
      limit(1)
    );
    console.log('%c[collectionService] Test 1 - Basic where query:', "color: dodgerblue;", testQuery1);
    const testSnapshot1 = await getDocs(testQuery1);
    console.log('%c[collectionService] Test 1 result:', "color: dodgerblue;", testSnapshot1.empty ? 'No documents found' : 'Found documents');

    // Test 2: Try just orderBy without where
    const testQuery2 = query(
      collectionsCollectionRef,
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    console.log('%c[collectionService] Test 2 - Just orderBy query:', "color: dodgerblue;", testQuery2);
    try {
      const testSnapshot2 = await getDocs(testQuery2);
      console.log('%c[collectionService] Test 2 result:', "color: dodgerblue;", testSnapshot2.empty ? 'No documents found' : 'Found documents');
    } catch (error: any) {
      console.log('%c[collectionService] Test 2 error:', "color: orange;", error.message);
      if (error.code === 'failed-precondition') {
        console.log('%c[collectionService] Test 2: This error suggests we need a composite index', "color: orange;");
      }
    }

    // Test 3: Try the compound query with limit
    const testQuery3 = query(
      collectionsCollectionRef,
      where('ownerId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    console.log('%c[collectionService] Test 3 - Compound query with limit:', "color: dodgerblue;", testQuery3);
    try {
      const testSnapshot3 = await getDocs(testQuery3);
      console.log('%c[collectionService] Test 3 result:', "color: dodgerblue;", testSnapshot3.empty ? 'No documents found' : 'Found documents');
    } catch (error: any) {
      console.log('%c[collectionService] Test 3 error:', "color: orange;", error.message);
      if (error.code === 'failed-precondition') {
        console.log('%c[collectionService] Test 3: This error suggests we need a composite index', "color: orange;");
      }
    }

    // If we get here, try the original queries with limits
    const ownedFilters = [where('ownerId', '==', userId)];
    const sharedFilters = [where('sharedWithUserIds', 'array-contains', userId)];
    const commonOptions = [orderBy('createdAt', 'desc'), limit(100)];

    const qOwned = query(
      collectionsCollectionRef,
      ...ownedFilters,
      ...commonOptions
    );
    console.log('%c[collectionService] Full owned collections query:', "color: dodgerblue;", {
      filters: qOwned._query.filters,
      orderBy: qOwned._query.orderBy,
      limit: qOwned._query.limit,
      startAt: qOwned._query.startAt,
      endAt: qOwned._query.endAt,
      rawQuery: JSON.stringify(qOwned._query, null, 2)
    });

    const qShared = query(
      collectionsCollectionRef,
      ...sharedFilters,
      ...commonOptions
    );
    console.log('%c[collectionService] Full shared collections query:', "color: dodgerblue;", {
      filters: qShared._query.filters.map(f => ({
        field: f.field,
        op: f.op,
        value: f.value
      })),
      orderBy: qShared._query.orderBy,
      limit: qShared._query.limit,
      startAt: qShared._query.startAt,
      endAt: qShared._query.endAt,
      rawQuery: JSON.stringify(qShared._query, null, 2)
    });

    try {
      // Define processSnapshot before using it
      const processSnapshot = (snapshot: any, isSharedCollection: boolean) => {
        snapshot.forEach((docSnap: any) => {
          if (collectionsMap.has(docSnap.id)) return; 

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

      // Initialize collections map
      const collectionsMap = new Map<string, ClientCollection>();

      // Try each query separately to isolate any issues
      console.log('%c[collectionService] Attempting owned collections query...', "color: dodgerblue;");
      const ownedSnapshot = await getDocs(qOwned);
      console.log('%c[collectionService] Owned query successful, got', "color: green;", ownedSnapshot.size, 'documents');

      // Log the owned collections to see if any are shared
      ownedSnapshot.forEach((doc: any) => {
        const data = doc.data();
        console.log('%c[collectionService] Owned collection:', "color: dodgerblue;", {
          id: doc.id,
          name: data.name,
          sharedWithUserIds: data.sharedWithUserIds || []
        });
      });

      // Process owned collections
      processSnapshot(ownedSnapshot, false);

      // Only attempt shared collections query if we have any owned collections that are shared
      const hasSharedCollections = Array.from(ownedSnapshot.docs).some((doc: any) => {
        const data = doc.data();
        return (data.sharedWithUserIds || []).length > 0;
      });

      if (hasSharedCollections) {
        console.log('%c[collectionService] Found owned collections with sharing, attempting shared collections query...', "color: dodgerblue;");
        try {
          const sharedSnapshot = await getDocs(qShared);
          console.log('%c[collectionService] Shared query successful, got', "color: green;", sharedSnapshot.size, 'documents');
          processSnapshot(sharedSnapshot, true);
        } catch (error: any) {
          // Log but don't throw - it's okay if there are no shared collections
          console.log('%c[collectionService] No shared collections found (this is normal if no collections are shared with you)', "color: orange;");
        }
      } else {
        console.log('%c[collectionService] No owned collections are shared, skipping shared collections query', "color: dodgerblue;");
      }

      const combinedCollections = Array.from(collectionsMap.values()).sort((a, b) => b.createdAt - a.createdAt);
      console.log(`%c[collectionService] getUserCollections: Fetched ${combinedCollections.length} total collections for ${userId}.`, "color: green;");
      return combinedCollections;
    } catch (error: any) {
      console.error(`[collectionService] Error fetching collections for ${userId}:`, "color: red;", error);
      if (error.code === 'permission-denied') {
        console.error("  Ensure Firestore rules allow `list` on `/collections` where `ownerId == request.auth.uid` OR `request.auth.uid in resource.data.sharedWithUserIds`.");
        throw new Error('Permission denied fetching collections. Check Firestore rules.');
      }
      if (error.code === 'failed-precondition' && error.message.includes('index')) {
        console.error("  Firestore query for collections requires an index. Create relevant composite indexes in the Firebase console.");
        throw new Error("Firestore query requires an index for collections. Please create it.");
      }
      throw new Error(error.message || "Could not fetch collections.");
    }
  } catch (error: any) {
    console.error(`[collectionService] Error fetching collections for ${userId}:`, "color: red;", error);
    if (error.code === 'permission-denied') {
      console.error("  Ensure Firestore rules allow `list` on `/collections` where `ownerId == request.auth.uid` OR `request.auth.uid in resource.data.sharedWithUserIds`.");
      throw new Error('Permission denied fetching collections. Check Firestore rules.');
    }
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
      console.error("  Firestore query for collections requires an index. Create relevant composite indexes in the Firebase console.");
      throw new Error("Firestore query requires an index for collections. Please create it.");
    }
    throw new Error(error.message || "Could not fetch collections.");
  }
};


export const getCollectionDetails = async (collectionId: string): Promise<ClientCollection | null> => {
  if (!collectionId) {
    console.warn("[collectionService] getCollectionDetails: No collectionId provided.");
    return null;
  }
  const clientAuthUid = auth.currentUser?.uid;
  console.log(`%c[collectionService] getCollectionDetails: Fetching for collectionId: '${collectionId}'. Client auth UID: '${clientAuthUid || 'NULL'}'`, "color: dodgerblue;");
  const collectionDocRef = doc(collectionsCollectionRef, collectionId);
  try {
    const docSnap = await getDoc(collectionDocRef);
    if (docSnap.exists()) {
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
        isSharedWithCurrentUser: clientAuthUid ? data.sharedWithUserIds.includes(clientAuthUid) : false,
      };
      console.log(`%c[collectionService] getCollectionDetails: Found collection ${collectionId}`, "color: green;");
      return clientCollection;
    }
    console.warn(`%c[collectionService] getCollectionDetails: No collection found with ID ${collectionId}`, "color: orange;");
    return null;
  } catch (error: any) {
    console.error(`[collectionService] Error fetching collection details for ${collectionId}:`, "color: red;", error);
    if (error.code === 'permission-denied') {
      console.error("  Ensure Firestore rules allow `get` on `/collections/{collectionId}` where `request.auth.uid == resource.data.ownerId` OR `request.auth.uid in resource.data.sharedWithUserIds`.");
      throw new Error('Permission denied fetching collection details. Check Firestore rules.');
    }
    throw new Error(error.message || "Could not fetch collection details.");
  }
};

export const addPostToCollection = async (collectionId: string, postId: string, currentUserId: string): Promise<void> => {
  const clientAuthUid = auth.currentUser?.uid;
  console.log(`%c[collectionService] addPostToCollection: Called by auth UID: '${clientAuthUid || 'NULL'}'. CurrentUserId param: '${currentUserId}'. CollectionID: '${collectionId}', PostID: '${postId}'`, "color: #007bff; font-weight: bold;");

  if (!collectionId || !postId || !currentUserId) {
    console.error("[collectionService] addPostToCollection: Collection ID, Post ID, and User ID are required.");
    throw new Error("Collection ID, Post ID, and User ID are required.");
  }
  if (!clientAuthUid || clientAuthUid !== currentUserId) {
    console.error(`[collectionService] addPostToCollection: Auth mismatch or not authenticated. Client UID: ${clientAuthUid}, currentUserId param: ${currentUserId}`);
    throw new Error("Authentication error. Cannot add post to collection.");
  }

  const collectionDocRef = doc(collectionsCollectionRef, collectionId);
  const collectionSnap = await getDoc(collectionDocRef);
  if (!collectionSnap.exists()) {
    console.error(`[collectionService] addPostToCollection: Collection ${collectionId} not found.`);
    throw new Error("Collection not found.");
  }
  const collectionData = collectionSnap.data() as Collection;
  if (collectionData.ownerId !== currentUserId) {
    console.error(`[collectionService] addPostToCollection: User ${currentUserId} is not the owner of collection ${collectionId}. Owner is ${collectionData.ownerId}.`);
    throw new Error("Only the collection owner can add posts.");
  }

  const updatePayload = {
    postIds: arrayUnion(postId),
    updatedAt: serverTimestamp()
  };
  console.log('%c[collectionService] addPostToCollection: Data to be updated in Firestore:', "color: #007bff;", updatePayload);
  console.log('%c  Rule check reminder: `isAuthenticated() && isCollectionOwner() && request.resource.data.updatedAt == request.time && request.resource.data.diff(resource.data).affectedKeys().hasOnly(["postIds", "updatedAt"])`', "color: #6c757d;");


  try {
    await updateDoc(collectionDocRef, updatePayload);
    console.log(`%c[collectionService] Post ${postId} added to collection ${collectionId}`, "color: green;");
  } catch (error: any) {
    console.error(`%c[collectionService] Error adding post to collection ${collectionId}:`, "color: red; font-weight: bold;", error);
    console.error(`  Error Code: ${error.code}, Message: ${error.message}`);
    if (error.code === 'permission-denied') {
      console.error("  Ensure Firestore rules allow `update` on `/collections/{collectionId}` where `request.auth.uid == resource.data.ownerId`, `updatedAt` is server time, and only `postIds` or `sharedWithUserIds` fields are being changed (plus `name` and `description`).");
    }
    throw new Error(error.message || "Could not add post to collection.");
  }
};

export const removePostFromCollection = async (collectionId: string, postId: string, currentUserId: string): Promise<void> => {
  const clientAuthUid = auth.currentUser?.uid;
  console.log(`%c[collectionService] removePostFromCollection: Called by auth UID: '${clientAuthUid || 'NULL'}'. CurrentUserId param: '${currentUserId}'. CollectionID: '${collectionId}', PostID: '${postId}'`, "color: #007bff; font-weight: bold;");

  if (!collectionId || !postId || !currentUserId) {
    console.error("[collectionService] removePostFromCollection: Collection ID, Post ID, and User ID are required.");
    throw new Error("Collection ID, Post ID, and User ID are required.");
  }
   if (!clientAuthUid || clientAuthUid !== currentUserId) {
    console.error(`[collectionService] removePostFromCollection: Auth mismatch or not authenticated. Client UID: ${clientAuthUid}, currentUserId param: ${currentUserId}`);
    throw new Error("Authentication error. Cannot remove post from collection.");
  }

  const collectionDocRef = doc(collectionsCollectionRef, collectionId);
  const collectionSnap = await getDoc(collectionDocRef);
  if (!collectionSnap.exists()) {
    console.error(`[collectionService] removePostFromCollection: Collection ${collectionId} not found.`);
    throw new Error("Collection not found.");
  }
  const collectionData = collectionSnap.data() as Collection;
  if (collectionData.ownerId !== currentUserId) {
    console.error(`[collectionService] removePostFromCollection: User ${currentUserId} is not the owner of collection ${collectionId}. Owner is ${collectionData.ownerId}.`);
    throw new Error("Only the collection owner can remove posts.");
  }

  const updatePayload = {
    postIds: arrayRemove(postId),
    updatedAt: serverTimestamp()
  };
  console.log('%c[collectionService] removePostFromCollection: Data to be updated in Firestore:', "color: #007bff;", updatePayload);
  console.log('%c  Rule check reminder: (Similar to addPostToCollection, ensuring ownership and allowed fields for update)', "color: #6c757d;");

  try {
    await updateDoc(collectionDocRef, updatePayload);
    console.log(`%c[collectionService] Post ${postId} removed from collection ${collectionId}`, "color: green;");
  } catch (error: any) {
    console.error(`%c[collectionService] Error removing post from collection ${collectionId}:`, "color: red; font-weight: bold;", error);
    console.error(`  Error Code: ${error.code}, Message: ${error.message}`);
    if (error.code === 'permission-denied') {
      console.error("  Ensure Firestore rules allow `update` on `/collections/{collectionId}` with correct ownership and field checks.");
    }
    throw new Error(error.message || "Could not remove post from collection.");
  }
};

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

export const updateCollectionDetails = async (
  collectionId: string,
  ownerId: string, // ownerId is the current authenticated user's ID performing the action
  updates: { name?: string; description?: string }
): Promise<void> => {
  const clientAuthUid = auth.currentUser?.uid;
  console.log(`%c[collectionService] updateCollectionDetails: Called by auth UID: '${clientAuthUid || 'NULL'}'. OwnerId param: '${ownerId}'. CollectionID: '${collectionId}', Updates:`, "color: #007bff; font-weight: bold;", updates);

  if (!collectionId || !ownerId || Object.keys(updates).length === 0) {
    console.error("[collectionService] updateCollectionDetails: Collection ID, Owner ID, and updates are required.");
    throw new Error("Collection ID, Owner ID, and updates are required.");
  }
  if (!clientAuthUid || clientAuthUid !== ownerId) {
    console.error(`[collectionService] updateCollectionDetails: Auth mismatch or not authenticated. Client UID: ${clientAuthUid}, ownerId param: ${ownerId}`);
    throw new Error("Authentication error. Cannot update collection details.");
  }

  const collectionDocRef = doc(collectionsCollectionRef, collectionId);
  const docSnap = await getDoc(collectionDocRef);
  if (!docSnap.exists() || docSnap.data()?.ownerId !== ownerId) {
    console.error(`[collectionService] updateCollectionDetails: Collection ${collectionId} not found or user ${ownerId} is not the owner. Actual owner: ${docSnap.data()?.ownerId}`);
    throw new Error("Collection not found or permission denied to update details.");
  }

  const payload: any = { ...updates, updatedAt: serverTimestamp() };
  // Ensure empty strings become null for description if that's desired behavior
  if (updates.description === '') payload.description = null;
  if (updates.name !== undefined && updates.name.trim() === '') {
    console.error("[collectionService] updateCollectionDetails: Collection name cannot be empty.");
    throw new Error("Collection name cannot be empty.");
  }


  console.log('%c[collectionService] updateCollectionDetails: Data to be updated in Firestore:', "color: #007bff;", payload);
  console.log('%c  Rule check reminder: `isAuthenticated() && isCollectionOwner() && request.resource.data.ownerId == resource.data.ownerId && request.resource.data.createdAt == resource.data.createdAt && request.resource.data.updatedAt == request.time && request.resource.data.diff(resource.data).affectedKeys().hasOnly(["name", "description", "postIds", "sharedWithUserIds", "updatedAt"])`', "color: #6c757d;");

  try {
    await updateDoc(collectionDocRef, payload);
    console.log(`%c[collectionService] Collection ${collectionId} details updated successfully by owner ${ownerId}`, "color: green;");
  } catch (error: any) {
    console.error(`%c[collectionService] Error updating collection ${collectionId} details:`, "color: red; font-weight: bold;", error);
    console.error(`  Error Code: ${error.code}, Message: ${error.message}`);
    if (error.code === 'permission-denied') {
      console.error("  Ensure Firestore rules allow `update` on `/collections/{collectionId}` with correct ownership, immutable field checks (ownerId, createdAt), and whitelisted fields for changes (name, description, postIds, sharedWithUserIds, updatedAt).");
    }
    throw new Error(error.message || "Could not update collection details.");
  }
};

export const deleteCollection = async (collectionId: string, ownerId: string): Promise<void> => {
  const clientAuthUid = auth.currentUser?.uid;
  console.log(`%c[collectionService] deleteCollection: Called by auth UID: '${clientAuthUid || 'NULL'}'. OwnerId param: '${ownerId}'. CollectionID: '${collectionId}'`, "color: #007bff; font-weight: bold;");

  if (!collectionId || !ownerId) {
    console.error("[collectionService] deleteCollection: Collection ID and Owner ID are required.");
    throw new Error("Collection ID and Owner ID are required.");
  }
  if (!clientAuthUid || clientAuthUid !== ownerId) {
    console.error(`[collectionService] deleteCollection: Auth mismatch or not authenticated. Client UID: ${clientAuthUid}, ownerId param: ${ownerId}`);
    throw new Error("Authentication error. Cannot delete collection.");
  }

  const collectionDocRef = doc(collectionsCollectionRef, collectionId);
  const docSnap = await getDoc(collectionDocRef);
  if (!docSnap.exists() || docSnap.data()?.ownerId !== ownerId) {
    console.error(`[collectionService] deleteCollection: Collection ${collectionId} not found or user ${ownerId} is not the owner. Actual owner: ${docSnap.data()?.ownerId}`);
    throw new Error("Collection not found or permission denied to delete.");
  }

  console.log('%c[collectionService] deleteCollection: Preparing to delete collection from Firestore.', "color: #007bff;");
  console.log('%c  Rule check reminder: `isAuthenticated() && isCollectionOwner()`', "color: #6c757d;");


  try {
    await deleteDoc(collectionDocRef);
    console.log(`%c[collectionService] Collection ${collectionId} deleted successfully by owner ${ownerId}`, "color: green;");
  } catch (error: any) {
    console.error(`%c[collectionService] Error deleting collection ${collectionId}:`, "color: red; font-weight: bold;", error);
    console.error(`  Error Code: ${error.code}, Message: ${error.message}`);
    if (error.code === 'permission-denied') {
      console.error("  Ensure Firestore rules allow `delete` on `/collections/{collectionId}` where `request.auth.uid == resource.data.ownerId`.");
    }
    throw new Error(error.message || "Could not delete collection.");
  }
};

export const shareCollectionWithUser = async (
  collectionId: string,
  ownerId: string, // Current authenticated user who owns the collection
  userIdToShareWith: string
): Promise<void> => {
  const clientAuthUid = auth.currentUser?.uid;
  console.log(`%c[collectionService] shareCollectionWithUser: Called by auth UID: '${clientAuthUid || 'NULL'}'. OwnerId param: '${ownerId}'. CollectionID: '${collectionId}', UserToShareWith: '${userIdToShareWith}'`, "color: #007bff; font-weight: bold;");

  if (!collectionId || !ownerId || !userIdToShareWith) {
    console.error("[collectionService] shareCollectionWithUser: All IDs are required.");
    throw new Error("All IDs are required.");
  }
  if (!clientAuthUid || clientAuthUid !== ownerId) {
    console.error(`[collectionService] shareCollectionWithUser: Auth mismatch or not authenticated. Client UID: ${clientAuthUid}, ownerId param: ${ownerId}`);
    throw new Error("Authentication error. Cannot share collection.");
  }
  if (ownerId === userIdToShareWith) {
    console.warn("[collectionService] shareCollectionWithUser: Cannot share a collection with its owner.");
    throw new Error("Cannot share a collection with its owner.");
  }

  const collectionDocRef = doc(collectionsCollectionRef, collectionId);
  const docSnap = await getDoc(collectionDocRef);
  if (!docSnap.exists() || docSnap.data()?.ownerId !== ownerId) {
    console.error(`[collectionService] shareCollectionWithUser: Collection ${collectionId} not found or user ${ownerId} is not the owner. Actual owner: ${docSnap.data()?.ownerId}`);
    throw new Error("Collection not found or permission denied to share.");
  }

  const updatePayload = {
    sharedWithUserIds: arrayUnion(userIdToShareWith),
    updatedAt: serverTimestamp()
  };
  console.log('%c[collectionService] shareCollectionWithUser: Data to be updated in Firestore:', "color: #007bff;", updatePayload);
  console.log('%c  Rule check reminder: (Similar to addPostToCollection, ensuring ownership and allowed fields for update, specifically `sharedWithUserIds`)', "color: #6c757d;");

  try {
    await updateDoc(collectionDocRef, updatePayload);
    console.log(`%c[collectionService] Collection ${collectionId} shared successfully with user ${userIdToShareWith} by owner ${ownerId}`, "color: green;");
  } catch (error: any) {
    console.error(`%c[collectionService] Error sharing collection ${collectionId} with user ${userIdToShareWith}:`, "color: red; font-weight: bold;", error);
    console.error(`  Error Code: ${error.code}, Message: ${error.message}`);
     if (error.code === 'permission-denied') {
      console.error("  Ensure Firestore rules allow `update` on `/collections/{collectionId}` with correct ownership and that `sharedWithUserIds` is an allowed field for modification.");
    }
    throw new Error(error.message || "Could not share collection.");
  }
};

export const unshareCollectionFromUser = async (
  collectionId: string,
  ownerId: string, // Current authenticated user who owns the collection
  userIdToUnshare: string
): Promise<void> => {
  const clientAuthUid = auth.currentUser?.uid;
  console.log(`%c[collectionService] unshareCollectionFromUser: Called by auth UID: '${clientAuthUid || 'NULL'}'. OwnerId param: '${ownerId}'. CollectionID: '${collectionId}', UserToUnshare: '${userIdToUnshare}'`, "color: #007bff; font-weight: bold;");

  if (!collectionId || !ownerId || !userIdToUnshare) {
    console.error("[collectionService] unshareCollectionFromUser: All IDs are required.");
    throw new Error("All IDs are required.");
  }
  if (!clientAuthUid || clientAuthUid !== ownerId) {
    console.error(`[collectionService] unshareCollectionFromUser: Auth mismatch or not authenticated. Client UID: ${clientAuthUid}, ownerId param: ${ownerId}`);
    throw new Error("Authentication error. Cannot unshare collection.");
  }

  const collectionDocRef = doc(collectionsCollectionRef, collectionId);
  const docSnap = await getDoc(collectionDocRef);
  if (!docSnap.exists() || docSnap.data()?.ownerId !== ownerId) {
    console.error(`[collectionService] unshareCollectionFromUser: Collection ${collectionId} not found or user ${ownerId} is not the owner. Actual owner: ${docSnap.data()?.ownerId}`);
    throw new Error("Collection not found or permission denied to unshare.");
  }

  const updatePayload = {
    sharedWithUserIds: arrayRemove(userIdToUnshare),
    updatedAt: serverTimestamp()
  };
  console.log('%c[collectionService] unshareCollectionFromUser: Data to be updated in Firestore:', "color: #007bff;", updatePayload);
  console.log('%c  Rule check reminder: (Similar to shareCollectionWithUser)', "color: #6c757d;");

  try {
    await updateDoc(collectionDocRef, updatePayload);
    console.log(`%c[collectionService] Collection ${collectionId} unshared successfully from user ${userIdToUnshare} by owner ${ownerId}`, "color: green;");
  } catch (error: any) {
    console.error(`%c[collectionService] Error unsharing collection ${collectionId} from user ${userIdToUnshare}:`, "color: red; font-weight: bold;", error);
    console.error(`  Error Code: ${error.code}, Message: ${error.message}`);
    if (error.code === 'permission-denied') {
      console.error("  Ensure Firestore rules allow `update` on `/collections/{collectionId}` with correct ownership and that `sharedWithUserIds` is an allowed field for modification.");
    }
    throw new Error(error.message || "Could not unshare collection.");
  }
};
