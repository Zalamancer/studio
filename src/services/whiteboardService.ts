
// src/services/whiteboardService.ts
'use server';
import { db, auth } from '@/lib/firebase/config'; // Ensure auth is imported
import {
  doc,
  setDoc,
  serverTimestamp,
  getDoc,
  Timestamp,
} from 'firebase/firestore';
import type { Shape } from '@/components/whiteboard/Whiteboard';

const WHITEBOARD_COLLECTION = 'whiteboardAnnotations';

export const getShapesForNaics = async (naicsCodeParam: string | undefined | null): Promise<Shape[]> => {
  const trimmedNaicsCode = String(naicsCodeParam || "").trim();
  if (!trimmedNaicsCode) {
    console.warn("[Service] getShapesForNaics: called with empty or invalid naicsCode after trim. Original:", naicsCodeParam);
    return [];
  }
  // console.log(`[Service] getShapesForNaics: Fetching shapes for NAICS: ${trimmedNaicsCode}`);
  const docRef = doc(db, WHITEBOARD_COLLECTION, trimmedNaicsCode);
  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as { shapes: Shape[]; naicsCode?: string; };
      // console.log(`[Service] getShapesForNaics: Shapes found for ${trimmedNaicsCode}. Count:`, data.shapes?.length || 0);
      const shapesData = Array.isArray(data.shapes) ? data.shapes : [];
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
    // console.log(`[Service] getShapesForNaics: No whiteboard document found for ${trimmedNaicsCode}.`);
    return [];
  } catch (error) {
    console.error(`[Service] getShapesForNaics: Error fetching shapes for NAICS ${trimmedNaicsCode}:`, error);
    return [];
  }
};

