
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
import type { Shape } from '@/components/whiteboard/Whiteboard'; // Assuming Shape is defined here

const WHITEBOARD_COLLECTION = 'whiteboardAnnotations';

// Firestore Security Rules for /whiteboardAnnotations/{naicsCodeDocId}:
// Ensure these are in your firestore.rules file
/*
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ... your other rules ...

    // Using naicsCodeDocId as the wildcard name for clarity in the rule
    match /whiteboardAnnotations/{naicsCodeDocId} {
      allow read: if request.auth != null;
      // Allow write if user is authenticated AND
      // the 'naicsCode' field in the document data being written (request.resource.data)
      // matches the document's ID (which is the naicsCodeDocId wildcard).
      allow write: if request.auth != null
                   && request.resource.data.naicsCode == naicsCodeDocId;
    }
  }
}
*/

interface WhiteboardDocData {
  naicsCode: string; // This field must match the document ID for the rule
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
      // Ensure shapes are properly formed, defaulting values if necessary
      return (data.shapes || []).map(s => ({
        id: s.id || `shape-${Math.random().toString(36).substr(2, 9)}`,
        type: s.type || 'rectangle',
        text: typeof s.text === 'string' ? s.text : "",
        x: typeof s.x === 'number' ? s.x : 0,
        y: typeof s.y === 'number' ? s.y : 0,
        width: typeof s.width === 'number' ? s.width : 150,
        height: typeof s.height === 'number' ? s.height : 80,
        parentId: typeof s.parentId === 'string' || s.parentId === null ? s.parentId : null,
        isFixed: s.isFixed === true ? true : false, // default to false
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
    return [];
  }
};

export const saveShapesForNaics = async (docIdForWrite: string, shapesInput: Shape[], userId: string): Promise<void> => {
  if (!docIdForWrite) throw new Error("Document ID (naicsCode) is required to save whiteboard shapes.");
  if (!userId) throw new Error("User ID is required to save whiteboard shapes.");

  const shapesForSaving = shapesInput || [];

  const cleanedShapes: Shape[] = shapesForSaving.map(s => {
    const shape: Shape = {
      id: s.id || `shape-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: s.type || 'rectangle',
      text: typeof s.text === 'string' ? s.text : "",
      x: typeof s.x === 'number' ? s.x : 0,
      y: typeof s.y === 'number' ? s.y : 0,
      width: typeof s.width === 'number' && s.width > 0 ? s.width : 150,
      height: typeof s.height === 'number' && s.height > 0 ? s.height : 80,
      parentId: typeof s.parentId === 'string' || s.parentId === null ? s.parentId : null,
      isFixed: s.isFixed === true ? true : false,
    };
    // Conditionally add optional properties only if they have a meaningful value and are not undefined
    if (s.nodeType !== undefined) shape.nodeType = s.nodeType;
    if (s.code !== undefined) shape.code = s.code;
    if (s.createdBy !== undefined) shape.createdBy = s.createdBy;
    if (s.lastEditedBy !== undefined) shape.lastEditedBy = s.lastEditedBy;
    return shape;
  });

  // Data to be saved to Firestore.
  // The naicsCode field in THIS OBJECT must match docIdForWrite for the security rule.
  const dataToSave: WhiteboardDocData = {
    naicsCode: docIdForWrite, // THIS IS CRITICAL: Ensure this value matches the docIdForWrite parameter.
    shapes: cleanedShapes,
    lastUpdatedAt: serverTimestamp() as Timestamp,
    lastUpdatedBy: userId,
  };

  const docRef = doc(db, WHITEBOARD_COLLECTION, docIdForWrite);

  console.log(
    `%c[Service] saveShapesForNaics - Preparing to write:`,
    "color: blue; font-weight: bold;",
    {
      documentPath: docRef.path,
      dataBeingSent: JSON.parse(JSON.stringify(dataToSave)) // Clean way to log potentially complex objects
    }
  );
  console.log( // Log for checking the rule condition explicitly
    `%c[Service] saveShapesForNaics - RULE CHECK VALUES:`,
    "color: green; font-weight: bold;",
    {
      rule_docId_wildcard_value: docIdForWrite, // This is what {naicsCodeDocId} in your rule will be
      rule_request_resource_data_naicsCode_value: dataToSave.naicsCode, // This is what request.resource.data.naicsCode will be
      isMatch: docIdForWrite === dataToSave.naicsCode
    }
  );

  try {
    await setDoc(docRef, dataToSave);
    console.log(`[Service] Shapes for doc ID ${docIdForWrite} saved successfully by ${userId}.`);
  } catch (error: any) {
    console.error(`[Service] Error saving shapes for doc ID ${docIdForWrite} by user ${userId}. Firestore error details:`, error);
    if (error.code === 'permission-denied' || (error.message && error.message.includes('PERMISSION_DENIED'))) {
      console.error("[Service] Firestore PERMISSION DENIED. Ensure 'naicsCode' field in the data matches the document ID AND user is authenticated AND rules are published correctly.");
    } else if (error.code === 'invalid-argument') {
      console.error("[Service] Firestore INVALID ARGUMENT. Data might be malformed (e.g., undefined values for non-optional fields, unsupported types). Data being sent:", JSON.parse(JSON.stringify(dataToSave)));
    }
    throw new Error(`Failed to save whiteboard shapes: ${error.message || 'Unknown Firestore error'}`);
  }
};
