// src/services/commentService.ts
// Client-callable by default (no 'use server;' at the top)

import { db, auth } from '@/lib/firebase/config';
import {
  collection,
  addDoc,
  doc,
  serverTimestamp,
  Timestamp, // Keep Timestamp for type safety
  query, // Import query
  orderBy, // Import orderBy
  getDocs, // Import getDocs
  limit,   // Import limit
  deleteDoc, // Import deleteDoc
  getDoc,   // Import getDoc
  runTransaction, // Import runTransaction for atomic updates
  arrayUnion, // For adding to likedBy array
  arrayRemove, // For removing from likedBy array
  increment, // For updating likeCount and commentCount atomically
  updateDoc, // For updating commentCount directly
} from 'firebase/firestore';
import type { NewCommentData, ClientComment, NewSubCommentData, ClientSubComment } from '@/types/comment';
import { fetchUserProfileBasic } from '@/services/connectionService'; // CORRECTED IMPORT
import { createNotification } from './notificationService';
import type { NewNotificationData } from '@/types/notification';
import { getPostDetails } from './messagingService';
import { generateAnonymousName } from '@/lib/pseudonymUtils'; // For fallback names
import { incrementNewsArticleCommentCount, decrementNewsArticleCommentCount } from './newsService'; // For news article comments

// Helper function to extract mentioned user UIDs from text
// This assumes mentions are in the format @UID and UIDs are alphanumeric with underscores.
// This helper is LOCAL to this service. The global one is in page.tsx
const extractMentionsFromTextService = (text: string): string[] => {
  console.log(`%c[commentService] extractMentionsFromTextService - Input Text: "${text}"`, "color: #FF8C00;");
  const mentionRegex = /@([a-zA-Z0-9_.'-]+(?: [a-zA-Z0-9_.'-]+)*)/g;
  const matches = text.matchAll(mentionRegex);
  const userIdentifiers = new Set<string>();
  for (const match of matches) {
    if (match[1]) {
      userIdentifiers.add(match[1].trim());
    }
  }
  console.log(`%c[commentService] extractMentionsFromTextService - Extracted potential identifiers:`, "color: #FF8C00", Array.from(userIdentifiers));
  return Array.from(userIdentifiers);
};

// --- Generic Comment Functions (for 'posts' collection) ---

export const addCommentToPost = async (postId: string, commentData: Omit<NewCommentData, 'likeCount' | 'likedBy' | 'isShadowBanned'>): Promise<string> => {
  console.log(`%c[commentService] addCommentToPost: Called for postId '${postId}' by userId '${commentData.userId}'. Comment text: "${commentData.text?.substring(0,50)}..."`, "color: blue;");
  if (!postId) throw new Error('Post ID is required to add a comment.');
  if (!commentData.userId) throw new Error('User ID is required for the comment.');
  if (!commentData.text || commentData.text.trim() === '') throw new Error('Comment text cannot be empty.');

  try {
    const postDocRef = doc(db, 'posts', postId);
    const commentsCollectionRef = collection(postDocRef, 'comments');

    const resolvedMentionedUids = Array.isArray(commentData.mentionedUserIds) ? commentData.mentionedUserIds : [];
    console.log(`%c[commentService] addCommentToPost: Received resolvedMentionedUids from client:`, "color: blue;", resolvedMentionedUids);


    const fullCommentData: NewCommentData & { timestamp: Timestamp; updatedAt: Timestamp; } = {
      ...commentData,
      likeCount: 0,
      likedBy: [],
      mentionedUserIds: resolvedMentionedUids,
      isShadowBanned: false, // Default for regular posts
      timestamp: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp,
    };

    const docRef = await addDoc(commentsCollectionRef, fullCommentData);
    const newCommentId = docRef.id;
    console.log(`%c[commentService] addCommentToPost: Comment added successfully to post ${postId} with ID: ${newCommentId}`, "color: green;");

    await updateDoc(postDocRef, {
      commentCount: increment(1),
      updatedAt: serverTimestamp()
    });
    console.log(`%c[commentService] addCommentToPost: Incremented commentCount and updated updatedAt for post ${postId}`, "color: green;");

    const postDetails = await getPostDetails(postId); // Re-uses existing messagingService function

    if (resolvedMentionedUids.length > 0) {
      console.log(`%c[commentService] addCommentToPost: Processing ${resolvedMentionedUids.length} mentions for notifications using UIDs.`, "color: blue;");
      for (const mentionedRecipientUid of resolvedMentionedUids) {
        if (!mentionedRecipientUid || typeof mentionedRecipientUid !== 'string' || !/^[a-zA-Z0-9]{20,}$/.test(mentionedRecipientUid)) {
            console.warn(`%c[commentService] addCommentToPost: Invalid or non-UID identifier found in resolvedMentionedUids, skipping notification for: '${mentionedRecipientUid}'`, "color: orange;");
            continue;
        }
        const notificationPayload: Omit<NewNotificationData, 'senderName' | 'senderAvatar'> = {
          userId: mentionedRecipientUid,
          type: 'mention',
          senderId: commentData.userId,
          postId: postId,
          postQuestion: postDetails?.question || null,
          commentId: newCommentId,
          textSnippet: commentData.text.substring(0, 100),
        };
        console.log(`%c[commentService] addCommentToPost: Attempting to create 'mention' notification for recipient UID '${mentionedRecipientUid}'. Payload:`, "color: blue;", notificationPayload);
        try {
          await createNotification(notificationPayload);
          console.log(`%c[commentService] addCommentToPost: Mention notification CREATED for recipient ${mentionedRecipientUid} regarding comment ${newCommentId}`, "color: green;");
        } catch (notifyError: any) {
          console.error(`%c[commentService] addCommentToPost: FAILED to create mention notification for recipient ${mentionedRecipientUid}. Error:`, "color: red;", notifyError.message, notifyError);
        }
      }
    }
    return newCommentId;
  } catch (error: any) {
    console.error(`%c[commentService] addCommentToPost: Error adding comment to post ${postId}:`, "color: red;", error);
    if (error.code === 'permission-denied') {
      console.error("Firestore permission denied. Check security rules for writing to posts/{postId}/comments subcollection and updating post document.");
      throw new Error('Permission denied. Check Firestore security rules.');
    }
    throw new Error(`Failed to add comment: ${error.message}`);
  }
};

