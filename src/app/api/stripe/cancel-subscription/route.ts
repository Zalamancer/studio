
// src/app/api/stripe/cancel-subscription/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import Stripe from 'stripe';
import { authAdmin as firebaseAuthAdmin, dbAdmin } from '@/lib/firebase/auth-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { UserPreference } from '@/types/userPreferences';

export const runtime = 'nodejs';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20',
});

export async function POST(request: NextRequest) {
  console.log('[API Stripe Cancel Subscription] Received POST request.');
  try {
    const { userId, subscriptionId } = await request.json();
    console.log(`[API Stripe Cancel Subscription] Parsed request body - userId: ${userId}, subscriptionId: ${subscriptionId}`);

    if (!userId || !subscriptionId) {
      console.error('[API Stripe Cancel Subscription] Error: Missing userId or subscriptionId.');
      return NextResponse.json({ error: 'Missing userId or subscriptionId' }, { status: 400 });
    }

    const idToken = request.headers.get('Authorization')?.split('Bearer ')[1];
    if (!idToken) {
      console.error('[API Stripe Cancel Subscription] Unauthorized: Missing ID token.');
      return NextResponse.json({ error: 'Unauthorized - Missing token' }, { status: 401 });
    }
    if (!firebaseAuthAdmin || !dbAdmin) {
      console.error('[API Stripe Cancel Subscription] Firebase Admin not initialized.');
      return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
    }

    let decodedToken;
    try {
      decodedToken = await firebaseAuthAdmin.verifyIdToken(idToken);
    } catch (authError: any) {
      console.error('[API Stripe Cancel Subscription] Firebase Auth Error:', authError.message);
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    if (decodedToken.uid !== userId) {
      console.error(`[API Stripe Cancel Subscription] Forbidden: Token UID (${decodedToken.uid}) does not match request userId (${userId}).`);
      return NextResponse.json({ error: 'Forbidden - User ID mismatch' }, { status: 403 });
    }
    console.log(`[API Stripe Cancel Subscription] Request authorized for user: ${userId}`);

    const userPreferencesRef = dbAdmin.collection('userPreferences').doc(userId);
    const userPrefDoc = await userPreferencesRef.get();

    if (!userPrefDoc.exists) {
      console.error(`[API Stripe Cancel Subscription] User preferences not found for user: ${userId}`);
      return NextResponse.json({ error: 'User preferences not found.' }, { status: 404 });
    }

    const userPrefData = userPrefDoc.data() as UserPreference;

    if (userPrefData.stripeSubscriptionId !== subscriptionId) {
      console.error(`[API Stripe Cancel Subscription] Subscription ID mismatch. Request: ${subscriptionId}, Stored: ${userPrefData.stripeSubscriptionId}`);
      return NextResponse.json({ error: 'Subscription ID mismatch with user record.' }, { status: 400 });
    }

    // Cancel the subscription at the end of the current billing period
    const canceledSubscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
    });
    console.log(`[API Stripe Cancel Subscription] Stripe subscription ${subscriptionId} marked to cancel at period end. Status: ${canceledSubscription.status}`);

    // Update Firestore - status remains active until period end, but we reflect the pending cancellation.
    // Stripe webhook 'customer.subscription.updated' or 'customer.subscription.deleted' should handle final update.
    const subscriptionUpdateData: Partial<UserPreference> = {
      // stripeSubscriptionId: null, // Keep ID for reference until fully canceled
      // activeStripePriceId: null,  // Keep active price ID until fully canceled
      stripeSubscriptionStatus: 'active', // Stripe status will still be 'active'
      // Store 'cancel_at_period_end' from Stripe if needed, or just rely on period_end for display
      stripeSubscriptionCancelAtPeriodEnd: canceledSubscription.cancel_at_period_end, // This field is a boolean.
                                                                                        // The actual cancellation timestamp is current_period_end.
      stripeSubscriptionCurrentPeriodEnd: canceledSubscription.current_period_end, // This is when it will actually end.
      updatedAt: FieldValue.serverTimestamp(),
    };
    // To avoid confusion, it might be better to set a custom status like 'pending_cancellation'
    // For now, we'll update Firestore with what Stripe gives us. The UI will need to interpret this.
    // Let's be more direct for UI:
    const firestoreUpdate: Partial<UserPreference> = {
        stripeSubscriptionStatus: 'active', // It's still active
        stripeSubscriptionCurrentPeriodEnd: canceledSubscription.current_period_end, // This is the key date for UI
        stripeSubscriptionWillCancelAtPeriodEnd: true, // Add a custom flag
        updatedAt: FieldValue.serverTimestamp(),
    };


    await userPreferencesRef.update(firestoreUpdate);
    console.log(`[API Stripe Cancel Subscription] Updated userPreferences for ${userId} with subscription marked for cancellation at period end.`);

    return NextResponse.json({
      success: true,
      message: `Subscription ${subscriptionId} is now set to cancel at the end of the current billing period (on ${new Date((canceledSubscription.current_period_end || 0) * 1000).toLocaleDateString()}).`,
      canceledSubscriptionDetails: {
        status: canceledSubscription.status,
        cancel_at_period_end: canceledSubscription.cancel_at_period_end,
        current_period_end: canceledSubscription.current_period_end,
      }
    });

  } catch (error: any) {
    console.error('[API Stripe Cancel Subscription] General Error:', error);
    let errorMessage = 'Failed to set subscription to cancel at period end.';
    let statusCode = 500;

    if (error instanceof Stripe.errors.StripeError) {
      console.error('[API Stripe Cancel Subscription] Stripe Error:', error.code, error.message);
      errorMessage = error.message;
      if (error.statusCode) statusCode = error.statusCode;
    } else {
       errorMessage = error.message || 'An unexpected server error occurred.';
    }
    return NextResponse.json({ error: errorMessage, stripeErrorCode: error.code, details: error.message }, { status: statusCode });
  }
}
    