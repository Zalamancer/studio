// src/types/connection.ts
import type { Timestamp } from 'firebase/firestore';

export type VisibilitySetting = 'everyone' | 'connected' | 'only_me';

// User profile data stored in Firestore 'users' collection
export interface UserProfileData {
    uid: string;
    email?: string | null;
    companyName?: string | null; // Company name from sign-up or profile settings
    mentionName: string; // The "ColorAnimalNumber" generated name, primary for @mentions

    avatarUrl?: string | null;
    // avatarVisibility?: VisibilitySetting; // Removed as per new request

    industry?: string | null;
    // industryVisibility?: VisibilitySetting; // Removed, industry is always visible if set

    description?: string | null;
    descriptionVisibility?: VisibilitySetting; // Visibility for description

    tags?: string[];
    location?: string | null; // To be removed from display, but kept in type for now if data exists
    established?: string | null;
    contactEmail?: string | null; // To be removed from display
    contactPhone?: string | null; // To be removed from display
    verified?: boolean;
    isBotAccount?: boolean;
    incomeRange?: string | null;

    // Timestamps
    createdAt?: Timestamp;
    lastLoginAt?: Timestamp;
    updatedAt?: Timestamp;
}

// Basic user profile information, often derived, used for displays and suggestions
export interface UserProfileBasic {
    userId: string; // UID
    // displayName will be derived: companyName if available, otherwise mentionName
    displayName: string;
    mentionName: string; // The "ColorAnimalNumber" name, always available
    avatarUrl?: string;
    isBotAccount?: boolean;
    companyName?: string; // Keep for explicit access if needed, e.g. in suggestion UI
}
