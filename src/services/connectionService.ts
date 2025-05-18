
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
  deleteDoc,
  Timestamp,
  serverTimestamp,
  orderBy,
  limit,
  getDoc,
  collectionGroup,
  type DocumentData,
  type QueryConstraint,
} from 'firebase/firestore';
import type { MutualConnection, ConnectionStatus, Connection, ConnectionRequest, UserProfileBasic, UserProfileData } from '@/types/connection';
import { generateAnonymousName } from '@/lib/pseudonymUtils'; // Import for fallback names

const mutualsCollectionRef = collection(db, 'mutuals');
const usersCollectionRef = collection(db, 'users'); // Assuming a 'users' collection for basic profiles
const IS_UID_REGEX_SERVICE = /^[a-zA-Z0-9]{20,}$/; // For service-level checks

// Helper to generate a consistent connection ID
const getConnectionDocId = (userId1: string, userId2: string): string => {
  if (!userId1 || !userId2 || !IS_UID_REGEX_SERVICE.test(userId1) || !IS_UID_REGEX_SERVICE.test(userId2) ) {
    console.error(`%c[connectionService] getConnectionDocId CRITICAL: Called with invalid UID(s). userId1: '${userId1}', userId2: '${userId2}'. This will result in an invalid/unexpected document ID.`, "color: red; font-weight: bold;");
    return `INVALID_CONNECTION_ID_DUE_TO_BAD_UIDS_${userId1}_${userId2}`;
  }
  return [userId1, userId2].sort().join('_');
};

// --- Send Connection Request ---
export const sendConnectionRequest = async (requesterId: string, recipientId: string): Promise<void> => {
  console.log(`%c[connectionService] sendConnectionRequest - Called with: requesterId='${requesterId}', recipientId='${recipientId}'`, "color: blue; font-weight:bold;");

  const clientAuthUid = auth.currentUser?.uid;

  if (!clientAuthUid) {
    const errorMsg = "User not authenticated. Cannot send connection request.";
    console.error(`%c[connectionService] sendConnectionRequest - ERROR: ${errorMsg}`, "color: red; font-weight:bold;");
    throw new Error(errorMsg);
  }

  if (requesterId !== clientAuthUid) {
    const errorMsg = `Requester ID parameter ('${requesterId}') does not match authenticated user UID ('${clientAuthUid}'). Aborting.`;
    console.error(`%c[connectionService] sendConnectionRequest - ERROR: ${errorMsg}`, "color: red; font-weight:bold;");
    throw new Error(errorMsg);
  }

  if (requesterId === recipientId) {
    const errorMsg = "Cannot send connection request to yourself.";
    console.error(`%c[connectionService] sendConnectionRequest - ERROR: ${errorMsg}`, "color: red; font-weight:bold;");
    throw new Error(errorMsg);
  }

  if (!recipientId || !IS_UID_REGEX_SERVICE.test(recipientId)) {
    console.error(`%c[connectionService] sendConnectionRequest - ERROR: recipientId '${recipientId}' is invalid or not a UID.`, "color: red; font-weight:bold;");
    throw new Error(`Invalid recipient ID: '${recipientId}'. Cannot send connection request. Recipient ID must be a valid Firebase UID.`);
  }


  const connectionId = getConnectionDocId(requesterId, recipientId);
  if (connectionId.startsWith("INVALID_CONNECTION_ID")) { 
    console.error(`%c[connectionService] sendConnectionRequest - ERROR: Could not generate valid connectionId. Aborting.`, "color: red; font-weight:bold;");
    throw new Error("Failed to generate valid connection ID for request.");
  }
  const connectionDocRef = doc(mutualsCollectionRef, connectionId);

  const sortedUserIds = [requesterId, recipientId].sort();
  const newConnectionData: Omit<MutualConnection, 'id'> = {
    userIds: sortedUserIds,
    status: 'pending',
    requesterId: requesterId,
    requestedAt: serverTimestamp() as Timestamp,
  };
  
  console.log(`%c[connectionService] sendConnectionRequest - Pre-check:`, "color: blue;");
  console.log(`  Param requesterId:               '${requesterId}'`);
  console.log(`  Param recipientId:               '${recipientId}'`);
  console.log(`  Client auth.currentUser?.uid:    '${clientAuthUid || 'NULL'}'`);
  console.log(`  Generated connectionId:          '${connectionId}'`);
  console.log(`%c[connectionService] sendConnectionRequest - Rule Check Values:`, "color: green;");
  console.log(`  1. request.auth != null:                            ${!!clientAuthUid}`);
  console.log(`  2. request.resource.data.requesterId == request.auth.uid: ${newConnectionData.requesterId === clientAuthUid} (Data: '${newConnectionData.requesterId}', Auth: '${clientAuthUid}')`);
  console.log(`  3. request.resource.data.userIds.hasAll([request.auth.uid]): ${newConnectionData.userIds.includes(clientAuthUid ?? '')} (Data: [${newConnectionData.userIds.join(', ')}], Auth: '${clientAuthUid}')`);


  try {
    const connectionDocSnap = await getDoc(connectionDocRef);

    if (connectionDocSnap.exists()) {
      const existingStatus = connectionDocSnap.data().status;
      if (existingStatus === 'connected') {
        throw new Error("You are already connected with this user.");
      } else if (existingStatus === 'pending') {
        const existingRequester = connectionDocSnap.data().requesterId;
        if (existingRequester === requesterId) {
          throw new Error("Connection request already sent by you.");
        } else {
          throw new Error("This user already sent you a connection request. Please check your pending requests.");
        }
      }
    }
    
    if (!auth.currentUser) { 
      const errorMsg = "User authentication lost immediately before Firestore write. Aborting.";
      console.error(`%c[connectionService] sendConnectionRequest - FATAL ERROR: ${errorMsg}`, "color: red; font-weight:bold;");
      throw new Error(errorMsg);
    }
    console.log(`%c[connectionService] Final auth check passed. Attempting to write to Firestore. Path: mutuals/${connectionId}. Data:`, "color: darkorange;", newConnectionData);

    await setDoc(connectionDocRef, newConnectionData);
    console.log(`[connectionService] Connection request sent successfully: ${connectionId}`);
  } catch (error: any) {
    console.error(`[connectionService] Error sending connection request (${connectionId}):`, error);
    if (error.code === 'permission-denied') {
      console.error(`%c[connectionService] PERMISSION_DENIED details at time of error:`, "color: red; font-weight:bold;");
      console.error(`  - auth.currentUser?.uid (at error): '${auth.currentUser?.uid || 'NULL'}'`);
      console.error(`  - param requesterId (at error):   '${requesterId}'`);
      console.error(`  - Data that was attempted for write (newConnectionData variable):`, newConnectionData);
      throw new Error('Permission denied. Check Firestore rules for creating mutuals documents.');
    }
    throw new Error(`${error.message || 'Failed to send connection request.'}`);
  }
};


