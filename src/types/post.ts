// src/types/post.ts
import type { Timestamp } from 'firebase/firestore';

export interface Post {
  id: string; // Firestore uses string IDs for documents
  userId: string; // ID of the user who created the post
  tags: string[];
  question: string;
  description?: string; // Make description optional
  sector: string; // Main sector name
  subSector?: string; // Optional: Sub-sector name
  industry?: string; // Optional: Industry name
  businessType: string;
  safetyIndicator: 'High' | 'Medium' | 'Low';
  ratingScore: number;
  stockGraphData?: { name: string; uv: number }[];
  createdAt: Timestamp;
  naicsCode?: string; // Stores the most specific NAICS code selected (Industry > Sub-sector > Sector)
}

// Type for data being added
export type NewPostData = Omit<Post, 'id' | 'createdAt'> & {
    createdAt?: Date;
};
