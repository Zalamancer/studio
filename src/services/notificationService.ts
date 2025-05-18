// src/services/notificationService.ts
// Client-callable by default (no 'use server;' at the top)

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
import type { NewNotificationData, ClientNotification } from '@/types/notification';
import { getUserProfileBasic } from './connectionService'; // To fetch sender details
// Removed: import { generateAnonymousName } from '@/lib/pseudonymUtils'; // No longer needed

const notificationsCollectionRef = collection(db, 'notifications');

// Function to create a new notification
export const createNotification = async (notificationData: Omit<NewNotificationData, 'senderName' | 'senderAvatar'>): Promise<string> => {
  console.log('[notificationService] createNotification: Called with data:', notificationData);
  if (!notificationData.userId || !notificationData.senderId || !notificationData.type) {
    console.error('[notificationService] createNotification: Missing required fields (userId, senderId, type).', notificationData);
    throw new Error('User ID, Sender ID, and Type are required to create a notification.');
  }

  try {
    const senderProfile = await getUserProfileBasic(notificationData.senderId);
    console.log('[notificationService] createNotification: Fetched senderProfile:', senderProfile);

    const fullNotificationData: NewNotificationData & { timestamp: Timestamp, isRead: boolean } = {
      ...notificationData,
      senderName: senderProfile?.displayName || `@${notificationData.senderId}`, // Use @UID fallback
      senderAvatar: senderProfile?.avatarUrl,
      postQuestion: notificationData.postQuestion || null, // Ensure null if undefined
      commentId: notificationData.commentId || null,
      subCommentId: notificationData.subCommentId || null,
      textSnippet: notificationData.textSnippet || null,
      timestamp: serverTimestamp() as Timestamp,
      isRead: false,
    };
    console.log('[notificationService] createNotification: fullNotificationData to be written:', fullNotificationData);

    const docRef = await addDoc(notificationsCollectionRef, fullNotificationData);
    console.log(`[notificationService] Notification CREATED successfully for user ${notificationData.userId} with ID: ${docRef.id}`);
    return docRef.id;
  } catch (error: any) {
    console.error(`[notificationService] FAILED to create notification for user ${notificationData.userId}:`, error);
    console.error(`  Error Code: ${error.code}, Message: ${error.message}`);
    if (error.code === 'permission-denied') {
      console.error("[notificationService] Firestore permission denied creating notification. Check rules for 'notifications' collection.");
      throw new Error('Permission denied. Check Firestore security rules.');
    }
    throw new Error(`Failed to create notification: ${error.message}`);
  }
};

// Function to fetch notifications for a specific user
export const getNotificationsForUser = async (userId: string, count = 50): Promise<ClientNotification[]> => {
  if (!userId) {
    console.warn("[notificationService] getNotificationsForUser called with invalid userId.");
    return [];
  }
  console.log(`[notificationService] Fetching notifications for user ${userId}`);

  try {
    const q = query(
      notificationsCollectionRef,
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(count)
    );

    const querySnapshot = await getDocs(q);
    console.log(`[notificationService] Notification query snapshot received. Found ${querySnapshot.docs.length} notification documents for user ${userId}.`);

    const notifications = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      const timestampMillis = data.timestamp instanceof Timestamp ? data.timestamp.toMillis() : Date.now();

      return {
        id: docSnap.id,
        ...data,
        timestamp: timestampMillis,
      } as ClientNotification;
    });

    console.log(`[notificationService] Successfully mapped ${notifications.length} client notifications for user ${userId}`);
    return notifications;

  } catch (error: any) {
    console.error(`[notificationService] Error fetching notifications for user ${userId}:`, error);
    if (error.code === 'permission-denied') {
      console.error("[notificationService] Firestore permission denied fetching notifications. Check rules for reading 'notifications'.");
      throw new Error('Permission denied fetching notifications. Check Firestore rules.');
    }
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
      console.error("[notificationService] Firestore query for notifications requires an index. Create an index on 'userId' (==) and 'timestamp' (desc) in the Firebase console.");
      throw new Error("Firestore query requires an index for notifications. Please create it in the Firebase console.");
    }
    throw new Error(`Failed to fetch notifications: ${error.message}`);
  }
};

// Function to mark a single notification as read
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

// Function to mark all unread notifications for a user as read (using batch write)
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
