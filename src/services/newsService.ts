
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
    commentCount: number;
    descriptionDetails: string | null; 
    descriptionOutcome: string | null; 
    descriptionTried: string | null;   
    imageUrls: string[];
    maxBudget: number | null;
    deadline: Timestamp | null;
    mentionedUserIds: string[];
    naicsCode: string | null;
    question: string | null; 
    ratingScore: number;
    requestType: string | null; 
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
    publishedAt: articleData.status === 'published' ? serverTimestamp() : null,
    commentCount: 0,
    descriptionDetails: articleData.descriptionDetails || null, 
    descriptionOutcome: articleData.descriptionOutcome || null,
    descriptionTried: articleData.descriptionTried || null,
    imageUrls: Array.isArray(articleData.imageUrls) ? articleData.imageUrls : [], 
    maxBudget: articleData.maxBudget === undefined ? null : articleData.maxBudget,
    deadline: articleData.deadline instanceof Date ? Timestamp.fromDate(articleData.deadline) : (articleData.deadline || null),
    mentionedUserIds: Array.isArray(articleData.mentionedUserIds) ? articleData.mentionedUserIds : [],
    naicsCode: articleData.naicsCode || null, 
    question: articleData.question || null, 
    ratingScore: articleData.ratingScore || 0,
    requestType: articleData.requestType || null, 
    sector: articleData.sector || null, 
    subSector: articleData.subSector || null, 
    industry: articleData.industry || null, 
    tags: Array.isArray(articleData.tags) ? articleData.tags : [],
  };
  
  const dataKeys = Object.keys(dataToSave);
  console.log(`%c[newsService] createNewsArticle - PREPARING TO SAVE ARTICLE.
    User ID: ${dataToSave.userId}
    Payload keys (${dataKeys.length}): ${dataKeys.join(', ')}
    Payload:`, "color: blue; font-weight: bold;", JSON.stringify(dataToSave, (key, value) => {
      if (value && typeof value === 'object' && (value as any)._methodName && (value as any)._methodName.includes('serverTimestamp')) {
        return { _methodName: (value as any)._methodName, type: 'FieldValue.serverTimestamp()' };
      }
      if (value instanceof Timestamp) {
        return { type: 'Timestamp', seconds: value.seconds, nanoseconds: value.nanoseconds };
      }
      return value;
    }, 2)
  );
   const expectedFields = ['userId', 'title', 'category', 'content', 'status', 'coverImageUrl', 'createdAt', 'updatedAt', 'publishedAt', 'commentCount', 'descriptionDetails', 'descriptionOutcome', 'descriptionTried', 'imageUrls', 'maxBudget', 'deadline', 'mentionedUserIds', 'naicsCode', 'question', 'ratingScore', 'requestType', 'sector', 'subSector', 'industry', 'tags'];
   const expectedSize = expectedFields.length;

  console.log(`%c[newsService] RULE CHECK REMINDER: Ensure your Firestore 'allow create' rule for 'newsArticles' expects EXACTLY ${expectedSize} fields (if all are present) and lists them correctly in any 'hasAll' or 'hasOnly' checks. Timestamp fields ('createdAt', 'updatedAt', 'publishedAt') should be validated against 'request.time'. Ownership ('userId == request.auth.uid') is also critical. Expected fields: ${expectedFields.join(', ')}`, "color: orange;");


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
  const existingData = docSnap.data() as NewsArticle;

  const payload: Partial<Omit<NewsArticle, 'id' | 'userId' | 'createdAt'>> & { updatedAt: FieldValue } = {
    updatedAt: serverTimestamp(),
  };

  // Assign updatable fields from dataToUpdate to payload
  const updatableFields: (keyof UpdateNewsArticleData)[] = [
    'title', 'category', 'content', 'status', 'coverImageUrl',
    'tags', 'sector', 'subSector', 'industry', 'naicsCode', 'requestType', 'question',
    'descriptionDetails', 'descriptionTried', 'descriptionOutcome', 'maxBudget', 'deadline',
    'imageUrls', 'mentionedUserIds'
  ];

  updatableFields.forEach(key => {
    if (dataToUpdate[key] !== undefined) {
      (payload as any)[key] = dataToUpdate[key];
    }
  });
  
  // Handle deadline specifically if it's a Date object
  if (dataToUpdate.deadline instanceof Date) {
    payload.deadline = Timestamp.fromDate(dataToUpdate.deadline);
  } else if (dataToUpdate.hasOwnProperty('deadline') && dataToUpdate.deadline === null) {
    payload.deadline = null;
  }

  const newStatus = dataToUpdate.status;
  if (newStatus !== undefined) {
    payload.status = newStatus;
    if (newStatus === 'published') {
      // Only set publishedAt if it's a new publish (draft -> published or fixing a missing publishedAt)
      if (existingData.status !== 'published' || !existingData.publishedAt) {
        payload.publishedAt = serverTimestamp();
      }
      // If newStatus is 'published' and existingData.status was also 'published' (and existingData.publishedAt is valid),
      // then payload.publishedAt is NOT set here, meaning the original publishedAt is preserved.
      // The Firestore rule `request.resource.data.publishedAt == resource.data.publishedAt` will then check this.
    } else { // newStatus is 'draft' or any other non-published state
      payload.publishedAt = null;
    }
  }
  // If dataToUpdate.status is undefined (status not changing), no specific action for publishedAt here unless it was missing and is now being corrected (unlikely scenario for this path).

  try {
    await updateDoc(articleDocRef, payload);
  } catch (error: any) {
    console.error(`[newsService] updateNewsArticle - Firestore updateDoc ERROR for ${articleId}: ${error.message}. Payload sent:`, JSON.stringify(payload, null, 2));
    throw new Error(error.message || `Could not update news article ${articleId}.`);
  }
};


