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
import type { ConnectionStatus, Connection, ConnectionRequest, UserProfileBasic, UserProfileData } from '@/types/connection';
import { generateAnonymousName } from '@/lib/pseudonymUtils';
import { createNotification } from './notificationService'; // Import notification service

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

export const sendConnectionRequest = async (requesterIdParam: string, recipientIdParam: string): Promise<void> => {
  const requesterId = String(requesterIdParam || "").trim();
  const recipientId = String(recipientIdParam || "").trim();
  const clientAuthUser = auth.currentUser;
  const clientAuthUid = clientAuthUser?.uid;

  console.log(`%c[connectionService] sendConnectionRequest - Pre-check:`, "color: blue;");
  console.log(`  Param requesterId:               '${requesterId}'`);
  console.log(`  Param recipientId:               '${recipientId}'`);
  console.log(`  Client auth.currentUser?.uid:    '${clientAuthUid || 'NULL'}'`);

  if (requesterId === recipientId) {
    const errorMsg = "Cannot send connection request to yourself.";
    console.error(`%c[connectionService] sendConnectionRequest - ERROR: ${errorMsg}`, "color: red; font-weight:bold;");
    throw new Error(errorMsg);
  }
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
  const newConnectionData: Omit<MutualConnection, 'id'> = {
    userIds: sortedUserIds,
    status: 'pending',
    requesterId: requesterId,
    requestedAt: serverTimestamp() as Timestamp,
  };

  console.log(`%c[connectionService] sendConnectionRequest - Rule Check Values:`, "color: green;");
  console.log(`  1. request.auth != null:                            ${!!clientAuthUid}`);
  console.log(`  2. request.resource.data.requesterId == request.auth.uid: ${newConnectionData.requesterId === clientAuthUid} (Data: '${newConnectionData.requesterId}', Auth: '${clientAuthUid}')`);
  console.log(`  3. request.resource.data.userIds.hasAll([request.auth.uid]): ${clientAuthUid ? newConnectionData.userIds.includes(clientAuthUid) : false} (Data: [${newConnectionData.userIds.join(', ')}], Auth: '${clientAuthUid}')`);

  try {
    const connectionDocSnap = await getDoc(connectionDocRef);
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

    await setDoc(connectionDocRef, newConnectionData);
    console.log(`[connectionService] Connection request sent successfully: ${connectionId}`);

    // Create notification for the recipient
    await createNotification({
      userId: recipientId, // The user who receives the request
      type: 'connection_request',
      senderId: requesterId, // The user who sent the request
      // senderName and senderAvatar will be fetched by createNotification
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
    const connectionData = connectionDocSnap.data() as MutualConnection;
    if (connectionData.requesterId === acceptorId) throw new Error("Cannot accept your own connection request.");
    if (!connectionData.userIds.includes(acceptorId)) throw new Error("Acceptor is not part of this connection request.");
    if (connectionData.status !== 'pending') throw new Error("Connection request is not pending.");
    
    await updateDoc(connectionDocRef, { status: 'connected', connectedAt: serverTimestamp() });
    console.log(`[connectionService] Connection request accepted successfully: ${connectionId}`);

    // Create notification for the original requester
    const originalRequesterId = connectionData.requesterId;
    if (originalRequesterId) {
      await createNotification({
        userId: originalRequesterId, // The user who initially sent the request
        type: 'connection_accepted',
        senderId: acceptorId, // The user who accepted the request
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
    const connectionData = connectionDocSnap.data() as MutualConnection;
    if (!connectionData.userIds.includes(userId)) throw new Error("User not part of this connection request.");
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
    const connectionData = connectionDocSnap.data() as MutualConnection;
    if (!connectionData.userIds.includes(userId)) throw new Error("User not part of this connection.");
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
    const data = docSnap.data() as MutualConnection;
    if (!data || !data.status || !data.requesterId || !data.userIds) {
      return 'not_connected';
    }
    if (data.status === 'connected') return 'connected';
    if (data.status === 'pending') return data.requesterId === userId1 ? 'pending_sent' : 'pending_received';
    if (data.status === 'blocked') return 'blocked'; // Assuming 'blocked' is a possible status you might implement
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
    return { userId: trimmedUserId, displayName: generateAnonymousName(trimmedUserId || "unknown_user") };
  }

  try {
    const userDocRef = doc(usersCollectionRef, trimmedUserId);
    const userSnap = await getDoc(userDocRef);

    if (userSnap.exists()) {
      const userData = userSnap.data() as UserProfileData;
      const profile: UserProfileBasic = {
        userId: trimmedUserId,
        displayName: userData.displayName || userData.companyName || generateAnonymousName(trimmedUserId),
        avatarUrl: userData.avatarUrl || userData.photoURL || undefined,
      };
      console.log(`%c[connectionService] fetchUserProfileBasic: Profile FOUND for '${trimmedUserId}':`, "color: green;", profile);
      return profile;
    }
    console.warn(`%c[connectionService] fetchUserProfileBasic: Profile document NOT FOUND for userId: '${trimmedUserId}'. Using generated name.`, "color: orange;");
    return { userId: trimmedUserId, displayName: generateAnonymousName(trimmedUserId) };
  } catch (error: any) {
    console.error(`%c[connectionService] fetchUserProfileBasic: Error fetching profile for '${trimmedUserId}':`, "color: red;", error);
    if (error.code === 'permission-denied') {
      console.error(`%c  PERMISSION DENIED specifically for reading 'users/${trimmedUserId}'. Ensure rules allow reads for authenticated users. Current client auth state was: '${clientAuthUid || 'NULL'}'`, "color: red; font-weight: bold;");
    }
    return { userId: trimmedUserId, displayName: generateAnonymousName(trimmedUserId) };
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
    const userDocRef = doc(usersCollectionRef, trimmedUserId);
    const userSnap = await getDoc(userDocRef);

    if (userSnap.exists()) {
      const userData = userSnap.data() as UserProfileData;
      const fullProfile: UserProfileData = {
        uid: trimmedUserId,
        email: userData.email || undefined,
        displayName: userData.displayName || generateAnonymousName(trimmedUserId),
        companyName: userData.companyName || undefined,
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
    const q = query(
      mutualsCollectionRef,
      where('userIds', 'array-contains', userId),
      where('status', '==', 'pending'),
      orderBy('requestedAt', 'desc'),
      limit(50)
    );
    const querySnapshot = await getDocs(q);
    const requestsPromises = querySnapshot.docs
      .filter(docSnap => {
        const data = docSnap.data();
        return data.requesterId !== userId && data.userIds.includes(userId);
      })
      .map(async (docSnap) => {
        const data = docSnap.data() as Omit<MutualConnection, 'id'>;
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
    const q = query(
      mutualsCollectionRef,
      where('userIds', 'array-contains', userId),
      where('status', '==', 'connected'),
      orderBy('connectedAt', 'desc'),
      limit(100)
    );
    const querySnapshot = await getDocs(q);
    const connectionsPromises = querySnapshot.docs.map(async (docSnap) => {
      const data = docSnap.data() as Omit<MutualConnection, 'id'>;
      const otherUserId = data.userIds.find(id => id !== userId);
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

  const userDocRef = doc(usersCollectionRef, userData.uid);
  const dataPayload: Partial<UserProfileData> = { uid: userData.uid };
  let finalDisplayName: string;
  let finalAvatarUrl: string | null = null; // Default to null
  const authProfileUpdates: { displayName?: string | null; photoURL?: string | null } = {};

  try {
    const docSnap = await getDoc(userDocRef);

    if (!docSnap.exists()) {
      console.log(`%c[connectionService] initializeUserProfile: Creating new profile for UID ${userData.uid}.`, "color: green;");
      dataPayload.createdAt = serverTimestamp() as Timestamp;

      if (userData.displayName && userData.displayName.trim() !== '') {
        finalDisplayName = userData.displayName;
        console.log(`  Using displayName from Google/Provider: "${finalDisplayName}"`);
      } else if (userData.companyName && userData.companyName.trim() !== '') {
        finalDisplayName = userData.companyName;
        console.log(`  Using companyName from Sign-Up form: "${finalDisplayName}"`);
      } else {
        finalDisplayName = generateAnonymousName(userData.uid);
        console.log(`  Generated anonymous name: "${finalDisplayName}"`);
      }
      
      finalAvatarUrl = null; // Explicitly set to null for new sign-ups
      console.log(`  Setting avatarUrl for new user to null.`);

      dataPayload.displayName = finalDisplayName;
      dataPayload.avatarUrl = finalAvatarUrl;
      authProfileUpdates.displayName = finalDisplayName;
      authProfileUpdates.photoURL = finalAvatarUrl;

      if (userData.email) dataPayload.email = userData.email;
      if (userData.companyName) dataPayload.companyName = userData.companyName;
      if (userData.industry) dataPayload.industry = userData.industry;

      dataPayload.companyNameVisibility = 'everyone';
      dataPayload.industryVisibility = 'everyone';
      dataPayload.descriptionVisibility = 'everyone';
      dataPayload.avatarVisibility = 'everyone';
    } else {
      console.log(`%c[connectionService] initializeUserProfile: Updating existing profile for UID ${userData.uid}.`, "color: blue;");
      const existingData = docSnap.data() as UserProfileData;

      let determinedDisplayName = existingData.displayName || existingData.companyName;
      if (userData.displayName && userData.displayName.trim() !== '' && userData.displayName !== determinedDisplayName) {
        determinedDisplayName = userData.displayName;
        console.log(`  Updating displayName from Google/Provider: "${determinedDisplayName}"`);
      } else if (userData.companyName && userData.companyName.trim() !== '' && userData.companyName !== determinedDisplayName && !userData.displayName) {
         determinedDisplayName = userData.companyName;
         console.log(`  Updating displayName using companyName from Sign-Up form: "${determinedDisplayName}"`);
      }
      finalDisplayName = determinedDisplayName || generateAnonymousName(userData.uid);
      
      if (userData.photoURL && userData.photoURL.trim() !== '' && userData.photoURL !== existingData.avatarUrl) {
        finalAvatarUrl = userData.photoURL;
        console.log(`  Updating avatarUrl from Google/Provider: "${finalAvatarUrl}"`);
      } else if (existingData.avatarUrl) {
        finalAvatarUrl = existingData.avatarUrl;
        console.log(`  Keeping existing avatarUrl: "${finalAvatarUrl}"`);
      } else {
        finalAvatarUrl = null;
        console.log(`  Setting avatarUrl to null (no new photoURL from provider, no existing).`);
      }

      dataPayload.displayName = finalDisplayName;
      dataPayload.avatarUrl = finalAvatarUrl;
      if (auth.currentUser && auth.currentUser.displayName !== finalDisplayName) authProfileUpdates.displayName = finalDisplayName;
      if (auth.currentUser && auth.currentUser.photoURL !== finalAvatarUrl) authProfileUpdates.photoURL = finalAvatarUrl;
      
      if (userData.email && userData.email !== existingData.email) dataPayload.email = userData.email;
      if (userData.companyName && userData.companyName !== existingData.companyName) dataPayload.companyName = userData.companyName;
      if (userData.industry && userData.industry !== existingData.industry) dataPayload.industry = userData.industry;

      dataPayload.companyNameVisibility = existingData.companyNameVisibility || 'everyone';
      dataPayload.industryVisibility = existingData.industryVisibility || 'everyone';
      dataPayload.descriptionVisibility = existingData.descriptionVisibility || 'everyone';
      dataPayload.avatarVisibility = existingData.avatarVisibility || 'everyone';
    }

    dataPayload.lastLoginAt = serverTimestamp() as Timestamp;
    dataPayload.updatedAt = serverTimestamp() as Timestamp;

    const dataToWrite: { [key: string]: any } = {};
    for (const key in dataPayload) {
      if (Object.prototype.hasOwnProperty.call(dataPayload, key)) {
        const value = (dataPayload as any)[key];
        if (value !== undefined) { // Ensure null is written, but undefined is skipped
          dataToWrite[key] = value;
        }
      }
    }
     if (dataToWrite.avatarUrl === undefined) dataToWrite.avatarUrl = null; // Ensure null for avatar if undefined

    if (!docSnap.exists()) {
      console.log(`%c[connectionService] Data to write (CREATE) for UID ${userData.uid}:`, "color: #1E90FF; font-weight:bold;", dataToWrite);
      await setDoc(userDocRef, dataToWrite);
      console.log(`%c[connectionService] User profile CREATED successfully for UID ${userData.uid}.`, "color: green; font-weight:bold;");
    } else {
      console.log(`%c[connectionService] Data to merge (UPDATE) for UID ${userData.uid}:`, "color: #1E90FF; font-weight:bold;", dataToWrite);
      await setDoc(userDocRef, dataToWrite, { merge: true });
      console.log(`%c[connectionService] User profile UPDATED successfully for UID ${userData.uid}.`, "color: blue; font-weight:bold;");
    }

    if (Object.keys(authProfileUpdates).length > 0 && auth.currentUser) {
      const updatesForAuth = { ...authProfileUpdates };
      if (updatesForAuth.displayName === undefined) delete updatesForAuth.displayName;
      if (updatesForAuth.photoURL === undefined) delete updatesForAuth.photoURL; // Ensure photoURL is null if that's intended

      console.log(`%c[connectionService] Attempting to update auth.currentUser profile:`, "color: #FF8C00;", updatesForAuth);
      await updateFirebaseAuthProfile(auth.currentUser, updatesForAuth);
      console.log(`%c[connectionService] auth.currentUser profile updated successfully.`, "color: #FF8C00;");
    }

  } catch (error: any) {
    console.error(`%c[connectionService] Firestore Error on setDoc/updateProfile for UID ${userData.uid}:`, "color: red; font-weight:bold;", error);
    console.error(`  Error Code: ${error.code}`);
    console.error(`  Error Message: ${error.message}`);
    throw new Error(`Failed to initialize/update user profile: ${error.message}`);
  }
};

export const getSuggestibleUsers = async (searchPrefix?: string, limitCountArg?: number): Promise<UserProfileBasic[]> => {
  const trimmedPrefix = searchPrefix?.trim().toLowerCase();
  const effectiveLimit = !trimmedPrefix ? 25 : (limitCountArg || 10);
  console.log(`%c[connectionService] getSuggestibleUsers called. Prefix: '${trimmedPrefix}', Limit: ${effectiveLimit}`, "color: #BA55D3");

  try {
    const constraints: QueryConstraint[] = [];

    if (trimmedPrefix) {
      console.log(`%c[connectionService] getSuggestibleUsers: Applying prefix search for '${trimmedPrefix}'`, "color: #BA55D3");
      constraints.push(where('displayName', '>=', trimmedPrefix));
      constraints.push(where('displayName', '<=', trimmedPrefix + '\uf8ff'));
      constraints.push(orderBy('displayName'));
    } else {
      console.log(`%c[connectionService] getSuggestibleUsers: No prefix, fetching general list ordered by displayName`, "color: #BA55D3");
      constraints.push(orderBy('displayName'));
    }
    constraints.push(limit(effectiveLimit));

    const q = query(usersCollectionRef, ...constraints);

    console.log("%c[connectionService] getSuggestibleUsers: Executing Firestore query...", "color: #BA55D3;", q);
    const querySnapshot = await getDocs(q);
    console.log(`%c[connectionService] getSuggestibleUsers: Firestore query executed. Found ${querySnapshot.docs.length} documents.`, "color: #BA55D3");
    
    if (querySnapshot.empty) {
      console.log("%c[connectionService] getSuggestibleUsers: No documents found for the query.", "color: orange;");
    }

    const users = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data() as UserProfileData;
      const profile: UserProfileBasic = {
        userId: docSnap.id,
        displayName: data.displayName || data.companyName || generateAnonymousName(docSnap.id),
        avatarUrl: data.avatarUrl || data.photoURL || undefined,
      };
      return profile;
    });
    console.log(`%c[connectionService] getSuggestibleUsers: Successfully mapped ${users.length} users. First few:`, "color: green;", users.slice(0,5).map(u => ({name: u.displayName, uid: u.userId })));
    return users;
  } catch (error: any) {
    console.error('%c[connectionService] Error fetching suggestible users:', "color: red;", error);
    if (error.code === 'permission-denied') {
      console.error('%c  PERMISSION DENIED. Check Firestore rules for listing users (users collection, list operation).', "color: red;");
      throw new Error('Permission denied fetching users. Check Firestore rules.');
    }
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
      console.error("%c  MISSING INDEX. Firestore query for suggestible users requires an index (e.g., on 'displayName' ascending). Create this in Firebase console.", "color: red;");
      throw new Error('Query for suggestible users requires an index on displayName (ascending).');
    }
    return [];
  }
};

export const updateUserProfileDetails = async (
  userId: string,
  dataToUpdate: Partial<UserProfileData>
): Promise<void> => {
  if (!userId) {
    console.error("[connectionService] updateUserProfileDetails: userId is required.");
    throw new Error("User ID is required to update profile details.");
  }
  const clientAuthUser = auth.currentUser;
  if (!clientAuthUser || clientAuthUser.uid !== userId) {
    console.error(`[connectionService] updateUserProfileDetails: Auth mismatch or not authenticated. Client UID: ${clientAuthUser?.uid}, Target UserID: ${userId}`);
    throw new Error("Authentication error: Cannot update profile for another user or without authentication.");
  }

  const userDocRef = doc(usersCollectionRef, userId);
  console.log(`%c[connectionService] updateUserProfileDetails: Attempting to update profile for UID ${userId} with data:`, "color: purple", dataToUpdate);

  const sanitizedData: { [key: string]: any } = {};
  for (const key in dataToUpdate) {
    if (Object.prototype.hasOwnProperty.call(dataToUpdate, key)) {
      const value = (dataToUpdate as any)[key];
      if (value !== undefined) {
        sanitizedData[key] = value;
      } else if (key === 'avatarUrl' || key === 'photoURL') { 
        sanitizedData[key] = null;
      }
    }
  }
  sanitizedData.updatedAt = serverTimestamp();

  try {
    await updateDoc(userDocRef, sanitizedData);
    console.log(`%c[connectionService] User profile details UPDATED successfully in Firestore for UID ${userId}.`, "color: green;");

    const authUpdates: { displayName?: string | null; photoURL?: string | null } = {};
    
    let newAuthDisplayName = auth.currentUser?.displayName;
    if (dataToUpdate.companyName && dataToUpdate.companyName !== newAuthDisplayName) {
      newAuthDisplayName = dataToUpdate.companyName; 
    } else if (dataToUpdate.displayName && dataToUpdate.displayName !== newAuthDisplayName && (!dataToUpdate.companyName || dataToUpdate.displayName !== dataToUpdate.companyName) ) {
       // only update with displayName if companyName isn't taking precedence or if displayName is different from companyName
      newAuthDisplayName = dataToUpdate.displayName;
    }
    if (newAuthDisplayName !== auth.currentUser?.displayName) {
      authUpdates.displayName = newAuthDisplayName;
    }
    
    let newAuthPhotoURL = auth.currentUser?.photoURL; 
    if (dataToUpdate.avatarUrl !== undefined) { 
        newAuthPhotoURL = dataToUpdate.avatarUrl; 
    }
    if (newAuthPhotoURL !== auth.currentUser?.photoURL) {
        authUpdates.photoURL = newAuthPhotoURL;
    }


    if (Object.keys(authUpdates).length > 0 && auth.currentUser) {
      console.log(`%c[connectionService] updateUserProfileDetails: Attempting to update auth.currentUser profile:`, "color: #FF8C00;", authUpdates);
      await updateFirebaseAuthProfile(auth.currentUser, authUpdates);
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