export const getCommentsForPost = async (postId: string): Promise<ClientComment[]> => {
  if (!postId) {
    console.warn("[commentService] getCommentsForPost called with invalid postId.");
    return [];
  }

  try {
    const postDocRef = doc(db, 'posts', postId);
    const commentsCollectionRef = collection(postDocRef, 'comments');
    const q = query(
      commentsCollectionRef,
      orderBy('timestamp', 'asc'),
      limit(100)
    );

    const querySnapshot = await getDocs(q);
    const userIds = Array.from(new Set(querySnapshot.docs.map(docSnap => docSnap.data().userId).filter(Boolean)));
    const userProfilesMap = new Map<string, { displayName: string; avatarUrl?: string }>();

    await Promise.all(userIds.map(async (userId) => {
        const profile = await fetchUserProfileBasic(userId);
        userProfilesMap.set(userId, {
            displayName: profile?.displayName || generateAnonymousName(userId),
            avatarUrl: profile?.avatarUrl
        });
    }));

    const comments = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      if (!data.userId || !data.text || !(data.timestamp instanceof Timestamp)) {
        return null;
      }
      const timestampMillis = data.timestamp.toMillis();
      const userProfile = userProfilesMap.get(data.userId);
      return {
        id: docSnap.id,
        userId: data.userId,
        text: data.text,
        timestamp: timestampMillis,
        userName: userProfile?.displayName,
        userAvatar: userProfile?.avatarUrl,
        mentionName: data.mentionName || userProfile?.displayName || generateAnonymousName(data.userId),
        likeCount: data.likeCount || 0,
        likedBy: data.likedBy || [],
        mentionedUserIds: data.mentionedUserIds || [],
        isShadowBanned: data.isShadowBanned === true, // For 'posts', this will be false/undefined
      } as ClientComment;
    }).filter((comment): comment is ClientComment => comment !== null);

    return comments;
  } catch (error: any) {
    console.error(`[commentService] Error fetching comments for post ${postId}:`, error);
    if (error.code === 'permission-denied') {
      throw new Error('Permission denied fetching comments. Check Firestore rules.');
    }
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
        throw new Error("Firestore query requires an index for comments. Please create it in the Firebase console.");
    }
    throw new Error(`Failed to fetch comments: ${error.message}`);
  }
};

