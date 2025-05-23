// src/services/connectionService.ts
import { db, auth } from '@/lib/firebase/config';
import {
  collection,
  query,
  where,
  getDocs,
  setDoc,
  doc,
  updateDoc as firestoreUpdateDoc, // Renamed to avoid conflict with auth's updateProfile
  Timestamp,
  serverTimestamp,
  orderBy,
  limit,
  getDoc,
  deleteDoc,
  type QueryConstraint,
} from 'firebase/firestore';
import {
  updateProfile, // For Firebase Auth user profile
} from 'firebase/auth';
import type { ConnectionStatus, Connection, ConnectionRequest, UserProfileBasic, UserProfileData } from '@/types/connection';
import { generateAnonymousName } from '@/lib/pseudonymUtils';
import { createNotification } from './notificationService';

const mutualsCollectionRef = collection(db, 'mutuals');
const usersCollectionRef = collection(db, 'users');
const IS_UID_REGEX_SERVICE = /^[a-zA-Z0-9]{20,}$/;

const getConnectionDocId = (userId1: string, userId2: string): string => {
  const id1 = String(userId1 || "").trim();
  const id2 = String(userId2 || "").trim();
  if (!id1 || !id2 || !IS_UID_REGEX_SERVICE.test(id1) || !IS_UID_REGEX_SERVICE.test(id2)) {
    console.error(`%c[connectionService] getConnectionDocId CRITICAL: Called with invalid UID(s). userId1: '${id1}', userId2: '${id2}'. This will result in an invalid/unexpected document ID.`, "color: red; font-weight: bold;");
    return `INVALID_CONNECTION_ID_DUE_TO_BAD_UIDS_${id1}_${id2}`;
  }
  return [id1, id2].sort().join('_');
};

export interface InitializeUserProfileArgs {
  uid: string;
  email?: string | null;
  googleDisplayName?: string | null; // Name specifically from Google
  companyName?: string | null;    // Name from email sign-up form
  industry?: string | null;       // Industry from email sign-up form
  googlePhotoURL?: string | null;   // Photo URL from Google
}

