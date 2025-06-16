
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
  getDoc,
  type QueryConstraint,
} from 'firebase/firestore';
import type { NewsArticle, NewNewsArticleData, UpdateNewsArticleData, ClientNewsArticle, NewsArticleStatus } from '@/types/news';
// import { fetchUserProfileBasic } from './connectionService'; // Not used directly in this file anymore
// import { generateAnonymousName } from '@/lib/pseudonymUtils'; // Not used directly in this file anymore

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

  // Explicitly ensure all optional fields are either present or null
  const dataToSave: {
    userId: string;
    title: string;
    category: string;
    content: string;
    status: NewsArticleStatus;
    coverImageUrl: string | null; // Explicitly null if undefined
    createdAt: FieldValue;
    updatedAt: FieldValue;
    publishedAt: FieldValue | null; // Explicitly null if status is draft and not provided
  } = {
    userId: articleData.userId,
    title: articleData.title,
    category: articleData.category,
    content: articleData.content,
    status: articleData.status,
    coverImageUrl: articleData.coverImageUrl || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    publishedAt: articleData.status === 'published' ? (articleData.publishedAt || serverTimestamp()) : null,
  };

  const dataKeys = Object.keys(dataToSave);
  console.log(`%c[newsService] createNewsArticle - PREPARING TO SAVE ARTICLE.
    User ID: ${dataToSave.userId}
    Payload keys (${dataKeys.length}): ${dataKeys.join(', ')}
    Payload:`, "color: blue; font-weight: bold;", JSON.stringify(dataToSave, (key, value) => {
      if (value && typeof value === 'object' && (value as any)._methodName === 'serverTimestamp') {
        return { _methodName: 'serverTimestamp' }; // Keep simplified serverTimestamp representation for logging
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
    payload.coverImageUrl = dataToUpdate.coverImageUrl; // This can be null to remove the image
  }

  if (dataToUpdate.status === 'published') {
    // If transitioning to published or updating a published article
    if (dataToUpdate.publishedAt === undefined || dataToUpdate.publishedAt === null) {
        // If publishedAt isn't explicitly provided in the update, and it's not already set, set it now.
        const existingData = docSnap.data();
        if (!existingData?.publishedAt) { 
             payload.publishedAt = serverTimestamp();
        }
        // If it was already published, publishedAt remains as is unless explicitly changed by dataToUpdate.publishedAt
    } else {
        // If dataToUpdate.publishedAt is explicitly provided (e.g., a specific date), use it.
        // This case is less common for typical status updates to 'published'.
        payload.publishedAt = dataToUpdate.publishedAt; 
    }
  } else if (dataToUpdate.status === 'draft' && payload.status === 'draft') {
    // If moving from draft to draft, or published to draft, publishedAt might be nulled or retained based on logic.
    // For now, if becoming a draft, we don't explicitly nullify publishedAt here; rules should allow publishedAt to be null.
    // If you want to clear publishedAt when moving to draft: payload.publishedAt = null;
  }


  try {
    await updateDoc(articleDocRef, payload);
  } catch (error: any) {
    console.error(`[newsService] updateNewsArticle - Firestore updateDoc ERROR for ${articleId}: ${error.message}. Payload sent:`, JSON.stringify(payload, null, 2));
    throw new Error(error.message || `Could not update news article ${articleId}.`);
  }
};


export const getNewsArticlesByUserId = async (userId: string, status?: NewsArticleStatus): Promise<ClientNewsArticle[]> => {
  if (!userId) {
    console.warn("[newsService] getNewsArticlesByUserId: Called with no userId. Returning empty array.");
    return [];
  }
  
  const currentClientAuthUid = auth.currentUser?.uid;
  console.log(`%c[newsService] getNewsArticlesByUserId: Fetching for target userId: '${userId}'. Client Auth UID: '${currentClientAuthUid || 'NULL'}'`, "color: dodgerblue;");

  const constraints: QueryConstraint[] = [
    where('userId', '==', userId),
  ];

  if (status) {
    constraints.push(where('status', '==', status));
    constraints.push(orderBy('updatedAt', 'desc')); 
    console.log(`%c  [newsService] getNewsArticlesByUserId: Added status filter: '${status}' and orderBy('updatedAt', 'desc')`, "color: dodgerblue;");
  } else {
    // ALWAYS add orderBy for the "Your Articles" general list case
    constraints.push(orderBy('updatedAt', 'desc'));
    console.log(`%c  [newsService] getNewsArticlesByUserId: No status filter. Querying by userId, orderBy('updatedAt', 'desc').`, "color: dodgerblue;");
  }
  constraints.push(limit(20));


  console.log(`%c  [newsService] getNewsArticlesByUserId: Final query constraints:`, "color: dodgerblue;", constraints.map(c => {
    const constraintDetails: any = {};
    // @ts-ignore
    if (c._op && c._field && c._value !== undefined) { // Check for where clause structure
        constraintDetails.field = (c._field.segments || []).join('/');
        constraintDetails.op = c._op;
        constraintDetails.value = c._value;
    // @ts-ignore
    } else if (c.type === 'orderBy' && c._field) { // Check for orderBy clause structure
        constraintDetails.field = (c._field.segments || []).join('/');
        // @ts-ignore
        constraintDetails.dir = c.Ja || 'asc';
    // @ts-ignore
    } else if (c.type === 'limit' && c.wa !== undefined) { // Check for limit clause structure
        constraintDetails.limit = c.wa;
    } else {
        constraintDetails.unknown = JSON.stringify(c);
    }
    return constraintDetails;
  }));


  const q = query(newsArticlesCollectionRef, ...constraints);

  try {
    const querySnapshot = await getDocs(q);
    console.log(`%c  [newsService] getNewsArticlesByUserId: Query successful. Found ${querySnapshot.docs.length} articles.`, "color: green;");
    const articles = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data() as NewsArticle;
      return {
        ...data,
        id: docSnap.id,
        createdAt: (data.createdAt as Timestamp).toMillis(),
        updatedAt: (data.updatedAt as Timestamp).toMillis(),
        publishedAt: data.publishedAt ? (data.publishedAt as Timestamp).toMillis() : null,
      } as ClientNewsArticle;
    });
    // Client-side sort is no longer needed here if orderBy is always applied server-side.
    // if (!status) {
    //     articles.sort((a, b) => b.updatedAt - a.updatedAt);
    // }
    return articles;
  } catch (error: any) {
    console.error(`%c[newsService] Error fetching news articles for user ${userId} (status: ${status || 'any'}):`, "color: red;", error);
    if (error.code === 'permission-denied') {
        console.error(`%c  [newsService] PERMISSION DENIED. This indicates your Firestore security rules are blocking this query.`, "color: red; font-weight: bold;");
        let queryString = `where('userId', '==', '${userId}')`;
        if (status) queryString += `, where('status', '==', '${status}')`;
        queryString += `, orderBy('updatedAt', 'desc')`; // This is now always present
        queryString += `, limit(20)`;
        console.error(`%c  Query was effectively: ${queryString}`, "color: red; font-weight: bold;");
        console.error(`%c  Ensure your rules allow 'list' operations on 'newsArticles' when these conditions are met by request.query.filters.`, "color: red; font-weight: bold;");
    }
    throw error;
  }
};

