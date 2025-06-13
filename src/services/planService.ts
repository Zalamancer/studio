
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
  where,
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

  const validVisibilities: PlanVisibility[] = ['private', 'unlisted', 'public'];
  let finalVisibility: PlanVisibility = planData.visibility;
  if (!validVisibilities.includes(finalVisibility)) {
    finalVisibility = 'private';
  }

  const validEditabilities: PlanEditability[] = ['owner_only', 'collaborators'];
  let finalEditability: PlanEditability = planData.editability;
  if (!validEditabilities.includes(finalEditability)) {
    finalEditability = 'owner_only';
  }

  let viewUserIds: string[] = [];
  if (finalVisibility === 'public') {
    viewUserIds = []; 
  } else { 
    viewUserIds = [planData.ownerId]; 
  }

  let editUserIds: string[] = [];
  if (finalEditability === 'owner_only') {
    editUserIds = [planData.ownerId];
  } else if (finalEditability === 'collaborators') {
    editUserIds = [planData.ownerId]; 
  }

  const dataToSave: Omit<Plan, 'id'> & { createdAt: FieldValue, updatedAt: FieldValue } = {
    name: planData.name,
    ownerId: planData.ownerId,
    description: planData.description?.trim() || null,
    sector: planData.sector,
    subSector: planData.subSector || null,
    industry: planData.industry || null,
    naicsCode: planData.naicsCode || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    version: 1,
    roadmap: (planData.roadmap || []).map(step => sanitizeRoadmapStep(step)),
    visibility: finalVisibility,
    editability: finalEditability,
    viewUserIds: viewUserIds,
    editUserIds: editUserIds,
  };
  
  try {
    const docRef = await addDoc(plansCollectionRef, dataToSave);
    return docRef.id;
  } catch (error: any) {
    console.error(`[planService] createPlan - Firestore addDoc ERROR. Data attempted:`, JSON.parse(JSON.stringify(dataToSave, (key, value) => (value as any)?._methodName?.includes('serverTimestamp') ? 'FieldValue.serverTimestamp()' : value, 2)));
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
        description: data.description || null,
        sector: data.sector,
        subSector: data.subSector || null,
        industry: data.industry || null,
        naicsCode: data.naicsCode || null,
        createdAt: (data.createdAt as Timestamp)?.toMillis() || Date.now(),
        updatedAt: (data.updatedAt as Timestamp)?.toMillis() || Date.now(),
        version: data.version || 1,
        roadmap: (data.roadmap || []).map(step => sanitizeRoadmapStep(step)),
        visibility: data.visibility || 'private', 
        editability: data.editability || 'owner_only', 
        viewUserIds: data.viewUserIds || (data.ownerId ? [data.ownerId] : []), 
        editUserIds: data.editUserIds || (data.ownerId ? [data.ownerId] : []), 
      };
      return clientPlan;
    }
    return null;
  } catch (error: any) {
    console.error(`[planService] Error fetching plan ${planId}:`, error);
    throw new Error(error.message || "Could not fetch plan.");
  }
};

