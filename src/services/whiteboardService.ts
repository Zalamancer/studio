
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
// Ensure these are in your firestore.rules file
/*
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ... your other rules ...

    match /whiteboardAnnotations/{naicsCodeDocId} { // Wildcard for the document ID
      allow read: if request.auth != null;
      // Allow write if user is authenticated AND
      // the 'naicsCode' field in the document data being written
      // matches the document's ID (which is the naicsCodeDocId wildcard).
      allow write: if request.auth != null
                   && request.resource.data.naicsCode == naicsCodeDocId;
    }
  }
}
*/

interface WhiteboardDocData {
  naicsCode: string; // This field must match the document ID
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
    console.log(`[Service] No whiteboard document found for ${naicsCode}. Returning empty array.`);
    return [];
  } catch (error) {
    console.error(`[Service] Error fetching shapes for NAICS ${naicsCode}:`, error);
    return [];
  }
};

export const saveShapesForNaics = async (naicsCode: string, shapesInput: Shape[], userId: string): Promise<void> => {
  if (!naicsCode) throw new Error("NAICS code is required to save whiteboard shapes.");
  if (!userId) throw new Error("User ID is required to save whiteboard shapes.");

  const shapesForSaving = shapesInput || [];

  const cleanedShapes: Shape[] = shapesForSaving.map(s => {
    const newShape: Shape = {
      id: s.id || `shape-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: s.type || 'rectangle',
      text: typeof s.text === 'string' ? s.text : "",
      x: typeof s.x === 'number' ? s.x : 0,
      y: typeof s.y === 'number' ? s.y : 0,
      width: typeof s.width === 'number' && s.width > 0 ? s.width : 150,
      height: typeof s.height === 'number' && s.height > 0 ? s.height : 80,
      parentId: typeof s.parentId === 'string' ? s.parentId : (s.parentId === null ? null : undefined),
      isFixed: s.isFixed === true, // Default to false if undefined during creation
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
    naicsCode: naicsCode, // Explicitly set naicsCode in the data to match the document ID
    shapes: cleanedShapes,
    lastUpdatedAt: serverTimestamp() as Timestamp,
    lastUpdatedBy: userId,
  };

  const docRef = doc(db, WHITEBOARD_COLLECTION, naicsCode); // Document ID is the naicsCode

  console.log(
    `%c[Service] saveShapesForNaics - About to write to Firestore`,
    "color: blue; font-weight: bold;",
    {
      docPath: docRef.path,
      dataBeingSent: dataToSave // Log the actual data object
    }
  );
  
  // This log helps verify the condition for the security rule
  console.log(
    `%c[Service] saveShapesForNaics - RULE CHECK VALUES:`,
    "color: green; font-weight: bold;",
    {
      docIdForRule: naicsCode, // This is the 'naicsCodeDocId' in your rule
      naicsCodeFieldInResourceData: dataToSave.naicsCode, // This is 'request.resource.data.naicsCode'
      isMatch: naicsCode === dataToSave.naicsCode // Should be true
    }
  );


  try {
    await setDoc(docRef, dataToSave); // Using setDoc creates or overwrites
    console.log(`[Service] Shapes for NAICS ${naicsCode} saved successfully by ${userId}.`);
  } catch (error: any) {
    console.error(`[Service] Error saving shapes for NAICS ${naicsCode} by user ${userId}. Firestore error details:`, error);
    if (error.code === 'permission-denied' || (error.message && error.message.includes('PERMISSION_DENIED'))) {
      console.error("[Service] Firestore permission denied. Critical check: Ensure 'naicsCode' field in the data being saved matches the document ID used for the write operation. Also verify authentication status and Firestore rules publication.");
    } else if (error.code === 'invalid-argument') {
      console.error("[Service] Firestore invalid argument. Data might be malformed (e.g., undefined values for non-optional fields, unsupported types). Data being sent:", dataToSave);
    }
    throw new Error(`Failed to save whiteboard shapes: ${error.message || 'Unknown Firestore error'}`);
  }
};
