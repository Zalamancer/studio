// src/services/commentService.ts
'use server';

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
import { getUserProfileBasic } from '@/services/connectionService'; // Import function to get basic user info
import { createNotification } from './notificationService'; // Import notification service
import type { NewNotificationData } from '@/types/notification';
import { getPostDetails } from './messagingService'; // Import to get post details for notification

// Helper function to extract mentioned user IDs from text
const extractMentions = (text: string): string[] => {
  // Basic regex to find @mentions (adjust as needed for more complex scenarios)
  // This regex assumes mentions are followed by alphanumeric characters and underscores
  const mentionRegex = /@([a-zA-Z0-9_]+)/g;
  const mentions = text.match(mentionRegex);
  if (!mentions) {
    return [];
  }
  // Extract the user ID part (without the '@')
  // TODO: In a real app, you'd likely need a way to map mentioned usernames back to user IDs
  // This placeholder assumes the mention *is* the user ID for simplicity
  return mentions.map(mention => mention.substring(1));
};

// --- Comment Functions ---

// Function to add a new comment to a post's subcollection
export const addCommentToPost = async (postId: string, commentData: Omit<NewCommentData, 'likeCount' | 'likedBy'>): Promise<string> => {
  if (!postId) {
    throw new Error('Post ID is required to add a comment.');
  }
  if (!commentData.userId) {
    throw new Error('User ID is required for the comment.');
  }
  if (!commentData.text || commentData.text.trim() === '') {
    throw new Error('Comment text cannot be empty.');
  }

  try {
    const postDocRef = doc(db, 'posts', postId);
    const commentsCollectionRef = collection(postDocRef, 'comments');

    // Extract mentions
    const mentionedUserIds = extractMentions(commentData.text);

    // Initialize like fields and mentions
    const fullCommentData: NewCommentData & { timestamp: Timestamp } = {
        ...commentData,
        likeCount: 0, // Initialize like count
        likedBy: [], // Initialize empty likedBy array
        mentionedUserIds: mentionedUserIds.length > 0 ? mentionedUserIds : [], // Store mentions
        timestamp: serverTimestamp() as Timestamp, // Add server timestamp here
    };

    const docRef = await addDoc(commentsCollectionRef, fullCommentData);
    const newCommentId = docRef.id;
    console.log(`Comment added successfully to post ${postId} with ID: ${newCommentId}`);

    // --- Create Notifications for Mentions ---
    if (mentionedUserIds.length > 0) {
      const postDetails = await getPostDetails(postId); // Fetch post question for context
      for (const mentionedUserId of mentionedUserIds) {
        if (mentionedUserId !== commentData.userId) { // Don't notify user for self-mention
          const notification: Omit<NewNotificationData, 'senderName' | 'senderAvatar'> = {
            userId: mentionedUserId, // The user being notified
            type: 'mention',
            senderId: commentData.userId, // The user who made the comment
            postId: postId,
            postQuestion: postDetails?.question,
            commentId: newCommentId,
            textSnippet: commentData.text.substring(0, 100), // Snippet of the comment
          };
          try {
             await createNotification(notification);
             console.log(`Mention notification created for user ${mentionedUserId} regarding comment ${newCommentId}`);
          } catch (notifyError) {
              console.error(`Failed to create mention notification for user ${mentionedUserId}:`, notifyError);
              // Decide if failure to notify should block the whole process (probably not)
          }
        }
      }
    }
    // --- End Notification Creation ---


    return newCommentId;
  } catch (error: any) {
    console.error(`Error adding comment to post ${postId}:`, error);
    if (error.code === 'permission-denied') {
      console.error("Firestore permission denied. Check security rules for writing to posts/{postId}/comments subcollection.");
      throw new Error('Permission denied. Check Firestore security rules.');
    }
    throw new Error(`Failed to add comment: ${error.message}`);
  }
};

