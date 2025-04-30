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
} from 'firebase/firestore';
import type { NewCommentData, ClientComment } from '@/types/comment';
import { getUserProfileBasic } from '@/services/connectionService'; // Import function to get basic user info

// Function to add a new comment to a post's subcollection
export const addCommentToPost = async (postId: string, commentData: NewCommentData): Promise<string> => {
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
    // Reference the specific post document
    const postDocRef = doc(db, 'posts', postId);
    // Reference the 'comments' subcollection under that post
    const commentsCollectionRef = collection(postDocRef, 'comments');

    // Add the new comment document with a server timestamp
    const docRef = await addDoc(commentsCollectionRef, {
      ...commentData,
      timestamp: serverTimestamp(), // Let Firestore set the timestamp
    });

    console.log(`Comment added successfully to post ${postId} with ID: ${docRef.id}`);
    return docRef.id;
  } catch (error: any) {
    console.error(`Error adding comment to post ${postId}:`, error);
    if (error.code === 'permission-denied') {
      console.error("Firestore permission denied. Check security rules for writing to posts/{postId}/comments subcollection.");
      throw new Error('Permission denied. Check Firestore security rules.');
    }
    throw new Error(`Failed to add comment: ${error.message}`);
  }
};

// Function to fetch comments for a specific post, returning serializable data
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
      orderBy('timestamp', 'asc'), // Order chronologically
      limit(100) // Limit number of comments fetched
    );

    console.log(`Executing Firestore query for comments on post ${postId}...`);
    const querySnapshot = await getDocs(q);
    console.log(`Query snapshot received. Found ${querySnapshot.docs.length} comment documents.`);

    // Fetch user profiles for all unique commenters in parallel
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
            // Use fallback if profile fetch fails
            userProfilesMap.set(userId, { displayName: `User ${userId.substring(0, 4)}...` });
        }
    }));


    const comments = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data();

      // Basic validation
      if (!data.userId || !data.text || !(data.timestamp instanceof Timestamp)) {
        console.warn(`Document ${docSnap.id} has missing or invalid fields.`);
        return null; // Skip invalid documents
      }

      const timestampMillis = data.timestamp.toMillis();
      const userProfile = userProfilesMap.get(data.userId);

      const clientComment: ClientComment = {
        id: docSnap.id,
        userId: data.userId,
        text: data.text,
        timestamp: timestampMillis,
        userName: userProfile?.displayName || `User ${data.userId.substring(0, 4)}...`, // Add user name with fallback
        userAvatar: userProfile?.avatarUrl, // Add avatar url
      };
      return clientComment;
    }).filter((comment): comment is ClientComment => comment !== null); // Filter out nulls

    console.log(`Successfully mapped ${comments.length} valid client comments for post ${postId}`);
    return comments;

  } catch (error: any) {
    console.error(`Error fetching comments for post ${postId}:`, error);
    if (error.code === 'permission-denied') {
      console.error("Firestore permission denied fetching comments. Check rules for reading 'posts/{postId}/comments'.");
      throw new Error('Permission denied fetching comments. Check Firestore rules.');
    }
    // Check for missing index error specifically for comments query if needed
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
        console.error("Firestore query for comments requires an index. Ensure an index on 'timestamp' (asc) exists for the 'comments' subcollection group or specific path.");
        throw new Error("Firestore query requires an index for comments. Please create it in the Firebase console.");
    }
    throw new Error(`Failed to fetch comments: ${error.message}`);
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
    // Reference the specific comment document within the post's subcollection
    const commentDocRef = doc(db, 'posts', postId, 'comments', commentId);

    // Optional: Check if the document exists before attempting deletion (or let rules handle it)
    // const docSnap = await getDoc(commentDocRef);
    // if (!docSnap.exists()) {
    //     console.warn(`Comment ${commentId} on post ${postId} not found.`);
    //     return; // Or throw error
    // }

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
