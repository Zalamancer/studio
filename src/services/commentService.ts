
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
  increment, // For updating likeCount atomically
} from 'firebase/firestore';
import type { NewCommentData, ClientComment, NewSubCommentData, ClientSubComment } from '@/types/comment';
import { fetchUserProfileBasic } from '@/services/connectionService'; // CORRECTED IMPORT
import { createNotification } from './notificationService';
import type { NewNotificationData } from '@/types/notification';
import { getPostDetails } from './messagingService';
import { generateAnonymousName } from '@/lib/pseudonymUtils'; // For fallback names

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

// --- Comment Functions ---

export const addCommentToPost = async (postId: string, commentData: Omit<NewCommentData, 'likeCount' | 'likedBy'>): Promise<string> => {
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
      timestamp: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp,
    };

    const docRef = await addDoc(commentsCollectionRef, fullCommentData);
    const newCommentId = docRef.id;
    console.log(`%c[commentService] addCommentToPost: Comment added successfully to post ${postId} with ID: ${newCommentId}`, "color: green;");

    const postDetails = await getPostDetails(postId);

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
        const profile = await fetchUserProfileBasic(userId); // CORRECTED USAGE
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
    console.log(`%c[commentService] toggleLikeComment: User '${userId}' on post '${postId}', comment '${commentId}'`, "color: magenta;");
    if (!postId || !commentId || !userId) {
        const errorMsg = 'Post ID, Comment ID, and User ID are required to toggle like.';
        console.error(`%c[commentService] toggleLikeComment: VALIDATION FAILED - ${errorMsg}`, "color: red;");
        throw new Error(errorMsg);
    }
    const commentRef = doc(db, 'posts', postId, 'comments', commentId);
    console.log(`%c[commentService] toggleLikeComment: Document ref: ${commentRef.path}`, "color: magenta;");

    try {
        await runTransaction(db, async (transaction) => {
            console.log(`%c[commentService] toggleLikeComment: Transaction started for comment '${commentId}'. Fetching document...`, "color: magenta;");
            const commentSnap = await transaction.get(commentRef);
            if (!commentSnap.exists()) {
                console.error(`%c[commentService] toggleLikeComment: Comment '${commentId}' does not exist!`, "color: red;");
                throw new Error("Comment does not exist!");
            }
            const commentData = commentSnap.data();
            console.log(`%c[commentService] toggleLikeComment: Comment data fetched:`, "color: magenta;", commentData);

            const likedBy: string[] = commentData.likedBy || [];
            const likeCount: number = typeof commentData.likeCount === 'number' ? commentData.likeCount : 0;
            const isLiked = likedBy.includes(userId);
            console.log(`%c[commentService] toggleLikeComment: User '${userId}' ${isLiked ? 'has liked' : 'has NOT liked'} this comment. Current likeCount: ${likeCount}`, "color: magenta;");

            let newLikedBy: string[];
            let newLikeCount: number;

            if (isLiked) {
                newLikedBy = likedBy.filter(uid => uid !== userId);
                newLikeCount = Math.max(0, likeCount - 1); 
                console.log(`%c[commentService] toggleLikeComment: UNLIKING. New likedBy: [${newLikedBy.join(', ')}], new likeCount: ${newLikeCount}`, "color: magenta;");
            } else {
                newLikedBy = [...likedBy, userId];
                newLikeCount = likeCount + 1;
                console.log(`%c[commentService] toggleLikeComment: LIKING. New likedBy: [${newLikedBy.join(', ')}], new likeCount: ${newLikeCount}`, "color: magenta;");
            }
            
            transaction.update(commentRef, {
                likedBy: newLikedBy,
                likeCount: newLikeCount,
                updatedAt: serverTimestamp() // Explicitly update timestamp
            });
            console.log(`%c[commentService] toggleLikeComment: Transaction update prepared for comment '${commentId}'.`, "color: magenta;");
        });
        console.log(`%c[commentService] toggleLikeComment: Transaction for comment '${commentId}' SUCCEEDED.`, "color: green;");
    } catch (error: any) {
        console.error(`%c[commentService] toggleLikeComment: Error toggling like for comment ${commentId}:`, "color: red;", error);
        if (error.code === 'permission-denied') {
            throw new Error('Permission denied to like/unlike comment. Check Firestore security rules.');
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

    const resolvedMentionedUids = Array.isArray(subCommentData.mentionedUserIds) ? subCommentData.mentionedUserIds : [];
    console.log(`%c[commentService] addSubCommentToComment: Received resolvedMentionedUids from client:`, "color: blue;", resolvedMentionedUids);


    const fullSubCommentData: NewSubCommentData & { timestamp: Timestamp; updatedAt: Timestamp; } = {
        ...subCommentData,
        likeCount: 0,
        likedBy: [],
        mentionedUserIds: resolvedMentionedUids,
        timestamp: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp,
    };

    const docRef = await addDoc(subCommentsCollectionRef, fullSubCommentData);
    const newSubCommentId = docRef.id;
    console.log(`%c[commentService] addSubCommentToComment: Subcomment added successfully to comment ${commentId} with ID: ${newSubCommentId}`, "color: green;");

    const postDetails = await getPostDetails(postId);
    const commentSnap = await getDoc(commentDocRef);
    const originalCommenterId = commentSnap.data()?.userId;

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

    if (resolvedMentionedUids.length > 0) {
       console.log(`%c[commentService] addSubCommentToComment: Processing ${resolvedMentionedUids.length} mentions for notifications using UIDs.`, "color: blue;");
       for (const mentionedRecipientUid of resolvedMentionedUids) {
            if (!mentionedRecipientUid || typeof mentionedRecipientUid !== 'string' || !/^[a-zA-Z0-9]{20,}$/.test(mentionedRecipientUid)) {
                console.warn(`%c[commentService] addSubCommentToComment: Invalid or non-UID identifier found in resolvedMentionedUids, skipping notification for: '${mentionedRecipientUid}'`, "color: orange;");
                continue;
            }

           const isMentioningOriginalCommenter = mentionedRecipientUid === originalCommenterId;

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
        const profile = await fetchUserProfileBasic(userId); // CORRECTED USAGE
        userProfilesMap.set(userId, {
            displayName: profile?.displayName || generateAnonymousName(userId),
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
        userName: userProfile?.displayName,
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
    console.log(`%c[commentService] toggleLikeSubComment: User '${userId}' on post '${postId}', comment '${commentId}', subComment '${subCommentId}'`, "color: magenta;");
    if (!postId || !commentId || !subCommentId || !userId) {
        const errorMsg = 'Post ID, Comment ID, SubComment ID, and User ID are required to toggle like.';
        console.error(`%c[commentService] toggleLikeSubComment: VALIDATION FAILED - ${errorMsg}`, "color: red;");
        throw new Error(errorMsg);
    }
    const subCommentRef = doc(db, 'posts', postId, 'comments', commentId, 'subcomments', subCommentId);
    console.log(`%c[commentService] toggleLikeSubComment: Document ref: ${subCommentRef.path}`, "color: magenta;");

    try {
        await runTransaction(db, async (transaction) => {
            console.log(`%c[commentService] toggleLikeSubComment: Transaction started for subComment '${subCommentId}'. Fetching document...`, "color: magenta;");
            const subCommentSnap = await transaction.get(subCommentRef);
            if (!subCommentSnap.exists()) {
                console.error(`%c[commentService] toggleLikeSubComment: SubComment '${subCommentId}' does not exist!`, "color: red;");
                throw new Error("Subcomment does not exist!");
            }
            const subCommentData = subCommentSnap.data();
            console.log(`%c[commentService] toggleLikeSubComment: SubComment data fetched:`, "color: magenta;", subCommentData);

            const likedBy: string[] = subCommentData.likedBy || [];
            const likeCount: number = typeof subCommentData.likeCount === 'number' ? subCommentData.likeCount : 0;
            const isLiked = likedBy.includes(userId);
            console.log(`%c[commentService] toggleLikeSubComment: User '${userId}' ${isLiked ? 'has liked' : 'has NOT liked'} this subComment. Current likeCount: ${likeCount}`, "color: magenta;");

            let newLikedBy: string[];
            let newLikeCount: number;

            if (isLiked) {
                newLikedBy = likedBy.filter(uid => uid !== userId);
                newLikeCount = Math.max(0, likeCount - 1);
                console.log(`%c[commentService] toggleLikeSubComment: UNLIKING. New likedBy: [${newLikedBy.join(', ')}], new likeCount: ${newLikeCount}`, "color: magenta;");
            } else {
                newLikedBy = [...likedBy, userId];
                newLikeCount = likeCount + 1;
                console.log(`%c[commentService] toggleLikeSubComment: LIKING. New likedBy: [${newLikedBy.join(', ')}], new likeCount: ${newLikeCount}`, "color: magenta;");
            }
            
            transaction.update(subCommentRef, {
                likedBy: newLikedBy,
                likeCount: newLikeCount,
                updatedAt: serverTimestamp() // Explicitly update timestamp
            });
            console.log(`%c[commentService] toggleLikeSubComment: Transaction update prepared for subComment '${subCommentId}'.`, "color: magenta;");
        });
        console.log(`%c[commentService] toggleLikeSubComment: Transaction for subComment '${subCommentId}' SUCCEEDED.`, "color: green;");
    } catch (error: any) {
        console.error(`%c[commentService] toggleLikeSubComment: Error toggling like for subcomment ${subCommentId}:`, "color: red;", error);
        if (error.code === 'permission-denied') {
            throw new Error('Permission denied to like/unlike subcomment. Check Firestore security rules.');
        }
        throw new Error(`Failed to toggle subcomment like: ${error.message}`);
    }
};


    