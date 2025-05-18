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
  // or, // Not used, can be removed
  getDoc,
  collectionGroup, // For querying users collection
} from 'firebase/firestore';
import type { MutualConnection, ConnectionStatus, Connection, ConnectionRequest, UserProfileBasic, UserProfileData } from '@/types/connection';
// Removed: import { generateAnonymousName } from '@/lib/pseudonymUtils'; // Re-adding for direct use if needed for now

const mutualsCollectionRef = collection(db, 'mutuals');
const usersCollectionRef = collection(db, 'users');

// --- Pseudonym Generation (moved here temporarily if utils file is problematic) ---
// In a larger app, keep this in a dedicated utils file.
const ADJECTIVES = ["Agile", "Bright", "Calm", "Desert", "Eager", "Forest", "Giant", "Hidden", "Island", "Jade", "Keen", "Lunar", "Mystic", "Noble", "Ocean", "Prairie", "Quiet", "River", "Solar", "Terra", "Urban", "Vivid", "Wild", "Xeric", "Yellow", "Zenith"];
const NOUNS = ["Fox", "Wolf", "Bear", "Eagle", "Hawk", "Lion", "Tiger", "Puma", "Jaguar", "Shark", "Whale", "Badger", "Coyote", "Falcon", "Panther", "Stallion", "Comet", "Planet", "Nebula", "Quasar", "Cipher", "Matrix", "Vector", "Pixel", "Byte", "Glitch"];

const simpleHash = (str: string, max: number): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash) % max;
};

export const generateAnonymousName = (userId: string): string => {
  if (!userId) return "AnonUser";
  const adjIndex = simpleHash(userId, ADJECTIVES.length);
  // Offset noun hash slightly to avoid always picking same index for adj/noun if lists are same length
  const nounIndex = simpleHash(userId.split("").reverse().join(""), NOUNS.length);
  const numericSuffix = (simpleHash(userId.substring(0, 5), 900) + 100).toString(); // 3-digit number (100-999)
  return `${ADJECTIVES[adjIndex]}${NOUNS[nounIndex]}${numericSuffix}`;
};
// --- End Pseudonym Generation ---


// Helper to generate a consistent connection ID
const getConnectionDocId = (userId1: string, userId2: string): string => {
  return [userId1, userId2].sort().join('_');
};

