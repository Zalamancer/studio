// src/services/messagingService.ts
// Client-callable functions

import { db, auth } from '@/lib/firebase/config';
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
  QueryConstraint,
} from 'firebase/firestore';
import type { ClientConversation, SerializableMessage, NewMessageData, NewConversationData, Message } from '@/types/messaging';
import { fetchUserProfileBasic } from './connectionService'; // CORRECTED IMPORT

const conversationsCollectionRef = collection(db, 'conversations');
const messagesSubcollectionRef = (conversationId: string) => collection(db, 'conversations', conversationId, 'messages');


// Function to fetch conversations for a specific user, returning serializable data
export const getConversationsForUser = async (userId: string): Promise<ClientConversation[]> => {
  if (!userId) {
    console.error("[messagingService] User ID is required to fetch conversations.");
    return [];
  }
  console.log(`[messagingService] Fetching conversations for user: ${userId}`);

  try {
    const constraints: QueryConstraint[] = [
        where('participants', 'array-contains', userId),
    ];
    constraints.push(orderBy('lastMessageTimestamp', 'desc'));
    constraints.push(limit(50));

    const q = query(conversationsCollectionRef, ...constraints);

    console.log("[messagingService] Executing Firestore query for conversations...");
    const querySnapshot = await getDocs(q);
    console.log(`[messagingService] Query snapshot received. Found ${querySnapshot.docs.length} documents.`);

    const conversations = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data();

      if (!data.participants || !Array.isArray(data.participants)) {
          console.warn(`[messagingService] Document ${docSnap.id} is missing or has invalid 'participants' field.`);
          return null;
      }

      const lastTimestampMillis = data.lastMessageTimestamp instanceof Timestamp
            ? data.lastMessageTimestamp.toMillis()
            : null;

       const createdAtTimestampMillis = data.createdAt instanceof Timestamp
            ? data.createdAt.toMillis()
            : Date.now(); 

      const clientConversation: ClientConversation = {
        id: docSnap.id,
        participants: data.participants,
        postId: data.postId || undefined,
        lastMessage: data.lastMessage || null,
        lastMessageTimestamp: lastTimestampMillis,
        createdAt: createdAtTimestampMillis,
      };
      return clientConversation;
    }).filter((conv): conv is ClientConversation => conv !== null);


    console.log(`[messagingService] Successfully mapped ${conversations.length} valid client conversations for user ${userId}`);
    return conversations;

  } catch (error: any) {
    console.error(`[messagingService] Error fetching conversations for user ${userId}:`, error);
    if (error.code === 'permission-denied') {
      console.error("[messagingService] Firestore permission denied. Check your security rules for the 'conversations' collection. Ensure the rules allow the 'list' operation for queries filtering by 'participants' containing the authenticated user's ID.");
      throw new Error(`Failed to fetch conversations: Missing or insufficient permissions. Check Firestore Rules.`);
    }
     if (error.code === 'failed-precondition' && error.message.includes('index')) {
         console.error("[messagingService] Firestore query requires an index. Check the Firebase console for index creation prompts or manually create the necessary composite index on 'participants' (array-contains) and 'lastMessageTimestamp' (descending).");
         throw new Error("Firestore query requires an index for conversations. Please create it in the Firebase console.");
     }
    throw new Error(`Failed to fetch conversations: ${error.message}`);
  }
};


