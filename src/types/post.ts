// src/types/post.ts
import type { Timestamp } from 'firebase/firestore';

export interface Post {
  id: string; // Firestore uses string IDs for documents
  userId: string; // ID of the user who created the post
  tags: string[];
  question: string;
  requestType: 'post' | 'help_request'; // Now non-optional

  // Primary description field for all post types
  descriptionDetails?: string | null; // Previously only for help_request, now primary
  // Optional detailed fields, applicable more to help_request but can be used by 'post' too
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
  commentCount?: number; // Optional: to keep track of comments
}

// Type for data being added
// The old 'description' field is removed. 'descriptionDetails' is the new primary.
export type NewPostData = Omit<Post, 'id' | 'createdAt' | 'deadline' | 'description'> & {
  createdAt?: Timestamp; // Allow serverTimestamp
  deadline?: Date | Timestamp | null; // Allow Date from client, convert to Timestamp in service, or null
};


// --- Bid System ---
export interface Bid {
  id: string; // Firestore document ID
  postId: string; // ID of the help request post this bid is for
  bidderId: string; // UID of the user making the bid
  bidderName?: string; // Anonymous name for display
  bidderAvatar?: string;
  bidAmount: number;
  bidMessage?: string; // Optional message accompanying the bid
  timestamp: Timestamp; // Firestore Timestamp when bid was placed
}

export type NewBidData = Omit<Bid, 'id' | 'timestamp' | 'bidderName' | 'bidderAvatar'>;

export interface ClientBid extends Omit<Bid, 'timestamp'> {
  timestamp: number; // Milliseconds since epoch
}

// --- Sector, SubSector, Industry Types ---
// These are defined in MainLayout.tsx but re-exporting or centralizing them could be good
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
