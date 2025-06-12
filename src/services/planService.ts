
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
  console.log(`%c[planService] createPlan - RAW planData.visibility: '${planData.visibility}' (type: ${typeof planData.visibility})`, "color: #FF4500;");
  console.log(`%c[planService] createPlan - RAW planData.editability: '${planData.editability}' (type: ${typeof planData.editability})`, "color: #FF4500;");


  const validVisibilities: PlanVisibility[] = ['private', 'unlisted', 'public'];
  let finalVisibility: PlanVisibility = planData.visibility;
  if (!validVisibilities.includes(finalVisibility)) {
    console.warn(`%c[planService] createPlan - WARNING: Incoming planData.visibility ('${planData.visibility}') is invalid despite type enforcement. Defaulting to 'private'. This should not happen if Zod validation passed.`, "color: red; font-weight:bold;");
    finalVisibility = 'private';
  }

  const validEditabilities: PlanEditability[] = ['owner_only', 'collaborators'];
  let finalEditability: PlanEditability = planData.editability;
  if (!validEditabilities.includes(finalEditability)) {
    console.warn(`%c[planService] createPlan - WARNING: Incoming planData.editability ('${planData.editability}') is invalid despite type enforcement. Defaulting to 'owner_only'. This should not happen if Zod validation passed.`, "color: red; font-weight:bold;");
    finalEditability = 'owner_only';
  }

  console.log(`%c[planService] createPlan - Determined finalVisibility: '${finalVisibility}'`, "color: #FFD700; font-weight:bold;");
  console.log(`%c[planService] createPlan - Determined finalEditability: '${finalEditability}'`, "color: #FFD700; font-weight:bold;");

  let viewUserIds: string[] = [];
  if (finalVisibility === 'public') {
    viewUserIds = []; // Public means everyone can view, so no specific UIDs needed for view access control here
  } else { // 'private' or 'unlisted'
    viewUserIds = [planData.ownerId]; // Default to owner only for private/unlisted
  }

  let editUserIds: string[] = [];
  if (finalEditability === 'owner_only') {
    editUserIds = [planData.ownerId];
  } else if (finalEditability === 'collaborators') {
    editUserIds = [planData.ownerId]; // Owner is always an editor, others can be added later
  }
  console.log(`%c[planService] createPlan - Determined viewUserIds: [${viewUserIds.join(', ')}]`, "color: #FFD700;");
  console.log(`%c[planService] createPlan - Determined editUserIds: [${editUserIds.join(', ')}]`, "color: #FFD700;");


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
  
  const fieldCount = Object.keys(dataToSave).length;
  console.log(`%c[planService] createPlan - finalPayloadForFirestore (Expected fields for rule: 15). Actual count: ${fieldCount}`, "color: fuchsia;", JSON.parse(JSON.stringify(dataToSave, (key, value) => (value as any)?._methodName?.includes('serverTimestamp') ? 'FieldValue.serverTimestamp()' : value, 2)));
  console.log(`  finalPayloadForFirestore.visibility type: ${typeof dataToSave.visibility}, value: ${dataToSave.visibility}`);
  console.log(`  finalPayloadForFirestore.editability type: ${typeof dataToSave.editability}, value: ${dataToSave.editability}`);

  try {
    const docRef = await addDoc(plansCollectionRef, dataToSave);
    console.log(`%c[planService] Plan CREATED successfully with ID: ${docRef.id}`, "color: green; font-weight:bold;");
    return docRef.id;
  } catch (error: any) {
    console.error(`%c[planService] createPlan - Firestore addDoc ERROR. Data attempted:`, "color: red; font-weight:bold;", JSON.parse(JSON.stringify(dataToSave, (key, value) => (value as any)?._methodName?.includes('serverTimestamp') ? 'FieldValue.serverTimestamp()' : value, 2)));
    console.error(`  Error Code: ${error.code}, Message: ${error.message}`);
    if (error.code === 'permission-denied') {
      console.error("%c  [planService] PERMISSION DENIED. Check Firestore security rules for creating documents in the 'plans' collection. Common checks include:", "color: red; font-weight:bold;")
      console.error(`    - Ensure 'request.auth.uid' is not null (user is authenticated). Current auth UID: '${auth.currentUser?.uid || 'NULL'}'`);
      console.error(`    - Ensure 'request.resource.data.ownerId == request.auth.uid'. Data ownerId: '${dataToSave.ownerId}', Auth UID: '${auth.currentUser?.uid || 'NULL'}'`);
      console.error(`    - Ensure 'request.resource.data.createdAt == request.time' (if rule uses this).`);
      console.error(`    - Ensure 'request.resource.data.updatedAt == request.time' (if rule uses this).`);
      console.error(`    - Ensure 'request.resource.data.version == 1' (if rule uses this). Data version: ${dataToSave.version}`);
      console.error(`    - Ensure 'request.resource.data.visibility' is one of ['private', 'unlisted', 'public']. Data visibility: '${dataToSave.visibility}' (type: ${typeof dataToSave.visibility})`);
      console.error(`    - Ensure 'request.resource.data.editability' is one of ['owner_only', 'collaborators']. Data editability: '${dataToSave.editability}' (type: ${typeof dataToSave.editability})`);
      console.error(`    - Ensure 'request.auth.uid in request.resource.data.viewUserIds' (if not public). Data viewUserIds: [${dataToSave.viewUserIds?.join(', ')}]`);
      console.error(`    - Ensure 'request.auth.uid in request.resource.data.editUserIds'. Data editUserIds: [${dataToSave.editUserIds?.join(', ')}]`);
      console.error("    - Ensure all required fields by your rules are present (e.g., 15 fields if rules expect all new ones) and no disallowed fields are being written (check against your hasAll() and size() rules).");
      console.error("    - The 'plans' collection path is correct and rules are applied to it.");
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
        visibility: data.visibility || 'private', // Default if missing
        editability: data.editability || 'owner_only', // Default if missing
        viewUserIds: data.viewUserIds || (data.ownerId ? [data.ownerId] : []), // Default if missing
        editUserIds: data.editUserIds || (data.ownerId ? [data.ownerId] : []), // Default if missing
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
    
    const currentEditability = currentPlanData.editability || 'owner_only';

    const canEdit = currentPlanData.ownerId === currentUserId ||
                    (currentEditability === 'collaborators' && (currentPlanData.editUserIds || []).includes(currentUserId));

    if (!canEdit) {
        throw new Error("Permission denied: You do not have rights to edit this plan's roadmap.");
    }
    const currentVersionNumber = currentPlanData.version || 1;

    const newVersionDocRef = doc(versionsCollectionRef);
    // PlanVersionData now only includes the 5 fields allowed by the security rule
    const versionData: PlanVersionData = {
      planId: planId,
      roadmap: (currentPlanData.roadmap || []).map(step => sanitizeRoadmapStep(step)), // Save current state before update
      editorUid: currentUserId,
      timestamp: serverTimestamp(),
      versionNumber: currentVersionNumber,
    };
    batch.set(newVersionDocRef, versionData);

    const dataToUpdateMainPlan: { roadmap: RoadmapStep[]; updatedAt: FieldValue; version: FieldValue } = {
      roadmap: updatedRoadmap.map(step => sanitizeRoadmapStep(step)),
      updatedAt: serverTimestamp(),
      version: increment(1),
    };
    batch.update(planDocRef, dataToUpdateMainPlan);

    await batch.commit();
    console.log(`[planService] Roadmap updated successfully for plan ${planId} by user ${currentUserId}. New version: ${currentVersionNumber + 1}`);
  } catch (error: any) {
    console.error(`[planService] Error updating roadmap for plan ${planId}:`, error);
    throw new Error(error.message || "Could not update plan roadmap.");
  }
};

