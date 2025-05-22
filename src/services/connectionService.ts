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
  Timestamp,
  serverTimestamp,
  orderBy,
  limit,
  getDoc,
  deleteDoc,
  type QueryConstraint,
} from 'firebase/firestore';
import {
  updateProfile, // For updating Firebase Auth user profile
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

export const initializeUserProfile = async (
  userData: Partial<Pick<UserProfileData, 'uid' | 'email' | 'companyName' | 'industry'>> & { googleDisplayName?: string, googlePhotoURL?: string }
): Promise<void> => {
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
    let finalAvatarUrl: string | null = null; // Default to null

    if (!docSnap.exists()) {
      console.log(`%c[connectionService] initializeUserProfile: CREATING NEW PROFILE for UID ${userData.uid}.`, "color: green; font-weight: bold;");
      operationType = 'CREATE';
      dataPayload.createdAt = serverTimestamp() as Timestamp;
      dataPayload.mentionName = generatedMentionName;
      finalAvatarUrl = null; // Always null for new profiles, regardless of Google photo

      dataPayload.email = userData.email || null;
      dataPayload.companyName = userData.companyName || null;
      // Save industry from sign-up form if available
      dataPayload.industry = userData.industry || null;
      dataPayload.avatarUrl = finalAvatarUrl; // Explicitly null for new profiles
      dataPayload.descriptionVisibility = 'everyone'; // Default visibility for description
      dataPayload.incomeRange = null; // Initialize incomeRange for new users

      // Determine final display name for Auth profile based on priority
      finalAuthProfileDisplayName = userData.googleDisplayName || userData.companyName || generatedMentionName;

    } else {
      operationType = 'UPDATE';
      const existingData = docSnap.data() as UserProfileData;
      console.log(`%c[connectionService] initializeUserProfile: UPDATING EXISTING PROFILE for UID ${userData.uid}. Existing data:`, "color: blue; font-weight: bold;", existingData);

      dataPayload.mentionName = existingData.mentionName || generatedMentionName; // Ensure mentionName

      // Company name: update if new one provided from form (less likely on login)
      if (userData.companyName !== undefined) {
        dataPayload.companyName = userData.companyName || null;
      } else {
        dataPayload.companyName = existingData.companyName || null;
      }

      // Industry: update if new one provided
      if (userData.industry !== undefined) {
        dataPayload.industry = userData.industry || null;
      } else {
        dataPayload.industry = existingData.industry || null;
      }
      
      // Avatar: For existing users, only update if Google photoURL is new and different.
      // This preserves a custom uploaded avatar if userData.googlePhotoURL isn't fresh or different.
      if (userData.googlePhotoURL && userData.googlePhotoURL !== existingData.avatarUrl) {
        finalAvatarUrl = userData.googlePhotoURL;
      } else if (existingData.avatarUrl !== undefined) {
        finalAvatarUrl = existingData.avatarUrl;
      } else {
        finalAvatarUrl = null;
      }
      dataPayload.avatarUrl = finalAvatarUrl;

      // Determine final display name for Auth profile update
      finalAuthProfileDisplayName = userData.googleDisplayName || dataPayload.companyName || dataPayload.mentionName;

      dataPayload.descriptionVisibility = existingData.descriptionVisibility || 'everyone';
      dataPayload.incomeRange = existingData.incomeRange || null; // Preserve existing or default to null
      // Preserve other existing fields explicitly if needed (e.g., tags, location etc.)
      // For now, using setDoc with merge will preserve fields not explicitly set in dataPayload.
    }

    dataPayload.lastLoginAt = serverTimestamp() as Timestamp;
    dataPayload.updatedAt = serverTimestamp() as Timestamp;

    // Remove any explicitly undefined fields from dataPayload before writing
    Object.keys(dataPayload).forEach(keyStr => {
      const key = keyStr as keyof UserProfileData;
      if (dataPayload[key] === undefined) {
        delete dataPayload[key];
      }
    });
    
    console.log(`%c[connectionService] initializeUserProfile: Data to ${operationType} to Firestore for UID ${userData.uid}:`, "color: #1E90FF; font-weight:bold;", dataPayload);
    await setDoc(userDocRef, dataPayload, { merge: operationType === 'UPDATE' });
    console.log(`%c[connectionService] initializeUserProfile: User profile ${operationType}D successfully in Firestore for UID ${userData.uid}.`, "color: green; font-weight:bold;");

    // Sync with Firebase Auth Profile (DisplayName and PhotoURL)
    if (clientAuthUser && clientAuthUser.uid === userData.uid) {
      const authProfileUpdates: { displayName?: string | null; photoURL?: string | null } = {};
      const currentAuthDisplayName = clientAuthUser.displayName;
      const currentAuthPhotoURL = clientAuthUser.photoURL;

      if (currentAuthDisplayName !== finalAuthProfileDisplayName) {
        authProfileUpdates.displayName = finalAuthProfileDisplayName;
      }
      // For new sign-ups, finalAvatarUrl is null, ensuring photoURL on auth object is also cleared.
      // For existing users, if finalAvatarUrl changed, update auth.
      if (currentAuthPhotoURL !== finalAvatarUrl) {
        authProfileUpdates.photoURL = finalAvatarUrl;
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
    } else {
      console.warn("[connectionService] initializeUserProfile: auth.currentUser is null or UID mismatch during Auth profile sync. This can happen if called server-side without proper auth context or if user logs out mid-process.");
    }

  } catch (error: any) {
    console.error(`%c[connectionService] initializeUserProfile: Firestore Error on setDoc for UID ${userData.uid}:`, "color: red; font-weight:bold;", error);
    console.error(`  Error Code: ${error.code}`);
    console.error(`  Error Message: ${error.message}`);
    // Do not re-throw here, as this function is often called in a "best effort" way during sign-up/sign-in.
    // UI should handle cases where profile might be partially initialized.
  }
};

export const fetchUserProfileBasic = async (userIdParam: string): Promise<UserProfileBasic | null> => {
  const userId = String(userIdParam || "").trim();
  const clientAuthUid = auth.currentUser?.uid; 
  console.log(`%c[connectionService] fetchUserProfileBasic: Fetching for targetUserId: '${userId}'. Client Auth UID: '${clientAuthUid || 'NULL'}'`, "color: teal;");

  if (!userId || !IS_UID_REGEX_SERVICE.test(userId)) {
    console.warn(`%c[connectionService] fetchUserProfileBasic: Invalid or empty userId: '${userId}'. Generating anonymous name.`, "color: orange;");
    const anonName = generateAnonymousName(userId || "invalid_uid_fallback");
    return { userId: userId || "invalid_uid_fallback", displayName: anonName, mentionName: anonName, avatarUrl: undefined };
  }

  try {
    const userDocRef = doc(usersCollectionRef, userId);
    const userSnap = await getDoc(userDocRef);

    if (userSnap.exists()) {
      const userData = userSnap.data() as UserProfileData;
      const mentionName = userData.mentionName || generateAnonymousName(userId);
      const displayName = userData.companyName || mentionName; // Prioritize companyName for basic display

      const profile: UserProfileBasic = {
        userId: userId,
        displayName: displayName,
        mentionName: mentionName,
        avatarUrl: userData.avatarUrl || undefined,
      };
      console.log(`%c[connectionService] fetchUserProfileBasic: Profile FOUND for '${userId}':`, "color: green;", profile);
      return profile;
    }
    console.warn(`%c[connectionService] fetchUserProfileBasic: Profile document NOT FOUND for userId: '${userId}'. Generating anonymous name.`, "color: orange;");
    const anonName = generateAnonymousName(userId);
    return { userId: userId, displayName: anonName, mentionName: anonName, avatarUrl: undefined };
  } catch (error: any) {
    const errorCatchAuthUid = auth.currentUser?.uid;
    console.error(`%c[connectionService] fetchUserProfileBasic: Error fetching profile for '${userId}':`, "color: red;", error);
    if (error.code === 'permission-denied') {
      console.error(`%c  PERMISSION DENIED specifically for reading 'users/${userId}'. Client auth state at error catch: '${errorCatchAuthUid || 'NULL'}'`, "color: red; font-weight: bold;");
    }
    const anonName = generateAnonymousName(userId);
    return { userId: userId, displayName: anonName, mentionName: anonName, avatarUrl: undefined };
  }
};

export const fetchFullUserProfile = async (userIdParam: string): Promise<UserProfileData | null> => {
  const trimmedUserId = String(userIdParam || "").trim();
  const functionCallAuthUid = auth.currentUser?.uid;

  console.log(`%c[connectionService] fetchFullUserProfile: Attempting to fetch for targetUserId: '${trimmedUserId}'. Function call auth UID: '${functionCallAuthUid || 'NULL'}'`, "color: darkcyan; font-weight: bold;");

  if (!trimmedUserId || !IS_UID_REGEX_SERVICE.test(trimmedUserId)) {
    console.warn(`%c[connectionService] fetchFullUserProfile: Invalid or empty userId: '${trimmedUserId}'. Returning null.`, "color: orange;");
    return null;
  }

  try {
    const userDocRef = doc(usersCollectionRef, trimmedUserId);
    const userSnap = await getDoc(userDocRef);

    if (userSnap.exists()) {
      const userData = userSnap.data() as UserProfileData;
      const finalMentionName = userData.mentionName || generateAnonymousName(trimmedUserId); // Ensure mentionName exists

      const fullProfile: UserProfileData = {
        uid: trimmedUserId,
        email: userData.email || null,
        companyName: userData.companyName || null,
        mentionName: finalMentionName,
        industry: userData.industry || null,
        avatarUrl: userData.avatarUrl || null,
        description: userData.description || null,
        descriptionVisibility: userData.descriptionVisibility || 'everyone',
        incomeRange: userData.incomeRange || null,
        tags: userData.tags || [],
        location: userData.location || null,
        established: userData.established || null,
        contactEmail: userData.contactEmail || null,
        contactPhone: userData.contactPhone || null,
        verified: userData.verified || false,
        createdAt: userData.createdAt,
        lastLoginAt: userData.lastLoginAt,
        updatedAt: userData.updatedAt,
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

export const updateUserProfileDetails = async (
  userId: string,
  dataToUpdate: Partial<Pick<UserProfileData, 'industry' | 'description' | 'avatarUrl' | 'descriptionVisibility' | 'incomeRange'>>
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
  const allowedUpdateFields: (keyof typeof dataToUpdate)[] = [
      'industry', 'description', 'avatarUrl', 'descriptionVisibility', 'incomeRange'
  ];

  allowedUpdateFields.forEach(key => {
    const value = dataToUpdate[key];
    if (value !== undefined) { // Allow null to be set explicitly
      sanitizedData[key] = value;
    }
  });
  
  if (Object.keys(sanitizedData).length === 0) {
     console.log(`%c[connectionService] updateUserProfileDetails: No actual data to update for UID ${trimmedUserId}. Skipping Firestore write.`, "color: orange");
     return;
  }

  sanitizedData.updatedAt = serverTimestamp();

  try {
    await updateDoc(userDocRef, sanitizedData);
    console.log(`%c[connectionService] User profile details UPDATED successfully in Firestore for UID ${trimmedUserId}.`, "color: green;");

    // Sync avatar with Firebase Auth if it was part of the update
    if (dataToUpdate.avatarUrl !== undefined && clientAuthUser.photoURL !== dataToUpdate.avatarUrl) {
      const authUpdates: { photoURL?: string | null } = { photoURL: dataToUpdate.avatarUrl }; // Can be null
      console.log(`%c[connectionService] updateUserProfileDetails: Attempting to update auth.currentUser photoURL with:`, "color: #FF8C00;", authUpdates.photoURL);
      await updateProfile(clientAuthUser, authUpdates);
      console.log(`%c[connectionService] updateUserProfileDetails: auth.currentUser photoURL updated successfully.`, "color: #FF8C00;");
    }

  } catch (error: any) {
    console.error(`%c[connectionService] updateUserProfileDetails: Firestore Error updating profile for UID ${trimmedUserId}:`, "color: red;", error);
    if (error.code === 'permission-denied') {
      throw new Error('Permission denied. Check Firestore security rules for updating your user document.');
    }
    if (error.message && error.message.includes("Unsupported field value: undefined")) {
      console.error("[connectionService] updateUserProfileDetails: Firestore received an undefined value. Data sent:", sanitizedData);
    }
    throw new Error(`Failed to update profile details: ${error.message}`);
  }
};


// --- Connection Management Functions ---
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

  const newConnectionData: Omit<Connection, 'id' | 'otherUserDisplayName' | 'otherUserAvatarUrl' | 'connectedAt'> & { requestedAt: Timestamp, userIds: string[] } = {
    userIds: sortedUserIds,
    status: 'pending',
    requesterId: requesterId,
    requestedAt: serverTimestamp() as Timestamp,
    otherUserId: recipientId, 
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
    console.error(`[connectionService] Error sending connection request (${connectionId}):`, error);
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

    await updateDoc(connectionDocRef, { status: 'connected', connectedAt: serverTimestamp() });
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

  if (!userId1 || !userId2) {
    console.warn(`[connectionService] getConnectionStatus: Called with empty or invalid userId. userId1: '${userId1}', userId2: '${userId2}'`);
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
    if (data.status === 'blocked') return 'blocked';
    return 'not_connected';
  } catch (error: any) {
    console.error(`[connectionService] Error fetching connection status between ${userId1} and ${userId2} (ID: ${connectionId}):`, error);
    if (error.code === 'permission-denied') {
       console.error(`  PERMISSION_DENIED for reading mutuals/${connectionId}. Client auth UID: '${currentClientAuthUid || 'NULL'}'. Rule expects 'userIds' in doc to contain this UID if doc exists.`);
    }
    return null;
  }
};


export const getSuggestibleUsers = async (searchPrefix?: string, limitCountArg?: number): Promise<UserProfileBasic[]> => {
  const trimmedPrefix = searchPrefix?.trim().toLowerCase();
  // When no prefix, fetch a larger general list. When prefix exists, fetch fewer more targeted results.
  const effectiveLimit = !trimmedPrefix ? (limitCountArg || 25) : (limitCountArg || 10);
  console.log(`%c[connectionService] getSuggestibleUsers called. Prefix: '${trimmedPrefix}', Effective Limit: ${effectiveLimit}`, "color: #BA55D3");

  try {
    const constraints: FirestoreQueryConstraint[] = [];
    const fieldToQueryAndOrder = 'mentionName'; // Always query and order by the anonymous mentionName

    if (trimmedPrefix) {
      console.log(`%c[connectionService] getSuggestibleUsers: Applying prefix search for '${trimmedPrefix}' on ${fieldToQueryAndOrder}.`, "color: #BA55D3");
      // Firestore prefix queries require a field to start with the prefix.
      // mentionName is stored as "ColorAnimalNumber".
      const prefixForQuery = trimmedPrefix.charAt(0).toUpperCase() + trimmedPrefix.slice(1); // Capitalize first letter for consistent matching if needed

      constraints.push(firestoreWhere(fieldToQueryAndOrder, '>=', prefixForQuery));
      constraints.push(firestoreWhere(fieldToQueryAndOrder, '<=', prefixForQuery + '\uf8ff')); // Standard way to do prefix search
      constraints.push(firestoreOrderBy(fieldToQueryAndOrder));
    } else {
      console.log(`%c[connectionService] getSuggestibleUsers: No prefix, fetching general list ordered by ${fieldToQueryAndOrder}.`, "color: #BA55D3");
      constraints.push(firestoreOrderBy(fieldToQueryAndOrder)); // Order by mentionName for general suggestions
    }
    constraints.push(firestoreLimit(effectiveLimit));

    const q = firestoreQuery(usersCollectionRef, ...constraints);
    console.log("%c[connectionService] getSuggestibleUsers: Executing Firestore query...", "color: #BA55D3;");
    const querySnapshot = await firestoreGetDocs(q);
    console.log(`%c[connectionService] getSuggestibleUsers: Firestore query executed. Found ${querySnapshot.docs.length} documents.`, "color: #BA55D3");

    if (querySnapshot.empty) {
      console.log("%c[connectionService] getSuggestibleUsers: No documents found for the query.", "color: orange;");
    }

    const users = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data() as UserProfileData;
      const mentionName = data.mentionName || generateAnonymousName(docSnap.id); // Fallback if somehow missing
      const displayName = data.companyName || mentionName; // Display company name or fallback to mention name

      const profile: UserProfileBasic = {
        userId: docSnap.id,
        displayName: displayName,
        mentionName: mentionName,
        avatarUrl: data.avatarUrl || undefined,
      };
      return profile;
    });
    console.log(`%c[connectionService] getSuggestibleUsers: Successfully mapped ${users.length} users. Example users:`, "color: green;", users.slice(0, 3));
    return users;
  } catch (error: any) {
    console.error('%c[connectionService] Error fetching suggestible users:', "color: red;", error);
    if (error.code === 'permission-denied') {
      console.error('%c  PERMISSION DENIED. Check Firestore rules for listing users (users collection, list operation).', "color: red;");
      throw new Error('Permission denied fetching users. Check Firestore rules.');
    }
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
      console.error("%c  MISSING INDEX. Firestore query for suggestible users requires an index on 'mentionName' (ascending). Create this in Firebase console.", "color: red;");
      throw new Error("Query for suggestible users requires an index on mentionName (ascending).");
    }
    return [];
  }
};