export const findOrCreateConversation = async (userId1: string, userId2: string, postId?: string | null): Promise<string> => {
  if (userId1 === userId2) {
    console.error("[messagingService] findOrCreateConversation: Attempted to create conversation with oneself.");
    throw new Error("Cannot create a conversation with oneself.");
  }
  if (!userId1 || !userId2) {
    console.error("[messagingService] findOrCreateConversation: userId1 or userId2 is missing.");
    throw new Error("Both user IDs are required to find or create a conversation.");
  }

  const participants = [userId1, userId2].sort();
  const contextDescription = postId ? `post ${postId}` : 'general chat';
  const clientAuthUid = auth.currentUser?.uid; // For logging

  console.log(`%c[messagingService] findOrCreateConversation: Attempting for ${contextDescription} between ${userId1} and ${userId2}. Sorted: [${participants.join(', ')}]. Client Auth: ${clientAuthUid || 'NULL'}`, "color: orange;");


  try {
    const queryConstraints: QueryConstraint[] = [
      where('participants', '==', participants),
    ];

    if (postId === 'general_connection' || !postId) {
      queryConstraints.push(where('postId', '==', null));
    } else {
      queryConstraints.push(where('postId', '==', postId));
    }

    queryConstraints.push(limit(1));

    const q = query(conversationsCollectionRef, ...queryConstraints);
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const existingConversationId = querySnapshot.docs[0].id;
      console.log(`%c[messagingService] Conversation FOUND for ${contextDescription}: ${existingConversationId}`, "color: green;");
      return existingConversationId;
    } else {
      console.log(`%c[messagingService] Conversation for ${contextDescription} NOT found. Attempting to CREATE...`, "color: orange;");
      const newConversationData: NewConversationData = {
        participants: participants,
        postId: postId === 'general_connection' ? null : postId || null,
        createdAt: serverTimestamp() as Timestamp,
        lastMessage: null,
        lastMessageTimestamp: null,
      };

      console.log(`%c[messagingService] Pre-Create Firestore Rule Check Values:`, "color: orange; font-weight: bold;");
      console.log(`  1. Client Authenticated (auth.currentUser?.uid):                  '${clientAuthUid || 'NULL'}'`);
      console.log(`  2. request.resource.data.participants.size() == 2:              ${newConversationData.participants.length === 2} (Actual size: ${newConversationData.participants.length})`);
      console.log(`  3. request.resource.data.participants.hasAll([request.auth.uid]): ${clientAuthUid ? newConversationData.participants.includes(clientAuthUid) : false} (Participants: [${newConversationData.participants.join(', ')}])`);
      console.log(`[messagingService] Data for new conversation before addDoc:`, newConversationData);


      const docRef = await addDoc(conversationsCollectionRef, newConversationData);

      console.log(`%c[messagingService] Conversation CREATED successfully for ${contextDescription}: ${docRef.id}`, "color: green; font-weight:bold;");
      return docRef.id;
    }
  } catch (error: any) {
    console.error(`[messagingService] Error finding or creating conversation for ${contextDescription} between ${userId1} and ${userId2}:`, error);
    const currentUserForErrorLog = auth.currentUser;
    console.error('  Current auth state at error:', currentUserForErrorLog ? `UID: ${currentUserForErrorLog.uid}` : 'No user authenticated');
    console.error('  Participants used in query/create:', participants);
    console.error('  PostID used:', postId);

    if (error.code === 'permission-denied') {
        console.error("[messagingService] Firestore permission denied for creating/accessing conversation. Check security rules.");
        console.error("Ensure rule allows 'create' on '/conversations/{conversationId}' when authenticated, participants array is size 2, contains the auth uid, and handles postId correctly.");
        console.error("Ensure rule allows 'list' (or 'query') on '/conversations' with appropriate where clauses (participants, postId).");
        throw new Error(`Permission denied when trying to access or create conversation. Ensure Firestore Rules allow 'create' on '/conversations/{conversationId}' when authenticated.`);
    }
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
         console.error("Firestore query requires an index. Please create the necessary index in the Firebase console (e.g., composite on 'participants' and 'postId').");
         throw new Error("Firestore query requires an index for conversations. Please create it.");
     }
    throw new Error(`Failed to find or create conversation: ${error.message}`);
  }
};


