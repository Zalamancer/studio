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
  where,
  type FieldValue, // Keep FieldValue for NewPostData
} from 'firebase/firestore';
import type { Post, NewPostData } from '@/types/post';

const postsCollectionRef = collection(db, 'posts');

export const addPostToFirestore = async (postData: NewPostData): Promise<string> => {
  try {
    // All posts will now have descriptionDetails, descriptionTried, and descriptionOutcome
    // The old single 'description' field is no longer used from the form.
    const dataForFirestore: { [key: string]: any } = {
      userId: postData.userId,
      question: postData.question,
      tags: postData.tags || [],
      sector: postData.sector,
      subSector: postData.subSector || null,
      industry: postData.industry || null,
      naicsCode: postData.naicsCode || null,
      businessType: postData.businessType || "Startup",
      safetyIndicator: postData.safetyIndicator || "Medium",
      ratingScore: postData.ratingScore || 0,
      imageUrls: Array.isArray(postData.imageUrls) ? postData.imageUrls : [],
      mentionedUserIds: Array.isArray(postData.mentionedUserIds) ? postData.mentionedUserIds : [],
      requestType: postData.requestType,
      createdAt: serverTimestamp(),
      commentCount: 0,

      descriptionDetails: postData.descriptionDetails || "", // Ensure it's at least an empty string
      descriptionTried: postData.descriptionTried || null,
      descriptionOutcome: postData.descriptionOutcome || null,

      // Fields specific to 'help_request'
      maxBudget: postData.requestType === 'help_request' ? (postData.maxBudget === undefined ? null : postData.maxBudget) : null,
      deadline: postData.requestType === 'help_request'
        ? (postData.deadline instanceof Date ? Timestamp.fromDate(postData.deadline) : (postData.deadline || null))
        : null,
    };

    // Clean undefined before sending to Firestore (though above logic should handle most)
    Object.keys(dataForFirestore).forEach(key => {
      if (dataForFirestore[key] === undefined) {
        dataForFirestore[key] = null;
      }
    });

    console.log("[postService] addPostToFirestore: Data being sent to Firestore:", JSON.stringify(dataForFirestore, null, 2));

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
        console.error("Attempted to write undefined field to Firestore. Payload (dataForFirestore):", dataForFirestore, "Original postData:", postData);
         throw new Error(`Failed to add post: Firestore received an undefined field value. ${error.message}`);
    }
    throw new Error(`Failed to add post: ${error.message || 'Unknown Firestore error'}`);
  }
};

export const getPostsFromFirestore = async (): Promise<Post[]> => {
  console.log("[postService] getPostsFromFirestore: Fetching posts...");
  try {
    const q = query(postsCollectionRef, orderBy('createdAt', 'desc'), limit(50));
    const querySnapshot = await getDocs(q);
    const posts = querySnapshot.docs.map((docSnap) => {
       const data = docSnap.data();
       const createdAt = data.createdAt instanceof Timestamp ? data.createdAt : Timestamp.now();

       return {
            id: docSnap.id,
            userId: data.userId,
            tags: data.tags || [],
            question: data.question || "",
            requestType: data.requestType || 'post',
            
            descriptionDetails: data.descriptionDetails || "", // Expect this for all
            descriptionTried: data.descriptionTried || null,
            descriptionOutcome: data.descriptionOutcome || null,
            
            maxBudget: data.maxBudget === undefined ? null : data.maxBudget,
            deadline: data.deadline instanceof Timestamp ? data.deadline.toDate() : undefined,
            sector: data.sector || "",
            subSector: data.subSector || null,
            industry: data.industry || null,
            businessType: data.businessType || "",
            safetyIndicator: data.safetyIndicator || "Medium",
            ratingScore: data.ratingScore || 0,
            createdAt: createdAt,
            naicsCode: data.naicsCode || null,
            imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : [],
            mentionedUserIds: Array.isArray(data.mentionedUserIds) ? data.mentionedUserIds : [],
            commentCount: data.commentCount || 0,
       } as Post;
    });
    console.log(`[postService] Fetched ${posts.length} posts from Firestore.`);
    return posts;
  } catch (error: any) {
    if (error.code === 'permission-denied') {
        console.warn(`[postService] getPostsFromFirestore: Permission denied. Returning empty. Rules: allow read: if true;`, error.message);
        return [];
    }
    console.error('[postService] Error fetching posts from Firestore:', error);
    console.error("Firestore Error Code:", error.code);
    console.error("Firestore Error Message:", error.message);
    // Return empty array or throw error based on how you want to handle fetch failures
    return [];
    // throw error; // Or re-throw if you want the component to handle it
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

    const querySnapshot = await getDocs(q);
    const posts = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      const createdAt = data.createdAt instanceof Timestamp ? data.createdAt : Timestamp.now();

      return {
        id: docSnap.id,
        userId: data.userId,
        tags: data.tags || [],
        question: data.question || "",
        requestType: data.requestType || 'post',

        descriptionDetails: data.descriptionDetails || "",
        descriptionTried: data.descriptionTried || null,
        descriptionOutcome: data.descriptionOutcome || null,

        maxBudget: data.maxBudget === undefined ? null : data.maxBudget,
        deadline: data.deadline instanceof Timestamp ? data.deadline.toDate() : undefined,
        sector: data.sector || "",
        subSector: data.subSector || null,
        industry: data.industry || null,
        businessType: data.businessType || "",
        safetyIndicator: data.safetyIndicator || "Medium",
        ratingScore: data.ratingScore || 0,
        createdAt: createdAt,
        naicsCode: data.naicsCode || null,
        imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : [],
        mentionedUserIds: Array.isArray(data.mentionedUserIds) ? data.mentionedUserIds : [],
        commentCount: data.commentCount || 0,
      } as Post;
    });
    console.log(`[postService] Successfully mapped ${posts.length} posts for user ${userId}`);
    return posts;

  } catch (error: any) {
    if (error.code === 'permission-denied') {
      console.warn(`[postService] getPostsByUserId: Permission denied for user ${userId}. Returning empty.`, error.message);
      return [];
    }
    console.error(`[postService] Error fetching posts for user ${userId}:`, error);
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
      console.error("[postService] Firestore query for user posts requires an index. Create a composite index on 'userId' (==) and 'createdAt' (desc) in the Firebase console for the 'posts' collection.");
      throw new Error("Firestore query requires an index for user posts. Please create it in the Firebase console.");
    }
    throw new Error(`Failed to fetch posts for user ${userId}: ${error.message}`);
  }
};
