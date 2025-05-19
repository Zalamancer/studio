
// src/services/commentService.ts
// Client-callable by default (no 'use server;' at the top)

import { db } from '@/lib/firebase/config';
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
  increment, // For updating likeCount atomically
} from 'firebase/firestore';
import type { NewCommentData, ClientComment, NewSubCommentData, ClientSubComment } from '@/types/comment';
import { getUserProfileBasic } from '@/services/connectionService';
import { createNotification } from './notificationService';
import type { NewNotificationData } from '@/types/notification';
import { getPostDetails } from './messagingService';
import { generateAnonymousName } from '@/lib/pseudonymUtils'; // For fallback names

// Helper function to extract mentioned user UIDs from text
// This assumes mentions are in the format @UID and UIDs are alphanumeric with underscores.
// This helper is LOCAL to this service. The global one is in page.tsx
const extractMentionsFromTextService = (text: string): string[] => {
  console.log(`%c[commentService] extractMentionsFromTextService - Input Text: "${text}"`, "color: #FF8C00");
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

// --- Comment Functions ---

export const addCommentToPost = async (postId: string, commentData: Omit<NewCommentData, 'likeCount' | 'likedBy'>): Promise<string> => {
  console.log(`%c[commentService] addCommentToPost: Called for postId '${postId}' by userId '${commentData.userId}'. Comment text: "${commentData.text?.substring(0,50)}..."`, "color: blue;");
  if (!postId) throw new Error('Post ID is required to add a comment.');
  if (!commentData.userId) throw new Error('User ID is required for the comment.');
  if (!commentData.text || commentData.text.trim() === '') throw new Error('Comment text cannot be empty.');

  try {
    const postDocRef = doc(db, 'posts', postId);
    const commentsCollectionRef = collection(postDocRef, 'comments');

    // IMPORTANT: The commentData.mentionedUserIds should already be an array of UIDs resolved by the client (e.g., extractMentionedUids in page.tsx)
    const resolvedMentionedUids = Array.isArray(commentData.mentionedUserIds) ? commentData.mentionedUserIds : [];
    console.log(`%c[commentService] addCommentToPost: Received resolvedMentionedUids from client:`, "color: blue;", resolvedMentionedUids);


    const fullCommentData: NewCommentData & { timestamp: Timestamp } = {
      ...commentData,
      likeCount: 0,
      likedBy: [],
      mentionedUserIds: resolvedMentionedUids, // Use the UIDs passed from the client
      timestamp: serverTimestamp() as Timestamp,
    };

    const docRef = await addDoc(commentsCollectionRef, fullCommentData);
    const newCommentId = docRef.id;
    console.log(`%c[commentService] addCommentToPost: Comment added successfully to post ${postId} with ID: ${newCommentId}`, "color: green;");

    const postDetails = await getPostDetails(postId); // Fetch post details once

    // Notify mentioned users
    if (resolvedMentionedUids.length > 0) {
      console.log(`%c[commentService] addCommentToPost: Processing ${resolvedMentionedUids.length} mentions for notifications using UIDs.`, "color: blue;");
      for (const mentionedRecipientUid of resolvedMentionedUids) {
        // Ensure mentionedRecipientUid is a valid UID before proceeding
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
      console.error("Firestore permission denied. Check security rules for writing to posts/{postId}/comments subcollection.");
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
  // console.log(`[commentService] Fetching comments for post: ${postId}`);

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
        const profile = await getUserProfileBasic(userId);
        userProfilesMap.set(userId, {
            displayName: profile?.displayName || generateAnonymousName(userId), // Fallback to generated name
            avatarUrl: profile?.avatarUrl
        });
    }));

    const comments = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      if (!data.userId || !data.text || !(data.timestamp instanceof Timestamp)) {
        // console.warn(`[commentService] Document ${docSnap.id} has missing or invalid fields.`);
        return null;
      }
      const timestampMillis = data.timestamp.toMillis();
      const userProfile = userProfilesMap.get(data.userId);
      return {
        id: docSnap.id,
        userId: data.userId,
        text: data.text,
        timestamp: timestampMillis,
        userName: userProfile?.displayName, // Will use the fetched/generated name
        userAvatar: userProfile?.avatarUrl,
        likeCount: data.likeCount || 0,
        likedBy: data.likedBy || [],
        mentionedUserIds: data.mentionedUserIds || [],
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
    if (!postId || !commentId || !userId) {
        throw new Error('Post ID, Comment ID, and User ID are required to toggle like.');
    }
    const commentRef = doc(db, 'posts', postId, 'comments', commentId);
    try {
        await runTransaction(db, async (transaction) => {
            const commentSnap = await transaction.get(commentRef);
            if (!commentSnap.exists()) {
                throw new Error("Comment does not exist!");
            }
            const commentData = commentSnap.data();
            const likedBy: string[] = commentData.likedBy || [];
            const isLiked = likedBy.includes(userId);
            if (isLiked) {
                transaction.update(commentRef, {
                    likedBy: arrayRemove(userId),
                    likeCount: increment(-1)
                });
            } else {
                transaction.update(commentRef, {
                    likedBy: arrayUnion(userId),
                    likeCount: increment(1)
                });
            }
        });
    } catch (error: any) {
        console.error(`[commentService] Error toggling like for comment ${commentId}:`, error);
        if (error.code === 'permission-denied') {
            throw new Error('Permission denied. Check Firestore security rules.');
        }
        throw new Error(`Failed to toggle like: ${error.message}`);
    }
};

export const deleteCommentFromPost = async (postId: string, commentId: string): Promise<void> => {
  if (!postId || !commentId) {
    throw new Error('Post ID and Comment ID are required to delete a comment.');
  }
  try {
    const commentDocRef = doc(db, 'posts', postId, 'comments', commentId);
    await deleteDoc(commentDocRef);
  } catch (error: any) {
    console.error(`[commentService] Error deleting comment ${commentId} from post ${postId}:`, error);
    if (error.code === 'permission-denied') {
      throw new Error('Permission denied deleting comment. Ensure you own the comment or have appropriate permissions.');
    }
    throw new Error(`Failed to delete comment: ${error.message}`);
  }
};

// --- SubComment Functions ---

export const addSubCommentToComment = async (postId: string, commentId: string, subCommentData: Omit<NewSubCommentData, 'likeCount' | 'likedBy'>): Promise<string> => {
  console.log(`%c[commentService] addSubCommentToComment: Called for postId '${postId}', commentId '${commentId}' by userId '${subCommentData.userId}'. Text: "${subCommentData.text?.substring(0,50)}..."`, "color: blue;");
  if (!postId || !commentId) throw new Error('Post ID and Comment ID are required to add a subcomment.');
  if (!subCommentData.userId) throw new Error('User ID is required for the subcomment.');
  if (!subCommentData.text || subCommentData.text.trim() === '') throw new Error('Subcomment text cannot be empty.');

  try {
    const commentDocRef = doc(db, 'posts', postId, 'comments', commentId);
    const subCommentsCollectionRef = collection(commentDocRef, 'subcomments');

    // IMPORTANT: subCommentData.mentionedUserIds should already be an array of UIDs resolved by the client
    const resolvedMentionedUids = Array.isArray(subCommentData.mentionedUserIds) ? subCommentData.mentionedUserIds : [];
    console.log(`%c[commentService] addSubCommentToComment: Received resolvedMentionedUids from client:`, "color: blue;", resolvedMentionedUids);


    const fullSubCommentData: NewSubCommentData & { timestamp: Timestamp } = {
        ...subCommentData,
        likeCount: 0,
        likedBy: [],
        mentionedUserIds: resolvedMentionedUids,
        timestamp: serverTimestamp() as Timestamp,
    };

    const docRef = await addDoc(subCommentsCollectionRef, fullSubCommentData);
    const newSubCommentId = docRef.id;
    console.log(`%c[commentService] addSubCommentToComment: Subcomment added successfully to comment ${commentId} with ID: ${newSubCommentId}`, "color: green;");

    const postDetails = await getPostDetails(postId);
    const commentSnap = await getDoc(commentDocRef);
    const originalCommenterId = commentSnap.data()?.userId;

    // Notify original commenter about the reply (if not the same person)
    if (originalCommenterId && originalCommenterId !== subCommentData.userId) {
        const replyNotificationPayload: Omit<NewNotificationData, 'senderName' | 'senderAvatar'> = {
            userId: originalCommenterId,
            type: 'reply',
            senderId: subCommentData.userId,
            postId: postId,
            postQuestion: postDetails?.question || null,
            commentId: commentId,
            subCommentId: newSubCommentId,
            textSnippet: subCommentData.text.substring(0, 100),
        };
        console.log(`%c[commentService] addSubCommentToComment: Attempting to create 'reply' notification for original commenter '${originalCommenterId}'. Payload:`, "color: blue;", replyNotificationPayload);
        try {
             await createNotification(replyNotificationPayload);
             console.log(`%c[commentService] addSubCommentToComment: Reply notification CREATED for original commenter ${originalCommenterId}`, "color: green;");
        } catch (notifyError: any) {
             console.error(`%c[commentService] addSubCommentToComment: FAILED to create reply notification for original commenter ${originalCommenterId}. Error:`, "color: red;", notifyError.message, notifyError);
        }
    }

    // Notify mentioned users
    if (resolvedMentionedUids.length > 0) {
       console.log(`%c[commentService] addSubCommentToComment: Processing ${resolvedMentionedUids.length} mentions for notifications using UIDs.`, "color: blue;");
       for (const mentionedRecipientUid of resolvedMentionedUids) {
           // Ensure mentionedRecipientUid is a valid UID
            if (!mentionedRecipientUid || typeof mentionedRecipientUid !== 'string' || !/^[a-zA-Z0-9]{20,}$/.test(mentionedRecipientUid)) {
                console.warn(`%c[commentService] addSubCommentToComment: Invalid or non-UID identifier found in resolvedMentionedUids, skipping notification for: '${mentionedRecipientUid}'`, "color: orange;");
                continue;
            }

           const isMentioningOriginalCommenter = mentionedRecipientUid === originalCommenterId;

           // Send mention notification if:
           // 1. The mentioned user is NOT the original commenter (they already get a 'reply' notification if different from sub-commenter)
           // OR
           // 2. The mentioned user IS the original commenter, AND the sub-commenter IS ALSO the original commenter (i.e., original commenter mentioning themselves in their own reply)
           if (!isMentioningOriginalCommenter || (isMentioningOriginalCommenter && subCommentData.userId === originalCommenterId)) {
               const mentionNotificationPayload: Omit<NewNotificationData, 'senderName' | 'senderAvatar'> = {
                   userId: mentionedRecipientUid,
                   type: 'mention',
                   senderId: subCommentData.userId,
                   postId: postId,
                   postQuestion: postDetails?.question || null,
                   commentId: commentId,
                   subCommentId: newSubCommentId,
                   textSnippet: subCommentData.text.substring(0, 100),
               };
               console.log(`%c[commentService] addSubCommentToComment: Attempting to create 'mention' notification for recipient UID '${mentionedRecipientUid}'. Payload:`, "color: blue;", mentionNotificationPayload);
               try {
                   await createNotification(mentionNotificationPayload);
                   console.log(`%c[commentService] addSubCommentToComment: Mention notification CREATED for recipient ${mentionedRecipientUid} regarding subcomment ${newSubCommentId}`, "color: green;");
               } catch (notifyError: any) {
                   console.error(`%c[commentService] addSubCommentToComment: FAILED to create mention notification for recipient ${mentionedRecipientUid}. Error:`, "color: red;", notifyError.message, notifyError);
               }
           } else {
                console.log(`%c[commentService] addSubCommentToComment: SKIPPING mention notification for original commenter '${mentionedRecipientUid}' as they already received/will receive a 'reply' notification.`, "color: #FFA500;");
           }
       }
    }
    return newSubCommentId;
  } catch (error: any) {
    console.error(`%c[commentService] addSubCommentToComment: Error adding subcomment to comment ${commentId}:`, "color: red;", error);
    if (error.code === 'permission-denied') {
      throw new Error('Permission denied. Check Firestore security rules.');
    }
    throw new Error(`Failed to add subcomment: ${error.message}`);
  }
};

export const getSubCommentsForComment = async (postId: string, commentId: string): Promise<ClientSubComment[]> => {
  if (!postId || !commentId) {
    console.warn("[commentService] getSubCommentsForComment called with invalid postId or commentId.");
    return [];
  }
  try {
    const commentDocRef = doc(db, 'posts', postId, 'comments', commentId);
    const subCommentsCollectionRef = collection(commentDocRef, 'subcomments');
    const q = query(
      subCommentsCollectionRef,
      orderBy('timestamp', 'asc'),
      limit(50)
    );

    const querySnapshot = await getDocs(q);
    const userIds = Array.from(new Set(querySnapshot.docs.map(docSnap => docSnap.data().userId).filter(Boolean)));
    const userProfilesMap = new Map<string, { displayName: string; avatarUrl?: string }>();
    await Promise.all(userIds.map(async (userId) => {
        const profile = await getUserProfileBasic(userId);
        userProfilesMap.set(userId, {
            displayName: profile?.displayName || generateAnonymousName(userId), // Fallback to generated name
            avatarUrl: profile?.avatarUrl
        });
    }));

    const subComments = querySnapshot.docs.map((docSnap) => {
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
        userName: userProfile?.displayName, // Will use the fetched/generated name
        userAvatar: userProfile?.avatarUrl,
        likeCount: data.likeCount || 0,
        likedBy: data.likedBy || [],
        mentionedUserIds: data.mentionedUserIds || [],
      } as ClientSubComment;
    }).filter((subComment): subComment is ClientSubComment => subComment !== null);

    return subComments;
  } catch (error: any) {
    console.error(`[commentService] Error fetching subcomments for comment ${commentId}:`, error);
    if (error.code === 'permission-denied') {
      throw new Error('Permission denied fetching subcomments. Check Firestore rules.');
    }
     if (error.code === 'failed-precondition' && error.message.includes('index')) {
        throw new Error("Firestore query requires an index for subcomments. Please create it in the Firebase console.");
    }
    throw new Error(`Failed to fetch subcomments: ${error.message}`);
  }
};

export const deleteSubCommentFromComment = async (postId: string, commentId: string, subCommentId: string): Promise<void> => {
  if (!postId || !commentId || !subCommentId) {
    throw new Error('Post ID, Comment ID, and SubComment ID are required to delete a subcomment.');
  }
  try {
    const subCommentDocRef = doc(db, 'posts', postId, 'comments', commentId, 'subcomments', subCommentId);
    await deleteDoc(subCommentDocRef);
  } catch (error: any) {
    console.error(`[commentService] Error deleting subcomment ${subCommentId} from comment ${commentId}:`, error);
    if (error.code === 'permission-denied') {
      throw new Error('Permission denied deleting subcomment. Ensure you own the subcomment or have appropriate permissions.');
    }
    throw new Error(`Failed to delete subcomment: ${error.message}`);
  }
};

export const toggleLikeSubComment = async (postId: string, commentId: string, subCommentId: string, userId: string): Promise<void> => {
    if (!postId || !commentId || !subCommentId || !userId) {
        throw new Error('Post ID, Comment ID, SubComment ID, and User ID are required to toggle like.');
    }
    const subCommentRef = doc(db, 'posts', postId, 'comments', commentId, 'subcomments', subCommentId);
    try {
        await runTransaction(db, async (transaction) => {
            const subCommentSnap = await transaction.get(subCommentRef);
            if (!subCommentSnap.exists()) {
                throw new Error("Subcomment does not exist!");
            }
            const subCommentData = subCommentSnap.data();
            const likedBy: string[] = subCommentData.likedBy || [];
            const isLiked = likedBy.includes(userId);
            if (isLiked) {
                transaction.update(subCommentRef, {
                    likedBy: arrayRemove(userId),
                    likeCount: increment(-1)
                });
            } else {
                transaction.update(subCommentRef, {
                    likedBy: arrayUnion(userId),
                    likeCount: increment(1)
                });
            }
        });
    } catch (error: any) {
        console.error(`[commentService] Error toggling like for subcomment ${subCommentId}:`, error);
        if (error.code === 'permission-denied') {
            throw new Error('Permission denied. Check Firestore security rules.');
        }
        throw new Error(`Failed to toggle subcomment like: ${error.message}`);
    }
};

