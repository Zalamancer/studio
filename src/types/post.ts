// src/types/post.ts
import type { Timestamp } from 'firebase/firestore';

export interface Post {
  id: string; // Firestore uses string IDs for documents
  userId: string; // ID of the user who created the post
  tags: string[];
  question: string;
  description?: string;
  sector: string;
  businessType: string;
  safetyIndicator: 'High' | 'Medium' | 'Low';
  ratingScore: number;
  stockGraphData: { name: string; uv: number }[]; // Keep as is for now, potentially store elsewhere later
  createdAt: Timestamp; // Use Firestore Timestamp for sorting/querying
}

// Type for data being added (before Firestore assigns ID and converts Date to Timestamp)
export type NewPostData = Omit<Post, 'id' | 'createdAt'> & {
    createdAt: Date;
};