export const getMessagesForConversation = async (conversationId: string): Promise<SerializableMessage[]> => {
  if (!conversationId) return [];

  try {
    const messagesRef = messagesSubcollectionRef(conversationId);
    const q = query(
      messagesRef,
      orderBy('timestamp', 'asc'),
      limit(100) 
    );
    const querySnapshot = await getDocs(q);
    const messages = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data() as Message; 
      const timestampMillis = data.timestamp instanceof Timestamp ? data.timestamp.toMillis() : Date.now();

      return {
        id: docSnap.id,
        conversationId: conversationId,
        senderId: data.senderId,
        text: data.text,
        timestamp: timestampMillis,
        read: data.read || false,
        replyToMessageId: data.replyToMessageId || undefined,
        repliedToTextSnippet: data.repliedToTextSnippet || undefined,
      } as SerializableMessage;
    });
    return messages;
  } catch (error: any) {
    console.error(`[messagingService] Error fetching messages for conversation ${conversationId}:`, error);
     if (error.code === 'permission-denied') {
        console.error("[messagingService] Firestore permission denied for reading messages. Check security rules.");
         throw new Error(`Permission denied when trying to fetch messages. Check Firestore Rules for subcollections.`);
    }
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
        console.error("Firestore query for messages requires an index. Create an index on 'timestamp' (asc) in the 'messages' subcollection.");
        throw new Error("Firestore query requires an index for messages. Please create it.");
    }
    throw new Error(`Failed to fetch messages: ${error.message}`);
  }
};

export const sendMessage = async (messageData: NewMessageData): Promise<string> => {
  if (!messageData.text || !messageData.senderId || !messageData.conversationId) {
    throw new Error("Message text, senderId, and conversationId are required.");
  }
  try {
    const conversationDocRef = doc(db, 'conversations', messageData.conversationId);
    const messagesRef = messagesSubcollectionRef(messageData.conversationId);

    const batch = writeBatch(db);

    const newMessageRef = doc(messagesRef); 
    
    const messagePayload: Omit<Message, 'id' | 'timestamp'> = {
        conversationId: messageData.conversationId,
        senderId: messageData.senderId,
        text: messageData.text,
        read: false, 
        ...(messageData.replyToMessageId && { replyToMessageId: messageData.replyToMessageId }),
        ...(messageData.repliedToTextSnippet && { repliedToTextSnippet: messageData.repliedToTextSnippet }),
    };
    
    batch.set(newMessageRef, {
      ...messagePayload,
      timestamp: serverTimestamp(), 
    });

    batch.update(conversationDocRef, {
        lastMessage: messageData.text,
        lastMessageTimestamp: serverTimestamp(),
    });

    await batch.commit();
    return newMessageRef.id;

  } catch (error: any) {
    console.error('[messagingService] Error sending message:', error);
    if (error.code === 'permission-denied') {
        console.error("[messagingService] Firestore permission denied for sending message/updating conversation. Check security rules.");
        throw new Error(`Permission denied when trying to send message. Check Firestore Rules.`);
    }
    throw new Error(`Failed to send message: ${error.message}`);
  }
};

export const getUserDetails = async (userId: string): Promise<{ name: string; avatar?: string } | null> => {
    if (!userId) return null;
    const profile = await fetchUserProfileBasic(userId); // CORRECTED FUNCTION CALL
    if (!profile) return null;
    return {
        name: profile.displayName,
        avatar: profile.avatarUrl,
    };
};

export const getPostDetails = async (postId: string): Promise<{ question: string } | null> => {
    if (!postId || postId === 'general_connection') return null;
    try {
        const postDocRef = doc(db, 'posts', postId);
        const postSnap = await getDoc(postDocRef);
        if (postSnap.exists()) {
            const postData = postSnap.data();
            return { question: postData.question || 'Post details unavailable' };
        }
        console.warn(`[messagingService] Post details not found for postId: ${postId}`);
        return null;
    } catch (error: any) {
        console.error(`[messagingService] Error fetching post details for ${postId}:`, error);
         if (error.code === 'permission-denied') {
             console.error(`[messagingService] Permission denied fetching post ${postId}. Check rules.`);
         }
        return null;
    }
};
