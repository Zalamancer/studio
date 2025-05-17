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

// Firestore Security Rules for /whiteboardAnnotations/{naicsCodeDocId}:
// match /whiteboardAnnotations/{naicsCodeDocId} { // naicsCodeDocId is the wildcard for the document ID
//   allow read: if request.auth != null;
//   // User must be authenticated, and the 'naicsCode' field
//   // *within the document's data* must match the document's ID.
//   allow write: if request.auth != null
//                && request.resource.data.naicsCode == naicsCodeDocId;
// }

interface WhiteboardDocData {
  naicsCode: string; // This field MUST match the document ID for the write rule to pass
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
      return (data.shapes || []).map(s => ({
        id: s.id || `shape-${Math.random().toString(36).substr(2, 9)}`,
        type: s.type === 'rectangle' || s.type === 'circle' ? s.type : 'rectangle',
        text: typeof s.text === 'string' ? s.text : "",
        x: typeof s.x === 'number' ? s.x : 0,
        y: typeof s.y === 'number' ? s.y : 0,
        width: typeof s.width === 'number' ? s.width : 150,
        height: typeof s.height === 'number' ? s.height : 80,
        parentId: (typeof s.parentId === 'string' || s.parentId === null) ? s.parentId : null,
        isFixed: s.isFixed === true, // Ensure boolean
        nodeType: s.nodeType || undefined, // Ensure it's one of the allowed types or undefined
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
  shapesInput: Shape[],
  userId: string | undefined | null
): Promise<void> => {
  console.log(`[Service] saveShapesForNaics: Initiated. Raw naicsCodeParam: "${naicsCodeParam}", Raw userId: "${userId}"`);

  const docIdForWrite = String(naicsCodeParam || "").trim();
  const currentUserId = String(userId || "").trim();

  if (!docIdForWrite) {
    const errMsg = "[Service] saveShapesForNaics: CRITICAL ERROR - Document ID (docIdForWrite from naicsCodeParam) is EMPTY. Aborting save.";
    console.error(errMsg, { originalNaicsCodeParam: naicsCodeParam });
    throw new Error("NAICS Code for whiteboard context is missing or invalid. Cannot save shapes.");
  }
  if (!currentUserId) {
    const errMsg = "[Service] saveShapesForNaics: CRITICAL ERROR - User ID (currentUserId) is EMPTY. Aborting save. User might not be authenticated when this was called.";
    console.error(errMsg, { originalUserId: userId });
    throw new Error("User is not authenticated. Cannot save shapes.");
  }

  console.log(`[Service] saveShapesForNaics: Processing save for docId: "${docIdForWrite}", userId: "${currentUserId}"`);

  const shapesForSaving = shapesInput || [];

  const cleanedShapes: Shape[] = shapesForSaving.map(s => {
    const shape: Shape = {
      id: typeof s.id === 'string' && s.id ? s.id : `user-shape-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: s.type === 'rectangle' || s.type === 'circle' ? s.type : 'rectangle',
      text: typeof s.text === 'string' ? s.text : "",
      x: typeof s.x === 'number' ? s.x : 0,
      y: typeof s.y === 'number' ? s.y : 0,
      width: typeof s.width === 'number' && s.width > 0 ? s.width : 150,
      height: typeof s.height === 'number' && s.height > 0 ? s.height : 80,
      parentId: (typeof s.parentId === 'string' || s.parentId === null) ? s.parentId : null,
      isFixed: s.isFixed === true ? true : false, // Ensure boolean, default to false
    };
    // Only include these if they actually have a value to avoid Firestore issues with undefined
    if (s.createdBy) shape.createdBy = s.createdBy;
    if (s.lastEditedBy) shape.lastEditedBy = s.lastEditedBy;
    if (s.nodeType) shape.nodeType = s.nodeType;
    if (s.code) shape.code = s.code;
    return shape;
  });

  // CRITICAL: Ensure the 'naicsCode' field in the data MATCHES the document ID for security rules.
  const dataToSave: WhiteboardDocData = {
    naicsCode: docIdForWrite, // This line is critical for the security rule
    shapes: cleanedShapes,
    lastUpdatedAt: serverTimestamp() as Timestamp,
    lastUpdatedBy: currentUserId,
  };

  const docRef = doc(db, WHITEBOARD_COLLECTION, docIdForWrite);

  console.log(
    `%c[Service] saveShapesForNaics - FINAL CHECK BEFORE WRITE:`,
    "color: orange; font-weight: bold;",
    {
      documentPath: docRef.path,
      userIdAttemptingWrite: currentUserId,
      dataBeingSent_naicsCode: dataToSave.naicsCode,
      dataBeingSent_shapesCount: dataToSave.shapes.length,
    }
  );

  // For security rule debugging: request.resource.data.naicsCode == naicsCodeDocId (wildcard)
  const rule_docId = docIdForWrite; // The ID of the document (e.g., "3251")
  const rule_request_resource_data_naicsCode = dataToSave.naicsCode; // The value of naicsCode field in the data being written
  console.log(
    `%c[Service] saveShapesForNaics - RULE CHECK VALUES:`,
    "color: green; font-weight: bold;",
    {
      docIdForRule: rule_docId,
      typeOfDocIdForRule: typeof rule_docId,
      naicsCodeFieldInResourceData: rule_request_resource_data_naicsCode,
      typeOfNaicsCodeFieldInResourceData: typeof rule_request_resource_data_naicsCode,
      isMatch: rule_docId === rule_request_resource_data_naicsCode, // This MUST be true
    }
  );

  try {
    await setDoc(docRef, dataToSave);
    console.log(`[Service] Shapes for doc ID ${docIdForWrite} saved successfully by ${currentUserId}.`);
  } catch (error: any) {
    console.error(`[Service] Error saving shapes for doc ID ${docIdForWrite} by user ${currentUserId}. Firestore error details:`, error);
    if (error.code === 'permission-denied' || (error.message && error.message.includes('PERMISSION_DENIED'))) {
      console.error(
        "%c[Service] Firestore PERMISSION DENIED. This means the condition 'request.resource.data.naicsCode == naicsCodeDocId' in your rule is likely evaluating to false (values don't match), OR 'request.auth' is null. Check the 'RULE CHECK VALUES' log above. Ensure the `naicsCode` field inside your data *exactly matches* the document ID being written to. Also confirm user authentication status.",
        "color: red; font-weight: bold;"
      );
    } else if (error.code === 'invalid-argument') {
      console.error("[Service] Firestore INVALID ARGUMENT. Data might be malformed (e.g., undefined values for non-optional fields, unsupported types). Data being sent (parts):", { naicsCode: dataToSave.naicsCode, shapesCount: dataToSave.shapes.length});
    }
    throw new Error(`Failed to save whiteboard shapes: ${error.message || 'Unknown Firestore error'}`);
  }
};
