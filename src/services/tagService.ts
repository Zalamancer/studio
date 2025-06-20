
// src/services/tagService.ts
import { db, auth } from '@/lib/firebase/config';
import {
  collection as firestoreCollection, // Aliased to avoid conflict if needed
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
  runTransaction,
  orderBy, // Added orderBy
  // getDoc, // Not directly used in this file, but good practice if needed elsewhere
} from 'firebase/firestore';
import type { Tag, ClientTag, NewTagData } from '@/types/tag'; // Import NewTagData

const ARTICLE_TAGS_COLLECTION = 'articleTags';
// Keep a top-level reference for non-transactional operations like searchTags
const articleTagsTopLevelRef = firestoreCollection(db, ARTICLE_TAGS_COLLECTION);

/**
 * Searches for tags based on a query string (prefix match on nameLowercase).
 * Returns tags ordered by usageCount descending, then by name.
 */
export const searchTags = async (searchQuery: string, count = 10): Promise<ClientTag[]> => {
  if (!searchQuery || searchQuery.trim() === '') {
    // If query is empty, return most popular tags
    const q = query(articleTagsTopLevelRef, orderBy('usageCount', 'desc'), orderBy('nameLowercase', 'asc'), limit(count));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data(),
      createdAt: (docSnap.data().createdAt as Timestamp).toMillis(),
      usageCount: docSnap.data().usageCount || 0, // Ensure usageCount is a number
    } as ClientTag));
  }

  const lowerQuery = searchQuery.toLowerCase();
  const q = query(
    articleTagsTopLevelRef,
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
      usageCount: docSnap.data().usageCount || 0, // Ensure usageCount is a number
    } as ClientTag));
    return tags.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0)); // Sort by usageCount on client
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

  const firestoreDb = db; // Use the configured db instance

  try {
    await runTransaction(firestoreDb, async (transaction) => {
      // Re-create collection reference INSIDE the transaction using the db instance
      const articleTagsCollectionRefInTransaction = firestoreCollection(firestoreDb, ARTICLE_TAGS_COLLECTION);

      for (const tagName of tagNames) {
        if (!tagName || tagName.trim() === '') continue;
        const nameTrimmed = tagName.trim();
        const nameLowercase = nameTrimmed.toLowerCase();

        // Query for the tag using the transaction-scoped collection reference
        const q = query(articleTagsCollectionRefInTransaction, where('nameLowercase', '==', nameLowercase));
        
        // console.log('[tagService] Inside transaction. About to call transaction.get(). Query constructed with transaction-scoped ref.');
        const snapshot = await transaction.get(q); 

        if (snapshot.docs.length === 0) {
          // Tag doesn't exist, create it
          const newTagRef = doc(articleTagsCollectionRefInTransaction); // Create a new doc ref in the transaction-scoped collection
          const newTagData: NewTagData = { // Use NewTagData type
            name: nameTrimmed,
            nameLowercase: nameLowercase,
            usageCount: incrementBy > 0 ? incrementBy : 0,
            createdAt: serverTimestamp(), // No 'as Timestamp'
            createdBy: userId,
          };
          transaction.set(newTagRef, newTagData);
        } else {
          // Tag exists, update it
          const existingTagDocRef = snapshot.docs[0].ref;
          const currentUsageCount = snapshot.docs[0].data().usageCount || 0;
          const newUsageCount = currentUsageCount + incrementBy;
          
          transaction.update(existingTagDocRef, {
            usageCount: newUsageCount < 0 ? 0 : newUsageCount, // Ensure usageCount doesn't go below 0
            // Optionally update an 'updatedAt' field if you have one
            // updatedAt: serverTimestamp()
          });
        }
      }
    });
  } catch (error: any) {
    console.error("[tagService] Error in getOrCreateTagsAndUpdateUsage transaction:", error);
    if (error.message && (error.message.toLowerCase().includes("t is undefined") || error.message.toLowerCase().includes("transaction is undefined"))) {
      console.error("[tagService] Critical SDK error within transaction.get(). Transaction object or its context might be invalid.");
    }
    throw new Error(error.message || "Could not process tags.");
  }
};
    
