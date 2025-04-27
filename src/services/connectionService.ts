'use server';

import { db } from '@/lib/firebase/config';
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
  or, // Import 'or' for combined queries
  getDoc, // Import getDoc for fetching single user profile
} from 'firebase/firestore';
import type { MutualConnection, ConnectionStatus, Connection, ConnectionRequest, UserProfileBasic } from '@/types/connection';

const mutualsCollectionRef = collection(db, 'mutuals');
const usersCollectionRef = collection(db, 'users'); // Assuming a 'users' collection for basic profiles

// Helper to generate a consistent connection ID
const getConnectionDocId = (userId1: string, userId2: string): string => {
  return [userId1, userId2].sort().join('_');
};

// --- Send Connection Request ---
export const sendConnectionRequest = async (requesterId: string, recipientId: string): Promise<void> => {
  if (requesterId === recipientId) {
    throw new Error("Cannot send connection request to yourself.");
  }

  const connectionId = getConnectionDocId(requesterId, recipientId);
  const connectionDocRef = doc(mutualsCollectionRef, connectionId);

  console.log(`Sending connection request from ${requesterId} to ${recipientId}. Connection ID: ${connectionId}`);

  try {
    const connectionDocSnap = await getDoc(connectionDocRef); // Use getDoc for single doc check

    if (connectionDocSnap.exists()) {
        const existingStatus = connectionDocSnap.data().status;
        if (existingStatus === 'connected') {
            console.log("Connection already exists.");
            throw new Error("Already connected.");
        } else if (existingStatus === 'pending') {
            console.log("Connection request already pending.");
            throw new Error("Connection request already pending.");
        }
      // Handle other statuses if needed (e.g., blocked)
    }

    // Ensure userIds are sorted before storing
    const sortedUserIds = [requesterId, recipientId].sort();

    const newConnection: Omit<MutualConnection, 'id'> = {
      userIds: sortedUserIds,
      status: 'pending',
      requesterId: requesterId,
      requestedAt: serverTimestamp() as Timestamp,
      // connectedAt will be set on acceptance
    };

    await setDoc(connectionDocRef, newConnection);
    console.log(`Connection request sent successfully: ${connectionId}`);

  } catch (error: any) {
    console.error(`Error sending connection request (${connectionId}):`, error);
    if (error.code === 'permission-denied') {
      throw new Error('Permission denied. Check Firestore rules for creating mutuals documents.');
    }
    throw new Error(`Failed to send connection request: ${error.message}`);
  }
};

// --- Accept Connection Request ---
export const acceptConnectionRequest = async (connectionId: string, acceptorId: string): Promise<void> => {
  const connectionDocRef = doc(mutualsCollectionRef, connectionId);

  console.log(`Accepting connection request: ${connectionId} by user ${acceptorId}`);

  try {
    const connectionDocSnap = await getDoc(connectionDocRef); // Use getDoc

    if (!connectionDocSnap.exists()) {
      throw new Error("Connection request not found.");
    }

    const connectionData = connectionDocSnap.data() as MutualConnection;

    // Ensure the acceptor is the recipient, not the original requester
    if (connectionData.requesterId === acceptorId) {
      throw new Error("Cannot accept your own connection request.");
    }
    // Ensure the acceptor is part of the userIds array
     if (!connectionData.userIds.includes(acceptorId)) {
        throw new Error("Acceptor is not part of this connection request.");
    }
    if (connectionData.status !== 'pending') {
      throw new Error("Connection request is not pending.");
    }

    await updateDoc(connectionDocRef, {
      status: 'connected',
      connectedAt: serverTimestamp(),
    });
    console.log(`Connection request accepted successfully: ${connectionId}`);

  } catch (error: any) {
    console.error(`Error accepting connection request (${connectionId}):`, error);
    if (error.code === 'permission-denied') {
      throw new Error('Permission denied. Check Firestore rules for updating mutuals documents.');
    }
    throw new Error(`Failed to accept connection request: ${error.message}`);
  }
};

