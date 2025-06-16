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
  type OrderByDirection,
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
    content: string; // Main content
    draftContent: string | null; // Initialize draft content
    hasUnpublishedChanges: boolean; // Initialize flag
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
    content: articleData.content, // Initial content
    draftContent: null, // Explicitly null for new articles
    hasUnpublishedChanges: false, // Explicitly false for new articles
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
   const expectedFields = ['userId', 'title', 'category', 'content', 'draftContent', 'hasUnpublishedChanges', 'status', 'coverImageUrl', 'createdAt', 'updatedAt', 'publishedAt', 'commentCount', 'descriptionDetails', 'descriptionOutcome', 'descriptionTried', 'imageUrls', 'maxBudget', 'deadline', 'mentionedUserIds', 'naicsCode', 'question', 'ratingScore', 'requestType', 'sector', 'subSector', 'industry', 'tags'];
   const expectedSize = expectedFields.length;

  console.log(`%c[newsService DEBUG] createNewsArticle - Firestore 'allow create' rule check: Expects EXACTLY ${expectedSize} fields. Provided ${dataKeys.length}. Missing: ${expectedFields.filter(f => !dataKeys.includes(f)).join(', ') || 'None'}. Extra: ${dataKeys.filter(f => !expectedFields.includes(f)).join(', ') || 'None'}.`, "color: orange;");
  console.log(`%c[newsService] createNewsArticle - Payload:`, "color: blue; font-weight: bold;", JSON.stringify(dataToSave, (key, value) => {
      if (value && typeof value === 'object' && (value as any)._methodName && (value as any)._methodName.includes('serverTimestamp')) {
        return { _methodName: (value as any)._methodName, type: 'FieldValue.serverTimestamp()' };
      }
      if (value instanceof Timestamp) {
        return { type: 'Timestamp', seconds: value.seconds, nanoseconds: value.nanoseconds };
      }
      return value;
    }, 2)
  );


  try {
    const docRef = await addDoc(newsArticlesCollectionRef, dataToSave);
    return docRef.id;
  } catch (error: any) {
    console.error(`[newsService] createNewsArticle - Firestore addDoc ERROR: ${error.message}. Data sent:`, JSON.stringify(dataToSave, null, 2));
    throw new Error(error.message || "Could not create news article.");
  }
};

export const updateNewsArticle = async (
  articleId: string,
  dataToUpdate: UpdateNewsArticleData,
  isSavingDraftOfPublishedArticle: boolean = false // New flag to distinguish intent
): Promise<void> => {
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

  // Assign updatable fields from dataToUpdate to payload, EXCLUDING content-related fields for now
  const generalUpdatableFields: (keyof UpdateNewsArticleData)[] = [
    'title', 'category', 'coverImageUrl', 'tags', 'sector', 'subSector',
    'industry', 'naicsCode', 'requestType', 'question', 'descriptionDetails',
    'descriptionTried', 'descriptionOutcome', 'maxBudget', 'imageUrls', 'mentionedUserIds'
    // 'status', 'content', 'draftContent', 'hasUnpublishedChanges', 'publishedAt' are handled separately
  ];

  generalUpdatableFields.forEach(key => {
    if (dataToUpdate[key] !== undefined) {
      (payload as any)[key] = dataToUpdate[key];
    }
  });

  if (dataToUpdate.deadline instanceof Date) {
    payload.deadline = Timestamp.fromDate(dataToUpdate.deadline);
  } else if (dataToUpdate.hasOwnProperty('deadline') && dataToUpdate.deadline === null) {
    payload.deadline = null;
  }

  const newStatus = dataToUpdate.status;

  if (isSavingDraftOfPublishedArticle && existingData.status === 'published') {
    // Intent: Save current editor content as a draft of an ALREADY PUBLISHED article
    payload.draftContent = dataToUpdate.content; // Editor content becomes draftContent
    payload.hasUnpublishedChanges = true;
    payload.status = 'published'; // Status remains published
    // `content` (live) and `publishedAt` are NOT modified in Firestore by this specific action
  } else if (newStatus === 'published') {
    // Intent: Publish a draft OR update a live article with editor's content
    payload.content = dataToUpdate.content; // Editor content becomes live content
    payload.draftContent = null; // Clear any previous draft
    payload.hasUnpublishedChanges = false;
    payload.status = 'published';
    if (existingData.status !== 'published' || !existingData.publishedAt) {
      payload.publishedAt = serverTimestamp(); // Set/update publishedAt only if it was a draft or had no publishedAt
    }
    // If already published and has publishedAt, it's preserved (not included in payload)
  } else if (newStatus === 'draft') {
    // Intent: Save a normal draft (was draft, remains draft) OR unpublish a published article
    payload.content = dataToUpdate.content; // Editor content (or original live content if unpublishing) becomes draft's main content
    payload.draftContent = null; // Clear draft content field
    payload.hasUnpublishedChanges = false;
    payload.status = 'draft';
    payload.publishedAt = null; // Always null for drafts
  } else if (newStatus !== undefined) {
    // Status is changing to something else, or just content is updating for an existing status
    payload.status = newStatus;
    payload.content = dataToUpdate.content; // Assume content always updates unless specifically saving draft of published
    payload.draftContent = null;
    payload.hasUnpublishedChanges = false;
    // If it's some other status that isn't 'published', ensure publishedAt is null
    if (newStatus !== 'published') {
        payload.publishedAt = null;
    }
  } else if (dataToUpdate.content !== undefined && !isSavingDraftOfPublishedArticle) {
    // Status is NOT changing, but content IS, and we are NOT saving a draft of a published article.
    // This means we are updating the main content of either a draft or an already published article.
    payload.content = dataToUpdate.content;
    if (existingData.status === 'published') {
        payload.draftContent = null; // If live content is updated, clear any pending draft
        payload.hasUnpublishedChanges = false;
    }
  }
  // If only other fields like title/category are changing without status or content,
  // content, draftContent, hasUnpublishedChanges, publishedAt are not touched in payload unless explicitly set above.

  console.log(`%c[newsService] updateNewsArticle - Final Payload for article ${articleId}:`, "color: blue; font-weight: bold;", JSON.stringify(payload, null, 2));

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

  if (orderByConstraintForLog && isOrderByAppliedToServer) {
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
        draftContent: data.draftContent || null, // Ensure new fields are included
        hasUnpublishedChanges: data.hasUnpublishedChanges || false,
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
        draftContent: null, // Public views should not see draft content
        hasUnpublishedChanges: false, // Public views reflect live state
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
        draftContent: data.draftContent || null,
        hasUnpublishedChanges: data.hasUnpublishedChanges || false,
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
