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
import type { Post } from '@/types/post';
import type { ClientNewsArticle, NewsArticle } from '@/types/news';

const COLLECTIONS_PATH = 'collections';
const collectionsCollectionRef = collection(db, COLLECTIONS_PATH);

export const createCollection = async (
  ownerId: string,
  name: string,
  description?: string,
  initialItemId?: string,
  itemType?: 'post' | 'article'
): Promise<string> => {
  const clientAuthUid = auth.currentUser?.uid;
  if (!ownerId || !name) {
    throw new Error("Owner ID and Collection Name are required.");
  }
  if (!clientAuthUid || clientAuthUid !== ownerId) {
    throw new Error("Authentication error or user ID mismatch. Cannot create collection.");
  }

  const newCollectionData: Omit<Collection, 'id'> = {
    name: name.trim(),
    description: description?.trim() || '',
    ownerId,
    postIds: itemType === 'post' && initialItemId ? [initialItemId] : [],
    articleIds: itemType === 'article' && initialItemId ? [initialItemId] : [],
    sharedWithUserIds: [],
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
  };

  try {
    const docRef = await addDoc(collectionsCollectionRef, newCollectionData);
    return docRef.id;
  } catch (error: any) {
    throw new Error(error.message || "Could not create collection.");
  }
};

export const getUserCollections = async (userId: string): Promise<ClientCollection[]> => {
  if (!userId) return [];
  const clientAuthUid = auth.currentUser?.uid;

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

  try {
    const [ownedSnapshot, sharedSnapshot] = await Promise.all([
      getDocs(qOwned),
      getDocs(qShared),
    ]);

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
          articleIds: data.articleIds || [],
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

    return Array.from(collectionsMap.values()).sort((a, b) => b.createdAt - a.createdAt);
  } catch (error: any) {
    throw new Error(error.message || "Could not fetch collections.");
  }
};

export const getCollectionDetails = async (collectionId: string): Promise<ClientCollection | null> => {
  if (!collectionId) return null;
  const clientAuthUid = auth.currentUser?.uid;
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
        articleIds: data.articleIds || [],
        sharedWithUserIds: data.sharedWithUserIds || [],
        createdAt: (data.createdAt as Timestamp)?.toMillis() || Date.now(),
        updatedAt: (data.updatedAt as Timestamp)?.toMillis() || Date.now(),
        isSharedWithCurrentUser: clientAuthUid ? data.sharedWithUserIds.includes(clientAuthUid) : false,
      };
      return clientCollection;
    }
    return null;
  } catch (error: any) {
    throw new Error(error.message || "Could not fetch collection details.");
  }
};

export const addPostToCollection = async (collectionId: string, postId: string, currentUserId: string): Promise<void> => {
  const collectionDocRef = doc(collectionsCollectionRef, collectionId);
  const collectionSnap = await getDoc(collectionDocRef);
  if (!collectionSnap.exists()) throw new Error("Collection not found.");
  const collectionData = collectionSnap.data() as Collection;
  if (collectionData.ownerId !== currentUserId) throw new Error("Only the collection owner can add posts.");
  await updateDoc(collectionDocRef, { postIds: arrayUnion(postId), updatedAt: serverTimestamp() });
};

export const removePostFromCollection = async (collectionId: string, postId: string, currentUserId: string): Promise<void> => {
  const collectionDocRef = doc(collectionsCollectionRef, collectionId);
  const collectionSnap = await getDoc(collectionDocRef);
  if (!collectionSnap.exists()) throw new Error("Collection not found.");
  const collectionData = collectionSnap.data() as Collection;
  if (collectionData.ownerId !== currentUserId) throw new Error("Only the collection owner can remove posts.");
  await updateDoc(collectionDocRef, { postIds: arrayRemove(postId), updatedAt: serverTimestamp() });
};

export const addArticleToCollection = async (collectionId: string, articleId: string, currentUserId: string): Promise<void> => {
  const collectionDocRef = doc(collectionsCollectionRef, collectionId);
  const collectionSnap = await getDoc(collectionDocRef);
  if (!collectionSnap.exists()) throw new Error("Collection not found.");
  const collectionData = collectionSnap.data() as Collection;
  if (collectionData.ownerId !== currentUserId) throw new Error("Only the collection owner can add articles.");
  await updateDoc(collectionDocRef, { articleIds: arrayUnion(articleId), updatedAt: serverTimestamp() });
};

