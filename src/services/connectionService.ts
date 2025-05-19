
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

  if (requesterId === recipientId) {
    const errorMsg = "Cannot send connection request to yourself.";
    console.error(`%c[connectionService] sendConnectionRequest - ERROR: ${errorMsg}`, "color: red; font-weight:bold;");
    throw new Error(errorMsg);
  }

  const clientAuthUid = auth.currentUser?.uid;
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
    console.error(`%c[connectionService] sendConnectionRequest - ERROR: One or both IDs are invalid. Requester: '${requesterId}', Recipient: '${recipientId}'.`, "color: red; font-weight:bold;");
    throw new Error(`Invalid user ID format. Cannot send connection request.`);
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

  // console.log(`%c[connectionService] getConnectionStatus - Called for userId1: '${userId1}', userId2: '${userId2}'. Client Auth UID: '${currentClientAuthUid || 'NULL'}'`, "color: teal;");

  if (!userId1 || !userId2) {
    // console.warn("[connectionService] getConnectionStatus: userId1 or userId2 is undefined/empty.");
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
    // console.log(`%c[connectionService] getConnectionStatus: Attempting to getDoc for 'mutuals/${connectionId}'`, "color: darkorange;");
    const docSnap = await getDoc(connectionDocRef);
    if (!docSnap.exists()) {
      // console.log(`[connectionService] getConnectionStatus: No document found for connectionId '${connectionId}'. Returning 'not_connected'.`);
      return 'not_connected';
    }
    const data = docSnap.data() as MutualConnection;
    if (!data || !data.status || !data.requesterId || !data.userIds) {
        // console.warn(`[connectionService] getConnectionStatus: Document for '${connectionId}' has incomplete data. Returning 'not_connected'.`, data);
        return 'not_connected';
    }
    if (data.status === 'connected') return 'connected';
    if (data.status === 'pending') return data.requesterId === userId1 ? 'pending_sent' : 'pending_received';
    if (data.status === 'blocked') return 'blocked';
    // console.warn(`[connectionService] getConnectionStatus: Document for '${connectionId}' has an unexpected status: '${data.status}'. Returning 'not_connected'.`);
    return 'not_connected';
  } catch (error: any) {
    console.error(`[connectionService] Error fetching connection status between ${userId1} and ${userId2} (ID: ${connectionId}):`, error);
    if (error.code === 'permission-denied') {
       console.error(`  PERMISSION_DENIED for reading mutuals/${connectionId}. Client auth UID: '${currentClientAuthUid || 'NULL'}'. Rule expects 'userIds' in doc to contain this UID if doc exists.`);
    }
    return null;
  }
};


