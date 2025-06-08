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
  writeBatch, // Import writeBatch
  increment, // Import increment
} from 'firebase/firestore';
import type { Plan, NewPlanData, ClientPlan, RoadmapStep, UpdatePlanRoadmapData, PlanVersionData, ClientPlanVersion, IncomingConnection } from '@/types/plan'; // Added PlanVersionData, ClientPlanVersion
import { fetchUserProfileBasic } from './connectionService'; // For fetching editor display name

const PLANS_COLLECTION = 'plans';
const plansCollectionRef = collection(db, PLANS_COLLECTION);

export const createPlan = async (planData: NewPlanData): Promise<string> => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User not authenticated. Cannot create plan.");
  }
  if (user.uid !== planData.ownerId) {
    throw new Error("Authenticated user does not match plan ownerId.");
  }

  console.log(`[planService] createPlan: Called by UID ${user.uid} with data:`, JSON.stringify(planData, null, 2));

  const dataToSave: Omit<Plan, 'id' | 'createdAt' | 'updatedAt' | 'roadmap' | 'version'> & { createdAt: FieldValue, updatedAt: FieldValue, roadmap?: RoadmapStep[], version: number } = {
    name: planData.name,
    ownerId: planData.ownerId,
    sector: planData.sector,
    subSector: planData.subSector || null,
    industry: planData.industry || null,
    naicsCode: planData.naicsCode || null,
    createdAt: serverTimestamp() as FieldValue,
    updatedAt: serverTimestamp() as FieldValue,
    version: 1, // Initial version
    roadmap: (planData.roadmap || []).map(step => {
      const sanitizedSubSteps = (step.subSteps || []).map(sub => ({
        id: typeof sub.id === 'string' && sub.id.trim() !== '' ? sub.id : `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        parentId: typeof sub.parentId === 'string' && sub.parentId.trim() !== '' ? sub.parentId : (step.id || ""),
        title: typeof sub.title === 'string' ? sub.title : "",
      }));
      const sanitizedConnections = (step.incomingConnections || []).map(conn => {
        const finalConnection: IncomingConnection = {
            id: typeof conn.id === 'string' && conn.id.trim() !== '' ? conn.id : `conn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            sourceNodeId: typeof conn.sourceNodeId === 'string' ? conn.sourceNodeId : "",
            targetAnchor: conn.targetAnchor || 'N',
            lineType: conn.lineType || 'straight',
            label: (typeof conn.label === 'string' && conn.label.trim() !== "") ? conn.label.trim() : null,
        };
        if (conn.originatingSubStepContext && conn.originatingSubStepContext.sourceCardId && conn.originatingSubStepContext.subStepId) {
            finalConnection.originatingSubStepContext = {
                sourceCardId: conn.originatingSubStepContext.sourceCardId,
                subStepId: conn.originatingSubStepContext.subStepId,
            };
        } else {
            finalConnection.originatingSubStepContext = null;
        }
        return finalConnection;
      }).filter(conn => conn.sourceNodeId.trim() !== "");

      return {
        id: typeof step.id === 'string' && step.id.trim() !== '' ? step.id : `step_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        title: typeof step.title === 'string' ? step.title : "",
        x: typeof step.x === 'number' ? step.x : 0,
        y: typeof step.y === 'number' ? step.y : 0,
        description: (typeof step.description === 'string' && step.description.trim() !== '') ? step.description.trim() : null,
        subSteps: sanitizedSubSteps,
        incomingConnections: sanitizedConnections,
      };
    }),
  };

  console.log("%c[planService] createPlan: FINAL DATA OBJECT being sent to Firestore:", "color: #FF1493; font-weight: bold;", JSON.parse(JSON.stringify(dataToSave)));

  try {
    const docRef = await addDoc(plansCollectionRef, dataToSave);
    console.log(`[planService] Plan created successfully with ID: ${docRef.id} by owner ${user.uid}`);
    return docRef.id;
  } catch (error: any) {
    console.error("[planService] Error creating plan:", error);
    if (error.code === 'permission-denied') {
      console.error("Firestore permission denied. Ensure security rules allow 'create' on 'plans/{planId}' collection under these conditions:");
      throw new Error('Permission denied creating plan. Check Firestore security rules and console logs for details of data sent vs. rules expected.');
    }
    throw new Error(error.message || "Could not create plan.");
  }
};

export const getPlanById = async (planId: string): Promise<ClientPlan | null> => {
  if (!planId) {
    console.warn("[planService] getPlanById: No planId provided.");
    return null;
  }
  const user = auth.currentUser;

  console.log(`[planService] getPlanById: Fetching plan with ID: '${planId}'. Current auth UID: '${user?.uid || 'NULL'}'`);
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
        roadmap: (data.roadmap || []).map(step => ({
          ...step,
          description: step.description || null,
          subSteps: (step.subSteps || []).map(sub => ({
            ...sub,
            title: sub.title || "",
          })),
          incomingConnections: (step.incomingConnections || []).map(conn => ({
            ...conn,
            id: conn.id || `conn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            sourceNodeId: conn.sourceNodeId || '',
            targetAnchor: conn.targetAnchor || 'N',
            lineType: conn.lineType || 'straight',
            label: conn.label || null, // Ensure null for empty labels
            originatingSubStepContext: conn.originatingSubStepContext || null,
          })),
        })),
      };
      console.log(`[planService] Plan ${planId} fetched successfully.`);
      return clientPlan;
    }
    console.warn(`[planService] No plan found with ID ${planId}.`);
    return null;
  } catch (error: any) {
    console.error(`[planService] Error fetching plan ${planId}:`, error);
    if (error.code === 'permission-denied') {
      console.error("Ensure Firestore rules allow 'get' on `/plans/{planId}` if `request.auth.uid == resource.data.ownerId` (or other conditions for shared plans).");
      throw new Error('Permission denied fetching plan. Check Firestore rules.');
    }
    throw new Error(error.message || "Could not fetch plan.");
  }
};

