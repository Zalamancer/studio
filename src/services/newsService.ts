
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

  const dataToSave: {
    userId: string;
    title: string;
    category: string;
    content: string;
    status: NewsArticleStatus;
    coverImageUrl: string | null;
    createdAt: FieldValue;
    updatedAt: FieldValue;
    publishedAt: FieldValue | null;
  } = {
    userId: articleData.userId,
    title: articleData.title,
    category: articleData.category,
    content: articleData.content,
    status: articleData.status,
    coverImageUrl: articleData.coverImageUrl || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    publishedAt: articleData.status === 'published' ? serverTimestamp() : null,
  };

  // Enhanced logging for debugging Firestore rules
  const dataKeys = Object.keys(dataToSave);
  console.log(`%c[newsService] createNewsArticle - PREPARING TO SAVE ARTICLE.
    User ID: ${dataToSave.userId}
    Payload keys (${dataKeys.length}): ${dataKeys.join(', ')}
    Payload:`, "color: blue; font-weight: bold;", JSON.stringify(dataToSave, (key, value) => {
      // Firestore FieldValues are not directly stringifiable, show their type
      if (value && typeof value === 'object' && value._methodName === 'serverTimestamp') {
        return { _methodName: 'serverTimestamp' };
      }
      return value;
    }, 2)
  );
  console.log(`%c[newsService] RULE CHECK REMINDER: Ensure your Firestore 'allow create' rule for 'newsArticles' expects EXACTLY ${dataKeys.length} fields and lists them correctly in any 'hasAll' or 'hasOnly' checks. Timestamp fields ('createdAt', 'updatedAt', 'publishedAt') should be validated against 'request.time'. Ownership ('userId == request.auth.uid') is also critical.`, "color: orange;");


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
  
  const docSnap = await getDoc(articleDocRef);
  if (!docSnap.exists() || docSnap.data()?.userId !== user.uid) {
    throw new Error("Article not found or user is not authorized to update this article.");
  }

  const payload: Partial<Omit<NewsArticle, 'id' | 'userId' | 'createdAt'>> & { updatedAt: FieldValue } = {
    updatedAt: serverTimestamp(),
  };

  if (dataToUpdate.title !== undefined) payload.title = dataToUpdate.title;
  if (dataToUpdate.category !== undefined) payload.category = dataToUpdate.category;
  if (dataToUpdate.content !== undefined) payload.content = dataToUpdate.content;
  if (dataToUpdate.status !== undefined) payload.status = dataToUpdate.status;
  
  if (dataToUpdate.coverImageUrl !== undefined) {
    payload.coverImageUrl = dataToUpdate.coverImageUrl; 
  }

  if (dataToUpdate.status === 'published') {
    if (dataToUpdate.publishedAt === undefined || dataToUpdate.publishedAt === null) {
        const existingData = docSnap.data();
        if (!existingData?.publishedAt) { 
             payload.publishedAt = serverTimestamp();
        }
    } else {
        payload.publishedAt = dataToUpdate.publishedAt; 
    }
  } else if (dataToUpdate.status === 'draft' && payload.status === 'draft') {
    // If moving to draft, you might want to nullify publishedAt
    // payload.publishedAt = null; // Uncomment if this is the desired behavior
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
