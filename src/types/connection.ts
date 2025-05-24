
// src/types/connection.ts
import type { Timestamp } from 'firebase/firestore';

export type VisibilitySetting = 'everyone' | 'connected' | 'only_me';

// User profile data stored in Firestore 'users' collection
export interface UserProfileData {
    uid: string;
    email?: string | null;

    companyName?: string | null;
    // actualDisplayName is removed as per user request to simplify
    mentionName: string; // The "ColorAnimalNumber" name, always generated and stored. Primary for @mentions.

    avatarUrl?: string | null;
    industry?: string | null; // Will always be visible if set
    description?: string | null;
    descriptionVisibility?: VisibilitySetting; // Visibility for description

    tags?: string[];
    location?: string | null;
    established?: string | null; // Will always be visible if set
    contactEmail?: string | null;
    contactPhone?: string | null;
    verified?: boolean;
    isBotAccount?: boolean; // To identify bot accounts
    incomeRange?: string | null;

    // Timestamps
    createdAt?: Timestamp;
    lastLoginAt?: Timestamp;
    updatedAt?: Timestamp;
}

// Basic user profile information, often derived, used for displays and suggestions
export interface UserProfileBasic {
    userId: string; // UID
    displayName: string; // Derived: companyName or mentionName
    mentionName: string; // The "ColorAnimalNumber" name for @mentions
    avatarUrl?: string;
    isBotAccount?: boolean;
    // Removed companyName and actualDisplayName from here to simplify,
    // displayName will hold the best available public name (company or mentionName)
}
