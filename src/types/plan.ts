
// src/types/plan.ts
import type { Timestamp, FieldValue } from 'firebase/firestore';

// Represents task-like items within a main RoadmapStep
export interface RoadmapSubStep {
  id: string;
  parentId: string; // ID of the main step or parent sub-step it belongs to
  title: string;
  description?: string | null;
  subSteps?: RoadmapSubStep[];
}

// Connections are now primarily defined by parentId relationships.
// This type might be used for temporary drag previews or specific labeled connections if needed later,
// but is not the primary structural link for hierarchy.
export interface ExplicitConnection {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  label?: string | null;
  // type?: 'dependency' | 'related'; // Example types
}

export interface RoadmapStep {
  id: string;
  title: string;
  x: number;
  y: number;
  description?: string | null;
  parentId: string | null; // ID of the parent RoadmapStep, null if root
  subSteps?: RoadmapSubStep[]; // For task-like items within this node, not child nodes on canvas
  // explicitConnections?: ExplicitConnection[]; // Optional: for manually drawn non-hierarchical connections
  // Other properties like color, status, assignedTo could be added here
}


export interface Plan {
  id: string;
  name: string;
  description?: string | null; // Added top-level plan description
  ownerId: string;
  sector: string;
  subSector?: string | null;
  industry?: string | null;
  naicsCode: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  roadmap: RoadmapStep[]; // The collection of all nodes in the plan
  version?: number;
}

export interface NewPlanData extends Omit<Plan, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'roadmap' | 'description'> {
  createdAt?: FieldValue;
  updatedAt?: FieldValue;
  description?: string | null;
  roadmap?: RoadmapStep[]; // Initial roadmap (usually empty or with a root node)
}

export interface UpdatePlanRoadmapData {
  roadmap: RoadmapStep[];
  updatedAt: FieldValue;
  version?: FieldValue;
  name?: string; // Allow updating plan name
  description?: string | null; // Allow updating plan description
  sector?: string;
  subSector?: string | null;
  industry?: string | null;
  naicsCode?: string | null;
}

export interface ClientPlan extends Omit<Plan, 'createdAt' | 'updatedAt'> {
  createdAt: number;
  updatedAt: number;
}

export interface PlanVersionData {
  planId: string;
  roadmap: RoadmapStep[];
  editorUid: string;
  timestamp: FieldValue;
  versionNumber?: number;
}

export interface ClientPlanVersion {
  id: string;
  planId: string;
  roadmap: RoadmapStep[];
  editorUid: string;
  editorDisplayName?: string;
  timestamp: number;
  versionNumber?: number;
}
