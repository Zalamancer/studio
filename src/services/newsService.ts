
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
  runTransaction,
  increment,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import type { NewsArticle, NewNewsArticleData, UpdateNewsArticleData, ClientNewsArticle, NewsArticleStatus } from '@/types/news';
import { getUserPreferences, type UserPreference } from './userPreferenceService';
import { getOrCreateTagsAndUpdateUsage } from './tagService'; // Import tag service

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
    tags?: string[] | null;
    content: string;
    draftContent: string | null;
    hasUnpublishedChanges: boolean;
    status: NewsArticleStatus;
    coverImageUrl: string | null;
    createdAt: FieldValue;
    updatedAt: FieldValue;
    publishedAt: FieldValue | null;
    likeCount: number; // Added
    likedBy: string[]; // Added
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
  } = {
    userId: articleData.userId,
    title: articleData.title,
    tags: Array.isArray(articleData.tags) ? articleData.tags : [],
    content: articleData.content,
    draftContent: null,
    hasUnpublishedChanges: false,
    status: articleData.status,
    coverImageUrl: articleData.coverImageUrl || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    publishedAt: articleData.status === 'published' ? serverTimestamp() : null,
    likeCount: 0, // Initialize likeCount
    likedBy: [],   // Initialize likedBy
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
  };

  const expectedFields = ['userId', 'title', 'tags', 'content', 'status', 'coverImageUrl', 'createdAt', 'updatedAt', 'publishedAt', 'likeCount', 'likedBy', 'commentCount', 'descriptionDetails', 'descriptionOutcome', 'descriptionTried', 'imageUrls', 'maxBudget', 'deadline', 'mentionedUserIds', 'naicsCode', 'question', 'ratingScore', 'requestType', 'sector', 'subSector', 'industry', 'draftContent', 'hasUnpublishedChanges'];
  const currentKeys = Object.keys(dataToSave);
  if (currentKeys.length !== expectedFields.length || !expectedFields.every(f => currentKeys.includes(f))) {
       console.warn(`[newsService DEBUG] createNewsArticle - Field mismatch detected. Expected ${expectedFields.length} fields, got ${currentKeys.length}.
       Expected: ${expectedFields.sort().join(', ')}
       Actual:   ${currentKeys.sort().join(', ')}`);
  }

  try {
    const docRef = await addDoc(newsArticlesCollectionRef, dataToSave);
    if (dataToSave.tags && dataToSave.tags.length > 0) {
      await getOrCreateTagsAndUpdateUsage(dataToSave.tags, user.uid, 1);
    }
    return docRef.id;
  } catch (error: any) {
    console.error(`[newsService] createNewsArticle - Firestore addDoc ERROR: ${error.message}. Data sent:`, JSON.stringify(dataToSave, null, 2));
    throw new Error(error.message || "Could not create news article.");
  }
};

