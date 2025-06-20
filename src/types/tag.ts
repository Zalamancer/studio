
// src/types/tag.ts
import type { Timestamp, FieldValue } from 'firebase/firestore'; // Added FieldValue

export interface Tag {
  id: string; // Firestore document ID (could be tag name in lowercase)
  name: string; // The display name of the tag (e.g., "FinTech")
  nameLowercase: string; // For case-insensitive search and uniqueness (e.g., "fintech")
  usageCount: number;
  createdAt: Timestamp; // This is what's read from Firestore after creation
  createdBy: string; // UID of the user who first created this tag
}

// Type for creating a new tag
export interface NewTagData {
  name: string;
  nameLowercase: string;
  usageCount: number;
  createdAt: FieldValue; // This is what's written to Firestore (serverTimestamp())
  createdBy: string;
}

export interface ClientTag extends Omit<Tag, 'createdAt'> {
  createdAt: number; // Milliseconds since epoch for client-side use
  usageCount: number; // Ensure usageCount is always a number
}