export const initializeUserProfile = async (userData: InitializeUserProfileArgs): Promise<void> => {
  const clientAuthUser = auth.currentUser;
  console.log(`%c[connectionService] initializeUserProfile: Called. Client auth UID: ${clientAuthUser?.uid || 'NULL'}. Incoming userData:`, "color: orange", userData);

  if (!userData.uid || !IS_UID_REGEX_SERVICE.test(userData.uid)) {
    console.error('%c[connectionService] initializeUserProfile: ERROR - UID is missing or invalid in userData. Aborting.', "color: red; font-weight:bold;", userData);
    return;
  }

  const userDocRef = doc(usersCollectionRef, userData.uid);
  const generatedMentionName = generateAnonymousName(userData.uid);

  try {
    console.log(`%c[connectionService] initializeUserProfile: Checking for existing document for UID ${userData.uid}...`, "color: orange");
    const docSnap = await getDoc(userDocRef);

    let dataPayload: Partial<UserProfileData> = { uid: userData.uid };
    let operationType: 'CREATE' | 'UPDATE' = 'CREATE';

    let finalAuthProfileDisplayName: string;
    let finalAuthProfilePhotoURL: string | null = null;

    if (!docSnap.exists()) {
      console.log(`%c[connectionService] initializeUserProfile: CREATING NEW PROFILE for UID ${userData.uid}.`, "color: green; font-weight: bold;");
      operationType = 'CREATE';
      dataPayload.createdAt = serverTimestamp();
      dataPayload.mentionName = generatedMentionName;
      dataPayload.email = userData.email || null;
      dataPayload.companyName = userData.companyName || null;
      dataPayload.actualDisplayName = userData.googleDisplayName || null;
      dataPayload.industry = userData.industry || null;
      dataPayload.avatarUrl = null; // New users start with no avatar
      dataPayload.descriptionVisibility = 'everyone';
      dataPayload.established = null; // New field

      finalAuthProfileDisplayName = userData.googleDisplayName || userData.companyName || generatedMentionName;
      finalAuthProfilePhotoURL = null; // No avatar on initial creation
    } else {
      operationType = 'UPDATE';
      const existingData = docSnap.data() as UserProfileData;
      console.log(`%c[connectionService] initializeUserProfile: UPDATING EXISTING PROFILE for UID ${userData.uid}. Existing data:`, "color: blue; font-weight: bold;", existingData);

      dataPayload.mentionName = existingData.mentionName || generatedMentionName;
      dataPayload.companyName = userData.companyName !== undefined ? (userData.companyName || null) : existingData.companyName;
      dataPayload.actualDisplayName = userData.googleDisplayName !== undefined ? (userData.googleDisplayName || null) : existingData.actualDisplayName;
      dataPayload.industry = userData.industry !== undefined ? (userData.industry || null) : existingData.industry;
      
      if (userData.googlePhotoURL && userData.googlePhotoURL !== existingData.avatarUrl) {
        finalAuthProfilePhotoURL = userData.googlePhotoURL;
      } else {
        finalAuthProfilePhotoURL = existingData.avatarUrl || null;
      }
      dataPayload.avatarUrl = finalAuthProfilePhotoURL; // Use existing or updated Google photo for subsequent logins
      
      dataPayload.descriptionVisibility = existingData.descriptionVisibility || 'everyone';
      dataPayload.description = existingData.description || null;
      dataPayload.tags = existingData.tags || [];
      dataPayload.location = existingData.location || null;
      dataPayload.established = existingData.established || null; // Preserve or initialize established
      dataPayload.contactEmail = existingData.contactEmail || null;
      dataPayload.contactPhone = existingData.contactPhone || null;
      dataPayload.verified = existingData.verified || false;
      dataPayload.incomeRange = existingData.incomeRange || null;


      finalAuthProfileDisplayName = dataPayload.actualDisplayName || dataPayload.companyName || dataPayload.mentionName || generatedMentionName;
    }

    dataPayload.lastLoginAt = serverTimestamp();
    dataPayload.updatedAt = serverTimestamp();

    const dataToWrite = { ...dataPayload };
    Object.keys(dataToWrite).forEach(keyStr => {
      const key = keyStr as keyof UserProfileData;
      if (dataToWrite[key] === undefined) {
        delete dataToWrite[key];
      }
    });
    
    console.log(`%c[connectionService] initializeUserProfile: Data to ${operationType} to Firestore for UID ${userData.uid}:`, "color: #1E90FF; font-weight:bold;", dataToWrite);
    await setDoc(userDocRef, dataToWrite, { merge: operationType === 'UPDATE' });
    console.log(`%c[connectionService] initializeUserProfile: User profile ${operationType}D successfully in Firestore for UID ${userData.uid}.`, "color: green; font-weight:bold;");

    if (clientAuthUser && clientAuthUser.uid === userData.uid) {
      const authProfileUpdates: { displayName?: string | null; photoURL?: string | null } = {};
      const currentAuthDisplayName = clientAuthUser.displayName;
      const currentAuthPhotoURL = clientAuthUser.photoURL;

      if (currentAuthDisplayName !== finalAuthProfileDisplayName) {
        authProfileUpdates.displayName = finalAuthProfileDisplayName;
      }
      // For new sign-ups (Google or email), ensure photoURL on Auth object is also null to match avatarUrl
      if (operationType === 'CREATE' && currentAuthPhotoURL !== null) {
        authProfileUpdates.photoURL = null;
      } else if (operationType === 'UPDATE' && currentAuthPhotoURL !== finalAuthProfilePhotoURL) {
        authProfileUpdates.photoURL = finalAuthProfilePhotoURL;
      }

      if (Object.keys(authProfileUpdates).length > 0) {
        console.log(`%c[connectionService] initializeUserProfile: Attempting to update auth.currentUser profile with:`, "color: #FF8C00;", authProfileUpdates);
        try {
          await updateProfile(clientAuthUser, authProfileUpdates);
          console.log(`%c[connectionService] initializeUserProfile: auth.currentUser profile updated successfully.`, "color: #FF8C00;");
        } catch (authUpdateError) {
          console.error(`%c[connectionService] initializeUserProfile: FAILED to update auth.currentUser profile. Error:`, "color: red;", authUpdateError);
        }
      } else {
        console.log(`%c[connectionService] initializeUserProfile: No changes needed for auth.currentUser profile.`, "color: #FF8C00;");
      }
    }
  } catch (error: any) {
    console.error(`%c[connectionService] initializeUserProfile: Firestore Error on setDoc for UID ${userData.uid}:`, "color: red; font-weight:bold;", error);
  }
};

