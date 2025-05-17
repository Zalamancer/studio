
// src/services/whiteboardService.ts
'use server';
import { db } from '@/lib/firebase/config';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import type { Shape } from '@/components/whiteboard/Whiteboard';

const WHITEBOARD_COLLECTION = 'whiteboardAnnotations';

interface WhiteboardDocData {
  naicsCode: string; // This field MUST match the document ID for the original security rule
  shapes: Shape[];
  lastUpdatedAt: Timestamp;
  lastUpdatedBy: string;
}

export const getShapesForNaics = async (naicsCodeParam: string | undefined | null): Promise<Shape[]> => {
  const trimmedNaicsCode = String(naicsCodeParam || "").trim();
  if (!trimmedNaicsCode) {
    console.warn("[Service] getShapesForNaics: called with empty or invalid naicsCode after trim. Original:", naicsCodeParam);
    return [];
  }
  console.log(`[Service] getShapesForNaics: Fetching shapes for NAICS: ${trimmedNaicsCode}`);
  const docRef = doc(db, WHITEBOARD_COLLECTION, trimmedNaicsCode);
  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as WhiteboardDocData;
      console.log(`[Service] getShapesForNaics: Shapes found for ${trimmedNaicsCode}. Count:`, data.shapes?.length || 0);
      // Ensure shapes array exists and is an array, default to empty array if not
      const shapesData = Array.isArray(data.shapes) ? data.shapes : [];
      return shapesData.map(s => ({
        id: typeof s.id === 'string' && s.id ? s.id : `shape-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        type: s.type === 'rectangle' || s.type === 'circle' ? s.type : 'rectangle',
        text: typeof s.text === 'string' ? s.text : "",
        x: typeof s.x === 'number' ? s.x : 0,
        y: typeof s.y === 'number' ? s.y : 0,
        width: typeof s.width === 'number' && s.width > 0 ? s.width : 150,
        height: typeof s.height === 'number' && s.height > 0 ? s.height : 80,
        parentId: (typeof s.parentId === 'string' || s.parentId === null) ? s.parentId : null,
        isFixed: s.isFixed === true, // Ensure boolean
        nodeType: s.nodeType || undefined,
        code: s.code || undefined,
        createdBy: s.createdBy || undefined,
        lastEditedBy: s.lastEditedBy || undefined,
      }));
    }
    console.log(`[Service] getShapesForNaics: No whiteboard document found for ${trimmedNaicsCode}.`);
    return [];
  } catch (error) {
    console.error(`[Service] getShapesForNaics: Error fetching shapes for NAICS ${trimmedNaicsCode}:`, error);
    return [];
  }
};

export const saveShapesForNaics = async (
  naicsCodeParam: string | undefined | null,
  shapesInput: Shape[], // This will be ignored for the test
  userId: string | undefined | null
): Promise<void> => {
  console.log(`[Service] saveShapesForNaics: Initiated for DEBUGGING. Raw naicsCodeParam: "${naicsCodeParam}", Raw userId: "${userId}"`);

  const docIdForWrite = String(naicsCodeParam || "").trim();
  const currentUserId = String(userId || "").trim();

  if (!docIdForWrite) {
    const errMsg = "[Service] saveShapesForNaics (DEBUG): CRITICAL ERROR - Document ID (docIdForWrite from naicsCodeParam) is EMPTY. Aborting save.";
    console.error(errMsg, { originalNaicsCodeParam: naicsCodeParam });
    throw new Error("NAICS Code for whiteboard context is missing or invalid. Cannot save shapes.");
  }
  if (!currentUserId) {
    const errMsg = "[Service] saveShapesForNaics (DEBUG): CRITICAL ERROR - User ID (currentUserId) is EMPTY. Aborting save. User might not be authenticated.";
    console.error(errMsg, { originalUserId: userId });
    throw new Error("User is not authenticated. Cannot save shapes.");
  }

  console.log(`[Service] saveShapesForNaics (DEBUG): Processing save for docId: "${docIdForWrite}", userId: "${currentUserId}"`);

  // --- TEMPORARY SIMPLIFIED DATA FOR DEBUGGING ---
  const testDataToSave = {
    naicsCode: docIdForWrite, // Still include this, critical for original rule, good for consistency
    message: "This is a debug write attempt.",
    testField: `Test write at ${new Date().toISOString()}`,
    shapes: [], // Saving an empty shapes array for this test or a minimal one
    // shapes: [{ id: 'test-shape', type: 'rectangle', text: 'Test', x: 10, y: 10, width: 100, height: 50, parentId: null, isFixed: false, createdBy: currentUserId, lastEditedBy: currentUserId }],
    lastUpdatedAt: serverTimestamp() as Timestamp,
    lastUpdatedBy: currentUserId,
  };
  // --- END OF TEMPORARY SIMPLIFIED DATA ---

  const docRef = doc(db, WHITEBOARD_COLLECTION, docIdForWrite);

  console.log(
    `%c[Service] saveShapesForNaics (DEBUG) - CHECK BEFORE WRITE:`,
    "color: orange; font-weight: bold;",
    {
      documentPath: docRef.path,
      userIdAttemptingWrite: currentUserId,
      dataBeingSent: testDataToSave, // Log the simplified test data
    }
  );

  const rule_docId = docIdForWrite;
  const rule_request_resource_data_naicsCode = testDataToSave.naicsCode; // From our test data
  console.log(
    `%c[Service] saveShapesForNaics (DEBUG) - RULE CHECK VALUES (for original rule):`,
    "color: green; font-weight: bold;",
    {
      docIdForRule: rule_docId,
      typeOfDocIdForRule: typeof rule_docId,
      naicsCodeFieldInResourceData: rule_request_resource_data_naicsCode,
      typeOfNaicsCodeFieldInResourceData: typeof rule_request_resource_data_naicsCode,
      isMatch: rule_docId === rule_request_resource_data_naicsCode,
    }
  );

  try {
    await setDoc(docRef, testDataToSave); // Using the simplified testDataToSave
    console.log(`[Service] saveShapesForNaics (DEBUG): Test write to ${docIdForWrite} SUCCEEDED for user ${currentUserId}.`);
  } catch (error: any) {
    console.error(`[Service] saveShapesForNaics (DEBUG): Test write to ${docIdForWrite} FAILED for user ${currentUserId}. Firestore error details:`, error);
    if (error.code === 'permission-denied' || (error.message && error.message.includes('PERMISSION_DENIED'))) {
      console.error(
        "%c[Service] (DEBUG) Firestore PERMISSION DENIED. With the simplified rule 'allow write: if request.auth != null;', this means 'request.auth' was likely null or there's a higher-level blocking rule.",
        "color: red; font-weight: bold;"
      );
    } else if (error.code === 'invalid-argument') {
      console.error("[Service] (DEBUG) Firestore INVALID ARGUMENT. Data might be malformed. Data being sent:", testDataToSave);
    }
    throw new Error(`Failed to save whiteboard shapes (DEBUG): ${error.message || 'Unknown Firestore error'}`);
  }
};
