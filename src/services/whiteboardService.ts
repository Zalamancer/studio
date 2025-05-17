
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

// Firestore Security Rules for /whiteboardAnnotations/{naicsCode}:
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

export const getShapesForNaics = async (naicsCodeParam: string): Promise<Shape[]> => {
  const trimmedNaicsCode = String(naicsCodeParam || "").trim(); // Ensure naicsCodeParam is treated as string and trim
  if (!trimmedNaicsCode) {
    console.warn("[Service] getShapesForNaics called with empty or invalid naicsCode after trim.");
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
        parentId: (typeof s.parentId === 'string' || s.parentId === null) ? s.parentId : null,
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
  const docIdForWrite = String(naicsCodeParam || "").trim(); // Ensure naicsCodeParam is treated as string and trim

  if (!docIdForWrite) {
    console.error("[Service] saveShapesForNaics: TARGET DOCUMENT ID (docIdForWrite) IS EMPTY. Aborting save. Original naicsCodeParam was:", naicsCodeParam);
    throw new Error("NAICS Code (docIdForWrite) is required and cannot be empty to save whiteboard shapes.");
  }
  if (!userId) {
    console.error("[Service] saveShapesForNaics: userId is empty or invalid. Aborting save.");
    throw new Error("User ID is required to save whiteboard shapes.");
  }

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
      isFixed: false, // User shapes are never fixed from this save path
    };
    // Only include these if they actually have a value to avoid Firestore issues with undefined
    if (s.createdBy) shape.createdBy = s.createdBy;
    if (s.lastEditedBy) shape.lastEditedBy = s.lastEditedBy;
    // nodeType and code are typically for fixed NAICS shapes, not user shapes in this context
    return shape;
  });

  // CRITICAL: Ensure the 'naicsCode' field in the data MATCHES the document ID for security rules.
  const dataToSave: WhiteboardDocData = {
    naicsCode: docIdForWrite,
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
      dataBeingSent_naicsCode: dataToSave.naicsCode, // Should match docIdForWrite
      dataBeingSent_shapesCount: dataToSave.shapes.length,
    }
  );
  console.log(
    `%c[Service] saveShapesForNaics - RULE CHECK VALUES:`,
    "color: green; font-weight: bold;",
    {
      docIdForRule: docIdForWrite,
      naicsCodeFieldInResourceData: dataToSave.naicsCode,
      isMatch: docIdForWrite === dataToSave.naicsCode, // This MUST be true
      // Add a log for the type of naicsCode for good measure
      typeOfDocIdForRule: typeof docIdForWrite,
      typeOfNaicsCodeFieldInResourceData: typeof dataToSave.naicsCode,
    }
  );

  try {
    await setDoc(docRef, dataToSave);
    console.log(`[Service] Shapes for doc ID ${docIdForWrite} saved successfully by ${userId}.`);
  } catch (error: any) {
    console.error(`[Service] Error saving shapes for doc ID ${docIdForWrite} by user ${userId}. Firestore error details:`, error);
    if (error.code === 'permission-denied' || (error.message && error.message.includes('PERMISSION_DENIED'))) {
      console.error("[Service] Firestore PERMISSION DENIED. This means 'request.resource.data.naicsCode == docId' in your rule is likely failing, OR 'request.auth' is null (user not authenticated when rule is checked). Check the 'RULE CHECK VALUES' log above. Ensure the `naicsCode` field inside your data exactly matches the document ID (`docIdForWrite`). Also confirm user authentication status.");
    } else if (error.code === 'invalid-argument') {
      console.error("[Service] Firestore INVALID ARGUMENT. Data might be malformed (e.g., undefined values for non-optional fields). Data being sent (parts):", { naicsCode: dataToSave.naicsCode, shapesCount: dataToSave.shapes.length});
    }
    throw new Error(`Failed to save whiteboard shapes: ${error.message || 'Unknown Firestore error'}`);
  }
};

    