export const updateNewsArticle = async (
  articleId: string,
  dataToUpdate: UpdateNewsArticleData,
  isSavingDraftOfPublishedArticle: boolean = false
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

  const generalUpdatableFields: (keyof UpdateNewsArticleData)[] = [
    'title', 'content', 'status', 'coverImageUrl', 'draftContent', 'hasUnpublishedChanges',
    'tags', 'sector', 'subSector', 'industry', 'naicsCode', 'requestType', 'question',
    'descriptionDetails', 'descriptionTried', 'descriptionOutcome', 'maxBudget',
    'imageUrls', 'mentionedUserIds'
    // likeCount & likedBy handled by toggleLikeNewsArticle
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
  const contentValueFromUpdate = dataToUpdate.content; // If undefined, content is not part of this specific update

  if (isSavingDraftOfPublishedArticle && existingData.status === 'published') {
    payload.draftContent = (typeof contentValueFromUpdate === 'string') ? contentValueFromUpdate : (contentValueFromUpdate === null ? null : existingData.draftContent);
    payload.hasUnpublishedChanges = true;
    payload.status = 'published'; // Keep status as published
  } else if (newStatus === 'published') {
    payload.content = (typeof contentValueFromUpdate === 'string') ? contentValueFromUpdate : (contentValueFromUpdate === null ? null : existingData.content);
    payload.draftContent = null;
    payload.hasUnpublishedChanges = false;
    payload.status = 'published';
    if (existingData.status !== 'published' || !existingData.publishedAt) {
      payload.publishedAt = serverTimestamp();
    }
  } else if (newStatus === 'draft') {
    payload.content = (typeof contentValueFromUpdate === 'string') ? contentValueFromUpdate : (contentValueFromUpdate === null ? null : existingData.content);
    payload.draftContent = null; // When saving as draft, content becomes the main source
    payload.hasUnpublishedChanges = false; // No unpublished changes when it's a draft itself
    payload.status = 'draft';
    payload.publishedAt = null; // Unpublish
  } else if (newStatus !== undefined) { // Status change not covered above (e.g., to archived, etc.)
    payload.status = newStatus;
    payload.content = (typeof contentValueFromUpdate === 'string') ? contentValueFromUpdate : (contentValueFromUpdate === null ? null : existingData.content);
    payload.draftContent = null;
    payload.hasUnpublishedChanges = false;
    if (newStatus !== 'published') {
        payload.publishedAt = null;
    }
  } else if (contentValueFromUpdate !== undefined && !isSavingDraftOfPublishedArticle) {
    // General content update without explicit status change
    payload.content = (typeof contentValueFromUpdate === 'string') ? contentValueFromUpdate : (contentValueFromUpdate === null ? null : existingData.content);
    if (existingData.status === 'published') { // If it was published, and we're just updating content
        payload.draftContent = null; // Clear draft
        payload.hasUnpublishedChanges = false; // No longer has unpublished changes
    }
  }

  const oldTags = existingData.tags || [];
  const newTags = dataToUpdate.tags !== undefined ? (dataToUpdate.tags || []) : oldTags;

  payload.tags = newTags;

  const tagsAdded = newTags.filter(tag => !oldTags.includes(tag));
  const tagsRemoved = oldTags.filter(tag => !newTags.includes(tag));

  try {
    await updateDoc(articleDocRef, payload);
    if (tagsAdded.length > 0) {
      await getOrCreateTagsAndUpdateUsage(tagsAdded, user.uid, 1);
    }
    if (tagsRemoved.length > 0) {
      await getOrCreateTagsAndUpdateUsage(tagsRemoved, user.uid, -1);
    }
  } catch (error: any) {
    console.error(`[newsService] updateNewsArticle - Firestore updateDoc ERROR for ${articleId}: ${error.message}. Payload sent:`, JSON.stringify(payload, null, 2));
    throw new Error(error.message || `Could not update news article ${articleId}.`);
  }
};

export const getNewsArticlesByUserId = async (userId: string, status?: NewsArticleStatus): Promise<ClientNewsArticle[]> => {
  const clientAuthUid = auth.currentUser?.uid;
  if (!userId) return [];

  const constraints: QueryConstraint[] = [where('userId', '==', userId)];
  const effectiveLimit = 20;
  let orderByField = 'updatedAt';
  let orderByDirection: OrderByDirection = 'desc';

  if (status) {
    constraints.push(where('status', '==', status));
  }
  constraints.push(orderBy(orderByField, orderByDirection));
  constraints.push(limit(effectiveLimit));

  const q = query(newsArticlesCollectionRef, ...constraints);

  try {
    const querySnapshot = await getDocs(q);
    const articles = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data() as NewsArticle;
      return {
        ...data,
        id: docSnap.id,
        draftContent: data.draftContent || null,
        hasUnpublishedChanges: data.hasUnpublishedChanges || false,
        createdAt: (data.createdAt as Timestamp).toMillis(),
        updatedAt: (data.updatedAt as Timestamp).toMillis(),
        publishedAt: data.publishedAt ? (data.publishedAt as Timestamp).toMillis() : null,
        tags: data.tags || [],
        likeCount: data.likeCount || 0,
        likedBy: data.likedBy || [],
      } as ClientNewsArticle;
    });
    return articles;
  } catch (error: any) {
    console.error(`%c[newsService] Error fetching news articles for user ${userId} (status: ${status || 'any'}):`, "color: red;", error);
    throw error;
  }
};