// --- Reject/Cancel Connection Request ---
export const rejectOrCancelConnectionRequest = async (connectionId: string, userId: string): Promise<void> => {
  const connectionDocRef = doc(mutualsCollectionRef, connectionId);

  console.log(`Rejecting/Cancelling connection request: ${connectionId} by user ${userId}`);

  try {
    const connectionDocSnap = await getDoc(connectionDocRef); // Use getDoc

    if (!connectionDocSnap.exists()) {
      throw new Error("Connection request not found.");
    }
    const connectionData = connectionDocSnap.data() as MutualConnection;

    // Ensure the user is part of the connection
    if (!connectionData.userIds.includes(userId)) {
        throw new Error("User not part of this connection request.");
    }
    if (connectionData.status !== 'pending') {
        throw new Error("Cannot reject/cancel a non-pending request.");
    }

    await deleteDoc(connectionDocRef);
    console.log(`Connection request rejected/cancelled successfully: ${connectionId}`);

  } catch (error: any) {
    console.error(`Error rejecting/cancelling connection request (${connectionId}):`, error);
    if (error.code === 'permission-denied') {
      throw new Error('Permission denied. Check Firestore rules for deleting mutuals documents.');
    }
    throw new Error(`Failed to reject/cancel connection request: ${error.message}`);
  }
};

// --- Remove Connection ---
export const removeConnection = async (connectionId: string, userId: string): Promise<void> => {
    const connectionDocRef = doc(mutualsCollectionRef, connectionId);

    console.log(`Removing connection: ${connectionId} by user ${userId}`);

    try {
        const connectionDocSnap = await getDoc(connectionDocRef); // Use getDoc

        if (!connectionDocSnap.exists()) {
          throw new Error("Connection not found.");
        }
        const connectionData = connectionDocSnap.data() as MutualConnection;

        // Ensure the user is part of the connection
        if (!connectionData.userIds.includes(userId)) {
            throw new Error("User not part of this connection.");
        }
        if (connectionData.status !== 'connected') {
            throw new Error("Cannot remove a non-connected relationship.");
        }

        await deleteDoc(connectionDocRef);
        console.log(`Connection removed successfully: ${connectionId}`);

    } catch (error: any) {
      console.error(`Error removing connection (${connectionId}):`, error);
      if (error.code === 'permission-denied') {
        throw new Error('Permission denied. Check Firestore rules for deleting mutuals documents.');
      }
      throw new Error(`Failed to remove connection: ${error.message}`);
    }
};


// --- Get Connection Status Between Two Users ---
export const getConnectionStatus = async (userId1: string, userId2: string): Promise<ConnectionStatus | null> => {
  if (!userId1 || !userId2) return 'not_connected'; // Handle null/undefined IDs
  if (userId1 === userId2) return 'self'; // Cannot connect with self

  const connectionId = getConnectionDocId(userId1, userId2);
  const connectionDocRef = doc(mutualsCollectionRef, connectionId);

  try {
    const docSnap = await getDoc(connectionDocRef); // Use getDoc

    if (!docSnap.exists()) {
      return 'not_connected';
    }

    const data = docSnap.data() as MutualConnection;

    // Basic validation of the data
    if (!data || !data.status || !data.requesterId || !data.userIds) {
        console.warn(`Incomplete connection data found for ID: ${connectionId}`);
        return 'not_connected'; // Treat incomplete data as not connected
    }

    if (data.status === 'connected') {
      return 'connected';
    } else if (data.status === 'pending') {
      // Check who sent the request
      return data.requesterId === userId1 ? 'pending_sent' : 'pending_received';
    } else if (data.status === 'blocked') {
        return 'blocked'; // Add handling for blocked status if needed
    }

    return 'not_connected'; // Default fallback

  } catch (error: any) {
    console.error(`Error fetching connection status between ${userId1} and ${userId2}:`, error);
    // Don't throw, return null to indicate error fetching status
    return null;
  }
};


