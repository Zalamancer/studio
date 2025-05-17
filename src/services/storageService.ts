
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
  const fileName = `${Date.now()}_${file.name}`;
  const storagePath = `posts/${userId}/${fileName}`;
  const imageRef = ref(storage, storagePath);

  try {
    console.log(`[StorageService] Uploading image to: ${storagePath}`);
    const snapshot = await uploadBytes(imageRef, file);
    console.log('[StorageService] Uploaded a blob or file!', snapshot);

    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log('[StorageService] File available at', downloadURL);
    if (!downloadURL) {
        throw new Error("Failed to get download URL after upload.");
    }
    return downloadURL;
  } catch (error: any) {
    console.error("[StorageService] Error uploading image to Firebase Storage:", error);
    if (error.code === 'storage/unauthorized') {
      throw new Error('Permission denied. Check Firebase Storage security rules.');
    } else if (error.code === 'storage/canceled') {
      throw new Error('Upload canceled.');
    } else if (error.code === 'storage/retry-limit-exceeded') {
      // Provide a more specific message for this common network-related error
      throw new Error('Image upload failed: Maximum retry time exceeded. Please check your internet connection or try again with a smaller file.');
    }
    // Re-throw a more specific error or the original one for other cases
    throw new Error(`Image upload failed: ${error.message || 'Unknown storage error'}`);
  }
};
