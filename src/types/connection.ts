// src/types/connection.ts
import type { Timestamp } from 'firebase/firestore';

export type VisibilitySetting = 'everyone' | 'connected' | 'only_me'; // This type might become unused or simplified.

// Basic user profile information used in connection lists/requests AND for @mention suggestions
export interface UserProfileBasic {
    userId: string;
    displayName: string;        // Derived: companyName or mentionName
    mentionName: string;        // The "ColorAnimalNumber" name, always used for @mention text and filtering/linking
    avatarUrl?: string;
}

// More detailed user profile data stored in the 'users' collection
export interface UserProfileData {
    uid: string;
    email?: string | null;
    companyName?: string | null;               // Company name from sign-up form, always visible if present
    mentionName: string;                // The "ColorAnimalNumber" name, canonical for @mentions. Generated on creation.
    industry?: string | null;                  // Always visible if present
    avatarUrl?: string | null;                 // Always visible if present
    description?: string | null;               // Visibility controlled by `descriptionVisibility`
    descriptionVisibility?: VisibilitySetting; // Visibility for description
    tags?: string[];
    location?: string | null;
    established?: string | null;
    contactEmail?: string | null;              // Visibility could be controlled by a specific setting if needed later
    contactEmailVisibility?: VisibilitySetting;
    contactPhone?: string | null;              // Visibility could be controlled by a specific setting if needed later
    contactPhoneVisibility?: VisibilitySetting;
    verified?: boolean;
    createdAt?: Timestamp;
    lastLoginAt?: Timestamp;
    updatedAt?: Timestamp;

    // Removed fields:
    // actualDisplayName?: string | null;
    // actualDisplayNameVisibility?: VisibilitySetting;
    // companyNameVisibility?: VisibilitySetting;
    // industryVisibility?: VisibilitySetting;
    // avatarVisibility?: VisibilitySetting;
    // photoURL?: string | null; // Firebase Auth photoURL, avatarUrl is preferred from storage
}