export const getUserProfileBasic = async (userId: string): Promise<UserProfileBasic | null> => {
  const trimmedUserId = String(userId || "").trim();
  const clientAuthUid = auth.currentUser?.uid;
  // console.log(`%c[connectionService] getUserProfileBasic: Fetching for targetUserId: '${trimmedUserId}'. Current clientAuthUid: '${clientAuthUid || 'NULL'}'`, "color: teal;");

  if (!trimmedUserId || !IS_UID_REGEX_SERVICE.test(trimmedUserId)) {
    // console.warn(`%c[connectionService] getUserProfileBasic: Attempted to fetch profile with invalid or empty userId: '${trimmedUserId}'. Returning generated name.`, "color: orange;");
    return { userId: trimmedUserId, displayName: generateAnonymousName(trimmedUserId || "unknown_user") };
  }

  try {
    const userDocRef = doc(usersCollectionRef, trimmedUserId);
    const userSnap = await getDoc(userDocRef);

    if (userSnap.exists()) {
      const userData = userSnap.data();
      const profile: UserProfileBasic = {
        userId: trimmedUserId,
        displayName: userData.displayName || userData.companyName || generateAnonymousName(trimmedUserId),
        avatarUrl: userData.avatarUrl || userData.photoURL || undefined,
      };
      // console.log(`%c[connectionService] getUserProfileBasic: Profile FOUND for '${trimmedUserId}':`, "color: green;", profile);
      return profile;
    }
    // console.warn(`%c[connectionService] getUserProfileBasic: Profile document NOT FOUND for userId: '${trimmedUserId}'. Using generated name.`, "color: orange;");
    return { userId: trimmedUserId, displayName: generateAnonymousName(trimmedUserId) };
  } catch (error: any) {
    console.error(`%c[connectionService] getUserProfileBasic: Error fetching profile for '${trimmedUserId}':`, "color: red;", error);
    if (error.code === 'permission-denied') {
      // console.error(`%c  PERMISSION DENIED specifically for reading 'users/${trimmedUserId}'. Ensure rules allow reads for authenticated users. Current client auth state was: '${clientAuthUid || 'NULL'}'`, "color: red; font-weight: bold;");
    }
    return { userId: trimmedUserId, displayName: generateAnonymousName(trimmedUserId) };
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
        const requesterProfile = await getUserProfileBasic(data.requesterId);
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
      const otherUserProfile = await getUserProfileBasic(otherUserId);
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
      throw new Error("Firestore query requires an index for connections. Please create it in the Firebase console.");
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
  const dataToWrite: { [key: string]: any } = {
    uid: userData.uid,
    lastLoginAt: serverTimestamp(),
  };

  if (userData.email) dataToWrite.email = userData.email;
  if (userData.photoURL) dataToWrite.avatarUrl = userData.photoURL;
  if (userData.companyName) dataToWrite.companyName = userData.companyName;
  if (userData.industry) dataToWrite.industry = userData.industry; // Add industry

  try {
    const docSnap = await getDoc(userDocRef);
    if (!docSnap.exists()) {
      console.log(`%c[connectionService] initializeUserProfile: Creating new profile for UID ${userData.uid}.`, "color: green;");
      dataToWrite.createdAt = serverTimestamp();
      
      // Determine displayName for new profile
      if (userData.displayName && userData.displayName.trim() !== '') {
        dataToWrite.displayName = userData.displayName;
         console.log(`%c  Using displayName from userData (e.g., Google): '${userData.displayName}'`, "color: green;");
      } else if (userData.companyName && userData.companyName.trim() !== '') {
        dataToWrite.displayName = userData.companyName;
         console.log(`%c  Using companyName from userData: '${userData.companyName}'`, "color: green;");
      } else {
        dataToWrite.displayName = generateAnonymousName(userData.uid);
         console.log(`%c  Generated anonymous name: '${dataToWrite.displayName}'`, "color: green;");
      }
      
      console.log(`%c[connectionService] Data to write (CREATE) for UID ${userData.uid}:`, "color: green;", dataToWrite);
      await setDoc(userDocRef, dataToWrite);
      console.log(`%c[connectionService] User profile CREATED successfully for UID ${userData.uid}.`, "color: green; font-weight:bold;");
    } else {
      console.log(`%c[connectionService] initializeUserProfile: Updating existing profile for UID ${userData.uid}.`, "color: blue;");
      const existingData = docSnap.data() as UserProfileData;
      
      // Determine displayName for update (prefer new, then existing, then generate if absolutely none)
      if (userData.displayName && userData.displayName.trim() !== '') {
        dataToWrite.displayName = userData.displayName;
         console.log(`%c  Updating displayName from userData (e.g., Google): '${userData.displayName}'`, "color: blue;");
      } else if (userData.companyName && userData.companyName.trim() !== '') {
        // If no new displayName from Google, but companyName from form might be "newer" or intended as primary
        dataToWrite.displayName = userData.companyName;
         console.log(`%c  Setting/Updating displayName from companyName: '${userData.companyName}'`, "color: blue;");
      } else if (!existingData.displayName && !existingData.companyName) {
        // Only generate if NO displayable name exists at all on existing profile
        dataToWrite.displayName = generateAnonymousName(userData.uid);
         console.log(`%c  Existing profile had no name, generated anonymous name: '${dataToWrite.displayName}'`, "color: blue;");
      } else {
         console.log(`%c  Keeping existing displayName: '${existingData.displayName || existingData.companyName}'`, "color: blue;");
         // If dataToWrite.displayName is still undefined here, it means an existing displayName should be preserved.
         // So we don't add it to dataToWrite, allowing merge to keep old value.
         if (dataToWrite.displayName === undefined && (existingData.displayName || existingData.companyName) ) {
            delete dataToWrite.displayName; // Don't overwrite existing displayable name with undefined
         }
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

    const querySnapshot = await getDocs(q);
    console.log(`%c[connectionService] getSuggestibleUsers: Firestore query executed. Found ${querySnapshot.docs.length} documents.`, "color: #BA55D3");

    const users = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data() as DocumentData;
      const profile: UserProfileBasic = {
        userId: docSnap.id,
        displayName: data.displayName || data.companyName || generateAnonymousName(docSnap.id),
        avatarUrl: data.avatarUrl || data.photoURL || undefined,
      };
      return profile;
    });
    console.log(`%c[connectionService] getSuggestibleUsers: Successfully mapped ${users.length} users.`, "color: green;", users.slice(0,5).map(u => u.displayName)); // Log first 5 displayNames
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
    return []; // Return empty on other errors
  }
};
