
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
      const data = docSnap.data() as { shapes: Shape[]; naicsCode?: string; }; // Added naicsCode to type
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
        isFixed: s.isFixed === true, // Keep as boolean
        nodeType: s.nodeType || undefined, // Keep undefined if not present
        code: s.code || undefined, // Keep undefined if not present
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

  const docIdForWrite = String(naicsCodeParam || "").trim();
  const currentUserId = String(userIdFromClient || "").trim();

  if (!docIdForWrite) {
    const errMsg = "[Service] saveShapesForNaics: CRITICAL ERROR - Document ID (docIdForWrite from naicsCodeParam) is EMPTY. Aborting save.";
    console.error(errMsg, { originalNaicsCodeParam: naicsCodeParam });
    throw new Error("NAICS Code for whiteboard context is missing or invalid. Cannot save shapes.");
  }
  if (!currentUserId) {
    const errMsg = "[Service] saveShapesForNaics: CRITICAL ERROR - User ID for audit (currentUserId from userIdFromClient) is EMPTY. Aborting save.";
    console.error(errMsg, { originalUserIdFromClient: userIdFromClient });
    throw new Error("User ID is missing. Cannot determine who is saving shapes.");
  }

  // --- SERVER-SIDE AUTHENTICATION STATE CHECK ---
  console.log(`%c[Service] saveShapesForNaics - SERVER-SIDE AUTH CHECK:`, "color: magenta; font-weight: bold;");
  const serverAuthUser = auth.currentUser; // Get current user from the imported auth instance
  let serverAuthUid = 'unknown_or_no_user';
  if (serverAuthUser) {
    serverAuthUid = serverAuthUser.uid;
    console.log(`%c  [Service] auth.currentUser ON SERVER (Client SDK) has UID: ${serverAuthUid}`, "color: magenta;");
  } else {
    console.log(`%c  [Service] auth.currentUser ON SERVER (Client SDK) IS NULL. This is the likely cause of PERMISSION_DENIED.`, "color: red; font-weight: bold;");
  }
  try {
    console.log(`%c  [Service] Firestore DB App Name: ${db.app.name}`, "color: magenta;");
    console.log(`%c  [Service] Auth App Name: ${auth.app.name}`, "color: magenta;");
  } catch (e: any) {
    console.error("%c  [Service] Error accessing db.app.name or auth.app.name. Firebase might not be initialized correctly in this server context.", "color: red;", e.message);
    throw new Error("Firebase app instance not available in server action.");
  }
  // --- END SERVER-SIDE AUTHENTICATION STATE CHECK ---

  // Using hardcoded test data for simplified debugging
  const testDataToSave = {
    naicsCode: docIdForWrite, // Ensure this matches the doc ID for the rule: request.resource.data.naicsCode == docId
    message: "This is a debug write attempt.",
    timestamp: serverTimestamp(),
    savedBy: currentUserId,
    serverAuthUserUid: serverAuthUser ? serverAuthUser.uid : null, // Add server auth state for debugging
  };

  console.log(
    `%c[Service] saveShapesForNaics - RULE CHECK VALUES (for simplified 'allow write: if request.auth != null;'):`,
    "color: green; font-weight: bold;",
    {
      docIdForRule: docIdForWrite,
      typeOfDocIdForRule: typeof docIdForWrite,
      // For the simplified rule, we don't need to check request.resource.data.naicsCode deeply,
      // but we ensure the object being saved contains it for when we revert to the stricter rule.
      naicsCodeFieldInTestData: testDataToSave.naicsCode,
      typeOfNaicsCodeFieldInTestData: typeof testDataToSave.naicsCode,
      isMatchForStricterRuleIfActive: docIdForWrite === testDataToSave.naicsCode,
      serverAuthUidForRuleCheck: serverAuthUser ? serverAuthUser.uid : null,
    }
  );

  const docRef = doc(db, WHITEBOARD_COLLECTION, docIdForWrite);

  try {
    await setDoc(docRef, testDataToSave); // Using simplified data for this test
    console.log(`[Service] (DEBUG) Test data write attempt successful for NAICS ${docIdForWrite} by user ${currentUserId}.`);
  } catch (error: any) {
    console.error(`[Service] (DEBUG) Firestore error during test data write for ${docIdForWrite}:`, error);
    let errorMessage = `Failed to save whiteboard shapes (DEBUG): ${error.message || 'Unknown Firestore error'}`;

    if (error.code === 'permission-denied' || (error.message && error.message.includes('PERMISSION_DENIED'))) {
        // Include server-side auth state in the error message
        const serverAuthStateMessage = serverAuthUser ? `Server Auth UID: ${serverAuthUser.uid}` : 'Server Auth: NULL';
        errorMessage = `Failed to save whiteboard shapes (DEBUG): PERMISSION_DENIED. ${serverAuthStateMessage}. Check Firestore rules.`;
        console.error(
            `%c[Service] (DEBUG) Firestore PERMISSION DENIED. Client SDK auth.currentUser on server was ${serverAuthUser ? `UID: ${serverAuthUser.uid}` : 'NULL'}. Deployed rule was 'allow write: if request.auth != null;'`,
            "color: red; font-weight: bold;"
        );
    } else if (error.code === 'invalid-argument') {
        errorMessage = `Failed to save whiteboard shapes (DEBUG): INVALID_ARGUMENT. Data might be malformed.`;
        console.error("[Service] (DEBUG) Firestore INVALID ARGUMENT. This often means the data being sent is malformed (e.g., undefined values, unsupported types). Data being sent:", testDataToSave);
    }
    throw new Error(errorMessage);
  }
};