// Function to fetch comments for a specific post, returning serializable data including likes
export const getCommentsForPost = async (postId: string): Promise<ClientComment[]> => {
  if (!postId) {
    console.warn("getCommentsForPost called with invalid postId.");
    return [];
  }
  console.log(`Fetching comments for post: ${postId}`);

  try {
    const postDocRef = doc(db, 'posts', postId);
    const commentsCollectionRef = collection(postDocRef, 'comments');
    const q = query(
      commentsCollectionRef,
      orderBy('timestamp', 'asc'),
      limit(100)
    );

    console.log(`Executing Firestore query for comments on post ${postId}...`);
    const querySnapshot = await getDocs(q);
    console.log(`Query snapshot received. Found ${querySnapshot.docs.length} comment documents.`);

    const userIds = Array.from(new Set(querySnapshot.docs.map(doc => doc.data().userId).filter(Boolean)));
    const userProfilesMap = new Map<string, { displayName: string; avatarUrl?: string }>();
    await Promise.all(userIds.map(async (userId) => {
        const profile = await getUserProfileBasic(userId);
        if (profile) {
            userProfilesMap.set(userId, {
                displayName: profile.displayName,
                avatarUrl: profile.avatarUrl
            });
        } else {
            userProfilesMap.set(userId, { displayName: `@${userId}` }); // Fallback with @
        }
    }));


    const comments = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data();

      if (!data.userId || !data.text || !(data.timestamp instanceof Timestamp)) {
        console.warn(`Document ${docSnap.id} has missing or invalid fields.`);
        return null;
      }

      const timestampMillis = data.timestamp.toMillis();
      const userProfile = userProfilesMap.get(data.userId);

      const clientComment: ClientComment = {
        id: docSnap.id,
        userId: data.userId,
        text: data.text,
        timestamp: timestampMillis,
        userName: userProfile?.displayName || `@${data.userId}`, // Fallback with @
        userAvatar: userProfile?.avatarUrl,
        likeCount: data.likeCount || 0, // Include like count, default to 0
        likedBy: data.likedBy || [], // Include likedBy array, default to empty
        mentionedUserIds: data.mentionedUserIds || [], // Include mentions
      };
      return clientComment;
    }).filter((comment): comment is ClientComment => comment !== null);

    console.log(`Successfully mapped ${comments.length} valid client comments for post ${postId}`);
    return comments;

  } catch (error: any) {
    console.error(`Error fetching comments for post ${postId}:`, error);
    if (error.code === 'permission-denied') {
      console.error("Firestore permission denied fetching comments. Check rules for reading 'posts/{postId}/comments'.");
      throw new Error('Permission denied fetching comments. Check Firestore rules.');
    }
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
        console.error("Firestore query for comments requires an index. Ensure an index on 'timestamp' (asc) exists for the 'comments' subcollection group or specific path.");
        throw new Error("Firestore query requires an index for comments. Please create it in the Firebase console.");
    }
    throw new Error(`Failed to fetch comments: ${error.message}`);
  }
};

// Function to toggle a like on a comment (atomic update)
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
                // User has already liked, so unlike
                transaction.update(commentRef, {
                    likedBy: arrayRemove(userId),
                    likeCount: increment(-1)
                });
            } else {
                // User has not liked, so like
                transaction.update(commentRef, {
                    likedBy: arrayUnion(userId),
                    likeCount: increment(1)
                });
            }
        });
        console.log(`Like toggled successfully for comment ${commentId} by user ${userId}`);
    } catch (error: any) {
        console.error(`Error toggling like for comment ${commentId}:`, error);
        if (error.code === 'permission-denied') {
            console.error("Firestore permission denied toggling like. Check rules for updating 'posts/{postId}/comments/{commentId}'.");
            throw new Error('Permission denied. Check Firestore security rules.');
        }
        throw new Error(`Failed to toggle like: ${error.message}`);
    }
};


// Function to delete a comment from a post's subcollection
export const deleteCommentFromPost = async (postId: string, commentId: string): Promise<void> => {
  if (!postId) {
    throw new Error('Post ID is required to delete a comment.');
  }
  if (!commentId) {
    throw new Error('Comment ID is required to delete a comment.');
  }

  try {
    const commentDocRef = doc(db, 'posts', postId, 'comments', commentId);
    // Note: Deleting a document does NOT automatically delete its subcollections in Firestore.
    // If you want to delete subcomments when a comment is deleted, you'd need a more complex process (e.g., a Cloud Function).
    await deleteDoc(commentDocRef);
    console.log(`Comment ${commentId} deleted successfully from post ${postId}`);
  } catch (error: any) {
    console.error(`Error deleting comment ${commentId} from post ${postId}:`, error);
    if (error.code === 'permission-denied') {
      console.error("Firestore permission denied deleting comment. Check rules for 'posts/{postId}/comments/{commentId}'.");
      throw new Error('Permission denied deleting comment. Ensure you own the comment or have appropriate permissions.');
    }
    throw new Error(`Failed to delete comment: ${error.message}`);
  }
};

// --- SubComment Functions ---

