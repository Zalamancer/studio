
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

/*
Firestore Security Rules for /whiteboardAnnotations/{naicsCode}:
(Ensure these are in your firestore.rules file)

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ... your other rules ...

    match /whiteboardAnnotations/{naicsCode} {
      // Any authenticated user can read shapes for any NAICS context
      allow read: if request.auth != null;

      // Any authenticated user can write (create/update/delete) shapes
      // for any NAICS context, as long as the data is consistent.
      allow write: if request.auth != null
                   && request.resource.data.naicsCode == naicsCode;
    }
  }
}
*/

interface WhiteboardDocData {
  naicsCode: string;
  shapes: Shape[];
  lastUpdatedAt: Timestamp;
  lastUpdatedBy: string; // UID of the user who last saved
}

// Fetches shapes for a specific NAICS code context
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
      // Ensure shapes array is properly formed, filtering out any potentially problematic entries if necessary
      return (data.shapes || []).map(s => ({
        ...s,
        parentId: s.parentId === undefined ? null : s.parentId, // Ensure parentId is null if undefined
        text: s.text || "", // Ensure text is at least an empty string
        isFixed: s.isFixed || false, // Default isFixed to false if undefined
      }));
    }
    console.log(`[Service] No whiteboard document found for ${naicsCode}.`);
    return [];
  } catch (error) {
    console.error(`[Service] Error fetching shapes for NAICS ${naicsCode}:`, error);
    return []; // Return empty on error
  }
};

// Saves or updates the shapes for a specific NAICS code context
export const saveShapesForNaics = async (naicsCode: string, shapesInput: Shape[], userId: string): Promise<void> => {
  if (!naicsCode) throw new Error("NAICS code is required to save whiteboard shapes.");
  if (!userId) throw new Error("User ID is required to save whiteboard shapes.");

  const docRef = doc(db, WHITEBOARD_COLLECTION, naicsCode);
  const shapesToSave = shapesInput || [];

  const cleanedShapes: Shape[] = shapesToSave.map(s => {
    const shape: any = { // Use 'any' to build dynamically, then will be cast to Shape implicitly
      id: s.id,
      type: s.type,
      text: s.text || "", // Ensure text is not undefined
      x: s.x,
      y: s.y,
      width: s.width,
      height: s.height,
      parentId: s.parentId || null, // Ensure parentId is null if undefined or empty string
      isFixed: s.isFixed === true, // Ensures it's explicitly true or false
    };

    // Conditionally add optional properties only if they are defined
    if (s.nodeType !== undefined) {
      shape.nodeType = s.nodeType;
    }
    if (s.code !== undefined) {
      shape.code = s.code;
    }
    if (s.createdBy !== undefined) {
      shape.createdBy = s.createdBy;
    }
    if (s.lastEditedBy !== undefined) {
      shape.lastEditedBy = s.lastEditedBy;
    }
    // Ensure all required fields of Shape are present, even if with default values
    // For example, if 'nodeType' was mandatory in Shape type but optional in practice:
    // shape.nodeType = s.nodeType || 'user'; // Or some other default

    return shape as Shape; // The resulting object should conform to Shape
  });

  const dataToSave: WhiteboardDocData = {
    naicsCode: naicsCode,
    shapes: cleanedShapes,
    lastUpdatedAt: serverTimestamp() as Timestamp,
    lastUpdatedBy: userId,
  };

  console.log(`[Service] Attempting to save shapes for NAICS: ${naicsCode} by user: ${userId}`);
  console.log("[Service] Data to save (cleaned):", JSON.stringify(dataToSave, null, 2));

  try {
    await setDoc(docRef, dataToSave);
    console.log(`[Service] Shapes for NAICS ${naicsCode} saved successfully by ${userId}.`);
  } catch (error: any) {
    console.error(`[Service] Error saving shapes for NAICS ${naicsCode} by user ${userId}:`, error);
    console.error("[Service] Firestore error details:", error.code, error.message, error.details);
    if (error.code === 'permission-denied') {
      console.error("[Service] Firestore permission denied. Ensure rules for 'whiteboardAnnotations' are correctly set up.");
    } else if (error.code === 'invalid-argument') {
      console.error("[Service] Firestore invalid argument. This often means the data being sent is malformed (e.g., undefined values for non-optional fields, unsupported types). Data being sent:", dataToSave);
    }
    throw new Error(`Failed to save whiteboard shapes: ${error.message || 'Unknown Firestore error'}`);
  }
};
