
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
  type OrderByDirection, // Import OrderByDirection
} from 'firebase/firestore';
import type { NewsArticle, NewNewsArticleData, UpdateNewsArticleData, ClientNewsArticle, NewsArticleStatus } from '@/types/news';
import { getUserPreferences, type UserPreference } from './userPreferenceService';

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
    coverImageUrl: string | null; // Ensure it's explicitly null if not provided
    createdAt: FieldValue;
    updatedAt: FieldValue;
    publishedAt: FieldValue | null; // Ensure it's explicitly null if not applicable
  } = {
    userId: articleData.userId,
    title: articleData.title,
    category: articleData.category,
    content: articleData.content,
    status: articleData.status,
    coverImageUrl: articleData.coverImageUrl || null, // Ensure null if undefined or empty
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    publishedAt: articleData.status === 'published'
      ? (articleData.publishedAt instanceof Timestamp ? articleData.publishedAt : (articleData.publishedAt ? serverTimestamp() : null) ) // Handle existing Timestamp or new
      : null,
  };

  const dataKeys = Object.keys(dataToSave);
  console.log(`%c[newsService] createNewsArticle - PREPARING TO SAVE ARTICLE.
    User ID: ${dataToSave.userId}
    Payload keys (${dataKeys.length}): ${dataKeys.join(', ')}
    Payload:`, "color: blue; font-weight: bold;", JSON.stringify(dataToSave, (key, value) => {
      if (value && typeof value === 'object' && (value as any)._methodName === 'serverTimestamp') {
        return { _methodName: 'serverTimestamp', type: 'FieldValue.serverTimestamp()' };
      }
      if (value instanceof Timestamp) {
        return { type: 'Timestamp', seconds: value.seconds, nanoseconds: value.nanoseconds };
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

  if (dataToUpdate.coverImageUrl !== undefined) { // Handles setting to null or a new URL
    payload.coverImageUrl = dataToUpdate.coverImageUrl;
  }

  if (dataToUpdate.status === 'published') {
    const existingData = docSnap.data();
    if (dataToUpdate.publishedAt === undefined && !existingData?.publishedAt) {
        payload.publishedAt = serverTimestamp(); // Set if becoming published and not already set
    } else if (dataToUpdate.publishedAt !== undefined) {
        payload.publishedAt = dataToUpdate.publishedAt; // Explicitly update if provided
    }
  } else if (dataToUpdate.status === 'draft') {
    payload.publishedAt = null; // Set to null if moving back to draft
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

  const effectiveLimit = 20;
  let orderByField: string;
  let orderByDirection: OrderByDirection;

  if (status) {
    console.log(`%c  [newsService] getNewsArticlesByUserId: Status filter active: '${status}'. Querying by userId and status, orderBy('updatedAt', 'desc').`, "color: dodgerblue;");
    constraints.push(where('status', '==', status));
    orderByField = 'updatedAt'; // When status is provided, order by updatedAt
    orderByDirection = 'desc';
    constraints.push(orderBy(orderByField, orderByDirection));
  } else {
    // THIS IS THE FAILING CASE
    console.log(`%c  [newsService] getNewsArticlesByUserId: No status filter. Querying by userId, orderBy('updatedAt', 'desc').`, "color: dodgerblue;");
    orderByField = 'updatedAt';
    orderByDirection = 'desc';
    constraints.push(orderBy(orderByField, orderByDirection));
  }
  constraints.push(limit(effectiveLimit));

  // Detailed logging of constraints as interpreted by the client SDK
  console.log(`%c  [newsService] getNewsArticlesByUserId: Final query constraints prepared:`, "color: dodgerblue;",
    constraints.map(c => {
      const constraintObj = c as any;
      if (constraintObj.type === 'where') {
        return { type: 'where', field: constraintObj._fieldPath.segments.join('/'), op: constraintObj._op, value: constraintObj._value };
      }
      if (constraintObj.type === 'orderBy') {
        return { type: 'orderBy', field: constraintObj._fieldPath.segments.join('/'), direction: constraintObj._directionStr };
      }
      if (constraintObj.type === 'limit') {
        return { type: 'limit', limit: constraintObj._limit, limitType: constraintObj._limitToLast ? 'last' : 'first' };
      }
      return { type: 'unknown', details: JSON.stringify(c).substring(0,100) };
    })
  );

  // Add more granular debug logging for the failing query
  if (!status) {
    console.log(`%c[newsService DEBUG] For rules evaluation (getNewsArticlesByUserId - no status):`, "color: magenta; font-weight: bold;");
    const filterDetails = constraints.find(c => (c as any).type === 'where') as any;
    const orderByDetails = constraints.find(c => (c as any).type === 'orderBy') as any;
    const limitDetails = constraints.find(c => (c as any).type === 'limit') as any;

    console.log(`  request.auth.uid: '${currentClientAuthUid}'`);
    console.log(`  request.query.filters.size(): ${filterDetails ? 1 : 0}`);
    if (filterDetails) {
      console.log(`  request.query.filters[0][0] (field): '${filterDetails._fieldPath.segments.join('/')}'`);
      console.log(`  request.query.filters[0][1] (op): '${filterDetails._op}'`);
      console.log(`  request.query.filters[0][2] (value): '${filterDetails._value}'`);
    }
    console.log(`  request.query.orderBy != null: ${!!orderByDetails}`);
    if (orderByDetails) {
      console.log(`  string(request.query.orderBy.path): '${orderByDetails._fieldPath.segments.join('/')}'`);
      console.log(`  request.query.orderBy.direction: '${orderByDetails._directionStr}'`);
    }
    console.log(`  request.query.limit: ${limitDetails ? limitDetails._limit : 'undefined'}`);
  }


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
    return articles;
  } catch (error: any) {
    console.error(`%c[newsService] Error fetching news articles for user ${userId} (status: ${status || 'any'}):`, "color: red;", error);
    if (error.code === 'permission-denied') {
        console.error(`%c  [newsService] PERMISSION DENIED. This indicates your Firestore security rules are blocking this query.`, "color: red; font-weight: bold;");
        let queryDesc = constraints.map(c => {
             const constraintObj = c as any;
             if (constraintObj.type === 'where') return `where('${constraintObj._fieldPath.segments.join('/')}', '${constraintObj._op}', '${constraintObj._value}')`;
             if (constraintObj.type === 'orderBy') return `orderBy('${constraintObj._fieldPath.segments.join('/')}', '${constraintObj._directionStr}')`;
             if (constraintObj.type === 'limit') return `limit(${constraintObj._limit})`;
             return 'unknown_constraint';
        }).join(', ');
        console.error(`%c  Query was effectively: ${queryDesc}`, "color: red; font-weight: bold;");
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

  console.log(`%c  [newsService] getPublishedNewsArticles: Query constraints prepared:`, "color: dodgerblue;",
    constraints.map(c => {
      const constraintObj = c as any;
      if (constraintObj.type === 'where') {
        return { type: 'where', field: constraintObj._fieldPath.segments.join('/'), op: constraintObj._op, value: constraintObj._value };
      }
      if (constraintObj.type === 'orderBy') {
        return { type: 'orderBy', field: constraintObj._fieldPath.segments.join('/'), direction: constraintObj._directionStr };
      }
      if (constraintObj.type === 'limit') {
        return { type: 'limit', limit: constraintObj._limit, limitType: constraintObj._limitToLast ? 'last' : 'first' };
      }
      return { type: 'unknown', details: JSON.stringify(c).substring(0,100) };
    })
  );

  const q = query(newsArticlesCollectionRef, ...constraints);

  try {
    const querySnapshot = await getDocs(q);
    console.log(`%c  [newsService] getPublishedNewsArticles: Query successful. Found ${querySnapshot.docs.length} articles.`, "color: green;");
    const articlesPromises = querySnapshot.docs.map(async (docSnap) => {
      const data = docSnap.data() as NewsArticle;
      return {
        ...data,
        id: docSnap.id,
        createdAt: (data.createdAt as Timestamp).toMillis(),
        updatedAt: (data.updatedAt as Timestamp).toMillis(),
        publishedAt: data.publishedAt ? (data.publishedAt as Timestamp).toMillis() : Date.now(), // Default to now if somehow null for published
      } as ClientNewsArticle;
    });
    return Promise.all(articlesPromises);
  } catch (error: any) {
    console.error(`%c[newsService] Error fetching published news articles:`, "color: red;", error);
     if (error.code === 'permission-denied') {
        console.error(`%c  [newsService] PERMISSION DENIED for getPublishedNewsArticles. This indicates your Firestore security rules are blocking this query.`, "color: red; font-weight: bold;");
        let queryDesc = constraints.map(c => {
             const constraintObj = c as any;
             if (constraintObj.type === 'where') return `where('${constraintObj._fieldPath.segments.join('/')}', '${constraintObj._op}', '${constraintObj._value}')`;
             if (constraintObj.type === 'orderBy') return `orderBy('${constraintObj._fieldPath.segments.join('/')}', '${constraintObj._directionStr}')`;
             if (constraintObj.type === 'limit') return `limit(${constraintObj._limit})`;
             return 'unknown_constraint';
        }).join(', ');
        console.error(`%c  Query was: ${queryDesc}`, "color: red; font-weight: bold;");
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
    throw error;
  }
};

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
    throw error;
  }
};
