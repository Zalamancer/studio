
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
  FieldValue, // IMPORT FieldValue for arrayRemove and serverTimestamp
  DocumentSnapshot, // Added for DocumentSnapshot type
  QuerySnapshot,
} from 'firebase/firestore';
import type { ClientConversation, SerializableMessage, NewMessageData, Message, Conversation, NewConversationData } from '@/types/messaging';
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

  const ts = serverTimestamp();

  // Log the timestamp type and value
  console.log(`%c[messagingService] Server timestamp type:`, "color: #20B2AA;", {
    timestampType: typeof ts,
    timestampValue: ts,
    isFieldValue: ts instanceof FieldValue
  });

  const newConversationDoc: NewConversationData = { // Use NewConversationData type
    participants: allParticipants,
    type: 'group',
    groupName: groupName.trim(),
    groupAvatarUrl: groupAvatarUrl || null,
    ownerId: creatorId,
    adminIds: [creatorId],
    postId: null,
    lastMessage: `Group created by ${generateAnonymousName(creatorId)}`,
    lastMessageTimestamp: ts,
    createdAt: ts,
    updatedAt: ts  // Add updatedAt here
  };

  // Validate the document before sending
  const validationErrors = [];
  if (!Array.isArray(newConversationDoc.participants)) validationErrors.push('participants must be an array');
  if (newConversationDoc.type !== 'group') validationErrors.push('type must be "group"');
  if (!newConversationDoc.groupName || typeof newConversationDoc.groupName !== 'string') validationErrors.push('groupName must be a non-empty string');
  if (newConversationDoc.groupAvatarUrl !== null && typeof newConversationDoc.groupAvatarUrl !== 'string') validationErrors.push('groupAvatarUrl must be null or string');
  if (newConversationDoc.ownerId !== creatorId) validationErrors.push('ownerId must match creatorId');
  if (!Array.isArray(newConversationDoc.adminIds) || !newConversationDoc.adminIds.includes(creatorId)) validationErrors.push('adminIds must be array containing creatorId');
  if (newConversationDoc.postId !== null) validationErrors.push('postId must be null');
  if (typeof newConversationDoc.lastMessage !== 'string') validationErrors.push('lastMessage must be string');
  if (!(newConversationDoc.lastMessageTimestamp instanceof FieldValue)) validationErrors.push('lastMessageTimestamp must be FieldValue');
  if (!(newConversationDoc.createdAt instanceof FieldValue)) validationErrors.push('createdAt must be FieldValue');
  if (!(newConversationDoc.updatedAt instanceof FieldValue)) validationErrors.push('updatedAt must be FieldValue');

  if (validationErrors.length > 0) {
    console.error(`%c[messagingService] Validation errors:`, "color: red;", validationErrors);
    throw new Error(`Invalid conversation data: ${validationErrors.join(', ')}`);
  }

  // Add detailed logging for debugging security rules
  const actualFields = Object.keys(newConversationDoc).sort();
  const requiredFields = [
    'participants',
    'type',
    'createdAt',
    'lastMessage',
    'lastMessageTimestamp',
    'postId',
    'groupName',
    'groupAvatarUrl',
    'ownerId',
    'adminIds',
    'updatedAt'  // Add updatedAt to required fields
  ].sort();

  console.log(`%c[messagingService] Attempting to create group with data:`, "color: #20B2AA;", {
    authUid: auth.currentUser?.uid,
    creatorId,
    authMatchesCreator: auth.currentUser?.uid === creatorId,
    data: {
      participants: newConversationDoc.participants,
      type: newConversationDoc.type,
      groupName: newConversationDoc.groupName,
      groupAvatarUrl: newConversationDoc.groupAvatarUrl,
      ownerId: newConversationDoc.ownerId,
      adminIds: newConversationDoc.adminIds,
      postId: newConversationDoc.postId,
      lastMessage: newConversationDoc.lastMessage,
      lastMessageTimestamp: 'serverTimestamp()',
      createdAt: 'serverTimestamp()',
      updatedAt: 'serverTimestamp()'  // Add updatedAt to logged data
    },
    securityRulesCheck: {
      isAuthenticated: !!auth.currentUser,
      creatorInParticipants: allParticipants.includes(creatorId),
      hasEnoughParticipants: allParticipants.length >= 2,
      creatorIsOwner: newConversationDoc.ownerId === creatorId,
      creatorIsAdmin: newConversationDoc.adminIds.includes(creatorId),
      hasGroupName: !!newConversationDoc.groupName && newConversationDoc.groupName.length > 0,
      hasValidAvatarUrl: newConversationDoc.groupAvatarUrl === null || typeof newConversationDoc.groupAvatarUrl === 'string',
      postIdIsNull: newConversationDoc.postId === null,
      fieldValidation: {
        hasAllRequiredFields: requiredFields.every(field => field in newConversationDoc),
        hasNoExtraFields: actualFields.length === requiredFields.length,
        actualFields,
        requiredFields,
        missingFields: requiredFields.filter(field => !actualFields.includes(field)),
        extraFields: actualFields.filter(field => !requiredFields.includes(field))
      }
    }
  });

  // Double check the field names match exactly what the security rules expect
  if (actualFields.length !== requiredFields.length) {
    console.error(`%c[messagingService] Field count mismatch. Expected ${requiredFields.length}, got ${actualFields.length}`, "color: red;");
    console.error("Missing fields:", requiredFields.filter(field => !actualFields.includes(field)));
    console.error("Extra fields:", actualFields.filter(field => !requiredFields.includes(field)));
    throw new Error(`Invalid field count. Expected ${requiredFields.length}, got ${actualFields.length}`);
  }

  try {
    const docRef = await addDoc(conversationsCollectionRef, newConversationDoc);
    // Remove the separate update for updatedAt since it's now included in initial creation
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
        where('participants', 'array-contains', userId), // User is still in participants
        orderBy('lastMessageTimestamp', 'desc'),
        limit(50)
    ];

    const q = query(conversationsCollectionRef, ...constraints);
    console.log("%c  [messagingService] Executing Firestore query for conversations...", "color: dodgerblue;");
    const querySnapshot = await getDocs(q);
    console.log(`%c  [messagingService] Query snapshot received. Found ${querySnapshot.docs.length} documents.`, "color: dodgerblue;");

    const conversations = querySnapshot.docs
      .map((docSnap) => {
        const data = docSnap.data() as Conversation;
        if (!data.participants || !Array.isArray(data.participants)) {
            console.warn(`%c  [messagingService] Document ${docSnap.id} is missing or has invalid 'participants' field.`, "color: orange;");
            return null;
        }

        // Filter out conversations where the current user is in formerParticipants
        // This logic is to ensure "left" groups don't show up in the main list.
        // The security rule handles read access to messages for left groups.
        if (data.formerParticipants && data.formerParticipants[userId]) {
          console.log(`%c  [messagingService] User ${userId} is in formerParticipants for conv ${docSnap.id}. Filtering out from main list.`, "color: #DAA520;");
          return null;
        }

        const lastTimestampMillis = data.lastMessageTimestamp instanceof Timestamp
              ? data.lastMessageTimestamp.toMillis()
              : (typeof data.lastMessageTimestamp === 'number' ? data.lastMessageTimestamp : null);

        const createdAtTimestampMillis = data.createdAt instanceof Timestamp
              ? data.createdAt.toMillis()
              : (typeof data.createdAt === 'number' ? data.createdAt : Date.now());
              
        const updatedAtTimestampMillis = data.updatedAt instanceof Timestamp
              ? (data.updatedAt as Timestamp).toMillis()
              : (typeof data.updatedAt === 'number' ? data.updatedAt : null);
        
        const formerParticipantsMillis: { [userId: string]: number } = {};
        if (data.formerParticipants) {
          for (const key in data.formerParticipants) {
            const tsValue = data.formerParticipants[key];
            if (tsValue instanceof Timestamp) {
              formerParticipantsMillis[key] = tsValue.toMillis();
            }
          }
        }


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
          updatedAt: updatedAtTimestampMillis,
          formerParticipants: formerParticipantsMillis, // Add to client type
        } as ClientConversation;
      })
      .filter((conv): conv is ClientConversation => conv !== null);

    console.log(`%c[messagingService] Successfully mapped ${conversations.length} active client conversations for user ${userId}`, "color: green;");
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
  const ts = serverTimestamp();

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
    const newConversationData: NewConversationData = { // Use NewConversationData type
        participants: participants,
        type: 'direct',
        postId: postIdForQuery,
        createdAt: ts as FieldValue,
        updatedAt: ts as FieldValue,
        lastMessage: null,
        lastMessageTimestamp: ts as FieldValue,
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

  // First check if user has left the group
  const checkUserStatus = async () => {
    try {
      const convRef = doc(db, 'conversations', conversationId);
      const convSnap = await getDoc(convRef);
      if (convSnap.exists()) {
        const convData = convSnap.data() as Conversation;
        if (convData.type === 'group' && !convData.participants.includes(auth.currentUser?.uid || '')) {
          // User has left the group, silently return empty messages
          onUpdate([]);
          return true; // Indicate user has left
        }
      }
      return false; // User hasn't left
    } catch (error) {
      console.warn(`%c[Service] Error checking user status for ${conversationId}:`, "color: orange;", error);
      return false; // On error, proceed with normal listener
    }
  };

  // Check status before setting up listener
  checkUserStatus().then(hasLeft => {
    if (hasLeft) {
      return; // Don't set up listener if user has left
    }

    const messagesRef = messagesSubcollectionRef(conversationId);
    const q = query(
      messagesRef,
      orderBy('timestamp', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q,
      (querySnapshot: QuerySnapshot) => {
        console.log(`%c[Service] onSnapshot fired for ${conversationId}. Docs count: ${querySnapshot.docs.length}`, "color: cyan;");
        const messages = querySnapshot.docs.map((docSnap: DocumentSnapshot) => {
          const data = docSnap.data() as Message; // Original Firestore data

          // Validate essential fields before creating SerializableMessage
          if (!data || typeof data.senderId !== 'string' || typeof data.text !== 'string' || !(data.timestamp instanceof Timestamp)) {
            console.warn(`[Service] getMessagesForConversation: Malformed message document ${docSnap.id} in conv ${conversationId}. Skipping. Data:`, data);
            return null; // Skip this malformed document
          }

          const timestampMillis = data.timestamp.toMillis();

          const serializableMsg: SerializableMessage = {
            id: docSnap.id,
            conversationId: conversationId,
            senderId: data.senderId,
            text: data.text, // Already validated to be string
            timestamp: timestampMillis,
            read: data.read === true, // Ensure boolean
            isBotMessage: data.isBotMessage === true, // Ensure boolean
            replyToMessageId: data.replyToMessageId || undefined,
            repliedToTextSnippet: data.repliedToTextSnippet || undefined,
          };
          return serializableMsg;
        }).filter((msg): msg is SerializableMessage => msg !== null); // Filter out any nulls from malformed docs
        
        onUpdate(messages);
      },
      (error: Error & { code?: string }) => {
        // Only log non-permission-denied errors
        if (error.code !== 'permission-denied') {
          console.error(`%c[Service] Error in messages listener for ${conversationId}:`, "color: red;", error);
          onError(error);
        } else {
          // For permission denied, silently check if user has left
          checkUserStatus().then(userHasLeft => {
            if (!userHasLeft) {
              // If user hasn't left, then it's a real permission error
              console.error(`%c[Service] Permission denied for ${conversationId} but user hasn't left group:`, "color: red;", error);
              onError(error);
            }
            // If user has left, we already handled it in checkUserStatus by calling onUpdate([])
          });
        }
      }
    );
    // This return was missing, it should be the unsubscribe function from onSnapshot
    return unsubscribe; 
  });

  // Return a no-op unsubscribe function initially for the outer function
  // The actual unsubscribe will be returned by the promise resolution
  return () => {};
};


export const sendMessage = async (messageData: NewMessageData): Promise<string> => {
  if (!messageData.text || !messageData.senderId || !messageData.conversationId) {
    throw new Error("Message text, senderId, and conversationId are required.");
  }
  const dbInstance = db;
  const batch = writeBatch(dbInstance);
  const ts = serverTimestamp(); // Single server-generated timestamp

  const msgRef = doc(collection(dbInstance, 'conversations', messageData.conversationId, 'messages'));
  batch.set(msgRef, {
    senderId: messageData.senderId,
    text: messageData.text,
    timestamp: ts, // Use the single serverTimestamp instance
    isBotMessage: messageData.isBotMessage === true ? true : false,
    replyToMessageId: messageData.replyToMessageId || null,
    repliedToTextSnippet: messageData.repliedToTextSnippet || null,
    read: false,
    conversationId: messageData.conversationId,
  });

  const convRef = doc(dbInstance, 'conversations', messageData.conversationId);
  batch.update(convRef, {
    lastMessage: messageData.text,
    lastMessageSenderId: messageData.senderId,
    lastMessageTimestamp: ts, // Use the same serverTimestamp instance
    updatedAt: ts // Use the same serverTimestamp instance
  });

  try {
    await batch.commit();
    console.log(`%c[messagingService] Message sent by ${messageData.senderId} in conv ${messageData.conversationId}. New msg ID: ${msgRef.id}`, "color: green;");

    // Notification logic
    const conversationSnap = await getDoc(convRef);
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
                        postQuestion: conversationData.type === 'group' ? conversationData.groupName : undefined,
                    });
                } catch (notificationError) {
                    console.error(`[messagingService] Failed to create notification for participant ${participantId} in conv ${messageData.conversationId}:`, notificationError);
                }
            }
        }
    }
    return msgRef.id;
  } catch (error: any) {
    console.error('[messagingService] Error sending message (batch commit):', error);
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
  
  if (updates.groupAvatarUrl !== undefined) {
    payload.groupAvatarUrl = updates.groupAvatarUrl; 
  }

  if (Object.keys(payload).length > 1) { 
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
    return;
  }
  if (groupData.participants.length <= 2) { // Ensure at least one member remains after owner
    throw new Error("Cannot remove member; group must have at least the owner and one other participant, or consider deleting the group.");
  }

  await updateDoc(convRef, {
    participants: arrayRemove(memberIdToRemove),
    adminIds: arrayRemove(memberIdToRemove), 
    updatedAt: serverTimestamp()
  });
};

