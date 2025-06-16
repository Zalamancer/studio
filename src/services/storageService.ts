// src/services/storageService.ts
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase/config'; // Assumes storage is initialized in firebase/config

/**
 * Uploads an image file to Firebase Storage for a specific post.
 * @param file The image file to upload.
 * @param userId The ID of the user uploading the image.
 * @returns Promise<string> The public URL of the uploaded image.
 */
export const uploadPostImage = async (file: File, userId: string): Promise<string> => {
  if (!file) {
    throw new Error("No file provided for upload.");
  }
  if (!userId) {
    throw new Error("User ID is required for uploading image.");
  }

  // Create a unique file name (e.g., posts/userId/timestamp_filename)
  const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`; // Sanitize filename
  const storagePath = `posts/${userId}/${fileName}`;
  const imageRef = ref(storage, storagePath);

  try {
    const snapshot = await uploadBytes(imageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    if (!downloadURL) {
        throw new Error("Failed to get download URL after upload.");
    }
    return downloadURL;
  } catch (error: any) {
    console.error("[StorageService] Error uploading post image to Firebase Storage:", error);
    if (error.code === 'storage/unauthorized') {
      throw new Error('Permission denied. Check Firebase Storage security rules for posts path.');
    } else if (error.code === 'storage/canceled') {
      throw new Error('Upload canceled.');
    } else if (error.code === 'storage/retry-limit-exceeded') {
      throw new Error('Image upload failed: Maximum retry time exceeded. Please check your internet connection or try again with a smaller file.');
    }
    throw new Error(`Image upload failed: ${error.message || 'Unknown storage error'}`);
  }
};

/**
 * Uploads a cover image file to Firebase Storage for a news article.
 * @param file The image file to upload.
 * @param userId The ID of the user (author) uploading the image.
 * @param articleId Tentative article ID, can be used for organization. If creating new, can be placeholder or userId.
 * @returns Promise<string> The public URL of the uploaded image.
 */
export const uploadNewsCoverImage = async (file: File, userId: string, articleIdPlaceholder?: string): Promise<string> => {
  if (!file) {
    throw new Error("No file provided for news cover image upload.");
  }
  if (!userId) {
    throw new Error("User ID is required for uploading news cover image.");
  }

  const uniqueFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`; // Sanitize
  const storagePath = `newsCovers/${userId}/${articleIdPlaceholder || 'new'}/${uniqueFileName}`;
  const imageRef = ref(storage, storagePath);

  try {
    const snapshot = await uploadBytes(imageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    if (!downloadURL) {
        throw new Error("Failed to get download URL for news cover image after upload.");
    }
    return downloadURL;
  } catch (error: any) {
    console.error("[StorageService] Error uploading news cover image to Firebase Storage:", error);
    if (error.code === 'storage/unauthorized') {
      throw new Error('Permission denied. Check Firebase Storage security rules for newsCovers path.');
    }
    throw new Error(`News cover image upload failed: ${error.message || 'Unknown storage error'}`);
  }
};
