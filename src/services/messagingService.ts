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
  QueryConstraint, // Import QueryConstraint
} from 'firebase/firestore';
import type { ClientConversation, SerializableMessage, NewMessageData, NewConversationData } from '@/types/messaging'; // Import ClientConversation
import { auth } from '@/lib/firebase/config'; // Import auth if needed for debugging
import { getUserProfileBasic } from './connectionService'; // For getting user details

const conversationsCollectionRef = collection(db, 'conversations');
const messagesSubcollectionRef = (conversationId: string) => collection(db, 'conversations', conversationId, 'messages');


// Function to fetch conversations for a specific user, returning serializable data
export const getConversationsForUser = async (userId: string): Promise<ClientConversation[]> => {
  if (!userId) {
    console.error("User ID is required to fetch conversations.");
    return [];
  }
  console.log(`Fetching conversations for user: ${userId}`); // Log start

  try {
    // Query conversations where the participants array contains the user's ID
    const constraints: QueryConstraint[] = [
        where('participants', 'array-contains', userId),
    ];
    // Only add orderBy if lastMessageTimestamp is intended to be indexed and sorted
    // If not sorting by this, remove it to avoid needing the index just for this
    constraints.push(orderBy('lastMessageTimestamp', 'desc'));
    constraints.push(limit(50)); // Limit the number of conversations fetched

    const q = query(conversationsCollectionRef, ...constraints);

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

      // Convert Timestamps to milliseconds for client-side use
      const lastTimestampMillis = data.lastMessageTimestamp instanceof Timestamp
            ? data.lastMessageTimestamp.toMillis()
            : null;

       const createdAtTimestampMillis = data.createdAt instanceof Timestamp
            ? data.createdAt.toMillis()
            : Date.now(); // Use current time as fallback

      // Create the client-safe conversation object
      const clientConversation: ClientConversation = {
        id: docSnap.id,
        participants: data.participants,
        postId: data.postId || undefined, // Include postId if it exists
        lastMessage: data.lastMessage || null,
        lastMessageTimestamp: lastTimestampMillis, // Use milliseconds
        createdAt: createdAtTimestampMillis, // Use milliseconds
      };
       console.log(`Mapped client conversation ${clientConversation.id}:`, clientConversation);
      return clientConversation;
    }).filter((conv): conv is ClientConversation => conv !== null); // Filter out any nulls


    console.log(`Successfully mapped ${conversations.length} valid client conversations for user ${userId}`);
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
// postId is now optional. If provided, it searches for a post-specific conversation.
// If postId is null or undefined, it searches for a general conversation between the users.
export const findOrCreateConversation = async (userId1: string, userId2: string, postId?: string | null): Promise<string> => {
  if (userId1 === userId2) {
    throw new Error("Cannot create a conversation with oneself.");
  }
  // Ensure participants are always in the same order for querying consistency
  const participants = [userId1, userId2].sort();
  const context = postId ? `post ${postId}` : 'general chat';

  console.log(`Attempting to find or create conversation for ${context} between ${userId1} and ${userId2}`);

  try {
    // Build the query constraints
    const queryConstraints: QueryConstraint[] = [
      where('participants', '==', participants), // Must have the same participants
    ];

    // Add postId constraint ONLY if postId is provided and not null/empty
    if (postId) {
      queryConstraints.push(where('postId', '==', postId));
    } else {
      // If no postId, explicitly check for conversations *without* a postId
      // or where postId is explicitly null/undefined.
      // Firestore doesn't have a direct "is null or undefined" query,
      // so we might need to adjust data modeling if this becomes complex.
      // A simple approach for now: Query for postId == null.
      // This assumes general chats have postId explicitly set to null or absent.
       queryConstraints.push(where('postId', '==', null)); // Look for general chats
    }

    queryConstraints.push(limit(1)); // Only need one match

    const q = query(conversationsCollectionRef, ...queryConstraints);
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      // Conversation already exists for this context (post-specific or general)
      const existingConversationId = querySnapshot.docs[0].id;
      console.log(`Conversation found for ${context}: ${existingConversationId}`);
      return existingConversationId;
    } else {
      // Conversation doesn't exist, create a new one
      console.log(`Conversation for ${context} not found. Attempting to create...`);
      const newConversationData: NewConversationData = {
        participants: participants,
        // Store postId ONLY if it's provided, otherwise store null (or omit)
        postId: postId || null,
        createdAt: serverTimestamp() as Timestamp,
        lastMessage: null,
        lastMessageTimestamp: null,
      };
      console.log('Data for new conversation:', newConversationData);

      const docRef = await addDoc(conversationsCollectionRef, newConversationData);

      console.log(`Conversation created successfully for ${context}: ${docRef.id}`);
      return docRef.id;
    }
  } catch (error: any) {
    console.error(`Error finding or creating conversation for ${context} between ${userId1} and ${userId2}:`, error);
    const currentUser = auth.currentUser;
    console.error('Current auth state:', currentUser ? `UID: ${currentUser.uid}` : 'No user authenticated');
    console.error('Participants being used:', participants);
    console.error('Post ID being used:', postId); // Log postId

    if (error.code === 'permission-denied') {
        console.error("Firestore permission denied for creating/accessing conversation. Check security rules.");
        console.error("Ensure rule allows 'create' on '/conversations/{conversationId}' when authenticated, participants array is size 2, contains the auth uid, and handles postId correctly.");
        console.error("Ensure rule allows 'list' (or 'query') on '/conversations' with appropriate where clauses (participants, postId).");
        throw new Error(`Permission denied when trying to access or create conversation. Ensure Firestore Rules allow 'create' on '/conversations/{conversationId}' when authenticated and include postId.`);
    }
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
         console.error("Firestore query requires an index. Please create the necessary index in the Firebase console (e.g., composite on 'participants' and 'postId').");
         throw new Error("Firestore query requires an index. Please create it in the Firebase console (check participants ==, postId ==).");
     }
    throw new Error(`Failed to find or create conversation: ${error.message}`);
  }
};