export const getPublishedNewsArticles = async (count = 15): Promise<ClientNewsArticle[]> => {
  const constraints: QueryConstraint[] = [
    where('status', '==', 'published'),
    orderBy('publishedAt', 'desc'),
    limit(count)
  ];
  const q = query(newsArticlesCollectionRef, ...constraints);

  try {
    const querySnapshot = await getDocs(q);
    const articles = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data() as NewsArticle;
      return {
        ...data,
        id: docSnap.id,
        draftContent: null,
        hasUnpublishedChanges: false,
        createdAt: (data.createdAt as Timestamp).toMillis(),
        updatedAt: (data.updatedAt as Timestamp).toMillis(),
        publishedAt: data.publishedAt ? (data.publishedAt as Timestamp).toMillis() : Date.now(),
        tags: data.tags || [],
        likeCount: data.likeCount || 0,
        likedBy: data.likedBy || [],
      } as ClientNewsArticle;
    });
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
    // Decrement tag usage counts before deleting
    const docSnap = await getDoc(articleDocRef);
    if (docSnap.exists()) {
      const articleData = docSnap.data() as NewsArticle;
      if (articleData.tags && articleData.tags.length > 0) {
        await getOrCreateTagsAndUpdateUsage(articleData.tags, user.uid, -1);
      }
    }
    // TODO: Delete associated comments in subcollection if needed (batch delete)
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
        tags: data.tags || [],
        content: data.content,
        draftContent: data.draftContent || null,
        hasUnpublishedChanges: data.hasUnpublishedChanges || false,
        status: data.status,
        coverImageUrl: data.coverImageUrl || null,
        createdAt: (data.createdAt as Timestamp).toMillis(),
        updatedAt: (data.updatedAt as Timestamp).toMillis(),
        publishedAt: publishedAtMillis,
        likeCount: data.likeCount || 0,
        likedBy: data.likedBy || [],
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
      };
      return clientArticle;
    }
    return null;
  } catch (error: any) {
    throw error;
  }
};

export const toggleLikeNewsArticle = async (articleId: string, userId: string): Promise<void> => {
  if (!articleId || !userId) {
    throw new Error('Article ID and User ID are required to toggle like.');
  }
  const articleRef = doc(db, NEWS_ARTICLES_COLLECTION, articleId);

  try {
    await runTransaction(db, async (transaction) => {
      const articleSnap = await transaction.get(articleRef);
      if (!articleSnap.exists()) {
        throw new Error("Article does not exist!");
      }
      const articleData = articleSnap.data() as NewsArticle;

      if (articleData.userId === userId) {
        throw new Error("You cannot like your own article.");
      }

      const likedBy: string[] = articleData.likedBy || [];
      const likeCount: number = articleData.likeCount || 0;
      const isLiked = likedBy.includes(userId);

      let newLikedBy: string[];
      let newLikeCount: number;

      if (isLiked) {
        newLikedBy = likedBy.filter(uid => uid !== userId);
        newLikeCount = Math.max(0, likeCount - 1);
      } else {
        newLikedBy = [...likedBy, userId];
        newLikeCount = likeCount + 1;
      }

      transaction.update(articleRef, {
        likedBy: newLikedBy,
        likeCount: newLikeCount,
        updatedAt: serverTimestamp()
      });
    });
  } catch (error: any) {
    console.error(`[newsService] Error toggling like for article ${articleId}:`, error);
    throw new Error(`Failed to toggle like: ${error.message}`);
  }
};

// Function to increment comment count on a news article
export const incrementNewsArticleCommentCount = async (articleId: string): Promise<void> => {
  const articleRef = doc(db, NEWS_ARTICLES_COLLECTION, articleId);
  try {
    await updateDoc(articleRef, {
      commentCount: increment(1),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error incrementing news article comment count:", error);
    // Handle error appropriately, maybe log or rethrow
  }
};

// Function to decrement comment count on a news article
export const decrementNewsArticleCommentCount = async (articleId: string): Promise<void> => {
  const articleRef = doc(db, NEWS_ARTICLES_COLLECTION, articleId);
  try {
    await updateDoc(articleRef, {
      commentCount: increment(-1),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error decrementing news article comment count:", error);
  }
};
