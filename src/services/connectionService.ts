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
    const connectionDoc = await getDocs(query(mutualsCollectionRef, where('__name__', '==', connectionId), limit(1)));

    if (!connectionDoc.empty) {
      const existingStatus = connectionDoc.docs[0].data().status;
      if (existingStatus === 'connected') {
        console.log("Connection already exists.");
        throw new Error("Already connected.");
      } else if (existingStatus === 'pending') {
        console.log("Connection request already pending.");
        throw new Error("Connection request already pending.");
      }
      // Handle other statuses if needed (e.g., blocked)
    }

    const newConnection: Omit<MutualConnection, 'id'> = {
      userIds: [requesterId, recipientId].sort(),
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
    const connectionDoc = await getDocs(query(mutualsCollectionRef, where('__name__', '==', connectionId), limit(1)));

    if (connectionDoc.empty) {
      throw new Error("Connection request not found.");
    }

    const connectionData = connectionDoc.docs[0].data() as MutualConnection;

    // Ensure the acceptor is the recipient, not the original requester
    if (connectionData.requesterId === acceptorId) {
      throw new Error("Cannot accept your own connection request.");
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
    const connectionDoc = await getDocs(query(mutualsCollectionRef, where('__name__', '==', connectionId), limit(1)));

    if (connectionDoc.empty) {
      throw new Error("Connection request not found.");
    }
    const connectionData = connectionDoc.docs[0].data() as MutualConnection;

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
        const connectionDoc = await getDocs(query(mutualsCollectionRef, where('__name__', '==', connectionId), limit(1)));

        if (connectionDoc.empty) {
          throw new Error("Connection not found.");
        }
        const connectionData = connectionDoc.docs[0].data() as MutualConnection;

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
  if (userId1 === userId2) return 'self'; // Cannot connect with self
  const connectionId = getConnectionDocId(userId1, userId2);
  const connectionDocRef = doc(mutualsCollectionRef, connectionId);

  try {
    const docSnap = await getDocs(query(mutualsCollectionRef, where('__name__', '==', connectionId), limit(1)));

    if (docSnap.empty) {
      return 'not_connected';
    }

    const data = docSnap.docs[0].data() as MutualConnection;
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
    try {
        // Example: Fetching from a 'users' collection
        // Replace 'users' and field names if your structure is different
        const userDocRef = doc(db, 'users', userId); // Adjust collection name if needed
        const userSnap = await getDocs(query(usersCollectionRef, where('__name__', '==', userId), limit(1)));

        if (!userSnap.empty) {
            const userData = userSnap.docs[0].data();
             // Adapt these field names based on your actual user profile structure
             return {
                userId: userId,
                // Fallback if name/companyName isn't stored directly
                displayName: userData.companyName || userData.displayName || `User ${userId.substring(0, 4)}...`,
                avatarUrl: userData.avatarUrl || undefined, // Use avatarUrl or photoURL
             };
        }
        console.warn(`Basic profile not found for userId: ${userId}`);
        return { userId: userId, displayName: `User ${userId.substring(0, 4)}...` }; // Fallback
    } catch (error: any) {
        console.error(`Error fetching basic profile for ${userId}:`, error);
        return null; // Return null on error
    }
};


// --- Get Pending Connection Requests Received by User ---
export const getPendingRequests = async (userId: string): Promise<ConnectionRequest[]> => {
  if (!userId) return [];

  try {
    const q = query(
      mutualsCollectionRef,
      where('userIds', 'array-contains', userId), // User is one of the participants
      where('status', '==', 'pending'), // Status must be pending
      // where('requesterId', '!=', userId), // The requester must NOT be the current user (implicit check below works too)
      orderBy('requestedAt', 'desc'),
      limit(50)
    );

    const querySnapshot = await getDocs(q);

    const requestsPromises = querySnapshot.docs
      .filter(doc => doc.data().requesterId !== userId) // Explicitly filter where the current user is the recipient
      .map(async (docSnap) => {
        const data = docSnap.data() as Omit<MutualConnection, 'id'>;
        const requesterProfile = await fetchUserProfileBasic(data.requesterId); // Fetch requester's basic info

        return {
          connectionId: docSnap.id,
          requesterId: data.requesterId,
          requesterDisplayName: requesterProfile?.displayName || 'Unknown User',
          requesterAvatarUrl: requesterProfile?.avatarUrl,
          requestedAt: (data.requestedAt instanceof Timestamp ? data.requestedAt.toMillis() : Date.now()),
        } as ConnectionRequest;
      });

    const requests = await Promise.all(requestsPromises);
    return requests.filter(req => req !== null) as ConnectionRequest[]; // Filter out potential nulls from profile fetch errors

  } catch (error: any) {
    console.error(`Error fetching pending requests for user ${userId}:`, error);
    if (error.code === 'permission-denied') {
        throw new Error('Permission denied fetching pending requests. Check Firestore rules.');
    }
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
        console.error("Firestore query requires an index. Create a composite index on 'userIds' (array-contains) and 'status' (==) and 'requestedAt' (desc) in the Firebase console for the 'mutuals' collection.");
        throw new Error("Firestore query requires an index for pending requests. Please create it in the Firebase console.");
    }
    throw new Error(`Failed to fetch pending requests: ${error.message}`);
  }
};

// --- Get List of Connected Users (Mutuals) ---
export const getConnections = async (userId: string): Promise<Connection[]> => {
    if (!userId) return [];

    try {
        const q = query(
          mutualsCollectionRef,
          where('userIds', 'array-contains', userId),
          where('status', '==', 'connected'),
          orderBy('connectedAt', 'desc'), // Order by connection time
          limit(100) // Limit results
        );

        const querySnapshot = await getDocs(q);

        const connectionsPromises = querySnapshot.docs.map(async (docSnap) => {
            const data = docSnap.data() as Omit<MutualConnection, 'id'>;
            const otherUserId = data.userIds.find(id => id !== userId);

            if (!otherUserId) return null; // Should not happen if data is correct

            const otherUserProfile = await fetchUserProfileBasic(otherUserId);

            return {
                connectionId: docSnap.id,
                otherUserId: otherUserId,
                otherUserDisplayName: otherUserProfile?.displayName || 'Unknown User',
                otherUserAvatarUrl: otherUserProfile?.avatarUrl,
                connectedAt: (data.connectedAt instanceof Timestamp ? data.connectedAt.toMillis() : Date.now()),
            } as Connection;
        });

        const connections = await Promise.all(connectionsPromises);
        return connections.filter(conn => conn !== null) as Connection[]; // Filter out potential nulls

    } catch (error: any) {
      console.error(`Error fetching connections for user ${userId}:`, error);
      if (error.code === 'permission-denied') {
          throw new Error('Permission denied fetching connections. Check Firestore rules.');
      }
      if (error.code === 'failed-precondition' && error.message.includes('index')) {
          console.error("Firestore query requires an index. Create a composite index on 'userIds' (array-contains), 'status' (==), and 'connectedAt' (desc) in the Firebase console for the 'mutuals' collection.");
          throw new Error("Firestore query requires an index for connections. Please create it in the Firebase console.");
      }
      throw new Error(`Failed to fetch connections: ${error.message}`);
    }
};