export const fetchUserProfileBasic = async (userIdParam: string): Promise<UserProfileBasic | null> => {
  const userId = String(userIdParam || "").trim();
  const clientAuthUid = auth.currentUser?.uid;
  console.log(`%c[connectionService] fetchUserProfileBasic: Fetching for targetUserId: '${userId}'. Client Auth UID: '${clientAuthUid || 'NULL'}'`, "color: teal;");

  if (!userId || !IS_UID_REGEX_SERVICE.test(userId)) {
    console.warn(`%c[connectionService] fetchUserProfileBasic: Invalid or empty userId: '${userId}'. Returning null.`, "color: orange;");
    return null;
  }

  try {
    const userDocRef = doc(usersCollectionRef, userId);
    const userSnap = await getDoc(userDocRef);

    if (userSnap.exists()) {
      const userData = userSnap.data() as UserProfileData;
      const mentionName = userData.mentionName || generateAnonymousName(userId); // Fallback if mentionName is somehow missing
      const primaryDisplayName = userData.actualDisplayName || userData.companyName || mentionName;

      const profile: UserProfileBasic = {
        userId: userId,
        displayName: primaryDisplayName,
        mentionName: mentionName,
        avatarUrl: userData.avatarUrl || undefined,
        actualDisplayName: userData.actualDisplayName || undefined,
        companyName: userData.companyName || undefined,
      };
      console.log(`%c[connectionService] fetchUserProfileBasic: Profile FOUND for '${userId}':`, "color: green;", profile);
      return profile;
    }
    console.warn(`%c[connectionService] fetchUserProfileBasic: Profile document NOT FOUND for userId: '${userId}'. Generating anonymous fallback.`, "color: orange;");
    const anonMentionName = generateAnonymousName(userId);
    return { userId: userId, displayName: anonMentionName, mentionName: anonMentionName, avatarUrl: undefined, actualDisplayName: undefined, companyName: undefined };
  } catch (error: any) {
    const errorCatchAuthUid = auth.currentUser?.uid;
    console.error(`%c[connectionService] fetchUserProfileBasic: Error fetching profile for '${userId}':`, "color: red;", error);
    if (error.code === 'permission-denied') {
      console.error(`%c  PERMISSION DENIED specifically for reading 'users/${userId}'. Client auth state at error catch: '${errorCatchAuthUid || 'NULL'}'`, "color: red; font-weight: bold;");
    }
    const anonMentionName = generateAnonymousName(userId); // Fallback on error
    return { userId: userId, displayName: anonMentionName, mentionName: anonMentionName, avatarUrl: undefined, actualDisplayName: undefined, companyName: undefined };
  }
};

export const fetchFullUserProfile = async (userIdParam: string): Promise<UserProfileData | null> => {
  const trimmedUserId = String(userIdParam || "").trim();
  const functionCallAuthUid = auth.currentUser?.uid;

  console.log(`%c[connectionService] fetchFullUserProfile: Attempting to fetch for targetUserId: '${trimmedUserId}'. Client auth UID: '${functionCallAuthUid || 'NULL'}'`, "color: darkcyan; font-weight: bold;");
  if (!trimmedUserId || !IS_UID_REGEX_SERVICE.test(trimmedUserId)) {
    console.warn(`%c[connectionService] fetchFullUserProfile: Invalid or empty userId: '${trimmedUserId}'. Returning null.`, "color: orange;");
    return null;
  }

  try {
    const userDocRef = doc(usersCollectionRef, trimmedUserId);
    const userSnap = await getDoc(userDocRef);

    if (userSnap.exists()) {
      const userData = userSnap.data() as UserProfileData;
      const finalMentionName = userData.mentionName || generateAnonymousName(trimmedUserId);

      const fullProfile: UserProfileData = {
        uid: trimmedUserId,
        email: userData.email || null,
        companyName: userData.companyName || null,
        mentionName: finalMentionName,
        actualDisplayName: userData.actualDisplayName || null,
        industry: userData.industry || null,
        avatarUrl: userData.avatarUrl || null,
        description: userData.description || null,
        descriptionVisibility: userData.descriptionVisibility || 'everyone',
        tags: userData.tags || [],
        location: userData.location || null,
        established: userData.established || null, // Include established
        contactEmail: userData.contactEmail || null,
        contactPhone: userData.contactPhone || null,
        verified: userData.verified || false,
        createdAt: userData.createdAt,
        lastLoginAt: userData.lastLoginAt,
        updatedAt: userData.updatedAt,
        incomeRange: userData.incomeRange || null,
      };
      console.log(`%c[connectionService] fetchFullUserProfile: Full profile FOUND for '${trimmedUserId}'.`, "color: green;");
      return fullProfile;
    }
    console.warn(`%c[connectionService] fetchFullUserProfile: Profile document NOT FOUND for userId: '${trimmedUserId}'. Returning null.`, "color: orange;");
    return null;
  } catch (error: any) {
    const clientAuthUid = auth.currentUser?.uid;
    console.error(`%c[connectionService] fetchFullUserProfile: Error fetching full profile for '${trimmedUserId}':`, "color: red;", error);
    if (error.code === 'permission-denied') {
      console.error(`%c  PERMISSION DENIED specifically for reading 'users/${trimmedUserId}'. Client auth state: '${clientAuthUid || 'NULL'}'`, "color: red; font-weight: bold;");
    }
    return null;
  }
};

export type UserProfileUpdateData = Partial<Pick<UserProfileData,
  'industry' |
  'description' |
  'descriptionVisibility' |
  'avatarUrl' |
  'established' | // Added established
  'incomeRange'
  // Removed fields that are no longer editable via profile settings form:
  // 'actualDisplayName', 'companyName', 
  // 'actualDisplayNameVisibility', 'companyNameVisibility', 
  // 'avatarVisibility', 'industryVisibility'
