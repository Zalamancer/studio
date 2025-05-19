
// src/types/connection.ts
import type { Timestamp } from 'firebase/firestore';

// Status of a connection between two users
export type ConnectionStatus =
    | 'not_connected'       // No connection or request exists
    | 'pending_sent'        // Current user sent a request, waiting for response
    | 'pending_received'    // Current user received a request, waiting for action
    | 'connected'           // Users are mutually connected
    | 'blocked'             // One user has blocked the other (optional)
    | 'self';               // Represents the user's own profile

// Represents the document stored in the 'mutuals' collection in Firestore
export interface MutualConnection {
  id?: string; 
  userIds: string[]; 
  status: 'pending' | 'connected' | 'blocked'; 
  requesterId: string; 
  requestedAt: Timestamp; 
  connectedAt?: Timestamp; 
}

// Represents a pending connection request, often including basic profile info of the requester
// Used for displaying incoming requests to the user. Timestamps are numbers (ms).
export interface ConnectionRequest {
    connectionId: string; 
    requesterId: string;
    requesterDisplayName: string;
    requesterAvatarUrl?: string;
    requestedAt: number; 
}

// Represents an established connection, often including basic profile info of the other user.
// Used for displaying the user's list of connections. Timestamps are numbers (ms).
export interface Connection {
    connectionId: string; 
    otherUserId: string;
    otherUserDisplayName: string;
    otherUserAvatarUrl?: string;
    connectedAt: number; 
}

// Basic user profile information used in connection lists/requests
export interface UserProfileBasic {
    userId: string;
    displayName: string; // Can be actual name, company name, or generated pseudonym
    avatarUrl?: string;
}

// More detailed user profile data stored in the 'users' collection
// This is the data structure for documents in the 'users' collection.
export interface UserProfileData {
    uid: string;             // Should always match the document ID in 'users' collection
    email?: string;          // User's email
    displayName?: string;    // User's preferred display name (could be their actual name, or the generated one)
    companyName?: string;    // Optional company name from sign-up form
    industry?: string;       // Optional industry from sign-up form
    avatarUrl?: string;      // URL to the user's profile picture (could be user-uploaded or from photoURL)
    photoURL?: string;       // Often from auth provider (e.g., Google), used as a source for avatarUrl
    createdAt?: Timestamp;   // Firestore Timestamp of profile creation
    lastLoginAt?: Timestamp; // Firestore Timestamp of last login
    // Add other fields as needed, e.g., location, description, tags, customPseudonym
}
