
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
import type { Shape } from '@/components/whiteboard/Whiteboard'; // Assuming Shape type is exported or defined here

const WHITEBOARD_COLLECTION = 'whiteboardAnnotations';

/*
Firestore Security Rules for /whiteboardAnnotations/{naicsCode}:
(Ensure these are in your firestore.rules file)

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ... your other rules ...

    match /whiteboardAnnotations/{naicsCode} {
      // Any authenticated user can read annotations for any NAICS context
      allow read: if request.auth != null;

      // Any authenticated user can write (create/update/delete) to a whiteboard
      // for a specific NAICS code, IF the data they are writing also contains
      // that same naicsCode. This is a data integrity check.
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

// Fetches shapes for a specific NAICS code context (publicly readable by authenticated users)
export const getShapesForNaics = async (naicsCode: string): Promise<Shape[]> => {
  if (!naicsCode) {
    console.warn("getShapesForNaics called with no naicsCode.");
    return [];
  }
  console.log(`[Service] Fetching shapes for NAICS: ${naicsCode}`);
  const docRef = doc(db, WHITEBOARD_COLLECTION, naicsCode);
  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as WhiteboardDocData;
      console.log(`[Service] Shapes found for ${naicsCode}:`, data.shapes?.length || 0);
      return data.shapes || []; // Return shapes array or empty if undefined
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
  const shapesToSave = shapesInput || []; // Ensure shapes is always an array

  // Prepare data, ensuring all shapes have necessary fields and are clean
  const cleanedShapes: Shape[] = shapesToSave.map(s => ({
    id: s.id,
    type: s.type,
    text: s.text || "", // Ensure text is not undefined
    x: s.x,
    y: s.y,
    width: s.width,
    height: s.height,
    parentId: s.parentId,
    nodeType: s.nodeType,
    // Do NOT save actualData for user shapes. 'code' is fine if it's from a fixed node parent context.
    code: s.code, 
    createdBy: s.createdBy,
    lastEditedBy: s.lastEditedBy,
    // isFixed should not be saved for user shapes, or default to false
    isFixed: s.isFixed === true ? true : undefined, // only include if explicitly true
  }));


  const dataToSave: WhiteboardDocData = {
    naicsCode: naicsCode, // Crucial for the security rule
    shapes: cleanedShapes,
    lastUpdatedAt: serverTimestamp() as Timestamp,
    lastUpdatedBy: userId,
  };

  console.log(`[Service] Attempting to save shapes for NAICS: ${naicsCode} by user: ${userId}`);
  console.log("[Service] Data to save:", JSON.stringify(dataToSave, null, 2));

  try {
    await setDoc(docRef, dataToSave); // Using setDoc to create or overwrite
    console.log(`[Service] Shapes for NAICS ${naicsCode} saved successfully by ${userId}.`);
  } catch (error: any) {
    console.error(`[Service] Error saving shapes for NAICS ${naicsCode} by user ${userId}:`, error);
    console.error("[Service] Firestore error details:", error.code, error.message, error.details);
    if (error.code === 'permission-denied') {
      console.error("[Service] Firestore permission denied. Ensure rules for 'whiteboardAnnotations' are correctly set up to allow writes for authenticated users where request.resource.data.naicsCode matches the document ID.");
    } else if (error.code === 'invalid-argument') {
      console.error("[Service] Firestore invalid argument. This often means the data being sent is malformed (e.g., undefined values, unsupported types). Data:", dataToSave);
    }
    throw new Error(`Failed to save whiteboard shapes: ${error.message || 'Unknown Firestore error'}`);
  }
};

