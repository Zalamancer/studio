
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

  console.log(`%c[planService] createPlan - START. Received planData:`, "color: #FFD700;", JSON.parse(JSON.stringify(planData)));
  console.log(`%c[planService] createPlan - typeof planData.visibility: ${typeof planData.visibility}, value: '${planData.visibility}'`, "color: #FFD700;");
  console.log(`%c[planService] createPlan - typeof planData.editability: ${typeof planData.editability}, value: '${planData.editability}'`, "color: #FFD700;");

  // Explicitly validate and default visibility and editability
  let finalVisibility: PlanVisibility = 'private';
  const validVisibilities: PlanVisibility[] = ['private', 'unlisted', 'public'];
  if (planData.hasOwnProperty('visibility') && typeof planData.visibility === 'string' && validVisibilities.includes(planData.visibility as PlanVisibility)) {
    finalVisibility = planData.visibility as PlanVisibility;
  } else {
    console.warn(`%c[planService] createPlan - WARNING: planData.visibility was invalid or missing (value: '${planData?.visibility}', type: ${typeof planData?.visibility}). Defaulting to 'private'.`, "color: red; font-weight:bold;");
  }
  console.log(`%c[planService] createPlan - Determined finalVisibility: '${finalVisibility}' (type: ${typeof finalVisibility})`, "color: #FFD700; font-weight:bold;");

  let finalEditability: PlanEditability = 'owner_only';
  const validEditabilities: PlanEditability[] = ['owner_only', 'collaborators'];
  if (planData.hasOwnProperty('editability') && typeof planData.editability === 'string' && validEditabilities.includes(planData.editability as PlanEditability)) {
    finalEditability = planData.editability as PlanEditability;
  } else {
    console.warn(`%c[planService] createPlan - WARNING: planData.editability was invalid or missing (value: '${planData?.editability}', type: ${typeof planData?.editability}). Defaulting to 'owner_only'.`, "color: red; font-weight:bold;");
  }
  console.log(`%c[planService] createPlan - Determined finalEditability: '${finalEditability}' (type: ${typeof finalEditability})`, "color: #FFD700; font-weight:bold;");

  // These fields are NOT being saved in this version due to strict security rules.
  // let viewUserIds: string[] = [];
  // if (finalVisibility === 'private' || finalVisibility === 'unlisted') {
  //   viewUserIds = [planData.ownerId];
  // }
  // let editUserIds: string[] = [];
  // if (finalEditability === 'owner_only' || finalEditability === 'collaborators') {
  //   editUserIds = [planData.ownerId];
  // }

  const dataToSave = {
    name: planData.name,
    ownerId: planData.ownerId,
    sector: planData.sector,
    subSector: planData.subSector || null,
    industry: planData.industry || null,
    naicsCode: planData.naicsCode || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    version: 1,
    roadmap: (planData.roadmap || []).map(step => sanitizeRoadmapStep(step)),
    // The following fields are intentionally omitted to comply with current restrictive security rules:
    // visibility: finalVisibility,
    // editability: finalEditability,
    // viewUserIds: viewUserIds,
    // editUserIds: editUserIds,
    // description: planData.description || null,
  };

  console.log(`%c[planService] createPlan - finalPayloadForFirestore (STRICT 10 fields):`, "color: fuchsia;", JSON.parse(JSON.stringify(dataToSave, (key, value) => (value as any)?._methodName?.includes('serverTimestamp') ? 'FieldValue.serverTimestamp()' : value )));
  // console.log(`  visibility type: ${typeof dataToSave.visibility}, value: ${dataToSave.visibility}`); // This would be undefined
  // console.log(`  editability type: ${typeof dataToSave.editability}, value: ${dataToSave.editability}`); // This would be undefined


  try {
    const docRef = await addDoc(plansCollectionRef, dataToSave);
    console.log(`%c[planService] Plan CREATED successfully with ID: ${docRef.id}`, "color: green; font-weight:bold;");
    return docRef.id;
  } catch (error: any) {
    console.error(`%c[planService] createPlan - Firestore addDoc ERROR. Data attempted:`, "color: red; font-weight:bold;", JSON.parse(JSON.stringify(dataToSave)));
    console.error(`  Error Code: ${error.code}, Message: ${error.message}`);
    if (error.code === 'permission-denied') {
      console.error("%c  [planService] PERMISSION DENIED. Check Firestore security rules for creating documents in the 'plans' collection. Common checks include:", "color: red; font-weight:bold;")
      console.error(`    - Ensure 'request.auth.uid' is not null (user is authenticated). Current auth UID: '${auth.currentUser?.uid || 'NULL'}'`);
      console.error(`    - Ensure 'request.resource.data.ownerId == request.auth.uid'. Data ownerId: '${dataToSave.ownerId}', Auth UID: '${auth.currentUser?.uid || 'NULL'}'`);
      console.error(`    - Ensure 'request.resource.data.createdAt == request.time' (if rule uses this). Data createdAt: serverTimestamp()`);
      console.error(`    - Ensure 'request.resource.data.version == 1' (if rule uses this). Data version: ${dataToSave.version}`);
      // Commenting out checks for fields not being sent:
      // console.error(`    - Ensure 'request.resource.data.visibility' is one of ['private', 'unlisted', 'public']. Data visibility: '${(dataToSave as any).visibility}' (type: ${typeof (dataToSave as any).visibility})`);
      // console.error(`    - Ensure 'request.resource.data.editability' is one of ['owner_only', 'collaborators']. Data editability: '${(dataToSave as any).editability}' (type: ${typeof (dataToSave as any).editability})`);
      // console.error(`    - Ensure 'request.auth.uid in request.resource.data.viewUserIds'. Data viewUserIds: [${(dataToSave as any).viewUserIds?.join(', ')}]`);
      // console.error(`    - Ensure 'request.auth.uid in request.resource.data.editUserIds'. Data editUserIds: [${(dataToSave as any).editUserIds?.join(', ')}]`);
      console.error("    - Ensure all required fields by your rules are present and no disallowed fields are being written. Current rules enforce exactly 10 fields and specific names.");
      console.error("    - The 'plans' collection path is correct and rules are applied to it.");

      if (error.message && error.message.toLowerCase().includes("undefined")) {
        console.error("    [DEBUG] Checking finalPayloadForFirestore for undefined values due to error message:");
        for (const key in dataToSave) {
          if (dataToSave[key as keyof typeof dataToSave] === undefined) { // Type assertion might be needed if TS complains
            console.error(`      UNDEFINED FIELD DETECTED in dataToSave: ${key}`);
          }
        }
      }
      throw new Error('Permission denied. Check Firestore security rules and console logs for details.');
    }
    if (error.message && error.message.includes("Unsupported field value: undefined")) {
      console.error("  [planService] Firestore received an undefined field value. Data attempted:", dataToSave);
      for (const key in dataToSave) {
        if (dataToSave[key as keyof typeof dataToSave] === undefined) {
          console.error(`    UNDEFINED FIELD DETECTED in dataToSave (just before addDoc): ${key}`);
        }
      }
    }
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
      // When retrieving, we can safely use the potentially missing fields with fallbacks.
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
        visibility: data.visibility || 'private', // Default if not present
        editability: data.editability || 'owner_only', // Default if not present
        viewUserIds: data.viewUserIds || (data.ownerId ? [data.ownerId] : []), // Default if not present
        editUserIds: data.editUserIds || (data.ownerId ? [data.ownerId] : []), // Default if not present
        description: data.description || null, // Default if not present
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
    
    // Use the stored visibility/editability for versioning. If they aren't stored, use a default.
    const currentVisibility = currentPlanData.visibility || 'private';
    const currentEditability = currentPlanData.editability || 'owner_only';

    const canEdit = currentPlanData.ownerId === currentUserId ||
                    (currentEditability === 'collaborators' && (currentPlanData.editUserIds || []).includes(currentUserId));

    if (!canEdit) {
        throw new Error("Permission denied: You do not have rights to edit this plan's roadmap.");
    }
    const currentVersionNumber = currentPlanData.version || 1;

    const newVersionDocRef = doc(versionsCollectionRef);
    const versionData: PlanVersionData = {
      planId: planId,
      roadmap: (currentPlanData.roadmap || []).map(step => sanitizeRoadmapStep(step)),
      editorUid: currentUserId,
      timestamp: serverTimestamp(),
      versionNumber: currentVersionNumber,
      visibility: currentVisibility, // Use potentially defaulted value
      editability: currentEditability, // Use potentially defaulted value
    };
    batch.set(newVersionDocRef, versionData);

    const dataToUpdateMainPlan: Partial<Plan> & {updatedAt: FieldValue, version: FieldValue } = {
      roadmap: updatedRoadmap.map(step => sanitizeRoadmapStep(step)),
      updatedAt: serverTimestamp(),
      version: increment(1),
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
    // Corrected query for Firestore rules that only allow 'public' or 'unlisted' for general listing.
    const q = query(
      plansCollectionRef,
      where('visibility', 'in', ['public', 'unlisted']),
      orderBy('createdAt', 'desc'),
      limit(count)
    );

    const querySnapshot = await getDocs(q);
    const plans: ClientPlan[] = querySnapshot.docs
      .map((docSnap) => {
        const data = docSnap.data() as Plan;
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
          visibility: data.visibility || 'private', // Default if not present
          editability: data.editability || 'owner_only', // Default if not present
          viewUserIds: data.viewUserIds || (data.ownerId ? [data.ownerId] : []), // Default if not present
          editUserIds: data.editUserIds || (data.ownerId ? [data.ownerId] : []), // Default if not present
          description: data.description || null, // Default if not present
        };
      });
    return plans;
  } catch (error: any) {
    console.error("[planService] Error fetching recent plans:", error);
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
      console.error("[planService] Firestore query for recent plans requires a composite index on 'visibility' (IN) and 'createdAt' (desc). Please create it.");
      throw new Error("Firestore query requires an index for recent plans. Please create it.");
    }
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
        visibility: data.visibility || 'private',
        editability: data.editability || 'owner_only',
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

    const newHistoryVersionDocRef = doc(newVersionHistoryCollectionRef);
    const currentSnapshotVersionData: PlanVersionData = {
      planId: planId,
      roadmap: (currentPlanData.roadmap || []).map(step => sanitizeRoadmapStep(step)),
      editorUid: currentUserId,
      timestamp: serverTimestamp(),
      versionNumber: currentPlanVersionNumber,
      visibility: currentPlanData.visibility || 'private',
      editability: currentPlanData.editability || 'owner_only',
    };
    batch.set(newHistoryVersionDocRef, currentSnapshotVersionData);

    const mainPlanUpdateData: Partial<Plan> & {updatedAt: FieldValue, version: FieldValue } = {
      roadmap: (versionToRestoreData.roadmap || []).map(step => sanitizeRoadmapStep(step)),
      updatedAt: serverTimestamp(),
      version: increment(1),
    };

    // Carry over visibility and editability settings from the version being restored
    if (versionToRestoreData.visibility) {
      mainPlanUpdateData.visibility = versionToRestoreData.visibility;
    }
    if (versionToRestoreData.editability) {
      mainPlanUpdateData.editability = versionToRestoreData.editability;
    }
    // Recalculate view/editUserIds based on restored settings & owner
    const restoredVisibility = mainPlanUpdateData.visibility || 'private';
    const restoredEditability = mainPlanUpdateData.editability || 'owner_only';
    
    if (restoredVisibility === 'private' || restoredVisibility === 'unlisted') {
      mainPlanUpdateData.viewUserIds = [currentPlanData.ownerId];
    } else { // public
      mainPlanUpdateData.viewUserIds = []; 
    }
    if (restoredEditability === 'owner_only') {
      mainPlanUpdateData.editUserIds = [currentPlanData.ownerId];
    } else { // collaborators
      // When restoring, we generally keep existing collaborators unless explicitly managed.
      // For simplicity, let's ensure at least the owner is an editor.
      mainPlanUpdateData.editUserIds = Array.from(new Set([currentPlanData.ownerId, ...(currentPlanData.editUserIds || [])]));
    }

    batch.update(planDocRef, mainPlanUpdateData as { [key: string]: any });

    await batch.commit();
  } catch (error: any) {
    console.error(`[planService] Error restoring plan ${planId} to version ${versionIdToRestore}:`, error);
    throw new Error(error.message || "Could not restore plan.");
  }
};
