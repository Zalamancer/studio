
// src/services/connectionService.ts
import { db, auth } from '@/lib/firebase/config';
import {
  collection,
  query,
  where,
  getDocs,
  setDoc,
  doc,
  updateDoc,
  serverTimestamp,
  orderBy,
  limit,
  getDoc,
  deleteDoc,
  type QueryConstraint,
  type FieldValue,
  Timestamp,
} from 'firebase/firestore';
import {
  updateProfile, // For updating Firebase Auth user profile
} from 'firebase/auth';
import type { ConnectionStatus, Connection, ConnectionRequest, UserProfileBasic, UserProfileData, InitializeUserProfileArgs, UserProfileUpdateData } from '@/types/connection';
import { generateAnonymousName } from '@/lib/pseudonymUtils';
import { createNotification } from './notificationService';
import { IS_VALID_FIREBASE_UID_REGEX } from '@/lib/utils';

const mutualsCollectionRef = collection(db, 'mutuals');
const usersCollectionRef = collection(db, 'users');

const getConnectionDocId = (userId1: string, userId2: string): string => {
  const id1 = String(userId1 || "").trim();
  const id2 = String(userId2 || "").trim();
  if (!id1 || !id2 || !IS_VALID_FIREBASE_UID_REGEX.test(id1) || !IS_VALID_FIREBASE_UID_REGEX.test(id2)) {
    // console.error(`%c[connectionService] getConnectionDocId CRITICAL: Called with invalid UID(s). userId1: '${id1}', userId2: '${id2}'.`, "color: red; font-weight: bold;");
    return `INVALID_CONNECTION_ID_DUE_TO_BAD_UIDS_${id1}_${id2}`;
  }
  return [id1, id2].sort().join('_');
};

async function findUniqueMentionName(
  baseUid: string,
  maxAttempts: number = 10,
  maxRandomRetries: number = 3
): Promise<{ uniqueName: string; uniqueNameLower: string }> {
  let attempt = 0;
  let candidateName: string;
  let candidateNameLower: string;
  const originalBaseName = generateAnonymousName(baseUid); // Generate base name once for suffixing

  while (attempt < maxAttempts) {
    if (attempt === 0) {
      // First attempt uses the original name from baseUid
      candidateName = originalBaseName;
    } else if (attempt < maxRandomRetries) {
      // Subsequent attempts (up to maxRandomRetries) try a new random name
      // console.log(`[findUniqueMentionName] Collision on attempt ${attempt}. Trying new random name for baseUid ${baseUid}.`);
      candidateName = generateAnonymousName(baseUid + "_retry" + attempt); // Alter seed for new random name
    } else {
      // After random retries, start suffixing the *original* base name
      const suffixNumber = attempt - maxRandomRetries + 1;
      candidateName = `${originalBaseName}_${suffixNumber}`;
      // console.log(`[findUniqueMentionName] Collision on attempt ${attempt}. Trying suffixed name: ${candidateName} for baseUid ${baseUid}.`);
    }
    candidateNameLower = candidateName.toLowerCase();

    const q = query(usersCollectionRef, where("mentionNameLowercase", "==", candidateNameLower), limit(1));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      // console.log(`[findUniqueMentionName] Found unique name '${candidateName}' for baseUid ${baseUid} on attempt ${attempt + 1}.`);
      return { uniqueName: candidateName, uniqueNameLower: candidateNameLower };
    }
    attempt++;
  }

  // Fallback if all attempts fail
  // console.error(`[findUniqueMentionName] Max attempts (${maxAttempts}) reached for base UID ${baseUid}. Using ultimate fallback.`);
  const fallbackSuffix = Date.now().toString().slice(-5) + Math.random().toString(36).substring(2, 5);
  candidateName = `${originalBaseName}_fb_${fallbackSuffix}`;
  candidateNameLower = candidateName.toLowerCase();
  return { uniqueName: candidateName, uniqueNameLower: candidateNameLower };
}


