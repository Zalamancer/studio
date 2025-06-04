
// src/types/post.ts
import type { Timestamp, FieldValue } from 'firebase/firestore';

export interface Post {
  id: string;
  userId: string;
  tags: string[];
  question: string;
  requestType: 'post' | 'help_request'; // Now mandatory

  descriptionDetails: string;
  descriptionTried?: string | null;
  descriptionOutcome?: string | null;

  maxBudget?: number | null;
  deadline?: Date | null;

  sector: string;
  subSector?: string | null;
  industry?: string | null;
  ratingScore: number;
  createdAt: Timestamp;
  naicsCode?: string | null;
  imageUrls?: string[];
  mentionedUserIds?: string[];
  commentCount?: number;
  // miroBoardEmbedUrl?: string | undefined; // Removed
}

export type NewPostData = Omit<Post, 'id' | 'createdAt' | 'deadline'> & {
  createdAt?: FieldValue;
  deadline?: Date | Timestamp | null;
  // miroBoardEmbedUrl?: string | undefined; // Removed
};

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
