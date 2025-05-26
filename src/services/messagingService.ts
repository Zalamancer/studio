// src/services/messagingService.ts
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
  writeBatch,
  type QueryConstraint,
  onSnapshot, // Added for real-time listeners
  Unsubscribe, // Type for the unsubscribe function
} from 'firebase/firestore';
import type { ClientConversation, SerializableMessage, NewMessageData, NewConversationData, Message } from '@/types/messaging';
import { fetchUserProfileBasic } from './connectionService';
import { createNotification } from './notificationService';
import { generateAnonymousName } from '@/lib/pseudonymUtils';

const conversationsCollectionRef = collection(db, 'conversations');
const messagesSubcollectionRef = (conversationId: string) => collection(db, 'conversations', conversationId, 'messages');

export const getConversationsForUser = async (userId: string): Promise<ClientConversation[]> => {
  if (!userId) {
    console.error("[messagingService] User ID is required to fetch conversations.");
    return [];
  }
  console.log(`%c[messagingService] Fetching conversations for user: ${userId}`, "color: dodgerblue;");

  try {
    const constraints: QueryConstraint[] = [
        where('participants', 'array-contains', userId),
        orderBy('lastMessageTimestamp', 'desc'),
        limit(50)
    ];

    const q = query(conversationsCollectionRef, ...constraints);
    const querySnapshot = await getDocs(q);
    const conversations = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      if (!data.participants || !Array.isArray(data.participants)) {
          console.warn(`%c[messagingService] Document ${docSnap.id} is missing or has invalid 'participants' field.`, "color: orange;");
          return null;
      }
      const lastTimestampMillis = data.lastMessageTimestamp instanceof Timestamp
            ? data.lastMessageTimestamp.toMillis()
            : null;
       const createdAtTimestampMillis = data.createdAt instanceof Timestamp
            ? data.createdAt.toMillis()
            : Date.now();

      return {
        id: docSnap.id,
        participants: data.participants,
        postId: data.postId || undefined,
        lastMessage: data.lastMessage || null,
        lastMessageTimestamp: lastTimestampMillis,
        createdAt: createdAtTimestampMillis,
      } as ClientConversation;
    }).filter((conv): conv is ClientConversation => conv !== null);
    console.log(`%c[messagingService] Successfully mapped ${conversations.length} client conversations for user ${userId}`, "color: green;");
    return conversations;

  } catch (error: any) {
    console.error(`%c[messagingService] Error fetching conversations for user ${userId}:`, "color: red;", error);
    if (error.code === 'permission-denied') {
      console.error("[messagingService] Firestore permission denied for 'conversations' collection. Check Firestore Rules. Current auth UID:", auth.currentUser?.uid);
      throw new Error(`Failed to fetch conversations: Missing or insufficient permissions. Check Firestore Rules.`);
    }
     if (error.code === 'failed-precondition' && error.message.includes('index')) {
         console.error("[messagingService] Firestore query requires an index for conversations. Please create the necessary composite index on 'participants' (array-contains) and 'lastMessageTimestamp' (desc) in the Firebase console.");
         throw new Error("Firestore query requires an index. Please create it in the Firebase console.");
     }
    throw new Error(`Failed to fetch conversations: ${error.message}`);
  }
};