// Updated leaveGroup function as per user's provided snippet
export async function leaveGroup(
  conversationId: string,
  currentUserId: string
): Promise<void> {
  if (!conversationId || !currentUserId) {
    throw new Error("Conversation ID and User ID are required.");
  }

  // Validate authentication state
  const authUser = auth.currentUser;
  if (!authUser) {
    throw new Error("You must be authenticated to leave a group.");
  }
  if (authUser.uid !== currentUserId) {
    console.error("Authentication mismatch:", {
      providedUserId: currentUserId,
      authUserId: authUser.uid
    });
    throw new Error("The provided user ID does not match your authentication.");
  }

  const convRef = doc(db, 'conversations', conversationId);
  const conversationSnap = await getDoc(convRef);
  
  if (!conversationSnap.exists()) {
    throw new Error("Conversation not found.");
  }

  const conversationData = conversationSnap.data() as Conversation;
  
  if (conversationData.type !== 'group') {
    throw new Error("This is not a group conversation.");
  }

  if (!conversationData.participants.includes(currentUserId)) {
    throw new Error("You are not a member of this group.");
  }

  // Simple update to remove user from participants
  const updateData = {
    participants: arrayRemove(currentUserId),
    updatedAt: serverTimestamp()
  };

  try {
    await updateDoc(convRef, updateData);
    console.log(`%c[messagingService] User ${currentUserId} successfully left group ${conversationId}`, "color: green;");
  } catch (error: any) {
    console.error(`%c[messagingService] Error leaving group:`, "color: red;", error);
    throw new Error(`Failed to leave group: ${error.message}`);
  }
}