>>;

export const updateUserProfileDetails = async (
  userId: string,
  dataToUpdate: UserProfileUpdateData
): Promise<void> => {
  const trimmedUserId = String(userId || "").trim();
  if (!trimmedUserId || !IS_UID_REGEX_SERVICE.test(trimmedUserId)) {
    console.error("[connectionService] updateUserProfileDetails: userId is missing or invalid.");
    throw new Error("User ID is required and must be valid to update profile details.");
  }
  const clientAuthUser = auth.currentUser;
  if (!clientAuthUser || clientAuthUser.uid !== trimmedUserId) {
    console.error(`[connectionService] updateUserProfileDetails: Auth mismatch or not authenticated. Client UID: ${clientAuthUser?.uid}, Target UserID: ${trimmedUserId}`);
    throw new Error("Authentication error: Cannot update profile for another user or without authentication.");
  }

  const userDocRef = doc(usersCollectionRef, trimmedUserId);
  console.log(`%c[connectionService] updateUserProfileDetails: Attempting to update profile for UID ${trimmedUserId} with data:`, "color: purple", dataToUpdate);

  const sanitizedData: { [key: string]: any } = {};
  // Define fields allowed for update from settings page
  const allowedUpdateFields: (keyof UserProfileUpdateData)[] = [
      'industry', 'description', 'descriptionVisibility', 'avatarUrl', 'established', 'incomeRange'
  ];

  allowedUpdateFields.forEach(key => {
    const value = dataToUpdate[key];
    if (value !== undefined) {
      sanitizedData[key] = value; 
    }
  });

  if (Object.keys(sanitizedData).length === 0) {
     console.log(`%c[connectionService] updateUserProfileDetails: No actual data to update for UID ${trimmedUserId}. Skipping Firestore write.`, "color: orange");
     return;
  }

  sanitizedData.updatedAt = serverTimestamp();

  try {
    await firestoreUpdateDoc(userDocRef, sanitizedData); // Use aliased firestoreUpdateDoc
    console.log(`%c[connectionService] User profile details UPDATED successfully in Firestore for UID ${trimmedUserId}.`, "color: green;");

    // Update Firebase Auth profile (displayName and photoURL)
    if (clientAuthUser) {
      const authProfileUpdates: { displayName?: string | null; photoURL?: string | null } = {};
      const existingAuthDisplayName = clientAuthUser.displayName;
      const existingAuthPhotoURL = clientAuthUser.photoURL;

      // Determine new auth display name based on Firestore data (after update)
      const updatedFirestoreProfile = await fetchFullUserProfile(trimmedUserId); // Fetch fresh data
      const newAuthDisplayName = updatedFirestoreProfile?.actualDisplayName || updatedFirestoreProfile?.companyName || updatedFirestoreProfile?.mentionName || existingAuthDisplayName;
      
      if (existingAuthDisplayName !== newAuthDisplayName) {
        authProfileUpdates.displayName = newAuthDisplayName;
      }

      // Update photoURL if avatarUrl was part of the update
      if (dataToUpdate.avatarUrl !== undefined && existingAuthPhotoURL !== (dataToUpdate.avatarUrl || null)) {
        authProfileUpdates.photoURL = dataToUpdate.avatarUrl || null;
      }

      if (Object.keys(authProfileUpdates).length > 0) {
        console.log(`%c[connectionService] updateUserProfileDetails: Attempting to update auth.currentUser profile with:`, "color: #FF8C00;", authProfileUpdates);
        await updateProfile(clientAuthUser, authProfileUpdates);
        console.log(`%c[connectionService] updateUserProfileDetails: auth.currentUser profile updated successfully.`, "color: #FF8C00;");
      }
    }

  } catch (error: any) {
    console.error(`%c[connectionService] updateUserProfileDetails: Firestore Error updating profile for UID ${userId}:`, "color: red;", error);
    if (error.code === 'permission-denied') {
      throw new Error('Permission denied. Check Firestore security rules for updating your user document.');
    }
    if (error.message && error.message.includes("Unsupported field value: undefined")) {
      console.error("[connectionService] updateUserProfileDetails: Firestore received an undefined value. Data sent:", sanitizedData);
    }
    throw new Error(`Failed to update profile details: ${error.message}`);
  }
};

// Other connection functions (sendConnectionRequest, acceptConnectionRequest, etc.) remain below

