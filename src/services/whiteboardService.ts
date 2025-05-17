
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

    match /whiteboardAnnotations/{docId} { // Using docId as wildcard name for clarity
      allow read: if request.auth != null;
      // Allow write if user is authenticated AND the 'naicsCode' field
      // in the document data being written matches the document's ID.
      allow write: if request.auth != null
                   && request.resource.data.naicsCode == docId;
    }
  }
}
*/

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
  console.log(`[Service] Fetching shapes for NAICS: ${naicsCode}`);
  const docRef = doc(db, WHITEBOARD_COLLECTION, naicsCode);
  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as WhiteboardDocData;
      console.log(`[Service] Shapes found for ${naicsCode}:`, data.shapes?.length || 0);
      return (data.shapes || []).map(s => ({
        ...s,
        id: s.id || `shape-${Math.random().toString(36).substr(2, 9)}`, // Ensure ID exists
        type: s.type || 'rectangle', // Ensure type exists
        text: typeof s.text === 'string' ? s.text : "",
        x: typeof s.x === 'number' ? s.x : 0,
        y: typeof s.y === 'number' ? s.y : 0,
        width: typeof s.width === 'number' ? s.width : 150,
        height: typeof s.height === 'number' ? s.height : 80,
        parentId: typeof s.parentId === 'string' ? s.parentId : null,
        isFixed: s.isFixed === true,
        nodeType: s.nodeType,
        code: s.code,
        createdBy: s.createdBy,
        lastEditedBy: s.lastEditedBy,
      }));
    }
    console.log(`[Service] No whiteboard document found for ${naicsCode}.`);
    return [];
  } catch (error) {
    console.error(`[Service] Error fetching shapes for NAICS ${naicsCode}:`, error);
    return [];
  }
};

export const saveShapesForNaics = async (naicsCode: string, shapesInput: Shape[], userId: string): Promise<void> => {
  if (!naicsCode) throw new Error("NAICS code is required to save whiteboard shapes.");
  if (!userId) throw new Error("User ID is required to save whiteboard shapes.");
  
  const shapesForSaving = shapesInput || []; // Ensure shapesInput is not null/undefined

  const cleanedShapes: Shape[] = shapesForSaving.map(s => {
    // Create a new object to avoid mutating the original shape objects from the state directly
    const newShape: Partial<Shape> = {
      id: s.id,
      type: s.type,
      text: typeof s.text === 'string' ? s.text : "",
      x: typeof s.x === 'number' ? s.x : 0,
      y: typeof s.y === 'number' ? s.y : 0,
      width: typeof s.width === 'number' ? s.width : 150, // Default user shape width
      height: typeof s.height === 'number' ? s.height : 80, // Default user shape height
      parentId: typeof s.parentId === 'string' || s.parentId === null ? s.parentId : null, // Ensure string or null
      isFixed: s.isFixed === true, // Ensure boolean (false if undefined)
    };

    // Conditionally add optional properties only if they have a meaningful value
    if (s.nodeType !== undefined) newShape.nodeType = s.nodeType;
    if (s.code !== undefined) newShape.code = s.code;
    if (s.createdBy !== undefined) newShape.createdBy = s.createdBy;
    if (s.lastEditedBy !== undefined) newShape.lastEditedBy = s.lastEditedBy;
    
    return newShape as Shape;
  });

  // Data to be saved to Firestore. Crucially, dataToSave.naicsCode must match the docId.
  const dataToSave: WhiteboardDocData = {
    naicsCode: naicsCode, // This field is checked by the security rule
    shapes: cleanedShapes,
    lastUpdatedAt: serverTimestamp() as Timestamp,
    lastUpdatedBy: userId,
  };

  const docRef = doc(db, WHITEBOARD_COLLECTION, naicsCode);

  console.log(`[Service] Attempting to save shapes for NAICS: ${naicsCode} by user: ${userId}`);
  console.log(`[Service] Document Reference Path: ${docRef.path}`);
  // Log the specific fields checked by the rule and the document ID for easy comparison
  console.log("[Service] Data for security rule check:", 
    { 
      rule_docId: naicsCode, // This is the {docId} in your rule match /whiteboardAnnotations/{docId}
      rule_request_resource_data_naicsCode: dataToSave.naicsCode // This is request.resource.data.naicsCode
    }
  );
   // For very detailed debugging, you can log the entire object:
   // console.log("[Service] Full data object being sent to Firestore:", JSON.stringify(dataToSave, null, 2));


  try {
    await setDoc(docRef, dataToSave);
    console.log(`[Service] Shapes for NAICS ${naicsCode} saved successfully by ${userId}.`);
  } catch (error: any) {
    console.error(`[Service] Error saving shapes for NAICS ${naicsCode} by user ${userId}:`, error);
    console.error("[Service] Firestore error details:", error.code, error.message, error.details);
    if (error.code === 'permission-denied' || (error.message && error.message.includes('PERMISSION_DENIED'))) {
      console.error("[Service] Firestore permission denied. Verify rules and data consistency (naicsCode field in data must match document ID).");
    } else if (error.code === 'invalid-argument') {
      console.error("[Service] Firestore invalid argument. Data might be malformed (e.g., undefined values for non-optional fields). Data being sent:", dataToSave);
    }
    throw new Error(`Failed to save whiteboard shapes: ${error.message || 'Unknown Firestore error'}`);
  }
};

