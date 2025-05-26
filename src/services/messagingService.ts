
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
            : (typeof data.lastMessageTimestamp === 'number' ? data.lastMessageTimestamp : null); // Handle already serialized

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
         throw new Error("Firestore query requires an index. Please create it in the Firebase console.");
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
    if (postIdForQuery === null) {
        queryConstraints.push(where('postId', '==', null));
    } else {
        queryConstraints.push(where('postId', '==', postIdForQuery));
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
    console.error("[messagingService] getMessagesForConversation: Conversation ID is required.");
    onError(new Error("Conversation ID is required to fetch messages."));
    return () => {};
  }
  console.log(`%c[messagingService] getMessagesForConversation: Setting up listener for conversationId: ${conversationId}`, "color: cyan;");

  const messagesRef = messagesSubcollectionRef(conversationId);
  const q = query(
    messagesRef,
    orderBy('timestamp', 'asc'),
    limit(100) // Fetch last 100 messages, adjust as needed
  );

  const unsubscribe = onSnapshot(q,
    (querySnapshot) => {
      console.log(`%c[messagingService] onSnapshot fired for ${conversationId}. Docs count: ${querySnapshot.docs.length}`, "color: cyan;");
      const messages = querySnapshot.docs.map((docSnap) => {
        const data = docSnap.data() as Message; // Assume Message type
        console.log(`    Mapping doc ${docSnap.id} - Text from DB: "${data.text}", isBotMessage from DB: ${data.isBotMessage}`);
        const timestampMillis = data.timestamp instanceof Timestamp
            ? data.timestamp.toMillis()
            : (typeof data.timestamp === 'number' ? data.timestamp : Date.now()); // Handle if already number

        return {
          id: docSnap.id,
          conversationId: conversationId,
          senderId: data.senderId,
          text: data.text || "", // Ensure text is always a string
          timestamp: timestampMillis,
          read: data.read || false,
          isBotMessage: data.isBotMessage === true, // Explicitly check for true
          replyToMessageId: data.replyToMessageId || undefined,
          repliedToTextSnippet: data.repliedToTextSnippet || undefined,
        } as SerializableMessage;
      });
      console.log(`%c[messagingService] onSnapshot for ${conversationId} - Calling onUpdate with ${messages.length} messages.`, "color: cyan; font-weight: bold;", messages);
      onUpdate(messages);
    },
    (error) => {
      console.error(`%c[messagingService] Error in real-time messages listener for ${conversationId}:`, "color: red;", error);
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
    const newMessageRef = doc(messagesRef); // Auto-generate ID

    const messagePayload: Partial<Message> = { // Use Partial to build up
        conversationId: messageData.conversationId,
        senderId: messageData.senderId,
        text: messageData.text,
        read: false, // New messages are unread
    };
    if (messageData.isBotMessage !== undefined) {
        messagePayload.isBotMessage = messageData.isBotMessage;
    }
    if (messageData.replyToMessageId) {
        messagePayload.replyToMessageId = messageData.replyToMessageId;
    }
    if (messageData.repliedToTextSnippet) {
        messagePayload.repliedToTextSnippet = messageData.repliedToTextSnippet;
    }

    batch.set(newMessageRef, {
      ...messagePayload,
      timestamp: serverTimestamp(), // Use Firestore server timestamp
    });

    batch.update(conversationDocRef, {
        lastMessage: messageData.text,
        lastMessageSenderId: messageData.senderId,
        lastMessageTimestamp: serverTimestamp(),
    });

    await batch.commit();
    console.log(`%c[messagingService] Message sent by ${messageData.senderId} in conv ${messageData.conversationId}. New msg ID: ${newMessageRef.id}`, "color: green;");

    // Create notifications for other participants
    const conversationSnap = await getDoc(conversationDocRef);
    if (conversationSnap.exists()) {
        const conversationData = conversationSnap.data() as ClientConversation; // Assuming ClientConversation structure
        for (const participantId of conversationData.participants) {
            if (participantId !== messageData.senderId) { // Don't notify the sender
                await createNotification({
                    userId: participantId, // The recipient of the notification
                    type: 'new_message',
                    senderId: messageData.senderId, // The user who sent the message
                    conversationId: messageData.conversationId,
                    textSnippet: messageData.text.substring(0, 100), // Snippet of the new message
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

// Helper to get basic user details for display
export const getUserDetails = async (userId: string): Promise<{ name: string; avatar?: string } | null> => {
    if (!userId) return null;
    console.log(`%c[messagingService] getUserDetails: Fetching details for userId: ${userId}`, "color: #DAA520;");
    const profile = await fetchUserProfileBasic(userId);
    if (!profile) {
        console.warn(`%c[messagingService] getUserDetails: No profile found for ${userId}, using generated name.`, "color: #DAA520;");
        return { name: generateAnonymousName(userId) }; // Fallback to generated name
    }
    // Prioritize companyName, then actualDisplayName (from Google/etc.), then mentionName
    const displayName = profile.companyName || profile.actualDisplayName || profile.mentionName || generateAnonymousName(userId);
    console.log(`%c[messagingService] getUserDetails: Profile found for ${userId}. DisplayName: '${displayName}', Avatar: ${!!profile.avatarUrl}`, "color: #DAA520;");
    return {
        name: displayName,
        avatar: profile.avatarUrl,
    };
};

// Helper to get post details (just the question for context)
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
