// src/types/plan.ts
import type { Timestamp, FieldValue } from 'firebase/firestore';

// RoadmapSubStep and ExplicitConnection are removed.
// IncomingConnection is removed as hierarchy is now solely defined by parentId.

export interface RoadmapStep {
  id: string;
  title: string;
  x: number;
  y: number;
  description?: string | null;
  parentId: string | null; // ID of the parent RoadmapStep, null if root
  // subSteps?: RoadmapSubStep[]; // REMOVED - Child nodes are now full RoadmapSteps linked by parentId
  // explicitConnections?: ExplicitConnection[]; // REMOVED
  // incomingConnections?: IncomingConnection[]; // REMOVED
}


export interface Plan {
  id: string;
  name: string;
  description?: string | null;
  ownerId: string;
  sector: string;
  subSector?: string | null;
  industry?: string | null;
  naicsCode: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  roadmap: RoadmapStep[]; // The collection of all nodes in the plan, hierarchy defined by parentId
  version?: number;
}

export interface NewPlanData extends Omit<Plan, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'roadmap' | 'description'> {
  createdAt?: FieldValue;
  updatedAt?: FieldValue;
  description?: string | null;
  roadmap?: RoadmapStep[];
}

export interface UpdatePlanRoadmapData {
  roadmap: RoadmapStep[];
  updatedAt: FieldValue;
  version?: FieldValue;
  name?: string;
  description?: string | null;
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
  roadmap: RoadmapStep[]; // Stores the flat list of nodes
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
