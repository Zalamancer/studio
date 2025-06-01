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
  updateDoc, // For updating documents
  arrayUnion, // For adding to arrays
  arrayRemove, // For removing from arrays
} from 'firebase/firestore';
import type { ClientConversation, SerializableMessage, NewMessageData, NewConversationData, Message, Conversation } from '@/types/messaging';
import { fetchUserProfileBasic } from './connectionService';
import { createNotification } from './notificationService';
import { generateAnonymousName } from '@/lib/pseudonymUtils';

const conversationsCollectionRef = collection(db, 'conversations');
const messagesSubcollectionRef = (conversationId: string) => collection(db, 'conversations', conversationId, 'messages');

export const createGroupConversation = async (
  creatorId: string,
  groupName: string,
  initialMemberIds: string[],
  groupAvatarUrl?: string | null
): Promise<string> => {
  console.log(`%c[messagingService] createGroupConversation: Called. Creator: '${creatorId}', GroupName: '${groupName}', Members: [${initialMemberIds.join(', ')}]`, "color: #20B2AA;");
  if (!creatorId) throw new Error("Creator ID is required.");
  if (!groupName.trim()) throw new Error("Group name is required.");
  if (!initialMemberIds || initialMemberIds.length === 0) throw new Error("At least one initial member (besides creator) is required for a group.");

  const allParticipants = Array.from(new Set([creatorId, ...initialMemberIds])).sort();
  if (allParticipants.length < 2) {
      throw new Error("A group chat needs at least two unique participants (including the creator).");
  }

  const newConversationDoc: Omit<Conversation, 'id'> = {
    participants: allParticipants,
    type: 'group',
    groupName: groupName.trim(),
    groupAvatarUrl: groupAvatarUrl || null,
    ownerId: creatorId,
    adminIds: [creatorId], // Creator is the first admin
    postId: null,
    lastMessage: `Group created by ${generateAnonymousName(creatorId)}`,
    lastMessageTimestamp: serverTimestamp() as Timestamp,
    createdAt: serverTimestamp() as Timestamp,
  };

  try {
    const docRef = await addDoc(conversationsCollectionRef, newConversationDoc);
    console.log(`%c[messagingService] New GROUP conversation CREATED with ID: ${docRef.id}`, "color: green;");
    return docRef.id;
  } catch (error: any) {
    console.error(`%c[messagingService] Error creating GROUP conversation:`, "color: red;", error);
    if (error.code === 'permission-denied') {
        console.error("[messagingService] createGroupConversation: Firestore permission denied. Check Firestore Rules. Authenticated user:", auth.currentUser?.uid);
        throw new Error("Permission denied to create group. Check Firestore security rules.");
    }
    throw new Error(`Failed to create group conversation: ${error.message}`);
  }
};


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
      const data = docSnap.data() as Conversation;
      if (!data.participants || !Array.isArray(data.participants)) {
          console.warn(`%c  [messagingService] Document ${docSnap.id} is missing or has invalid 'participants' field.`, "color: orange;");
          return null;
      }
      const lastTimestampMillis = data.lastMessageTimestamp instanceof Timestamp
            ? data.lastMessageTimestamp.toMillis()
            : (typeof data.lastMessageTimestamp === 'number' ? data.lastMessageTimestamp : null);

       const createdAtTimestampMillis = data.createdAt instanceof Timestamp
            ? data.createdAt.toMillis()
            : (typeof data.createdAt === 'number' ? data.createdAt : Date.now());

      return {
        id: docSnap.id,
        participants: data.participants,
        type: data.type || 'direct',
        postId: data.postId || null,
        groupName: data.groupName || null,
        groupAvatarUrl: data.groupAvatarUrl || null,
        ownerId: data.ownerId || null,
        adminIds: data.adminIds || [],
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
  const contextDescription = postIdForQuery ? `direct chat related to post ${postIdForQuery}` : 'general direct chat';

  console.log(`%c[messagingService] findOrCreateConversation (DIRECT): Called. User1: '${userId1}', User2: '${userId2}', PostId for query: '${postIdForQuery === null ? "NULL (general)" : postIdForQuery}'. Client Auth UID: '${currentClientAuthUid || 'NULL'}'`, "color: #FF8C00;");


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
    const queryConstraints: QueryConstraint[] = [
        where('participants', '==', participants),
        where('type', '==', 'direct'),
        where('postId', '==', postIdForQuery),
        limit(1)
    ];


    const q = query(conversationsCollectionRef, ...queryConstraints);
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const existingConvId = querySnapshot.docs[0].id;
      console.log(`%c[messagingService] Found existing DIRECT conversation for ${contextDescription} with ID: ${existingConvId}`, "color: green;");
      return existingConvId;
    }

    console.log(`%c[messagingService] No existing DIRECT conversation found for ${contextDescription}. Creating new one.`, "color: orange;");
    const newConversationData: NewConversationData = {
        participants: participants,
        type: 'direct',
        postId: postIdForQuery,
        createdAt: serverTimestamp() as Timestamp,
        lastMessage: null,
        lastMessageTimestamp: serverTimestamp() as Timestamp,
        groupName: null,
        groupAvatarUrl: null,
        ownerId: null,
        adminIds: [],
    };

    console.log(`%c[messagingService] Pre-Create DIRECT Firestore Rule Check Values:
        - clientAuthUid:                               '${currentClientAuthUid || 'NULL'}'
        - newConversationData.participants.length === 2: ${newConversationData.participants.length === 2}
        - newConversationData.participants.includes(currentClientAuthUid): ${currentClientAuthUid ? newConversationData.participants.includes(currentClientAuthUid) : false}
        - Data to create in Firestore:`, "color: orange;", JSON.stringify(newConversationData, null, 2));


    const docRef = await addDoc(conversationsCollectionRef, newConversationData);
    console.log(`%c[messagingService] New DIRECT conversation CREATED for ${contextDescription} with ID: ${docRef.id}`, "color: green;");
    return docRef.id;

  } catch (error: any) {
    console.error(`%c[messagingService] Error finding/creating DIRECT conversation for ${contextDescription}:`, "color: red;", error);
    if (error.code === 'permission-denied') {
        console.error("[messagingService] Firestore permission denied for creating/accessing conversation. Check security rules.");
        console.error("Ensure rule allows 'create' on '/conversations/{conversationId}' when authenticated, participants array is size 2, contains the auth uid, and handles postId correctly.");
        console.error("Ensure rule allows 'list' (or 'query') on '/conversations' with appropriate where clauses (participants, postId).");
        throw new Error(`Permission denied when trying to access or create conversation. Ensure Firestore Rules allow 'create' on '/conversations/{conversationId}' when authenticated.`);
    }
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
         console.error("[messagingService] Firestore query requires an index. Please create the necessary index in the Firebase console (e.g., composite on 'participants', 'type', and 'postId').");
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
          isBotMessage: data.isBotMessage === true,
          replyToMessageId: data.replyToMessageId || undefined,
          repliedToTextSnippet: data.repliedToTextSnippet || undefined,
        };
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
        const conversationData = conversationSnap.data() as Conversation;
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
                        postQuestion: conversationData.type === 'group' ? conversationData.groupName : undefined, // Use group name for group chats
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