export const removeArticleFromCollection = async (collectionId: string, articleId: string, currentUserId: string): Promise<void> => {
  const collectionDocRef = doc(collectionsCollectionRef, collectionId);
  const collectionSnap = await getDoc(collectionDocRef);
  if (!collectionSnap.exists()) throw new Error("Collection not found.");
  const collectionData = collectionSnap.data() as Collection;
  if (collectionData.ownerId !== currentUserId) throw new Error("Only the collection owner can remove articles.");
  await updateDoc(collectionDocRef, { articleIds: arrayRemove(articleId), updatedAt: serverTimestamp() });
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
    return (await Promise.all(postPromises)).filter(post => post !== null);
};

export const getArticlesForCollectionPage = async (collectionId: string): Promise<ClientNewsArticle[]> => {
    if (!collectionId) return [];
    const collectionDetails = await getCollectionDetails(collectionId);
    if (!collectionDetails || !collectionDetails.articleIds || collectionDetails.articleIds.length === 0) {
        return [];
    }
    const articlePromises = collectionDetails.articleIds.map(async (articleId) => {
        try {
            const articleDocRef = doc(db, 'newsArticles', articleId);
            const articleSnap = await getDoc(articleDocRef);
            if (articleSnap.exists()) {
                const data = articleSnap.data() as NewsArticle;
                return {
                    id: articleSnap.id,
                    ...data,
                    createdAt: (data.createdAt as Timestamp)?.toMillis() || Date.now(),
                    updatedAt: (data.updatedAt as Timestamp)?.toMillis() || Date.now(),
                    publishedAt: data.publishedAt ? (data.publishedAt as Timestamp).toMillis() : null,
                } as ClientNewsArticle;
            }
            return null;
        } catch (error) {
            console.error(`[collectionService] Error fetching article ${articleId} for collection:`, error);
            return null;
        }
    });
    return (await Promise.all(articlePromises)).filter((article): article is ClientNewsArticle => article !== null);
};

export const updateCollectionDetails = async (collectionId: string, ownerId: string, updates: { name?: string; description?: string }): Promise<void> => {
  const clientAuthUid = auth.currentUser?.uid;
  if (!collectionId || !ownerId || Object.keys(updates).length === 0) {
    throw new Error("Collection ID, Owner ID, and updates are required.");
  }
  if (!clientAuthUid || clientAuthUid !== ownerId) {
    throw new Error("Authentication error. Cannot update collection details.");
  }
  const collectionDocRef = doc(collectionsCollectionRef, collectionId);
  const docSnap = await getDoc(collectionDocRef);
  if (!docSnap.exists() || docSnap.data()?.ownerId !== ownerId) {
    throw new Error("Collection not found or permission denied to update details.");
  }
  const payload: any = { ...updates, updatedAt: serverTimestamp() };
  if (updates.description === '') payload.description = null;
  if (updates.name !== undefined && updates.name.trim() === '') {
    throw new Error("Collection name cannot be empty.");
  }
  try {
    await updateDoc(collectionDocRef, payload);
  } catch (error: any) {
    throw new Error(error.message || "Could not update collection details.");
  }
};

export const deleteCollection = async (collectionId: string, ownerId: string): Promise<void> => {
  const clientAuthUid = auth.currentUser?.uid;
  if (!collectionId || !ownerId) {
    throw new Error("Collection ID and Owner ID are required.");
  }
  if (!clientAuthUid || clientAuthUid !== ownerId) {
    throw new Error("Authentication error. Cannot delete collection.");
  }
  const collectionDocRef = doc(collectionsCollectionRef, collectionId);
  const docSnap = await getDoc(collectionDocRef);
  if (!docSnap.exists() || docSnap.data()?.ownerId !== ownerId) {
    throw new Error("Collection not found or permission denied to delete.");
  }
  try {
    await deleteDoc(collectionDocRef);
  } catch (error: any) {
    throw new Error(error.message || "Could not delete collection.");
  }
};

// share/unshare functions remain unchanged
export const shareCollectionWithUser = async (collectionId: string, ownerId: string, userIdToShareWith: string): Promise<void> => {
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
  await updateDoc(collectionDocRef, { sharedWithUserIds: arrayUnion(userIdToShareWith), updatedAt: serverTimestamp() });
};

export const unshareCollectionFromUser = async (collectionId: string, ownerId: string, userIdToUnshare: string): Promise<void> => {
  if (!collectionId || !ownerId || !userIdToUnshare) {
    throw new Error("All IDs are required.");
  }
  const collectionDocRef = doc(collectionsCollectionRef, collectionId);
  const docSnap = await getDoc(collectionDocRef);
  if (!docSnap.exists() || docSnap.data()?.ownerId !== ownerId) {
    throw new Error("Collection not found or permission denied to unshare.");
  }
  await updateDoc(collectionDocRef, { sharedWithUserIds: arrayRemove(userIdToUnshare), updatedAt: serverTimestamp() });
};
