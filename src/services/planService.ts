
// src/services/planService.ts
import { db, auth } from '@/lib/firebase/config';
import {
  collection,
  addDoc,
  doc,
  getDoc,
  serverTimestamp,
  Timestamp,
  type FieldValue,
} from 'firebase/firestore';
import type { Plan, NewPlanData, ClientPlan } from '@/types/plan';

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

  const dataToSave: Omit<Plan, 'id' | 'createdAt' | 'updatedAt'> & { createdAt: FieldValue, updatedAt: FieldValue } = {
    name: planData.name,
    ownerId: planData.ownerId,
    sector: planData.sector,
    subSector: planData.subSector || null,
    industry: planData.industry || null,
    naicsCode: planData.naicsCode || null,
    createdAt: serverTimestamp() as FieldValue,
    updatedAt: serverTimestamp() as FieldValue,
  };

  console.log("%c[planService] createPlan: FINAL DATA OBJECT being sent to Firestore:", "color: #FF1493; font-weight: bold;", JSON.parse(JSON.stringify(dataToSave))); // Log a serializable version
  console.log("%c[planService] createPlan: KEYS in final data object:", "color: #FF1493; font-weight: bold;", Object.keys(dataToSave).sort().join(', '));
  console.log("%c[planService] createPlan: Compare these keys AND THEIR DATA TYPES meticulously with your Firestore rule for '/plans/{planId}'. The `request.resource.data.keys().hasOnly([...])` list in your rule MUST EXACTLY MATCH these keys. Also check type conditions (e.g., `is string`, `== null`).", "color: #FF1493;");


  try {
    const docRef = await addDoc(plansCollectionRef, dataToSave);
    console.log(`[planService] Plan created successfully with ID: ${docRef.id} by owner ${user.uid}`);
    return docRef.id;
  } catch (error: any) {
    console.error("[planService] Error creating plan:", error);
    if (error.code === 'permission-denied') {
      console.error("Firestore permission denied. Ensure security rules allow 'create' on 'plans/{planId}' collection under these conditions:");
      console.error("  1. User is authenticated (request.auth != null).");
      console.error("  2. Authenticated user's UID matches 'ownerId' in the new plan document (request.auth.uid == request.resource.data.ownerId).");
      console.error("  3. Required fields like 'name', 'sector', 'createdAt', 'updatedAt' are present and correctly typed (e.g., timestamps are request.time).");
      console.error("  4. Optional fields ('subSector', 'industry', 'naicsCode') are either null or string as per your rule checks.");
      console.error("  5. The document being created contains ONLY the expected fields. Check `request.resource.data.keys().hasOnly([...])` in your rule.");
      console.error("     Expected keys based on current client code: name, ownerId, sector, subSector, industry, naicsCode, createdAt, updatedAt");
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
      const data = docSnap.data() as Plan; // Assuming Plan type matches Firestore structure

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