export const initializeUserProfile = async (userData: InitializeUserProfileArgs): Promise<void> => {
  const clientAuthUser = auth.currentUser;
  // console.log(`%c[connectionService] initializeUserProfile: Called. Client auth UID: ${clientAuthUser?.uid || 'NULL'}. Incoming userData:`, "color: orange", userData);

  if (!userData.uid || !IS_VALID_FIREBASE_UID_REGEX.test(userData.uid)) {
    // console.error('%c[connectionService] initializeUserProfile: ERROR - UID is missing or invalid in userData. Aborting.', "color: red; font-weight:bold;", userData);
    return;
  }

  const userDocRef = doc(usersCollectionRef, userData.uid);
  

  try {
    const docSnap = await getDoc(userDocRef);
    let operationType: 'CREATE' | 'UPDATE' = 'CREATE';
    
    let finalMentionName: string;
    let finalMentionNameLowercase: string;

    let dataPayload: Partial<UserProfileData> & { updatedAt: FieldValue, createdAt?: FieldValue, lastLoginAt?: FieldValue } = {
        uid: userData.uid,
        updatedAt: serverTimestamp(),
    };

    let finalAuthDisplayName: string;
    let finalAuthPhotoURL: string | null = null;

    if (!docSnap.exists()) {
      // console.log(`%c[connectionService] initializeUserProfile: CREATING NEW PROFILE for UID ${userData.uid}.`, "color: green; font-weight: bold;");
      operationType = 'CREATE';
      const { uniqueName, uniqueNameLower } = await findUniqueMentionName(userData.uid);
      finalMentionName = uniqueName;
      finalMentionNameLowercase = uniqueNameLower;
      
      dataPayload.createdAt = serverTimestamp();
      dataPayload.lastLoginAt = serverTimestamp();
      dataPayload.mentionName = finalMentionName;
      dataPayload.mentionNameLowercase = finalMentionNameLowercase;
      dataPayload.email = userData.email || null;
      dataPayload.companyName = userData.companyName || null;
      dataPayload.industry = userData.industry || null;
      dataPayload.avatarUrl = null;
      dataPayload.descriptionVisibility = 'everyone';

      finalAuthDisplayName = userData.googleDisplayName || userData.companyName || finalMentionName;
      finalAuthPhotoURL = null;

    } else {
      operationType = 'UPDATE';
      const existingData = docSnap.data() as UserProfileData;
      // console.log(`%c[connectionService] initializeUserProfile: UPDATING EXISTING PROFILE for UID ${userData.uid}. Existing data:`, "color: blue; font-weight: bold;", existingData);
      dataPayload.lastLoginAt = serverTimestamp();

      if (!existingData.mentionName || !existingData.mentionNameLowercase) {
        // console.log(`%c[connectionService] initializeUserProfile: Existing profile for ${userData.uid} missing mentionName. Generating unique one.`, "color: orange;");
        const { uniqueName, uniqueNameLower } = await findUniqueMentionName(userData.uid);
        finalMentionName = uniqueName;
        finalMentionNameLowercase = uniqueNameLower;
      } else {
        finalMentionName = existingData.mentionName;
        finalMentionNameLowercase = existingData.mentionNameLowercase;
      }
      dataPayload.mentionName = finalMentionName;
      dataPayload.mentionNameLowercase = finalMentionNameLowercase;
      
      dataPayload.email = userData.email !== undefined ? (userData.email || null) : existingData.email;
      dataPayload.companyName = userData.companyName !== undefined ? (userData.companyName || null) : existingData.companyName;
      dataPayload.industry = userData.industry !== undefined ? (userData.industry || null) : existingData.industry;
      
      if (userData.googlePhotoURL && userData.googlePhotoURL !== existingData.avatarUrl) {
        dataPayload.avatarUrl = userData.googlePhotoURL;
        finalAuthPhotoURL = userData.googlePhotoURL;
      } else {
        dataPayload.avatarUrl = existingData.avatarUrl || null;
        finalAuthPhotoURL = existingData.avatarUrl || null;
      }
      finalAuthDisplayName = userData.googleDisplayName || existingData.companyName || finalMentionName;
      dataPayload.descriptionVisibility = existingData.descriptionVisibility || 'everyone';
    }

    const dataToWrite: any = { ...dataPayload };
    Object.keys(dataToWrite).forEach(keyStr => {
      const key = keyStr as keyof typeof dataToWrite;
      if (dataToWrite[key] === undefined) {
        delete dataToWrite[key];
      }
    });
    
    // console.log(`%c[connectionService] initializeUserProfile: Data to ${operationType} to Firestore for UID ${userData.uid}:`, "color: #1E90FF; font-weight:bold;", dataToWrite);
    await setDoc(userDocRef, dataToWrite, { merge: operationType === 'UPDATE' });
    // console.log(`%c[connectionService] initializeUserProfile: User profile ${operationType}D successfully in Firestore for UID ${userData.uid}.`, "color: green; font-weight:bold;");

    if (clientAuthUser && clientAuthUser.uid === userData.uid) {
      const authProfileUpdates: { displayName?: string | null; photoURL?: string | null } = {};
      if (clientAuthUser.displayName !== finalAuthDisplayName) {
        authProfileUpdates.displayName = finalAuthDisplayName;
      }
      if (clientAuthUser.photoURL !== finalAuthPhotoURL) {
        authProfileUpdates.photoURL = finalAuthPhotoURL;
      }

      if (Object.keys(authProfileUpdates).length > 0) {
        // console.log(`%c[connectionService] initializeUserProfile: Attempting to update auth.currentUser profile with:`, "color: #FF8C00;", authProfileUpdates);
        try {
          await updateProfile(clientAuthUser, authProfileUpdates);
          // console.log(`%c[connectionService] initializeUserProfile: auth.currentUser profile updated successfully.`, "color: #FF8C00;");
        } catch (authUpdateError) {
          // console.error(`%c[connectionService] initializeUserProfile: FAILED to update auth.currentUser profile. Error:`, "color: red;", authUpdateError);
        }
      } else {
        // console.log(`%c[connectionService] initializeUserProfile: No changes needed for auth.currentUser profile.`, "color: #FF8C00;");
      }
    }

  } catch (error: any) {
    // console.error(`%c[connectionService] initializeUserProfile: Firestore Error on setDoc for UID ${userData.uid}:`, "color: red; font-weight:bold;", error);
  }
};


