
// src/services/bidService.ts
import { db } from '@/lib/firebase/config';
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
  getDoc,
} from 'firebase/firestore';
import type { NewBidData, Bid, ClientBid } from '@/types/bid';
import { fetchUserProfileBasic } from './connectionService';
import { generateAnonymousName } from '@/lib/pseudonymUtils';

const postsCollectionRef = collection(db, 'posts');

export const addBidToPost = async (bidData: NewBidData): Promise<string> => {
  console.log("[bidService] addBidToPost: Called with data:", bidData);
  if (!bidData.postId || !bidData.bidderId || bidData.bidAmount === undefined) {
    console.error("[bidService] addBidToPost: Missing required fields.");
    throw new Error("Post ID, bidder ID, and bid amount are required.");
  }

  const postDocRef = doc(postsCollectionRef, bidData.postId);
  const postSnap = await getDoc(postDocRef);
  if (!postSnap.exists()) {
    console.error(`[bidService] addBidToPost: Post with ID ${bidData.postId} does not exist.`);
    throw new Error("Post does not exist.");
  }
  if (postSnap.data()?.userId === bidData.bidderId) {
    console.warn(`[bidService] addBidToPost: User ${bidData.bidderId} attempting to bid on their own post ${bidData.postId}.`);
    throw new Error("Cannot bid on your own post.");
  }

  const bidsSubcollectionRef = collection(postDocRef, 'bids');
  try {
    const fullBidData = {
      ...bidData,
      timestamp: serverTimestamp(),
    };
    const docRef = await addDoc(bidsSubcollectionRef, fullBidData);
    console.log(`[bidService] Bid added to post ${bidData.postId} by ${bidData.bidderId} with ID: ${docRef.id}`);
    return docRef.id;
  } catch (error: any) {
    console.error(`[bidService] Error adding bid to post ${bidData.postId}:`, error);
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
  console.log(`[bidService] Fetching bids for post: ${postId}`);
  const postDocRef = doc(postsCollectionRef, postId);
  const bidsSubcollectionRef = collection(postDocRef, 'bids');
  try {
    const q = query(
      bidsSubcollectionRef,
      orderBy('timestamp', 'desc'),
      limit(50)
    );
    const querySnapshot = await getDocs(q);
    const bidsPromises = querySnapshot.docs.map(async (docSnap) => {
      const data = docSnap.data();
      // Ensure bidderId is a valid string; otherwise, skip this bid
      if (!data.bidderId || typeof data.bidderId !== 'string') {
        console.warn(`[bidService] Bid document ${docSnap.id} for post ${postId} is missing or has invalid bidderId. Skipping. Data:`, data);
        return null;
      }
      const bidderProfile = await fetchUserProfileBasic(data.bidderId);
      return {
        id: docSnap.id,
        postId: data.postId || postId, // Fallback to postId from param if missing
        bidderId: data.bidderId,
        bidderName: bidderProfile?.displayName || generateAnonymousName(data.bidderId),
        bidderAvatar: bidderProfile?.avatarUrl,
        bidAmount: typeof data.bidAmount === 'number' ? data.bidAmount : 0, // Default if missing/wrong type
        bidMessage: data.bidMessage || "", // Default if missing
        timestamp: (data.timestamp as Timestamp)?.toMillis() || Date.now(),
      } as ClientBid;
    });

    const resolvedBids = (await Promise.all(bidsPromises)).filter(bid => bid !== null) as ClientBid[];
    console.log(`[bidService] Fetched ${resolvedBids.length} valid bids for post ${postId}`);
    return resolvedBids;
  } catch (error: any) {
    console.error(`[bidService] Error fetching bids for post ${postId}:`, error);
    if (error.code === 'permission-denied') {
      throw new Error('Permission denied fetching bids. Check Firestore rules.');
    }
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
      throw new Error("Firestore query for bids requires an index on 'timestamp' (desc). Please create it in the Firebase console (Collection Group: bids).");
    }
    throw new Error(`Failed to fetch bids: ${error.message}`);
  }
};
