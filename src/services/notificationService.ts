// src/services/notificationService.ts
'use server';

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

const notificationsCollectionRef = collection(db, 'notifications');

// Function to create a new notification
export const createNotification = async (notificationData: Omit<NewNotificationData, 'senderName' | 'senderAvatar'>): Promise<string> => {
  if (!notificationData.userId || !notificationData.senderId || !notificationData.type) {
    throw new Error('User ID, Sender ID, and Type are required to create a notification.');
  }

  try {
    // Fetch sender's basic profile info
    const senderProfile = await getUserProfileBasic(notificationData.senderId);

    const fullNotificationData: NewNotificationData & { timestamp: Timestamp, isRead: boolean } = {
      ...notificationData,
      senderName: senderProfile?.displayName || `@${notificationData.senderId}`, // Use @ fallback
      senderAvatar: senderProfile?.avatarUrl,
      timestamp: serverTimestamp() as Timestamp,
      isRead: false, // Notifications start as unread
    };

    const docRef = await addDoc(notificationsCollectionRef, fullNotificationData);
    console.log(`Notification created successfully for user ${notificationData.userId} with ID: ${docRef.id}`);
    return docRef.id;
  } catch (error: any) {
    console.error(`Error creating notification for user ${notificationData.userId}:`, error);
    // Handle specific errors like permission denied if necessary
    if (error.code === 'permission-denied') {
      console.error("Firestore permission denied creating notification. Check rules for 'notifications' collection.");
      throw new Error('Permission denied. Check Firestore security rules.');
    }
    throw new Error(`Failed to create notification: ${error.message}`);
  }
};

// Function to fetch notifications for a specific user
export const getNotificationsForUser = async (userId: string, count = 50): Promise<ClientNotification[]> => {
  if (!userId) {
    console.warn("getNotificationsForUser called with invalid userId.");
    return [];
  }
  console.log(`Fetching notifications for user ${userId}`);

  try {
    const q = query(
      notificationsCollectionRef,
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(count)
    );

    const querySnapshot = await getDocs(q);
    console.log(`Notification query snapshot received. Found ${querySnapshot.docs.length} notification documents.`);

    const notifications = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      const timestampMillis = data.timestamp instanceof Timestamp ? data.timestamp.toMillis() : Date.now();

      return {
        id: docSnap.id,
        ...data,
        timestamp: timestampMillis,
      } as ClientNotification; // Assert type after conversion
    });

    console.log(`Successfully mapped ${notifications.length} client notifications for user ${userId}`);
    return notifications;

  } catch (error: any) {
    console.error(`Error fetching notifications for user ${userId}:`, error);
    if (error.code === 'permission-denied') {
      console.error("Firestore permission denied fetching notifications. Check rules for reading 'notifications'.");
      throw new Error('Permission denied fetching notifications. Check Firestore rules.');
    }
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
      console.error("Firestore query for notifications requires an index. Create an index on 'userId' (==) and 'timestamp' (desc) in the Firebase console.");
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
    console.log(`Notification ${notificationId} marked as read.`);
  } catch (error: any) {
    console.error(`Error marking notification ${notificationId} as read:`, error);
    if (error.code === 'permission-denied') {
      console.error("Firestore permission denied updating notification. Check rules.");
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
  console.log(`Marking all unread notifications as read for user ${userId}`);
  try {
    // Query for unread notifications for the user
    const q = query(
      notificationsCollectionRef,
      where('userId', '==', userId),
      where('isRead', '==', false)
      // No limit needed, update all matching
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.log(`No unread notifications found for user ${userId}.`);
      return; // Nothing to mark
    }

    // Use a batch to update all documents atomically
    const batch = writeBatch(db);
    querySnapshot.docs.forEach((docSnap) => {
      batch.update(docSnap.ref, { isRead: true });
    });

    await batch.commit();
    console.log(`Successfully marked ${querySnapshot.docs.length} notifications as read for user ${userId}.`);

  } catch (error: any) {
    console.error(`Error marking all notifications as read for user ${userId}:`, error);
    if (error.code === 'permission-denied') {
      console.error("Firestore permission denied marking notifications as read. Check rules.");
      throw new Error('Permission denied marking notifications as read.');
    }
     if (error.code === 'failed-precondition' && error.message.includes('index')) {
        console.error("Firestore query for marking notifications requires an index. Create an index on 'userId' (==) and 'isRead' (==) in the Firebase console.");
        throw new Error("Firestore query requires an index for marking notifications. Please create it.");
    }
    throw new Error(`Failed to mark all notifications as read: ${error.message}`);
  }
};