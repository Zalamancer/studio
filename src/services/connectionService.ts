// src/services/connectionService.ts
import { db, auth } from '@/lib/firebase/config';
import {
  updateProfile, // This is correctly from firebase/auth
} from 'firebase/auth';
import {
  collection as firestoreCollection,
  query as firestoreQuery,
  where as firestoreWhere,
  getDocs as firestoreGetDocs,
  setDoc as firestoreSetDoc,
  doc as firestoreDoc,
  updateDoc as firestoreUpdateDoc,
  Timestamp, // Moved here
  serverTimestamp as firestoreServerTimestamp, // Aliased for clarity if serverTimestamp is also from auth
  orderBy as firestoreOrderBy,
  limit as firestoreLimit,
  getDoc as firestoreGetDoc,
  deleteDoc as firestoreDeleteDoc,
  type QueryConstraint as FirestoreQueryConstraint,
} from 'firebase/firestore'; // Correct imports for Firestore

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
  const clientAuthUser = auth.currentUser;
  const clientAuthUid = clientAuthUser?.uid;

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
    status: 'pending',
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
      const existingStatus = connectionDocSnap.data().status;
      if (existingStatus === 'connected') throw new Error("You are already connected with this user.");
      if (existingStatus === 'pending') {
        const existingRequester = connectionDocSnap.data().requesterId;
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
    if (!connectionData.userIds.includes(userId)) throw new Error("User not part of this connection request.");
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
    if (!connectionData.userIds.includes(userId)) throw new Error("User not part of this connection.");
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
    if (data.status === 'blocked') return 'blocked'; // Assuming 'blocked' status exists
    return 'not_connected';
  } catch (error: any) {
    console.error(`[connectionService] Error fetching connection status between ${userId1} and ${userId2} (ID: ${connectionId}):`, error);
    if (error.code === 'permission-denied') {
       console.error(`  PERMISSION_DENIED for reading mutuals/${connectionId}. Client auth UID: '${currentClientAuthUid || 'NULL'}'. Rule expects 'userIds' in doc to contain this UID if doc exists.`);
    }
    return null;
  }
};

export const fetchUserProfileBasic = async (userId: string): Promise<UserProfileBasic | null> => {
  const trimmedUserId = String(userId || "").trim();
  const clientAuthUid = auth.currentUser?.uid;
  console.log(`%c[connectionService] fetchUserProfileBasic: Fetching for targetUserId: '${trimmedUserId}'. Current clientAuthUid: '${clientAuthUid || 'NULL'}'`, "color: teal;");

  if (!trimmedUserId || !IS_UID_REGEX_SERVICE.test(trimmedUserId)) {
    console.warn(`%c[connectionService] fetchUserProfileBasic: Attempted to fetch profile with invalid or empty userId: '${trimmedUserId}'. Returning generated name.`, "color: orange;");
    const anonName = generateAnonymousName(trimmedUserId || "unknown_user");
    return { userId: trimmedUserId, displayName: anonName, mentionName: anonName, companyName: undefined };
  }

  try {
    const userDocRef = firestoreDoc(usersCollectionRef, trimmedUserId);
    const userSnap = await firestoreGetDoc(userDocRef);

    if (userSnap.exists()) {
      const userData = userSnap.data() as UserProfileData;
      const generatedName = userData.generatedAnonymousName || generateAnonymousName(trimmedUserId);
      const profile: UserProfileBasic = {
        userId: trimmedUserId,
        displayName: userData.actualDisplayName || userData.companyName || generatedName,
        mentionName: generatedName,
        companyName: userData.companyName || undefined,
        avatarUrl: userData.avatarUrl || userData.photoURL || undefined,
      };
      console.log(`%c[connectionService] fetchUserProfileBasic: Profile FOUND for '${trimmedUserId}':`, "color: green;", profile);
      return profile;
    }
    console.warn(`%c[connectionService] fetchUserProfileBasic: Profile document NOT FOUND for userId: '${trimmedUserId}'. Using generated names.`, "color: orange;");
    const anonName = generateAnonymousName(trimmedUserId);
    return { userId: trimmedUserId, displayName: anonName, mentionName: anonName, companyName: undefined };
  } catch (error: any) {
    console.error(`%c[connectionService] fetchUserProfileBasic: Error fetching profile for '${trimmedUserId}':`, "color: red;", error);
    if (error.code === 'permission-denied') {
      console.error(`%c  PERMISSION DENIED specifically for reading 'users/${trimmedUserId}'. Ensure rules allow reads for authenticated users. Current client auth state was: '${clientAuthUid || 'NULL'}'`, "color: red; font-weight: bold;");
    }
    const anonName = generateAnonymousName(trimmedUserId);
    return { userId: trimmedUserId, displayName: anonName, mentionName: anonName, companyName: undefined };
  }
};


