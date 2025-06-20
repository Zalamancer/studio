
// src/services/tagService.ts
import { db, auth } from '@/lib/firebase/config';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  increment,
  serverTimestamp,
  Timestamp,
  writeBatch,
  limit,
  runTransaction, // Explicitly ensure runTransaction is from the correct import
  // getDoc, // Not directly used in this file, but good practice if needed elsewhere
} from 'firebase/firestore';
import type { Tag, ClientTag } from '@/types/tag';

const ARTICLE_TAGS_COLLECTION = 'articleTags';
const articleTagsCollectionRef = collection(db, ARTICLE_TAGS_COLLECTION);

/**
 * Searches for tags based on a query string (prefix match on nameLowercase).
 * Returns tags ordered by usageCount descending, then by name.
 */
export const searchTags = async (searchQuery: string, count = 10): Promise<ClientTag[]> => {
  if (!searchQuery || searchQuery.trim() === '') {
    // If query is empty, return most popular tags
    const q = query(articleTagsCollectionRef, orderBy('usageCount', 'desc'), orderBy('nameLowercase', 'asc'), limit(count));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data(),
      createdAt: (docSnap.data().createdAt as Timestamp).toMillis(),
    } as ClientTag));
  }

  const lowerQuery = searchQuery.toLowerCase();
  const q = query(
    articleTagsCollectionRef,
    where('nameLowercase', '>=', lowerQuery),
    where('nameLowercase', '<=', lowerQuery + '\uf8ff'),
    orderBy('nameLowercase', 'asc'),
    limit(count)
  );

  try {
    const querySnapshot = await getDocs(q);
    const tags: ClientTag[] = querySnapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data(),
      createdAt: (docSnap.data().createdAt as Timestamp).toMillis(),
    } as ClientTag));
    return tags.sort((a, b) => b.usageCount - a.usageCount);
  } catch (error: any) {
    console.error("[tagService] Error searching tags:", error);
    throw new Error(error.message || "Could not search tags.");
  }
};


/**
 * Ensures tags exist, creates them if not, and increments/decrements their usage counts.
 * This function is transactional to ensure atomicity for usage counts.
 */
export const getOrCreateTagsAndUpdateUsage = async (tagNames: string[], userId: string, incrementBy: number = 1): Promise<void> => {
  if (!tagNames || tagNames.length === 0) return;
  if (!userId) throw new Error("User ID is required to create/update tags.");

  // Using the imported db instance directly in runTransaction
  const firestoreDb = db;

  try {
    await runTransaction(firestoreDb, async (transaction) => {
      for (const tagName of tagNames) {
        if (!tagName || tagName.trim() === '') continue;
        const nameTrimmed = tagName.trim();
        const nameLowercase = nameTrimmed.toLowerCase();

        // Query object constructed with imported functions
        const q = query(articleTagsCollectionRef, where('nameLowercase', '==', nameLowercase), limit(1));
        
        // console.log('[tagService] Inside transaction. About to call transaction.get(). Query:', q);
        // console.log('[tagService] Transaction object type:', typeof transaction, 'Has get method:', typeof transaction?.get === 'function');

        const snapshot = await transaction.get(q); // Line 82 - error occurs here

        if (snapshot.empty) {
          const newTagRef = doc(articleTagsCollectionRef);
          const newTagData: Omit<Tag, 'id'> = {
            name: nameTrimmed,
            nameLowercase: nameLowercase,
            usageCount: incrementBy > 0 ? incrementBy : 0,
            createdAt: serverTimestamp() as Timestamp,
            createdBy: userId,
          };
          transaction.set(newTagRef, newTagData);
        } else {
          const existingTagDocRef = snapshot.docs[0].ref;
          // increment function imported from firebase/firestore
          transaction.update(existingTagDocRef, {
            usageCount: increment(incrementBy)
          });
        }
      }
    });
  } catch (error: any) {
    console.error("[tagService] Error in getOrCreateTagsAndUpdateUsage transaction:", error);
    // Log more details if it's the specific error
    if (error.message && error.message.toLowerCase().includes("t is undefined") || error.message.toLowerCase().includes("transaction is undefined")) {
      console.error("[tagService] Critical SDK error within transaction.get(). Transaction object or its context might be invalid.");
    }
    throw new Error(error.message || "Could not process tags.");
  }
};
