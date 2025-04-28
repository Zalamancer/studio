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
  serverTimestamp, // Use serverTimestamp for consistency
  deleteDoc, // Import deleteDoc
  doc, // Import doc to get a document reference
  where // Import where for filtering
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


// Function to delete a post from Firestore
export const deletePostFromFirestore = async (postId: string): Promise<void> => {
    try {
        const postDocRef = doc(db, 'posts', postId); // Get reference to the specific post document
        await deleteDoc(postDocRef);
        console.log(`Post with ID ${postId} deleted successfully.`);
    } catch (error: any) {
        console.error(`Error deleting post with ID ${postId}:`, error);
        console.error("Firestore Error Code:", error.code);
        console.error("Firestore Error Message:", error.message);
        if (error.code === 'permission-denied') {
            console.error("Firestore permission denied for deleting. Check your security rules.");
            throw new Error('Permission denied. You might need to adjust Firestore security rules to allow deletion.');
        }
        throw new Error(`Failed to delete post: ${error.message}`);
    }
};


// Function to fetch posts created by a specific user
export const getPostsByUserId = async (userId: string): Promise<Post[]> => {
  if (!userId) {
    console.warn("getPostsByUserId called with invalid userId.");
    return [];
  }
  console.log(`Fetching posts for user ${userId}`);

  try {
    const q = query(
      postsCollectionRef,
      where('userId', '==', userId), // Filter by userId
      orderBy('createdAt', 'desc'), // Order by creation date
      limit(20) // Limit results (adjust as needed)
    );

    console.log("Executing Firestore query for user's posts...");
    const querySnapshot = await getDocs(q);
    console.log(`Query snapshot received. Found ${querySnapshot.docs.length} posts for user ${userId}.`);

    const posts = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      const createdAt = data.createdAt instanceof Timestamp ? data.createdAt : Timestamp.now();

      return {
        id: docSnap.id,
        ...(data as Omit<Post, 'id' | 'createdAt'>),
        createdAt: createdAt,
      };
    });

    console.log(`Successfully mapped ${posts.length} posts for user ${userId}`);
    return posts;

  } catch (error: any) {
    console.error(`Error fetching posts for user ${userId}:`, error);
    if (error.code === 'permission-denied') {
      console.error(`Firestore permission denied fetching posts for user ${userId}. Check rules.`);
      throw new Error('Permission denied fetching user posts.');
    }
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
      console.error("Firestore query for user posts requires an index. Create a composite index on 'userId' (==) and 'createdAt' (desc) in the Firebase console for the 'posts' collection.");
      throw new Error("Firestore query requires an index for user posts. Please create it in the Firebase console.");
    }
    throw new Error(`Failed to fetch posts for user ${userId}: ${error.message}`);
  }
};
