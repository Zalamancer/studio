// src/types/post.ts
import type { Timestamp } from 'firebase/firestore';

export interface Post {
  id: string; // Firestore uses string IDs for documents
  userId: string; // ID of the user who created the post
  tags: string[];
  question: string;
  description?: string;
  sector: string; 
  subSector?: string; 
  industry?: string; 
  businessType: string;
  safetyIndicator: 'High' | 'Medium' | 'Low';
  ratingScore: number;
  createdAt: Timestamp;
  naicsCode?: string; 
  imageUrls?: string[];
  mentionedUserIds?: string[];
  requestType?: 'post' | 'help_request'; // New field
  // paymentAmount?: number; // Removed
  // deadline?: Date; // Changed from Timestamp to Date for client-side form, service will convert
}

// Type for data being added
export type NewPostData = Omit<Post, 'id' | 'createdAt' | 'deadline'> & {
    createdAt?: Date; 
    requestType?: 'post' | 'help_request'; // New field
    // paymentAmount?: number; // Removed
    // deadline?: Date | Timestamp; // Removed
};