export const fetchUserProfileBasic = async (userIdParam: string): Promise<UserProfileBasic | null> => {
  const userId = String(userIdParam || "").trim();

  if (!userId || !IS_VALID_FIREBASE_UID_REGEX.test(userId)) {
    console.warn(`[connectionService] fetchUserProfileBasic: Invalid or empty userId provided: '${userIdParam}'. Returning null.`);
    return null;
  }

  try {
    const userDocRef = doc(usersCollectionRef, userId);
    const userSnap = await getDoc(userDocRef);

    if (userSnap.exists()) {
      const userData = userSnap.data() as UserProfileData;
      // Use mentionName if it exists, otherwise generate one. This is a good fallback.
      const mentionName = userData.mentionName || generateAnonymousName(userId);

      const profile: UserProfileBasic = {
        userId: userId,
        displayName: userData.companyName || mentionName, // Prioritize companyName, then mentionName
        mentionName: mentionName,
        avatarUrl: userData.avatarUrl || undefined,
        companyName: userData.companyName || undefined,
      };
      return profile;
    } else {
      // User document does not exist in Firestore.
      console.warn(`[connectionService] fetchUserProfileBasic: Profile document NOT FOUND for userId: '${userId}'. Returning null.`);
      return null;
    }
  } catch (error: any) {
    console.error(`[connectionService] fetchUserProfileBasic: Error fetching profile for '${userId}':`, error);
    // On any error (permission, network, etc.), return null so the UI can show a failure state.
    return null;
  }
};


export const fetchFullUserProfile = async (userIdParam: string): Promise<UserProfileData | null> => {
  const trimmedUserId = String(userIdParam || "").trim();
  const clientAuthUid = auth.currentUser?.uid;

  // // console.log(`%c[connectionService] fetchFullUserProfile: Attempting to fetch for targetUserId: '${trimmedUserId}'. Client Auth UID (at call time): '${clientAuthUid || 'NULL'}'`, "color: darkcyan; font-weight: bold;");

  if (!trimmedUserId || !IS_VALID_FIREBASE_UID_REGEX.test(trimmedUserId)) {
    // console.warn(`%c[connectionService] fetchFullUserProfile: Invalid or empty userId: '${trimmedUserId}'. Returning null.`, "color: orange;");
    return null;
  }

  try {
    const userDocRef = doc(usersCollectionRef, trimmedUserId);
    const userSnap = await getDoc(userDocRef);

    if (userSnap.exists()) {
      const userData = userSnap.data() as UserProfileData;
      const finalMentionName = userData.mentionName || generateAnonymousName(trimmedUserId);
      const finalMentionNameLowercase = (userData.mentionNameLowercase || finalMentionName).toLowerCase();


      const fullProfile: UserProfileData = {
        uid: trimmedUserId,
        email: userData.email || null,
        companyName: userData.companyName || null,
        mentionName: finalMentionName,
        mentionNameLowercase: finalMentionNameLowercase,
        avatarUrl: userData.avatarUrl || null,
        industry: userData.industry || null,
        description: userData.description || null,
        descriptionVisibility: userData.descriptionVisibility || 'everyone',
        sectorName: userData.sectorName || null,
        subSectorName: userData.subSectorName || null,
        industryName: userData.industryName || null, // NAICS industry title
        naicsCode: userData.naicsCode || null,
        tags: userData.tags || [],
        established: userData.established || null,
        verified: userData.verified || false,
        isBotAccount: userData.isBotAccount || false,
        incomeRange: userData.incomeRange || null,
        createdAt: userData.createdAt,
        lastLoginAt: userData.lastLoginAt,
        updatedAt: userData.updatedAt,
      };
      // // console.log(`%c[connectionService] fetchFullUserProfile: Full profile FOUND for '${trimmedUserId}'.`, "color: green;");
      return fullProfile;
    }
    // // console.warn(`%c[connectionService] fetchFullUserProfile: Profile document NOT FOUND for userId: '${trimmedUserId}'. Returning null.`, "color: orange;");
    return null;
  } catch (error: any) {
    const errorCatchAuthUid = auth.currentUser?.uid;
    // console.error(`%c[connectionService] fetchFullUserProfile: Error fetching full profile for '${trimmedUserId}':`, "color: red;", error);
    if (error.code === 'permission-denied') {
      // console.error(`%c  PERMISSION DENIED specifically for reading 'users/${trimmedUserId}'. Client auth state at error catch: '${errorCatchAuthUid || 'NULL'}'`, "color: red; font-weight: bold;");
    }
    return null;
  }
};

