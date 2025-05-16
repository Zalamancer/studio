// src/types/post.ts
import type { Timestamp } from 'firebase/firestore';

export interface Post {
  id: string; // Firestore uses string IDs for documents
  userId: string; // ID of the user who created the post
  tags: string[];
  question: string;
  description?: string; // Make description optional
  sector: string; // Main sector
  subSector?: string; // Optional: NAICS sub-sector code or title
  businessType: string;
  safetyIndicator: 'High' | 'Medium' | 'Low';
  ratingScore: number;
  stockGraphData?: { name: string; uv: number }[];
  createdAt: Timestamp;
  naicsCode?: string; // Can store the most specific NAICS code (industry or sub-sector)
}

// Type for data being added
export type NewPostData = Omit<Post, 'id' | 'createdAt'> & {
    createdAt?: Date;
};