export const saveShapesForNaics = async (
  naicsCodeParam: string | undefined | null,
  shapesInput: Shape[],
  userIdFromClient: string | undefined | null
): Promise<void> => {
  console.log(`%c[Service] saveShapesForNaics - Called`, "color: blue; font-weight: bold;");
  console.log(`%c  [Service] Received - naicsCodeParam: "${naicsCodeParam}", userIdFromClient: "${userIdFromClient}", shapesInput count: ${shapesInput?.length}`, "color: blue;");

  const docIdForWrite = String(naicsCodeParam || "").trim();
  const currentUserIdForAudit = String(userIdFromClient || "").trim();

  if (!docIdForWrite) {
    const errMsg = "[Service] saveShapesForNaics: CRITICAL ERROR - Document ID (docIdForWrite from naicsCodeParam) is EMPTY. Aborting save.";
    console.error(errMsg, { originalNaicsCodeParam: naicsCodeParam });
    throw new Error("NAICS Code for whiteboard context is missing or invalid. Cannot save shapes.");
  }
  if (!currentUserIdForAudit) {
    const errMsg = "[Service] saveShapesForNaics: CRITICAL ERROR - User ID for audit (currentUserIdForAudit from userIdFromClient) is EMPTY. Aborting save.";
    console.error(errMsg, { originalUserIdFromClient: userIdFromClient });
    throw new Error("User ID is missing. Cannot determine who is saving shapes.");
  }

  // --- SERVER-SIDE AUTHENTICATION STATE CHECK ---
  console.log(`%c[Service] saveShapesForNaics - SERVER-SIDE AUTH CHECK:`, "color: magenta; font-weight: bold;");
  const serverAuthUser = auth.currentUser; // This uses the client SDK's auth instance
  if (serverAuthUser) {
    console.log(`%c  [Service] auth.currentUser ON SERVER (Client SDK) has UID: ${serverAuthUser.uid}`, "color: magenta;");
    if (serverAuthUser.uid !== currentUserIdForAudit) {
      console.warn(`%c  [Service] WARNING: Server auth.currentUser.uid (${serverAuthUser.uid}) does NOT MATCH userIdFromClient (${currentUserIdForAudit}). This could be problematic.`, "color: orange;");
    }
  } else {
    console.log(`%c  [Service] auth.currentUser ON SERVER (Client SDK) IS NULL. This IS THE LIKELY CAUSE of PERMISSION_DENIED if your rule is 'request.auth != null'. The client SDK's auth state is not automatically available in Server Actions.`, "color: red; font-weight: bold;");
  }
  try {
    console.log(`%c  [Service] Firestore DB App Name: ${db.app.name}`, "color: magenta;");
    console.log(`%c  [Service] Auth App Name: ${auth.app.name}`, "color: magenta;");
  } catch (e) {
    console.error("%c  [Service] Error accessing db.app.name or auth.app.name. Firebase might not be initialized correctly in this server context.", "color: red;", e);
    throw new Error("Firebase app instance not available in server action."); // Fail early if instances are bad
  }
  // --- END SERVER-SIDE AUTHENTICATION STATE CHECK ---

  const cleanedShapes = shapesInput.map(s => ({
    id: typeof s.id === 'string' && s.id ? s.id : `shape-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: s.type === 'rectangle' || s.type === 'circle' ? s.type : 'rectangle',
    text: typeof s.text === 'string' ? s.text : "",
    x: typeof s.x === 'number' ? s.x : 0,
    y: typeof s.y === 'number' ? s.y : 0,
    width: typeof s.width === 'number' && s.width > 0 ? s.width : 150,
    height: typeof s.height === 'number' && s.height > 0 ? s.height : 80,
    parentId: (typeof s.parentId === 'string' || s.parentId === null) ? s.parentId : null,
    // Ensure boolean values or null for Firestore compatibility
    isFixed: s.isFixed === true ? true : (s.isFixed === false ? false : null),
    nodeType: s.nodeType || null, // Store null if undefined
    code: s.code || null,         // Store null if undefined
    createdBy: s.createdBy || null,
    lastEditedBy: s.lastEditedBy || null,
  }));

  const dataToSave = {
    naicsCode: docIdForWrite, // Critical for the security rule: request.resource.data.naicsCode == docId
    shapes: cleanedShapes,
    lastUpdatedAt: serverTimestamp(),
    lastUpdatedBy: currentUserIdForAudit,
  };

  const docRef = doc(db, WHITEBOARD_COLLECTION, docIdForWrite);

  console.log(
    `%c[Service] saveShapesForNaics - FINAL CHECK BEFORE WRITE:`,
    "color: orange; font-weight: bold;",
    {
      documentPath: docRef.path,
      userIdAttemptingWrite: currentUserIdForAudit, // This is the ID from client, used for 'lastUpdatedBy'
      // dataBeingSent: dataToSave, // Can be very verbose, log parts instead
      dataNaicsCodeField: dataToSave.naicsCode,
      dataShapesCount: dataToSave.shapes.length,
    }
  );
  console.log(
    `%c[Service] saveShapesForNaics - RULE CHECK VALUES (for original rule: request.resource.data.naicsCode == docId):`,
    "color: green; font-weight: bold;",
    {
      docIdForRule: docIdForWrite, // This is the {naicsCode} wildcard from the path
      typeOfDocIdForRule: typeof docIdForWrite,
      naicsCodeFieldInResourceData: dataToSave.naicsCode, // This is request.resource.data.naicsCode
      typeOfNaicsCodeFieldInResourceData: typeof dataToSave.naicsCode,
      isMatch: docIdForWrite === dataToSave.naicsCode,
    }
  );

  try {
    await setDoc(docRef, dataToSave);
    console.log(`[Service] Whiteboard shapes saved successfully for NAICS ${docIdForWrite} by user ${currentUserIdForAudit}.`);
  } catch (error: any) {
    console.error(`[Service] Error saving whiteboard shapes for NAICS ${docIdForWrite}:`, error);
    let detailedErrorMessage = `Failed to save whiteboard shapes: ${error.message || 'Unknown Firestore error'}`;

    if (error.code === 'permission-denied' || (error.message && error.message.includes('PERMISSION_DENIED'))) {
      detailedErrorMessage = `Failed to save whiteboard shapes: PERMISSION_DENIED: Missing or insufficient permissions. Check Firestore rules and server-side auth status.`;
      console.error(
        "%c[Service] Firestore PERMISSION DENIED. Check server-side 'auth.currentUser' log. If it was NULL, the client SDK is not authenticated on the server-side for this write. Also verify the 'RULE CHECK VALUES' log: 'isMatch' must be true.",
        "color: red; font-weight: bold;"
      );
    } else if (error.code === 'invalid-argument') {
      detailedErrorMessage = `Failed to save whiteboard shapes: INVALID_ARGUMENT. Data might be malformed.`;
      console.error("[Service] Firestore INVALID ARGUMENT. Data might be malformed (e.g., undefined values for non-optional fields). Data being sent (parts):", { naicsCode: dataToSave.naicsCode, shapesCount: dataToSave.shapes.length});
    }
    throw new Error(detailedErrorMessage);
  }
};