export const updatePlanRoadmap = async (planId: string, currentUserId: string, updatedRoadmap: RoadmapStep[]): Promise<void> => {
  const user = auth.currentUser;
  // IMPORTANT: This check is changed to allow any authenticated user to save.
  // Ensure your Firestore security rules for `plans/{planId}` `update` operation
  // are changed from `request.auth.uid == resource.data.ownerId` to `request.auth != null` (plus other field validations).
  if (!user) {
    throw new Error("User not authenticated. Cannot update plan.");
  }
  // The currentUserId param is now used for `editorUid` in the version history.
  // The check against ownerId for permission to save is removed here, relying on security rules.

  if (!planId) {
    throw new Error("Plan ID is required to update roadmap.");
  }

  console.log(`[planService] updatePlanRoadmap: Updating roadmap for plan ID: ${planId} by user ${currentUserId}`);

  const planDocRef = doc(plansCollectionRef, planId);
  const versionsCollectionRef = collection(db, PLANS_COLLECTION, planId, 'versions');

  try {
    const batch = writeBatch(db);

    // 1. Get current plan to save its roadmap as a version
    const currentPlanSnap = await getDoc(planDocRef);
    if (!currentPlanSnap.exists()) {
      throw new Error(`Plan with ID ${planId} not found.`);
    }
    const currentPlanData = currentPlanSnap.data() as Plan;
    const currentVersionNumber = currentPlanData.version || 1;

    // 2. Create new version document
    const newVersionDocRef = doc(versionsCollectionRef); // Auto-generate ID
    const versionData: PlanVersionData = {
      planId: planId,
      roadmap: currentPlanData.roadmap || [], // Save the roadmap *before* this update
      editorUid: currentUserId,
      timestamp: serverTimestamp() as FieldValue,
      versionNumber: currentVersionNumber, // Store the version number this history entry represents
    };
    batch.set(newVersionDocRef, versionData);
    console.log(`[planService] Version (v${currentVersionNumber}) of plan ${planId} prepared for saving by user ${currentUserId}.`);

    // 3. Sanitize and prepare the new roadmap for the main plan document
    const sanitizedRoadmap = updatedRoadmap.map(step => {
      const sanitizedSubSteps = (step.subSteps || []).map(subStep => ({
        id: typeof subStep.id === 'string' && subStep.id.trim() !== '' ? subStep.id : `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        parentId: typeof subStep.parentId === 'string' && subStep.parentId.trim() !== '' ? subStep.parentId : (step.id || ""),
        title: typeof subStep.title === 'string' ? subStep.title : "",
      }));
      const sanitizedConnections = (step.incomingConnections || []).map(conn => {
        const finalConnection: IncomingConnection = {
            id: typeof conn.id === 'string' && conn.id.trim() !== '' ? conn.id : `conn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            sourceNodeId: typeof conn.sourceNodeId === 'string' ? conn.sourceNodeId : "",
            targetAnchor: conn.targetAnchor || 'N',
            lineType: conn.lineType || 'straight',
            label: (typeof conn.label === 'string' && conn.label.trim() !== "") ? conn.label.trim() : null,
        };
        if (conn.originatingSubStepContext && conn.originatingSubStepContext.sourceCardId && conn.originatingSubStepContext.subStepId) {
            finalConnection.originatingSubStepContext = {
                sourceCardId: conn.originatingSubStepContext.sourceCardId,
                subStepId: conn.originatingSubStepContext.subStepId,
            };
        } else {
            finalConnection.originatingSubStepContext = null;
        }
        return finalConnection;
      }).filter(conn => conn.sourceNodeId.trim() !== "");

      return {
        id: typeof step.id === 'string' && step.id.trim() !== '' ? step.id : `step_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        title: typeof step.title === 'string' ? step.title : "",
        x: typeof step.x === 'number' ? step.x : 0,
        y: typeof step.y === 'number' ? step.y : 0,
        description: (typeof step.description === 'string' && step.description.trim() !== '') ? step.description.trim() : null,
        subSteps: sanitizedSubSteps,
        incomingConnections: sanitizedConnections,
      };
    });

    // 4. Update the main plan document with the new roadmap and incremented version
    const dataToUpdateMainPlan: UpdatePlanRoadmapData = {
      roadmap: sanitizedRoadmap,
      updatedAt: serverTimestamp() as FieldValue,
      version: increment(1) as FieldValue, // Increment version number
    };
    batch.update(planDocRef, dataToUpdateMainPlan);
    console.log(`[planService] Main plan ${planId} prepared for update to new version (v${currentVersionNumber + 1}).`);

    // Commit the batch
    await batch.commit();
    console.log(`[planService] Roadmap for plan ${planId} and its version history updated successfully.`);

  } catch (error: any) {
    console.error(`[planService] Error updating roadmap for plan ${planId}:`, error);
    if (error.code === 'permission-denied') {
      console.error("Firestore permission denied. Ensure security rules allow 'update' on 'plans/{planId}' for any authenticated user, and 'create' on 'plans/{planId}/versions/{versionId}'.");
      throw new Error('Permission denied updating plan roadmap. Check Firestore rules.');
    }
    throw new Error(error.message || "Could not update plan roadmap.");
  }
};


export const getRecentPlans = async (count = 6): Promise<ClientPlan[]> => {
  console.log(`[planService] getRecentPlans: Fetching ${count} recent plans.`);
  try {
    const q = query(
      plansCollectionRef,
      orderBy('createdAt', 'desc'),
      limit(count)
    );
    const querySnapshot = await getDocs(q);
    const plans: ClientPlan[] = querySnapshot.docs.map((docSnap) => {
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
        roadmap: (data.roadmap || []).map(step => ({
          ...step,
          description: step.description || null,
          subSteps: (step.subSteps || []).map(sub => ({ ...sub, title: sub.title || "" })),
           incomingConnections: (step.incomingConnections || []).map(conn => ({
            ...conn,
            id: conn.id || `conn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            sourceNodeId: conn.sourceNodeId || '',
            targetAnchor: conn.targetAnchor || 'N',
            lineType: conn.lineType || 'straight',
            label: conn.label || null, // Ensure null for empty
            originatingSubStepContext: conn.originatingSubStepContext || null,
          })),
        })),
      };
    });
    console.log(`[planService] Fetched ${plans.length} recent plans.`);
    return plans;
  } catch (error: any) {
    console.error("[planService] Error fetching recent plans:", error);
    if (error.code === 'permission-denied') {
      console.error("Firestore permission denied fetching recent plans. Check rules for listing 'plans'.");
      throw new Error('Permission denied fetching recent plans. Check Firestore rules.');
    }
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
      console.error("Firestore query for recent plans requires an index on 'createdAt' (desc). Please create it in the Firebase console for the 'plans' collection.");
      throw new Error("Firestore query requires an index for recent plans. Please create it.");
    }
    throw new Error(`Failed to fetch recent plans: ${error.message || 'Unknown error'}`);
  }
};