export const fetchFullUserProfile = async (userId: string): Promise<UserProfileData | null> => {
  const trimmedUserId = String(userId || "").trim();
   console.log(`%c[connectionService] fetchFullUserProfile: Fetching for targetUserId: '${trimmedUserId}'`, "color: darkcyan;");

  if (!trimmedUserId || !IS_UID_REGEX_SERVICE.test(trimmedUserId)) {
    console.warn(`%c[connectionService] fetchFullUserProfile: Attempted to fetch with invalid or empty userId: '${trimmedUserId}'. Returning null.`, "color: orange;");
    return null;
  }

  try {
    const userDocRef = firestoreDoc(usersCollectionRef, trimmedUserId);
    const userSnap = await firestoreGetDoc(userDocRef);

    if (userSnap.exists()) {
      const userData = userSnap.data() as UserProfileData;
      const generatedName = userData.generatedAnonymousName || generateAnonymousName(trimmedUserId);
      const fullProfile: UserProfileData = {
        uid: trimmedUserId,
        email: userData.email || undefined,
        actualDisplayName: userData.actualDisplayName || undefined,
        companyName: userData.companyName || undefined,
        generatedAnonymousName: generatedName,
        industry: userData.industry || undefined,
        avatarUrl: userData.avatarUrl || userData.photoURL || null,
        photoURL: userData.photoURL || null, // Keep photoURL from auth if synced
        description: userData.description || undefined,
        tags: userData.tags || [],
        location: userData.location || undefined,
        established: userData.established || undefined,
        contactEmail: userData.contactEmail || undefined,
        contactPhone: userData.contactPhone || undefined,
        verified: userData.verified || false,
        companyNameVisibility: userData.companyNameVisibility || 'everyone',
        industryVisibility: userData.industryVisibility || 'everyone',
        descriptionVisibility: userData.descriptionVisibility || 'everyone',
        avatarVisibility: userData.avatarVisibility || 'everyone',
        createdAt: userData.createdAt,
        lastLoginAt: userData.lastLoginAt,
        updatedAt: userData.updatedAt,
      };
      console.log(`%c[connectionService] fetchFullUserProfile: Full profile FOUND for '${trimmedUserId}':`, "color: green;", fullProfile);
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

export const initializeUserProfile = async (userData: UserProfileData): Promise<void> => {
  console.log(`%c[connectionService] initializeUserProfile: Called with incomingUserData:`, "color: orange", userData);
  if (!userData || !userData.uid || !IS_UID_REGEX_SERVICE.test(userData.uid)) {
    console.error('%c[connectionService] initializeUserProfile: ERROR - UID is missing or invalid in userData. Aborting.', "color: red; font-weight:bold;", userData);
    return;
  }

  const userDocRef = firestoreDoc(usersCollectionRef, userData.uid);
  const generatedName = generateAnonymousName(userData.uid);
  const dataPayload: Partial<UserProfileData> = { uid: userData.uid };
  let finalAuthDisplayName: string;
  let finalAvatarUrl: string | null = null;
  const authProfileUpdates: { displayName?: string | null; photoURL?: string | null } = {};

  try {
    const docSnap = await firestoreGetDoc(userDocRef);

    if (!docSnap.exists()) {
      console.log(`%c[connectionService] initializeUserProfile: Creating new profile for UID ${userData.uid}.`, "color: green;");
      dataPayload.createdAt = firestoreServerTimestamp() as Timestamp;
      dataPayload.generatedAnonymousName = generatedName;

      // Determine display name priority: explicit displayName (e.g., from Google), then companyName, then generated
      if (userData.actualDisplayName) {
        dataPayload.actualDisplayName = userData.actualDisplayName;
        finalAuthDisplayName = userData.actualDisplayName;
        console.log(`  Using actualDisplayName for new profile: '${userData.actualDisplayName}'`);
      } else if (userData.companyName) {
        dataPayload.companyName = userData.companyName;
        finalAuthDisplayName = userData.companyName;
        console.log(`  Using companyName for new profile: '${userData.companyName}'`);
      } else {
        finalAuthDisplayName = generatedName;
        console.log(`  Using generatedAnonymousName for new profile: '${generatedName}'`);
      }
      dataPayload.displayName = finalAuthDisplayName; // Storing the chosen one as 'displayName' for Firestore

      finalAvatarUrl = null; // Always null for new profiles, as per requirement.
      dataPayload.avatarUrl = finalAvatarUrl;
      authProfileUpdates.displayName = finalAuthDisplayName;
      authProfileUpdates.photoURL = finalAvatarUrl; // Set Firebase Auth photoURL to null

      if (userData.email) dataPayload.email = userData.email;
      if (userData.companyName) dataPayload.companyName = userData.companyName;
      if (userData.industry) dataPayload.industry = userData.industry;

      // Default visibility settings
      dataPayload.companyNameVisibility = 'everyone';
      dataPayload.industryVisibility = 'everyone';
      dataPayload.descriptionVisibility = 'everyone';
      dataPayload.avatarVisibility = 'everyone';

    } else {
      console.log(`%c[connectionService] initializeUserProfile: Updating existing profile for UID ${userData.uid}.`, "color: blue;");
      const existingData = docSnap.data() as UserProfileData;
      dataPayload.generatedAnonymousName = existingData.generatedAnonymousName || generatedName;

      // Determine display name: Prefer new userData.displayName, then new userData.companyName,
      // then existing actualDisplayName, then existing companyName, then existing generatedAnonymousName.
      if (userData.actualDisplayName) {
        dataPayload.actualDisplayName = userData.actualDisplayName;
        finalAuthDisplayName = userData.actualDisplayName;
      } else if (userData.companyName) {
        dataPayload.companyName = userData.companyName; // Still store it if provided
        finalAuthDisplayName = userData.companyName; // Use as auth display name if actualDisplayName isn't new
      } else if (existingData.actualDisplayName) {
        finalAuthDisplayName = existingData.actualDisplayName;
      } else if (existingData.companyName) {
        finalAuthDisplayName = existingData.companyName;
      } else {
        finalAuthDisplayName = dataPayload.generatedAnonymousName;
      }
      dataPayload.displayName = finalAuthDisplayName; // Store chosen one in Firestore

      // Avatar: Update if Google provides a new one, otherwise keep existing or null.
      // Respect the rule "do not assign avatarUrl when people sign up using google" for *initial sign-up*
      // This part handles *updates* on subsequent sign-ins.
      if (userData.photoURL && userData.photoURL !== existingData.avatarUrl) {
        finalAvatarUrl = userData.photoURL;
        console.log(`  Updating avatarUrl from new userData.photoURL: '${finalAvatarUrl}'`);
      } else if (existingData.avatarUrl !== undefined) { // Check if undefined to distinguish from explicit null
        finalAvatarUrl = existingData.avatarUrl;
        console.log(`  Keeping existing avatarUrl: '${finalAvatarUrl}'`);
      } else {
        finalAvatarUrl = null;
        console.log(`  Setting avatarUrl to null (no new or existing).`);
      }
      dataPayload.avatarUrl = finalAvatarUrl;

      if (auth.currentUser && auth.currentUser.displayName !== finalAuthDisplayName) {
        authProfileUpdates.displayName = finalAuthDisplayName;
      }
      if (auth.currentUser && auth.currentUser.photoURL !== finalAvatarUrl) {
        authProfileUpdates.photoURL = finalAvatarUrl;
      }

      if (userData.email && userData.email !== existingData.email) dataPayload.email = userData.email;
      if (userData.companyName && userData.companyName !== existingData.companyName) dataPayload.companyName = userData.companyName;
      if (userData.industry && userData.industry !== existingData.industry) dataPayload.industry = userData.industry;

      dataPayload.companyNameVisibility = existingData.companyNameVisibility || 'everyone';
      dataPayload.industryVisibility = existingData.industryVisibility || 'everyone';
      dataPayload.descriptionVisibility = existingData.descriptionVisibility || 'everyone';
      dataPayload.avatarVisibility = existingData.avatarVisibility || 'everyone';
    }

    dataPayload.lastLoginAt = firestoreServerTimestamp() as Timestamp;
    dataPayload.updatedAt = firestoreServerTimestamp() as Timestamp; // Always update this timestamp

    const dataToWrite: { [key: string]: any } = { uid: userData.uid };
    Object.keys(dataPayload).forEach(keyStr => {
      const key = keyStr as keyof typeof dataPayload;
      if (dataPayload[key] !== undefined) {
        dataToWrite[key] = dataPayload[key];
      }
    });
     if (dataToWrite.avatarUrl === undefined) dataToWrite.avatarUrl = null; // Ensure explicit null for Firestore

    const operationType = docSnap.exists() ? "UPDATE (MERGE)" : "CREATE";
    console.log(`%c[connectionService] initializeUserProfile: Data to ${operationType} for UID ${userData.uid}:`, "color: #1E90FF; font-weight:bold;", dataToWrite);

    await firestoreSetDoc(userDocRef, dataToWrite, { merge: docSnap.exists() });
    console.log(`%c[connectionService] User profile ${operationType}D successfully for UID ${userData.uid}.`, "color: green; font-weight:bold;");

    if (Object.keys(authProfileUpdates).length > 0 && auth.currentUser) {
      console.log(`%c[connectionService] initializeUserProfile: Attempting to update auth.currentUser profile with:`, "color: #FF8C00;", authProfileUpdates);
      try {
        await updateProfile(auth.currentUser, authProfileUpdates);
        console.log(`%c[connectionService] initializeUserProfile: auth.currentUser profile updated successfully.`, "color: #FF8C00;");
      } catch (authUpdateError) {
        console.error(`%c[connectionService] initializeUserProfile: FAILED to update auth.currentUser profile. Error:`, "color: red;", authUpdateError);
      }
    }

  } catch (error: any) {
    console.error(`%c[connectionService] initializeUserProfile: Firestore Error on setDoc/updateProfile for UID ${userData.uid}:`, "color: red; font-weight:bold;", error);
    console.error(`  Error Code: ${error.code}`);
    console.error(`  Error Message: ${error.message}`);
    throw new Error(`Failed to initialize/update user profile: ${error.message}`);
  }
};

export const getSuggestibleUsers = async (searchPrefix?: string, limitCountArg?: number): Promise<UserProfileBasic[]> => {
  const trimmedPrefix = searchPrefix?.trim().toLowerCase();
  // When no prefix (just @ typed), fetch more users. When prefix exists, fetch fewer.
  const effectiveLimit = !trimmedPrefix ? 25 : (limitCountArg || 10);
  console.log(`%c[connectionService] getSuggestibleUsers called. Prefix: '${trimmedPrefix}', Limit: ${effectiveLimit}`, "color: #BA55D3");

  try {
    const constraints: FirestoreQueryConstraint[] = [];
    const fieldToQuery = 'generatedAnonymousName'; // Always query based on generatedAnonymousName

    if (trimmedPrefix) {
      console.log(`%c[connectionService] getSuggestibleUsers: Applying prefix search for '${trimmedPrefix}' on ${fieldToQuery}.`, "color: #BA55D3");
      constraints.push(firestoreWhere(fieldToQuery, '>=', trimmedPrefix));
      constraints.push(firestoreWhere(fieldToQuery, '<=', trimmedPrefix + '\uf8ff'));
      constraints.push(firestoreOrderBy(fieldToQuery)); // Order by the field used in range filter
    } else {
      // When no prefix, fetch a general list. Ordering by generatedAnonymousName makes sense.
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
      const generatedName = data.generatedAnonymousName || generateAnonymousName(docSnap.id);
      const profile: UserProfileBasic = {
        userId: docSnap.id,
        displayName: data.actualDisplayName || data.companyName || generatedName,
        mentionName: generatedName, // This is the "ColorAnimalNumber"
        companyName: data.companyName || undefined,
        avatarUrl: data.avatarUrl || data.photoURL || undefined,
      };
      console.log(`  Mapped user: ${profile.userId}, Display: ${profile.displayName}, Mention: ${profile.mentionName}`);
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
      console.error("%c  MISSING INDEX. Firestore query for suggestible users requires an index (e.g., on 'generatedAnonymousName' ascending). Create this in Firebase console.", "color: red;");
      throw new Error("Query for suggestible users requires an index on generatedAnonymousName (ascending).");
    }
    return [];
  }
};

export const updateUserProfileDetails = async (
  userId: string,
  dataToUpdate: Partial<UserProfileData>
): Promise<void> => {
  if (!userId || !IS_UID_REGEX_SERVICE.test(userId)) {
    console.error("[connectionService] updateUserProfileDetails: userId is missing or invalid.");
    throw new Error("User ID is required and must be valid to update profile details.");
  }
  const clientAuthUser = auth.currentUser;
  if (!clientAuthUser || clientAuthUser.uid !== userId) {
    console.error(`[connectionService] updateUserProfileDetails: Auth mismatch or not authenticated. Client UID: ${clientAuthUser?.uid}, Target UserID: ${userId}`);
    throw new Error("Authentication error: Cannot update profile for another user or without authentication.");
  }

  const userDocRef = firestoreDoc(usersCollectionRef, userId);
  console.log(`%c[connectionService] updateUserProfileDetails: Attempting to update profile for UID ${userId} with data:`, "color: purple", dataToUpdate);

  const sanitizedData: { [key: string]: any } = {};
  for (const key in dataToUpdate) {
    if (Object.prototype.hasOwnProperty.call(dataToUpdate, key)) {
      const value = (dataToUpdate as any)[key];
      if (value !== undefined) {
        sanitizedData[key] = value;
      } else if (['actualDisplayName', 'companyName', 'industry', 'avatarUrl', 'description', 'location', 'established', 'contactEmail', 'contactPhone'].includes(key)) {
        sanitizedData[key] = null;
      }
    }
  }
  // Ensure generatedAnonymousName is not accidentally cleared if not explicitly provided
  if (dataToUpdate.generatedAnonymousName === undefined && 'generatedAnonymousName' in sanitizedData) {
    delete sanitizedData.generatedAnonymousName;
  }


  sanitizedData.updatedAt = firestoreServerTimestamp();

  try {
    await firestoreUpdateDoc(userDocRef, sanitizedData);
    console.log(`%c[connectionService] User profile details UPDATED successfully in Firestore for UID ${userId}.`, "color: green;");

    const authUpdates: { displayName?: string | null; photoURL?: string | null } = {};
    const currentAuthDisplayName = clientAuthUser.displayName;
    const currentAuthPhotoURL = clientAuthUser.photoURL;

    let newAuthDisplayName = currentAuthDisplayName;
    if (sanitizedData.actualDisplayName !== undefined) {
        newAuthDisplayName = sanitizedData.actualDisplayName || null;
    } else if (sanitizedData.companyName !== undefined && !sanitizedData.actualDisplayName) {
        // Only use companyName for auth if actualDisplayName wasn't specifically set in this update
        const existingProfileSnap = await firestoreGetDoc(userDocRef);
        const existingData = existingProfileSnap.data() as UserProfileData | undefined;
        if (!existingData?.actualDisplayName) { // If there's no actualDisplayName set, use company name
            newAuthDisplayName = sanitizedData.companyName || null;
        }
    }

    // Fallback for auth display name if everything else is cleared
    if (newAuthDisplayName === null) {
        const userSnap = await firestoreGetDoc(userDocRef);
        const existingData = userSnap.data() as UserProfileData | undefined;
        newAuthDisplayName = existingData?.generatedAnonymousName || generateAnonymousName(userId);
    }


    if (newAuthDisplayName !== currentAuthDisplayName) {
      authUpdates.displayName = newAuthDisplayName;
    }

    let newAuthPhotoURL = currentAuthPhotoURL;
    if (sanitizedData.avatarUrl !== undefined) {
        newAuthPhotoURL = sanitizedData.avatarUrl;
    }
    if (newAuthPhotoURL !== currentAuthPhotoURL) {
        authUpdates.photoURL = newAuthPhotoURL;
    }


    if (Object.keys(authUpdates).length > 0) {
      console.log(`%c[connectionService] updateUserProfileDetails: Attempting to update auth.currentUser profile with:`, "color: #FF8C00;", authUpdates);
      await updateProfile(clientAuthUser, authUpdates);
      console.log(`%c[connectionService] updateUserProfileDetails: auth.currentUser profile updated successfully.`, "color: #FF8C00;");
    }

  } catch (error: any) {
    console.error(`%c[connectionService] updateUserProfileDetails: Firestore Error updating profile for UID ${userId}:`, "color: red;", error);
    if (error.code === 'permission-denied') {
      throw new Error('Permission denied. Check Firestore security rules for updating your user document.');
    }
    throw new Error(`Failed to update profile details: ${error.message}`);
  }
};
