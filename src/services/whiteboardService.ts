
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
//   allow write: if request.auth != null
//                && request.resource.data.naicsCode == naicsCodeDocId; // Crucial: data.naicsCode must match doc ID
// }

interface WhiteboardDocData {
  naicsCode: string;
  shapes: Shape[];
  lastUpdatedAt: Timestamp;
  lastUpdatedBy: string;
}

export const getShapesForNaics = async (naicsCode: string): Promise<Shape[]> => {
  if (!naicsCode) {
    console.warn("[Service] getShapesForNaics called with no naicsCode.");
    return [];
  }
  const trimmedNaicsCode = String(naicsCode).trim();
  if (!trimmedNaicsCode) {
    console.warn("[Service] getShapesForNaics called with effectively empty naicsCode after trim.");
    return [];
  }
  console.log(`[Service] Fetching shapes for NAICS: ${trimmedNaicsCode}`);
  const docRef = doc(db, WHITEBOARD_COLLECTION, trimmedNaicsCode);
  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as WhiteboardDocData;
      console.log(`[Service] Shapes found for ${trimmedNaicsCode}:`, data.shapes?.length || 0);
      return (data.shapes || []).map(s => ({
        id: s.id || `shape-${Math.random().toString(36).substr(2, 9)}`,
        type: s.type || 'rectangle',
        text: typeof s.text === 'string' ? s.text : "",
        x: typeof s.x === 'number' ? s.x : 0,
        y: typeof s.y === 'number' ? s.y : 0,
        width: typeof s.width === 'number' ? s.width : 150,
        height: typeof s.height === 'number' ? s.height : 80,
        parentId: typeof s.parentId === 'string' || s.parentId === null ? s.parentId : null,
        isFixed: s.isFixed === true,
        nodeType: s.nodeType,
        code: s.code,
        createdBy: s.createdBy,
        lastEditedBy: s.lastEditedBy,
      }));
    }
    console.log(`[Service] No whiteboard document found for ${trimmedNaicsCode}. Returning empty array.`);
    return [];
  } catch (error) {
    console.error(`[Service] Error fetching shapes for NAICS ${trimmedNaicsCode}:`, error);
    return [];
  }
};

export const saveShapesForNaics = async (naicsCodeParam: string, shapesInput: Shape[], userId: string): Promise<void> => {
  const docIdForWrite = String(naicsCodeParam).trim(); // Ensure it's a string and trimmed

  if (!docIdForWrite) {
    console.error("[Service] saveShapesForNaics: naicsCode (docIdForWrite) is empty or invalid after trim.");
    throw new Error("NAICS Code (docIdForWrite) is required and cannot be empty to save whiteboard shapes.");
  }
  if (!userId) {
    console.error("[Service] saveShapesForNaics: userId is empty or invalid.");
    throw new Error("User ID is required to save whiteboard shapes.");
  }

  const shapesForSaving = shapesInput || [];

  const cleanedShapes: Shape[] = shapesForSaving.map(s => {
    const shape: Shape = {
      id: typeof s.id === 'string' && s.id ? s.id : `shape-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: s.type === 'rectangle' || s.type === 'circle' ? s.type : 'rectangle',
      text: typeof s.text === 'string' ? s.text : "", // Ensure text is always a string
      x: typeof s.x === 'number' ? s.x : 0,
      y: typeof s.y === 'number' ? s.y : 0,
      width: typeof s.width === 'number' && s.width > 0 ? s.width : 150,
      height: typeof s.height === 'number' && s.height > 0 ? s.height : 80,
      parentId: typeof s.parentId === 'string' || s.parentId === null ? s.parentId : null,
      isFixed: s.isFixed === true, // Default to false if undefined or null
    };
    // Conditionally add optional properties only if they have a meaningful value
    if (s.nodeType !== undefined) shape.nodeType = s.nodeType;
    if (s.code !== undefined) shape.code = s.code;
    if (s.createdBy !== undefined) shape.createdBy = s.createdBy;
    if (s.lastEditedBy !== undefined) shape.lastEditedBy = s.lastEditedBy;
    return shape;
  });

  // This is the data object that will be written to Firestore.
  // The `naicsCode` field in THIS OBJECT must match `docIdForWrite` for the security rule.
  const dataToSave: WhiteboardDocData = {
    naicsCode: docIdForWrite, // CRITICAL: Ensure this matches the document ID used in docRef
    shapes: cleanedShapes,
    lastUpdatedAt: serverTimestamp() as Timestamp,
    lastUpdatedBy: userId,
  };

  const docRef = doc(db, WHITEBOARD_COLLECTION, docIdForWrite);

  console.log(
    `%c[Service] saveShapesForNaics - FINAL CHECK BEFORE WRITE:`,
    "color: orange; font-weight: bold;",
    {
      documentPath: docRef.path,
      userIdAttemptingWrite: userId,
      dataBeingSent_naicsCode: dataToSave.naicsCode, // Log the specific field for clarity
      dataBeingSent_shapesCount: dataToSave.shapes.length,
      // Full data can be verbose, log parts if needed: JSON.parse(JSON.stringify(dataToSave))
    }
  );
  console.log(
    `%c[Service] saveShapesForNaics - RULE CHECK VALUES:`,
    "color: green; font-weight: bold;",
    {
      docIdForRule: docIdForWrite, // This is the {naicsCode} wildcard in your rule
      naicsCodeFieldInResourceData: dataToSave.naicsCode, // This is request.resource.data.naicsCode
      isMatch: docIdForWrite === dataToSave.naicsCode, // This condition must be true
      isAuthenticated: "Ensure user is logged in (check client-side logs)"
    }
  );

  try {
    await setDoc(docRef, dataToSave);
    console.log(`[Service] Shapes for doc ID ${docIdForWrite} saved successfully by ${userId}.`);
  } catch (error: any) {
    console.error(`[Service] Error saving shapes for doc ID ${docIdForWrite} by user ${userId}. Firestore error details:`, error);
    if (error.code === 'permission-denied' || (error.message && error.message.includes('PERMISSION_DENIED'))) {
      console.error("[Service] Firestore PERMISSION DENIED. Critical check: Is 'naicsCodeFieldInResourceData' IDENTICAL to 'docIdForRule' (logged above)? Is user authenticated? Are rules published correctly in Firebase Console?");
    } else if (error.code === 'invalid-argument') {
      console.error("[Service] Firestore INVALID ARGUMENT. Data might be malformed (e.g., undefined values for non-optional fields). Data being sent (parts):", { naicsCode: dataToSave.naicsCode, shapesCount: dataToSave.shapes.length});
    }
    throw new Error(`Failed to save whiteboard shapes: ${error.message || 'Unknown Firestore error'}`);
  }
};
