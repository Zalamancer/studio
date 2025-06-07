
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
} from 'firebase/firestore';
import type { Plan, NewPlanData, ClientPlan, RoadmapStep, RoadmapSubStep, UpdatePlanRoadmapData, IncomingConnection } from '@/types/plan';

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

  const dataToSave: Omit<Plan, 'id' | 'createdAt' | 'updatedAt' | 'roadmap'> & { createdAt: FieldValue, updatedAt: FieldValue, roadmap?: RoadmapStep[] } = {
    name: planData.name,
    ownerId: planData.ownerId,
    sector: planData.sector,
    subSector: planData.subSector || null,
    industry: planData.industry || null,
    naicsCode: planData.naicsCode || null,
    createdAt: serverTimestamp() as FieldValue,
    updatedAt: serverTimestamp() as FieldValue,
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
            label: (typeof conn.label === 'string' && conn.label.trim() !== "") ? conn.label.trim() : null, // Changed undefined to null
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
            label: conn.label || undefined, // This is fine for client side, as undefined means no label
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

export const updatePlanRoadmap = async (planId: string, ownerId: string, updatedRoadmap: RoadmapStep[]): Promise<void> => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User not authenticated. Cannot update plan.");
  }
  if (user.uid !== ownerId) {
    throw new Error("Authenticated user does not match plan ownerId. Cannot update.");
  }
  if (!planId) {
    throw new Error("Plan ID is required to update roadmap.");
  }

  console.log(`[planService] updatePlanRoadmap: Updating roadmap for plan ID: ${planId} by owner ${ownerId}`);
  
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
          label: (typeof conn.label === 'string' && conn.label.trim() !== "") ? conn.label.trim() : null, // Changed undefined to null
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

    const finalStep: RoadmapStep = {
      id: typeof step.id === 'string' && step.id.trim() !== '' ? step.id : `step_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: typeof step.title === 'string' ? step.title : "",
      x: typeof step.x === 'number' ? step.x : 0,
      y: typeof step.y === 'number' ? step.y : 0,
      description: (typeof step.description === 'string' && step.description.trim() !== '') ? step.description.trim() : null,
      subSteps: sanitizedSubSteps,
      incomingConnections: sanitizedConnections,
    };
    
    return finalStep;
  });

  const dataToUpdate: UpdatePlanRoadmapData = {
    roadmap: sanitizedRoadmap,
    updatedAt: serverTimestamp() as FieldValue,
  };

  const planDocRef = doc(plansCollectionRef, planId);

  try {
    await updateDoc(planDocRef, dataToUpdate);
    console.log(`[planService] Roadmap for plan ${planId} updated successfully.`);
  } catch (error: any) {
    console.error(`[planService] Error updating roadmap for plan ${planId}:`, error);
    if (error.code === 'permission-denied') {
      console.error("Firestore permission denied. Ensure security rules allow 'update' on 'plans/{planId}' for the owner, and that 'roadmap' and 'updatedAt' are allowed fields.");
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
            label: conn.label || undefined, // Fine for client, will be null for DB if empty
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
    