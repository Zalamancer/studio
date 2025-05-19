// src/services/notificationService.ts
import { db } from '@/lib/firebase/config';
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
import { fetchUserProfileBasic } from './connectionService'; // To fetch sender details
import { generateAnonymousName } from '@/lib/pseudonymUtils';
import { getUserPreferences } from './userPreferenceService'; // Import user preference service

const notificationsCollectionRef = collection(db, 'notifications');

export const createNotification = async (notificationData: NewNotificationData): Promise<string | null> => {
  console.log('%c[notificationService] createNotification: Called with data:', "color: purple;", JSON.stringify(notificationData, null, 2));
  const recipientId = notificationData.userId;
  if (!recipientId || !notificationData.senderId || !notificationData.type) {
    console.error('%c[notificationService] createNotification: Missing required fields (userId, senderId, type). Data:', "color: red;", notificationData);
    throw new Error('User ID, Sender ID, and Type are required to create a notification.');
  }

  // Fetch recipient's notification preferences
  try {
    const preferences = await getUserPreferences(recipientId);
    console.log(`%c[notificationService] Preferences for recipient ${recipientId}:`, "color: cadetblue;", preferences);

    if (notificationData.type === 'reply' && preferences?.notifyOnReply === false) {
      console.log(`%c[notificationService] User ${recipientId} has disabled 'reply' notifications. Skipping.`, "color: orange;");
      return null; // Skip notification
    }
    if (notificationData.type === 'mention' && preferences?.notifyOnMention === false) {
      console.log(`%c[notificationService] User ${recipientId} has disabled 'mention' notifications. Skipping.`, "color: orange;");
      return null; // Skip notification
    }
    if (notificationData.type === 'new_connection_request' && preferences?.notifyOnNewConnectionRequest === false) {
      console.log(`%c[notificationService] User ${recipientId} has disabled 'new_connection_request' notifications. Skipping.`, "color: orange;");
      return null;
    }
    if (notificationData.type === 'connection_accepted' && preferences?.notifyOnConnectionAccepted === false) {
      console.log(`%c[notificationService] User ${recipientId} has disabled 'connection_accepted' notifications. Skipping.`, "color: orange;");
      return null;
    }
    if (notificationData.type === 'new_message' && preferences?.notifyOnNewMessage === false) {
      console.log(`%c[notificationService] User ${recipientId} has disabled 'new_message' notifications. Skipping.`, "color: orange;");
      return null;
    }
    // Note: We don't check for notifyOnPlatformUpdates here as this service typically handles user-to-user notifications.

  } catch (prefError) {
    console.error(`%c[notificationService] Error fetching preferences for recipient ${recipientId}. Proceeding with notification creation. Error:`, "color: orange;", prefError);
    // Decide if you want to proceed or not if preferences can't be fetched.
    // For now, we'll proceed to ensure notifications aren't missed due to pref fetch errors.
  }


  let senderProfile = null;
  try {
    senderProfile = await fetchUserProfileBasic(notificationData.senderId);
    console.log('%c[notificationService] createNotification: Fetched senderProfile for senderId', "color: purple;", notificationData.senderId, ':', JSON.stringify(senderProfile, null, 2));
  } catch (profileError) {
    console.error(`%c[notificationService] createNotification: Failed to fetch sender profile for ${notificationData.senderId}. Proceeding without sender details. Error:`, "color: orange;", profileError);
  }

  const fullNotificationData: Omit<Notification, 'id'> = {
    userId: recipientId,
    type: notificationData.type,
    senderId: notificationData.senderId,
    senderName: senderProfile?.displayName || generateAnonymousName(notificationData.senderId),
    senderAvatar: senderProfile?.avatarUrl || null,
    postId: notificationData.postId || null,
    postQuestion: notificationData.postQuestion || null,
    commentId: notificationData.commentId || null,
    subCommentId: notificationData.subCommentId || null,
    conversationId: notificationData.conversationId || null,
    textSnippet: notificationData.textSnippet || null,
    timestamp: serverTimestamp() as Timestamp,
    isRead: false,
  };
  console.log('%c[notificationService] createNotification: fullNotificationData to be written:', "color: purple; font-weight: bold;", JSON.stringify(fullNotificationData, null, 2));

  try {
    const docRef = await addDoc(notificationsCollectionRef, fullNotificationData);
    console.log(`%c[notificationService] Notification CREATED successfully for user ${recipientId} (recipient) from sender ${notificationData.senderId} with Notification ID: ${docRef.id}`, "color: green;");
    return docRef.id;
  } catch (error: any) {
    console.error(`%c[notificationService] FAILED to create notification for user ${recipientId}. Sender was ${notificationData.senderId}. Error:`, "color: red;", error.message, error);
    console.error(`  Error Code: ${error.code}, Message: ${error.message}`);
    if (error.code === 'permission-denied') {
      console.error("[notificationService] Firestore permission denied creating notification. Check rules for 'notifications' collection.");
      throw new Error('Permission denied. Check Firestore security rules.');
    }
    if (error.message && error.message.includes("Unsupported field value: undefined")) {
      console.error("[notificationService] Firestore received an undefined value. Full data for Firestore:", fullNotificationData);
      throw new Error(`Failed to create notification: Firestore received an undefined field value. ${error.message}`);
    }
    throw new Error(`Failed to create notification: ${error.message}`);
  }
};