// --- Accept Connection Request ---
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
  } catch (error: any) {
    console.error(`[connectionService] Error accepting connection request (${connectionId}):`, error);
    if (error.code === 'permission-denied') throw new Error('Permission denied. Check Firestore rules for updating mutuals documents.');
    throw new Error(`Failed to accept connection request: ${error.message}`);
  }
};

// --- Reject/Cancel Connection Request ---
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

// --- Remove Connection ---
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

// --- Get Connection Status Between Two Users ---
export const getConnectionStatus = async (userId1: string, userId2: string): Promise<ConnectionStatus | null> => {
  const currentClientAuthUid = auth.currentUser?.uid;
  console.log(`%c[connectionService] getConnectionStatus - Called for userId1: '${userId1}', userId2: '${userId2}'. Client Auth UID: '${currentClientAuthUid || 'NULL'}'`, "color: teal;");

  if (!userId1 || !userId2) {
    console.warn("[connectionService] getConnectionStatus: userId1 or userId2 is undefined/empty.");
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
    console.log(`%c[connectionService] getConnectionStatus: Attempting to getDoc for 'mutuals/${connectionId}'`, "color: darkorange;");
    const docSnap = await getDoc(connectionDocRef);
    if (!docSnap.exists()) {
      console.log(`[connectionService] getConnectionStatus: No document found for connectionId '${connectionId}'. Returning 'not_connected'.`);
      return 'not_connected';
    }
    const data = docSnap.data() as MutualConnection;
    if (!data || !data.status || !data.requesterId || !data.userIds) {
        console.warn(`[connectionService] getConnectionStatus: Document for '${connectionId}' has incomplete data. Returning 'not_connected'.`, data);
        return 'not_connected';
    }
    if (data.status === 'connected') return 'connected';
    if (data.status === 'pending') return data.requesterId === userId1 ? 'pending_sent' : 'pending_received';
    if (data.status === 'blocked') return 'blocked'; // Assuming 'blocked' is a possible status
    console.warn(`[connectionService] getConnectionStatus: Document for '${connectionId}' has an unexpected status: '${data.status}'. Returning 'not_connected'.`);
    return 'not_connected';
  } catch (error: any) {
    console.error(`[connectionService] Error fetching connection status between ${userId1} and ${userId2} (ID: ${connectionId}):`, error);
    if (error.code === 'permission-denied') {
       console.error(`  PERMISSION_DENIED for reading mutuals/${connectionId}. Client auth UID: '${currentClientAuthUid || 'NULL'}'. Rule expects 'userIds' in doc to contain this UID if doc exists.`);
    }
    return null; // Indicate an error occurred during fetch
  }
};

