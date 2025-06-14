
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
export type PlanEditability = 'owner_only' | 'collaborators' | 'everyone'; // Added 'everyone'

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
  version?: number;
  visibility?: PlanVisibility;
  editability?: PlanEditability;
  viewUserIds?: string[]; // Array of UIDs who can view (owner always can)
  editUserIds?: string[]; // Array of UIDs who can edit (owner always can, implies view)
  roadmap: RoadmapStep[];
}

// NewPlanData ensures visibility and editability are provided from the form.
// The service will then include them in the dataToSave if rules allow.
export interface NewPlanData extends Omit<Plan, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'roadmap' | 'viewUserIds' | 'editUserIds'> {
  createdAt?: FieldValue;
  updatedAt?: FieldValue;
  description?: string | null;
  roadmap?: RoadmapStep[];
  visibility: PlanVisibility; // Mandatory from form
  editability: PlanEditability; // Mandatory from form
  viewUserIds?: string[]; // Service can default these based on visibility/editability
  editUserIds?: string[]; // Service can default these
}

// For updating the overall plan structure, not just a single node's details
export interface UpdatePlanData {
  roadmap?: RoadmapStep[]; // Made roadmap optional as settings update might not change it
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
  viewUserIds?: string[]; // Add these for permission updates
  editUserIds?: string[]; // Add these for permission updates
}

// ClientPlan should always have defaulted visibility/editability
export interface ClientPlan extends Omit<Plan, 'createdAt' | 'updatedAt' | 'visibility' | 'editability' | 'viewUserIds' | 'editUserIds'> {
  createdAt: number;
  updatedAt: number;
  visibility: PlanVisibility; // Mandatory on client, defaulted if not in DB
  editability: PlanEditability; // Mandatory on client, defaulted
  viewUserIds: string[]; // Mandatory on client, defaulted
  editUserIds: string[]; // Mandatory on client, defaulted
}

// For version history, storing a snapshot of the canvas nodes
// Only includes fields allowed by the strict 'versions' subcollection security rule
export interface PlanVersionData {
  planId: string;
  roadmap: RoadmapStep[];
  editorUid: string;
  timestamp: FieldValue;
  versionNumber?: number;
  // visibility and editability are NOT stored in the version document itself as per current rules
}

// ClientPlanVersion for display
export interface ClientPlanVersion extends Omit<PlanVersionData, 'timestamp' | 'editorUid'> {
  id: string;
  timestamp: number;
  editorUid: string;
  editorDisplayName?: string;
  visibility?: PlanVisibility; // Optional: Reflects that this info might not be on the version doc itself
  editability?: PlanEditability; // Optional: Reflects that this info might not be on the version doc itself
}
