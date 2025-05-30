
// src/types/connection.ts
import type { Timestamp, FieldValue } from 'firebase/firestore';

export type VisibilitySetting = 'everyone' | 'connected' | 'only_me';

// User profile data stored in Firestore 'users' collection
export interface UserProfileData {
    uid: string;
    email?: string | null;
    companyName?: string | null;
    mentionName: string; // Canonical "ColorAnimalNumber" e.g., BlueWhale123
    mentionNameLowercase?: string; // For case-insensitive searching, e.g., bluewhale123
    avatarUrl?: string | null;
    industry?: string | null; // Single industry string for simplicity
    description?: string | null;
    descriptionVisibility?: VisibilitySetting;
    // New NAICS structure
    sectorName?: string | null;
    subSectorName?: string | null;
    industryName?: string | null; // This would be the NAICS industry title
    naicsCode?: string | null; // Stores the most specific NAICS code selected

    tags?: string[];
    established?: string | null; // Year
    verified?: boolean;
    isBotAccount?: boolean;
    incomeRange?: string | null;

    createdAt?: Timestamp | FieldValue;
    lastLoginAt?: Timestamp | FieldValue;
    updatedAt?: Timestamp | FieldValue;
}

// Basic user profile information, often derived, used for displays and suggestions
export interface UserProfileBasic {
    userId: string; // UID
    displayName: string; // Derived: companyName or mentionName
    mentionName: string; // The "ColorAnimalNumber" name, e.g., BlueWhale123
    avatarUrl?: string;
    companyName?: string; // For context in suggestions if available
}

// For initializing user profile (after sign-up)
// googleDisplayName and companyName are used to populate displayName if available
export interface InitializeUserProfileArgs {
    uid: string;
    email?: string | null;
    googleDisplayName?: string | null;
    googlePhotoURL?: string | null;
    companyName?: string | null;
    industry?: string | null; // From sign-up form
}

// For updating user profile details from settings page
export interface UserProfileUpdateData {
    avatarUrl?: string | null;
    industry?: string | null; // Single industry string
    description?: string | null;
    descriptionVisibility?: VisibilitySetting;
    established?: string | null;
    incomeRange?: string | null;

    // New NAICS structure fields
    sectorName?: string | null;
    subSectorName?: string | null;
    industryName?: string | null; // NAICS industry title
    naicsCode?: string | null;
}


// --- Connection / Mutuals related types ---
export type ConnectionStatus = 'connected' | 'pending_sent' | 'pending_received' | 'not_connected' | 'self' | 'blocked' | null;

export interface MutualConnection {
    id: string;
    userIds: string[];
    status: 'pending' | 'connected' | 'blocked';
    requesterId: string;
    createdAt: Timestamp | FieldValue;
    updatedAt: Timestamp | FieldValue;
    connectedAt?: Timestamp | FieldValue; // Added when status becomes 'connected'
    requestedAt?: Timestamp | FieldValue; // Specifically for pending
}

export interface Connection {
    connectionId: string;
    otherUserId: string;
    otherUserDisplayName: string;
    otherUserAvatarUrl?: string;
    connectedAt?: number; // Milliseconds, if applicable
    status: ConnectionStatus; // Include full status
    requesterId: string; // Include for context
    userIds: string[]; // Include for context
}

export interface ConnectionRequest {
    connectionId: string;
    requesterId: string;
    requesterDisplayName: string;
    requesterAvatarUrl?: string;
    requestedAt: number; // Milliseconds
}
