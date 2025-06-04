
// src/types/plan.ts
import type { Timestamp, FieldValue } from 'firebase/firestore';

// Added for Roadmap feature
export interface RoadmapSubStep {
  id: string;
  parentId: string; // ID of the main step it belongs to
  title: string;
  type: 'Sub-category/Task'; // For now, sub-steps are always this type
  // Potentially add: description, status, assignee, dates, etc.
}

export interface RoadmapStep {
  id: string;
  title: string;
  type: 'Main Category/Phase' | 'Sub-category/Task'; // Type of the step
  subSteps?: RoadmapSubStep[]; // Optional array of sub-steps
  // Potentially add: description, status, assignee, dates, etc.
}


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
  roadmap?: RoadmapStep[]; // Optional: Store the roadmap structure
  // Later, we might add:
  // content?: any; // For storing whiteboard data directly
  // miroBoardId?: string | null; // If integrating with Miro
  // sharedWithUserIds?: string[];
}

export interface NewPlanData extends Omit<Plan, 'id' | 'createdAt' | 'updatedAt' | 'roadmap'> {
  createdAt?: FieldValue;
  updatedAt?: FieldValue;
  roadmap?: RoadmapStep[]; // Allow setting initial roadmap
}

// Client-side representation with serializable timestamps
export interface ClientPlan extends Omit<Plan, 'createdAt' | 'updatedAt'> {
  createdAt: number; // Milliseconds since epoch
  updatedAt: number; // Milliseconds since epoch
  roadmap?: RoadmapStep[]; // Include roadmap on client
}

    