// src/types/connection.ts
import type { Timestamp } from 'firebase/firestore';

export type VisibilitySetting = 'everyone' | 'connected' | 'only_me';

// User profile data stored in Firestore 'users' collection
export interface UserProfileData {
    uid: string;
    email?: string | null; // From Firebase Auth, usually synced
    
    // Fields for user-provided "real" identity, if they choose to share
    actualDisplayName?: string | null; 
    companyName?: string | null; 
    
    // The "ColorAnimalNumber" name, always generated and used for @mentions
    mentionName: string; 

    avatarUrl?: string | null; // User's chosen profile picture URL

    industry?: string | null; // User-set industry
    description?: string | null; // User-set profile description
    descriptionVisibility?: VisibilitySetting; // Visibility for description

    // New field for establishment year
    established?: string | null; // Store as string (e.g., "2005")

    tags?: string[]; // Optional: user-defined tags or skills
    
    // Fields that were previously requested to be removed from public display unless connected/own profile
    location?: string | null; // Keeping in type for now, but UI will hide it
    contactEmail?: string | null; // Separate from auth email, for public contact if desired
    contactPhone?: string | null;

    verified?: boolean; // Verification status
    
    // Timestamps
    createdAt?: Timestamp;
    lastLoginAt?: Timestamp;
    updatedAt?: Timestamp;

    // Fields removed based on previous requests from settings UI
    // actualDisplayNameVisibility?: VisibilitySetting;
    // companyNameVisibility?: VisibilitySetting;
    // avatarVisibility?: VisibilitySetting;
    // industryVisibility?: VisibilitySetting; // Industry is always visible if set
    incomeRange?: string | null;
}

// Basic user profile information, often derived, used for displays and suggestions
export interface UserProfileBasic {
    userId: string; // UID
    displayName: string; // Derived: actualDisplayName or companyName or mentionName
    mentionName: string; // The "ColorAnimalNumber" name for @mentions
    avatarUrl?: string;
    actualDisplayName?: string; // To help in suggestion UI
    companyName?: string; // To help in suggestion UI
}
