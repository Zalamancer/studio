// src/services/connectionService.ts
import { db, auth } from '@/lib/firebase/config';
import {
  collection as firestoreCollection,
  query as firestoreQuery,
  where as firestoreWhere,
  getDocs as firestoreGetDocs,
  setDoc as firestoreSetDoc,
  doc as firestoreDoc,
  updateDoc as firestoreUpdateDoc,
  Timestamp,
  serverTimestamp as firestoreServerTimestamp,
  orderBy as firestoreOrderBy,
  limit as firestoreLimit,
  getDoc as firestoreGetDoc,
  deleteDoc as firestoreDeleteDoc,
  type QueryConstraint as FirestoreQueryConstraint,
} from 'firebase/firestore';
import {
  updateProfile, // From firebase/auth
} from 'firebase/auth';
import type { ConnectionStatus, Connection, ConnectionRequest, UserProfileBasic, UserProfileData } from '@/types/connection';
import { generateAnonymousName } from '@/lib/pseudonymUtils';
import { createNotification } from './notificationService';

const mutualsCollectionRef = firestoreCollection(db, 'mutuals');
const usersCollectionRef = firestoreCollection(db, 'users');
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

  const connectionDocRef = firestoreDoc(mutualsCollectionRef, connectionId);
  const sortedUserIds = [requesterId, recipientId].sort();

  const newConnectionData = {
    userIds: sortedUserIds,
    status: 'pending' as const,
    requesterId: requesterId,
    requestedAt: firestoreServerTimestamp() as Timestamp,
  };

  console.log(`%c[connectionService] sendConnectionRequest - Rule Check Values (Client-side perspective for Firestore 'create' rule on /mutuals/{connectionId}):`, "color: green;");
  console.log(`  1. request.auth != null:                            ${!!clientAuthUid}`);
  console.log(`  2. request.resource.data.requesterId == request.auth.uid: ${newConnectionData.requesterId === clientAuthUid} (Data: '${newConnectionData.requesterId}', Auth: '${clientAuthUid}')`);
  console.log(`  3. request.resource.data.userIds.hasAll([request.auth.uid]): ${clientAuthUid ? newConnectionData.userIds.includes(clientAuthUid) : false} (Data: [${newConnectionData.userIds.join(', ')}], Auth: '${clientAuthUid}')`);


  try {
    const connectionDocSnap = await firestoreGetDoc(connectionDocRef);
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

    await firestoreSetDoc(connectionDocRef, newConnectionData);
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
  const connectionDocRef = firestoreDoc(mutualsCollectionRef, connectionId);
  console.log(`[connectionService] Accepting connection request: ${connectionId} by user ${acceptorId}`);
  try {
    const connectionDocSnap = await firestoreGetDoc(connectionDocRef);
    if (!connectionDocSnap.exists()) throw new Error("Connection request not found.");
    const connectionData = connectionDocSnap.data();
    if (!connectionData) throw new Error("Connection data is missing.");
    if (connectionData.requesterId === acceptorId) throw new Error("Cannot accept your own connection request.");
    if (!connectionData.userIds.includes(acceptorId)) throw new Error("Acceptor is not part of this connection request.");
    if (connectionData.status !== 'pending') throw new Error("Connection request is not pending.");

    await firestoreUpdateDoc(connectionDocRef, { status: 'connected', connectedAt: firestoreServerTimestamp() });
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
  const connectionDocRef = firestoreDoc(mutualsCollectionRef, connectionId);
  console.log(`[connectionService] Rejecting/Cancelling connection request: ${connectionId} by user ${userId}`);
  try {
    const connectionDocSnap = await firestoreGetDoc(connectionDocRef);
    if (!connectionDocSnap.exists()) throw new Error("Connection request not found.");
    const connectionData = connectionDocSnap.data();
    if (!connectionData || !connectionData.userIds.includes(userId)) throw new Error("User not part of this connection request.");
    if (connectionData.status !== 'pending') throw new Error("Cannot reject/cancel a non-pending request.");
    await firestoreDeleteDoc(connectionDocRef);
    console.log(`[connectionService] Connection request rejected/cancelled successfully: ${connectionId}`);
  } catch (error: any) {
    console.error(`[connectionService] Error rejecting/cancelling connection request (${connectionId}):`, error);
    if (error.code === 'permission-denied') throw new Error('Permission denied. Check Firestore rules for deleting mutuals documents.');
    throw new Error(`Failed to reject/cancel connection request: ${error.message}`);
  }
};

export const removeConnection = async (connectionId: string, userId: string): Promise<void> => {
  const connectionDocRef = firestoreDoc(mutualsCollectionRef, connectionId);
  console.log(`[connectionService] Removing connection: ${connectionId} by user ${userId}`);
  try {
    const connectionDocSnap = await firestoreGetDoc(connectionDocRef);
    if (!connectionDocSnap.exists()) throw new Error("Connection not found.");
    const connectionData = connectionDocSnap.data();
    if (!connectionData || !connectionData.userIds.includes(userId)) throw new Error("User not part of this connection.");
    if (connectionData.status !== 'connected') throw new Error("Cannot remove a non-connected relationship.");
    await firestoreDeleteDoc(connectionDocRef);
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
  const connectionDocRef = firestoreDoc(mutualsCollectionRef, connectionId);

  try {
    const docSnap = await firestoreGetDoc(connectionDocRef);
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

export const fetchUserProfileBasic = async (userIdParam: string): Promise<UserProfileBasic | null> => {
  const userId = String(userIdParam || "").trim();
  const clientAuthUid = auth.currentUser?.uid;
  console.log(`%c[connectionService] fetchUserProfileBasic: Attempting to fetch for targetUserId: '${userId}'. Client Auth UID: '${clientAuthUid || 'NULL'}'`, "color: teal;");

  if (!userId || !IS_UID_REGEX_SERVICE.test(userId)) {
    console.warn(`%c[connectionService] fetchUserProfileBasic: Invalid or empty userId: '${userId}'. Returning generated name.`, "color: orange;");
    const anonName = generateAnonymousName(userId || "unknown_user_id");
    return { userId: userId, displayName: anonName, mentionName: anonName, actualDisplayName: undefined, companyName: undefined, avatarUrl: undefined };
  }

  try {
    const userDocRef = firestoreDoc(usersCollectionRef, userId);
    const userSnap = await firestoreGetDoc(userDocRef);

    if (userSnap.exists()) {
      const userData = userSnap.data() as UserProfileData;
      const currentMentionName = userData.mentionName || generateAnonymousName(userId);
      const currentDisplayName = userData.actualDisplayName || userData.companyName || currentMentionName;

      const profile: UserProfileBasic = {
        userId: userId,
        displayName: currentDisplayName,
        mentionName: currentMentionName,
        actualDisplayName: userData.actualDisplayName || undefined,
        companyName: userData.companyName || undefined,
        avatarUrl: userData.avatarUrl || userData.photoURL || undefined,
      };
      console.log(`%c[connectionService] fetchUserProfileBasic: Profile FOUND for '${userId}':`, "color: green;", profile);
      return profile;
    }
    console.warn(`%c[connectionService] fetchUserProfileBasic: Profile document NOT FOUND for userId: '${userId}'. Generating names.`, "color: orange;");
    const anonName = generateAnonymousName(userId);
    return { userId: userId, displayName: anonName, mentionName: anonName, actualDisplayName: undefined, companyName: undefined, avatarUrl: undefined };
  } catch (error: any) {
    const errorCatchAuthUid = auth.currentUser?.uid;
    console.error(`%c[connectionService] fetchUserProfileBasic: Error fetching profile for '${userId}':`, "color: red;", error);
    if (error.code === 'permission-denied') {
      console.error(`%c  PERMISSION DENIED specifically for reading 'users/${userId}'. Client auth state at error catch: '${errorCatchAuthUid || 'NULL'}'`, "color: red; font-weight: bold;");
    }
    const anonName = generateAnonymousName(userId); // Fallback
    return { userId: userId, displayName: anonName, mentionName: anonName, actualDisplayName: undefined, companyName: undefined, avatarUrl: undefined };
  }
};


export const fetchFullUserProfile = async (userIdParam: string): Promise<UserProfileData | null> => {
  const userId = String(userIdParam || "").trim();
  const functionCallAuthUid = auth.currentUser?.uid;

  console.log(`%c[connectionService] fetchFullUserProfile: Attempting to fetch for targetUserId: '${userId}'. Function call auth UID: '${functionCallAuthUid || 'NULL'}'`, "color: darkcyan; font-weight: bold;");

  if (!userId || !IS_UID_REGEX_SERVICE.test(userId)) {
    console.warn(`%c[connectionService] fetchFullUserProfile: Invalid or empty userId: '${userId}'. Returning null.`, "color: orange;");
    return null;
  }

  try {
    const userDocRef = firestoreDoc(usersCollectionRef, userId);
    const userSnap = await firestoreGetDoc(userDocRef);

    if (userSnap.exists()) {
      const userData = userSnap.data() as UserProfileData; // Assume UserProfileData is correct type
      // Ensure mentionName exists, generate if it doesn't (for older docs)
      const currentMentionName = userData.mentionName || generateAnonymousName(userId);

      const fullProfile: UserProfileData = {
        ...userData, // Spread existing data
        uid: userId,
        mentionName: currentMentionName,
        // Ensure all fields from UserProfileData are present or explicitly null/defaulted
        email: userData.email || undefined,
        actualDisplayName: userData.actualDisplayName || null,
        companyName: userData.companyName || null,
        industry: userData.industry || null,
        avatarUrl: userData.avatarUrl || userData.photoURL || null,
        photoURL: userData.photoURL || null,
        description: userData.description || null,
        tags: userData.tags || [],
        location: userData.location || null,
        established: userData.established || null,
        contactEmail: userData.contactEmail || null,
        contactPhone: userData.contactPhone || null,
        verified: userData.verified || false,
        actualDisplayNameVisibility: userData.actualDisplayNameVisibility || 'everyone',
        companyNameVisibility: userData.companyNameVisibility || 'everyone',
        industryVisibility: userData.industryVisibility || 'everyone',
        descriptionVisibility: userData.descriptionVisibility || 'everyone',
        avatarVisibility: userData.avatarVisibility || 'everyone',
      };
      console.log(`%c[connectionService] fetchFullUserProfile: Full profile FOUND for '${userId}'.`, "color: green;");
      return fullProfile;
    }
    console.warn(`%c[connectionService] fetchFullUserProfile: Profile document NOT FOUND for userId: '${userId}'. Returning null.`, "color: orange;");
    return null;
  } catch (error: any) {
    const clientAuthUid = auth.currentUser?.uid;
    console.error(`%c[connectionService] fetchFullUserProfile: Error fetching full profile for '${userId}':`, "color: red;", error);
    if (error.code === 'permission-denied') {
      console.error(`%c  PERMISSION DENIED specifically for reading 'users/${userId}'. Client auth state: '${clientAuthUid || 'NULL'}'`, "color: red; font-weight: bold;");
    }
    return null;
  }
};

export const getPendingRequests = async (userId: string): Promise<ConnectionRequest[]> => {
  console.log(`[connectionService] Fetching pending requests for user: ${userId}`);
  if (!userId || !IS_UID_REGEX_SERVICE.test(userId)) {
    console.warn(`[connectionService] getPendingRequests called with invalid userId: '${userId}'.`);
    return [];
  }
  try {
    const q = firestoreQuery(
      mutualsCollectionRef,
      firestoreWhere('userIds', 'array-contains', userId),
      firestoreWhere('status', '==', 'pending'),
      firestoreOrderBy('requestedAt', 'desc'),
      firestoreLimit(50)
    );
    const querySnapshot = await firestoreGetDocs(q);
    const requestsPromises = querySnapshot.docs
      .filter(docSnap => {
        const data = docSnap.data();
        return data.requesterId !== userId && data.userIds.includes(userId);
      })
      .map(async (docSnap) => {
        const data = docSnap.data();
        const requestedAtMillis = data.requestedAt instanceof Timestamp ? data.requestedAt.toMillis() : null;
        if (requestedAtMillis === null) {
          console.warn(`[connectionService] Pending request ${docSnap.id} has invalid requestedAt timestamp.`);
          return null;
        }
        const requesterProfile = await fetchUserProfileBasic(data.requesterId);
        return {
          connectionId: docSnap.id,
          requesterId: data.requesterId,
          requesterDisplayName: requesterProfile?.displayName || generateAnonymousName(data.requesterId),
          requesterAvatarUrl: requesterProfile?.avatarUrl,
          requestedAt: requestedAtMillis,
        } as ConnectionRequest;
      });
    const requests = (await Promise.all(requestsPromises)).filter(req => req !== null) as ConnectionRequest[];
    console.log(`[connectionService] Successfully processed ${requests.length} pending requests for user ${userId}`);
    return requests;
  } catch (error: any) {
    console.error(`[connectionService] Error fetching pending requests for user ${userId}:`, error);
    if (error.code === 'permission-denied') {
        console.error("Firestore permission denied fetching pending requests. Check rules for 'mutuals' collection.");
        throw new Error('Permission denied fetching pending requests. Check Firestore rules.');
    }
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
        console.error("Firestore query for pending requests requires an index. Create a composite index on 'userIds' (array-contains), 'status' (==), and 'requestedAt' (desc) in the Firebase console for the 'mutuals' collection.");
        throw new Error("Firestore query for pending requests requires an index. Please create it in the Firebase console.");
    }
    throw new Error(`Failed to fetch pending requests: ${error.message}`);
  }
};

export const getConnections = async (userId: string): Promise<Connection[]> => {
  console.log(`[connectionService] Fetching connections for user: ${userId}`);
   if (!userId || !IS_UID_REGEX_SERVICE.test(userId)) {
    console.warn(`[connectionService] getConnections called with invalid userId: '${userId}'.`);
    return [];
  }
  try {
    const q = firestoreQuery(
      mutualsCollectionRef,
      firestoreWhere('userIds', 'array-contains', userId),
      firestoreWhere('status', '==', 'connected'),
      firestoreOrderBy('connectedAt', 'desc'),
      firestoreLimit(100)
    );
    const querySnapshot = await firestoreGetDocs(q);
    const connectionsPromises = querySnapshot.docs.map(async (docSnap) => {
      const data = docSnap.data();
      const otherUserId = data.userIds.find((id: string) => id !== userId);
      if (!otherUserId) return null;
      const connectedAtMillis = data.connectedAt instanceof Timestamp ? data.connectedAt.toMillis() : null;
      if (connectedAtMillis === null) {
        console.warn(`[connectionService] Connection ${docSnap.id} has invalid connectedAt timestamp.`);
        return null;
      }
      const otherUserProfile = await fetchUserProfileBasic(otherUserId);
      return {
        connectionId: docSnap.id,
        otherUserId: otherUserId,
        otherUserDisplayName: otherUserProfile?.displayName || generateAnonymousName(otherUserId),
        otherUserAvatarUrl: otherUserProfile?.avatarUrl,
        connectedAt: connectedAtMillis,
      } as Connection;
    });
    const connections = (await Promise.all(connectionsPromises)).filter(conn => conn !== null) as Connection[];
    console.log(`[connectionService] Successfully processed ${connections.length} connections for user ${userId}`);
    return connections;
  } catch (error: any) {
    console.error(`[connectionService] Error fetching connections for user ${userId}:`, error);
    if (error.code === 'permission-denied') {
        console.error("Firestore permission denied fetching connections. Check rules for 'mutuals' collection.");
        throw new Error('Permission denied fetching connections. Check Firestore rules.');
    }
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
        console.error("Firestore query for connections requires an index. Create a composite index on 'userIds' (array-contains), 'status' (==), and 'connectedAt' (desc) in the Firebase console for the 'mutuals' collection.");
        throw new Error("Firestore query requires an index for connections. Please create it.");
    }
    throw new Error(`Failed to fetch connections: ${error.message}`);
  }
};

export const initializeUserProfile = async (userData: Partial<Pick<UserProfileData, 'uid' | 'email' | 'actualDisplayName' | 'companyName' | 'photoURL' | 'industry'>>): Promise<void> => {
  const clientAuthUser = auth.currentUser; // Get current auth user for logging
  console.log(`%c[connectionService] initializeUserProfile: Called. Client auth UID: ${clientAuthUser?.uid || 'NULL'}. Incoming userData:`, "color: orange", userData);

  if (!userData.uid || !IS_UID_REGEX_SERVICE.test(userData.uid)) {
    console.error('%c[connectionService] initializeUserProfile: ERROR - UID is missing or invalid in userData. Aborting.', "color: red; font-weight:bold;", userData);
    return;
  }

  const userDocRef = firestoreDoc(usersCollectionRef, userData.uid);
  const generatedMentionName = generateAnonymousName(userData.uid); // Always generate for consistency
  let finalAuthProfileDisplayName: string;

  try {
    console.log(`%c[connectionService] initializeUserProfile: Checking for existing document for UID ${userData.uid}...`, "color: orange");
    const docSnap = await firestoreGetDoc(userDocRef);
    let dataToWrite: Partial<UserProfileData> = { uid: userData.uid };
    let operationType: 'CREATE' | 'UPDATE' = 'CREATE';

    if (!docSnap.exists()) {
      console.log(`%c[connectionService] initializeUserProfile: CREATING NEW PROFILE for UID ${userData.uid}.`, "color: green; font-weight: bold;");
      dataToWrite.createdAt = firestoreServerTimestamp() as Timestamp;
      dataToWrite.mentionName = generatedMentionName;
      dataToWrite.actualDisplayName = userData.actualDisplayName || null;
      dataToWrite.companyName = userData.companyName || null;
      dataToWrite.email = userData.email || null;
      dataToWrite.industry = userData.industry || null;
      dataToWrite.avatarUrl = null; // Start with null avatar (initials will be used)
      // Default visibilities
      dataToWrite.actualDisplayNameVisibility = 'everyone';
      dataToWrite.companyNameVisibility = 'everyone';
      dataToWrite.industryVisibility = 'everyone';
      dataToWrite.descriptionVisibility = 'everyone';
      dataToWrite.avatarVisibility = 'everyone';

      finalAuthProfileDisplayName = dataToWrite.actualDisplayName || dataToWrite.companyName || dataToWrite.mentionName;

    } else {
      operationType = 'UPDATE';
      console.log(`%c[connectionService] initializeUserProfile: UPDATING EXISTING PROFILE for UID ${userData.uid}.`, "color: blue; font-weight: bold;");
      const existingData = docSnap.data() as UserProfileData;
      dataToWrite.mentionName = existingData.mentionName || generatedMentionName; // Ensure mentionName exists

      // Update actualDisplayName if new data is provided
      if (userData.actualDisplayName !== undefined) {
        dataToWrite.actualDisplayName = userData.actualDisplayName || null;
      } else {
        dataToWrite.actualDisplayName = existingData.actualDisplayName || null;
      }

      // Update companyName if new data is provided
      if (userData.companyName !== undefined) {
        dataToWrite.companyName = userData.companyName || null;
      } else {
        dataToWrite.companyName = existingData.companyName || null;
      }

      // Update email if new data is provided and different
      if (userData.email && userData.email !== existingData.email) {
        dataToWrite.email = userData.email;
      }
      // Update industry if new data is provided
      if (userData.industry !== undefined) {
        dataToWrite.industry = userData.industry || null;
      }
      // Update avatarUrl ONLY if new photoURL is provided AND it's different
      // OR if there was no avatarUrl before and new photoURL is provided
      if (userData.photoURL && userData.photoURL !== existingData.avatarUrl) {
        dataToWrite.avatarUrl = userData.photoURL;
      } else if (existingData.avatarUrl !== undefined) {
        dataToWrite.avatarUrl = existingData.avatarUrl; // Keep existing
      } else {
        dataToWrite.avatarUrl = null; // Default to null if no existing and no new
      }

      // Ensure visibility settings are preserved or defaulted
      dataToWrite.actualDisplayNameVisibility = existingData.actualDisplayNameVisibility || 'everyone';
      dataToWrite.companyNameVisibility = existingData.companyNameVisibility || 'everyone';
      dataToWrite.industryVisibility = existingData.industryVisibility || 'everyone';
      dataToWrite.descriptionVisibility = existingData.descriptionVisibility || 'everyone';
      dataToWrite.avatarVisibility = existingData.avatarVisibility || 'everyone';

      finalAuthProfileDisplayName = dataToWrite.actualDisplayName || dataToWrite.companyName || dataToWrite.mentionName;
    }

    dataToWrite.lastLoginAt = firestoreServerTimestamp() as Timestamp;
    dataToWrite.updatedAt = firestoreServerTimestamp() as Timestamp;

    console.log(`%c[connectionService] initializeUserProfile: Data to write/merge (${operationType}) to Firestore for UID ${userData.uid}:`, "color: #1E90FF; font-weight:bold;", dataToWrite);
    await firestoreSetDoc(userDocRef, dataToWrite, { merge: operationType === 'UPDATE' }); // Use merge only for updates
    console.log(`%c[connectionService] initializeUserProfile: User profile ${operationType}D successfully in Firestore for UID ${userData.uid}.`, "color: green; font-weight:bold;");

    // Sync with Firebase Auth Profile
    if (auth.currentUser) {
      const authProfileUpdates: { displayName?: string | null; photoURL?: string | null } = {};
      const currentAuthDisplayName = auth.currentUser.displayName;
      const currentAuthPhotoURL = auth.currentUser.photoURL;

      // Use the determined final display name for Firebase Auth profile
      if (finalAuthProfileDisplayName && currentAuthDisplayName !== finalAuthProfileDisplayName) {
        authProfileUpdates.displayName = finalAuthProfileDisplayName;
      }

      // For new sign-ups (Google or email), avatarUrl is null to force initials
      // For existing users, if photoURL from Google changed, update it.
      const finalAuthPhotoURL = (operationType === 'CREATE') ? null : dataToWrite.avatarUrl;

      if (currentAuthPhotoURL !== finalAuthPhotoURL) {
        authProfileUpdates.photoURL = finalAuthPhotoURL;
      }

      if (Object.keys(authProfileUpdates).length > 0) {
        console.log(`%c[connectionService] initializeUserProfile: Attempting to update auth.currentUser profile with:`, "color: #FF8C00;", authProfileUpdates);
        try {
          await updateProfile(auth.currentUser, authProfileUpdates);
          console.log(`%c[connectionService] initializeUserProfile: auth.currentUser profile updated successfully.`, "color: #FF8C00;");
        } catch (authUpdateError) {
          console.error(`%c[connectionService] initializeUserProfile: FAILED to update auth.currentUser profile. Error:`, "color: red;", authUpdateError);
        }
      } else {
        console.log(`%c[connectionService] initializeUserProfile: No changes needed for auth.currentUser profile. Auth Name: '${currentAuthDisplayName}', Auth Photo: '${currentAuthPhotoURL}'. Firestore values for auth update: Name='${finalAuthProfileDisplayName}', Photo='${finalAuthPhotoURL}'`, "color: #FF8C00;");
      }
    } else {
      console.warn("[connectionService] initializeUserProfile: auth.currentUser is null, cannot sync Firebase Auth profile.");
    }

  } catch (error: any) {
    console.error(`%c[connectionService] initializeUserProfile: Firestore Error on setDoc for UID ${userData.uid}:`, "color: red; font-weight:bold;", error);
    console.error(`  Error Code: ${error.code}`);
    console.error(`  Error Message: ${error.message}`);
  }
};


export const getSuggestibleUsers = async (searchPrefix?: string, limitCountArg?: number): Promise<UserProfileBasic[]> => {
  const trimmedPrefix = searchPrefix?.trim().toLowerCase();
  // When no prefix, fetch more to show a general list. When prefix, fetch fewer for performance.
  const effectiveLimit = !trimmedPrefix ? (limitCountArg || 25) : (limitCountArg || 10);
  console.log(`%c[connectionService] getSuggestibleUsers called. Prefix: '${trimmedPrefix}', Effective Limit: ${effectiveLimit}`, "color: #BA55D3");

  try {
    const constraints: FirestoreQueryConstraint[] = [];
    const fieldToQueryAndOrder = 'mentionName'; // Always query and order by mentionName

    if (trimmedPrefix) {
      console.log(`%c[connectionService] getSuggestibleUsers: Applying prefix search for '${trimmedPrefix}' on ${fieldToQueryAndOrder}.`, "color: #BA55D3");
      // Firestore prefix queries require a field to start with the prefix.
      // mentionName is stored as "ColorAnimalNumber", so queries should match this.
      const prefixForQuery = trimmedPrefix.charAt(0).toUpperCase() + trimmedPrefix.slice(1);

      constraints.push(firestoreWhere(fieldToQueryAndOrder, '>=', prefixForQuery));
      constraints.push(firestoreWhere(fieldToQueryAndOrder, '<=', prefixForQuery + '\uf8ff')); // \uf8ff is a high Unicode char for suffix matching
      constraints.push(firestoreOrderBy(fieldToQueryAndOrder)); // Order by the same field used in range filter
    } else {
      console.log(`%c[connectionService] getSuggestibleUsers: No prefix, fetching general list ordered by ${fieldToQueryAndOrder}.`, "color: #BA55D3");
      constraints.push(firestoreOrderBy(fieldToQueryAndOrder));
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
      const data = docSnap.data() as UserProfileData; // Assume UserProfileData has all needed fields
      const currentMentionName = data.mentionName || generateAnonymousName(docSnap.id); // Fallback if mentionName somehow missing
      const currentDisplayName = data.actualDisplayName || data.companyName || currentMentionName;

      const profile: UserProfileBasic = {
        userId: docSnap.id,
        displayName: currentDisplayName,
        mentionName: currentMentionName,
        actualDisplayName: data.actualDisplayName || undefined,
        companyName: data.companyName || undefined,
        avatarUrl: data.avatarUrl || data.photoURL || undefined,
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
      console.error("%c  MISSING INDEX. Firestore query for suggestible users likely requires an index on 'mentionName' (ascending). Create this in Firebase console.", "color: red;");
      throw new Error("Query for suggestible users requires an index on mentionName (ascending).");
    }
    return [];
  }
};


export const updateUserProfileDetails = async (
  userId: string,
  dataToUpdate: Partial<Pick<UserProfileData, 'industry' | 'description' | 'avatarUrl' | 'industryVisibility' | 'descriptionVisibility' | 'avatarVisibility' | 'actualDisplayNameVisibility' | 'companyNameVisibility'>>
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

  const userDocRef = firestoreDoc(usersCollectionRef, trimmedUserId);
  console.log(`%c[connectionService] updateUserProfileDetails: Attempting to update profile for UID ${trimmedUserId} with data:`, "color: purple", dataToUpdate);

  const sanitizedData: { [key: string]: any } = {};
  const allowedUpdateFields: (keyof typeof dataToUpdate)[] = [
      'industry', 'description', 'avatarUrl',
      'industryVisibility', 'descriptionVisibility', 'avatarVisibility',
      'actualDisplayNameVisibility', 'companyNameVisibility'
  ];

  allowedUpdateFields.forEach(key => {
    const value = dataToUpdate[key];
    if (value !== undefined) {
      sanitizedData[key] = value === '' ? null : value; // Store empty strings as null if desired, or keep as ''
    }
  });

  if (Object.keys(sanitizedData).length === 0) {
    console.log(`%c[connectionService] updateUserProfileDetails: No actual data to update for UID ${trimmedUserId}. Skipping Firestore write.`, "color: orange");
    return;
  }

  sanitizedData.updatedAt = firestoreServerTimestamp();

  try {
    await firestoreUpdateDoc(userDocRef, sanitizedData);
    console.log(`%c[connectionService] User profile details UPDATED successfully in Firestore for UID ${trimmedUserId}.`, "color: green;");

    // Sync avatar with Firebase Auth if it was part of the update
    if (dataToUpdate.avatarUrl !== undefined && clientAuthUser.photoURL !== dataToUpdate.avatarUrl) {
      const authUpdates: { photoURL?: string | null } = { photoURL: dataToUpdate.avatarUrl }; // dataToUpdate.avatarUrl can be string or null
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
