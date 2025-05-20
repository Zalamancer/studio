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

    // Ensure imageUrls and mentionedUserIds are arrays, even if empty.
    dataForFirestore.imageUrls = Array.isArray(dataForFirestore.imageUrls) ? dataForFirestore.imageUrls : [];
    dataForFirestore.mentionedUserIds = Array.isArray(dataForFirestore.mentionedUserIds) ? dataForFirestore.mentionedUserIds : [];
    
    // Set requestType, defaulting to 'post' if not provided
    dataForFirestore.requestType = postData.requestType || 'post';

    // Remove paymentAmount and deadline as they are no longer part of NewPostData
    // delete dataForFirestore.paymentAmount; 
    // delete dataForFirestore.deadline; 

    dataForFirestore.createdAt = serverTimestamp();
    console.log("[postService] Data being sent to Firestore:", dataForFirestore);

    const docRef = await addDoc(postsCollectionRef, dataForFirestore);
    console.log("[postService] Post added successfully with ID: ", docRef.id);
    return docRef.id;
  } catch (error: any) {
    console.error('[postService] Error adding post to Firestore:', error);
    console.error("Firestore Error Code:", error.code);
    console.error("Firestore Error Message:", error.message);
    if (error.code === 'permission-denied') {
        console.error("Firestore permission denied. Check your security rules.");
        throw new Error('Permission denied. You might need to adjust Firestore security rules.');
    }
    if (error.message && error.message.includes("Unsupported field value: undefined")) {
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
    const posts = querySnapshot.docs.map((docSnap) => {
       const data = docSnap.data();
       const createdAt = data.createdAt instanceof Timestamp ? data.createdAt : Timestamp.now();

       return {
            id: docSnap.id,
            ...(data as Omit<Post, 'id' | 'createdAt' | 'imageUrls' | 'mentionedUserIds' | 'deadline'>),
            imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : [],
            mentionedUserIds: Array.isArray(data.mentionedUserIds) ? data.mentionedUserIds : [],
            requestType: data.requestType || 'post', // Default to 'post' if not present
            // deadline: data.deadline instanceof Timestamp ? data.deadline.toDate() : undefined, // Removed
            createdAt: createdAt,
       } as Post;
    });
    console.log(`[postService] Fetched ${posts.length} posts from Firestore.`);
    return posts;
  } catch (error: any) {
    console.error('[postService] Error fetching posts from Firestore:', error);
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
    console.warn("[postService] getPostsByUserId called with invalid userId.");
    return [];
  }
  console.log(`[postService] Fetching posts for user ${userId}`);

  try {
    const q = query(
      postsCollectionRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    console.log("[postService] Executing Firestore query for user's posts...");
    const querySnapshot = await getDocs(q);
    console.log(`[postService] Query snapshot received. Found ${querySnapshot.docs.length} posts for user ${userId}.`);

    const posts = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      const createdAt = data.createdAt instanceof Timestamp ? data.createdAt : Timestamp.now();

      return {
        id: docSnap.id,
        ...(data as Omit<Post, 'id' | 'createdAt' | 'imageUrls' | 'mentionedUserIds' | 'deadline'>),
        imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : [],
        mentionedUserIds: Array.isArray(data.mentionedUserIds) ? data.mentionedUserIds : [],
        requestType: data.requestType || 'post', // Default to 'post' if not present
        // deadline: data.deadline instanceof Timestamp ? data.deadline.toDate() : undefined, // Removed
        createdAt: createdAt,
      } as Post;
    });

    console.log(`[postService] Successfully mapped ${posts.length} posts for user ${userId}`);
    return posts;

  } catch (error: any) {
    console.error(`[postService] Error fetching posts for user ${userId}:`, error);
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
