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
  serverTimestamp // Use serverTimestamp for consistency
} from 'firebase/firestore';
import type { Post, NewPostData } from '@/types/post';

const postsCollectionRef = collection(db, 'posts');

// Function to add a new post to Firestore
export const addPostToFirestore = async (postData: NewPostData): Promise<string> => {
  try {
    // Use serverTimestamp() for createdAt to ensure server-side consistency
    const docRef = await addDoc(postsCollectionRef, {
        ...postData,
        createdAt: serverTimestamp(), // Let Firestore set the timestamp
    });
    console.log("Post added successfully with ID: ", docRef.id);
    return docRef.id;
  } catch (error: any) {
    console.error('Error adding post to Firestore:', error);
    // Log more details about the error
    console.error("Firestore Error Code:", error.code);
    console.error("Firestore Error Message:", error.message);
    // Consider checking specific error codes (e.g., 'permission-denied')
    if (error.code === 'permission-denied') {
        console.error("Firestore permission denied. Check your security rules.");
        throw new Error('Permission denied. You might need to adjust Firestore security rules.');
    }
    throw new Error(`Failed to add post: ${error.message}`); // Re-throw with more context
  }
};

// Function to fetch posts from Firestore
export const getPostsFromFirestore = async (): Promise<Post[]> => {
  try {
    // Query posts, order by creation date descending, limit to e.g., 50 latest
    const q = query(postsCollectionRef, orderBy('createdAt', 'desc'), limit(50));
    const querySnapshot = await getDocs(q);
    const posts = querySnapshot.docs.map((doc) => {
       const data = doc.data();
       // Ensure createdAt is converted to a Timestamp object if needed, although SDK usually handles it.
       // Firestore Timestamps are retrieved directly. We only need to ensure they exist.
       const createdAt = data.createdAt instanceof Timestamp ? data.createdAt : Timestamp.now(); // Fallback if needed

       return {
            id: doc.id,
            ...(data as Omit<Post, 'id' | 'createdAt'>), // Spread data, assert type
            createdAt: createdAt, // Assign the potentially handled timestamp
       };
    });
    console.log(`Fetched ${posts.length} posts from Firestore.`);
    return posts;
  } catch (error: any) {
    console.error('Error fetching posts from Firestore:', error);
    console.error("Firestore Error Code:", error.code);
    console.error("Firestore Error Message:", error.message);
     if (error.code === 'permission-denied') {
        console.error("Firestore permission denied for reading. Check your security rules.");
    }
    // Return empty array or throw error based on how you want to handle fetch failures
    return [];
  }
};