export const getNewsArticlesByUserId = async (userId: string, status?: NewsArticleStatus): Promise<ClientNewsArticle[]> => {
  const clientAuthUid = auth.currentUser?.uid;

  if (!userId) {
    return [];
  }

  const constraints: QueryConstraint[] = [];
  constraints.push(where('userId', '==', userId));

  const effectiveLimit = 20;
  let orderByField = 'updatedAt'; 
  let orderByDirection: OrderByDirection = 'desc'; 
  let isOrderByAppliedToServer = false;

  if (status) {
    constraints.push(where('status', '==', status));
    constraints.push(orderBy(orderByField, orderByDirection));
    isOrderByAppliedToServer = true;
  } else {
    constraints.push(orderBy(orderByField, orderByDirection));
    isOrderByAppliedToServer = true;
  }
  constraints.push(limit(effectiveLimit));

  const filterClausesForLog = constraints
    .filter(c => (c as any)._type === 'where')
    .map(c => {
        const filter = c as any;
        return `{field: '${filter._fieldPath.segments.join('.')}', op: '${filter._op}', value: '${filter._value}'}`;
    })
    .join(', ');
  
  const orderByConstraintForLog = constraints.find(c => (c as any)._type === 'orderBy') as any;
  let orderByLogPath = 'N/A';
  let orderByLogDirection = 'N/A';

  if (orderByConstraintForLog && isOrderByAppliedToServer) { // Check if orderBy was applied
      const fieldPathSegments = orderByConstraintForLog._fieldPath?.segments;
      if (Array.isArray(fieldPathSegments) && fieldPathSegments.length > 0) {
          orderByLogPath = fieldPathSegments.join('.');
      } else if (typeof orderByConstraintForLog._fieldPath === 'string') { 
          orderByLogPath = orderByConstraintForLog._fieldPath;
      }
      orderByLogDirection = orderByConstraintForLog._direction || 'UNKNOWN_DIR';
  }

  console.log(`%c[newsService DEBUG] For rules evaluation (getNewsArticlesByUserId):
    request.auth.uid:                     '${clientAuthUid || 'NULL'}'
    request.query.filters (expected):     [${filterClausesForLog || 'none'}]
    request.query.orderBy (expected):     ${isOrderByAppliedToServer ? `path: '${orderByLogPath}', direction: '${orderByLogDirection}'` : 'no server orderBy'}
    request.query.limit:                  ${effectiveLimit}`, "color: #FFD700; background: #333; padding: 2px;");


  const q = query(newsArticlesCollectionRef, ...constraints);

  try {
    const querySnapshot = await getDocs(q);

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
        const attemptedQueryLog = `Query constraints: ${filterClausesForLog ? `${filterClausesForLog}` : '(no client-side where clauses)'}, orderBy(${orderByLogPath}, ${orderByLogDirection}), limit(${effectiveLimit})`;
    }
    throw error;
  }
};

export const getPublishedNewsArticles = async (count = 15): Promise<ClientNewsArticle[]> => {
  const currentClientAuthUid = auth.currentUser?.uid;
  const constraints: QueryConstraint[] = [
    where('status', '==', 'published'),
    orderBy('publishedAt', 'desc'),
    limit(count)
  ];

  const q = query(newsArticlesCollectionRef, ...constraints);

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
    const articles = await Promise.all(articlesPromises);
    return articles;
  } catch (error: any) {
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

      const clientArticle: ClientNewsArticle = {
        id: docSnap.id,
        userId: data.userId,
        title: data.title,
        category: data.category,
        content: data.content,
        status: data.status,
        coverImageUrl: data.coverImageUrl || null,
        createdAt: (data.createdAt as Timestamp).toMillis(),
        updatedAt: (data.updatedAt as Timestamp).toMillis(),
        publishedAt: publishedAtMillis,
        commentCount: data.commentCount || 0,
        descriptionDetails: data.descriptionDetails || null,
        descriptionOutcome: data.descriptionOutcome || null,
        descriptionTried: data.descriptionTried || null,
        imageUrls: data.imageUrls || [],
        maxBudget: data.maxBudget === undefined ? null : data.maxBudget,
        deadline: data.deadline instanceof Timestamp ? data.deadline.toMillis() : null,
        mentionedUserIds: data.mentionedUserIds || [],
        naicsCode: data.naicsCode || null,
        question: data.question || null,
        ratingScore: data.ratingScore || 0,
        requestType: data.requestType || null,
        sector: data.sector || null,
        subSector: data.subSector || null,
        industry: data.industry || null,
        tags: data.tags || [],
      };
      return clientArticle;
    }
    return null;
  } catch (error: any) {
    throw error;
  }
};

