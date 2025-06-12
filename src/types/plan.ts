
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
}

// Defines a peer-to-peer connection between parent-level canvas nodes
export interface PeerConnection {
  // id: string; // Optional: A unique ID for the connection itself, if needed later
  targetNodeId: string; // ID of the node this connection points to
  sourceDot: 'N' | 'E' | 'S'; // Dot on the current node (source of the arrow)
  targetDot: 'N' | 'E' | 'S' | 'W'; // Dot on the target node (where the arrow points)
}

// Represents a node visible and interactive on the main canvas.
export interface RoadmapStep {
  id: string;
  title: string;
  x: number;
  y: number;
  description?: string | null;
  childrenData: ChildDataItem[];
  peerConnections?: PeerConnection[];
}

export type PlanVisibility = 'private' | 'unlisted' | 'public';
export type PlanEditability = 'owner_only' | 'collaborators';

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
  roadmap: RoadmapStep[];
  version?: number;
  visibility: PlanVisibility;
  editability: PlanEditability;
  viewUserIds: string[];
  editUserIds: string[];
}

export interface NewPlanData extends Omit<Plan, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'roadmap' | 'description' | 'viewUserIds' | 'editUserIds'> {
  createdAt?: FieldValue;
  updatedAt?: FieldValue;
  description?: string | null;
  roadmap?: RoadmapStep[];
  visibility: PlanVisibility; // Made mandatory for new plans
  editability: PlanEditability; // Made mandatory for new plans
  viewUserIds?: string[]; // Service will set defaults
  editUserIds?: string[]; // Service will set defaults
}

// For updating the overall plan structure, not just a single node's details
export interface UpdatePlanData {
  roadmap: RoadmapStep[];
  updatedAt: FieldValue;
  version?: FieldValue;
  name?: string;
  description?: string | null;
  sector?: string;
  subSector?: string | null;
  industry?: string | null;
  naicsCode?: string | null;
  visibility?: PlanVisibility;
  editability?: PlanEditability;
  viewUserIds?: string[];
  editUserIds?: string[];
}

export interface ClientPlan extends Omit<Plan, 'createdAt' | 'updatedAt'> {
  createdAt: number;
  updatedAt: number;
}

// For version history, storing a snapshot of the canvas nodes
export interface PlanVersionData {
  planId: string;
  roadmap: RoadmapStep[];
  editorUid: string;
  timestamp: FieldValue;
  versionNumber?: number;
  // Version snapshots can also store permissions at that time if needed, but keeping it simple for now
  visibility?: PlanVisibility;
  editability?: PlanEditability;
}

export interface ClientPlanVersion extends Omit<PlanVersionData, 'timestamp' | 'editorUid'> {
  id: string;
  timestamp: number;
  editorUid: string;
  editorDisplayName?: string;
}
