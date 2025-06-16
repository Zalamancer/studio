
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
import { getUserPreferences, type UserPreference } from './userPreferenceService'; // Import preference service

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
    // Fields from Post type that are now part of NewsArticle
    commentCount: number;
    descriptionDetails: string | null;
    descriptionOutcome: string | null;
    descriptionTried: string | null;
    imageUrls: string[];
    maxBudget: number | null;
    deadline: Timestamp | null;
    mentionedUserIds: string[];
    naicsCode: string | null;
    question: string | null; // Assuming 'title' is primary, 'question' might be redundant or used differently
    ratingScore: number;
    requestType: string | null; // Assuming 'news' or similar, or null if not applicable
    sector: string | null;
    subSector: string | null;
    industry: string | null;
    tags: string[] | null;


  } = {
    userId: articleData.userId,
    title: articleData.title,
    category: articleData.category,
    content: articleData.content,
    status: articleData.status,
    coverImageUrl: articleData.coverImageUrl || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    publishedAt: articleData.status === 'published'
      ? (articleData.publishedAt instanceof Timestamp ? articleData.publishedAt : (articleData.publishedAt ? serverTimestamp() : null) )
      : null,
    // Default values for fields inherited/assumed from Post structure for rule validation
    commentCount: 0,
    descriptionDetails: null, // Assuming these are not primary for news, but rules might expect them
    descriptionOutcome: null,
    descriptionTried: null,
    imageUrls: [], // News might not have multiple 'post-style' images beyond cover
    maxBudget: null,
    deadline: null,
    mentionedUserIds: [],
    naicsCode: null, // Can be set if relevant for news category (e.g., industry news)
    question: null, // Title is primary for news
    ratingScore: 0,
    requestType: null, // Or a specific type like 'news_article'
    sector: null, // Can be set
    subSector: null, // Can be set
    industry: null, // Can be set
    tags: [], // News can have tags
  };

  // Clean up any undefined keys before saving if they are truly optional and not expected by rules with null
  // Object.keys(dataToSave).forEach(key => (dataToSave as any)[key] === undefined && delete (dataToSave as any)[key]);


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
   const expectedFields = ['userId', 'title', 'category', 'content', 'status', 'coverImageUrl', 'createdAt', 'updatedAt', 'publishedAt', 'commentCount', 'descriptionDetails', 'descriptionOutcome', 'descriptionTried', 'imageUrls', 'maxBudget', 'deadline', 'mentionedUserIds', 'naicsCode', 'question', 'ratingScore', 'requestType', 'sector', 'subSector', 'industry']; // Added 'tags'
   if (dataToSave.tags !== undefined) expectedFields.push('tags');
   const expectedSize = expectedFields.length;

  console.log(`%c[newsService] RULE CHECK REMINDER: Ensure your Firestore 'allow create' rule for 'newsArticles' expects EXACTLY ${expectedSize} fields and lists them correctly in any 'hasAll' or 'hasOnly' checks. Timestamp fields ('createdAt', 'updatedAt', 'publishedAt') should be validated against 'request.time'. Ownership ('userId == request.auth.uid') is also critical. Expected fields: ${expectedFields.join(', ')}`, "color: orange;");


  try {
    const docRef = await addDoc(newsArticlesCollectionRef, dataToSave);
    return docRef.id;
  } catch (error: any) {
    console.error(`[newsService] createNewsArticle - Firestore addDoc ERROR: ${error.message}. Data sent:`, JSON.stringify(dataToSave, null, 2));
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
    const existingData = docSnap.data();
    if (dataToUpdate.publishedAt === undefined && !existingData?.publishedAt) {
        payload.publishedAt = serverTimestamp();
    } else if (dataToUpdate.publishedAt !== undefined) {
        payload.publishedAt = dataToUpdate.publishedAt;
    }
  } else if (dataToUpdate.status === 'draft') {
    payload.publishedAt = null;
  }


  try {
    await updateDoc(articleDocRef, payload);
  } catch (error: any) {
    console.error(`[newsService] updateNewsArticle - Firestore updateDoc ERROR for ${articleId}: ${error.message}. Payload sent:`, JSON.stringify(payload, null, 2));
    throw new Error(error.message || `Could not update news article ${articleId}.`);
  }
};


