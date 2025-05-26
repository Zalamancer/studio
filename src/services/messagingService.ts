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
  type Unsubscribe, // Type for the unsubscribe function
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
  const currentClientAuthUid = auth.currentUser?.uid;
  console.log(`%c[messagingService] getConversationsForUser: Fetching for userId: '${userId}'. Client Auth UID: '${currentClientAuthUid || 'NULL'}'`, "color: dodgerblue;");


  try {
    const constraints: QueryConstraint[] = [
        where('participants', 'array-contains', userId),
        orderBy('lastMessageTimestamp', 'desc'),
        limit(50)
    ];

    const q = query(conversationsCollectionRef, ...constraints);
    console.log("%c  [messagingService] Executing Firestore query for conversations...", "color: dodgerblue;");
    const querySnapshot = await getDocs(q);
    console.log(`%c  [messagingService] Query snapshot received. Found ${querySnapshot.docs.length} documents.`, "color: dodgerblue;");

    const conversations = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      if (!data.participants || !Array.isArray(data.participants)) {
          console.warn(`%c  [messagingService] Document ${docSnap.id} is missing or has invalid 'participants' field.`, "color: orange;");
          return null; // Skip this document
      }
      const lastTimestampMillis = data.lastMessageTimestamp instanceof Timestamp
            ? data.lastMessageTimestamp.toMillis()
            : (typeof data.lastMessageTimestamp === 'number' ? data.lastMessageTimestamp : Date.now()); // Fallback to now for sorting if null

       const createdAtTimestampMillis = data.createdAt instanceof Timestamp
            ? data.createdAt.toMillis()
            : (typeof data.createdAt === 'number' ? data.createdAt : Date.now());

      return {
        id: docSnap.id,
        participants: data.participants,
        postId: data.postId || null,
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
         throw new Error("Firestore query requires an index for conversations. Please create it in the Firebase console.");
     }
    throw new Error(`Failed to fetch conversations: ${error.message}`);
  }
};