export const getUserDetails = async (userId: string): Promise<{ name: string; avatar?: string, isGroup?: boolean, participantCount?: number } | null> => {
    if (!userId) return null;
    const profile = await fetchUserProfileBasic(userId);
    if (!profile) {
        return { name: generateAnonymousName(userId) };
    }
    const displayName = profile.displayName || generateAnonymousName(userId);
    return {
        name: displayName,
        avatar: profile.avatarUrl,
    };
};

export const getGroupChatDetails = async (conversationId: string): Promise<{ name: string; avatar?: string, participantCount?: number } | null> => {
  if (!conversationId) return null;
  const convRef = doc(db, 'conversations', conversationId);
  const convSnap = await getDoc(convRef);
  if (convSnap.exists()) {
    const data = convSnap.data() as Conversation;
    if (data.type === 'group') {
      return {
        name: data.groupName || 'Group Chat',
        avatar: data.groupAvatarUrl || undefined,
        participantCount: data.participants.length
      };
    }
  }
  return null;
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

// --- Group Management Functions ---

export const updateGroupDetails = async (
  conversationId: string,
  currentUserId: string,
  updates: { groupName?: string; groupAvatarUrl?: string | null }
): Promise<void> => {
  if (!conversationId || !currentUserId) throw new Error("Conversation ID and User ID are required.");
  if (Object.keys(updates).length === 0) return;

  const convRef = doc(conversationsCollectionRef, conversationId);
  const conversationSnap = await getDoc(convRef);
  if (!conversationSnap.exists() || conversationSnap.data()?.type !== 'group') {
    throw new Error("Group conversation not found.");
  }
  const groupData = conversationSnap.data() as Conversation;
  if (!groupData.adminIds.includes(currentUserId)) {
    throw new Error("Only group admins can update group details.");
  }

  const payload: any = { updatedAt: serverTimestamp() };
  if (updates.groupName !== undefined && updates.groupName.trim() !== "") {
    payload.groupName = updates.groupName.trim();
  } else if (updates.groupName !== undefined && updates.groupName.trim() === "") {
    throw new Error("Group name cannot be empty.");
  }
  
  if (updates.groupAvatarUrl !== undefined) { // Allow setting to null to remove avatar
    payload.groupAvatarUrl = updates.groupAvatarUrl;
  }

  if (Object.keys(payload).length > 1) { // ensure there's more than just updatedAt
    await updateDoc(convRef, payload);
  }
};

export const addMembersToGroup = async (
  conversationId: string,
  currentUserId: string,
  memberIdsToAdd: string[]
): Promise<void> => {
  if (!conversationId || !currentUserId || !memberIdsToAdd || memberIdsToAdd.length === 0) {
    throw new Error("Required parameters missing or invalid.");
  }
  const convRef = doc(conversationsCollectionRef, conversationId);
  const conversationSnap = await getDoc(convRef);
  if (!conversationSnap.exists() || conversationSnap.data()?.type !== 'group') {
    throw new Error("Group conversation not found.");
  }
  const groupData = conversationSnap.data() as Conversation;
  if (!groupData.adminIds.includes(currentUserId)) {
    throw new Error("Only group admins can add members.");
  }

  const uniqueNewMembers = Array.from(new Set(memberIdsToAdd.filter(id => !groupData.participants.includes(id) && id !== currentUserId)));
  if (uniqueNewMembers.length === 0) {
    console.log("No new, valid members to add.");
    return;
  }

  await updateDoc(convRef, {
    participants: arrayUnion(...uniqueNewMembers),
    updatedAt: serverTimestamp()
  });
};

export const removeMemberFromGroup = async (
  conversationId: string,
  currentUserId: string,
  memberIdToRemove: string
): Promise<void> => {
  if (!conversationId || !currentUserId || !memberIdToRemove) {
    throw new Error("Required parameters missing.");
  }
  const convRef = doc(conversationsCollectionRef, conversationId);
  const conversationSnap = await getDoc(convRef);
  if (!conversationSnap.exists() || conversationSnap.data()?.type !== 'group') {
    throw new Error("Group conversation not found.");
  }
  const groupData = conversationSnap.data() as Conversation;
  if (!groupData.adminIds.includes(currentUserId)) {
    throw new Error("Only group admins can remove members.");
  }
  if (memberIdToRemove === groupData.ownerId) {
    throw new Error("Cannot remove the group owner using this function.");
  }
  if (!groupData.participants.includes(memberIdToRemove)) {
    console.log("User to remove is not a participant.");
    return; // User already not in group
  }
  if (groupData.participants.length <= 2) { // Check before removal
    throw new Error("Cannot remove member; group must have at least two participants after removal (or consider deleting the group).");
  }

  await updateDoc(convRef, {
    participants: arrayRemove(memberIdToRemove),
    adminIds: arrayRemove(memberIdToRemove), // Also remove from admins if they were one
    updatedAt: serverTimestamp()
  });
};

export const leaveGroup = async (conversationId: string, userId: string): Promise<void> => {
  if (!conversationId || !userId) throw new Error("Conversation ID and User ID are required.");
  const convRef = doc(conversationsCollectionRef, conversationId);
  const conversationSnap = await getDoc(convRef);
  if (!conversationSnap.exists() || conversationSnap.data()?.type !== 'group') {
    throw new Error("Group conversation not found.");
  }
  const groupData = conversationSnap.data() as Conversation;
  if (!groupData.participants.includes(userId)) {
    throw new Error("User is not a member of this group.");
  }
  
  // Prevent owner from leaving if they are the sole admin AND there are other participants
  if (userId === groupData.ownerId && groupData.adminIds.length === 1 && groupData.adminIds[0] === userId && groupData.participants.length > 1) {
    throw new Error("Owner cannot leave if they are the sole admin and other members exist. Promote another admin first or ensure other admins can manage the group.");
  }
  
  // If the user is the last participant, the group will become empty.
  // Consider if group should be deleted or marked inactive in such cases (outside scope of this function for now).
  if (groupData.participants.length === 1 && groupData.participants[0] === userId) {
      console.warn(`User ${userId} is the last participant leaving group ${conversationId}. The group will now be empty. Consider cleanup logic.`);
      // Potentially, delete the group document here or in a Cloud Function triggered by this state.
  }

  await updateDoc(convRef, {
    participants: arrayRemove(userId),
    adminIds: arrayRemove(userId), // Also remove from admins if they were one
    updatedAt: serverTimestamp()
  });
};

export const promoteToAdmin = async (
  conversationId: string,
  currentUserId: string, // User performing the action
  memberIdToPromote: string
): Promise<void> => {
  if (!conversationId || !currentUserId || !memberIdToPromote) throw new Error("Required parameters missing.");
  const convRef = doc(conversationsCollectionRef, conversationId);
  const conversationSnap = await getDoc(convRef);
  if (!conversationSnap.exists() || conversationSnap.data()?.type !== 'group') throw new Error("Group conversation not found.");
  const groupData = conversationSnap.data() as Conversation;
  if (groupData.ownerId !== currentUserId) throw new Error("Only the group owner can promote admins.");
  if (!groupData.participants.includes(memberIdToPromote)) throw new Error("User to promote is not a member of this group.");
  if (groupData.adminIds.includes(memberIdToPromote)) return; // Already an admin

  await updateDoc(convRef, {
    adminIds: arrayUnion(memberIdToPromote),
    updatedAt: serverTimestamp()
  });
};

export const demoteAdmin = async (
  conversationId: string,
  currentUserId: string, // User performing the action
  adminIdToDemote: string
): Promise<void> => {
  if (!conversationId || !currentUserId || !adminIdToDemote) throw new Error("Required parameters missing.");
  const convRef = doc(conversationsCollectionRef, conversationId);
  const conversationSnap = await getDoc(convRef);
  if (!conversationSnap.exists() || conversationSnap.data()?.type !== 'group') throw new Error("Group conversation not found.");
  const groupData = conversationSnap.data() as Conversation;
  if (groupData.ownerId !== currentUserId) throw new Error("Only the group owner can demote admins.");
  if (adminIdToDemote === groupData.ownerId) throw new Error("The group owner cannot be demoted from admin status.");
  if (!groupData.adminIds.includes(adminIdToDemote)) return; // Not an admin, nothing to demote

  await updateDoc(convRef, {
    adminIds: arrayRemove(adminIdToDemote),
    updatedAt: serverTimestamp()
  });
};