export const getNewsArticlesByUserId = async (userId: string, status?: NewsArticleStatus): Promise<ClientNewsArticle[]> => {
  const clientAuthUid = auth.currentUser?.uid;
  console.log(`%c[newsService] getNewsArticlesByUserId: Fetching for target userId: '${userId}'. Client Auth UID: '${clientAuthUid || 'NULL'}'`, "color: dodgerblue;");

  if (!userId) {
    console.warn("[newsService] getNewsArticlesByUserId: Called with no userId. Returning empty array.");
    return [];
  }

  const constraints: QueryConstraint[] = [];
  constraints.push(where('userId', '==', userId));

  const effectiveLimit = 20;
  let isOrderByAppliedToServer = false;
  let orderByField = 'updatedAt'; // Default
  let orderByDirection: OrderByDirection = 'desc'; // Default

  if (status) {
    console.log(`%c  [newsService] getNewsArticlesByUserId: Status filter active: '${status}'. Querying by userId and status, orderBy('updatedAt', 'desc').`, "color: dodgerblue;");
    constraints.push(where('status', '==', status));
    constraints.push(orderBy(orderByField, orderByDirection));
    isOrderByAppliedToServer = true;
  } else {
    // For fetching ALL user's articles (drafts and published for "Your Articles" sections)
    console.log(`%c  [newsService] getNewsArticlesByUserId: No status filter. Querying by userId, ORDERING BY '${orderByField}', '${orderByDirection}' ON SERVER.`, "color: dodgerblue;");
    constraints.push(orderBy(orderByField, orderByDirection));
    isOrderByAppliedToServer = true;
  }
  constraints.push(limit(effectiveLimit));

  // Debugging log for rules (Corrected for accuracy)
  const filterClausesForLog = constraints
    .filter(c => (c as any)._type === 'where')
    .map(c => {
        const filter = c as any;
        return `{field: '${filter._fieldPath.segments.join('.')}', op: '${filter._op}', value: '${filter._value}'}`;
    })
    .join(', ');

  const orderByConstraintForLog = constraints.find(c => (c as any)._type === 'orderBy') as any;
  const orderByLogPath = orderByConstraintForLog ? (orderByConstraintForLog._fieldPath.segments.join('.') || 'UNKNOWN_FIELD') : 'N/A';
  const orderByLogDirection = orderByConstraintForLog ? (orderByConstraintForLog._direction || 'UNKNOWN_DIR') : 'N/A';

  console.log(`%c[newsService DEBUG] For rules evaluation (getNewsArticlesByUserId):
    request.auth.uid:                     '${clientAuthUid || 'NULL'}'
    request.query.filters.size():         ${constraints.filter(c => (c as any)._type === 'where').length}
    request.query.filters (client-side):  [${filterClausesForLog || 'none'}]
    request.query.orderBy (client-side):  ${isOrderByAppliedToServer ? `path: '${orderByLogPath}', direction: '${orderByLogDirection}'` : 'false (no server orderBy)'}
    request.query.limit:                  ${effectiveLimit}`, "color: #FFD700; background: #333; padding: 2px;");


  const q = query(newsArticlesCollectionRef, ...constraints);

  try {
    const querySnapshot = await getDocs(q);
    console.log(`%c  [newsService] getNewsArticlesByUserId: Query successful for userId '${userId}', status '${status || 'any'}'. Found ${querySnapshot.docs.length} articles.`, "color: green;");

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

    if (articles.length > 0) {
        console.log(`%c  [newsService] getNewsArticlesByUserId: First mapped article sample:`, "color: green;", articles[0]);
    } else {
        console.log(`%c  [newsService] getNewsArticlesByUserId: No articles mapped (querySnapshot was empty or all docs were invalid).`, "color: orange;");
    }

    // Client-side sort is now only needed if server-side ordering was intentionally skipped (which is not the case here anymore)
    // if (!isOrderByAppliedToServer) { // This condition will be false now
    //     articles.sort((a, b) => b.updatedAt - a.updatedAt);
    //     console.log(`%c  [newsService] getNewsArticlesByUserId: Articles sorted client-side by updatedAt descending.`, "color: dodgerblue;");
    // }
    return articles;
  } catch (error: any) {
    console.error(`%c[newsService] Error fetching news articles for user ${userId} (status: ${status || 'any'}):`, "color: red;", error);
    if (error.code === 'permission-denied') {
        console.error(`%c  [newsService] PERMISSION DENIED. This indicates your Firestore security rules are blocking this query.`, "color: red; font-weight: bold;");
        const attemptedQueryLog = `Query: ${filterClausesForLog ? `${filterClausesForLog}` : '(no client-side where clauses)'}, ${isOrderByAppliedToServer ? `orderBy(${orderByLogPath}, ${orderByLogDirection})` : 'no server orderBy'}, limit(${effectiveLimit})`;
        console.error(`%c  Attempted query components by client: ${attemptedQueryLog}`, "color: red; font-weight: bold;");
        console.error(`%c  Ensure your rules allow 'list' operations on 'newsArticles' when these conditions are met by request.query.`, "color: red; font-weight: bold;");
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

  console.log(`%c  [newsService] getPublishedNewsArticles: Query constraints: where('status','==','published'), orderBy('publishedAt','desc'), limit(${count})`, "color: dodgerblue;");

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
        publishedAt: data.publishedAt ? (data.publishedAt as Timestamp).toMillis() : Date.now(), // Fallback for safety, though publishedAt should exist for published status
      } as ClientNewsArticle;
    });
    const articles = await Promise.all(articlesPromises);
    if (articles.length > 0) {
        console.log(`%c  [newsService] getPublishedNewsArticles: First mapped article sample:`, "color: green;", articles[0]);
    }
    return articles;
  } catch (error: any) {
    console.error(`%c[newsService] Error fetching published news articles:`, "color: red;", error);
     if (error.code === 'permission-denied') {
        console.error(`%c  [newsService] PERMISSION DENIED for getPublishedNewsArticles. This indicates your Firestore security rules are blocking this query.`, "color: red; font-weight: bold;");
        console.error(`%c  Query was: where('status','==','published'), orderBy('publishedAt','desc'), limit(${count})`, "color: red; font-weight: bold;");
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
      const publishedAtMillis = data.publishedAt instanceof Timestamp
        ? data.publishedAt.toMillis()
        : (data.publishedAt === null ? null : undefined);

      return {
        ...data,
        id: docSnap.id,
        createdAt: (data.createdAt as Timestamp).toMillis(),
        updatedAt: (data.updatedAt as Timestamp).toMillis(),
        publishedAt: publishedAtMillis,
      };
    }
    return null;
  } catch (error: any) {
    console.error(`[newsService] Error fetching article ${articleId}:`, error);
    throw error;
  }
};
