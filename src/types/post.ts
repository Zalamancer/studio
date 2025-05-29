// src/types/post.ts
import type { Timestamp, FieldValue } from 'firebase/firestore';

export interface Post {
  id: string; // Firestore uses string IDs for documents
  userId: string; // ID of the user who created the post
  tags: string[];
  question: string;
  requestType: 'post' | 'help_request'; // Now non-optional

  // Tabbed description fields for all post types
  descriptionDetails: string | null; // Primary description, mandatory via form schema
  descriptionTried?: string | null;
  descriptionOutcome?: string | null;

  // Fields more specific to 'help_request', optional for 'post'
  maxBudget?: number | null;
  deadline?: Date | null; // Stored as Date on client, Timestamp in Firestore

  // Common fields
  sector: string;
  subSector?: string | null;
  industry?: string | null;
  businessType: string;
  safetyIndicator: 'High' | 'Medium' | 'Low';
  ratingScore: number;
  createdAt: Timestamp;
  naicsCode?: string | null;
  imageUrls?: string[];
  mentionedUserIds?: string[];
  commentCount?: number;
}

// Type for data being added
export type NewPostData = Omit<Post, 'id' | 'createdAt' | 'deadline'> & {
  createdAt?: FieldValue; // Allow serverTimestamp
  deadline?: Date | Timestamp | null; // Allow Date from client, convert to Timestamp in service, or null
};


// --- Bid System ---
// (Bid types remain unchanged from previous definitions)
export interface Bid {
  id: string;
  postId: string;
  bidderId: string;
  bidderName?: string;
  bidderAvatar?: string;
  bidAmount: number;
  bidMessage?: string;
  timestamp: Timestamp;
}

export type NewBidData = Omit<Bid, 'id' | 'timestamp' | 'bidderName' | 'bidderAvatar'>;

export interface ClientBid extends Omit<Bid, 'timestamp'> {
  timestamp: number;
}

// --- Sector, SubSector, Industry Types ---
export interface Industry {
  name: string;
  code: string;
  description?: string;
}

export interface SubSector {
  name: string;
  code: string;
  description?: string;
  industries: Industry[];
}

export interface SectorWithSubSectors {
  name: string;
  code: string;
  description?: string;
  subSectors: SubSector[];
}
