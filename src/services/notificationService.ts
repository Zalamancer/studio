// src/services/notificationService.ts
import { db, auth } from '@/lib/firebase/config'; // Import auth
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import type { NewNotificationData, ClientNotification, Notification } from '@/types/notification';
import { fetchUserProfileBasic } from './connectionService';
import { generateAnonymousName } from '@/lib/pseudonymUtils';
import { getUserPreferences, type UserPreference } from './userPreferenceService'; // Import preference service

const notificationsCollectionRef = collection(db, 'notifications');

export const createNotification = async (notificationData: NewNotificationData): Promise<string | null> => {
  const recipientId = notificationData.userId;
  const senderId = notificationData.senderId;
  const currentUserUid = auth.currentUser?.uid;

  // console.log('%c[notificationService] createNotification: Called with data:', "color: purple;", JSON.stringify(notificationData, null, 2));
  // console.log(`%c  Current auth UID: ${currentUserUid || 'NULL'}, Recipient: ${recipientId}, Sender: ${senderId}`, "color: purple;");

  if (!recipientId || !senderId || !notificationData.type) {
    // console.error('%c[notificationService] createNotification: Missing required fields (userId, senderId, type). Data:', "color: red;", notificationData);
    throw new Error('User ID, Sender ID, and Type are required to create a notification.');
  }

  // Handle preferences only if the notification is for the current user
  if (currentUserUid === recipientId) {
    let preferences: UserPreference | null = null;
    try {
      // console.log(`%c[notificationService] Attempting to fetch preferences for self (${recipientId})...`, "color: cadetblue;");
      preferences = await getUserPreferences(recipientId);
      // console.log(`%c[notificationService] Preferences for self (${recipientId}):`, "color: cadetblue;", preferences);
    } catch (prefError) {
      // console.error(`%c[notificationService] Error fetching preferences for self (${recipientId}). Notification will NOT be created for self. Error:`, "color: orange;", prefError);
      return null; // Don't create self-notification if preferences can't be determined
    }

    // If preferences were fetched successfully (not null)
    if (preferences) {
      if (notificationData.type === 'new_message' && preferences.notifyOnNewMessage === false) {
        // console.log(`%c[notificationService] Self-notification: User ${recipientId} has 'new_message' OFF. Skipping.`, "color: orange;");
        return null;
      }
      if (notificationData.type === 'reply' && preferences.notifyOnReply === false) {
        // console.log(`%c[notificationService] Self-notification: User ${recipientId} has 'reply' OFF. Skipping.`, "color: orange;");
        return null;
      }
      if (notificationData.type === 'mention' && preferences.notifyOnMention === false) {
        // console.log(`%c[notificationService] Self-notification: User ${recipientId} has 'mention' OFF. Skipping.`, "color: orange;");
        return null;
      }
      if (notificationData.type === 'connection_request' && preferences.notifyOnNewConnectionRequest === false) {
         // console.log(`%c[notificationService] Self-notification: User ${recipientId} has 'connection_request' OFF. Skipping.`, "color: orange;");
         return null;
      }
      if (notificationData.type === 'connection_accepted' && preferences.notifyOnConnectionAccepted === false) {
         // console.log(`%c[notificationService] Self-notification: User ${recipientId} has 'connection_accepted' OFF. Skipping.`, "color: orange;");
         return null;
      }
    } else {
      // Preferences object is null, meaning an error occurred fetching preferences for self.
      // Err on the side of caution and don't send self-notifications.
      // console.log(`%c[notificationService] Self-notification: Preferences object is null for ${recipientId} (likely due to fetch error). Skipping self-notification.`, "color: orange;");
      return null;
    }
  } else {
    // console.log(`%c[notificationService] Notification for other user. Recipient: ${recipientId}, Sender: ${currentUserUid}. Recipient preference check skipped by sender.`, "color: lightblue;");
    // Proceed to create notification for other users without checking their prefs from sender's client.
  }

  let senderProfile = null;
  try {
    senderProfile = await fetchUserProfileBasic(senderId);
    // console.log('%c[notificationService] createNotification: Fetched senderProfile for senderId', "color: #20B2AA;", senderId, ':', JSON.stringify(senderProfile, null, 2));
  } catch (profileError) {
    // console.error(`%c[notificationService] createNotification: Failed to fetch sender profile for ${senderId}. Proceeding with generated name. Error:`, "color: orange;", profileError);
  }

  const fullNotificationData: Omit<Notification, 'id'> = {
    userId: recipientId,
    type: notificationData.type,
    senderId: senderId,
    senderName: senderProfile?.displayName || generateAnonymousName(senderId),
    senderAvatar: senderProfile?.avatarUrl || null, // Ensure null if undefined
    postId: notificationData.postId || null,
    postQuestion: notificationData.postQuestion || null,
    commentId: notificationData.commentId || null,
    subCommentId: notificationData.subCommentId || null,
    conversationId: notificationData.conversationId || null,
    textSnippet: notificationData.textSnippet || null,
    timestamp: serverTimestamp() as Timestamp,
    isRead: false,
  };
  // console.log('%c[notificationService] createNotification: fullNotificationData to be written:', "color: purple; font-weight: bold;", JSON.stringify(fullNotificationData, null, 2));

  try {
    const docRef = await addDoc(notificationsCollectionRef, fullNotificationData);
    // console.log(`%c[notificationService] Notification CREATED successfully for user ${recipientId} (recipient) from sender ${senderId} with Notification ID: ${docRef.id}`, "color: green;");
    return docRef.id;
  } catch (error: any) {
    // console.error(`%c[notificationService] FAILED to create notification for user ${recipientId}. Sender was ${senderId}. Error:`, "color: red;", error.message, error);
    // console.error(`  Error Code: ${error.code}, Message: ${error.message}`);
    if (error.code === 'permission-denied') {
      // console.error("[notificationService] Firestore permission denied creating notification. Check rules for 'notifications' collection.");
      throw new Error('Permission denied. Check Firestore security rules.');
    }
    if (error.message && error.message.includes("Unsupported field value: undefined")) {
      // console.error("[notificationService] Firestore received an undefined value. Full data for Firestore:", fullNotificationData);
      throw new Error(`Failed to create notification: Firestore received an undefined field value. ${error.message}`);
    }
    throw new Error(`Failed to create notification: ${error.message}`);
  }
};