export const updateUserProfileDetails = async (
  userId: string,
  dataToUpdate: UserProfileUpdateData
): Promise<void> => {
  const trimmedUserId = String(userId || "").trim();
  if (!trimmedUserId || !IS_VALID_FIREBASE_UID_REGEX.test(trimmedUserId)) {
    // console.error("[connectionService] updateUserProfileDetails: userId is missing or invalid.");
    throw new Error("User ID is required and must be valid to update profile details.");
  }
  const clientAuthUser = auth.currentUser;
  if (!clientAuthUser || clientAuthUser.uid !== trimmedUserId) {
    // console.error(`[connectionService] updateUserProfileDetails: Auth mismatch or not authenticated. Client UID: ${clientAuthUser?.uid}, Target UserID: ${trimmedUserId}`);
    throw new Error("Authentication error: Cannot update profile for another user or without authentication.");
  }

  const userDocRef = doc(usersCollectionRef, trimmedUserId);
  // console.log(`%c[connectionService] updateUserProfileDetails: Attempting to update profile for UID ${trimmedUserId} with data:`, "color: purple", dataToUpdate);

  const sanitizedData: { [key: string]: any } = {};
  const allowedUpdateFields: (keyof UserProfileUpdateData)[] = [
    'avatarUrl', 'industry', 'description', 'descriptionVisibility', 'established', 'incomeRange',
    'sectorName', 'subSectorName', 'industryName', 'naicsCode'
  ];

  allowedUpdateFields.forEach(key => {
    const value = dataToUpdate[key as keyof UserProfileUpdateData];
    if (value !== undefined) {
      sanitizedData[key] = value === "" ? null : value;
    }
  });

  if (Object.keys(sanitizedData).length === 0) {
    // console.log(`%c[connectionService] updateUserProfileDetails: No actual data to update for UID ${trimmedUserId}. Skipping Firestore write.`, "color: orange");
    return;
  }

  sanitizedData.updatedAt = serverTimestamp();

  try {
    await updateDoc(userDocRef, sanitizedData);
    // console.log(`%c[connectionService] User profile details UPDATED successfully in Firestore for UID ${trimmedUserId}.`, "color: green;");

    if (clientAuthUser) {
      const authProfileUpdates: { displayName?: string | null; photoURL?: string | null } = {};
      const existingAuthDisplayName = clientAuthUser.displayName;
      const existingAuthPhotoURL = clientAuthUser.photoURL;

      const updatedFirestoreProfileSnap = await getDoc(userDocRef);
      const firestoreData = updatedFirestoreProfileSnap.data() as UserProfileData | undefined;

      const newAuthDisplayName = firestoreData?.companyName || firestoreData?.mentionName || existingAuthDisplayName;

      if (existingAuthDisplayName !== newAuthDisplayName) {
        authProfileUpdates.displayName = newAuthDisplayName;
      }

      if (dataToUpdate.avatarUrl !== undefined && existingAuthPhotoURL !== (dataToUpdate.avatarUrl || null)) {
        authProfileUpdates.photoURL = dataToUpdate.avatarUrl || null;
      }

      if (Object.keys(authProfileUpdates).length > 0) {
        // console.log(`%c[connectionService] updateUserProfileDetails: Attempting to update auth.currentUser profile with:`, "color: #FF8C00;", authProfileUpdates);
        await updateProfile(clientAuthUser, authProfileUpdates);
        // console.log(`%c[connectionService] updateUserProfileDetails: auth.currentUser profile updated successfully.`, "color: #FF8C00;");
      }
    }

  } catch (error: any) {
    // console.error(`%c[connectionService] updateUserProfileDetails: Firestore Error updating profile for UID ${userId}:`, "color: red;", error);
    if (error.code === 'permission-denied') {
      throw new Error('Permission denied. Check Firestore security rules for updating your user document.');
    }
    if (error.message && error.message.includes("Unsupported field value: undefined")) {
      // console.error("[connectionService] updateUserProfileDetails: Firestore received an undefined value. Data sent:", sanitizedData);
    }
    throw error;
  }
};


