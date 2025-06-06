
// src/types/plan.ts
import type { Timestamp, FieldValue } from 'firebase/firestore';

export interface RoadmapSubStep {
  id: string;
  parentId: string; // ID of the main step it belongs to
  title: string;
  // Potentially add: description, status, assignee, dates, etc.
}

export interface RoadmapStep {
  id: string;
  title: string;
  subSteps?: RoadmapSubStep[]; // Optional array of sub-steps
  x: number; // X coordinate for positioning on canvas
  y: number; // Y coordinate for positioning on canvas
  sourceNodeId?: string; // Optional: ID of the node this step was created from OR connected TO
  sourceAnchor?: 'N' | 'S' | 'E' | 'W'; // Optional: Anchor point on the source node the line comes FROM
  sourceLineYOffset?: number; // Optional: Y-offset relative to sourceNode's anchor for line start (used for sub-step origins or specific dot connections)
  description?: string | null;
  originatingSubStepInfo?: { // Link to the sub-step if this main step was created from one
    sourceCardId: string; // ID of the card that contains the originating sub-step
    subStepId: string;    // ID of the originating sub-step itself
  } | null;
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
  roadmap?: RoadmapStep[];
}

export interface NewPlanData extends Omit<Plan, 'id' | 'createdAt' | 'updatedAt' | 'roadmap'> {
  createdAt?: FieldValue;
  updatedAt?: FieldValue;
  roadmap?: RoadmapStep[];
}

// For updating existing plans, specifically the roadmap
export interface UpdatePlanRoadmapData {
  roadmap: RoadmapStep[];
  updatedAt: FieldValue;
}


// Client-side representation with serializable timestamps
export interface ClientPlan extends Omit<Plan, 'createdAt' | 'updatedAt'> {
  createdAt: number; // Milliseconds since epoch
  updatedAt: number; // Milliseconds since epoch
  roadmap?: RoadmapStep[];
}

    