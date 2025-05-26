// src/types/post.ts
import type { Timestamp } from 'firebase/firestore';

export interface Post {
  id: string; // Firestore uses string IDs for documents
  userId: string; // ID of the user who created the post
  tags: string[];
  question: string;
  description?: string; // For 'post' type

  // For 'help_request' type
  descriptionDetails?: string;
  descriptionTried?: string;
  descriptionOutcome?: string;

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
  requestType?: 'post' | 'help_request';
  maxBudget?: number; // Renamed from paymentAmount
  deadline?: Date; // For help_request deadline, stored as Date on client, converted to Timestamp for Firestore
}

// Type for data being added
export type NewPostData = Omit<Post, 'id' | 'createdAt' | 'deadline'> & {
    createdAt?: Timestamp; // Allow serverTimestamp
    deadline?: Date | Timestamp | null; // Allow Date from client, convert to Timestamp in service, or null
    // All other fields are optional for NewPostData if they are optional in Post, or will be set by service
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
  // status: 'pending' | 'accepted' | 'rejected'; // Status of the bid - for future use
}

export type NewBidData = Omit<Bid, 'id' | 'timestamp' | 'bidderName' | 'bidderAvatar'>;

export interface ClientBid extends Omit<Bid, 'timestamp'> {
  timestamp: number; // Milliseconds since epoch
}

// --- Sector, SubSector, Industry Types ---
export interface Industry {
  name: string;
  code: string;
}

export interface SubSector {
  name: string;
  code: string;
  industries: Industry[];
}

export interface SectorWithSubSectors {
  name: string;
  code: string;
  description?: string;
  subSectors: SubSector[];
}