export const getNotificationsForUser = async (userId: string, count = 50): Promise<ClientNotification[]> => {
  const clientAuthUid = auth.currentUser?.uid; // For logging
  if (!userId) {
    console.warn("[notificationService] getNotificationsForUser called with invalid userId.");
    return [];
  }
  console.log(`%c[notificationService] Fetching notifications for user ${userId}. Client auth UID: '${clientAuthUid || 'NULL'}'`, "color: dodgerblue;");

  try {
    const q = query(
      notificationsCollectionRef,
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(count)
    );

    const querySnapshot = await getDocs(q);
    console.log(`%c[notificationService] Notification query snapshot received. Found ${querySnapshot.docs.length} notification documents for user ${userId}.`, "color: dodgerblue;");

    const notifications = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data() as Notification; // Use Notification type here
      const timestampMillis = data.timestamp instanceof Timestamp ? data.timestamp.toMillis() : Date.now();

      return {
        id: docSnap.id,
        userId: data.userId,
        type: data.type,
        senderId: data.senderId,
        senderName: data.senderName || generateAnonymousName(data.senderId), // Fallback for senderName
        senderAvatar: data.senderAvatar, // Can be null
        postId: data.postId,
        postQuestion: data.postQuestion,
        commentId: data.commentId,
        subCommentId: data.subCommentId,
        conversationId: data.conversationId,
        textSnippet: data.textSnippet,
        timestamp: timestampMillis,
        isRead: data.isRead,
      } as ClientNotification;
    });

    console.log(`%c[notificationService] Successfully mapped ${notifications.length} client notifications for user ${userId}`, "color: green;");
    return notifications;

  } catch (error: any) {
    console.error(`[notificationService] Error fetching notifications for user ${userId}:`, error);
    if (error.code === 'permission-denied') {
      console.error(`[notificationService] PERMISSION DENIED fetching notifications for target ${userId}. Client auth UID: '${clientAuthUid || 'NULL'}'. Check Firestore rules for reading 'notifications' collection.`);
      throw new Error('Permission denied fetching notifications. Check Firestore rules.');
    }
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
      console.error("Firestore query for notifications requires an index. Create an index on 'userId' (==) and 'timestamp' (desc) in the Firebase console.");
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
    console.log(`[notificationService] Notification ${notificationId} marked as read.`);
  } catch (error: any) {
    console.error(`[notificationService] Error marking notification ${notificationId} as read:`, error);
    if (error.code === 'permission-denied') {
      console.error("[notificationService] Firestore permission denied updating notification. Check rules.");
      throw new Error('Permission denied updating notification.');
    }
    throw new Error(`Failed to mark notification as read: ${error.message}`);
  }
};

export const markAllNotificationsAsRead = async (userId: string): Promise<void> => {
  if (!userId) {
    throw new Error('User ID is required.');
  }
  console.log(`[notificationService] Marking all unread notifications as read for user ${userId}`);
  try {
    const q = query(
      notificationsCollectionRef,
      where('userId', '==', userId),
      where('isRead', '==', false)
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.log(`[notificationService] No unread notifications found for user ${userId}.`);
      return;
    }

    const batch = writeBatch(db);
    querySnapshot.docs.forEach((docSnap) => {
      batch.update(docSnap.ref, { isRead: true });
    });

    await batch.commit();
    console.log(`[notificationService] Successfully marked ${querySnapshot.docs.length} notifications as read for user ${userId}.`);

  } catch (error: any) {
    console.error(`[notificationService] Error marking all notifications as read for user ${userId}:`, error);
    if (error.code === 'permission-denied') {
      console.error("[notificationService] Firestore permission denied marking notifications as read. Check rules.");
      throw new Error('Permission denied marking notifications as read.');
    }
     if (error.code === 'failed-precondition' && error.message.includes('index')) {
        console.error("[notificationService] Firestore query for marking notifications requires an index. Create an index on 'userId' (==) and 'isRead' (==) in the Firebase console.");
        throw new Error("Firestore query requires an index for marking notifications. Please create it.");
    }
    throw new Error(`Failed to mark all notifications as read: ${error.message}`);
  }
};

// Needed for client-side calls that need to know the current user
import { auth } from '@/lib/firebase/config';