// Function to fetch messages for a specific conversation, converting Timestamps
export const getMessagesForConversation = async (conversationId: string): Promise<SerializableMessage[]> => {
  if (!conversationId) return []; // Add check for valid conversationId

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
      // Convert Timestamp to milliseconds for client-side use
      const timestampMillis = data.timestamp instanceof Timestamp ? data.timestamp.toMillis() : Date.now();

      return {
        id: doc.id,
        conversationId: conversationId,
        senderId: data.senderId,
        text: data.text,
        timestamp: timestampMillis, // Use milliseconds
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
        lastMessageTimestamp: serverTimestamp(), // Use server timestamp
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
    // Fetch using the existing service function
    const profile = await getUserProfileBasic(userId);
    return {
        name: profile?.displayName || `@${userId}`, // Use @ fallback
        avatar: profile?.avatarUrl,
    };
};

// --- Function to get post details (used for messaging context) ---
export const getPostDetails = async (postId: string): Promise<{ question: string } | null> => {
    if (!postId || postId === 'general_connection') return null; // Handle general connection case or invalid postId
    try {
        const postDocRef = doc(db, 'posts', postId);
        const postSnap = await getDoc(postDocRef);
        if (postSnap.exists()) {
            const postData = postSnap.data();
            // Return only the question for context, keep it minimal
            return { question: postData.question || 'Post details unavailable' };
        }
        console.warn(`Post details not found for postId: ${postId}`);
        return null;
    } catch (error: any) {
        console.error(`Error fetching post details for ${postId}:`, error);
         if (error.code === 'permission-denied') {
             console.error(`Permission denied fetching post ${postId}. Check rules.`);
         }
        return null; // Return null on error
    }
};