export const promoteToAdmin = async (
  conversationId: string,
  currentUserId: string,
  memberIdToPromote: string
): Promise<void> => {
  if (!conversationId || !currentUserId || !memberIdToPromote) throw new Error("Required parameters missing.");
  const convRef = doc(conversationsCollectionRef, conversationId);
  const conversationSnap = await getDoc(convRef);
  if (!conversationSnap.exists() || conversationSnap.data()?.type !== 'group') throw new Error("Group conversation not found.");
  const groupData = conversationSnap.data() as Conversation;
  if (groupData.ownerId !== currentUserId) throw new Error("Only the group owner can promote admins.");
  if (!groupData.participants.includes(memberIdToPromote)) throw new Error("User to promote is not a member of this group.");
  if (groupData.adminIds.includes(memberIdToPromote)) return; 

  await updateDoc(convRef, {
    adminIds: arrayUnion(memberIdToPromote),
    updatedAt: serverTimestamp()
  });
};

export const demoteAdmin = async (
  conversationId: string,
  currentUserId: string,
  adminIdToDemote: string
): Promise<void> => {
  if (!conversationId || !currentUserId || !adminIdToDemote) throw new Error("Required parameters missing.");
  const convRef = doc(conversationsCollectionRef, conversationId);
  const conversationSnap = await getDoc(convRef);
  if (!conversationSnap.exists() || conversationSnap.data()?.type !== 'group') throw new Error("Group conversation not found.");
  const groupData = conversationSnap.data() as Conversation;
  if (groupData.ownerId !== currentUserId) throw new Error("Only the group owner can demote admins.");
  if (adminIdToDemote === groupData.ownerId) throw new Error("The group owner cannot be demoted from admin status.");
  if (!groupData.adminIds.includes(adminIdToDemote)) return; 

  await updateDoc(convRef, {
    adminIds: arrayRemove(adminIdToDemote),
    updatedAt: serverTimestamp()
  });
};