export const findOrCreateConversation = async (userId1: string, userId2: string, postId?: string | null): Promise<string> => {
  const currentClientAuthUid = auth.currentUser?.uid;
  console.log(`%c[messagingService] findOrCreateConversation: Called. User1: '${userId1}', User2: '${userId2}', PostId: '${postId || 'N/A'}'. Client Auth UID: '${currentClientAuthUid || 'NULL'}'`, "color: #FF8C00;");

  if (userId1 === userId2) {
    console.error("[messagingService] Cannot create a conversation with oneself.");
    throw new Error("Cannot create a conversation with oneself.");
  }
  if (!userId1 || !userId2) {
    console.error("[messagingService] Both user IDs are required.");
    throw new Error("Both user IDs are required.");
  }

  const participants = [userId1, userId2].sort();
  const contextDescription = postId && postId !== 'general_connection' ? `post ${postId}` : 'general chat';

  try {
    const queryConstraints: QueryConstraint[] = [where('participants', '==', participants)];
    if (postId === 'general_connection' || !postId) {
      queryConstraints.push(where('postId', '==', null));
    } else {
      queryConstraints.push(where('postId', '==', postId));
    }
    queryConstraints.push(limit(1));

    const q = query(conversationsCollectionRef, ...queryConstraints);
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const existingConvId = querySnapshot.docs[0].id;
      console.log(`%c[messagingService] Found existing conversation for ${contextDescription} with ID: ${existingConvId}`, "color: green;");
      return existingConvId;
    }

    console.log(`%c[messagingService] No existing conversation found for ${contextDescription}. Creating new one.`, "color: orange;");
    const newConversationData: NewConversationData = {
        participants: participants,
        // If postId is 'general_connection' or falsy (null/undefined), set Firestore postId to null.
        // Otherwise, use the provided postId.
        postId: (postId && postId !== 'general_connection') ? postId : null,
        createdAt: serverTimestamp() as Timestamp,
        lastMessage: null,
        lastMessageTimestamp: null,
    };

    console.log(`%c[messagingService] Pre-Create Firestore Rule Check Values:
        - clientAuthUid:                               '${currentClientAuthUid || 'NULL'}'
        - newConversationData.participants.length === 2: ${newConversationData.participants.length === 2}
        - newConversationData.participants.includes(clientAuthUid): ${currentClientAuthUid ? newConversationData.participants.includes(currentClientAuthUid) : false}
        - Data to create in Firestore:`, "color: orange;", JSON.stringify(newConversationData, null, 2));

    const docRef = await addDoc(conversationsCollectionRef, newConversationData);
    console.log(`%c[messagingService] New conversation CREATED for ${contextDescription} with ID: ${docRef.id}`, "color: green;");
    return docRef.id;

  } catch (error: any) {
    console.error(`%c[messagingService] Error finding/creating conversation for ${contextDescription}:`, "color: red;", error);
    if (error.code === 'permission-denied') {
        console.error("[messagingService] Ensure rule allows 'create' on '/conversations/{conversationId}' when authenticated, participants array is size 2, and contains the auth uid.");
        console.error("[messagingService] Ensure rule allows 'list' (or 'query') on '/conversations' with appropriate where clauses (participants, postId).");
        throw new Error(`Permission denied when trying to access or create conversation. Check Firestore Rules.`);
    }
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
         console.error("[messagingService] Firestore query requires an index. Please create the necessary index in the Firebase console (e.g., composite on 'participants' and 'postId').");
         throw new Error("Firestore query requires an index for finding conversations. Please create it.");
    }
    throw new Error(`Failed to find or create conversation: ${error.message}`);
  }
};

export const getMessagesForConversation = (
  conversationId: string,
  onUpdate: (messages: SerializableMessage[]) => void,
  onError: (error: Error) => void
): Unsubscribe => {
  if (!conversationId) {
    onError(new Error("Conversation ID is required to fetch messages."));
    return () => {}; // Return a no-op unsubscribe function
  }

  const messagesRef = messagesSubcollectionRef(conversationId);
  const q = query(
    messagesRef,
    orderBy('timestamp', 'asc'),
    limit(100) // Consider pagination for very long conversations
  );

  const unsubscribe = onSnapshot(q,
    (querySnapshot) => {
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
          isBotMessage: data.isBotMessage || false,
          replyToMessageId: data.replyToMessageId || undefined,
          repliedToTextSnippet: data.repliedToTextSnippet || undefined,
        } as SerializableMessage;
      });
      onUpdate(messages);
    },
    (error) => {
      console.error(`[messagingService] Error in real-time messages listener for ${conversationId}:`, error);
      if (error.code === 'permission-denied') {
          onError(new Error(`Permission denied fetching messages. Check Firestore Rules.`));
      } else if (error.code === 'failed-precondition' && error.message.includes('index')) {
          onError(new Error("Firestore query for messages requires an index."));
      } else {
          onError(new Error(`Failed to fetch messages: ${error.message}`));
      }
    }
  );

  return unsubscribe;
};


