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
    // Ensure all optional fields that might be undefined are set to null for Firestore
    const dataForFirestore: { [key: string]: any } = {
      question: postData.question,
      tags: postData.tags || [],
      sector: postData.sector,
      subSector: postData.subSector || null,
      industry: postData.industry || null,
      userId: postData.userId,
      businessType: postData.businessType || "Startup",
      safetyIndicator: postData.safetyIndicator || "Medium",
      ratingScore: postData.ratingScore || 0,
      naicsCode: postData.naicsCode || null,
      imageUrls: Array.isArray(postData.imageUrls) ? postData.imageUrls : [],
      mentionedUserIds: Array.isArray(postData.mentionedUserIds) ? postData.mentionedUserIds : [],
      requestType: postData.requestType || 'post',
      maxBudget: postData.maxBudget === undefined ? null : postData.maxBudget,
      deadline: postData.deadline instanceof Date 
        ? Timestamp.fromDate(postData.deadline) 
        : (postData.deadline === null ? null : (postData.deadline || null)), // Handle null explicitly or if undefined
      createdAt: serverTimestamp(),
    };

    // Specific handling for description fields based on requestType
    if (postData.requestType === 'help_request') {
      dataForFirestore.descriptionDetails = postData.descriptionDetails || ""; // Mandatory for help_request
      dataForFirestore.descriptionTried = postData.descriptionTried || null;
      dataForFirestore.descriptionOutcome = postData.descriptionOutcome || null;
      dataForFirestore.description = null; // Ensure general description is null for help requests
    } else { // 'post' or default
      dataForFirestore.description = postData.description || null;
      dataForFirestore.descriptionDetails = null;
      dataForFirestore.descriptionTried = null;
      dataForFirestore.descriptionOutcome = null;
    }
    
    // Ensure no undefined values are sent (Firestore doesn't allow them)
    Object.keys(dataForFirestore).forEach(key => {
      if (dataForFirestore[key] === undefined) {
        dataForFirestore[key] = null;
      }
    });

    console.log("[postService] Data being sent to Firestore:", JSON.stringify(dataForFirestore, null, 2));

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
            userId: data.userId,
            tags: data.tags || [],
            question: data.question || "",
            description: data.description, // Will be undefined if not present
            descriptionDetails: data.descriptionDetails, // Will be undefined if not present
            descriptionTried: data.descriptionTried, // Will be undefined if not present
            descriptionOutcome: data.descriptionOutcome, // Will be undefined if not present
            sector: data.sector || "",
            subSector: data.subSector,
            industry: data.industry,
            businessType: data.businessType || "",
            safetyIndicator: data.safetyIndicator || "Medium",
            ratingScore: data.ratingScore || 0,
            createdAt: createdAt,
            naicsCode: data.naicsCode,
            imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : [],
            mentionedUserIds: Array.isArray(data.mentionedUserIds) ? data.mentionedUserIds : [],
            requestType: data.requestType || 'post',
            maxBudget: data.maxBudget,
            deadline: data.deadline instanceof Timestamp ? data.deadline.toDate() : undefined,
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
        userId: data.userId,
        tags: data.tags || [],
        question: data.question || "",
        description: data.description,
        descriptionDetails: data.descriptionDetails,
        descriptionTried: data.descriptionTried,
        descriptionOutcome: data.descriptionOutcome,
        sector: data.sector || "",
        subSector: data.subSector,
        industry: data.industry,
        businessType: data.businessType || "",
        safetyIndicator: data.safetyIndicator || "Medium",
        ratingScore: data.ratingScore || 0,
        createdAt: createdAt,
        naicsCode: data.naicsCode,
        imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : [],
        mentionedUserIds: Array.isArray(data.mentionedUserIds) ? data.mentionedUserIds : [],
        requestType: data.requestType || 'post',
        maxBudget: data.maxBudget,
        deadline: data.deadline instanceof Timestamp ? data.deadline.toDate() : undefined,
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
