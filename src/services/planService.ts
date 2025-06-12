
// src/services/planService.ts
import { db, auth } from '@/lib/firebase/config';
import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  type FieldValue,
  updateDoc,
  writeBatch, 
  increment, 
} from 'firebase/firestore';
import type { Plan, NewPlanData, ClientPlan, RoadmapStep, UpdatePlanData, PlanVersionData, ClientPlanVersion, ChildDataItem, PeerConnection, PlanVisibility, PlanEditability } from '@/types/plan';
import { fetchUserProfileBasic } from './connectionService'; // For fetching editor display name

const PLANS_COLLECTION = 'plans';
const plansCollectionRef = collection(db, PLANS_COLLECTION);

const sanitizeRoadmapStep = (step: Partial<RoadmapStep>, defaultParentId?: string): RoadmapStep => {
  const sanitizedChildrenData = (Array.isArray(step.childrenData) ? step.childrenData : []).map(ci => ({
    id: typeof ci.id === 'string' && ci.id.trim() !== '' ? ci.id : `childitem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title: ci.title || "Untitled Child",
    description: ci.description || null,
    parentCanvasNodeId: ci.parentCanvasNodeId || step.id || defaultParentId || "", 
    canvasNodeIdForThisItem: ci.canvasNodeIdForThisItem || null,
  }));
  return {
    id: typeof step.id === 'string' && step.id.trim() !== '' ? step.id : `step_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title: typeof step.title === 'string' ? step.title : "Untitled Step",
    x: typeof step.x === 'number' ? step.x : 0,
    y: typeof step.y === 'number' ? step.y : 0,
    description: (typeof step.description === 'string' && step.description.trim() !== '') ? step.description.trim() : null,
    childrenData: sanitizedChildrenData,
    peerConnections: Array.isArray(step.peerConnections) ? step.peerConnections : [],
  };
};

export const createPlan = async (planData: NewPlanData): Promise<string> => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User not authenticated. Cannot create plan.");
  }
  if (user.uid !== planData.ownerId) {
    throw new Error("Authenticated user does not match plan ownerId.");
  }

  let viewUserIds: string[] = [];
  if (planData.visibility === 'private' || planData.visibility === 'unlisted') {
    viewUserIds = [planData.ownerId];
  } else if (planData.visibility === 'public') {
    viewUserIds = []; // Public access is handled by rules checking the 'visibility' field
  }

  let editUserIds: string[] = [];
  if (planData.editability === 'owner_only' || planData.editability === 'collaborators') {
    // Owner is always an editor initially
    editUserIds = [planData.ownerId];
  }

  const dataToSave: Omit<Plan, 'id' | 'createdAt' | 'updatedAt' | 'version'> & { createdAt: FieldValue, updatedAt: FieldValue, version: number } = {
    name: planData.name,
    ownerId: planData.ownerId,
    sector: planData.sector,
    subSector: planData.subSector || null,
    industry: planData.industry || null,
    naicsCode: planData.naicsCode || null,
    createdAt: serverTimestamp() as FieldValue,
    updatedAt: serverTimestamp() as FieldValue,
    version: 1,
    roadmap: (planData.roadmap || []).map(step => sanitizeRoadmapStep(step)),
    visibility: planData.visibility,
    editability: planData.editability,
    viewUserIds: viewUserIds,
    editUserIds: editUserIds,
  };

  try {
    const docRef = await addDoc(plansCollectionRef, dataToSave);
    return docRef.id;
  } catch (error: any) {
    console.error("[planService] Error creating plan:", error);
    throw new Error(error.message || "Could not create plan.");
  }
};

export const getPlanById = async (planId: string): Promise<ClientPlan | null> => {
  if (!planId) return null;
  const planDocRef = doc(plansCollectionRef, planId);
  try {
    const docSnap = await getDoc(planDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as Plan;
      const clientPlan: ClientPlan = {
        id: docSnap.id,
        name: data.name,
        ownerId: data.ownerId,
        sector: data.sector,
        subSector: data.subSector || null,
        industry: data.industry || null,
        naicsCode: data.naicsCode || null,
        createdAt: (data.createdAt as Timestamp)?.toMillis() || Date.now(),
        updatedAt: (data.updatedAt as Timestamp)?.toMillis() || Date.now(),
        version: data.version || 1,
        roadmap: (data.roadmap || []).map(step => sanitizeRoadmapStep(step)),
        visibility: data.visibility || 'private', // Default to private if not set
        editability: data.editability || 'owner_only', // Default to owner_only
        viewUserIds: data.viewUserIds || (data.visibility === 'private' ? [data.ownerId] : []),
        editUserIds: data.editUserIds || [data.ownerId],
      };
      return clientPlan;
    }
    return null;
  } catch (error: any) {
    console.error(`[planService] Error fetching plan ${planId}:`, error);
    throw new Error(error.message || "Could not fetch plan.");
  }
};

