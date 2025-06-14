
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
  type FieldValue,
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

  const qOwned = query(
    collectionsCollectionRef,
    where('ownerId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(100)
  );

  const qShared = query(
    collectionsCollectionRef,
    where('sharedWithUserIds', 'array-contains', userId),
    orderBy('createdAt', 'desc'),
    limit(100)
  );

  console.log(`%c[collectionService] getUserCollections: Preparing to execute two queries:
    1. Owned: where('ownerId', '==', '${userId}'), orderBy('createdAt', 'desc')
    2. Shared: where('sharedWithUserIds', 'array-contains', '${userId}'), orderBy('createdAt', 'desc')`, "color: dodgerblue;");

  try {
    const [ownedSnapshot, sharedSnapshot] = await Promise.all([
      getDocs(qOwned),
      getDocs(qShared),
    ]);
    console.log(`%c[collectionService] getUserCollections: Queries executed. Owned count: ${ownedSnapshot.docs.length}, Shared count: ${sharedSnapshot.docs.length}`, "color: dodgerblue;");

    const collectionsMap = new Map<string, ClientCollection>();

    const processSnapshot = (snapshot: any, isSharedCollection: boolean) => {
      snapshot.forEach((docSnap: any) => {
        if (collectionsMap.has(docSnap.id) && !isSharedCollection) return;
        if (collectionsMap.has(docSnap.id) && isSharedCollection && !collectionsMap.get(docSnap.id)?.isSharedWithCurrentUser) {
             const existing = collectionsMap.get(docSnap.id);
             if(existing) collectionsMap.set(docSnap.id, { ...existing, isSharedWithCurrentUser: true });
             return;
        }
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
          isSharedWithCurrentUser: isSharedCollection || (clientAuthUid ? data.sharedWithUserIds.includes(clientAuthUid) : false),
        };
        collectionsMap.set(docSnap.id, clientCollection);
      });
    };

    processSnapshot(ownedSnapshot, false);
    processSnapshot(sharedSnapshot, true);

    const combinedCollections = Array.from(collectionsMap.values()).sort((a, b) => b.createdAt - a.createdAt);
    console.log(`%c[collectionService] getUserCollections: Fetched ${combinedCollections.length} total collections for ${userId}.`, "color: green;");
    return combinedCollections;
  } catch (error: any) {
    console.error(`%c[collectionService] Error fetching collections for ${userId}:`, "color: red;", error);
    if (error.code === 'permission-denied') {
      console.error(`%c[collectionService] PERMISSION DENIED ERROR in getUserCollections for user '${userId}'. This almost certainly means your Firestore security rules for '/collections/{collectionId}' are not correctly allowing one or both of the queries being made.
    The queries being attempted are:
    1. For collections owned by the user: \`query(collections, where('ownerId', '==', '${userId}'), orderBy('createdAt', 'desc'))\`
    2. For collections shared with the user: \`query(collections, where('sharedWithUserIds', 'array-contains', '${userId}'), orderBy('createdAt', 'desc'))\`
    ------------------------------------------------------------------------------------
    COMMON ISSUES IN \`allow list\` RULES FOR '/collections/{collectionId}':
    - For Query 1 (owned): Ensure your rule permits listing if \`request.query.filters[0].field == 'ownerId' && request.query.filters[0].op == '==' && request.query.filters[0].value == request.auth.uid\` (or a more robust check if filter order varies).
    - For Query 2 (shared): Ensure your rule permits listing if \`request.query.filters[0].field == 'sharedWithUserIds' && request.query.filters[0].op == 'array-contains' && request.query.filters[0].value == request.auth.uid\` (or a more robust check).
    - CRITICAL: DO NOT use \`resource.data\` (e.g., \`resource.data.sharedWithUserIds.hasAny(...)\`) within an \`allow list\` rule condition when checking an \`array-contains\` query. \`list\` rules authorize the query operation based on \`request.query\` and \`request.auth\`, not by inspecting individual potential documents with \`resource.data\`.
    - The \`array-contains\` filter in the query itself is what specifies the document criteria. The rule validates if *that type of query* is allowed.
    ------------------------------------------------------------------------------------
    RECOMMENDATION: Use the Firebase Console's Rules Playground.
    1. Path: '/collections' (or '/collections/{collectionId}' if simulating with a specific doc path for 'get' checks related to rules like isCollectionOwner).
    2. Authenticated: YES, UID: '${userId}'.
    3. Operation: 'list' (for list queries) or 'get' (for read rule testing on specific documents).
    4. For 'list' simulations:
       - Query 1 (Owned): Under "Build query", add a 'where' clause: field='ownerId', op='==', value='${userId}'. Add an 'orderBy' clause: field='createdAt', direction='descending'.
       - Query 2 (Shared): Under "Build query", add a 'where' clause: field='sharedWithUserIds', op='array-contains', value='${userId}'. Add an 'orderBy' clause: field='createdAt', direction='descending'.
          - SUB-TEST for Query 2: Try it *without* the \`orderBy('createdAt', 'desc')\` clause. If this simpler query passes your rule, the combination of \`array-contains\` and \`orderBy\` on a different field is likely the core issue, possibly requiring rule adjustments or reconsidering if this specific ordering is strictly necessary for the "shared" list if it proves unsecurable with your current rule structure.
    6. Run the simulation. The playground will show you exactly which part of your \`allow list\` rule is failing or if the entire rule evaluates to false.
    7. VERIFY YOUR DEPLOYED RULES. Ensure the rules in the Firebase console match what you think they are.`, "color: red; font-weight:bold; background-color: yellow; padding: 5px;");
      console.error("  Also, ensure any necessary Firestore indexes (e.g., `ownerId` asc/desc + `createdAt` desc, AND `sharedWithUserIds` array-contains + `createdAt` desc) exist for these queries. Missing indexes usually result in 'FAILED_PRECONDITION', but complex rule interactions can sometimes manifest as 'PERMISSION_DENIED'.");
      throw new Error('Permission denied fetching collections. Check Firestore security rules and console logs. Use the Rules Playground.');
    }
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
      console.error("  Firestore query for collections requires an index. Create relevant composite indexes in the Firebase console (e.g., for ownerId/createdAt and sharedWithUserIds/createdAt queries).");
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
  ownerId: string,
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
  ownerId: string,
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
  ownerId: string,
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

    