// Function to add a new subcomment to a comment's subcollection
export const addSubCommentToComment = async (postId: string, commentId: string, subCommentData: Omit<NewSubCommentData, 'likeCount' | 'likedBy'>): Promise<string> => {
  if (!postId || !commentId) {
    throw new Error('Post ID and Comment ID are required to add a subcomment.');
  }
  if (!subCommentData.userId) {
    throw new Error('User ID is required for the subcomment.');
  }
  if (!subCommentData.text || subCommentData.text.trim() === '') {
    throw new Error('Subcomment text cannot be empty.');
  }

  try {
    const commentDocRef = doc(db, 'posts', postId, 'comments', commentId);
    const subCommentsCollectionRef = collection(commentDocRef, 'subcomments');

    // Extract mentions
    const mentionedUserIds = extractMentions(subCommentData.text);

    // Initialize like fields for the subcomment
    const fullSubCommentData: NewSubCommentData & { timestamp: Timestamp } = {
        ...subCommentData,
        likeCount: 0,
        likedBy: [],
        mentionedUserIds: mentionedUserIds.length > 0 ? mentionedUserIds : [], // Store mentions
        timestamp: serverTimestamp() as Timestamp,
    };

    const docRef = await addDoc(subCommentsCollectionRef, fullSubCommentData);
    const newSubCommentId = docRef.id;

    console.log(`Subcomment added successfully to comment ${commentId} with ID: ${newSubCommentId}`);

    // --- Create Notifications for Replies and Mentions ---
    const postDetails = await getPostDetails(postId); // Fetch post question for context
    const commentSnap = await getDoc(commentDocRef);
    const originalCommenterId = commentSnap.data()?.userId;

    // 1. Notify original commenter (if they are not the one replying)
    if (originalCommenterId && originalCommenterId !== subCommentData.userId) {
        const replyNotification: Omit<NewNotificationData, 'senderName' | 'senderAvatar'> = {
            userId: originalCommenterId,
            type: 'reply',
            senderId: subCommentData.userId,
            postId: postId,
            postQuestion: postDetails?.question,
            commentId: commentId,
            subCommentId: newSubCommentId,
            textSnippet: subCommentData.text.substring(0, 100),
        };
         try {
             await createNotification(replyNotification);
             console.log(`Reply notification created for user ${originalCommenterId}`);
         } catch (notifyError) {
             console.error(`Failed to create reply notification for user ${originalCommenterId}:`, notifyError);
         }
    }

    // 2. Notify mentioned users (excluding original commenter if already notified, and self-mentions)
    if (mentionedUserIds.length > 0) {
       for (const mentionedUserId of mentionedUserIds) {
           // Don't notify self, and don't double-notify the original commenter
           if (mentionedUserId !== subCommentData.userId && mentionedUserId !== originalCommenterId) {
               const mentionNotification: Omit<NewNotificationData, 'senderName' | 'senderAvatar'> = {
                   userId: mentionedUserId,
                   type: 'mention',
                   senderId: subCommentData.userId,
                   postId: postId,
                   postQuestion: postDetails?.question,
                   commentId: commentId,
                   subCommentId: newSubCommentId,
                   textSnippet: subCommentData.text.substring(0, 100),
               };
                try {
                   await createNotification(mentionNotification);
                   console.log(`Mention notification created for user ${mentionedUserId} regarding subcomment ${newSubCommentId}`);
                } catch (notifyError) {
                    console.error(`Failed to create mention notification for user ${mentionedUserId}:`, notifyError);
                }
           }
       }
    }
    // --- End Notification Creation ---

    return newSubCommentId;
  } catch (error: any) {
    console.error(`Error adding subcomment to comment ${commentId}:`, error);
    if (error.code === 'permission-denied') {
      console.error("Firestore permission denied. Check security rules for writing to posts/{postId}/comments/{commentId}/subcomments.");
      throw new Error('Permission denied. Check Firestore security rules.');
    }
    throw new Error(`Failed to add subcomment: ${error.message}`);
  }
};