export const getSuggestibleUsers = async (searchPrefix?: string, limitCountArg?: number): Promise<UserProfileBasic[]> => {
  let queryablePrefix = searchPrefix?.trim().toLowerCase();
  if (queryablePrefix?.startsWith('@')) {
    queryablePrefix = queryablePrefix.substring(1);
  }

  const fieldToQueryAndOrder = 'mentionNameLowercase';
  const effectiveLimit = !queryablePrefix ? (limitCountArg || 25) : (limitCountArg || 10);

  // // console.log(`%c[connectionService] getSuggestibleUsers called. Original Prefix: '${searchPrefix}', Queryable Prefix: '${queryablePrefix}', Query Field: '${fieldToQueryAndOrder}', Effective Limit: ${effectiveLimit}`, "color: #BA55D3");
  const clientAuthUid = auth.currentUser?.uid;
  // // console.log(`%c  [connectionService] Auth state for query: auth.currentUser?.uid = ${clientAuthUid || 'NULL'}`, "color: #BA55D3;");

  try {
    const constraints: QueryConstraint[] = [];

    if (queryablePrefix && queryablePrefix.length > 0) { // Ensure prefix is not empty after stripping "@"
      // // console.log(`%c[connectionService] getSuggestibleUsers: Applying prefix search for '${queryablePrefix}' on ${fieldToQueryAndOrder}.`, "color: #BA55D3");
      constraints.push(where(fieldToQueryAndOrder, '>=', queryablePrefix));
      constraints.push(where(fieldToQueryAndOrder, '<=', queryablePrefix + '\uf8ff'));
      constraints.push(orderBy(fieldToQueryAndOrder)); // Order by the same field for prefix search
    } else {
      // // console.log(`%c[connectionService] getSuggestibleUsers: No prefix, fetching general list ordered by ${fieldToQueryAndOrder}.`, "color: #BA55D3");
      constraints.push(orderBy(fieldToQueryAndOrder)); // Default order if no prefix
    }
    constraints.push(limit(effectiveLimit));

    const q = query(usersCollectionRef, ...constraints);
    // // console.log("%c[connectionService] getSuggestibleUsers: Executing Firestore query...", "color: #BA55D3;");
    const querySnapshot = await getDocs(q);
    // // console.log(`%c[connectionService] getSuggestibleUsers: Firestore query executed. Found ${querySnapshot.docs.length} documents.`, "color: #BA55D3");

    const users: UserProfileBasic[] = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data() as UserProfileData;
      const mentionName = data.mentionName || generateAnonymousName(docSnap.id);

      const profile: UserProfileBasic = {
        userId: docSnap.id,
        displayName: data.companyName || mentionName,
        mentionName: mentionName,
        avatarUrl: data.avatarUrl || undefined,
        companyName: data.companyName || undefined,
      };
      return profile;
    });
    // // console.log(`%c[connectionService] getSuggestibleUsers: Successfully mapped ${users.length} users.`, "color: green;");
    return users;
  } catch (error: any) {
    // // console.error('%c[connectionService] Error fetching suggestible users:', "color: red;", error);
    if (error.code === 'permission-denied') {
      // // console.error('%c  PERMISSION DENIED. Check Firestore rules for listing users (users collection, list operation).', "color: red;");
      throw new Error('Permission denied fetching users. Check Firestore rules.');
    }
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
      // // console.error(`%c  MISSING INDEX. Firestore query for suggestible users requires an index on '${fieldToQueryAndOrder}' (ascending). Create this in Firebase console.`, "color: red;");
      throw new Error(`Query for suggestible users requires an index on ${fieldToQueryAndOrder} (ascending).`);
    }
    return [];
  }
};