export const toggleLikeComment = async (postId: string, commentId: string, userId: string): Promise<void> => {
    const commentRef = doc(db, 'posts', postId, 'comments', commentId);
    try {
        await runTransaction(db, async (transaction) => {
            const commentSnap = await transaction.get(commentRef);
            if (!commentSnap.exists()) throw new Error("Comment does not exist!");
            const commentData = commentSnap.data();
            const likedBy: string[] = commentData.likedBy || [];
            const likeCount: number = typeof commentData.likeCount === 'number' ? commentData.likeCount : 0;
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
            transaction.update(commentRef, {
                likedBy: newLikedBy,
                likeCount: newLikeCount,
                updatedAt: serverTimestamp()
            });
        });
    } catch (error: any) {
        throw new Error(`Failed to toggle like: ${error.message}`);
    }
};

export const deleteCommentFromPost = async (postId: string, commentId: string): Promise<void> => {
  if (!postId || !commentId) {
    throw new Error('Post ID and Comment ID are required to delete a comment.');
  }
  try {
    const postDocRef = doc(db, 'posts', postId);
    const commentDocRef = doc(postDocRef, 'comments', commentId);

    await updateDoc(postDocRef, {
      commentCount: increment(-1),
      updatedAt: serverTimestamp()
    });
    await deleteDoc(commentDocRef);
  } catch (error: any) {
    throw new Error(`Failed to delete comment: ${error.message}`);
  }
};

export const addSubCommentToComment = async (postId: string, commentId: string, subCommentData: Omit<NewSubCommentData, 'likeCount' | 'likedBy' | 'isShadowBanned'>): Promise<string> => {
  if (!postId || !commentId) throw new Error('Post ID and Comment ID are required.');
  if (!subCommentData.userId || !subCommentData.text?.trim()) throw new Error('User ID and text are required.');

  try {
    const commentDocRef = doc(db, 'posts', postId, 'comments', commentId);
    const subCommentsCollectionRef = collection(commentDocRef, 'subcomments');
    const fullSubCommentData: NewSubCommentData & { timestamp: Timestamp; updatedAt: Timestamp; } = {
        ...subCommentData,
        likeCount: 0,
        likedBy: [],
        isShadowBanned: false,
        mentionedUserIds: subCommentData.mentionedUserIds || [],
        timestamp: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp,
    };
    const docRef = await addDoc(subCommentsCollectionRef, fullSubCommentData);
    // Note: Sub-comments on regular posts currently DO NOT affect the parent post's primary commentCount.
    // If they should, you'd add `await updateDoc(doc(db, 'posts', postId), { commentCount: increment(1) });` here.
    return docRef.id;
  } catch (error: any) {
    throw new Error(`Failed to add subcomment: ${error.message}`);
  }
};

export const getSubCommentsForComment = async (postId: string, commentId: string): Promise<ClientSubComment[]> => {
  if (!postId || !commentId) return [];
  try {
    const commentDocRef = doc(db, 'posts', postId, 'comments', commentId);
    const subCommentsCollectionRef = collection(commentDocRef, 'subcomments');
    const q = query(subCommentsCollectionRef, orderBy('timestamp', 'asc'), limit(50));
    const querySnapshot = await getDocs(q);
    const userIds = Array.from(new Set(querySnapshot.docs.map(docSnap => docSnap.data().userId).filter(Boolean)));
    const userProfilesMap = new Map<string, { displayName: string; avatarUrl?: string }>();
    await Promise.all(userIds.map(async (userId) => {
        const profile = await fetchUserProfileBasic(userId);
        userProfilesMap.set(userId, {
            displayName: profile?.displayName || generateAnonymousName(userId),
            avatarUrl: profile?.avatarUrl
        });
    }));
    const subComments = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      if (!data.userId || !data.text || !(data.timestamp instanceof Timestamp)) return null;
      const userProfile = userProfilesMap.get(data.userId);
      return {
        id: docSnap.id,
        userId: data.userId,
        text: data.text,
        timestamp: data.timestamp.toMillis(),
        userName: userProfile?.displayName,
        userAvatar: userProfile?.avatarUrl,
        mentionName: data.mentionName || userProfile?.displayName || generateAnonymousName(data.userId),
        likeCount: data.likeCount || 0,
        likedBy: data.likedBy || [],
        mentionedUserIds: data.mentionedUserIds || [],
        isShadowBanned: data.isShadowBanned === true,
      } as ClientSubComment;
    }).filter((sc): sc is ClientSubComment => sc !== null);
    return subComments;
  } catch (error: any) {
    throw new Error(`Failed to fetch subcomments: ${error.message}`);
  }
};

