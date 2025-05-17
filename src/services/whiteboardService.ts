// src/services/whiteboardService.ts
// REMOVED 'use server'; - This function will now be called from the client.

import { db, auth } from '@/lib/firebase/config'; // Ensure auth is imported if needed for client context
import {
  doc,
  setDoc,
  serverTimestamp,
  getDoc,
  Timestamp, // Keep for type checking if reading timestamps
} from 'firebase/firestore';
import type { Shape } from '@/components/whiteboard/Whiteboard';

const WHITEBOARD_COLLECTION = 'whiteboardAnnotations';

// Fetches shapes for a given NAICS code. Now callable from client.
export const getShapesForNaics = async (naicsCodeParam: string | undefined | null): Promise<Shape[]> => {
  const trimmedNaicsCode = String(naicsCodeParam || "").trim();
  if (!trimmedNaicsCode) {
    console.warn("[Service] getShapesForNaics: called with empty or invalid naicsCode after trim. Original:", naicsCodeParam);
    return [];
  }
  const docRef = doc(db, WHITEBOARD_COLLECTION, trimmedNaicsCode);
  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as { shapes: Shape[]; naicsCode?: string; lastUpdatedBy?: string; lastUpdatedAt?: Timestamp };
      const shapesData = Array.isArray(data.shapes) ? data.shapes : [];
      // Ensure shapes have a valid structure, especially IDs
      return shapesData.map(s => ({
        id: typeof s.id === 'string' && s.id ? s.id : `shape-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        type: s.type === 'rectangle' || s.type === 'circle' ? s.type : 'rectangle',
        text: typeof s.text === 'string' ? s.text : "",
        x: typeof s.x === 'number' ? s.x : 0,
        y: typeof s.y === 'number' ? s.y : 0,
        width: typeof s.width === 'number' && s.width > 0 ? s.width : 150,
        height: typeof s.height === 'number' && s.height > 0 ? s.height : 80,
        parentId: (typeof s.parentId === 'string' || s.parentId === null) ? s.parentId : null,
        isFixed: s.isFixed === true,
        nodeType: s.nodeType || undefined,
        code: s.code || undefined,
        createdBy: s.createdBy || undefined,
        lastEditedBy: s.lastEditedBy || undefined,
      }));
    }
    return [];
  } catch (error) {
    console.error(`[Service] getShapesForNaics: Error fetching shapes for NAICS ${trimmedNaicsCode}:`, error);
    return [];
  }
};

// Saves/updates user shapes for a given NAICS code. Now callable from client.
export const saveShapesForNaics = async (
  naicsCodeParam: string | undefined | null,
  shapesInput: Shape[],
  userId: string | undefined | null // Current user's ID performing the save
): Promise<void> => {
  console.log(`%c[Service] saveShapesForNaics (CLIENT-SIDE CALL) - Called`, "color: blue; font-weight: bold;");

  const docIdForWrite = String(naicsCodeParam || "").trim();
  const currentUserId = String(userId || "").trim();

  if (!docIdForWrite) {
    const errMsg = "[Service] saveShapesForNaics: CRITICAL ERROR - Document ID (naicsCode) is EMPTY. Aborting save.";
    console.error(errMsg, { originalNaicsCodeParam: naicsCodeParam });
    throw new Error("NAICS Code for whiteboard context is missing or invalid. Cannot save shapes.");
  }
  if (!currentUserId) {
    const errMsg = "[Service] saveShapesForNaics: CRITICAL ERROR - User ID for audit is EMPTY. Aborting save.";
    console.error(errMsg, { originalUserId: userId });
    throw new Error("User ID is missing. Cannot determine who is saving shapes.");
  }

  // Client-side auth check (auth.currentUser should be populated)
  const clientAuthUser = auth.currentUser;
  if (!clientAuthUser || clientAuthUser.uid !== currentUserId) {
    console.error(`[Service] saveShapesForNaics: Auth mismatch or user not authenticated on client. Client UID: ${clientAuthUser?.uid}, Provided UID: ${currentUserId}`);
    throw new Error("Authentication error or mismatch. Please ensure you are logged in.");
  }

  // Clean shapes to prevent Firestore "Unsupported field value: undefined" errors
  const cleanedShapes = shapesInput.map(s => ({
    id: typeof s.id === 'string' && s.id ? s.id : `shape-${Date.now()}-${Math.random().toString(16).slice(2)}`, // Ensure ID exists
    type: s.type === 'rectangle' || s.type === 'circle' ? s.type : 'rectangle',
    text: typeof s.text === 'string' ? s.text : '', // Default to empty string
    x: typeof s.x === 'number' ? s.x : 0,
    y: typeof s.y === 'number' ? s.y : 0,
    width: typeof s.width === 'number' && s.width > 0 ? s.width : 150,
    height: typeof s.height === 'number' && s.height > 0 ? s.height : 80,
    parentId: (typeof s.parentId === 'string' || s.parentId === null) ? s.parentId : null, // Allow null
    isFixed: s.isFixed === true, // Ensure boolean
    nodeType: s.nodeType || null, // Use null if undefined
    code: s.code || null,         // Use null if undefined
    createdBy: s.createdBy || null,
    lastEditedBy: s.lastEditedBy || currentUserId, // Ensure lastEditedBy is set
  }));

  const dataToSave = {
    naicsCode: docIdForWrite, // Critical for security rule: request.resource.data.naicsCode == docId
    shapes: cleanedShapes,
    lastUpdatedAt: serverTimestamp(),
    lastUpdatedBy: currentUserId,
  };

  console.log(
    `%c[Service] saveShapesForNaics - RULE CHECK VALUES (CLIENT-SIDE PERSPECTIVE):`,
    "color: green; font-weight: bold;",
    {
      docIdForRule: docIdForWrite,
      typeOfDocIdForRule: typeof docIdForWrite,
      naicsCodeFieldInResourceData: dataToSave.naicsCode,
      typeOfNaicsCodeFieldInResourceData: typeof dataToSave.naicsCode,
      isMatch: docIdForWrite === dataToSave.naicsCode,
      userIdAttemptingWrite: currentUserId,
      isAuthenticated: !!clientAuthUser,
    }
  );

  const docRef = doc(db, WHITEBOARD_COLLECTION, docIdForWrite);

  try {
    await setDoc(docRef, dataToSave, { merge: true }); // Using merge to be safe if creating or updating
    console.log(`[Service] Whiteboard shapes saved successfully for NAICS ${docIdForWrite} by user ${currentUserId}.`);
  } catch (error: any) {
    console.error(`[Service] Firestore error during save for ${docIdForWrite}:`, error);
    const authStatusMessage = clientAuthUser ? `Client Auth UID: ${clientAuthUser.uid}` : 'Client Auth: NULL';
    let specificErrorMessage = `Failed to save whiteboard shapes: ${error.message || 'Unknown Firestore error'}`;

    if (error.code === 'permission-denied' || (error.message && error.message.includes('PERMISSION_DENIED'))) {
      specificErrorMessage = `Failed to save whiteboard shapes: PERMISSION_DENIED. ${authStatusMessage}. Check Firestore rules.`;
      console.error(
        `%c[Service] Firestore PERMISSION DENIED. ${authStatusMessage}. Ensure rule 'request.resource.data.naicsCode == docId' is met.`,
        "color: red; font-weight: bold;"
      );
    } else if (error.code === 'invalid-argument') {
      specificErrorMessage = `Failed to save whiteboard shapes: INVALID_ARGUMENT. Data might be malformed.`;
      console.error("[Service] Firestore INVALID ARGUMENT. Data being sent (parts):", { naicsCode: dataToSave.naicsCode, shapesCount: dataToSave.shapes.length });
    }
    throw new Error(specificErrorMessage);
  }
};

/*
Firestore Security Rules for /whiteboardAnnotations/{naicsDocId}:

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ... your existing rules ...

    match /whiteboardAnnotations/{naicsDocId} {
      // Any authenticated user can read shapes for any NAICS context
      allow read: if request.auth != null;

      // Any authenticated user can write (create/update/delete) shapes for any NAICS context
      // as long as the 'naicsCode' field in the document data matches the document's ID.
      allow write: if request.auth != null
                   && request.resource.data.naicsCode == naicsDocId;
    }
  }
}
*/
