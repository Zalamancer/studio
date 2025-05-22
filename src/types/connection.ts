// src/types/connection.ts
import type { Timestamp } from 'firebase/firestore';

export type VisibilitySetting = 'everyone' | 'connected' | 'only_me';

// User profile data stored in Firestore 'users' collection
export interface UserProfileData {
    uid: string;
    email?: string | null;
    // actualDisplayName?: string | null; // Removed in favor of more specific fields + mentionName
    // actualDisplayNameVisibility?: VisibilitySetting; // Removed

    companyName?: string | null; // Always visible if set, used as primary display name if actualDisplayName not set
    // companyNameVisibility?: VisibilitySetting; // Removed

    mentionName: string; // The "ColorAnimalNumber" name, e.g., BlueWhale123 - used for @mentions

    industry?: string | null; // Always visible if set
    // industryVisibility?: VisibilitySetting; // Removed

    avatarUrl?: string | null; // Always visible if set
    // avatarVisibility?: VisibilitySetting; // Removed

    description?: string | null;
    descriptionVisibility?: VisibilitySetting; // Visibility for description

    incomeRange?: string | null; // New field for income range

    tags?: string[];
    location?: string | null;
    established?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    verified?: boolean;
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
    // companyName?: string; // Redundant if displayName logic covers it
    // actualDisplayName?: string; // Redundant
}