export const getSuggestibleUsers = async (searchPrefix?: string, limitCountArg?: number): Promise<UserProfileBasic[]> => {
  const trimmedPrefix = searchPrefix?.trim().toLowerCase();
  // Fetch more if no prefix to allow better initial suggestion list
  const effectiveLimit = !trimmedPrefix ? (limitCountArg || 25) : (limitCountArg || 10); 
  const fieldToQueryAndOrder = 'mentionName'; // Always use mentionName for querying/suggesting

  console.log(`%c[connectionService] getSuggestibleUsers called. Prefix: '${trimmedPrefix}', Query Field: '${fieldToQueryAndOrder}', Effective Limit: ${effectiveLimit}`, "color: #BA55D3");

  try {
    const constraints: QueryConstraint[] = [];

    if (trimmedPrefix) {
      console.log(`%c[connectionService] getSuggestibleUsers: Applying prefix search for '${trimmedPrefix}' on ${fieldToQueryAndOrder}.`, "color: #BA55D3");
      constraints.push(where(fieldToQueryAndOrder, '>=', trimmedPrefix));
      constraints.push(where(fieldToQueryAndOrder, '<=', trimmedPrefix + '\uf8ff')); // Standard prefix search
      constraints.push(orderBy(fieldToQueryAndOrder)); // Order by the same field
    } else {
      console.log(`%c[connectionService] getSuggestibleUsers: No prefix, fetching general list ordered by ${fieldToQueryAndOrder}.`, "color: #BA55D3");
      constraints.push(orderBy(fieldToQueryAndOrder)); // Order by mentionName for general list
    }
    constraints.push(limit(effectiveLimit));

    const q = query(usersCollectionRef, ...constraints);
    console.log("%c[connectionService] getSuggestibleUsers: Executing Firestore query...", "color: #BA55D3;");
    const querySnapshot = await getDocs(q);
    console.log(`%c[connectionService] getSuggestibleUsers: Firestore query executed. Found ${querySnapshot.docs.length} documents.`, "color: #BA55D3");

    const users: UserProfileBasic[] = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data() as UserProfileData;
      const mentionName = data.mentionName || generateAnonymousName(docSnap.id); // Fallback for older docs
      const primaryDisplayName = data.actualDisplayName || data.companyName || mentionName; // Fallback for general display

      const profile: UserProfileBasic = {
        userId: docSnap.id,
        displayName: primaryDisplayName,
        mentionName: mentionName, // This is the ColorAnimalNumber
        avatarUrl: data.avatarUrl || undefined,
        actualDisplayName: data.actualDisplayName || undefined,
        companyName: data.companyName || undefined,
      };
      return profile;
    });
    console.log(`%c[connectionService] getSuggestibleUsers: Successfully mapped ${users.length} users. Example:`, "color: green;", users.slice(0,1));
    return users;
  } catch (error: any) {
    console.error('%c[connectionService] Error fetching suggestible users:', "color: red;", error);
    if (error.code === 'permission-denied') {
      console.error('%c  PERMISSION DENIED. Check Firestore rules for listing users (users collection, list operation).', "color: red;");
      throw new Error('Permission denied fetching users. Check Firestore rules.');
    }
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
      console.error(`%c  MISSING INDEX. Firestore query for suggestible users requires an index on '${fieldToQueryAndOrder}' (ascending). Create this in Firebase console.`, "color: red;");
      throw new Error(`Query for suggestible users requires an index on ${fieldToQueryAndOrder} (ascending).`);
    }
    return [];
  }
};


