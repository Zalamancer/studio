// src/services/bidService.ts
import { db, auth } from '@/lib/firebase/config';
import {
  collection,
  addDoc,
  doc,
  serverTimestamp,
  Timestamp,
  query,
  orderBy,
  getDocs,
  limit,
  where,
  getDoc,
} from 'firebase/firestore';
import type { NewBidData, Bid, ClientBid } from '@/types/bid';
import { fetchUserProfileBasic } from './connectionService';
import { generateAnonymousName } from '@/lib/pseudonymUtils';

const postsCollectionRef = collection(db, 'posts');

export const addBidToPost = async (postId: string, bidData: NewBidData): Promise<string> => {
  if (!postId || !bidData.bidderId || bidData.bidAmount === undefined) {
    throw new Error("Post ID, bidder ID, and bid amount are required.");
  }

  const postDocRef = doc(postsCollectionRef, postId);
  const postSnap = await getDoc(postDocRef);
  if (!postSnap.exists() || postSnap.data()?.userId === bidData.bidderId) {
    throw new Error("Cannot bid on your own post or post does not exist.");
  }

  const bidsSubcollectionRef = collection(postDocRef, 'bids');
  try {
    const docRef = await addDoc(bidsSubcollectionRef, {
      ...bidData,
      timestamp: serverTimestamp(),
    });
    console.log(`[bidService] Bid added to post ${postId} with ID: ${docRef.id}`);
    return docRef.id;
  } catch (error: any) {
    console.error(`[bidService] Error adding bid to post ${postId}:`, error);
    if (error.code === 'permission-denied') {
      throw new Error('Permission denied to add bid. Check Firestore rules.');
    }
    throw new Error(`Failed to add bid: ${error.message}`);
  }
};

export const getBidsForPost = async (postId: string): Promise<ClientBid[]> => {
  if (!postId) {
    console.warn("[bidService] getBidsForPost called with invalid postId.");
    return [];
  }
  const postDocRef = doc(postsCollectionRef, postId);
  const bidsSubcollectionRef = collection(postDocRef, 'bids');
  try {
    const q = query(
      bidsSubcollectionRef,
      orderBy('timestamp', 'desc'), // Show newest bids first
      limit(50)
    );
    const querySnapshot = await getDocs(q);
    const bids: ClientBid[] = [];

    for (const docSnap of querySnapshot.docs) {
      const data = docSnap.data() as Bid; // Assume Bid type from Firestore
      const bidderProfile = await fetchUserProfileBasic(data.bidderId);
      bids.push({
        id: docSnap.id,
        postId: data.postId,
        bidderId: data.bidderId,
        bidderName: bidderProfile?.displayName || generateAnonymousName(data.bidderId),
        bidderAvatar: bidderProfile?.avatarUrl,
        bidAmount: data.bidAmount,
        bidMessage: data.bidMessage,
        timestamp: (data.timestamp as Timestamp)?.toMillis() || Date.now(),
      });
    }
    console.log(`[bidService] Fetched ${bids.length} bids for post ${postId}`);
    return bids;
  } catch (error: any) {
    console.error(`[bidService] Error fetching bids for post ${postId}:`, error);
    if (error.code === 'permission-denied') {
      throw new Error('Permission denied fetching bids. Check Firestore rules.');
    }
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
      throw new Error("Firestore query for bids requires an index on 'timestamp' (desc). Please create it in the Firebase console for the 'bids' subcollection (collection group query if needed).");
    }
    throw new Error(`Failed to fetch bids: ${error.message}`);
  }
};
