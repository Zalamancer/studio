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
import type { Conversation, Message, NewMessageData, SerializableMessage } from '@/types/messaging'; // Import SerializableMessage
import { auth } from '@/lib/firebase/config'; // Import auth if needed for debugging

const conversationsCollectionRef = collection(db, 'conversations');
const messagesSubcollectionRef = (conversationId: string) => collection(db, 'conversations', conversationId, 'messages');


// Function to fetch conversations for a specific user
export const getConversationsForUser = async (userId: string): Promise<Conversation[]> => {
  if (!userId) {
    console.error("User ID is required to fetch conversations.");
    return [];
  }
  console.log(`Fetching conversations for user: ${userId}`); // Log start

  try {
    // Query conversations where the participants array contains the user's ID
    const q = query(
        conversationsCollectionRef,
        where('participants', 'array-contains', userId),
        orderBy('lastMessageTimestamp', 'desc'), // Re-enable orderBy
        limit(50) // Limit the number of conversations fetched
    );
    console.log("Executing Firestore query for conversations...");
    const querySnapshot = await getDocs(q);
    console.log(`Query snapshot received. Found ${querySnapshot.docs.length} documents.`);

    const conversations = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      console.log(`Mapping document ${docSnap.id}:`, data); // Log raw data
      // Basic validation
      if (!data.participants || !Array.isArray(data.participants)) {
          console.warn(`Document ${docSnap.id} is missing or has invalid 'participants' field.`);
          return null; // Skip this document
      }
      // Ensure lastMessageTimestamp is handled correctly
      const lastTimestamp = data.lastMessageTimestamp instanceof Timestamp
            ? data.lastMessageTimestamp
            : null; // Default to null if missing or wrong type

       // Ensure createdAt exists
       const createdAtTimestamp = data.createdAt instanceof Timestamp ? data.createdAt : Timestamp.now();

      const conversation: Conversation = {
        id: docSnap.id,
        participants: data.participants,
        lastMessage: data.lastMessage || null,
        lastMessageTimestamp: lastTimestamp,
        createdAt: createdAtTimestamp,
      };
       console.log(`Mapped conversation ${conversation.id}:`, conversation);
      return conversation;
    }).filter((conv): conv is Conversation => conv !== null); // Filter out any nulls from mapping invalid docs


    console.log(`Successfully mapped ${conversations.length} valid conversations for user ${userId}`);
    return conversations;

  } catch (error: any) {
    console.error(`Error fetching conversations for user ${userId}:`, error);
    // Check for permission denied specifically
    if (error.code === 'permission-denied') {
      console.error("Firestore permission denied. Check your security rules for the 'conversations' collection. Ensure the rules allow the 'list' operation for queries filtering by 'participants' containing the authenticated user's ID.");
      throw new Error(`Failed to fetch conversations: Missing or insufficient permissions. Check Firestore Rules.`);
    }
     // Check for missing index error
     if (error.code === 'failed-precondition') {
         console.error("Firestore query requires an index. Check the Firebase console for index creation prompts or manually create the necessary composite index on 'participants' and 'lastMessageTimestamp'.");
         throw new Error("Firestore query requires an index. Please create it in the Firebase console.");
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

  console.log(`Attempting to find or create conversation: ID=${conversationId}, Participants=${participants.join(', ')}`); // Log attempt details

  try {
    const conversationDocRef = doc(db, 'conversations', conversationId);
    const conversationSnap = await getDoc(conversationDocRef); // Check if exists (needs 'get' permission)

    if (conversationSnap.exists()) {
        console.log(`Conversation found: ${conversationId}`);
        return conversationId; // Conversation already exists
    } else {
        console.log(`Conversation ${conversationId} not found. Attempting to create...`);
        // Data to be written for the new conversation
        const newConversationData = {
            participants: participants,
            createdAt: serverTimestamp(),
            lastMessage: null,
            lastMessageTimestamp: null, // Ensure this field exists on creation
        };
        console.log('Data for new conversation:', newConversationData); // Log data being written

        // Create a new conversation document using set with the specific ID
        await setDoc(conversationDocRef, newConversationData); // Use setDoc to create with specific ID

        console.log(`Conversation created successfully: ${conversationId}`);
        return conversationId;
    }
  } catch (error: any) {
    console.error(`Error finding or creating conversation between ${userId1} and ${userId2}:`, error);
    const currentUser = auth.currentUser;
    console.error('Current auth state:', currentUser ? `UID: ${currentUser.uid}` : 'No user authenticated');
    console.error('Participants being used:', participants);

    if (error.code === 'permission-denied') {
        console.error("Firestore permission denied for creating/accessing conversation. Check security rules for 'conversations' collection.");
        console.error("Ensure rule allows 'create' on '/conversations/{conversationId}' when authenticated, participants array is size 2, and contains the auth uid.");
        throw new Error(`Permission denied when trying to access or create conversation. Check Firestore Rules.`);
    }
    throw new Error(`Failed to find or create conversation: ${error.message}`);
  }
};


// Function to fetch messages for a specific conversation, converting Timestamps
export const getMessagesForConversation = async (conversationId: string): Promise<SerializableMessage[]> => {
  try {
    const messagesRef = messagesSubcollectionRef(conversationId);
    const q = query(
      messagesRef,
      orderBy('timestamp', 'asc'), // Order messages chronologically
      limit(100) // Limit the number of messages fetched initially
    );
    const querySnapshot = await getDocs(q);
    const messages = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      const timestamp = data.timestamp instanceof Timestamp ? data.timestamp.toMillis() : Date.now(); // Convert to milliseconds or use current time as fallback

      return {
        id: doc.id,
        conversationId: conversationId,
        senderId: data.senderId,
        text: data.text,
        timestamp: timestamp, // Use the converted millisecond timestamp
        read: data.read || false,
      } as SerializableMessage; // Assert the serializable type
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
    const messagesRef = messagesSubcollectionRef(messageData.conversationId);

    // Use a batch write to add the message and update the conversation metadata atomically
    const batch = writeBatch(db);

    // 1. Add the new message document to the subcollection
    const newMessageRef = doc(messagesRef); // Auto-generate ID
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
