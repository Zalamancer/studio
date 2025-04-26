// src/services/messagingService.ts
"use server"; // Mark as server-only as it interacts with Firestore directly

import { db } from '@/lib/firebase/config';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  orderBy,
  limit,
  Timestamp,
  doc,
  getDoc,
  setDoc,
  arrayUnion,
  documentId,
  writeBatch,
} from 'firebase/firestore';
import type { Conversation, Message, NewMessageData } from '@/types/messaging';

const conversationsCollectionRef = collection(db, 'conversations');
// Messages are now a subcollection, so we don't need a top-level ref here

// Function to fetch conversations for a specific user
export const getConversationsForUser = async (userId: string): Promise<Conversation[]> => {
  if (!userId) {
    console.error("User ID is required to fetch conversations.");
    return [];
  }
  try {
    // Query conversations where the participants array contains the user's ID
    // Order by last message timestamp descending to get recent conversations first
    const q = query(
        conversationsCollectionRef,
        where('participants', 'array-contains', userId),
        orderBy('lastMessageTimestamp', 'desc'),
        limit(50) // Limit the number of conversations fetched
    );
    const querySnapshot = await getDocs(q);

    const conversations = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        participants: data.participants || [],
        lastMessage: data.lastMessage || null,
        // Ensure lastMessageTimestamp is handled correctly (might be null initially)
        lastMessageTimestamp: data.lastMessageTimestamp instanceof Timestamp
            ? data.lastMessageTimestamp
            : null,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt : Timestamp.now(), // Ensure createdAt exists
        // Add other relevant fields like participant details if stored directly
        // participantDetails: data.participantDetails || {}, // Example if you store names/avatars
      } as Conversation;
    });
    console.log(`Fetched ${conversations.length} conversations for user ${userId}`);
    return conversations;

  } catch (error: any) {
    console.error(`Error fetching conversations for user ${userId}:`, error);
    // Check for permission denied specifically
    if (error.code === 'permission-denied') {
      console.error("Firestore permission denied. Check your security rules for the 'conversations' collection. Ensure the rules allow the 'list' operation for queries filtering by 'participants' containing the authenticated user's ID.");
      throw new Error(`Failed to fetch conversations: Missing or insufficient permissions. Check Firestore Rules.`);
    }
    // Throw a generic error for other issues
    throw new Error(`Failed to fetch conversations: ${error.message}`);
  }
};


// Function to find an existing conversation or create a new one
// Returns the conversation ID
export const findOrCreateConversation = async (userId1: string, userId2: string): Promise<string> => {
  if (userId1 === userId2) {
    throw new Error("Cannot create a conversation with oneself.");
  }
  // Ensure participants are always in the same order to avoid duplicates
  const participants = [userId1, userId2].sort();
  const conversationId = participants.join('_'); // Create a predictable ID

  try {
    const conversationDocRef = doc(db, 'conversations', conversationId);
    const conversationSnap = await getDoc(conversationDocRef);

    if (conversationSnap.exists()) {
        console.log(`Conversation found: ${conversationId}`);
        return conversationId; // Conversation already exists
    } else {
        // Create a new conversation document using a batch write for atomicity
        const batch = writeBatch(db);
        batch.set(conversationDocRef, {
            participants: participants,
            createdAt: serverTimestamp(),
            lastMessage: null,
            lastMessageTimestamp: null, // Initialize as null
            // participantDetails: { [userId1]: { name: 'User 1 Name' }, [userId2]: { name: 'User 2 Name' } }, // Example
        });
        await batch.commit();
        console.log(`Conversation created: ${conversationId}`);
        return conversationId;
    }
  } catch (error: any) {
    console.error(`Error finding or creating conversation between ${userId1} and ${userId2}:`, error);
    if (error.code === 'permission-denied') {
        console.error("Firestore permission denied for creating/accessing conversation. Check security rules.");
        throw new Error(`Permission denied when trying to access or create conversation. Check Firestore Rules.`);
    }
    throw new Error(`Failed to find or create conversation: ${error.message}`);
  }
};


// Function to fetch messages for a specific conversation
export const getMessagesForConversation = async (conversationId: string): Promise<Message[]> => {
  try {
    const messagesSubcollectionRef = collection(db, 'conversations', conversationId, 'messages');
    const q = query(
      messagesSubcollectionRef,
      orderBy('timestamp', 'asc'), // Order messages chronologically
      limit(100) // Limit the number of messages fetched initially
    );
    const querySnapshot = await getDocs(q);
    const messages = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        conversationId: conversationId, // It's part of the path, but good to have
        senderId: data.senderId,
        text: data.text,
        timestamp: data.timestamp instanceof Timestamp ? data.timestamp : Timestamp.now(), // Ensure Timestamp
        read: data.read || false,
      } as Message;
    });
    return messages;
  } catch (error: any) {
    console.error(`Error fetching messages for conversation ${conversationId}:`, error);
     if (error.code === 'permission-denied') {
        console.error("Firestore permission denied for reading messages. Check security rules.");
         throw new Error(`Permission denied when trying to fetch messages. Check Firestore Rules for subcollections.`);
    }
    throw new Error(`Failed to fetch messages: ${error.message}`);
  }
};

// Function to send a new message (stores messages in a subcollection)
export const sendMessage = async (messageData: NewMessageData): Promise<string> => {
  if (!messageData.text || !messageData.senderId || !messageData.conversationId) {
    throw new Error("Message text, senderId, and conversationId are required.");
  }
  try {
    const conversationDocRef = doc(db, 'conversations', messageData.conversationId);
    const messagesSubcollectionRef = collection(conversationDocRef, 'messages');

    // Use a batch write to add the message and update the conversation metadata atomically
    const batch = writeBatch(db);

    // 1. Add the new message document to the subcollection
    const newMessageRef = doc(messagesSubcollectionRef); // Auto-generate ID
    batch.set(newMessageRef, {
        senderId: messageData.senderId,
        text: messageData.text,
        timestamp: serverTimestamp(), // Use server timestamp
        read: false,
    });

    // 2. Update the conversation's last message details
    batch.update(conversationDocRef, {
        lastMessage: messageData.text,
        lastMessageTimestamp: serverTimestamp(),
        // Optionally update unread counts here if needed
    });

    await batch.commit();

    return newMessageRef.id; // Return the ID of the newly created message

  } catch (error: any) {
    console.error('Error sending message:', error);
    if (error.code === 'permission-denied') {
        console.error("Firestore permission denied for sending message/updating conversation. Check security rules.");
        throw new Error(`Permission denied when trying to send message. Check Firestore Rules.`);
    }
    throw new Error(`Failed to send message: ${error.message}`);
  }
};

// --- Function to get user details (example placeholder) ---
// In a real app, fetch from a 'users' collection
export const getUserDetails = async (userId: string): Promise<{ name: string; avatar?: string }> => {
    // Placeholder implementation
    // You would query your 'users' collection here based on userId
    // For example:
    // const userDocRef = doc(db, 'users', userId);
    // const userSnap = await getDoc(userDocRef);
    // if (userSnap.exists()) {
    //     const userData = userSnap.data();
    //     return { name: userData.displayName || `User ${userId.substring(0,4)}`, avatar: userData.photoURL };
    // }
    return { name: `User ${userId.substring(0, 4)}...` }; // Fallback
};
