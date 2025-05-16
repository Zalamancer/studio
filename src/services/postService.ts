
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
  serverTimestamp,
  deleteDoc,
  doc,
  where
} from 'firebase/firestore';
import type { Post, NewPostData } from '@/types/post';

const postsCollectionRef = collection(db, 'posts');

export const addPostToFirestore = async (postData: NewPostData): Promise<string> => {
  try {
    const dataForFirestore: { [key: string]: any } = {};
    // Iterate over postData and copy defined values
    for (const key in postData) {
        if (Object.prototype.hasOwnProperty.call(postData, key)) {
            const value = postData[key as keyof NewPostData];
            if (value !== undefined) {
                dataForFirestore[key] = value;
            }
        }
    }

    // Specifically ensure imageUrls is an array, even if empty.
    if (dataForFirestore.imageUrls === undefined) {
        dataForFirestore.imageUrls = [];
    } else if (!Array.isArray(dataForFirestore.imageUrls)) {
        if (typeof dataForFirestore.imageUrls === 'string') {
            dataForFirestore.imageUrls = [dataForFirestore.imageUrls];
        } else {
            console.warn(`Invalid imageUrls type found in postData for Firestore: ${typeof dataForFirestore.imageUrls}. Defaulting to empty array.`);
            dataForFirestore.imageUrls = [];
        }
    }

    dataForFirestore.createdAt = serverTimestamp();

    const docRef = await addDoc(postsCollectionRef, dataForFirestore);
    console.log("Post added successfully with ID: ", docRef.id);
    return docRef.id;
  } catch (error: any) {
    console.error('Error adding post to Firestore:', error);
    console.error("Firestore Error Code:", error.code);
    console.error("Firestore Error Message:", error.message);
    if (error.code === 'permission-denied') {
        console.error("Firestore permission denied. Check your security rules.");
        throw new Error('Permission denied. You might need to adjust Firestore security rules.');
    }
    if (error.message.includes("Unsupported field value: undefined")) {
        console.error("Attempted to write undefined field to Firestore. Payload:", postData);
         throw new Error(`Failed to add post: Firestore received an undefined field value. ${error.message}`);
    }
    throw new Error(`Failed to add post: ${error.message}`);
  }
};

export const getPostsFromFirestore = async (): Promise<Post[]> => {
  try {
    const q = query(postsCollectionRef, orderBy('createdAt', 'desc'), limit(50));
    const querySnapshot = await getDocs(q);
    const posts = querySnapshot.docs.map((docSnap) => { // Changed doc to docSnap to avoid conflict
       const data = docSnap.data();
       const createdAt = data.createdAt instanceof Timestamp ? data.createdAt : Timestamp.now();

       return {
            id: docSnap.id, // Use docSnap here
            ...(data as Omit<Post, 'id' | 'createdAt' | 'imageUrls'>),
            imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : [],
            createdAt: createdAt,
       } as Post;
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
    return [];
  }
};

export const deletePostFromFirestore = async (postId: string): Promise<void> => {
    try {
        const postDocRef = doc(db, 'posts', postId);
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

export const getPostsByUserId = async (userId: string): Promise<Post[]> => {
  if (!userId) {
    console.warn("getPostsByUserId called with invalid userId.");
    return [];
  }
  console.log(`Fetching posts for user ${userId}`);

  try {
    const q = query(
      postsCollectionRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    console.log("Executing Firestore query for user's posts...");
    const querySnapshot = await getDocs(q);
    console.log(`Query snapshot received. Found ${querySnapshot.docs.length} posts for user ${userId}.`);

    const posts = querySnapshot.docs.map((docSnap) => { // Changed doc to docSnap
      const data = docSnap.data();
      const createdAt = data.createdAt instanceof Timestamp ? data.createdAt : Timestamp.now();

      return {
        id: docSnap.id, // Use docSnap here
        ...(data as Omit<Post, 'id' | 'createdAt' | 'imageUrls'>),
        imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : [],
        createdAt: createdAt,
      } as Post;
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
