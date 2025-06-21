// src/types/collection.ts
import type { Timestamp, FieldValue } from 'firebase/firestore';

// Represents a collection document stored in Firestore
export interface Collection {
  id: string; // Firestore document ID
  name: string;
  description?: string | null;
  ownerId: string; // UID of the user who owns this collection
  postIds?: string[]; // Array of Post IDs
  articleIds?: string[]; // Array of News Article IDs
  sharedWithUserIds: string[]; // Array of UIDs this collection is shared with
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Represents collection data used on the client-side
export interface ClientCollection extends Omit<Collection, 'createdAt' | 'updatedAt'> {
  createdAt: number; // Milliseconds since epoch
  updatedAt: number; // Milliseconds since epoch
  isSharedWithCurrentUser: boolean;
}

// Data for creating a new collection
export interface NewCollectionData {
  ownerId: string;
  name: string;
  description?: string;
  initialPostId?: string; // Optional: A post to add immediately upon creation
  initialArticleId?: string; // Optional: An article to add immediately
}