export const sendConnectionRequest = async (requesterIdParam: string, recipientIdParam: string): Promise<void> => {
  const requesterId = String(requesterIdParam || "").trim();
  const recipientId = String(recipientIdParam || "").trim();
  const clientAuthUid = auth.currentUser?.uid;

  console.log(`%c[connectionService] sendConnectionRequest - Pre-check:`, "color: blue;");
  console.log(`  Param requesterId:               '${requesterId}'`);
  console.log(`  Param recipientId:               '${recipientId}'`);
  console.log(`  Client auth.currentUser?.uid:    '${clientAuthUid || 'NULL'}'`);

  if (!clientAuthUid) {
    const errorMsg = "User not authenticated. Cannot send connection request.";
    console.error(`%c[connectionService] sendConnectionRequest - ERROR: ${errorMsg}. Auth state:`, "color: red; font-weight:bold;", auth.currentUser);
    throw new Error(errorMsg);
  }
  if (requesterId !== clientAuthUid) {
    const errorMsg = `Security Alert: Requester ID parameter ('${requesterId}') does not match authenticated user UID ('${clientAuthUid}'). Aborting.`;
    console.error(`%c[connectionService] sendConnectionRequest - ERROR: ${errorMsg}`, "color: red; font-weight:bold;");
    throw new Error(errorMsg);
  }
  if (requesterId === recipientId) {
    const errorMsg = "Cannot send connection request to yourself.";
    console.error(`%c[connectionService] sendConnectionRequest - ERROR: ${errorMsg}`, "color: red; font-weight:bold;");
    throw new Error(errorMsg);
  }

  if (!IS_UID_REGEX_SERVICE.test(requesterId) || !IS_UID_REGEX_SERVICE.test(recipientId)) {
    const errorMsg = `Invalid user ID format. Cannot send connection request. Requester: '${requesterId}', Recipient: '${recipientId}'.`;
    console.error(`%c[connectionService] sendConnectionRequest - ERROR: ${errorMsg}`, "color: red; font-weight:bold;");
    throw new Error(errorMsg);
  }

  const connectionId = getConnectionDocId(requesterId, recipientId);
   if (connectionId.startsWith("INVALID_CONNECTION_ID")) {
    const errorMsg = `Failed to generate valid connection ID for request. Input UIDs: '${requesterId}', '${recipientId}'.`;
    console.error(`%c[connectionService] sendConnectionRequest - ERROR: ${errorMsg}`, "color: red; font-weight:bold;");
    throw new Error(errorMsg);
  }

  const connectionDocRef = doc(mutualsCollectionRef, connectionId);
  const sortedUserIds = [requesterId, recipientId].sort();

  const newConnectionData = {
    userIds: sortedUserIds,
    status: 'pending',
    requesterId: requesterId,
    requestedAt: serverTimestamp(),
  };

  console.log(`%c[connectionService] sendConnectionRequest - Rule Check Values (Client-side perspective for Firestore 'create' rule on /mutuals/{connectionId}):`, "color: green;");
  console.log(`  1. request.auth != null:                            ${!!clientAuthUid}`);
  console.log(`  2. request.resource.data.requesterId == request.auth.uid: ${newConnectionData.requesterId === clientAuthUid} (Data: '${newConnectionData.requesterId}', Auth: '${clientAuthUid}')`);
  console.log(`  3. request.resource.data.userIds.hasAll([request.auth.uid]): ${clientAuthUid ? newConnectionData.userIds.includes(clientAuthUid) : false} (Data: [${newConnectionData.userIds.join(', ')}], Auth: '${clientAuthUid}')`);

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
    const finalAuthCheckUser = auth.currentUser;
    if (!finalAuthCheckUser || finalAuthCheckUser.uid !== requesterId) {
      const errorMsg = "User authentication lost or changed immediately before Firestore write. Aborting.";
      console.error(`%c[connectionService] sendConnectionRequest - FATAL ERROR: ${errorMsg}. Expected auth UID: '${requesterId}', Got: '${finalAuthCheckUser?.uid || 'NULL'}'`, "color: red; font-weight:bold;");
      throw new Error(errorMsg);
    }
    console.log(`%c[connectionService] Final auth check passed with UID: '${finalAuthCheckUser.uid}'. Attempting to write to Firestore. Path: mutuals/${connectionId}. Data:`, "color: darkorange;", newConnectionData);

    await setDoc(connectionDocRef, newConnectionData);
    console.log(`[connectionService] Connection request sent successfully: ${connectionId}`);

    await createNotification({
      userId: recipientId,
      type: 'connection_request',
      senderId: requesterId,
    });
    console.log(`[connectionService] Notification created for connection request to ${recipientId}`);

  } catch (error: any) {
    console.error(`%c[connectionService] Error sending connection request (${connectionId}):`, "color: red;", error);
    if (error.code === 'permission-denied') {
      console.error(`%c[connectionService] PERMISSION_DENIED details at time of error:`, "color: red; font-weight:bold;");
      console.error(`  - auth.currentUser?.uid (at error): '${auth.currentUser?.uid || 'NULL'}'`);
      console.error(`  - param requesterId (at error):   '${requesterId}'`);
      console.error(`  - Data that was attempted for write (newConnectionData variable):`, newConnectionData);
      throw new Error('Permission denied. Check Firestore rules for creating mutuals documents.');
    }
    throw new Error(`${error.message}`);
  }
};

export const acceptConnectionRequest = async (connectionId: string, acceptorId: string): Promise<void> => {
  const connectionDocRef = doc(mutualsCollectionRef, connectionId);
  console.log(`[connectionService] Accepting connection request: ${connectionId} by user ${acceptorId}`);
  try {
    const connectionDocSnap = await getDoc(connectionDocRef);
    if (!connectionDocSnap.exists()) throw new Error("Connection request not found.");
    const connectionData = connectionDocSnap.data();
    if (!connectionData) throw new Error("Connection data is missing.");
    if (connectionData.requesterId === acceptorId) throw new Error("Cannot accept your own connection request.");
    if (!connectionData.userIds.includes(acceptorId)) throw new Error("Acceptor is not part of this connection request.");
    if (connectionData.status !== 'pending') throw new Error("Connection request is not pending.");

    await firestoreUpdateDoc(connectionDocRef, { status: 'connected', connectedAt: serverTimestamp() });
    console.log(`[connectionService] Connection request accepted successfully: ${connectionId}`);

    const originalRequesterId = connectionData.requesterId;
    if (originalRequesterId) {
      await createNotification({
        userId: originalRequesterId,
        type: 'connection_accepted',
        senderId: acceptorId,
      });
      console.log(`[connectionService] Notification created for accepted connection to ${originalRequesterId}`);
    }

  } catch (error: any) {
    console.error(`[connectionService] Error accepting connection request (${connectionId}):`, error);
    if (error.code === 'permission-denied') throw new Error('Permission denied. Check Firestore rules for updating mutuals documents.');
    throw new Error(`Failed to accept connection request: ${error.message}`);
  }
};