// Updated function to handle general plan details including permissions
export const updatePlanDetails = async (planId: string, currentUserId: string, updates: UpdatePlanData): Promise<void> => {
  const user = auth.currentUser;
  if (!user || user.uid !== currentUserId) {
    throw new Error("User not authenticated or mismatch. Cannot update plan settings.");
  }
  if (!planId) throw new Error("Plan ID is required to update settings.");

  const planDocRef = doc(plansCollectionRef, planId);
  try {
    const currentPlanSnap = await getDoc(planDocRef);
    if (!currentPlanSnap.exists()) throw new Error(`Plan with ID ${planId} not found.`);
    const currentPlanData = currentPlanSnap.data() as Plan;
    if (currentPlanData.ownerId !== currentUserId) {
      throw new Error("Permission denied: Only the plan owner can change settings.");
    }

    const dataToUpdate: { [key: string]: any } = { updatedAt: serverTimestamp() };
    
    if (updates.name !== undefined) dataToUpdate.name = updates.name;
    if (updates.description !== undefined) dataToUpdate.description = updates.description;
    if (updates.sector !== undefined) dataToUpdate.sector = updates.sector;
    if (updates.subSector !== undefined) dataToUpdate.subSector = updates.subSector;
    if (updates.industry !== undefined) dataToUpdate.industry = updates.industry;
    if (updates.naicsCode !== undefined) dataToUpdate.naicsCode = updates.naicsCode;
    if (updates.visibility !== undefined) dataToUpdate.visibility = updates.visibility;
    if (updates.editability !== undefined) dataToUpdate.editability = updates.editability;
    if (updates.viewUserIds !== undefined) dataToUpdate.viewUserIds = Array.from(new Set([currentUserId, ...(updates.viewUserIds || [])])); // Ensure owner is always a viewer
    if (updates.editUserIds !== undefined) dataToUpdate.editUserIds = Array.from(new Set([currentUserId, ...(updates.editUserIds || [])])); // Ensure owner is always an editor
    
    // If visibility or editability changed, derive the correct viewUserIds and editUserIds
    const finalVisibility = updates.visibility || currentPlanData.visibility || 'private';
    const finalEditability = updates.editability || currentPlanData.editability || 'owner_only';

    if (updates.visibility !== undefined || updates.editability !== undefined || updates.viewUserIds !== undefined || updates.editUserIds !== undefined) {
        let newViewUserIds = updates.viewUserIds || currentPlanData.viewUserIds || [];
        let newEditUserIds = updates.editUserIds || currentPlanData.editUserIds || [];

        if (finalVisibility === 'public') {
            newViewUserIds = []; // Public means no specific list needed
        } else { // private or unlisted
            newViewUserIds = Array.from(new Set([currentUserId, ...newViewUserIds]));
        }

        if (finalEditability === 'owner_only') {
            newEditUserIds = [currentUserId];
        } else { // collaborators
            newEditUserIds = Array.from(new Set([currentUserId, ...newEditUserIds]));
        }
        // Editors must also be viewers
        newViewUserIds = Array.from(new Set([...newViewUserIds, ...newEditUserIds]));


        dataToUpdate.viewUserIds = newViewUserIds;
        dataToUpdate.editUserIds = newEditUserIds;
    }


    // If roadmap is part of updates (from canvas save), increment version and save roadmap
    if (updates.roadmap) {
        const currentVersionNumber = currentPlanData.version || 1;
        const versionsCollectionRef = collection(db, PLANS_COLLECTION, planId, 'versions');
        const newVersionDocRef = doc(versionsCollectionRef);
        const versionData: PlanVersionData = {
          planId: planId,
          roadmap: (currentPlanData.roadmap || []).map(step => sanitizeRoadmapStep(step)),
          editorUid: currentUserId,
          timestamp: serverTimestamp(),
          versionNumber: currentVersionNumber,
        };
        // Add to batch later if we use batch for main update
        await setDoc(newVersionDocRef, versionData); // For now, separate write
        dataToUpdate.roadmap = updates.roadmap.map(step => sanitizeRoadmapStep(step));
        dataToUpdate.version = increment(1);
    }
    
    // Firestore security rules need to allow updates to name, description, sector, subSector, industry, naicsCode,
    // visibility, editability, viewUserIds, editUserIds, updatedAt, and potentially roadmap and version.
    await updateDoc(planDocRef, dataToUpdate);
    console.log(`[planService] Plan details/settings updated for plan ${planId} by owner ${currentUserId}`);
  } catch (error: any) {
    console.error(`[planService] Error updating plan settings for plan ${planId}:`, error);
    throw new Error(error.message || "Could not update plan settings.");
  }
};

// This function now uses updatePlanDetails for roadmap specific changes
export const updatePlanRoadmap = async (planId: string, currentUserId: string, updatedRoadmap: RoadmapStep[]): Promise<void> => {
  await updatePlanDetails(planId, currentUserId, {
    roadmap: updatedRoadmap,
    updatedAt: serverTimestamp(), // serverTimestamp is implicitly handled by updatePlanDetails now
    // version incrementation is also handled by updatePlanDetails when roadmap is present
  });
};


export const getRecentPlans = async (count = 6): Promise<ClientPlan[]> => {
  try {
    const q = query(
      plansCollectionRef,
      where('visibility', 'in', ['public', 'unlisted']),
      orderBy('createdAt', 'desc'),
      limit(count)
    );
    const querySnapshot = await getDocs(q);
    const plans: ClientPlan[] = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data() as Plan;
      const clientPlan: ClientPlan = {
        id: docSnap.id,
        name: data.name,
        ownerId: data.ownerId,
        description: data.description || null,
        sector: data.sector,
        subSector: data.subSector || null,
        industry: data.industry || null,
        naicsCode: data.naicsCode || null,
        createdAt: (data.createdAt as Timestamp)?.toMillis() || Date.now(),
        updatedAt: (data.updatedAt as Timestamp)?.toMillis() || Date.now(),
        version: data.version || 1,
        roadmap: (data.roadmap || []).map(step => sanitizeRoadmapStep(step)),
        visibility: data.visibility || 'private', 
        editability: data.editability || 'owner_only', 
        viewUserIds: data.viewUserIds || (data.ownerId ? [data.ownerId] : []), 
        editUserIds: data.editUserIds || (data.ownerId ? [data.ownerId] : []), 
      };
      return clientPlan;
    });
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
        visibility: undefined, 
        editability: undefined,
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
  
  try {
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
   
    // Update the main plan with the roadmap from the version to restore
    // The version number increment and new history creation will be handled by updatePlanDetails
    await updatePlanDetails(planId, currentUserId, {
      roadmap: (versionToRestoreData.roadmap || []).map(step => sanitizeRoadmapStep(step)),
      updatedAt: serverTimestamp(), // Will be set by updatePlanDetails
      // Note: We are NOT restoring visibility/editability settings from the version history.
      // Those are managed separately via the PlanInfoDialog and main plan document.
      // updatePlanDetails will create a new version snapshot of the *current* state before this restore.
    });

    console.log(`[planService] Plan ${planId} restored to version ${versionIdToRestore} by user ${currentUserId}. A new version snapshot of the previous state was created.`);
  } catch (error: any) {
    console.error(`[planService] Error restoring plan ${planId} to version ${versionIdToRestore}:`, error);
    throw new Error(error.message || "Could not restore plan.");
  }
};