export const transferGroupOwnership = async (
  conversationId: string,
  currentUserId: string,
  newOwnerId: string
): Promise<void> => {
  if (!conversationId || !currentUserId || !newOwnerId) {
    throw new Error("Required parameters missing.");
  }

  const convRef = doc(conversationsCollectionRef, conversationId);
  const conversationSnap = await getDoc(convRef);
  
  if (!conversationSnap.exists() || conversationSnap.data()?.type !== 'group') {
    throw new Error("Group conversation not found.");
  }

  const conversationData = conversationSnap.data() as Conversation;
  
  // Validate current user is owner
  if (conversationData.ownerId !== currentUserId) {
    throw new Error("Only the group owner can transfer ownership.");
  }

  // Validate new owner is a participant
  if (!conversationData.participants.includes(newOwnerId)) {
    throw new Error("New owner must be a group member.");
  }

  // Validate new owner is not the current owner
  if (newOwnerId === currentUserId) {
    throw new Error("Cannot transfer ownership to yourself.");
  }

  // Create new adminIds array that includes both current owner and new owner
  const newAdminIds = Array.from(new Set([...conversationData.adminIds, newOwnerId]));

  // Update the conversation document with explicit adminIds array
  try {
    await updateDoc(convRef, {
      ownerId: newOwnerId,
      adminIds: newAdminIds, // Set explicit array instead of using arrayUnion
      updatedAt: serverTimestamp()
    });
    console.log(`%c[messagingService] Group ownership transferred from ${currentUserId} to ${newOwnerId} in group ${conversationId}`, "color: green;");
  } catch (error: any) {
    console.error(`%c[messagingService] Error transferring group ownership:`, "color: red;", error);
    if (error.code === 'permission-denied') {
      console.error("Security rules validation failed. Check that:", {
        isOwner: conversationData.ownerId === currentUserId,
        newOwnerIsParticipant: conversationData.participants.includes(newOwnerId),
        affectedFields: ['ownerId', 'adminIds', 'updatedAt'],
        newAdminIds,
        currentAdminIds: conversationData.adminIds
      });
      throw new Error("Permission denied to transfer ownership. Check Firestore Rules.");
    }
    throw new Error(`Failed to transfer ownership: ${error.message}`);
  }
};