export const rejectOrCancelConnectionRequest = async (connectionId: string, userId: string): Promise<void> => {
  const connectionDocRef = doc(mutualsCollectionRef, connectionId);
  console.log(`[connectionService] Rejecting/Cancelling connection request: ${connectionId} by user ${userId}`);
  try {
    const connectionDocSnap = await getDoc(connectionDocRef);
    if (!connectionDocSnap.exists()) throw new Error("Connection request not found.");
    const connectionData = connectionDocSnap.data();
    if (!connectionData || !connectionData.userIds.includes(userId)) throw new Error("User not part of this connection request.");
    if (connectionData.status !== 'pending') throw new Error("Cannot reject/cancel a non-pending request.");
    await deleteDoc(connectionDocRef);
    console.log(`[connectionService] Connection request rejected/cancelled successfully: ${connectionId}`);
  } catch (error: any) {
    console.error(`[connectionService] Error rejecting/cancelling connection request (${connectionId}):`, error);
    if (error.code === 'permission-denied') throw new Error('Permission denied. Check Firestore rules for deleting mutuals documents.');
    throw new Error(`Failed to reject/cancel connection request: ${error.message}`);
  }
};

export const removeConnection = async (connectionId: string, userId: string): Promise<void> => {
  const connectionDocRef = doc(mutualsCollectionRef, connectionId);
  console.log(`[connectionService] Removing connection: ${connectionId} by user ${userId}`);
  try {
    const connectionDocSnap = await getDoc(connectionDocRef);
    if (!connectionDocSnap.exists()) throw new Error("Connection not found.");
    const connectionData = connectionDocSnap.data();
    if (!connectionData || !connectionData.userIds.includes(userId)) throw new Error("User not part of this connection.");
    if (connectionData.status !== 'connected') throw new Error("Cannot remove a non-connected relationship.");
    await deleteDoc(connectionDocRef);
    console.log(`[connectionService] Connection removed successfully: ${connectionId}`);
  } catch (error: any) {
    console.error(`[connectionService] Error removing connection (${connectionId}):`, error);
    if (error.code === 'permission-denied') throw new Error('Permission denied. Check Firestore rules for deleting mutuals documents.');
    throw new Error(`Failed to remove connection: ${error.message}`);
  }
};

export const getConnectionStatus = async (userId1Param: string, userId2Param: string): Promise<ConnectionStatus | null> => {
  const userId1 = String(userId1Param || "").trim();
  const userId2 = String(userId2Param || "").trim();
  const currentClientAuthUid = auth.currentUser?.uid;

  console.log(`%c[connectionService] getConnectionStatus called. User1: '${userId1}', User2: '${userId2}'. Auth UID: '${currentClientAuthUid || 'NULL'}'`, "color: #FF00FF");

  if (!userId1 || !userId2) {
    console.warn(`%c[connectionService] getConnectionStatus: Called with empty or invalid userId. userId1: '${userId1}', userId2: '${userId2}'`, "color: orange");
    return 'not_connected';
  }
  if (userId1 === userId2) return 'self';

  if (!IS_UID_REGEX_SERVICE.test(userId1) || !IS_UID_REGEX_SERVICE.test(userId2)) {
    console.error(`%c[connectionService] getConnectionStatus: CRITICAL - One or both IDs do not look like UIDs. userId1: '${userId1}', userId2: '${userId2}'. Returning 'not_connected'. This will cause issues.`, "color: red; font-weight: bold");
    return 'not_connected';
  }

  const connectionId = getConnectionDocId(userId1, userId2);
  if (connectionId.startsWith("INVALID_CONNECTION_ID")) {
    console.error(`%c[connectionService] getConnectionStatus - ERROR: Could not generate valid connectionId due to invalid input UIDs ('${userId1}', '${userId2}'). Aborting.`, "color: red; font-weight:bold;");
    return 'not_connected';
  }
  const connectionDocRef = doc(mutualsCollectionRef, connectionId);

  try {
    const docSnap = await getDoc(connectionDocRef);
    if (!docSnap.exists()) {
      return 'not_connected';
    }
    const data = docSnap.data();
    if (!data || !data.status || !data.requesterId || !data.userIds) {
      console.warn(`[connectionService] Connection document ${connectionId} is malformed or missing key fields.`);
      return 'not_connected';
    }
    if (data.status === 'connected') return 'connected';
    if (data.status === 'pending') return data.requesterId === userId1 ? 'pending_sent' : 'pending_received';
    if (data.status === 'blocked') return 'blocked'; // Assuming 'blocked' is a possible status
    return 'not_connected';
  } catch (error: any) {
    console.error(`[connectionService] Error fetching connection status between ${userId1} and ${userId2} (ID: ${connectionId}):`, error);
    if (error.code === 'permission-denied') {
       console.error(`  PERMISSION_DENIED for reading mutuals/${connectionId}. Client auth UID: '${currentClientAuthUid || 'NULL'}'. Rule expects 'userIds' in doc to contain this UID if doc exists, or (resource == null) for non-existent docs.`);
    }
    return null; // Return null on error to distinguish from 'not_connected'
  }
};

