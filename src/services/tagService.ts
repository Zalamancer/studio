
// src/services/tagService.ts
import { db, auth } from '@/lib/firebase/config';
import {
  collection as firestoreCollection,
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
  orderBy,
  type FieldValue,
} from 'firebase/firestore';
import type { Tag, ClientTag, NewTagData } from '@/types/tag';

const ARTICLE_TAGS_COLLECTION = 'articleTags';

/**
 * Searches for tags based on a query string (prefix match on nameLowercase).
 * Returns tags ordered by usageCount descending, then by name.
 */
export const searchTags = async (searchQuery: string, count = 10): Promise<ClientTag[]> => {
  const articleTagsCollectionRef = firestoreCollection(db, ARTICLE_TAGS_COLLECTION); // Define ref here

  if (!searchQuery || searchQuery.trim() === '') {
    const q = query(articleTagsCollectionRef, orderBy('usageCount', 'desc'), orderBy('nameLowercase', 'asc'), limit(count));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data(),
      createdAt: (docSnap.data().createdAt as Timestamp).toMillis(),
      updatedAt: (docSnap.data().updatedAt as Timestamp)?.toMillis(),
      usageCount: docSnap.data().usageCount || 0,
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
      updatedAt: (docSnap.data().updatedAt as Timestamp)?.toMillis(),
      usageCount: docSnap.data().usageCount || 0,
    } as ClientTag));
    return tags.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
  } catch (error: any) {
    console.error("[tagService] Error searching tags:", error);
    throw new Error(error.message || "Could not search tags.");
  }
};


/**
 * Ensures tags exist, creates them if not, and increments/decrements their usage counts.
 * This function is refactored to AVOID transactions to bypass a potential SDK/environment bug.
 * Note: This is less robust against high-concurrency race conditions for creating the same new tag.
 */
export const getOrCreateTagsAndUpdateUsage = async (tagNames: string[], userId: string, incrementBy: number = 1): Promise<void> => {
  if (!tagNames || tagNames.length === 0) return;
  if (!userId) throw new Error("User ID is required to create/update tags.");

  const articleTagsCollectionRef = firestoreCollection(db, ARTICLE_TAGS_COLLECTION);

  for (const tagName of tagNames) {
    if (!tagName || tagName.trim() === '') continue;
    const nameTrimmed = tagName.trim();
    const nameLowercase = nameTrimmed.toLowerCase();

    try {
      const q = query(articleTagsCollectionRef, where('nameLowercase', '==', nameLowercase), limit(1));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        // Tag doesn't exist, create it.
        if (incrementBy > 0) { // Only create if we are adding usage
          const newTagData: NewTagData = {
            name: nameTrimmed,
            nameLowercase: nameLowercase,
            usageCount: incrementBy, // Start with the increment value
            createdAt: serverTimestamp() as FieldValue,
            createdBy: userId,
            updatedAt: serverTimestamp() as FieldValue,
          };
          await addDoc(articleTagsCollectionRef, newTagData);
        }
      } else {
        // Tag exists, update its usage count.
        const existingTagDocRef = snapshot.docs[0].ref;
        
        await updateDoc(existingTagDocRef, {
          usageCount: increment(incrementBy),
          updatedAt: serverTimestamp() as FieldValue,
        });
      }
    } catch (error: any) {
        console.error(`[tagService] Error processing tag "${tagName}":`, error);
        // We'll log the error but continue to the next tag to not block the whole operation
    }
  }
};
