
// src/types/plan.ts
import type { Timestamp, FieldValue } from 'firebase/firestore';

// Represents an item listed within a RoadmapStep's childrenData.
// It only becomes a full RoadmapStep on the canvas if it itself has children.
export interface ChildDataItem {
  id: string; // Unique ID for this child item
  title: string;
  description?: string | null;
  parentCanvasNodeId: string; // ID of the RoadmapStep (canvas node) this item belongs to
  canvasNodeIdForThisItem?: string | null; // ID of the RoadmapStep on canvas IF this item is spawned
  // childOrder?: number; // Optional: for ordering within the parent's list
}

// Represents a node visible and interactive on the main canvas.
export interface RoadmapStep {
  id: string;
  title: string;
  x: number;
  y: number;
  description?: string | null;
  childrenData: ChildDataItem[]; // List of child items displayed within this node's card
  // parentId is removed; visual hierarchy from ChildDataItem's dot to spawned canvas node.
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
  roadmap: RoadmapStep[]; // Flat list of ALL nodes currently on the canvas.
  version?: number;
}

export interface NewPlanData extends Omit<Plan, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'roadmap' | 'description'> {
  createdAt?: FieldValue;
  updatedAt?: FieldValue;
  description?: string | null;
  roadmap?: RoadmapStep[]; // Initial canvas nodes (likely empty or just a root)
}

// For updating the overall plan structure, not just a single node's details
export interface UpdatePlanData {
  roadmap: RoadmapStep[]; // The entire set of canvas nodes
  updatedAt: FieldValue;
  version?: FieldValue; // To increment version
  // Other top-level plan fields if they become editable (name, description, sector etc.)
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

// For version history, storing a snapshot of the canvas nodes
export interface PlanVersionData {
  planId: string;
  roadmap: RoadmapStep[]; // Snapshot of all canvas nodes and their childrenData lists
  editorUid: string;
  timestamp: FieldValue;
  versionNumber?: number;
}

export interface ClientPlanVersion extends Omit<PlanVersionData, 'timestamp' | 'editorUid'> {
  id: string;
  timestamp: number;
  editorUid: string; // Keep editorUid
  editorDisplayName?: string; // For display
}
