
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
    console.log(`Uploading image to: ${storagePath}`);
    const snapshot = await uploadBytes(imageRef, file);
    console.log('Uploaded a blob or file!', snapshot);

    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log('File available at', downloadURL);
    return downloadURL;
  } catch (error: any) {
    console.error("Error uploading image to Firebase Storage:", error);
    if (error.code === 'storage/unauthorized') {
      throw new Error('Permission denied. Check Firebase Storage security rules.');
    } else if (error.code === 'storage/canceled') {
      throw new Error('Upload canceled.');
    }
    throw new Error(`Image upload failed: ${error.message}`);
  }
};
