
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
  let finalVisibility: PlanVisibility = planData.visibility; // Directly use from planData as NewPlanData type enforces it
  if (!validVisibilities.includes(finalVisibility)) {
    console.warn(`%c[planService] createPlan - WARNING: Incoming planData.visibility ('${planData.visibility}') is invalid despite type enforcement. Defaulting to 'private'. This should not happen if Zod validation passed.`, "color: red; font-weight:bold;");
    finalVisibility = 'private';
  }

  const validEditabilities: PlanEditability[] = ['owner_only', 'collaborators'];
  let finalEditability: PlanEditability = planData.editability; // Directly use from planData
  if (!validEditabilities.includes(finalEditability)) {
    console.warn(`%c[planService] createPlan - WARNING: Incoming planData.editability ('${planData.editability}') is invalid despite type enforcement. Defaulting to 'owner_only'. This should not happen if Zod validation passed.`, "color: red; font-weight:bold;");
    finalEditability = 'owner_only';
  }

  console.log(`%c[planService] createPlan - Determined finalVisibility: '${finalVisibility}'`, "color: #FFD700; font-weight:bold;");
  console.log(`%c[planService] createPlan - Determined finalEditability: '${finalEditability}'`, "color: #FFD700; font-weight:bold;");

  let viewUserIds: string[] = [];
  if (finalVisibility === 'private' || finalVisibility === 'unlisted') {
    viewUserIds = [planData.ownerId];
  } // For 'public', viewUserIds will be empty by default, access controlled by rules.

  let editUserIds: string[] = [];
  if (finalEditability === 'owner_only') {
    editUserIds = [planData.ownerId];
  } else if (finalEditability === 'collaborators') {
    editUserIds = [planData.ownerId]; // Owner is always an editor
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
      console.error(`    - Ensure 'request.resource.data.createdAt == request.time' (if rule uses this). Data createdAt: serverTimestamp()`);
      console.error(`    - Ensure 'request.resource.data.updatedAt == request.time' (if rule uses this). Data updatedAt: serverTimestamp()`);
      console.error(`    - Ensure 'request.resource.data.version == 1' (if rule uses this). Data version: ${dataToSave.version}`);
      console.error(`    - Ensure 'request.resource.data.visibility' is string and one of ['private', 'unlisted', 'public']. Data visibility: '${dataToSave.visibility}' (type: ${typeof dataToSave.visibility})`);
      console.error(`    - Ensure 'request.resource.data.editability' is string and one of ['owner_only', 'collaborators']. Data editability: '${dataToSave.editability}' (type: ${typeof dataToSave.editability})`);
      console.error(`    - Ensure 'request.resource.data.viewUserIds is list' and 'request.auth.uid in request.resource.data.viewUserIds' (unless public). Data viewUserIds: [${dataToSave.viewUserIds?.join(', ')}]`);
      console.error(`    - Ensure 'request.resource.data.editUserIds is list' and 'request.auth.uid in request.resource.data.editUserIds'. Data editUserIds: [${dataToSave.editUserIds?.join(', ')}]`);
      console.error("    - Ensure all required fields by your rules are present (e.g., name, sector) and no disallowed fields are being written (check against your hasAll() and size() rules).");
      console.error("    - The 'plans' collection path is correct and rules are applied to it.");

      if (error.message && error.message.toLowerCase().includes("undefined")) {
        console.error("    [DEBUG] Checking finalPayloadForFirestore for undefined values due to error message:");
        for (const key in dataToSave) {
          if (dataToSave[key as keyof typeof dataToSave] === undefined) {
            console.error(`      UNDEFINED FIELD DETECTED in dataToSave: ${key}`);
          }
        }
      }
      throw new Error('Permission denied. Check Firestore security rules and console logs for details.');
    }
    if (error.message && error.message.includes("Unsupported field value: undefined")) {
      console.error("  [planService] Firestore received an undefined field value. Data attempted (stringified):", JSON.stringify(dataToSave, null, 2));
       console.error("  [planService] Data attempted (raw, check for FieldValue objects):", dataToSave);
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
      visibility: currentVisibility, 
      editability: currentEditability, 
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
    const fetchLimit = Math.min(50, Math.max(10, count * 3)); // Fetch more to filter client-side, cap at 50, min 10
    console.log(`%c[planService] getRecentPlans: Fetching up to ${fetchLimit} recent plans (ordered by createdAt desc) for client-side visibility filtering.`, "color: dodgerblue;");

    const q = query(
      plansCollectionRef,
      orderBy('createdAt', 'desc'),
      limit(fetchLimit)
    );

    const querySnapshot = await getDocs(q);
    console.log(`%c[planService] getRecentPlans: Firestore query executed. Fetched ${querySnapshot.docs.length} documents.`, "color: dodgerblue;");

    const allFetchedPlans: ClientPlan[] = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data() as Plan;
      return {
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
    });
    
    console.log(`%c[planService] getRecentPlans: Plans fetched from Firestore (before client filter): ${allFetchedPlans.length}`, "color: dodgerblue;");
    allFetchedPlans.forEach(p => console.log(`  - Plan ID: ${p.id}, Original Visibility in DB: ${p.visibility}`));

    const discoverablePlans = allFetchedPlans.filter(
      plan => plan.visibility === 'public' || plan.visibility === 'unlisted'
    );

    console.log(`%c[planService] getRecentPlans: Plans after client-side visibility filter ('public' or 'unlisted'): ${discoverablePlans.length}`, "color: green;");
    
    return discoverablePlans.slice(0, count);

  } catch (error: any) {
    console.error("[planService] Error fetching recent plans:", error);
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
      console.error("[planService] Firestore query for recent plans (orderBy createdAt) requires an index if not using simple equality. Ensure 'createdAt' (desc) index exists for 'plans' collection.");
    }
    return [];
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
      visibility: versionToRestoreData.visibility || 'private',
      editability: versionToRestoreData.editability || 'owner_only',
    };
    
    const restoredVisibility = mainPlanUpdateData.visibility;
    const restoredEditability = mainPlanUpdateData.editability;
    
    if (restoredVisibility === 'private' || restoredVisibility === 'unlisted') {
      mainPlanUpdateData.viewUserIds = [currentPlanData.ownerId];
    } else { 
      mainPlanUpdateData.viewUserIds = []; 
    }
    if (restoredEditability === 'owner_only') {
      mainPlanUpdateData.editUserIds = [currentPlanData.ownerId];
    } else { 
      mainPlanUpdateData.editUserIds = Array.from(new Set([currentPlanData.ownerId, ...(currentPlanData.editUserIds || [])]));
    }

    batch.update(planDocRef, mainPlanUpdateData as { [key: string]: any });

    await batch.commit();
  } catch (error: any) {
    console.error(`[planService] Error restoring plan ${planId} to version ${versionIdToRestore}:`, error);
    throw new Error(error.message || "Could not restore plan.");
  }
};