// --- Fetch Basic User Profile ---
// NOTE: Assumes you have a 'users' collection storing basic info
// Adjust the fields (e.g., 'companyName', 'avatarUrl') based on your actual user profile structure
const fetchUserProfileBasic = async (userId: string): Promise<UserProfileBasic | null> => {
    if (!userId) return null;
    console.log(`Fetching basic profile for userId: ${userId}`);
    try {
        const userDocRef = doc(db, 'users', userId); // Use specific collection name
        const userSnap = await getDoc(userDocRef);

        if (userSnap.exists()) {
            const userData = userSnap.data();
             // Adapt these field names based on your actual user profile structure
             const profile: UserProfileBasic = {
                userId: userId,
                displayName: userData.companyName || userData.displayName || `User ${userId.substring(0, 4)}...`,
                avatarUrl: userData.avatarUrl || userData.photoURL || undefined, // Check both fields
             };
             console.log(`Profile found for ${userId}:`, profile);
             return profile;
        }
        console.warn(`Basic profile document not found for userId: ${userId}`);
        // Return a fallback structure even if profile doc is missing
        return { userId: userId, displayName: `User ${userId.substring(0, 4)}...` };
    } catch (error: any) {
        console.error(`Error fetching basic profile for ${userId}:`, error);
        if (error.code === 'permission-denied') {
             console.error(`Permission denied fetching profile for ${userId}. Check rules for 'users' collection.`);
             // Optionally throw a specific error or return null
             // throw new Error(`Permission denied fetching profile for ${userId}`);
        }
        return null; // Return null on error to allow main function to continue
    }
};


// --- Get Pending Connection Requests Received by User ---
export const getPendingRequests = async (userId: string): Promise<ConnectionRequest[]> => {
  if (!userId) {
    console.warn("getPendingRequests called with invalid userId.");
    return [];
  }
  console.log(`Fetching pending requests for user ${userId}`);

  try {
    const q = query(
      mutualsCollectionRef,
      where('userIds', 'array-contains', userId),
      where('status', '==', 'pending'),
      orderBy('requestedAt', 'desc'),
      limit(50)
    );

    console.log("Executing Firestore query for pending requests...");
    const querySnapshot = await getDocs(q);
    console.log(`Query snapshot received. Found ${querySnapshot.docs.length} potential pending request documents.`);

    const requestsPromises = querySnapshot.docs
      .filter(doc => {
          const data = doc.data();
          // Explicitly filter where the current user is the recipient (not the requester)
          const isRecipient = data.requesterId !== userId && data.userIds.includes(userId);
           if (!isRecipient) {
               console.log(`Filtering out doc ${doc.id}: User ${userId} is the requester or not included.`);
           }
          return isRecipient;
      })
      .map(async (docSnap) => {
        const data = docSnap.data() as Omit<MutualConnection, 'id'>;
        console.log(`Processing pending request doc ${docSnap.id} from requester ${data.requesterId}`);

         // Validate timestamp
        const requestedAtMillis = data.requestedAt instanceof Timestamp
            ? data.requestedAt.toMillis()
            : null; // Use null for invalid/missing timestamp

         if (requestedAtMillis === null) {
             console.warn(`Invalid or missing requestedAt timestamp for doc ${docSnap.id}`);
             // Decide whether to skip or use a fallback. Skipping is safer.
             return null;
         }


        const requesterProfile = await fetchUserProfileBasic(data.requesterId); // Fetch requester's basic info
        if (!requesterProfile) {
             console.warn(`Could not fetch profile for requester ${data.requesterId} (doc ${docSnap.id}). Using fallback.`);
             // Decide if you want to show requests even without profile info
             // return null; // Option: skip if profile fetch fails
        }

        const requestItem: ConnectionRequest = {
          connectionId: docSnap.id,
          requesterId: data.requesterId,
          requesterDisplayName: requesterProfile?.displayName || `User ${data.requesterId.substring(0,4)}...`, // Use fallback if profile missing
          requesterAvatarUrl: requesterProfile?.avatarUrl,
          requestedAt: requestedAtMillis, // Use milliseconds
        };
        console.log(`Successfully mapped pending request:`, requestItem);
        return requestItem;
      });

    const requests = (await Promise.all(requestsPromises)).filter(req => req !== null) as ConnectionRequest[];
    console.log(`Successfully processed ${requests.length} pending requests for user ${userId}`);
    return requests;

  } catch (error: any) {
    console.error(`Error fetching pending requests for user ${userId}:`, error);
    if (error.code === 'permission-denied') {
        console.error("Firestore permission denied fetching pending requests. Check rules for 'mutuals' collection.");
        throw new Error('Permission denied fetching pending requests. Check Firestore rules.');
    }
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
        console.error("Firestore query for pending requests requires an index. Create a composite index on 'userIds' (array-contains), 'status' (==), and 'requestedAt' (desc) in the Firebase console for the 'mutuals' collection.");
        throw new Error("Firestore query requires an index for pending requests. Please create it in the Firebase console.");
    }
    throw new Error(`Failed to fetch pending requests: ${error.message}`);
  }
};

