
// src/services/whiteboardService.ts
import { db, auth } from '@/lib/firebase/config';
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
    console.warn("[Service] getShapesForNaics: called with empty or invalid naicsCode. Original:", naicsCodeParam);
    return [];
  }
  console.log(`%c[Service] getShapesForNaics: Attempting to fetch for NAICS: '${trimmedNaicsCode}'`, "color: blue;");
  const docRef = doc(db, WHITEBOARD_COLLECTION, trimmedNaicsCode);
  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      console.log(`%c[Service] getShapesForNaics: Document FOUND for NAICS '${trimmedNaicsCode}'. Document ID: '${docSnap.id}'. Raw Data:`, "color: green;", data);
      
      const shapesData = Array.isArray(data.shapes) ? data.shapes : [];
      console.log(`%c[Service] getShapesForNaics: Extracted 'shapes' array (length ${shapesData.length}) for NAICS '${trimmedNaicsCode}'.`, "color: green;", shapesData);

      const sanitizedShapes = shapesData.map((s: any, index: number) => {
        const sanitized = {
          id: typeof s.id === 'string' && s.id ? s.id : `shape-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          type: s.type === 'rectangle' || s.type === 'circle' ? s.type : 'rectangle',
          text: typeof s.text === 'string' ? s.text : "",
          x: typeof s.x === 'number' ? s.x : 0,
          y: typeof s.y === 'number' ? s.y : 0,
          width: typeof s.width === 'number' && s.width > 0 ? s.width : 150,
          height: typeof s.height === 'number' && s.height > 0 ? s.height : 80,
          parentId: (typeof s.parentId === 'string' || s.parentId === null) ? s.parentId : null,
          isFixed: s.isFixed === true,
          nodeType: s.nodeType || null,
          code: s.code || null,
          createdBy: s.createdBy || null,
          lastEditedBy: s.lastEditedBy || null,
          docContent: typeof s.docContent === 'string' ? s.docContent : "", // Ensure docContent is string
        };
        console.log(`%c[Service] getShapesForNaics: Sanitizing shape ${index}: Original:`, "color: #7F00FF", s, "Sanitized:", sanitized);
        return sanitized;
      });
      console.log(`%c[Service] getShapesForNaics: RETURNING ${sanitizedShapes.length} sanitized shapes for NAICS '${trimmedNaicsCode}'.`, "color: blue; font-weight: bold;");
      return sanitizedShapes;
    } else {
      console.log(`%c[Service] getShapesForNaics: Document DOES NOT EXIST for NAICS '${trimmedNaicsCode}'. Returning empty array.`, "color: orange;");
      return [];
    }
  } catch (error) {
    console.error(`%c[Service] getShapesForNaics: Error fetching shapes for NAICS '${trimmedNaicsCode}':`, "color: red;", error);
    return [];
  }
};


export const saveShapesForNaics = async (
  naicsCodeParam: string | undefined | null,
  shapesInput: Shape[],
  userIdParam: string | undefined | null
): Promise<void> => {
  console.log(`%c[Service] saveShapesForNaics - Called with:`, "color: blue; font-weight: bold;", { naicsCodeParam, shapesInputLength: shapesInput.length, userIdParam });

  const docIdForWrite = String(naicsCodeParam || "").trim();
  const currentUserId = String(userIdParam || "").trim();

  if (!docIdForWrite) {
    const errMsg = "[Service] saveShapesForNaics: CRITICAL ERROR - Document ID (naicsCode) is EMPTY. Aborting save.";
    console.error(errMsg, { originalNaicsCodeParam: naicsCodeParam });
    throw new Error("NAICS Code for whiteboard context is missing or invalid. Cannot save shapes.");
  }
  if (!currentUserId) {
    const errMsg = "[Service] saveShapesForNaics: CRITICAL ERROR - User ID for audit is EMPTY. Aborting save.";
    console.error(errMsg, { originalUserId: userIdParam });
    throw new Error("User ID is missing. Cannot determine who is saving shapes.");
  }

  const cleanedShapes = shapesInput.map(s => ({
    id: typeof s.id === 'string' && s.id ? s.id : `fallback-id-${Date.now()}`, // Ensure ID
    type: s.type === 'rectangle' || s.type === 'circle' ? s.type : 'rectangle',
    text: typeof s.text === 'string' ? s.text : "",
    x: typeof s.x === 'number' ? s.x : 0,
    y: typeof s.y === 'number' ? s.y : 0,
    width: typeof s.width === 'number' && s.width > 0 ? s.width : 150,
    height: typeof s.height === 'number' && s.height > 0 ? s.height : 80,
    parentId: (typeof s.parentId === 'string' || s.parentId === null) ? s.parentId : null,
    isFixed: s.isFixed === true, // Ensure boolean, default to false
    nodeType: s.nodeType || null,
    code: s.code || null,
    createdBy: s.createdBy || null,
    lastEditedBy: currentUserId, // Always set/update lastEditedBy to the current user saving
    docContent: typeof s.docContent === 'string' ? s.docContent : "", // Ensure docContent is string
  }));

  const dataToSave = {
    naicsCode: docIdForWrite, // This ensures the field matches the document ID for the security rule
    shapes: cleanedShapes,
    lastUpdatedAt: serverTimestamp(),
    lastUpdatedBy: currentUserId,
  };

  // Log for security rule debugging
  console.log(
    `%c[Service] saveShapesForNaics - RULE CHECK VALUES:`,
    "color: green; font-weight: bold;",
    {
      docIdForRule: docIdForWrite,
      typeOfDocIdForRule: typeof docIdForWrite,
      naicsCodeFieldInResourceData: dataToSave.naicsCode,
      typeOfNaicsCodeFieldInResourceData: typeof dataToSave.naicsCode,
      isMatch: docIdForWrite === dataToSave.naicsCode,
    }
  );
  
  // Log the data just before writing to Firestore
  console.log(
    `%c[Service] saveShapesForNaics - FINAL CHECK BEFORE WRITE:`,
    "color: darkorange; font-weight: bold;",
    {
      documentPath: `${WHITEBOARD_COLLECTION}/${docIdForWrite}`,
      userIdAttemptingWrite: currentUserId,
      // Log only a snippet of shapes if it's too long
      dataBeingSent: {
        ...dataToSave,
        shapes: dataToSave.shapes.length > 2 ? 
          [dataToSave.shapes[0], `... (${dataToSave.shapes.length - 1} more shapes)`] : 
          dataToSave.shapes,
      }
    }
  );
  const firstUserShape = dataToSave.shapes.find(s => !s.isFixed);
  if(firstUserShape) {
    console.log(`%c[Service] saveShapesForNaics - First User Shape docContent going to Firestore: '${firstUserShape.docContent.substring(0,100)}...' (Length: ${firstUserShape.docContent.length})`, "color: darkorange;");
  }


  const docRef = doc(db, WHITEBOARD_COLLECTION, docIdForWrite);

  try {
    await setDoc(docRef, dataToSave, { merge: true });
    console.log(`%c[Service] Whiteboard shapes saved successfully for NAICS ${docIdForWrite} by user ${currentUserId}.`, "color: green;");
  } catch (error: any) {
    console.error(`%c[Service] Firestore error during save for NAICS ${docIdForWrite}:`, "color: red;", error);
    
    // Log additional info from the auth instance on the client
    const clientAuthUser = auth.currentUser; // Assuming auth is imported from firebase/config
    const authStatusMessage = clientAuthUser ? `Client Auth UID: ${clientAuthUser.uid}` : 'Client Auth: NULL';
    console.error(`%c[Service] Client Auth Status at time of error: ${authStatusMessage}`, "color: red;");

    if (error.code === 'permission-denied' || (error.message && error.message.includes('PERMISSION_DENIED'))) {
      console.error(
        `%c[Service] Firestore PERMISSION DENIED. Client Auth: ${authStatusMessage}. Ensure rule 'request.resource.data.naicsCode == docId' is met, and user is authenticated.`,
        "color: red; font-weight: bold;"
      );
    } else if (error.code === 'invalid-argument') {
      console.error("[Service] Firestore INVALID ARGUMENT. Data might be malformed (e.g., undefined values for non-optional fields). Data being sent (parts):", { naicsCode: dataToSave.naicsCode, shapesCount: dataToSave.shapes.length});
    }
    throw new Error(`Failed to save whiteboard shapes: ${error.message || 'Unknown Firestore error'}`);
  }
};
