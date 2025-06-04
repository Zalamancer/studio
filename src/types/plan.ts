
// src/types/plan.ts
import type { Timestamp, FieldValue } from 'firebase/firestore';

export interface Plan {
  id: string;
  name: string;
  ownerId: string;
  sector: string; // Name of the sector
  subSector?: string | null; // Name of the sub-sector
  industry?: string | null; // Name of the industry
  naicsCode: string | null; // Most specific NAICS code selected
  createdAt: Timestamp;
  updatedAt: Timestamp;
  // Later, we might add:
  // content?: any; // For storing whiteboard data directly
  // miroBoardId?: string | null; // If integrating with Miro
  // sharedWithUserIds?: string[];
}

export interface NewPlanData extends Omit<Plan, 'id' | 'createdAt' | 'updatedAt'> {
  createdAt?: FieldValue;
  updatedAt?: FieldValue;
}

// Client-side representation with serializable timestamps
export interface ClientPlan extends Omit<Plan, 'createdAt' | 'updatedAt'> {
  createdAt: number; // Milliseconds since epoch
  updatedAt: number; // Milliseconds since epoch
}
