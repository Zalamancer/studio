// src/types/tag.ts
import type { Timestamp } from 'firebase/firestore';

export interface Tag {
  id: string; // Firestore document ID (could be tag name in lowercase)
  name: string; // The display name of the tag (e.g., "FinTech")
  nameLowercase: string; // For case-insensitive search and uniqueness (e.g., "fintech")
  usageCount: number;
  createdAt: Timestamp;
  createdBy: string; // UID of the user who first created this tag
}

export interface ClientTag extends Omit<Tag, 'createdAt'> {
  createdAt: number; // Milliseconds since epoch
}