export const getNotificationsForUser = async (userId: string, count = 20): Promise<ClientNotification[]> => {
  const clientAuthUid = auth.currentUser?.uid;
  if (!userId) {
    // console.warn("[notificationService] getNotificationsForUser called with invalid userId.");
    return [];
  }
  // console.log(`%c[notificationService] Fetching notifications for user ${userId}. Client auth UID: '${clientAuthUid || 'NULL'}'`, "color: dodgerblue;");

  try {
    const q = query(
      notificationsCollectionRef,
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(count)
    );

    const querySnapshot = await getDocs(q);
    // console.log(`%c[notificationService] Notification query snapshot received. Found ${querySnapshot.docs.length} notification documents for user ${userId}.`, "color: dodgerblue;");

    const notifications = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data() as Notification;
      const timestampMillis = data.timestamp instanceof Timestamp ? data.timestamp.toMillis() : Date.now();

      return {
        id: docSnap.id,
        userId: data.userId,
        type: data.type,
        senderId: data.senderId,
        senderName: data.senderName || generateAnonymousName(data.senderId),
        senderAvatar: data.senderAvatar || null,
        postId: data.postId || null,
        postQuestion: data.postQuestion || null,
        commentId: data.commentId || null,
        subCommentId: data.subCommentId || null,
        conversationId: data.conversationId || null,
        textSnippet: data.textSnippet || null,
        timestamp: timestampMillis,
        isRead: data.isRead,
      } as ClientNotification;
    });

    // console.log(`%c[notificationService] Successfully mapped ${notifications.length} client notifications for user ${userId}`, "color: green;");
    return notifications;

  } catch (error: any) {
    // console.error(`[notificationService] Error fetching notifications for user ${userId}:`, error);
    if (error.code === 'permission-denied') {
      // console.error("Firestore permission denied fetching notifications. Check rules for reading 'notifications'.");
      throw new Error('Permission denied fetching notifications. Check Firestore rules.');
    }
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
      // console.error("Firestore query for notifications requires an index. Create an index on 'userId' (==) and 'timestamp' (desc) in the Firebase console.");
      throw new Error("Firestore query requires an index for notifications. Please create it in the Firebase console.");
    }
    throw new Error(`Failed to fetch notifications: ${error.message}`);
  }
};

export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
  if (!notificationId) {
    throw new Error('Notification ID is required.');
  }
  try {
    const notificationDocRef = doc(db, 'notifications', notificationId);
    await updateDoc(notificationDocRef, { isRead: true });
    // console.log(`[notificationService] Notification ${notificationId} marked as read.`);
  } catch (error: any) {
    // console.error(`[notificationService] Error marking notification ${notificationId} as read:`, error);
    if (error.code === 'permission-denied') {
      // console.error("[notificationService] Firestore permission denied updating notification. Check rules.");
      throw new Error('Permission denied updating notification.');
    }
    throw new Error(`Failed to mark notification as read: ${error.message}`);
  }
};

export const markAllNotificationsAsRead = async (userId: string): Promise<void> => {
  if (!userId) {
    throw new Error('User ID is required.');
  }
  // console.log(`[notificationService] Marking all unread notifications as read for user ${userId}`);
  try {
    const q = query(
      notificationsCollectionRef,
      where('userId', '==', userId),
      where('isRead', '==', false)
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      // console.log(`[notificationService] No unread notifications found for user ${userId}.`);
      return;
    }

    const batch = writeBatch(db);
    querySnapshot.docs.forEach((docSnap) => {
      batch.update(docSnap.ref, { isRead: true });
    });

    await batch.commit();
    // console.log(`[notificationService] Successfully marked ${querySnapshot.docs.length} notifications as read for user ${userId}.`);

  } catch (error: any)  {
    // console.error(`[notificationService] Error marking all notifications as read for user ${userId}:`, error);
    if (error.code === 'permission-denied') {
      // console.error("[notificationService] Firestore permission denied marking notifications as read. Check rules.");
      throw new Error('Permission denied marking notifications as read.');
    }
     if (error.code === 'failed-precondition' && error.message.includes('index')) {
        // console.error("[notificationService] Firestore query for marking notifications requires an index. Create an index on 'userId' (==) and 'isRead' (==) in the Firebase console.");
        throw new Error("Firestore query requires an index for marking notifications. Please create it.");
    }
    throw new Error(`Failed to mark all notifications as read: ${error.message}`);
  }
};
