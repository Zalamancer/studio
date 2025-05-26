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
  console.log(`[messagingService] Fetching conversations for user: ${userId}`);

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
          console.warn(`[messagingService] Document ${docSnap.id} is missing or has invalid 'participants' field.`);
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
    return conversations;

  } catch (error: any) {
    console.error(`[messagingService] Error fetching conversations for user ${userId}:`, error);
    if (error.code === 'permission-denied') {
      console.error("[messagingService] Firestore permission denied for 'conversations' collection.");
      throw new Error(`Failed to fetch conversations: Missing or insufficient permissions.`);
    }
     if (error.code === 'failed-precondition' && error.message.includes('index')) {
         console.error("[messagingService] Firestore query requires an index for conversations.");
         throw new Error("Firestore query requires an index for conversations.");
     }
    throw new Error(`Failed to fetch conversations: ${error.message}`);
  }
};

export const findOrCreateConversation = async (userId1: string, userId2: string, postId?: string | null): Promise<string> => {
  if (userId1 === userId2) throw new Error("Cannot create a conversation with oneself.");
  if (!userId1 || !userId2) throw new Error("Both user IDs are required.");

  const participants = [userId1, userId2].sort();
  const contextDescription = postId ? `post ${postId}` : 'general chat';
  
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
      return querySnapshot.docs[0].id;
    }
    
    const newConversationData: NewConversationData = {
        participants: participants,
        postId: postId === 'general_connection' ? undefined : (postId || undefined),
        createdAt: serverTimestamp() as Timestamp,
        lastMessage: null,
        lastMessageTimestamp: null,
    };
    const docRef = await addDoc(conversationsCollectionRef, newConversationData);
    return docRef.id;

  } catch (error: any) {
    console.error(`[messagingService] Error finding/creating conversation for ${contextDescription}:`, error);
    throw new Error(`Failed to find or create conversation: ${error.message}`);
  }
};

// New real-time message listener
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

  console.log(`[messagingService] Setting up onSnapshot for conversationId: ${conversationId}`); 

  const unsubscribe = onSnapshot(q, 
    (querySnapshot) => {
      console.log("[messagingService] onSnapshot fired. Docs count:", querySnapshot.docs.length, "Has pending writes:", querySnapshot.metadata.hasPendingWrites);
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

  return unsubscribe; // Return the unsubscribe function provided by onSnapshot
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

    const messagePayload: Omit<Message, 'id' | 'timestamp' | 'isBotMessage'> & { isBotMessage?: boolean } = {
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

    const conversationSnap = await getDoc(conversationDocRef);
    if (conversationSnap.exists()) {
        const conversationData = conversationSnap.data() as ClientConversation;
        for (const participantId of conversationData.participants) {
            if (participantId !== messageData.senderId) {
                await createNotification({
                    userId: participantId,
                    type: 'new_message',
                    senderId: messageData.senderId,
                    conversationId: messageData.conversationId,
                    textSnippet: messageData.text.substring(0, 100),
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

export const getUserDetails = async (userId: string): Promise<{ name: string; avatar?: string } | null> => {
    if (!userId) return null;
    const profile = await fetchUserProfileBasic(userId);
    if (!profile) return null;
    return {
        name: profile.displayName || generateAnonymousName(userId),
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