// Function to fetch subcomments for a specific comment, returning serializable data
export const getSubCommentsForComment = async (postId: string, commentId: string): Promise<ClientSubComment[]> => {
  if (!postId || !commentId) {
    console.warn("getSubCommentsForComment called with invalid postId or commentId.");
    return [];
  }
  console.log(`Fetching subcomments for comment: ${commentId} under post: ${postId}`);

  try {
    const commentDocRef = doc(db, 'posts', postId, 'comments', commentId);
    const subCommentsCollectionRef = collection(commentDocRef, 'subcomments');
    const q = query(
      subCommentsCollectionRef,
      orderBy('timestamp', 'asc'),
      limit(50) // Limit number of subcomments fetched
    );

    console.log(`Executing Firestore query for subcomments on comment ${commentId}...`);
    const querySnapshot = await getDocs(q);
    console.log(`Subcomment query snapshot received. Found ${querySnapshot.docs.length} subcomment documents.`);

    // Fetch user profiles for all unique subcommenters in parallel
    const userIds = Array.from(new Set(querySnapshot.docs.map(doc => doc.data().userId).filter(Boolean)));
    const userProfilesMap = new Map<string, { displayName: string; avatarUrl?: string }>();
    await Promise.all(userIds.map(async (userId) => {
        const profile = await getUserProfileBasic(userId);
        if (profile) {
            userProfilesMap.set(userId, {
                displayName: profile.displayName,
                avatarUrl: profile.avatarUrl
            });
        } else {
             userProfilesMap.set(userId, { displayName: `@${userId}` }); // Fallback with @
        }
    }));

    const subComments = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data();

      if (!data.userId || !data.text || !(data.timestamp instanceof Timestamp)) {
        console.warn(`Subcomment document ${docSnap.id} has missing or invalid fields.`);
        return null;
      }

      const timestampMillis = data.timestamp.toMillis();
      const userProfile = userProfilesMap.get(data.userId);

      const clientSubComment: ClientSubComment = {
        id: docSnap.id,
        userId: data.userId,
        text: data.text,
        timestamp: timestampMillis,
        userName: userProfile?.displayName || `@${data.userId}`, // Fallback with @
        userAvatar: userProfile?.avatarUrl,
        likeCount: data.likeCount || 0, // Include like count
        likedBy: data.likedBy || [], // Include likedBy array
        mentionedUserIds: data.mentionedUserIds || [], // Include mentions
      };
      return clientSubComment;
    }).filter((subComment): subComment is ClientSubComment => subComment !== null);

    console.log(`Successfully mapped ${subComments.length} valid client subcomments for comment ${commentId}`);
    return subComments;

  } catch (error: any) {
    console.error(`Error fetching subcomments for comment ${commentId}:`, error);
    if (error.code === 'permission-denied') {
      console.error("Firestore permission denied fetching subcomments. Check rules for reading 'posts/{postId}/comments/{commentId}/subcomments'.");
      throw new Error('Permission denied fetching subcomments. Check Firestore rules.');
    }
     if (error.code === 'failed-precondition' && error.message.includes('index')) {
        console.error("Firestore query for subcomments requires an index. Ensure an index on 'timestamp' (asc) exists for the 'subcomments' subcollection group or specific path.");
        throw new Error("Firestore query requires an index for subcomments. Please create it in the Firebase console.");
    }
    throw new Error(`Failed to fetch subcomments: ${error.message}`);
  }
};

// Function to delete a subcomment from a comment's subcollection
export const deleteSubCommentFromComment = async (postId: string, commentId: string, subCommentId: string): Promise<void> => {
  if (!postId || !commentId || !subCommentId) {
    throw new Error('Post ID, Comment ID, and SubComment ID are required to delete a subcomment.');
  }

  try {
    const subCommentDocRef = doc(db, 'posts', postId, 'comments', commentId, 'subcomments', subCommentId);

    await deleteDoc(subCommentDocRef);
    console.log(`Subcomment ${subCommentId} deleted successfully from comment ${commentId}`);
  } catch (error: any) {
    console.error(`Error deleting subcomment ${subCommentId} from comment ${commentId}:`, error);
    if (error.code === 'permission-denied') {
      console.error("Firestore permission denied deleting subcomment. Check rules for 'posts/{postId}/comments/{commentId}/subcomments/{subCommentId}'.");
      throw new Error('Permission denied deleting subcomment. Ensure you own the subcomment or have appropriate permissions.');
    }
    throw new Error(`Failed to delete subcomment: ${error.message}`);
  }
};

// Function to toggle a like on a subcomment (atomic update)
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
                // User has already liked, so unlike
                transaction.update(subCommentRef, {
                    likedBy: arrayRemove(userId),
                    likeCount: increment(-1)
                });
            } else {
                // User has not liked, so like
                transaction.update(subCommentRef, {
                    likedBy: arrayUnion(userId),
                    likeCount: increment(1)
                });
            }
        });
        console.log(`Like toggled successfully for subcomment ${subCommentId} by user ${userId}`);
    } catch (error: any) {
        console.error(`Error toggling like for subcomment ${subCommentId}:`, error);
        if (error.code === 'permission-denied') {
            console.error("Firestore permission denied toggling subcomment like. Check rules for updating 'posts/{postId}/comments/{commentId}/subcomments/{subCommentId}'.");
            throw new Error('Permission denied. Check Firestore security rules.');
        }
        throw new Error(`Failed to toggle subcomment like: ${error.message}`);
    }
};