// --- Send Connection Request ---
export const sendConnectionRequest = async (requesterId: string, recipientId: string): Promise<void> => {
  const clientAuthUid = auth.currentUser?.uid;

  console.log(`%c[connectionService] sendConnectionRequest - Called with:`, "color: blue; font-weight:bold;", { requesterId, recipientId, clientAuthUid });

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

  const connectionId = getConnectionDocId(requesterId, recipientId);
  const connectionDocRef = doc(mutualsCollectionRef, connectionId);

  const sortedUserIds = [requesterId, recipientId].sort();
  const newConnectionData: Omit<MutualConnection, 'id'> = {
    userIds: sortedUserIds,
    status: 'pending',
    requesterId: requesterId,
    requestedAt: serverTimestamp() as Timestamp,
  };

  console.log(`%c[connectionService] sendConnectionRequest - Rule Check Values:`, "color: green; font-weight:bold;", {
    '1. request.auth != null:': !!clientAuthUid,
    'DATA.requesterId': newConnectionData.requesterId,
    'request.auth.uid': clientAuthUid,
    '2. request.resource.data.requesterId == request.auth.uid:': newConnectionData.requesterId === clientAuthUid,
    'DATA.userIds': newConnectionData.userIds,
    '3. request.resource.data.userIds.hasAll([request.auth.uid]):': newConnectionData.userIds.includes(clientAuthUid)
  });

  if (!auth.currentUser) {
      const errorMsg = "User authentication lost immediately before Firestore write. Aborting.";
      console.error(`%c[connectionService] sendConnectionRequest - FATAL ERROR: ${errorMsg}`, "color: red; font-weight:bold;");
      throw new Error(errorMsg);
  }
  console.log(`%c[connectionService] Final auth check passed. Attempting to write with connectionId: ${connectionId}. Data:`, "color: darkorange;", newConnectionData);


  try {
    const connectionDocSnap = await getDoc(connectionDocRef);

    if (connectionDocSnap.exists()) {
      const existingStatus = connectionDocSnap.data().status;
      if (existingStatus === 'connected') {
        throw new Error("Already connected.");
      } else if (existingStatus === 'pending') {
        const existingRequester = connectionDocSnap.data().requesterId;
        if (existingRequester === requesterId) {
          throw new Error("Connection request already sent by you.");
        } else {
          throw new Error("This user already sent you a connection request. Please check your pending requests.");
        }
      }
    }

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
  if (!userId1 || !userId2) return 'not_connected';
  if (userId1 === userId2) return 'self';
  const connectionId = getConnectionDocId(userId1, userId2);
  const connectionDocRef = doc(mutualsCollectionRef, connectionId);
  try {
    const docSnap = await getDoc(connectionDocRef);
    if (!docSnap.exists()) return 'not_connected';
    const data = docSnap.data() as MutualConnection;
    if (!data || !data.status || !data.requesterId || !data.userIds) return 'not_connected';
    if (data.status === 'connected') return 'connected';
    if (data.status === 'pending') return data.requesterId === userId1 ? 'pending_sent' : 'pending_received';
    if (data.status === 'blocked') return 'blocked';
    return 'not_connected';
  } catch (error: any) {
    console.error(`[connectionService] Error fetching connection status between ${userId1} and ${userId2}:`, error);
    return null;
  }
};

// --- Fetch Basic User Profile ---
const fetchUserProfileBasic = async (userId: string): Promise<UserProfileBasic | null> => {
  if (!userId) return null;
  console.log(`[connectionService] fetchUserProfileBasic: Fetching basic profile for userId: ${userId}`);
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
      console.log(`[connectionService] fetchUserProfileBasic: Profile found for ${userId}:`, profile);
      return profile;
    }
    console.warn(`[connectionService] fetchUserProfileBasic: Profile document not found for userId: ${userId}. Using generated name.`);
    return { userId: userId, displayName: generateAnonymousName(userId) };
  } catch (error: any) {
    console.error(`[connectionService] fetchUserProfileBasic: Error fetching profile for ${userId}:`, error);
    return { userId: userId, displayName: generateAnonymousName(userId) }; // Fallback on error
  }
};

// --- Get Pending Connection Requests Received by User ---
export const getPendingRequests = async (userId: string): Promise<ConnectionRequest[]> => {
  console.log(`[connectionService] Fetching pending requests for user: ${userId}`);
  if (!userId) {
    console.warn("[connectionService] getPendingRequests called with invalid userId.");
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
        if (requestedAtMillis === null) return null;
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
      throw new Error("Firestore query requires an index for pending requests. Please create it in the Firebase console.");
    }
    throw new Error(`Failed to fetch pending requests: ${error.message}`);
  }
};

