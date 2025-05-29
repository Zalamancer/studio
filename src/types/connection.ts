
// src/types/connection.ts
import type { Timestamp, FieldValue } from 'firebase/firestore'; // Added FieldValue

export type VisibilitySetting = 'everyone' | 'connected' | 'only_me';

// User profile data stored in Firestore 'users' collection
export interface UserProfileData {
    uid: string;
    email?: string | null;
    // companyName remains for the actual company name
    companyName?: string | null;
    // mentionName is the "ColorAnimalNumber" generated name, primary for @mentions
    mentionName: string;
    avatarUrl?: string | null;

    // New NAICS structure
    sectorName?: string | null;
    subSectorName?: string | null;
    industryName?: string | null;
    naicsCode?: string | null; // Stores the most specific NAICS code selected

    description?: string | null;
    descriptionVisibility?: VisibilitySetting;

    tags?: string[]; // User interests or business specialties
    // location?: string | null; // Marked for removal from display
    established?: string | null; // Year
    // contactEmail?: string | null; // Marked for removal from display
    // contactPhone?: string | null; // Marked for removal from display
    verified?: boolean;
    isBotAccount?: boolean;
    incomeRange?: string | null; // Stored but not publicly displayed

    // Timestamps
    createdAt?: Timestamp | FieldValue; // Allow FieldValue for serverTimestamp on create
    lastLoginAt?: Timestamp | FieldValue;
    updatedAt?: Timestamp | FieldValue;
}

// Basic user profile information, often derived, used for displays and suggestions
export interface UserProfileBasic {
    userId: string; // UID
    // displayName is derived: companyName if available, otherwise mentionName
    displayName: string;
    // mentionName is the "ColorAnimalNumber" name, always available for @mentions
    mentionName: string;
    avatarUrl?: string;
    isBotAccount?: boolean;
    companyName?: string; // Still useful to have for context in suggestions if available
}

// For initializing user profile (after sign-up)
export interface InitializeUserProfileArgs {
    uid: string;
    email?: string | null;
    googleDisplayName?: string | null; // Name from Google
    googlePhotoURL?: string | null;    // Photo URL from Google
    companyName?: string | null;   // Company name from email sign-up form
    industry?: string | null;      // Single industry string from email sign-up form (will be mapped to new structure)
}

// For updating user profile details from settings page
// Only includes fields editable by the user in settings
export interface UserProfileUpdateData {
    avatarUrl?: string | null; // Can be null if user removes avatar

    // New NAICS structure to be saved
    sectorName?: string | null;
    subSectorName?: string | null;
    industryName?: string | null;
    naicsCode?: string | null;

    description?: string | null;
    descriptionVisibility?: VisibilitySetting;
    established?: string | null;
    incomeRange?: string | null;
}


// --- Connection / Mutuals related types ---
export type ConnectionStatus = 'connected' | 'pending_sent' | 'pending_received' | 'not_connected' | 'self' | 'blocked' | null;

export interface MutualConnection {
    id: string; // Firestore document ID (e.g., uid1_uid2)
    userIds: string[]; // Array of two user UIDs, sorted alphabetically
    status: 'pending' | 'connected' | 'blocked';
    requesterId: string; // UID of the user who initiated the request
    createdAt: Timestamp; // When the request was initiated or connection was formed
    updatedAt: Timestamp; // When the status last changed
}

// For displaying in "Your Connections" list
export interface Connection {
    connectionId: string;
    otherUserId: string;
    otherUserDisplayName: string;
    otherUserAvatarUrl?: string;
    connectedAt: number; // Milliseconds
    // Include all fields from MutualConnection for consistency if needed
    status: 'pending' | 'connected' | 'blocked';
    requesterId: string;
    userIds: string[];
}

// For displaying in "Pending Requests" list
export interface ConnectionRequest {
    connectionId: string;
    requesterId: string;
    requesterDisplayName: string;
    requesterAvatarUrl?: string;
    requestedAt: number; // Milliseconds
}