export const getPendingRequests = async (userId: string): Promise<ConnectionRequest[]> => {
  if (!userId || !IS_UID_REGEX_SERVICE.test(userId)) {
    console.warn("[connectionService] getPendingRequests called with invalid or empty userId:", userId);
    return [];
  }
  console.log(`[connectionService] Fetching pending requests for user: ${userId}`);
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
      const data = docSnap.data();
      if (data.requesterId !== userId && IS_UID_REGEX_SERVICE.test(data.requesterId)) {
        const requesterProfile = await fetchUserProfileBasic(data.requesterId);
        requests.push({
          connectionId: docSnap.id,
          requesterId: data.requesterId,
          requesterDisplayName: requesterProfile?.mentionName || generateAnonymousName(data.requesterId), // Prioritize mentionName
          requesterAvatarUrl: requesterProfile?.avatarUrl,
          requestedAt: (data.requestedAt as Timestamp)?.toMillis() || Date.now(),
        });
      }
    }
    console.log(`%c[connectionService] getPendingRequests: Found ${requests.length} pending requests for user ${userId}.`, "color: green;");
    return requests;
  } catch (error: any) {
    console.error(`%c[connectionService] Error fetching pending requests for user ${userId}:`, "color: red;", error);
    if (error.code === 'permission-denied') {
        console.error("Firestore permission denied fetching pending requests. Check rules for 'mutuals' collection.");
        throw new Error('Permission denied fetching pending requests. Check Firestore rules.');
    }
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
        console.error("Firestore query for pending requests requires an index. Create a composite index on 'userIds' (array-contains), 'status' (==), and 'requestedAt' (desc) in the Firebase console for the 'mutuals' collection.");
        throw new Error('Firestore query requires an index. Please create it in the Firebase console.');
    }
    throw new Error(`Failed to fetch pending requests: ${error.message}`);
  }
};

export const getConnections = async (userId: string): Promise<Connection[]> => {
  if (!userId || !IS_UID_REGEX_SERVICE.test(userId)) {
    console.warn("[connectionService] getConnections called with invalid or empty userId:", userId);
    return [];
  }
  console.log(`[connectionService] Fetching connections for user: ${userId}`);
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
      const data = docSnap.data();
      const otherUserId = data.userIds.find((id: string) => id !== userId);
      if (otherUserId && IS_UID_REGEX_SERVICE.test(otherUserId)) {
        const otherUserProfile = await fetchUserProfileBasic(otherUserId);
        connections.push({
          connectionId: docSnap.id,
          otherUserId: otherUserId,
          otherUserDisplayName: otherUserProfile?.mentionName || generateAnonymousName(otherUserId), // Prioritize mentionName
          otherUserAvatarUrl: otherUserProfile?.avatarUrl,
          connectedAt: (data.connectedAt as Timestamp)?.toMillis() || Date.now(),
          status: 'connected',
          requesterId: data.requesterId,
          userIds: data.userIds,
        });
      }
    }
    console.log(`%c[connectionService] getConnections: Found ${connections.length} connections for user ${userId}.`, "color: green;");
    return connections;
  } catch (error: any) {
    console.error(`%c[connectionService] Error fetching connections for user ${userId}:`, "color: red;", error);
    if (error.code === 'permission-denied') {
        console.error("Firestore permission denied fetching connections. Check rules for 'mutuals' collection.");
        throw new Error('Permission denied fetching connections. Check Firestore rules.');
    }
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
        console.error("Firestore query for connections requires an index. Create a composite index on 'userIds' (array-contains), 'status' (==), and 'connectedAt' (desc) in the Firebase console for the 'mutuals' collection.");
        throw new Error('Firestore query requires an index. Please create it in the Firebase console.');
    }
    throw new Error(`Failed to fetch connections: ${error.message}`);
  }
};
