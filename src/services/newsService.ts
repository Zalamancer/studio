// src/services/newsService.ts
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
  serverTimestamp,
  Timestamp,
  limit,
  type FieldValue,
  getDoc, // Added getDoc for fetching before update if needed for rule checks
} from 'firebase/firestore';
import type { NewsArticle, NewNewsArticleData, UpdateNewsArticleData, ClientNewsArticle, NewsArticleStatus } from '@/types/news';
import { fetchUserProfileBasic } from './connectionService'; // For potential author details in future listings
import { generateAnonymousName } from '@/lib/pseudonymUtils'; // For fallback names

const NEWS_ARTICLES_COLLECTION = 'newsArticles';
const newsArticlesCollectionRef = collection(db, NEWS_ARTICLES_COLLECTION);

export const createNewsArticle = async (articleData: NewNewsArticleData): Promise<string> => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User not authenticated. Cannot create news article.");
  }
  if (user.uid !== articleData.userId) {
    throw new Error("Authenticated user does not match article's userId.");
  }

  // Explicitly define the structure to match what Firestore rules might expect.
  // Optional fields not provided by articleData should be explicitly null or omitted if rule allows.
  const dataToSave: {
    userId: string;
    title: string;
    category: string;
    content: string;
    status: NewsArticleStatus;
    coverImageUrl: string | null; // Explicitly null if not provided
    createdAt: FieldValue;
    updatedAt: FieldValue;
    publishedAt: FieldValue | null; // Explicitly null or serverTimestamp
  } = {
    userId: articleData.userId,
    title: articleData.title,
    category: articleData.category,
    content: articleData.content,
    status: articleData.status,
    coverImageUrl: articleData.coverImageUrl || null, // Ensure it's null if undefined/empty
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    publishedAt: articleData.status === 'published' ? serverTimestamp() : null,
  };

  try {
    const docRef = await addDoc(newsArticlesCollectionRef, dataToSave);
    return docRef.id;
  } catch (error: any) {
    console.error(`[newsService] createNewsArticle - Firestore addDoc ERROR: ${error.message}. Data sent:`, JSON.stringify(dataToSave, null, 2));
    // Log the exact data to help debug against Firestore rules
    throw new Error(error.message || "Could not create news article.");
  }
};

export const updateNewsArticle = async (articleId: string, dataToUpdate: UpdateNewsArticleData): Promise<void> => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User not authenticated. Cannot update news article.");
  }

  const articleDocRef = doc(db, NEWS_ARTICLES_COLLECTION, articleId);
  
  // It's good practice to fetch the document first to ensure the user is the owner,
  // though Firestore rules should be the primary enforcer.
  // This client-side check is more for UX and early error handling.
  const docSnap = await getDoc(articleDocRef);
  if (!docSnap.exists() || docSnap.data()?.userId !== user.uid) {
    throw new Error("Article not found or user is not authorized to update this article.");
  }

  const payload: Partial<Omit<NewsArticle, 'id' | 'userId' | 'createdAt'>> & { updatedAt: FieldValue } = {
    updatedAt: serverTimestamp(),
  };

  // Only include fields that are actually being updated and are allowed to be updated.
  if (dataToUpdate.title !== undefined) payload.title = dataToUpdate.title;
  if (dataToUpdate.category !== undefined) payload.category = dataToUpdate.category;
  if (dataToUpdate.content !== undefined) payload.content = dataToUpdate.content;
  if (dataToUpdate.status !== undefined) payload.status = dataToUpdate.status;
  
  // Handle coverImageUrl: if explicitly passed as null, set it to null, otherwise only if a new URL is provided.
  if (dataToUpdate.coverImageUrl !== undefined) {
    payload.coverImageUrl = dataToUpdate.coverImageUrl; // This allows setting it to null or a new URL
  }

  // If status is being changed to 'published' and publishedAt isn't already set (or explicitly being updated)
  if (dataToUpdate.status === 'published') {
    // If publishedAt is not part of dataToUpdate or is null, set it to serverTimestamp.
    // If dataToUpdate.publishedAt is already a FieldValue (like serverTimestamp itself), use that.
    // If dataToUpdate.publishedAt is a specific Timestamp (from editing an already published article), that's fine.
    if (dataToUpdate.publishedAt === undefined || dataToUpdate.publishedAt === null) {
        const existingData = docSnap.data();
        if (!existingData?.publishedAt) { // Only set it if it wasn't already published
             payload.publishedAt = serverTimestamp();
        }
    } else {
        payload.publishedAt = dataToUpdate.publishedAt; // Use the provided publishedAt
    }
  } else if (dataToUpdate.status === 'draft' && payload.status === 'draft') {
    // If moving back to draft, or just updating a draft, ensure publishedAt is cleared if it's not meant to persist
    // This depends on business logic. For now, we assume publishedAt, once set, remains unless explicitly cleared.
    // If you want to clear publishedAt when moving to draft:
    // payload.publishedAt = null;
  }


  try {
    await updateDoc(articleDocRef, payload);
  } catch (error: any) {
    console.error(`[newsService] updateNewsArticle - Firestore updateDoc ERROR for ${articleId}: ${error.message}. Payload sent:`, JSON.stringify(payload, null, 2));
    throw new Error(error.message || `Could not update news article ${articleId}.`);
  }
};


export const getNewsArticlesByUserId = async (userId: string, status?: NewsArticleStatus): Promise<ClientNewsArticle[]> => {
  if (!userId) return [];

  const constraints = [
    where('userId', '==', userId),
    orderBy('updatedAt', 'desc'),
    limit(20)
  ];

  if (status) {
    constraints.push(where('status', '==', status));
  }

  const q = query(newsArticlesCollectionRef, ...constraints);

  try {
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data() as NewsArticle;
      return {
        ...data,
        id: docSnap.id,
        createdAt: (data.createdAt as Timestamp).toMillis(),
        updatedAt: (data.updatedAt as Timestamp).toMillis(),
        publishedAt: data.publishedAt ? (data.publishedAt as Timestamp).toMillis() : null,
      } as ClientNewsArticle;
    });
  } catch (error: any) {
    console.error(`[newsService] Error fetching news articles for user ${userId} (status: ${status || 'any'}):`, error);
    throw error;
  }
};

export const getPublishedNewsArticles = async (count = 10): Promise<ClientNewsArticle[]> => {
  const q = query(
    newsArticlesCollectionRef,
    where('status', '==', 'published'),
    orderBy('publishedAt', 'desc'),
    limit(count)
  );

  try {
    const querySnapshot = await getDocs(q);
    const articlesPromises = querySnapshot.docs.map(async (docSnap) => {
      const data = docSnap.data() as NewsArticle;
      return {
        ...data,
        id: docSnap.id,
        createdAt: (data.createdAt as Timestamp).toMillis(),
        updatedAt: (data.updatedAt as Timestamp).toMillis(),
        publishedAt: data.publishedAt ? (data.publishedAt as Timestamp).toMillis() : Date.now(),
      } as ClientNewsArticle;
    });
    return Promise.all(articlesPromises);
  } catch (error: any) {
    console.error(`[newsService] Error fetching published news articles:`, error);
    throw error;
  }
};

export const deleteNewsArticle = async (articleId: string, userId: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user || user.uid !== userId) {
    throw new Error("User not authenticated or not authorized to delete this article.");
  }
  const articleDocRef = doc(db, NEWS_ARTICLES_COLLECTION, articleId);
  try {
    await deleteDoc(articleDocRef);
  } catch (error: any) {
    console.error(`[newsService] deleteNewsArticle - Error deleting article ${articleId}:`, error);
    throw error;
  }
};