export const updatePlanRoadmap = async (planId: string, currentUserId: string, updatedRoadmap: RoadmapStep[]): Promise<void> => {
  const user = auth.currentUser;
  if (!user || user.uid !== currentUserId) { 
    throw new Error("User not authenticated or mismatch. Cannot update plan.");
  }
  if (!planId) throw new Error("Plan ID is required to update roadmap.");

  const planDocRef = doc(plansCollectionRef, planId);
  const versionsCollectionRef = collection(db, PLANS_COLLECTION, planId, 'versions');

  try {
    const batch = writeBatch(db);
    const currentPlanSnap = await getDoc(planDocRef);
    if (!currentPlanSnap.exists()) throw new Error(`Plan with ID ${planId} not found.`);
    
    const currentPlanData = currentPlanSnap.data() as Plan;
    // Permission check: Owner or an editor in editUserIds (if collaborators mode)
    const canEdit = currentPlanData.ownerId === currentUserId || 
                    (currentPlanData.editability === 'collaborators' && currentPlanData.editUserIds.includes(currentUserId));

    if (!canEdit) {
        throw new Error("Permission denied: You do not have rights to edit this plan's roadmap.");
    }
    const currentVersionNumber = currentPlanData.version || 1;

    const newVersionDocRef = doc(versionsCollectionRef);
    const versionData: PlanVersionData = {
      planId: planId,
      roadmap: (currentPlanData.roadmap || []).map(step => sanitizeRoadmapStep(step)),
      editorUid: currentUserId,
      timestamp: serverTimestamp() as FieldValue,
      versionNumber: currentVersionNumber,
      visibility: currentPlanData.visibility, // Save current permissions with version
      editability: currentPlanData.editability,
    };
    batch.set(newVersionDocRef, versionData);

    const dataToUpdateMainPlan: Partial<Plan> & {updatedAt: FieldValue, version: FieldValue } = {
      roadmap: updatedRoadmap.map(step => sanitizeRoadmapStep(step)), 
      updatedAt: serverTimestamp() as FieldValue,
      version: increment(1) as FieldValue,
    };
    batch.update(planDocRef, dataToUpdateMainPlan as { [key: string]: any });

    await batch.commit();
  } catch (error: any) {
    console.error(`[planService] Error updating roadmap for plan ${planId}:`, error);
    throw new Error(error.message || "Could not update plan roadmap.");
  }
};

export const getRecentPlans = async (count = 6): Promise<ClientPlan[]> => {
  try {
    // Add a filter for public plans. For now, this will fetch all plans.
    // Firestore rules will ultimately control what's readable.
    // For a true "discover" page, you'd query `where('visibility', '==', 'public')`
    // but this requires an index and careful rule setup.
    const q = query(plansCollectionRef, orderBy('createdAt', 'desc'), limit(count));
    const querySnapshot = await getDocs(q);
    const plans: ClientPlan[] = querySnapshot.docs
      .map((docSnap) => {
        const data = docSnap.data() as Plan;
        // Client-side filter for discover page - only show public or unlisted (for direct link access scenario if needed)
        // However, a Discover page should primarily show 'public' plans based on Firestore query & rules.
        if (data.visibility !== 'public' && data.visibility !== 'unlisted') {
            return null; 
        }
        return {
          id: docSnap.id,
          name: data.name,
          ownerId: data.ownerId,
          sector: data.sector,
          subSector: data.subSector || null,
          industry: data.industry || null,
          naicsCode: data.naicsCode || null,
          createdAt: (data.createdAt as Timestamp)?.toMillis() || Date.now(),
          updatedAt: (data.updatedAt as Timestamp)?.toMillis() || Date.now(),
          version: data.version || 1,
          roadmap: (data.roadmap || []).map(step => sanitizeRoadmapStep(step)),
          visibility: data.visibility,
          editability: data.editability,
          viewUserIds: data.viewUserIds,
          editUserIds: data.editUserIds,
          description: data.description || null,
        };
      })
      .filter((plan): plan is ClientPlan => plan !== null);
    return plans;
  } catch (error: any) {
    console.error("[planService] Error fetching recent plans:", error);
    throw new Error(`Failed to fetch recent plans: ${error.message || 'Unknown error'}`);
  }
};

