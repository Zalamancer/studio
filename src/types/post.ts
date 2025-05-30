// src/types/post.ts
import type { Timestamp, FieldValue } from 'firebase/firestore';

export interface Post {
  id: string;
  userId: string;
  tags: string[];
  question: string;
  requestType: 'post' | 'help_request'; // Now mandatory

  // Unified description fields, 'descriptionDetails' is the primary one
  descriptionDetails: string;
  descriptionTried?: string | null;
  descriptionOutcome?: string | null;

  // Fields specific to 'help_request'
  maxBudget?: number | null;
  deadline?: Date | null; // Stored as Date on client, Timestamp in Firestore

  // Common fields
  sector: string;
  subSector?: string | null;
  industry?: string | null;
  // businessType: string; // REMOVED
  // safetyIndicator: 'High' | 'Medium' | 'Low'; // REMOVED
  ratingScore: number; // Average rating of the business that created the post, at time of posting
  createdAt: Timestamp;
  naicsCode?: string | null;
  imageUrls?: string[];
  mentionedUserIds?: string[];
  commentCount?: number;
}

// Type for data being added
export type NewPostData = Omit<Post, 'id' | 'createdAt' | 'deadline'> & {
  createdAt?: FieldValue;
  deadline?: Date | Timestamp | null;
};


// --- Bid System ---
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
// These types are also defined in MainLayout.tsx for the sector data source.
// Consider a shared types file if used more broadly.
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
