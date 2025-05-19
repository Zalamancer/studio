
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
  id?: string; // Make ID optional as it's not part of the document data itself
  userIds: string[]; // Array containing the two user IDs, sorted alphabetically
  status: 'pending' | 'connected' | 'blocked'; // Status of the connection
  requesterId: string; // User ID of the person who initiated the request (if status is 'pending')
  requestedAt: Timestamp; // Timestamp when the request was sent (Firestore Timestamp)
  connectedAt?: Timestamp; // Timestamp when the connection was established (Firestore Timestamp, optional)
  // Add other fields as needed, e.g., blockDetails
}

// Represents a pending connection request, often including basic profile info of the requester
// Used for displaying incoming requests to the user. Timestamps are numbers (ms).
export interface ConnectionRequest {
    connectionId: string; // The ID of the MutualConnection document
    requesterId: string;
    requesterDisplayName: string;
    requesterAvatarUrl?: string;
    requestedAt: number; // Milliseconds since epoch
}

// Represents an established connection, often including basic profile info of the other user.
// Used for displaying the user's list of connections. Timestamps are numbers (ms).
export interface Connection {
    connectionId: string; // The ID of the MutualConnection document
    otherUserId: string;
    otherUserDisplayName: string;
    otherUserAvatarUrl?: string;
    connectedAt: number; // Milliseconds since epoch
}

// Basic user profile information used in connection lists/requests
export interface UserProfileBasic {
    userId: string;
    displayName: string;
    avatarUrl?: string;
}

// More detailed user profile data stored in the 'users' collection
export interface UserProfileData {
    uid: string; // Should always match the document ID in 'users' collection
    email?: string;
    displayName?: string;
    companyName?: string;
    industry?: string;
    avatarUrl?: string; // URL to the user's profile picture
    photoURL?: string; // Often from auth provider, can be used for avatar
    createdAt?: Timestamp;
    lastLoginAt?: Timestamp;
    // Add other fields as needed, e.g., location, description, tags
}
