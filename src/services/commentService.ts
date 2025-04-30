// src/services/commentService.ts
'use server';

import { db } from '@/lib/firebase/config';
import {
  collection,
  addDoc,
  doc,
  serverTimestamp,
  Timestamp, // Keep Timestamp for type safety
} from 'firebase/firestore';
import type { NewCommentData } from '@/types/comment';

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

// Future functions (e.g., getCommentsForPost) can be added here