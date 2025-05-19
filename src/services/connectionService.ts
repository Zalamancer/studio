// src/services/connectionService.ts
import { db, auth } from '@/lib/firebase/config';
import {
  updateProfile, // From firebase/auth
} from 'firebase/auth';
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

  console.log(`%c[connectionService] sendConnectionRequest - Rule Check Values:`, "color: green;");
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
    console.log(`%c[connectionService] getConnectionStatus: About to getDoc for 'mutuals/${connectionId}'. Client auth UID: '${currentClientAuthUid || 'NULL'}'`, "color: blue;");
    const docSnap = await firestoreGetDoc(connectionDocRef);
    if (!docSnap.exists()) {
      console.log(`[connectionService] getConnectionStatus: Document 'mutuals/${connectionId}' does not exist.`);
      return 'not_connected';
    }
    const data = docSnap.data();
    if (!data || !data.status || !data.requesterId || !data.userIds) {
      console.warn(`[connectionService] Connection document ${connectionId} is malformed or missing key fields.`);
      return 'not_connected';
    }
    console.log(`[connectionService] getConnectionStatus: Document 'mutuals/${connectionId}' exists. Data:`, data);
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
    return { userId: userId, displayName: anonName, mentionName: anonName, companyName: undefined, actualDisplayName: undefined, avatarUrl: undefined };
  }

  try {
    const userDocRef = firestoreDoc(usersCollectionRef, userId);
    const preGetDocAuthUid = auth.currentUser?.uid;
    console.log(`%c[connectionService] fetchUserProfileBasic: About to call getDoc for 'users/${userId}'. Auth UID pre-getDoc: '${preGetDocAuthUid || 'NULL'}'`, "color: blue;");

    const userSnap = await firestoreGetDoc(userDocRef);

    if (userSnap.exists()) {
      const userData = userSnap.data() as UserProfileData;
      const mentionName = userData.mentionName || userData.generatedAnonymousName || generateAnonymousName(userId);
      const primaryDisplay = userData.actualDisplayName || userData.companyName || mentionName; // Fallback to mentionName if others are absent

      const profile: UserProfileBasic = {
        userId: userId,
        displayName: primaryDisplay,
        mentionName: mentionName,
        companyName: userData.companyName || undefined,
        actualDisplayName: userData.actualDisplayName || undefined,
        avatarUrl: userData.avatarUrl || userData.photoURL || undefined,
      };
      console.log(`%c[connectionService] fetchUserProfileBasic: Profile FOUND for '${userId}':`, "color: green;", profile);
      return profile;
    }
    console.warn(`%c[connectionService] fetchUserProfileBasic: Profile document NOT FOUND for userId: '${userId}'. Using generated names.`, "color: orange;");
    const anonName = generateAnonymousName(userId);
    return { userId: userId, displayName: anonName, mentionName: anonName, companyName: undefined, actualDisplayName: undefined, avatarUrl: undefined };
  } catch (error: any) {
    const errorCatchAuthUid = auth.currentUser?.uid;
    console.error(`%c[connectionService] fetchUserProfileBasic: Error fetching profile for '${userId}':`, "color: red;", error);
    if (error.code === 'permission-denied') {
      console.error(`%c  PERMISSION DENIED specifically for reading 'users/${userId}'. Client auth state at error catch: '${errorCatchAuthUid || 'NULL'}'`, "color: red; font-weight: bold;");
    }
    const anonName = generateAnonymousName(userId);
    return { userId: userId, displayName: anonName, mentionName: anonName, companyName: undefined, actualDisplayName: undefined, avatarUrl: undefined };
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
    const preGetDocAuthUid = auth.currentUser?.uid;
    console.log(`%c[connectionService] fetchFullUserProfile: About to call getDoc for 'users/${userId}'. Auth UID pre-getDoc: '${preGetDocAuthUid || 'NULL'}'`, "color: blue;");

    const userSnap = await firestoreGetDoc(userDocRef);

    if (userSnap.exists()) {
      const userData = userSnap.data() as UserProfileData;
      const mentionName = userData.mentionName || userData.generatedAnonymousName || generateAnonymousName(userId);
      const primaryDisplay = userData.actualDisplayName || userData.companyName || mentionName;

      const fullProfile: UserProfileData = {
        uid: userId,
        email: userData.email || undefined,
        actualDisplayName: userData.actualDisplayName || undefined,
        companyName: userData.companyName || undefined,
        generatedAnonymousName: userData.generatedAnonymousName, // Keep if exists, for potential legacy
        mentionName: mentionName,
        displayName: primaryDisplay,
        industry: userData.industry || undefined,
        avatarUrl: userData.avatarUrl || userData.photoURL || null,
        photoURL: userData.photoURL || null,
        description: userData.description || undefined,
        tags: userData.tags || [],
        location: userData.location || undefined,
        established: userData.established || undefined,
        contactEmail: userData.contactEmail || undefined,
        contactPhone: userData.contactPhone || undefined,
        verified: userData.verified || false,
        actualDisplayNameVisibility: userData.actualDisplayNameVisibility || 'everyone',
        companyNameVisibility: userData.companyNameVisibility || 'everyone',
        industryVisibility: userData.industryVisibility || 'everyone',
        descriptionVisibility: userData.descriptionVisibility || 'everyone',
        avatarVisibility: userData.avatarVisibility || 'everyone',
        createdAt: userData.createdAt || undefined,
        lastLoginAt: userData.lastLoginAt || undefined,
        updatedAt: userData.updatedAt || undefined,
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
          requesterDisplayName: requesterProfile?.displayName || generateAnonymousName(data.requesterId), // Fallback to generated if needed
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
        otherUserDisplayName: otherUserProfile?.displayName || generateAnonymousName(otherUserId), // Fallback
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

export const initializeUserProfile = async (userData: UserProfileData): Promise<void> => {
  console.log(`%c[connectionService] initializeUserProfile: Called with incomingUserData:`, "color: orange", JSON.stringify(userData, null, 2));
  if (!userData || !userData.uid || !IS_UID_REGEX_SERVICE.test(userData.uid)) {
    console.error('%c[connectionService] initializeUserProfile: ERROR - UID is missing or invalid in userData. Aborting.', "color: red; font-weight:bold;", userData);
    return;
  }

  const userDocRef = firestoreDoc(usersCollectionRef, userData.uid);
  const generatedColorAnimalName = generateAnonymousName(userData.uid);
  let finalAuthDisplayName: string;
  let finalAvatarUrl: string | null = null;
  const authProfileUpdates: { displayName?: string | null; photoURL?: string | null } = {};

  try {
    console.log(`%c[connectionService] initializeUserProfile: Checking for existing document for UID ${userData.uid}...`, "color: orange");
    const docSnap = await firestoreGetDoc(userDocRef);
    const dataPayload: Partial<UserProfileData> = { uid: userData.uid };

    if (!docSnap.exists()) {
      console.log(`%c[connectionService] initializeUserProfile: CREATING NEW PROFILE for UID ${userData.uid}.`, "color: green; font-weight: bold;");
      dataPayload.createdAt = firestoreServerTimestamp() as Timestamp;
      dataPayload.generatedAnonymousName = generatedColorAnimalName; // Legacy field, still good to set
      dataPayload.mentionName = generatedColorAnimalName; // Canonical for @mentions

      // Determine primary display name for general use and auth profile
      if (userData.actualDisplayName) {
        dataPayload.actualDisplayName = userData.actualDisplayName;
        finalAuthDisplayName = userData.actualDisplayName;
      } else if (userData.companyName) {
        dataPayload.companyName = userData.companyName;
        finalAuthDisplayName = userData.companyName;
      } else {
        finalAuthDisplayName = generatedColorAnimalName;
      }
      dataPayload.displayName = finalAuthDisplayName; // General display name field

      // For new users (including Google sign-up), avatarUrl and photoURL are forced to null for initials display
      finalAvatarUrl = null;
      dataPayload.avatarUrl = finalAvatarUrl;
      console.log(`%c[connectionService] initializeUserProfile (NEW PROFILE): Setting avatarUrl to null for new user ${userData.uid}. Initial Google photoURL (if any): ${userData.photoURL}`, "color: #FF8C00;");


      if (userData.email) dataPayload.email = userData.email;
      if (userData.companyName) dataPayload.companyName = userData.companyName; // Set if provided
      if (userData.industry) dataPayload.industry = userData.industry;

      // Default visibilities for new profiles
      dataPayload.actualDisplayNameVisibility = 'everyone';
      dataPayload.companyNameVisibility = 'everyone';
      dataPayload.industryVisibility = 'everyone';
      dataPayload.descriptionVisibility = 'everyone';
      dataPayload.avatarVisibility = 'everyone';

      authProfileUpdates.displayName = finalAuthDisplayName;
      authProfileUpdates.photoURL = finalAvatarUrl; // Will be null

      console.log(`%c[connectionService] initializeUserProfile: Data to write (CREATE) for UID ${userData.uid}:`, "color: #1E90FF; font-weight:bold;", dataPayload);
      await firestoreSetDoc(userDocRef, dataPayload);
      console.log(`%c[connectionService] initializeUserProfile: User profile CREATED successfully in Firestore for UID ${userData.uid}.`, "color: green; font-weight:bold;");

    } else {
      console.log(`%c[connectionService] initializeUserProfile: UPDATING EXISTING PROFILE for UID ${userData.uid}.`, "color: blue; font-weight: bold;");
      const existingData = docSnap.data() as UserProfileData;
      const dataToMerge: Partial<UserProfileData> = { uid: userData.uid };

      dataToMerge.generatedAnonymousName = existingData.generatedAnonymousName || generatedColorAnimalName; // Ensure legacy field if missing
      dataToMerge.mentionName = existingData.mentionName || generatedColorAnimalName; // Ensure canonical mentionName

      // Determine primary display name, preferring new userData if available
      let determinedActualDisplayName = userData.actualDisplayName || existingData.actualDisplayName;
      let determinedCompanyName = userData.companyName || existingData.companyName;

      if (determinedActualDisplayName) {
          dataToMerge.actualDisplayName = determinedActualDisplayName;
          finalAuthDisplayName = determinedActualDisplayName;
      } else if (determinedCompanyName) {
          dataToMerge.companyName = determinedCompanyName;
          finalAuthDisplayName = determinedCompanyName;
      } else {
          finalAuthDisplayName = dataToMerge.mentionName!; // Fallback to existing/newly generated mentionName
      }
      dataToMerge.displayName = finalAuthDisplayName;

      // Avatar logic for existing users: only update if Google photoURL is new and different from current Firestore avatarUrl
      if (userData.photoURL && userData.photoURL.trim() !== '' && userData.photoURL !== existingData.avatarUrl) {
        finalAvatarUrl = userData.photoURL;
      } else if (existingData.avatarUrl !== undefined) {
        finalAvatarUrl = existingData.avatarUrl;
      } else {
        finalAvatarUrl = null;
      }
      dataToMerge.avatarUrl = finalAvatarUrl;
      console.log(`%c[connectionService] initializeUserProfile (UPDATE): Determined finalAvatarUrl: ${finalAvatarUrl}`, "color: #FF8C00;");


      if (userData.email && userData.email !== existingData.email) dataToMerge.email = userData.email;
      if (userData.companyName && userData.companyName !== existingData.companyName) dataToMerge.companyName = userData.companyName;
      if (userData.industry && userData.industry !== existingData.industry) dataToMerge.industry = userData.industry;

      // Preserve existing visibilities or default them if not present
      dataToMerge.actualDisplayNameVisibility = existingData.actualDisplayNameVisibility || 'everyone';
      dataToMerge.companyNameVisibility = existingData.companyNameVisibility || 'everyone';
      dataToMerge.industryVisibility = existingData.industryVisibility || 'everyone';
      dataToMerge.descriptionVisibility = existingData.descriptionVisibility || 'everyone';
      dataToMerge.avatarVisibility = existingData.avatarVisibility || 'everyone';

      authProfileUpdates.displayName = finalAuthDisplayName;
      if (finalAvatarUrl !== (auth.currentUser?.photoURL || null)) {
          authProfileUpdates.photoURL = finalAvatarUrl;
      }

      dataToMerge.lastLoginAt = firestoreServerTimestamp() as Timestamp;
      dataToMerge.updatedAt = firestoreServerTimestamp() as Timestamp;

      console.log(`%c[connectionService] initializeUserProfile: Data to merge (UPDATE) for UID ${userData.uid}:`, "color: #1E90FF; font-weight:bold;", dataToMerge);
      await firestoreSetDoc(userDocRef, dataToMerge, { merge: true });
      console.log(`%c[connectionService] initializeUserProfile: User profile UPDATED successfully in Firestore for UID ${userData.uid}.`, "color: green; font-weight:bold;");
    }

    // Sync with Firebase Auth Profile if changes are needed
    if (auth.currentUser) {
        const authUpdatesNeeded: { displayName?: string | null; photoURL?: string | null } = {};
        if (auth.currentUser.displayName !== finalAuthDisplayName) {
            authUpdatesNeeded.displayName = finalAuthDisplayName;
        }
        if (auth.currentUser.photoURL !== finalAvatarUrl) { // finalAvatarUrl is already correctly null for new sign-ups
            authUpdatesNeeded.photoURL = finalAvatarUrl;
        }

        if (Object.keys(authUpdatesNeeded).length > 0) {
            console.log(`%c[connectionService] initializeUserProfile: Attempting to update auth.currentUser profile with:`, "color: #FF8C00;", authUpdatesNeeded);
            try {
                await updateProfile(auth.currentUser, authUpdatesNeeded);
                console.log(`%c[connectionService] initializeUserProfile: auth.currentUser profile updated successfully.`, "color: #FF8C00;");
            } catch (authUpdateError) {
                console.error(`%c[connectionService] initializeUserProfile: FAILED to update auth.currentUser profile. Error:`, "color: red;", authUpdateError);
            }
        } else {
            console.log(`%c[connectionService] initializeUserProfile: No changes needed for auth.currentUser profile. Current Auth DisplayName: '${auth.currentUser.displayName}', PhotoURL: '${auth.currentUser.photoURL}'. Calculated: DisplayName='${finalAuthDisplayName}', AvatarURL='${finalAvatarUrl}'`, "color: #FF8C00;");
        }
    }

  } catch (error: any) {
    console.error(`%c[connectionService] initializeUserProfile: Firestore Error on setDoc for UID ${userData.uid}:`, "color: red; font-weight:bold;", error);
    console.error(`  Error Code: ${error.code}`);
    console.error(`  Error Message: ${error.message}`);
  }
};


export const getSuggestibleUsers = async (searchPrefix?: string, limitCountArg?: number): Promise<UserProfileBasic[]> => {
  const trimmedPrefix = searchPrefix?.trim().toLowerCase();
  const effectiveLimit = !trimmedPrefix ? (limitCountArg || 25) : (limitCountArg || 10);
  console.log(`%c[connectionService] getSuggestibleUsers called. Prefix: '${trimmedPrefix}', Effective Limit: ${effectiveLimit}`, "color: #BA55D3");

  try {
    const constraints: FirestoreQueryConstraint[] = [];
    // For @mentions, we query/filter by `mentionName` (the ColorAnimalNumber name)
    const fieldToQuery = 'mentionName';

    if (trimmedPrefix) {
      console.log(`%c[connectionService] getSuggestibleUsers: Applying prefix search for '${trimmedPrefix}' on ${fieldToQuery}.`, "color: #BA55D3");
      // Firestore prefix queries require a field to start with the prefix.
      // Case-sensitive: Firestore's default string comparisons are case-sensitive.
      // For case-insensitive prefix search, you'd typically store a lowercase version of mentionName.
      // For now, assuming mentionName is stored consistently (e.g., PascalCase as generated).
      // If searchPrefix is 'blue', it will match 'BlueWhale123' if you query for 'Blue'.
      // To make it truly case-insensitive at query time, you'd need more complex data duplication or a search service.
      // The current filter will be case-sensitive for the prefix part.
      const prefixForQuery = trimmedPrefix.charAt(0).toUpperCase() + trimmedPrefix.slice(1); // Basic attempt to match PascalCase

      constraints.push(firestoreWhere(fieldToQuery, '>=', prefixForQuery));
      constraints.push(firestoreWhere(fieldToQuery, '<=', prefixForQuery + '\uf8ff'));
      constraints.push(firestoreOrderBy(fieldToQuery));
    } else {
      console.log(`%c[connectionService] getSuggestibleUsers: No prefix, fetching general list ordered by ${fieldToQuery}.`, "color: #BA55D3");
      constraints.push(firestoreOrderBy(fieldToQuery));
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
      const mentionName = data.mentionName || data.generatedAnonymousName || generateAnonymousName(docSnap.id);
      // For the suggestion UI, displayName can be the more "real" name if available
      const displayForUI = data.actualDisplayName || data.companyName || mentionName;

      const profile: UserProfileBasic = {
        userId: docSnap.id,
        displayName: displayForUI,
        mentionName: mentionName,
        companyName: data.companyName || undefined,
        actualDisplayName: data.actualDisplayName || undefined,
        avatarUrl: data.avatarUrl || data.photoURL || undefined,
      };
      return profile;
    });
    console.log(`%c[connectionService] getSuggestibleUsers: Successfully mapped ${users.length} users.`, "color: green;");
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
      'actualDisplayNameVisibility', 'companyNameVisibility' // Added visibility for names
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

  sanitizedData.updatedAt = firestoreServerTimestamp();

  try {
    await firestoreUpdateDoc(userDocRef, sanitizedData);
    console.log(`%c[connectionService] User profile details UPDATED successfully in Firestore for UID ${trimmedUserId}.`, "color: green;");

    // Sync avatar with Firebase Auth if it was part of the update
    if (dataToUpdate.avatarUrl !== undefined && clientAuthUser.photoURL !== dataToUpdate.avatarUrl) {
      const authUpdates: { photoURL?: string | null } = { photoURL: dataToUpdate.avatarUrl };
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