export const getRecentPlans = async (count = 6): Promise<ClientPlan[]> => {
  try {
    console.log(`%c[planService] getRecentPlans: Fetching up to ${count} recent plans, server-side filtering by visibility.`, "color: dodgerblue;");

    const q = query(
      plansCollectionRef,
      where('visibility', 'in', ['public', 'unlisted']),
      orderBy('createdAt', 'desc'),
      limit(count)
    );

    const querySnapshot = await getDocs(q);
    console.log(`%c[planService] getRecentPlans: Firestore query executed. Fetched ${querySnapshot.docs.length} documents.`, "color: dodgerblue;");

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
        visibility: data.visibility || 'private', // Default if missing
        editability: data.editability || 'owner_only', // Default if missing
        viewUserIds: data.viewUserIds || (data.ownerId ? [data.ownerId] : []), // Default if missing
        editUserIds: data.editUserIds || (data.ownerId ? [data.ownerId] : []), // Default if missing
      };
      console.log(`  - Plan ID: ${clientPlan.id}, Visibility from DB: ${data.visibility}, Mapped Visibility: ${clientPlan.visibility}`);
      return clientPlan;
    });
    
    console.log(`%c[planService] getRecentPlans: Plans after mapping: ${plans.length}`, "color: green;");
    
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
      const data = docSnap.data() as PlanVersionData & { timestamp: Timestamp }; // PlanVersionData no longer has vis/edit
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
        // visibility and editability are no longer expected from the version document directly
        // They could be fetched from the main plan document at that version's timestamp if needed,
        // but that's more complex and not implemented here. ClientPlanVersion makes them optional.
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
    // Cast to any to read potentially existing vis/edit fields from old version docs, but don't rely on PlanVersionData type having them
    const versionToRestoreData = versionToRestoreSnap.data() as any; 

    if (currentPlanData.ownerId !== currentUserId) {
        throw new Error("Permission denied: Only the plan owner can restore versions.");
    }
    const currentPlanVersionNumber = currentPlanData.version || 1;

    // Create a snapshot of the current state before overwriting
    const newHistoryVersionDocRef = doc(newVersionHistoryCollectionRef);
    const currentSnapshotVersionData: PlanVersionData = { // Conforms to the 5-field rule
      planId: planId,
      roadmap: (currentPlanData.roadmap || []).map(step => sanitizeRoadmapStep(step)),
      editorUid: currentUserId,
      timestamp: serverTimestamp(),
      versionNumber: currentPlanVersionNumber,
    };
    batch.set(newHistoryVersionDocRef, currentSnapshotVersionData);

    // Prepare data for updating the main plan document
    const mainPlanUpdateData: Partial<Plan> & {updatedAt: FieldValue, version: FieldValue } = {
      roadmap: (versionToRestoreData.roadmap || []).map(step => sanitizeRoadmapStep(step)),
      updatedAt: serverTimestamp(),
      version: increment(1),
    };
    
    // Restore visibility and editability IF THEY EXIST on the version document being restored
    // AND if the rules allow updating them. Your current update rule for /plans/{planId}
    // is very restrictive: hasOnly(['roadmap', 'updatedAt', 'version'])
    // So, for now, we CANNOT restore visibility/editability settings via this function
    // unless the rules are changed. If they *were* allowed, it would be:
    // if (versionToRestoreData.visibility) mainPlanUpdateData.visibility = versionToRestoreData.visibility;
    // if (versionToRestoreData.editability) mainPlanUpdateData.editability = versionToRestoreData.editability;
    // And viewUserIds/editUserIds would need recalculation based on restored vis/edit.

    // To comply with existing strict update rules, we ONLY update roadmap, updatedAt, version.
    // This means a restore operation will NOT change visibility/editability settings currently.
    
    batch.update(planDocRef, mainPlanUpdateData as { [key: string]: any });

    await batch.commit();
    console.log(`[planService] Plan ${planId} restored to version ${versionIdToRestore} by user ${currentUserId}. New current version: ${currentPlanVersionNumber + 1}. Note: Visibility/editability settings were NOT restored due to current security rules.`);
  } catch (error: any) {
    console.error(`[planService] Error restoring plan ${planId} to version ${versionIdToRestore}:`, error);
    throw new Error(error.message || "Could not restore plan.");
  }
};