// --- Connection Logic ---
export const sendConnectionRequest = async (requesterIdParam: string, recipientIdParam: string): Promise<void> => {
  const requesterId = String(requesterIdParam || "").trim();
  const recipientId = String(recipientIdParam || "").trim();
  const clientAuthUid = auth.currentUser?.uid;

  if (!requesterId || !IS_VALID_FIREBASE_UID_REGEX.test(requesterId)) {
    throw new Error(`Invalid requesterId: '${requesterId}'`);
  }
  if (!recipientId || !IS_VALID_FIREBASE_UID_REGEX.test(recipientId)) {
    throw new Error(`Invalid recipientId: '${recipientId}'`);
  }
  if (!clientAuthUid) {
    throw new Error("User not authenticated. Cannot send connection request.");
  }
  if (requesterId !== clientAuthUid) {
    throw new Error(`Security Alert: Requester ID parameter ('${requesterId}') does not match authenticated user UID ('${clientAuthUid}').`);
  }
  if (requesterId === recipientId) {
    throw new Error("Cannot send connection request to yourself.");
  }

  const connectionId = getConnectionDocId(requesterId, recipientId);
  if (connectionId.startsWith("INVALID_CONNECTION_ID")) {
    throw new Error(`Failed to generate valid connection ID for request. Input UIDs: '${requesterId}', '${recipientId}'.`);
  }

  const connectionDocRef = doc(mutualsCollectionRef, connectionId);
  const sortedUserIds = [requesterId, recipientId].sort();

  const newConnectionData: Omit<MutualConnection, 'id' | 'connectedAt' | 'updatedAt'> & { requestedAt: FieldValue } = {
    userIds: sortedUserIds,
    status: 'pending',
    requesterId: requesterId,
    requestedAt: serverTimestamp(),
  };

  // // console.log(`%c[connectionService] sendConnectionRequest - Pre-check:`, "color: blue;");
  // // console.log(`  Param requesterId:               '${requesterId}'`);
  // // console.log(`  Param recipientId:               '${recipientId}'`);
  // // console.log(`  Client auth.currentUser?.uid:    '${clientAuthUid || 'NULL'}'`);
  // // console.log(`%c[connectionService] sendConnectionRequest - Rule Check Values:`, "color: green;");
  // // console.log(`  1. request.auth != null:                            ${!!clientAuthUid}`);
  // // console.log(`  2. request.resource.data.requesterId == request.auth.uid: ${newConnectionData.requesterId === clientAuthUid} (Data: '${newConnectionData.requesterId}', Auth: '${clientAuthUid}')`);
  // // console.log(`  3. request.resource.data.userIds.hasAll([request.auth.uid]): ${clientAuthUid ? newConnectionData.userIds.includes(clientAuthUid) : false} (Data: [${newConnectionData.userIds.join(', ')}], Auth: '${clientAuthUid}')`);
  // // console.log(`%c[connectionService] sendConnectionRequest - Data to write:`, "color: darkorange;", newConnectionData);


  try {
    const connectionDocSnap = await getDoc(connectionDocRef);
    if (connectionDocSnap.exists()) {
      const existingStatus = connectionDocSnap.data()?.status;
      if (existingStatus === 'connected') throw new Error("You are already connected with this user.");
      if (existingStatus === 'pending') {
        const existingRequester = connectionDocSnap.data()?.requesterId;
        if (existingRequester === requesterId) throw new Error("Connection request already sent by you.");
        else throw new Error("This user already sent you a connection request. Please check your pending requests.");
      }
    }

    await setDoc(connectionDocRef, { ...newConnectionData, updatedAt: serverTimestamp() });
    // // console.log(`[connectionService] Connection request sent successfully: ${connectionId}`);

    await createNotification({
      userId: recipientId,
      type: 'connection_request',
      senderId: requesterId,
    });
    // // console.log(`[connectionService] Notification created for connection request to ${recipientId}`);

  } catch (error: any) {
    // // console.error(`%c[connectionService] Error sending connection request (${connectionId}):`, "color: red;", error);
    if (error.code === 'permission-denied') {
      // // console.error(`%c[connectionService] PERMISSION_DENIED details at time of error:`, "color: red; font-weight:bold;");
      // // console.error(`  - auth.currentUser?.uid (at error): '${auth.currentUser?.uid || 'NULL'}'`);
      // // console.error(`  - param requesterId (at error):   '${requesterId}'`);
      // // console.error(`  - Data that was attempted for write (newConnectionData variable):`, newConnectionData);
      throw new Error('Permission denied. Check Firestore rules for creating mutuals documents.');
    }
    throw new Error(`${error.message}`);
  }
};

