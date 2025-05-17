
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
// Ensure these are in your firestore.rules file
/*
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ... your other rules ...

    match /whiteboardAnnotations/{naicsCodeDocId} { // Use a distinct wildcard name
      allow read: if request.auth != null;
      // Allow write if user is authenticated AND the 'naicsCode' field
      // in the document data being written matches the document's ID.
      allow write: if request.auth != null
                   && request.resource.data.naicsCode == naicsCodeDocId; // Compare with the wildcard
    }
  }
}
*/

interface WhiteboardDocData {
  naicsCode: string; // This must match the document ID for the rule to pass
  shapes: Shape[];
  lastUpdatedAt: Timestamp;
  lastUpdatedBy: string; // UID of the user who last saved
}

export const getShapesForNaics = async (naicsCode: string): Promise<Shape[]> => {
  if (!naicsCode) {
    console.warn("[Service] getShapesForNaics called with no naicsCode.");
    return [];
  }
  console.log(`[Service] Fetching shapes for NAICS: ${naicsCode}`);
  const docRef = doc(db, WHITEBOARD_COLLECTION, naicsCode);
  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as WhiteboardDocData;
      console.log(`[Service] Shapes found for ${naicsCode}:`, data.shapes?.length || 0);
      // Ensure shapes have default values for optional fields if missing, to prevent client errors
      return (data.shapes || []).map(s => ({
        id: s.id || `shape-${Math.random().toString(36).substr(2, 9)}`,
        type: s.type || 'rectangle',
        text: typeof s.text === 'string' ? s.text : "", // Ensure text is a string
        x: typeof s.x === 'number' ? s.x : 0,
        y: typeof s.y === 'number' ? s.y : 0,
        width: typeof s.width === 'number' ? s.width : 150,
        height: typeof s.height === 'number' ? s.height : 80,
        parentId: typeof s.parentId === 'string' || s.parentId === null ? s.parentId : null,
        isFixed: s.isFixed === true, // Default to false if undefined
        nodeType: s.nodeType, // Can be undefined
        code: s.code, // Can be undefined
        createdBy: s.createdBy, // Can be undefined
        lastEditedBy: s.lastEditedBy, // Can be undefined
      }));
    }
    console.log(`[Service] No whiteboard document found for ${naicsCode}. Returning empty array.`);
    return [];
  } catch (error) {
    console.error(`[Service] Error fetching shapes for NAICS ${naicsCode}:`, error);
    return []; // Return empty on error to prevent UI crashes
  }
};

export const saveShapesForNaics = async (naicsCode: string, shapesInput: Shape[], userId: string): Promise<void> => {
  if (!naicsCode) throw new Error("NAICS code is required to save whiteboard shapes.");
  if (!userId) throw new Error("User ID is required to save whiteboard shapes.");
  
  const shapesForSaving = shapesInput || [];

  // Clean shapes to ensure all required fields are present and correctly typed,
  // and optional fields are handled (e.g., not undefined).
  const cleanedShapes: Shape[] = shapesForSaving.map(s => {
    const newShape: Shape = {
      id: s.id || `shape-${Date.now()}-${Math.random().toString(16).slice(2)}`, // Ensure ID
      type: s.type || 'rectangle',
      text: typeof s.text === 'string' ? s.text : "",
      x: typeof s.x === 'number' ? s.x : 0,
      y: typeof s.y === 'number' ? s.y : 0,
      width: typeof s.width === 'number' && s.width > 0 ? s.width : 150,
      height: typeof s.height === 'number' && s.height > 0 ? s.height : 80,
      parentId: typeof s.parentId === 'string' ? s.parentId : null, // Ensure string or null
      isFixed: s.isFixed === true, // Ensures boolean, defaults to false if undefined
    };

    // Conditionally add optional properties only if they have a meaningful value
    if (s.nodeType !== undefined) newShape.nodeType = s.nodeType;
    if (s.code !== undefined) newShape.code = s.code;
    if (s.createdBy !== undefined) newShape.createdBy = s.createdBy;
    if (s.lastEditedBy !== undefined) newShape.lastEditedBy = s.lastEditedBy;
    
    return newShape;
  });

  // Data to be saved to Firestore.
  // CRITICAL: dataToSave.naicsCode must match the `naicsCode` used for the document ID for security rules.
  const dataToSave: WhiteboardDocData = {
    naicsCode: naicsCode, // This field is checked by your security rule
    shapes: cleanedShapes,
    lastUpdatedAt: serverTimestamp() as Timestamp,
    lastUpdatedBy: userId,
  };

  const docRef = doc(db, WHITEBOARD_COLLECTION, naicsCode); // Document ID is the naicsCode

  console.log(`[Service] Attempting to save shapes for NAICS: ${naicsCode} by user: ${userId}`);
  console.log(`[Service] Document Reference Path: ${docRef.path}`);
  // Log the specific fields checked by the rule and the document ID for easy comparison
  console.log(
    "%c[Service] saveShapesForNaics - CRITICAL CHECK:",
    "color: blue; font-weight: bold;",
    {
      docIdBeingWritten: naicsCode, // This is the actual document ID ({naicsCodeDocId} in rule)
      naicsCodeFieldInData: dataToSave.naicsCode, // This is request.resource.data.naicsCode
      userIdAttemptingWrite: userId,
      numberOfShapesInPayload: dataToSave.shapes.length,
    }
  );
  // console.log("[Service] Full data object being sent to Firestore:", JSON.stringify(dataToSave, null, 2));


  try {
    // Using setDoc will create the document if it doesn't exist, or overwrite it if it does.
    await setDoc(docRef, dataToSave);
    console.log(`[Service] Shapes for NAICS ${naicsCode} saved successfully by ${userId}.`);
  } catch (error: any) {
    console.error(`[Service] Error saving shapes for NAICS ${naicsCode} by user ${userId}. Firestore error details:`, error.code, error.message, error.details);
    if (error.code === 'permission-denied' || (error.message && error.message.includes('PERMISSION_DENIED'))) {
      console.error("[Service] Firestore permission denied. Verify rules and that 'naicsCode' field in data matches document ID used for write.");
    } else if (error.code === 'invalid-argument') {
      console.error("[Service] Firestore invalid argument. Data might be malformed (e.g., undefined values for non-optional fields). Data being sent:", dataToSave);
    }
    throw new Error(`Failed to save whiteboard shapes: ${error.message || 'Unknown Firestore error'}`);
  }
};
