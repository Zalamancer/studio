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

  const dataToSave: Omit<NewsArticle, 'id'> & { createdAt: FieldValue, updatedAt: FieldValue, publishedAt?: FieldValue | null } = {
    ...articleData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    publishedAt: articleData.status === 'published' ? serverTimestamp() : null,
    // Ensure all fields from NewsArticle (except id) are present or defaulted
    title: articleData.title,
    userId: articleData.userId,
    category: articleData.category,
    content: articleData.content,
    coverImageUrl: articleData.coverImageUrl || null,
    status: articleData.status,
  };

  try {
    const docRef = await addDoc(newsArticlesCollectionRef, dataToSave);
    return docRef.id;
  } catch (error: any) {
    console.error(`[newsService] createNewsArticle - Firestore addDoc ERROR: ${error.message}.`);
    throw new Error(error.message || "Could not create news article.");
  }
};

export const updateNewsArticle = async (articleId: string, dataToUpdate: UpdateNewsArticleData): Promise<void> => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User not authenticated. Cannot update news article.");
  }
  // Logic to check if user is owner of articleId before update would typically go here, by fetching the doc first.
  // For brevity, assuming rules handle this.

  const articleDocRef = doc(db, NEWS_ARTICLES_COLLECTION, articleId);
  const payload: Partial<NewsArticle> & { updatedAt: FieldValue, publishedAt?: FieldValue | null } = {
    ...dataToUpdate,
    updatedAt: serverTimestamp(),
  };

  // If status is being changed to 'published' and publishedAt isn't already set in dataToUpdate
  if (dataToUpdate.status === 'published' && !dataToUpdate.publishedAt) {
    payload.publishedAt = serverTimestamp();
  }


  try {
    await updateDoc(articleDocRef, payload);
  } catch (error: any) {
    console.error(`[newsService] updateNewsArticle - Firestore updateDoc ERROR for ${articleId}: ${error.message}.`);
    throw new Error(error.message || `Could not update news article ${articleId}.`);
  }
};


export const getNewsArticlesByUserId = async (userId: string, status?: NewsArticleStatus): Promise<ClientNewsArticle[]> => {
  if (!userId) return [];

  const constraints = [
    where('userId', '==', userId),
    orderBy('updatedAt', 'desc'),
    limit(20) // Fetch a reasonable number for "Your Drafts/Published"
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
    throw error; // Re-throw to be caught by useQuery
  }
};

export const getPublishedNewsArticles = async (count = 10): Promise<ClientNewsArticle[]> => {
  const q = query(
    newsArticlesCollectionRef,
    where('status', '==', 'published'),
    orderBy('publishedAt', 'desc'), // Order by actual publish date
    limit(count)
  );

  try {
    const querySnapshot = await getDocs(q);
    const articlesPromises = querySnapshot.docs.map(async (docSnap) => {
      const data = docSnap.data() as NewsArticle;
      // Optionally fetch author details if needed for a general news feed
      // const authorProfile = await fetchUserProfileBasic(data.userId);
      return {
        ...data,
        id: docSnap.id,
        createdAt: (data.createdAt as Timestamp).toMillis(),
        updatedAt: (data.updatedAt as Timestamp).toMillis(),
        publishedAt: data.publishedAt ? (data.publishedAt as Timestamp).toMillis() : Date.now(), // Fallback for sorting if somehow null
        // authorName: authorProfile?.displayName || generateAnonymousName(data.userId), // Example
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
  // Consider fetching the doc first to double-check ownership on the client, though rules are primary.
  try {
    await deleteDoc(articleDocRef);
  } catch (error: any) {
    console.error(`[newsService] deleteNewsArticle - Error deleting article ${articleId}:`, error);
    throw error;
  }
};