// --- Get List of Connected Users (Mutuals) ---
export const getConnections = async (userId: string): Promise<Connection[]> => {
  console.log(`[connectionService] Fetching connections for user: ${userId}`);
  if (!userId) {
    console.warn("[connectionService] getConnections called with invalid userId.");
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
      if (connectedAtMillis === null) return null;
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
  return fetchUserProfileBasic(userId);
};

// --- Initialize User Profile Document ---
export const initializeUserProfile = async (userData: UserProfileData): Promise<void> => {
  console.log(`%c[connectionService] initializeUserProfile: Called with userData:`, "color: orange", userData);
  if (!userData || !userData.uid) {
    console.error('%c[connectionService] initializeUserProfile: ERROR - UID is missing in userData. Aborting.', "color: red; font-weight:bold;");
    return;
  }

  const userDocRef = doc(usersCollectionRef, userData.uid);

  try {
    const docSnap = await getDoc(userDocRef);
    const dataToWrite: { [key: string]: any } = {
      uid: userData.uid,
      email: userData.email || null,
      lastLoginAt: serverTimestamp(),
    };

    let finalDisplayName = generateAnonymousName(userData.uid); // Start with generated name

    if (userData.displayName && userData.displayName.trim() !== '') {
      finalDisplayName = userData.displayName;
    } else if (userData.companyName && userData.companyName.trim() !== '') {
      finalDisplayName = userData.companyName;
    }
    dataToWrite.displayName = finalDisplayName;

    if (userData.photoURL) dataToWrite.avatarUrl = userData.photoURL;
    if (userData.companyName && userData.companyName.trim() !== '') dataToWrite.companyName = userData.companyName;
    if (userData.industry && userData.industry.trim() !== '') dataToWrite.industry = userData.industry;


    if (!docSnap.exists()) {
      console.log(`%c[connectionService] initializeUserProfile: Creating new profile for UID ${userData.uid}.`, "color: green;");
      dataToWrite.createdAt = serverTimestamp();
      console.log(`%c[connectionService] Data to write (CREATE) for UID ${userData.uid}:`, "color: green;", dataToWrite);
      await setDoc(userDocRef, dataToWrite);
      console.log(`%c[connectionService] User profile CREATED successfully for UID ${userData.uid}.`, "color: green; font-weight:bold;");
    } else {
      console.log(`%c[connectionService] initializeUserProfile: Updating existing profile for UID ${userData.uid}.`, "color: blue;");
      const existingData = docSnap.data();
      const updatePayload: { [key: string]: any } = { lastLoginAt: serverTimestamp() };

      // Only update displayName if new one is more specific or if existing one is a generated name
      if ( (userData.displayName && userData.displayName.trim() !== '') || (userData.companyName && userData.companyName.trim() !== '') ) {
         updatePayload.displayName = finalDisplayName;
      } else if (existingData.displayName) {
         updatePayload.displayName = existingData.displayName; // Keep existing if no new name provided
      } else {
         updatePayload.displayName = finalDisplayName; // Generate if none existed
      }

      if (userData.email) updatePayload.email = userData.email;
      if (userData.photoURL) updatePayload.avatarUrl = userData.photoURL;
      if (userData.companyName && userData.companyName.trim() !== '') updatePayload.companyName = userData.companyName;
      if (userData.industry && userData.industry.trim() !== '') updatePayload.industry = userData.industry;


      console.log(`%c[connectionService] Data to merge (UPDATE) for UID ${userData.uid}:`, "color: blue;", updatePayload);
      await setDoc(userDocRef, updatePayload, { merge: true });
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
  console.log(`[connectionService] getSuggestibleUsers called. Prefix: '${searchPrefix}', Limit: ${limitCount}`);
  try {
    let q;
    const trimmedPrefix = searchPrefix?.trim();

    if (trimmedPrefix) {
      q = query(
        usersCollectionRef,
        where('displayName', '>=', trimmedPrefix),
        where('displayName', '<=', trimmedPrefix + '\uf8ff'),
        orderBy('displayName'),
        limit(limitCount)
      );
    } else {
      q = query(usersCollectionRef, orderBy('displayName'), limit(limitCount));
    }

    const querySnapshot = await getDocs(q);
    const users = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        userId: docSnap.id,
        displayName: data.displayName || data.companyName || generateAnonymousName(docSnap.id),
        avatarUrl: data.avatarUrl || data.photoURL,
      } as UserProfileBasic;
    });
    console.log(`[connectionService] getSuggestibleUsers: Found ${users.length} users for prefix "${trimmedPrefix}".`);
    return users;
  } catch (error: any) {
    console.error('[connectionService] Error fetching suggestible users:', error);
    if (error.code === 'permission-denied') {
      throw new Error('Permission denied fetching users. Check Firestore rules for listing users.');
    }
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
      throw new Error('Query for suggestible users requires an index. Please create it in Firebase (e.g., on displayName).');
    }
    return [];
  }
};