export const deleteSubCommentFromComment = async (postId: string, commentId: string, subCommentId: string): Promise<void> => {
  if (!postId || !commentId || !subCommentId) throw new Error('IDs are required.');
  try {
    const subCommentDocRef = doc(db, 'posts', postId, 'comments', commentId, 'subcomments', subCommentId);
    await deleteDoc(subCommentDocRef);
    // Note: Sub-comments on regular posts currently DO NOT affect the parent post's primary commentCount.
    // If they should, you'd add `await updateDoc(doc(db, 'posts', postId), { commentCount: increment(-1) });` here.
  } catch (error: any) {
    throw new Error(`Failed to delete subcomment: ${error.message}`);
  }
};

export const toggleLikeSubComment = async (postId: string, commentId: string, subCommentId: string, userId: string): Promise<void> => {
    const subCommentRef = doc(db, 'posts', postId, 'comments', commentId, 'subcomments', subCommentId);
    try {
        await runTransaction(db, async (transaction) => {
            const subCommentSnap = await transaction.get(subCommentRef);
            if (!subCommentSnap.exists()) throw new Error("Subcomment does not exist!");
            const subCommentData = subCommentSnap.data();
            const likedBy: string[] = subCommentData.likedBy || [];
            const likeCount: number = typeof subCommentData.likeCount === 'number' ? subCommentData.likeCount : 0;
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
            transaction.update(subCommentRef, {
                likedBy: newLikedBy,
                likeCount: newLikeCount,
                updatedAt: serverTimestamp()
            });
        });
    } catch (error: any) {
        throw new Error(`Failed to toggle subcomment like: ${error.message}`);
    }
};

// --- News Article Comment Functions ---
const NEWS_COMMENTS_SUBCOLLECTION = 'newsComments';
const NEWS_SUBCOMMENTS_SUBCOLLECTION = 'newsSubcomments';

export const addNewsCommentToArticle = async (articleId: string, commentData: Omit<NewCommentData, 'likeCount' | 'likedBy'>): Promise<string> => {
  if (!articleId) throw new Error('Article ID is required.');
  if (!commentData.userId) throw new Error('User ID is required.');
  if (!commentData.text?.trim()) throw new Error('Comment text cannot be empty.');

  try {
    const articleDocRef = doc(db, 'newsArticles', articleId);
    const commentsCollectionRef = collection(articleDocRef, NEWS_COMMENTS_SUBCOLLECTION);
    const fullCommentData: NewCommentData & { timestamp: Timestamp; updatedAt: Timestamp; } = {
      ...commentData,
      likeCount: 0,
      likedBy: [],
      isShadowBanned: false, // Default for new comments
      mentionedUserIds: commentData.mentionedUserIds || [],
      timestamp: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp,
    };
    const docRef = await addDoc(commentsCollectionRef, fullCommentData);
    await incrementNewsArticleCommentCount(articleId);
    // Simplified: Notification logic for news comments can be added similarly to post comments if needed
    return docRef.id;
  } catch (error: any) {
    throw new Error(`Failed to add news comment: ${error.message}`);
  }
};

export const getNewsCommentsForArticle = async (articleId: string): Promise<ClientComment[]> => {
  if (!articleId) return [];
  // const articleAuthor = (await getDoc(doc(db, 'newsArticles', articleId))).data()?.userId; // Not needed for fetching all comments

  try {
    const articleDocRef = doc(db, 'newsArticles', articleId);
    const commentsCollectionRef = collection(articleDocRef, NEWS_COMMENTS_SUBCOLLECTION);
    const q = query(commentsCollectionRef, orderBy('timestamp', 'asc'), limit(100));
    const querySnapshot = await getDocs(q);

    const commentsPromises = querySnapshot.docs.map(async (docSnap) => {
      const data = docSnap.data();
      if (!data.userId || !data.text || !(data.timestamp instanceof Timestamp)) return null;
      // No longer filter by isShadowBanned here; client will handle it
      // if (data.isShadowBanned === true && auth.currentUser?.uid !== articleAuthor) return null;

      const userProfile = await fetchUserProfileBasic(data.userId);
      return {
        id: docSnap.id,
        userId: data.userId,
        text: data.text,
        timestamp: data.timestamp.toMillis(),
        userName: userProfile?.displayName || generateAnonymousName(data.userId),
        userAvatar: userProfile?.avatarUrl,
        mentionName: data.mentionName || userProfile?.displayName || generateAnonymousName(data.userId),
        likeCount: data.likeCount || 0,
        likedBy: data.likedBy || [],
        mentionedUserIds: data.mentionedUserIds || [],
        isShadowBanned: data.isShadowBanned === true,
      } as ClientComment;
    });
    return (await Promise.all(commentsPromises)).filter((c): c is ClientComment => c !== null);
  } catch (error: any) {
    throw new Error(`Failed to fetch news comments: ${error.message}`);
  }
};