// --- Get List of Connected Users (Mutuals) ---
export const getConnections = async (userId: string): Promise<Connection[]> => {
    if (!userId) {
        console.warn("getConnections called with invalid userId.");
        return [];
    }
    console.log(`Fetching connections for user ${userId}`);

    try {
        const q = query(
          mutualsCollectionRef,
          where('userIds', 'array-contains', userId),
          where('status', '==', 'connected'),
          orderBy('connectedAt', 'desc'), // Order by connection time
          limit(100) // Limit results
        );

        console.log("Executing Firestore query for connections...");
        const querySnapshot = await getDocs(q);
        console.log(`Query snapshot received. Found ${querySnapshot.docs.length} connection documents.`);

        const connectionsPromises = querySnapshot.docs.map(async (docSnap) => {
            const data = docSnap.data() as Omit<MutualConnection, 'id'>;
            const otherUserId = data.userIds.find(id => id !== userId);

            if (!otherUserId) {
                 console.warn(`Could not find other user ID in connection doc ${docSnap.id}. Data:`, data);
                 return null;
            }
            console.log(`Processing connection doc ${docSnap.id} with other user ${otherUserId}`);

            // Validate timestamp
            const connectedAtMillis = data.connectedAt instanceof Timestamp
                ? data.connectedAt.toMillis()
                : null; // Use null for invalid/missing timestamp

             if (connectedAtMillis === null) {
                console.warn(`Invalid or missing connectedAt timestamp for doc ${docSnap.id}`);
                // Decide whether to skip or use a fallback. Skipping is safer.
                return null;
            }


            const otherUserProfile = await fetchUserProfileBasic(otherUserId);
            if (!otherUserProfile) {
                console.warn(`Could not fetch profile for other user ${otherUserId} (doc ${docSnap.id}). Using fallback.`);
                 // Decide if you want to show connections even without profile info
                // return null; // Option: skip if profile fetch fails
            }

            const connectionItem: Connection = {
                connectionId: docSnap.id,
                otherUserId: otherUserId,
                otherUserDisplayName: otherUserProfile?.displayName || `User ${otherUserId.substring(0,4)}...`, // Use fallback
                otherUserAvatarUrl: otherUserProfile?.avatarUrl,
                connectedAt: connectedAtMillis, // Use milliseconds
            };
            console.log(`Successfully mapped connection:`, connectionItem);
            return connectionItem;
        });

        const connections = (await Promise.all(connectionsPromises)).filter(conn => conn !== null) as Connection[];
        console.log(`Successfully processed ${connections.length} connections for user ${userId}`);
        return connections;

    } catch (error: any) {
      console.error(`Error fetching connections for user ${userId}:`, error);
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
