// src/types/post.ts
import type { Timestamp } from 'firebase/firestore';

export interface Post {
  id: string; // Firestore uses string IDs for documents
  userId: string; // ID of the user who created the post
  tags: string[];
  question: string;
  requestType: 'post' | 'help_request'; // Now non-optional, will default in form

  // For requestType 'post'
  description?: string | null;

  // For requestType 'help_request'
  descriptionDetails?: string | null; // This will be mandatory if requestType is 'help_request'
  descriptionTried?: string | null;
  descriptionOutcome?: string | null;
  maxBudget?: number | null;       // Optional for help_request
  deadline?: Date | null;          // Optional for help_request, Stored as Date on client

  // Common fields
  sector: string;
  subSector?: string | null;
  industry?: string | null;
  businessType: string; // Consider making this optional or providing defaults
  safetyIndicator: 'High' | 'Medium' | 'Low'; // Consider defaults
  ratingScore: number;
  createdAt: Timestamp;
  naicsCode?: string | null;
  imageUrls?: string[];
  mentionedUserIds?: string[];
}

// Type for data being added
export type NewPostData = Omit<Post, 'id' | 'createdAt' | 'deadline'> & {
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
