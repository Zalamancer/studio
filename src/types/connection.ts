// src/types/connection.ts
import type { Timestamp } from 'firebase/firestore';

export type VisibilitySetting = 'everyone' | 'connected' | 'only_me';

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

// Basic user profile information used in connection lists/requests AND for @mention suggestions
export interface UserProfileBasic {
    userId: string;
    displayName: string;        // Derived: actualDisplayName or companyName or mentionName (for general display)
    mentionName: string;        // The "ColorAnimalNumber" name, always used for @mention text and filtering/linking
    actualDisplayName?: string; // User's chosen "real" or public name (e.g., from Google)
    companyName?: string;       // Company name (e.g., from email sign-up form)
    avatarUrl?: string;
}

// More detailed user profile data stored in the 'users' collection
export interface UserProfileData {
    uid: string;
    email?: string;
    actualDisplayName?: string | null;         // User's preferred display name (e.g., real name from Google)
    companyName?: string | null;               // Company name from sign-up form
    mentionName: string;                // The "ColorAnimalNumber" name, canonical for @mentions. Generated on creation.
    // Removed: displayName - will be derived on client
    // Removed: generatedAnonymousName - replaced by mentionName
    industry?: string | null;
    avatarUrl?: string | null;
    photoURL?: string | null;           // From Firebase Auth, can be synced to avatarUrl
    description?: string | null;
    tags?: string[];
    location?: string | null;
    established?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    verified?: boolean;
    actualDisplayNameVisibility?: VisibilitySetting;
    companyNameVisibility?: VisibilitySetting;
    industryVisibility?: VisibilitySetting;
    descriptionVisibility?: VisibilitySetting;
    avatarVisibility?: VisibilitySetting;
    createdAt?: Timestamp;
    lastLoginAt?: Timestamp;
    updatedAt?: Timestamp;
}