export const getPublishedNewsArticles = async (count = 15): Promise<ClientNewsArticle[]> => {
  const currentClientAuthUid = auth.currentUser?.uid;
  console.log(`%c[newsService] getPublishedNewsArticles: Fetching ${count} published articles. Client Auth UID: '${currentClientAuthUid || 'NULL'}'`, "color: dodgerblue;");

  const constraints: QueryConstraint[] = [
    where('status', '==', 'published'),
    orderBy('publishedAt', 'desc'),
    limit(count)
  ];

  console.log(`%c  [newsService] getPublishedNewsArticles: Query constraints:`, "color: dodgerblue;", constraints.map(c => {
    const constraintDetails: any = {};
    // @ts-ignore
    if (c._op && c._field && c._value !== undefined) {
        constraintDetails.field = (c._field.segments || []).join('/');
        constraintDetails.op = c._op;
        constraintDetails.value = c._value;
    // @ts-ignore
    } else if (c.type === 'orderBy' && c._field) {
        constraintDetails.field = (c._field.segments || []).join('/');
        // @ts-ignore
        constraintDetails.dir = c.Ja || 'asc';
    // @ts-ignore
    } else if (c.type === 'limit' && c.wa !== undefined) {
        constraintDetails.limit = c.wa;
    } else {
        constraintDetails.unknown = JSON.stringify(c);
    }
    return constraintDetails;
  }));

  const q = query(newsArticlesCollectionRef, ...constraints);

  try {
    const querySnapshot = await getDocs(q);
    console.log(`%c  [newsService] getPublishedNewsArticles: Query successful. Found ${querySnapshot.docs.length} articles.`, "color: green;");
    const articlesPromises = querySnapshot.docs.map(async (docSnap) => {
      const data = docSnap.data() as NewsArticle;
      // Fetch author details if needed in the future, for now, not fetching to keep it simple
      return {
        ...data,
        id: docSnap.id,
        createdAt: (data.createdAt as Timestamp).toMillis(),
        updatedAt: (data.updatedAt as Timestamp).toMillis(),
        publishedAt: data.publishedAt ? (data.publishedAt as Timestamp).toMillis() : Date.now(), // Fallback if publishedAt is somehow missing on a published article
      } as ClientNewsArticle;
    });
    return Promise.all(articlesPromises);
  } catch (error: any) {
    console.error(`%c[newsService] Error fetching published news articles:`, "color: red;", error);
     if (error.code === 'permission-denied') {
        console.error(`%c  [newsService] PERMISSION DENIED. This indicates your Firestore security rules are blocking this query.`, "color: red; font-weight: bold;");
        console.error(`%c  Query was: where('status', '==', 'published'), orderBy('publishedAt', 'desc'), limit(${count})`, "color: red; font-weight: bold;");
        console.error(`%c  Ensure your rules allow 'list' operations on 'newsArticles' when these conditions are met.`, "color: red; font-weight: bold;");
    }
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
    throw error; // Re-throw to be caught by mutation's onError
  }
};

// New function to get a single article by ID - ensure rules allow this
export const getNewsArticleById = async (articleId: string): Promise<ClientNewsArticle | null> => {
  if (!articleId) return null;
  const articleDocRef = doc(newsArticlesCollectionRef, articleId);
  try {
    const docSnap = await getDoc(articleDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as NewsArticle;
      return {
        ...data,
        id: docSnap.id,
        createdAt: (data.createdAt as Timestamp).toMillis(),
        updatedAt: (data.updatedAt as Timestamp).toMillis(),
        publishedAt: data.publishedAt ? (data.publishedAt as Timestamp).toMillis() : null,
      };
    }
    return null;
  } catch (error: any) {
    console.error(`[newsService] Error fetching article ${articleId}:`, error);
    // Consider if specific error handling for permissions is needed here too
    throw error;
  }
};
    
    