export const acceptConnectionRequest = async (connectionId: string, acceptorId: string): Promise<void> => {
  const connectionDocRef = doc(mutualsCollectionRef, connectionId);
  // // console.log(`[connectionService] Accepting connection request: ${connectionId} by user ${acceptorId}`);
  try {
    const connectionDocSnap = await getDoc(connectionDocRef);
    if (!connectionDocSnap.exists()) throw new Error("Connection request not found.");
    const connectionData = connectionDocSnap.data();
    if (!connectionData) throw new Error("Connection data is missing.");
    if (connectionData.requesterId === acceptorId) throw new Error("Cannot accept your own connection request.");
    if (!connectionData.userIds.includes(acceptorId)) throw new Error("Acceptor is not part of this connection request.");
    if (connectionData.status !== 'pending') throw new Error("Connection request is not pending.");

    await updateDoc(connectionDocRef, { status: 'connected', connectedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    // // console.log(`[connectionService] Connection request accepted successfully: ${connectionId}`);

    const originalRequesterId = connectionData.requesterId;
    if (originalRequesterId) {
      await createNotification({
        userId: originalRequesterId,
        type: 'connection_accepted',
        senderId: acceptorId,
      });
      // // console.log(`[connectionService] Notification created for accepted connection to ${originalRequesterId}`);
    }

  } catch (error: any) {
    // // console.error(`[connectionService] Error accepting connection request (${connectionId}):`, error);
    if (error.code === 'permission-denied') throw new Error('Permission denied. Check Firestore rules for updating mutuals documents.');
    throw new Error(`Failed to accept connection request: ${error.message}`);
  }
};

export const rejectOrCancelConnectionRequest = async (connectionId: string, userId: string): Promise<void> => {
  const connectionDocRef = doc(mutualsCollectionRef, connectionId);
  // // console.log(`[connectionService] Rejecting/Cancelling connection request: ${connectionId} by user ${userId}`);
  try {
    const connectionDocSnap = await getDoc(connectionDocRef);
    if (!connectionDocSnap.exists()) throw new Error("Connection request not found.");
    const connectionData = connectionDocSnap.data();
    if (!connectionData || !connectionData.userIds.includes(userId)) throw new Error("User not part of this connection request.");
    if (connectionData.status !== 'pending') throw new Error("Cannot reject/cancel a non-pending request.");
    await deleteDoc(connectionDocRef);
    // // console.log(`[connectionService] Connection request rejected/cancelled successfully: ${connectionId}`);
  } catch (error: any) {
    // // console.error(`[connectionService] Error rejecting/cancelling connection request (${connectionId}):`, error);
    if (error.code === 'permission-denied') throw new Error('Permission denied. Check Firestore rules for deleting mutuals documents.');
    throw new Error(`Failed to reject/cancel connection request: ${error.message}`);
  }
};

export const removeConnection = async (connectionId: string, userId: string): Promise<void> => {
  const connectionDocRef = doc(mutualsCollectionRef, connectionId);
  // // console.log(`[connectionService] Removing connection: ${connectionId} by user ${userId}`);
  try {
    const connectionDocSnap = await getDoc(connectionDocRef);
    if (!connectionDocSnap.exists()) throw new Error("Connection not found.");
    const connectionData = connectionDocSnap.data();
    if (!connectionData || !connectionData.userIds.includes(userId)) throw new Error("User not part of this connection.");
    if (connectionData.status !== 'connected') throw new Error("Cannot remove a non-connected relationship.");
    await deleteDoc(connectionDocRef);
    // // console.log(`[connectionService] Connection removed successfully: ${connectionId}`);
  } catch (error: any) {
    // // console.error(`[connectionService] Error removing connection (${connectionId}):`, error);
    if (error.code === 'permission-denied') throw new Error('Permission denied. Check Firestore rules for deleting mutuals documents.');
    throw new Error(`Failed to remove connection: ${error.message}`);
  }
};


export const getConnectionStatus = async (userId1Param: string, userId2Param: string): Promise<ConnectionStatus | null> => {
  const userId1 = String(userId1Param || "").trim();
  const userId2 = String(userId2Param || "").trim();
  const currentClientAuthUid = auth.currentUser?.uid;

  // // // console.log(`%c[connectionService] getConnectionStatus called. User1: '${userId1}', User2: '${userId2}'. Auth UID: '${currentClientAuthUid || 'NULL'}'`, "color: #FF00FF");

  if (!userId1 || !userId2) {
    // // // console.warn(`%c[connectionService] getConnectionStatus: Called with empty or invalid userId. userId1: '${userId1}', userId2: '${userId2}'`, "color: orange");
    return 'not_connected';
  }
  if (userId1 === userId2) return 'self';

  if (!IS_VALID_FIREBASE_UID_REGEX.test(userId1) || !IS_VALID_FIREBASE_UID_REGEX.test(userId2)) {
    // // console.error(`%c[connectionService] getConnectionStatus: CRITICAL - One or both IDs do not look like UIDs. userId1: '${userId1}', userId2: '${userId2}'. Returning 'not_connected'.`, "color: red; font-weight: bold");
    return 'not_connected';
  }

  const connectionId = getConnectionDocId(userId1, userId2);
  if (connectionId.startsWith("INVALID_CONNECTION_ID")) {
    // // console.error(`%c[connectionService] getConnectionStatus - ERROR: Could not generate valid connectionId for ('${userId1}', '${userId2}'). Aborting.`, "color: red; font-weight:bold;");
    return 'not_connected';
  }
  const connectionDocRef = doc(mutualsCollectionRef, connectionId);

  try {
    // // // console.log(`%c  [getConnectionStatus] Attempting to getDoc for mutuals/${connectionId}. Client Auth UID: '${currentClientAuthUid || 'NULL'}'`, "color: #FF00FF;");
    const docSnap = await getDoc(connectionDocRef);
    if (!docSnap.exists()) {
      // // // console.log(`%c  [getConnectionStatus] Document mutuals/${connectionId} does not exist. Status: not_connected`, "color: #FF00FF;");
      return 'not_connected';
    }
    const data = docSnap.data();
    if (!data || !data.status || !data.requesterId || !data.userIds) {
      // // // console.warn(`%c  [getConnectionStatus] Document mutuals/${connectionId} is malformed or missing key fields. Status: not_connected`, "color: orange;");
      return 'not_connected';
    }

    if (data.status === 'connected') return 'connected';
    if (data.status === 'pending') return data.requesterId === userId1 ? 'pending_sent' : 'pending_received';
    if (data.status === 'blocked') return 'blocked';
    // // // console.log(`%c  [getConnectionStatus] Document mutuals/${connectionId} found with status: ${data.status}. Requester: ${data.requesterId}`, "color: #FF00FF;");
    return 'not_connected';
  } catch (error: any) {
    // // console.error(`[connectionService] Error fetching connection status between ${userId1} and ${userId2} (ID: ${connectionId}):`, error);
    if (error.code === 'permission-denied') {
       // // console.error(`  PERMISSION_DENIED for reading mutuals/${connectionId}. Client auth UID: '${currentClientAuthUid || 'NULL'}'. Rule expects 'userIds' in doc to contain this UID if doc exists.`);
    }
    return null;
  }
};

export const getPendingRequests = async (userId: string): Promise<ConnectionRequest[]> => {
  if (!userId || !IS_VALID_FIREBASE_UID_REGEX.test(userId)) {
    // // console.warn("[connectionService] getPendingRequests called with invalid or empty userId:", userId);
    return [];
  }
  // // console.log(`%c[connectionService] Fetching pending requests for user: ${userId}`, "color: #4682B4;");
  try {
    const q = query(
      mutualsCollectionRef,
      where('userIds', 'array-contains', userId),
      where('status', '==', 'pending'),
      orderBy('requestedAt', 'desc'),
      limit(50)
    );
    const querySnapshot = await getDocs(q);
    const requests: ConnectionRequest[] = [];

    for (const docSnap of querySnapshot.docs) {
      const data = docSnap.data() as MutualConnection; // Use MutualConnection type
      if (data.requesterId !== userId && IS_VALID_FIREBASE_UID_REGEX.test(data.requesterId)) {
        const requesterProfile = await fetchUserProfileBasic(data.requesterId);
        requests.push({
          connectionId: docSnap.id,
          requesterId: data.requesterId,
          requesterDisplayName: requesterProfile?.displayName || generateAnonymousName(data.requesterId),
          requesterAvatarUrl: requesterProfile?.avatarUrl,
          requestedAt: (data.requestedAt as Timestamp)?.toMillis() || Date.now(),
        });
      }
    }
    // // console.log(`%c[connectionService] getPendingRequests: Found ${requests.length} pending requests for user ${userId}.`, "color: green;");
    return requests;
  } catch (error: any) {
    // // console.error(`%c[connectionService] Error fetching pending requests for user ${userId}:`, "color: red;", error);
    if (error.code === 'permission-denied') {
        // // console.error("Firestore permission denied fetching pending requests. Check rules for 'mutuals' collection.");
        throw new Error('Permission denied fetching pending requests. Check Firestore rules.');
    }
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
        // // console.error("Firestore query for pending requests requires an index. Create a composite index on 'userIds' (array-contains), 'status' (==), and 'requestedAt' (desc) in the Firebase console for the 'mutuals' collection.");
        throw new Error('Firestore query requires an index for pending requests. Please create it in the Firebase console.');
    }
    throw new Error(`Failed to fetch pending requests: ${error.message}`);
  }
};

export const getConnections = async (userId: string): Promise<Connection[]> => {
  if (!userId || !IS_VALID_FIREBASE_UID_REGEX.test(userId)) {
    // // console.warn("[connectionService] getConnections called with invalid or empty userId:", userId);
    return [];
  }
  // // console.log(`%c[connectionService] Fetching connections for user: ${userId}`, "color: #2E8B57;");
  try {
    const q = query(
      mutualsCollectionRef,
      where('userIds', 'array-contains', userId),
      where('status', '==', 'connected'),
      orderBy('connectedAt', 'desc'),
      limit(100)
    );
    const querySnapshot = await getDocs(q);
    const connections: Connection[] = [];

    for (const docSnap of querySnapshot.docs) {
      const data = docSnap.data() as MutualConnection; // Use MutualConnection type
      const otherUserId = data.userIds.find((id: string) => id !== userId);
      if (otherUserId && IS_VALID_FIREBASE_UID_REGEX.test(otherUserId)) {
        const otherUserProfile = await fetchUserProfileBasic(otherUserId);
        connections.push({
          connectionId: docSnap.id,
          otherUserId: otherUserId,
          otherUserDisplayName: otherUserProfile?.displayName || generateAnonymousName(otherUserId),
          otherUserAvatarUrl: otherUserProfile?.avatarUrl,
          connectedAt: (data.connectedAt as Timestamp)?.toMillis() || Date.now(),
          status: 'connected',
          requesterId: data.requesterId,
          userIds: data.userIds,
        });
      }
    }
    // // console.log(`%c[connectionService] getConnections: Found ${connections.length} connections for user ${userId}.`, "color: green;");
    return connections;
  } catch (error: any) {
    // // console.error(`%c[connectionService] Error fetching connections for user ${userId}:`, "color: red;", error);
    if (error.code === 'permission-denied') {
        // // console.error("Firestore permission denied fetching connections. Check rules for 'mutuals' collection.");
        throw new Error('Permission denied fetching connections. Check Firestore rules.');
    }
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
        // // console.error("Firestore query for connections requires an index. Create a composite index on 'userIds' (array-contains), 'status' (==), and 'connectedAt' (desc) in the Firebase console for the 'mutuals' collection.");
        throw new Error('Firestore query requires an index for connections. Please create it in the Firebase console.');
    }
    throw new Error(`Failed to fetch connections: ${error.message}`);
  }
};


interface MutualConnection { // Added this missing interface definition from types/connection.ts for context
    id: string;
    userIds: string[];
    status: 'pending' | 'connected' | 'blocked';
    requesterId: string;
    createdAt: Timestamp | FieldValue;
    updatedAt: Timestamp | FieldValue;
    connectedAt?: Timestamp | FieldValue; // Added when status becomes 'connected'
    requestedAt?: Timestamp | FieldValue; // Specifically for pending
}