export const toggleLikeNewsComment = async (articleId: string, commentId: string, userId: string): Promise<void> => {
  const commentRef = doc(db, 'newsArticles', articleId, NEWS_COMMENTS_SUBCOLLECTION, commentId);
  try {
    await runTransaction(db, async (transaction) => {
      const commentSnap = await transaction.get(commentRef);
      if (!commentSnap.exists()) throw new Error("News comment does not exist!");
      const commentData = commentSnap.data();
      const likedBy: string[] = commentData.likedBy || [];
      const likeCount = commentData.likeCount || 0;
      const isLiked = likedBy.includes(userId);
      transaction.update(commentRef, {
        likedBy: isLiked ? arrayRemove(userId) : arrayUnion(userId),
        likeCount: increment(isLiked ? -1 : 1),
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error: any) {
    throw new Error(`Failed to toggle like on news comment: ${error.message}`);
  }
};

export const toggleShadowBanNewsComment = async (articleId: string, commentId: string, newBanStatus: boolean, currentUserId: string): Promise<void> => {
  const articleRef = doc(db, 'newsArticles', articleId);
  const articleSnap = await getDoc(articleRef);
  if (!articleSnap.exists() || articleSnap.data()?.userId !== currentUserId) {
    throw new Error("Permission denied: Only the article author can shadow ban comments.");
  }
  const commentRef = doc(db, 'newsArticles', articleId, NEWS_COMMENTS_SUBCOLLECTION, commentId);
  await updateDoc(commentRef, {
    isShadowBanned: newBanStatus,
    updatedAt: serverTimestamp(),
  });
};

// --- News Article SubComment Functions ---
export const addNewsSubCommentToNewsComment = async (articleId: string, commentId: string, subCommentData: Omit<NewSubCommentData, 'likeCount' | 'likedBy'>): Promise<string> => {
  if (!articleId || !commentId) throw new Error('Article ID and Comment ID are required.');
  if (!subCommentData.userId || !subCommentData.text?.trim()) throw new Error('User ID and text are required.');

  try {
    const commentDocRef = doc(db, 'newsArticles', articleId, NEWS_COMMENTS_SUBCOLLECTION, commentId);
    const subCommentsCollectionRef = collection(commentDocRef, NEWS_SUBCOMMENTS_SUBCOLLECTION);
    const fullSubCommentData: NewSubCommentData & { timestamp: Timestamp; updatedAt: Timestamp; } = {
      ...subCommentData,
      likeCount: 0,
      likedBy: [],
      isShadowBanned: false, // Default for new subcomments
      mentionedUserIds: subCommentData.mentionedUserIds || [],
      timestamp: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp,
    };
    const docRef = await addDoc(subCommentsCollectionRef, fullSubCommentData);
    await incrementNewsArticleCommentCount(articleId); // Increment parent article's comment count
    return docRef.id;
  } catch (error: any) {
    throw new Error(`Failed to add news subcomment: ${error.message}`);
  }
};

export const getNewsSubCommentsForComment = async (articleId: string, commentId: string): Promise<ClientSubComment[]> => {
  if (!articleId || !commentId) return [];
  // const articleAuthor = (await getDoc(doc(db, 'newsArticles', articleId))).data()?.userId;

  try {
    const commentDocRef = doc(db, 'newsArticles', articleId, NEWS_COMMENTS_SUBCOLLECTION, commentId);
    const subCommentsCollectionRef = collection(commentDocRef, NEWS_SUBCOMMENTS_SUBCOLLECTION);
    const q = query(subCommentsCollectionRef, orderBy('timestamp', 'asc'), limit(50));
    const querySnapshot = await getDocs(q);

    const subCommentsPromises = querySnapshot.docs.map(async (docSnap) => {
      const data = docSnap.data();
      if (!data.userId || !data.text || !(data.timestamp instanceof Timestamp)) return null;
      // No longer filter by isShadowBanned here
      // if (data.isShadowBanned === true && auth.currentUser?.uid !== articleAuthor) return null;

      const userProfile = await fetchUserProfileBasic(data.userId);
      return {
        id: docSnap.id,
        userId: data.userId,
        text: data.text,
        timestamp: data.timestamp.toMillis(),
        userName: userProfile?.displayName || generateAnonymousName(data.userId),
        userAvatar: userProfile?.avatarUrl,
        mentionName: data.mentionName || userProfile?.displayName || generateAnonymousName(data.userId),
        likeCount: data.likeCount || 0,
        likedBy: data.likedBy || [],
        mentionedUserIds: data.mentionedUserIds || [],
        isShadowBanned: data.isShadowBanned === true,
      } as ClientSubComment;
    });
    return (await Promise.all(subCommentsPromises)).filter((sc): sc is ClientSubComment => sc !== null);
  } catch (error: any) {
    throw new Error(`Failed to fetch news subcomments: ${error.message}`);
  }
};

export const toggleLikeNewsSubComment = async (articleId: string, commentId: string, subCommentId: string, userId: string): Promise<void> => {
  const subCommentRef = doc(db, 'newsArticles', articleId, NEWS_COMMENTS_SUBCOLLECTION, commentId, NEWS_SUBCOMMENTS_SUBCOLLECTION, subCommentId);
  try {
    await runTransaction(db, async (transaction) => {
      const subCommentSnap = await transaction.get(subCommentRef);
      if (!subCommentSnap.exists()) throw new Error("News subcomment does not exist!");
      const subCommentData = subCommentSnap.data();
      const likedBy: string[] = subCommentData.likedBy || [];
      const likeCount = subCommentData.likeCount || 0;
      const isLiked = likedBy.includes(userId);
      transaction.update(subCommentRef, {
        likedBy: isLiked ? arrayRemove(userId) : arrayUnion(userId),
        likeCount: increment(isLiked ? -1 : 1),
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error: any) {
    throw new Error(`Failed to toggle like on news subcomment: ${error.message}`);
  }
};

export const toggleShadowBanNewsSubComment = async (articleId: string, commentId: string, subCommentId: string, newBanStatus: boolean, currentUserId: string): Promise<void> => {
  const articleRef = doc(db, 'newsArticles', articleId);
  const articleSnap = await getDoc(articleRef);
  if (!articleSnap.exists() || articleSnap.data()?.userId !== currentUserId) {
    throw new Error("Permission denied: Only the article author can shadow ban subcomments.");
  }
  const subCommentRef = doc(db, 'newsArticles', articleId, NEWS_COMMENTS_SUBCOLLECTION, commentId, NEWS_SUBCOMMENTS_SUBCOLLECTION, subCommentId);
  await updateDoc(subCommentRef, {
    isShadowBanned: newBanStatus,
    updatedAt: serverTimestamp(),
  });
};

export const deleteNewsComment = async (articleId: string, commentId: string, userId: string): Promise<void> => {
  const commentRef = doc(db, 'newsArticles', articleId, NEWS_COMMENTS_SUBCOLLECTION, commentId);
  const commentSnap = await getDoc(commentRef);
  if (!commentSnap.exists() || commentSnap.data()?.userId !== userId) {
    throw new Error("Comment not found or permission denied.");
  }
  await deleteDoc(commentRef);
  await decrementNewsArticleCommentCount(articleId);
};

export const deleteNewsSubComment = async (articleId: string, commentId: string, subCommentId: string, userId: string): Promise<void> => {
  const subCommentRef = doc(db, 'newsArticles', articleId, NEWS_COMMENTS_SUBCOLLECTION, commentId, NEWS_SUBCOMMENTS_SUBCOLLECTION, subCommentId);
  const subCommentSnap = await getDoc(subCommentRef);
  if (!subCommentSnap.exists() || subCommentSnap.data()?.userId !== userId) {
    throw new Error("Subcomment not found or permission denied.");
  }
  await deleteDoc(subCommentRef);
  await decrementNewsArticleCommentCount(articleId); // Decrement parent article's comment count
};
