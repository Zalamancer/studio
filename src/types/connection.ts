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

// Basic user profile information used in connection lists/requests
export interface UserProfileBasic {
    userId: string;
    displayName: string; 
    avatarUrl?: string;
}

// More detailed user profile data stored in the 'users' collection
export interface UserProfileData {
    uid: string;             
    email?: string;          
    displayName?: string;    
    companyName?: string;    
    industry?: string;       
    avatarUrl?: string | null;      
    photoURL?: string | null;       
    description?: string;
    tags?: string[];
    location?: string;
    established?: string; // Or Date
    contactEmail?: string;
    contactPhone?: string;
    verified?: boolean;
    companyNameVisibility?: VisibilitySetting;
    industryVisibility?: VisibilitySetting;
    descriptionVisibility?: VisibilitySetting;
    avatarVisibility?: VisibilitySetting; // Added for avatar too
    // Add other visibility fields as needed, e.g., contactEmailVisibility
    createdAt?: Timestamp;   
    lastLoginAt?: Timestamp; 
    updatedAt?: Timestamp;
}