// --- Fetch Basic User Profile ---
const fetchUserProfileBasic = async (userId: string): Promise<UserProfileBasic | null> => {
  const clientAuthUid = auth.currentUser?.uid;
  console.log(`%c[connectionService] fetchUserProfileBasic: Fetching for targetUserId: '${userId}'. Current clientAuthUid: '${clientAuthUid || 'NULL'}'`, "color: teal;");

  if (!userId || !IS_UID_REGEX_SERVICE.test(userId)) { // Also check if userId looks like a UID
    console.warn(`%c[connectionService] fetchUserProfileBasic: Attempted to fetch profile with invalid or empty userId: '${userId}'.`, "color: orange;");
    return { userId: userId, displayName: generateAnonymousName(userId || "unknown") }; // Return generated for invalid ID too
  }

  if (!clientAuthUid && userId !== clientAuthUid) { 
    console.warn(`%c[connectionService] fetchUserProfileBasic: No authenticated user (clientAuthUid is NULL) when trying to fetch profile for OTHERS ('${userId}'). Public profile reads might be restricted by rules.`, "color: orange; font-weight:bold;");
  }

  try {
    const userDocRef = doc(usersCollectionRef, userId);
    const userSnap = await getDoc(userDocRef);

    if (userSnap.exists()) {
      const userData = userSnap.data();
      const profile: UserProfileBasic = {
        userId: userId,
        displayName: userData.displayName || userData.companyName || generateAnonymousName(userId),
        avatarUrl: userData.avatarUrl || userData.photoURL || undefined,
      };
      console.log(`%c[connectionService] fetchUserProfileBasic: Profile FOUND for '${userId}':`, "color: green;", profile);
      return profile;
    }
    console.warn(`%c[connectionService] fetchUserProfileBasic: Profile document NOT FOUND for userId: '${userId}'. Using generated name.`, "color: orange;");
    return { userId: userId, displayName: generateAnonymousName(userId) };
  } catch (error: any) {
    console.error(`%c[connectionService] fetchUserProfileBasic: Error fetching profile for '${userId}':`, "color: red;", error);
    if (error.code === 'permission-denied') {
      console.error(`%c  PERMISSION DENIED specifically for reading 'users/${userId}'. Ensure rules allow reads for authenticated users. Current client auth state was: '${clientAuthUid || 'NULL'}'`, "color: red; font-weight: bold;");
    }
    return { userId: userId, displayName: generateAnonymousName(userId) }; // Fallback on error
  }
};

// --- Get Pending Connection Requests Received by User ---
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
      console.error("[connectionService] Firestore permission denied fetching pending requests. Check rules for 'mutuals' collection.");
      throw new Error('Permission denied fetching pending requests. Check Firestore rules.');
    }
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
      console.error("[connectionService] Firestore query for pending requests requires an index. Create a composite index on 'userIds' (array-contains), 'status' (==), and 'requestedAt' (desc) in the Firebase console for the 'mutuals' collection.");
      throw new Error("Firestore query for pending requests requires an index. Please create it in the Firebase console.");
    }
    throw new Error(`Failed to fetch pending requests: ${error.message}`);
  }
};

// --- Get List of Connected Users (Mutuals) ---
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
      console.error("[connectionService] Firestore permission denied fetching connections. Check rules for 'mutuals' collection.");
      throw new Error('Permission denied fetching connections. Check Firestore rules.');
    }
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
      console.error("[connectionService] Firestore query for connections requires an index. Create a composite index on 'userIds' (array-contains), 'status' (==), and 'connectedAt' (desc) in the Firebase console for the 'mutuals' collection.");
      throw new Error("Firestore query requires an index for connections. Please create it in the Firebase console.");
    }
    throw new Error(`Failed to fetch connections: ${error.message}`);
  }
};

// --- Get Basic User Profile Info (callable directly) ---
export const getUserProfileBasic = async (userId: string): Promise<UserProfileBasic | null> => {
  return fetchUserProfileBasic(userId); // fetchUserProfileBasic already handles invalid UIDs internally
};

