// src/services/postService.ts
import { db } from '@/lib/firebase/config';
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  Timestamp,
  limit,
} from 'firebase/firestore';
import type { Post, NewPostData } from '@/types/post';

const postsCollectionRef = collection(db, 'posts');

// Function to add a new post to Firestore
export const addPostToFirestore = async (postData: NewPostData): Promise<string> => {
  try {
    const docRef = await addDoc(postsCollectionRef, {
        ...postData,
        createdAt: Timestamp.fromDate(postData.createdAt), // Convert Date to Timestamp
    });
    console.log("Post added with ID: ", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error adding post to Firestore:', error);
    throw new Error('Failed to add post.'); // Re-throw for handling in mutation
  }
};

// Function to fetch posts from Firestore
export const getPostsFromFirestore = async (): Promise<Post[]> => {
  try {
    // Query posts, order by creation date descending, limit to e.g., 50 latest
    const q = query(postsCollectionRef, orderBy('createdAt', 'desc'), limit(50));
    const querySnapshot = await getDocs(q);
    const posts = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Post, 'id'>), // Spread data, assert type
    }));
    // Note: Firestore Timestamps are automatically handled by the SDK when fetching
    // If not, you might need: createdAt: (doc.data().createdAt as Timestamp).toDate()
    return posts;
  } catch (error) {
    console.error('Error fetching posts from Firestore:', error);
    // Return empty array or throw error based on how you want to handle fetch failures
    return [];
  }
};