export const getPlanVersions = async (planId: string): Promise<ClientPlanVersion[]> => {
  if (!planId) return [];
  const versionsRef = collection(db, PLANS_COLLECTION, planId, 'versions');
  try {
    const q = query(versionsRef, orderBy('timestamp', 'desc'), limit(50));
    const querySnapshot = await getDocs(q);
    const versionsPromises = querySnapshot.docs.map(async (docSnap) => {
      const data = docSnap.data() as PlanVersionData & { timestamp: Timestamp };
      let editorDisplayName = data.editorUid;
      if (data.editorUid) {
        const profile = await fetchUserProfileBasic(data.editorUid);
        editorDisplayName = profile?.displayName || data.editorUid;
      }
      return {
        id: docSnap.id,
        planId: data.planId,
        roadmap: (data.roadmap || []).map(step => sanitizeRoadmapStep(step)),
        editorUid: data.editorUid,
        editorDisplayName: editorDisplayName,
        timestamp: data.timestamp.toMillis(),
        versionNumber: data.versionNumber,
        visibility: data.visibility, // Include if stored in version
        editability: data.editability, // Include if stored in version
      } as ClientPlanVersion;
    });
    return await Promise.all(versionsPromises);
  } catch (error: any) {
    console.error(`[planService] Error fetching versions for plan ${planId}:`, error);
    throw new Error(error.message || "Could not fetch plan versions.");
  }
};

export const restorePlanToVersion = async (planId: string, versionIdToRestore: string, currentUserId: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user || user.uid !== currentUserId) {
    throw new Error("User not authenticated or mismatch. Cannot restore plan.");
  }
  if (!planId || !versionIdToRestore) throw new Error("Plan ID and Version ID are required.");

  const planDocRef = doc(plansCollectionRef, planId);
  const versionToRestoreDocRef = doc(db, PLANS_COLLECTION, planId, 'versions', versionIdToRestore);
  const newVersionHistoryCollectionRef = collection(db, PLANS_COLLECTION, planId, 'versions');

  try {
    const batch = writeBatch(db);
    const [currentPlanSnap, versionToRestoreSnap] = await Promise.all([
      getDoc(planDocRef),
      getDoc(versionToRestoreDocRef),
    ]);

    if (!currentPlanSnap.exists()) throw new Error(`Plan with ID ${planId} not found.`);
    if (!versionToRestoreSnap.exists()) throw new Error(`Version ID ${versionIdToRestore} not found.`);

    const currentPlanData = currentPlanSnap.data() as Plan;
    const versionToRestoreData = versionToRestoreSnap.data() as PlanVersionData;

    if (currentPlanData.ownerId !== currentUserId) { 
        throw new Error("Permission denied: Only the plan owner can restore versions.");
    }
    const currentPlanVersionNumber = currentPlanData.version || 1;

    // Create a snapshot of the current state before restoring
    const newHistoryVersionDocRef = doc(newVersionHistoryCollectionRef);
    const currentSnapshotVersionData: PlanVersionData = {
      planId: planId,
      roadmap: (currentPlanData.roadmap || []).map(step => sanitizeRoadmapStep(step)),
      editorUid: currentUserId,
      timestamp: serverTimestamp() as FieldValue,
      versionNumber: currentPlanVersionNumber,
      visibility: currentPlanData.visibility, // Snapshot current permissions
      editability: currentPlanData.editability,
    };
    batch.set(newHistoryVersionDocRef, currentSnapshotVersionData);

    // Update the main plan with the roadmap from the version being restored
    // Also restore permissions if they were stored in the version snapshot
    const mainPlanUpdateData: Partial<Plan> & {updatedAt: FieldValue, version: FieldValue } = {
      roadmap: (versionToRestoreData.roadmap || []).map(step => sanitizeRoadmapStep(step)),
      updatedAt: serverTimestamp() as FieldValue,
      version: increment(1) as FieldValue,
    };

    if (versionToRestoreData.visibility) {
      mainPlanUpdateData.visibility = versionToRestoreData.visibility;
    }
    if (versionToRestoreData.editability) {
      mainPlanUpdateData.editability = versionToRestoreData.editability;
    }
    // Note: viewUserIds and editUserIds are not typically part of version history snapshots for simplicity,
    // so restoring a version usually only restores content and the general permission *mode*.
    // If granular user ID lists were also versioned, they would be restored here too.

    batch.update(planDocRef, mainPlanUpdateData as { [key: string]: any });

    await batch.commit();
  } catch (error: any) {
    console.error(`[planService] Error restoring plan ${planId} to version ${versionIdToRestore}:`, error);
    throw new Error(error.message || "Could not restore plan.");
  }
};