// New function to fetch plan versions
export const getPlanVersions = async (planId: string): Promise<ClientPlanVersion[]> => {
  if (!planId) {
    console.warn("[planService] getPlanVersions: No planId provided.");
    return [];
  }
  console.log(`[planService] getPlanVersions: Fetching versions for plan ID: '${planId}'`);
  const versionsRef = collection(db, PLANS_COLLECTION, planId, 'versions');
  try {
    const q = query(versionsRef, orderBy('timestamp', 'desc'), limit(50));
    const querySnapshot = await getDocs(q);
    const versionsPromises = querySnapshot.docs.map(async (docSnap) => {
      const data = docSnap.data() as PlanVersionData & { timestamp: Timestamp }; // Add Timestamp type for data.timestamp
      let editorDisplayName = data.editorUid; // Default to UID
      if (data.editorUid) {
        const profile = await fetchUserProfileBasic(data.editorUid);
        editorDisplayName = profile?.displayName || data.editorUid; // Use fetched name or fallback to UID
      }
      return {
        id: docSnap.id,
        planId: data.planId,
        roadmap: data.roadmap || [],
        editorUid: data.editorUid,
        editorDisplayName: editorDisplayName,
        timestamp: data.timestamp.toMillis(), // Convert Firestore Timestamp to number
        versionNumber: data.versionNumber,
      } as ClientPlanVersion;
    });
    const versions = await Promise.all(versionsPromises);
    console.log(`[planService] Fetched ${versions.length} versions for plan ${planId}.`);
    return versions;
  } catch (error: any) {
    console.error(`[planService] Error fetching versions for plan ${planId}:`, error);
    if (error.code === 'permission-denied') {
      throw new Error('Permission denied fetching plan versions. Check Firestore rules.');
    }
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
      throw new Error("Firestore query requires an index for plan versions. Please create it (e.g., on 'timestamp' desc).");
    }
    throw new Error(error.message || "Could not fetch plan versions.");
  }
};