export const findOrCreateConversation = async (userId1: string, userId2: string, postIdParam?: string | null): Promise<string> => {
  const currentClientAuthUid = auth.currentUser?.uid;
  const postIdForQuery = postIdParam === 'general_connection' || !postIdParam ? null : postIdParam;
  const contextDescription = postIdForQuery ? `post ${postIdForQuery}` : 'general chat';

  console.log(`%c[messagingService] findOrCreateConversation: Called. User1: '${userId1}', User2: '${userId2}', PostId for query: '${postIdForQuery === null ? "NULL (general_connection)" : postIdForQuery}'. Client Auth UID: '${currentClientAuthUid || 'NULL'}'`, "color: #FF8C00;");


  if (userId1 === userId2) {
    console.error("[messagingService] Cannot create a conversation with oneself.");
    throw new Error("Cannot create a conversation with oneself.");
  }
  if (!userId1 || !userId2) {
    console.error("[messagingService] Both user IDs are required.");
    throw new Error("Both user IDs are required.");
  }

  const participants = [userId1, userId2].sort();

  try {
    const queryConstraints: QueryConstraint[] = [where('participants', '==', participants)];
    queryConstraints.push(where('postId', '==', postIdForQuery));
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
        postId: postIdForQuery,
        createdAt: serverTimestamp() as Timestamp,
        lastMessage: null,
        lastMessageTimestamp: null,
    };

    console.log(`%c[messagingService] Pre-Create Firestore Rule Check Values:
        - clientAuthUid:                               '${currentClientAuthUid || 'NULL'}'
        - newConversationData.participants.length === 2: ${newConversationData.participants.length === 2}
        - newConversationData.participants.includes(currentClientAuthUid): ${currentClientAuthUid ? newConversationData.participants.includes(currentClientAuthUid) : false}
        - Data to create in Firestore:`, "color: orange;", JSON.stringify(newConversationData, null, 2));


    const docRef = await addDoc(conversationsCollectionRef, newConversationData);
    console.log(`%c[messagingService] New conversation CREATED for ${contextDescription} with ID: ${docRef.id}`, "color: green;");
    return docRef.id;

  } catch (error: any) {
    console.error(`%c[messagingService] Error finding/creating conversation for ${contextDescription}:`, "color: red;", error);
    if (error.code === 'permission-denied') {
        console.error("[messagingService] Firestore permission denied for creating/accessing conversation. Check security rules.");
        console.error("Ensure rule allows 'create' on '/conversations/{conversationId}' when authenticated, participants array is size 2, contains the auth uid, and handles postId correctly.");
        console.error("Ensure rule allows 'list' (or 'query') on '/conversations' with appropriate where clauses (participants, postId).");
        throw new Error(`Permission denied when trying to access or create conversation. Ensure Firestore Rules allow 'create' on '/conversations/{conversationId}' when authenticated.`);
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
    const err = new Error("Conversation ID is required to fetch messages.");
    console.error("[messagingService] getMessagesForConversation:", err.message);
    onError(err);
    return () => {};
  }
  console.log(`%c[Service] getMessagesForConversation: Setting up listener for conversationId: ${conversationId}`, "color: cyan;");

  const messagesRef = messagesSubcollectionRef(conversationId);
  const q = query(
    messagesRef,
    orderBy('timestamp', 'asc'),
    limit(100)
  );

  const unsubscribe = onSnapshot(q,
    (querySnapshot) => {
      console.log(`%c[Service] onSnapshot fired for ${conversationId}. Docs count: ${querySnapshot.docs.length}`, "color: cyan;");
      const messages = querySnapshot.docs.map((docSnap) => {
        const data = docSnap.data() as Message;
        console.log(`    [Service] Mapping doc ${docSnap.id} - Raw data: `, data); // Log raw data
        const timestampMillis = data.timestamp instanceof Timestamp
            ? data.timestamp.toMillis()
            : (typeof data.timestamp === 'number' ? data.timestamp : Date.now());

        const serializableMsg: SerializableMessage = {
          id: docSnap.id,
          conversationId: conversationId,
          senderId: data.senderId,
          text: data.text || "",
          timestamp: timestampMillis,
          read: data.read || false,
          isBotMessage: data.isBotMessage === true, // Explicitly check for true
          replyToMessageId: data.replyToMessageId || undefined,
          repliedToTextSnippet: data.repliedToTextSnippet || undefined,
        };
        console.log(`    [Service] Mapped message: isBotMessage = ${serializableMsg.isBotMessage}`, serializableMsg);
        return serializableMsg;
      });
      const botMessageCount = messages.filter(m => m.isBotMessage).length;
      console.log(`%c[Service] getMessagesForConversation - onUpdate: Calling with ${messages.length} total messages. BOT MESSAGES IN THIS BATCH: ${botMessageCount}`, "color: dodgerblue; font-weight: bold;");
      onUpdate(messages);
    },
    (error) => {
      console.error(`%c[Service] Error in real-time messages listener for ${conversationId}:`, "color: red;", error);
      if (error.code === 'permission-denied') {
          onError(new Error(`Permission denied fetching messages. Check Firestore Rules.`));
      } else if (error.code === 'failed-precondition' && error.message.includes('index')) {
          onError(new Error("Firestore query for messages requires an index on 'timestamp' (asc). Please create it in the Firebase console."));
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
    const newMessageRef = doc(messagesRef); 

    const messagePayload: Partial<Message> & { timestamp: any } = {
        conversationId: messageData.conversationId,
        senderId: messageData.senderId,
        text: messageData.text,
        read: false,
        isBotMessage: messageData.isBotMessage === true ? true : false, 
        replyToMessageId: messageData.replyToMessageId || null,
        repliedToTextSnippet: messageData.repliedToTextSnippet || null,
        timestamp: serverTimestamp(),
    };
    
    Object.keys(messagePayload).forEach(key => {
        if (messagePayload[key as keyof typeof messagePayload] === undefined) {
            messagePayload[key as keyof typeof messagePayload] = null;
        }
    });


    batch.set(newMessageRef, messagePayload);

    batch.update(conversationDocRef, {
        lastMessage: messageData.text,
        lastMessageSenderId: messageData.senderId,
        lastMessageTimestamp: serverTimestamp(),
    });

    await batch.commit();
    console.log(`%c[messagingService] Message sent by ${messageData.senderId} in conv ${messageData.conversationId}. New msg ID: ${newMessageRef.id}`, "color: green;");

    const conversationSnap = await getDoc(conversationDocRef);
    if (conversationSnap.exists()) {
        const conversationData = conversationSnap.data();
        const participantsArray = Array.isArray(conversationData?.participants) ? conversationData.participants : [];

        for (const participantId of participantsArray) {
            if (participantId !== messageData.senderId) { 
                try {
                    await createNotification({
                        userId: participantId,
                        type: 'new_message',
                        senderId: messageData.senderId,
                        conversationId: messageData.conversationId,
                        textSnippet: messageData.text.substring(0, 100),
                    });
                } catch (notificationError) {
                    console.error(`[messagingService] Failed to create notification for participant ${participantId} in conv ${messageData.conversationId}:`, notificationError);
                }
            }
        }
    }
    return newMessageRef.id;

  } catch (error: any) {
    console.error('[messagingService] Error sending message:', error);
    throw new Error(`Failed to send message: ${error.message}`);
  }
};

export const getUserDetails = async (userId: string): Promise<{ name: string; avatar?: string } | null> => {
    if (!userId) return null;
    console.log(`%c[messagingService] getUserDetails: Fetching details for userId: ${userId}`, "color: #DAA520;");
    const profile = await fetchUserProfileBasic(userId);
    if (!profile) {
        console.warn(`%c[messagingService] getUserDetails: No profile found for ${userId}, using generated name.`, "color: #DAA520;");
        return { name: generateAnonymousName(userId) };
    }
    const displayName = profile.displayName || generateAnonymousName(userId); 
    console.log(`%c[messagingService] getUserDetails: Profile found for ${userId}. DisplayName: '${displayName}', Avatar: ${!!profile.avatarUrl}`, "color: #DAA520;");
    return {
        name: displayName,
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
        return null;
    } catch (error: any) {
        console.error(`[messagingService] Error fetching post details for ${postId}:`, error);
        return null;
    }
};