// --- Initialize User Profile Document ---
export const initializeUserProfile = async (userData: UserProfileData): Promise<void> => {
  console.log(`%c[connectionService] initializeUserProfile: Called with incomingUserData:`, "color: orange", userData);
  if (!userData || !userData.uid || !IS_UID_REGEX_SERVICE.test(userData.uid)) {
    console.error('%c[connectionService] initializeUserProfile: ERROR - UID is missing or invalid in userData. Aborting.', "color: red; font-weight:bold;", userData);
    return;
  }

  const userDocRef = doc(usersCollectionRef, userData.uid);

  try {
    const docSnap = await getDoc(userDocRef);
    const dataToWrite: { [key: string]: any } = {
      uid: userData.uid,
      lastLoginAt: serverTimestamp(),
    };

    if (userData.email !== undefined) dataToWrite.email = userData.email;
    if (userData.photoURL && typeof userData.photoURL === 'string' && userData.photoURL.trim() !== '') {
        dataToWrite.avatarUrl = userData.photoURL;
    }
    if (userData.companyName !== undefined) dataToWrite.companyName = userData.companyName;
    if (userData.industry !== undefined) dataToWrite.industry = userData.industry; // Make sure industry is handled

    let finalDisplayName: string | null = null;
    if (userData.displayName && userData.displayName.trim() !== '') {
      finalDisplayName = userData.displayName;
    } else if (userData.companyName && userData.companyName.trim() !== '') {
      finalDisplayName = userData.companyName;
    }

    if (!docSnap.exists()) {
      console.log(`%c[connectionService] initializeUserProfile: Creating new profile for UID ${userData.uid}.`, "color: green;");
      dataToWrite.createdAt = serverTimestamp();
      dataToWrite.displayName = finalDisplayName || generateAnonymousName(userData.uid);
      console.log(`%c[connectionService] Data to write (CREATE) for UID ${userData.uid}:`, "color: green;", dataToWrite);
      await setDoc(userDocRef, dataToWrite);
      console.log(`%c[connectionService] User profile CREATED successfully for UID ${userData.uid}.`, "color: green; font-weight:bold;");
    } else {
      console.log(`%c[connectionService] initializeUserProfile: Updating existing profile for UID ${userData.uid}.`, "color: blue;");
      const existingData = docSnap.data() as UserProfileData;
      if (finalDisplayName) {
        dataToWrite.displayName = finalDisplayName;
      } else if (!existingData.displayName) { 
        dataToWrite.displayName = generateAnonymousName(userData.uid);
      }
      console.log(`%c[connectionService] Data to merge (UPDATE) for UID ${userData.uid}:`, "color: blue;", dataToWrite);
      await setDoc(userDocRef, dataToWrite, { merge: true });
      console.log(`%c[connectionService] User profile UPDATED successfully for UID ${userData.uid}.`, "color: blue; font-weight:bold;");
    }
  } catch (error: any) {
    console.error(`%c[connectionService] Firestore Error on setDoc for UID ${userData.uid}:`, "color: red; font-weight:bold;", error);
    console.error(`  Error Code: ${error.code}`);
    console.error(`  Error Message: ${error.message}`);
    throw new Error(`Failed to initialize user profile: ${error.message}`);
  }
};


// --- Fetch Suggestible Users (for @mentions) ---
export const getSuggestibleUsers = async (searchPrefix?: string, limitCount: number = 10): Promise<UserProfileBasic[]> => {
  const trimmedPrefix = searchPrefix?.trim().toLowerCase(); // Ensure lowercase for case-insensitive search (if supported by your strategy)
  console.log(`[connectionService] getSuggestibleUsers called. Prefix: '${trimmedPrefix}', Limit: ${limitCount}`);

  try {
    const constraints: QueryConstraint[] = [];

    if (trimmedPrefix) {
      // Firestore "starts-with" query for case-insensitive search needs a trick:
      // Add a second field, e.g., 'displayName_lowercase', that stores the lowercase version
      // OR fetch a broader range and filter client-side (less ideal for many users)
      // For simplicity here, sticking to case-sensitive starts-with on 'displayName'.
      // If you need true case-insensitive search, you must store a lowercase version of the field.
      constraints.push(where('displayName', '>=', trimmedPrefix));
      constraints.push(where('displayName', '<=', trimmedPrefix + '\uf8ff'));
      constraints.push(orderBy('displayName'));
    } else {
      constraints.push(orderBy('displayName')); // Default order if no prefix
    }
    constraints.push(limit(limitCount));

    const q = query(usersCollectionRef, ...constraints);

    const querySnapshot = await getDocs(q);
    const users = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data() as DocumentData;
      return {
        userId: docSnap.id,
        displayName: data.displayName || data.companyName || generateAnonymousName(docSnap.id),
        avatarUrl: data.avatarUrl || data.photoURL || undefined,
      } as UserProfileBasic;
    });
    console.log(`[connectionService] getSuggestibleUsers: Found ${users.length} users for prefix "${trimmedPrefix || ''}".`);
    return users;
  } catch (error: any) {
    console.error('[connectionService] Error fetching suggestible users:', error);
    if (error.code === 'permission-denied') {
      throw new Error('Permission denied fetching users. Check Firestore rules for listing users.');
    }
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
      console.error("[connectionService] Query for suggestible users requires an index (e.g., on 'displayName' ascending). Create this in Firebase console.");
      throw new Error('Query for suggestible users requires an index. Please create it in Firebase (e.g., on displayName).');
    }
    return [];
  }
};
