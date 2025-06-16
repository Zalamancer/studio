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
  orderBy,
  runTransaction,
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
    orderBy('nameLowercase', 'asc'), // Order by name first for prefix search consistency
    // then order by usageCount might be better done client-side after fetching if complex
    limit(count)
  );

  try {
    const querySnapshot = await getDocs(q);
    const tags: ClientTag[] = querySnapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data(),
      createdAt: (docSnap.data().createdAt as Timestamp).toMillis(),
    } as ClientTag));
    // Secondary sort by usageCount client-side if needed, or adjust query if Firestore allows
    return tags.sort((a, b) => b.usageCount - a.usageCount);
  } catch (error: any) {
    console.error("[tagService] Error searching tags:", error);
    throw new Error(error.message || "Could not search tags.");
  }
};


/**
 * Ensures tags exist, creates them if not, and increments their usage counts.
 * This function is transactional to ensure atomicity for usage counts.
 */
export const getOrCreateTagsAndUpdateUsage = async (tagNames: string[], userId: string, incrementBy: number = 1): Promise<void> => {
  if (!tagNames || tagNames.length === 0) return;
  if (!userId) throw new Error("User ID is required to create/update tags.");

  try {
    await runTransaction(db, async (transaction) => {
      for (const tagName of tagNames) {
        if (!tagName || tagName.trim() === '') continue;
        const nameTrimmed = tagName.trim();
        const nameLowercase = nameTrimmed.toLowerCase();

        const q = query(articleTagsCollectionRef, where('nameLowercase', '==', nameLowercase), limit(1));
        const snapshot = await transaction.get(q); // Use transaction.get

        if (snapshot.empty) {
          // Tag doesn't exist, create it
          const newTagRef = doc(articleTagsCollectionRef); // Auto-generate ID for new tag
          const newTagData: Omit<Tag, 'id'> = {
            name: nameTrimmed,
            nameLowercase: nameLowercase,
            usageCount: incrementBy > 0 ? incrementBy : 0, // Ensure non-negative for new tags
            createdAt: serverTimestamp() as Timestamp,
            createdBy: userId,
          };
          transaction.set(newTagRef, newTagData);
        } else {
          // Tag exists, update its usageCount
          const existingTagDocRef = snapshot.docs[0].ref;
          transaction.update(existingTagDocRef, {
            usageCount: increment(incrementBy)
          });
        }
      }
    });
  } catch (error: any) {
    console.error("[tagService] Error in getOrCreateTagsAndUpdateUsage transaction:", error);
    throw new Error(error.message || "Could not process tags.");
  }
};
