// src/types/connection.ts
import type { Timestamp } from 'firebase/firestore';

export type VisibilitySetting = 'everyone' | 'connected' | 'only_me';

// User profile data stored in Firestore 'users' collection
export interface UserProfileData {
    uid: string;
    email?: string | null;

    companyName?: string | null;    // From email sign-up or profile settings
    actualDisplayName?: string | null; // From Google sign-in or profile settings

    mentionName: string; // The "ColorAnimalNumber" name, always generated and stored. Used for @mentions.

    avatarUrl?: string | null;
    industry?: string | null;
    description?: string | null;
    descriptionVisibility?: VisibilitySetting; // Only this one remains from the granular visibilities

    tags?: string[];
    location?: string | null; // Kept for potential future use but not actively displayed on profile
    established?: string | null;
    contactEmail?: string | null; // Kept for potential future use
    contactPhone?: string | null; // Kept for potential future use
    verified?: boolean;
    isBotAccount?: boolean; // To identify bot accounts

    // Timestamps
    createdAt?: Timestamp;
    lastLoginAt?: Timestamp;
    updatedAt?: Timestamp;

    // Fields removed based on user request to simplify:
    // actualDisplayNameVisibility?: VisibilitySetting;
    // companyNameVisibility?: VisibilitySetting;
    // avatarVisibility?: VisibilitySetting;
    // industryVisibility?: VisibilitySetting; // Industry is now always visible if set
    incomeRange?: string | null; // This was added, keeping it for now
}

// Basic user profile information, often derived, used for displays and suggestions
export interface UserProfileBasic {
    userId: string; // UID
    displayName: string; // Derived: actualDisplayName or companyName or mentionName
    mentionName: string; // The "ColorAnimalNumber" name for @mentions
    avatarUrl?: string;
    actualDisplayName?: string; // To help in suggestion UI if different from companyName
    companyName?: string; // To help in suggestion UI
    isBotAccount?: boolean;
}