export const sendMessage = async (messageData: NewMessageData): Promise<string> => {
  if (!messageData.text || !messageData.senderId || !messageData.conversationId) {
    throw new Error("Message text, senderId, and conversationId are required.");
  }
  try {
    const conversationDocRef = doc(db, 'conversations', messageData.conversationId);
    const messagesRef = messagesSubcollectionRef(messageData.conversationId);
    const batch = writeBatch(db);
    const newMessageRef = doc(messagesRef); // Auto-generate ID for the new message

    // Prepare the message payload for Firestore
    const messagePayload: Omit<Message, 'id' | 'timestamp' | 'isBotMessage'> & { isBotMessage?: boolean } = {
        conversationId: messageData.conversationId,
        senderId: messageData.senderId,
        text: messageData.text,
        read: false, // New messages are initially unread
        ...(messageData.replyToMessageId && { replyToMessageId: messageData.replyToMessageId }),
        ...(messageData.repliedToTextSnippet && { repliedToTextSnippet: messageData.repliedToTextSnippet }),
    };
    // Remove isBotMessage if it's undefined, otherwise Firestore might complain
    if (messageData.isBotMessage !== undefined) {
        messagePayload.isBotMessage = messageData.isBotMessage;
    }


    batch.set(newMessageRef, {
      ...messagePayload,
      timestamp: serverTimestamp(),
    });

    batch.update(conversationDocRef, {
        lastMessage: messageData.text,
        lastMessageTimestamp: serverTimestamp(),
    });

    await batch.commit();

    // After successfully sending message, create notifications for other participants
    const conversationSnap = await getDoc(conversationDocRef);
    if (conversationSnap.exists()) {
        const conversationData = conversationSnap.data() as ClientConversation; // Assuming ClientConversation has participants
        for (const participantId of conversationData.participants) {
            if (participantId !== messageData.senderId) { // Don't notify the sender
                await createNotification({
                    userId: participantId, // The recipient of the notification
                    type: 'new_message',
                    senderId: messageData.senderId, // The user who sent the message
                    conversationId: messageData.conversationId,
                    textSnippet: messageData.text.substring(0, 100), // Snippet of the message
                });
            }
        }
    }
    return newMessageRef.id;

  } catch (error: any) {
    console.error('[messagingService] Error sending message:', error);
    throw new Error(`Failed to send message: ${error.message}`);
  }
};

// Helper to fetch basic user details (name, avatar) for display
export const getUserDetails = async (userId: string): Promise<{ name: string; avatar?: string } | null> => {
    if (!userId) return null;
    const profile = await fetchUserProfileBasic(userId);
    if (!profile) return null;
    return {
        name: profile.displayName || generateAnonymousName(userId), // Fallback to generated name
        avatar: profile.avatarUrl,
    };
};

// Helper to fetch basic post details (question) for display in conversation list
export const getPostDetails = async (postId: string): Promise<{ question: string } | null> => {
    if (!postId || postId === 'general_connection') return null; // Handle general chats
    try {
        const postDocRef = doc(db, 'posts', postId);
        const postSnap = await getDoc(postDocRef);
        if (postSnap.exists()) {
            const postData = postSnap.data();
            return { question: postData.question || 'Post details unavailable' };
        }
        return null;
    } catch (error: any) {
        console.error(`[messagingService] Error fetching post details for ${postId}:`, error);
        return null; // Return null or a default object on error
    }
};
