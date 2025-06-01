
// src/app/api/stripe/create-subscription/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import Stripe from 'stripe';
import { authAdmin as firebaseAuthAdmin, dbAdmin } from '@/lib/firebase/auth-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { UserPreference } from '@/types/userPreferences';

export const runtime = 'nodejs';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20', // Use your Stripe API version
});

export async function POST(request: NextRequest) {
  console.log('[API Stripe Create Subscription] Received POST request.');
  try {
    const { userId, priceId } = await request.json();
    console.log(`[API Stripe Create Subscription] Parsed request body - userId: ${userId}, priceId: ${priceId}`);

    if (!userId || !priceId) {
      console.error('[API Stripe Create Subscription] Error: Missing userId or priceId.');
      return NextResponse.json({ error: 'Missing userId or priceId' }, { status: 400 });
    }

    const idToken = request.headers.get('Authorization')?.split('Bearer ')[1];
    if (!idToken) {
      console.error('[API Stripe Create Subscription] Unauthorized: Missing ID token.');
      return NextResponse.json({ error: 'Unauthorized - Missing token' }, { status: 401 });
    }
    if (!firebaseAuthAdmin) {
      console.error('[API Stripe Create Subscription] Firebase Admin Auth not initialized.');
      return NextResponse.json({ error: 'Server configuration error - Auth admin not available.' }, { status: 500 });
    }
    if (!dbAdmin) {
      console.error('[API Stripe Create Subscription] Firestore Admin SDK (dbAdmin) is not initialized.');
      return NextResponse.json({ error: 'Server configuration error - Firestore not available.' }, { status: 500 });
    }

    let decodedToken;
    try {
      decodedToken = await firebaseAuthAdmin.verifyIdToken(idToken);
    } catch (authError: any) {
      console.error('[API Stripe Create Subscription] Firebase Auth Error verifying ID token:', authError.message);
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    if (decodedToken.uid !== userId) {
      console.error(`[API Stripe Create Subscription] Forbidden: Token UID (${decodedToken.uid}) does not match request userId (${userId}).`);
      return NextResponse.json({ error: 'Forbidden - User ID mismatch' }, { status: 403 });
    }
    console.log(`[API Stripe Create Subscription] Request authorized for user: ${userId}`);

    const userPreferencesRef = dbAdmin.collection('userPreferences').doc(userId);
    const userPrefDoc = await userPreferencesRef.get();
    let userPrefData: UserPreference | undefined = userPrefDoc.exists ? userPrefDoc.data() as UserPreference : undefined;

    let stripeCustomerId = userPrefData?.stripeCustomerId;
    let userCreatedNewStripeCustomer = false;

    if (!stripeCustomerId) {
      const userAuthRecord = await firebaseAuthAdmin.getUser(userId);
      const customer = await stripe.customers.create({
        email: userAuthRecord?.email || undefined,
        name: userAuthRecord?.displayName || undefined,
        metadata: { firebaseUID: userId },
      });
      stripeCustomerId = customer.id;
      userCreatedNewStripeCustomer = true;
      console.log(`[API Stripe Create Subscription] Created Stripe customer ${stripeCustomerId} for user ${userId}`);
    } else {
      console.log(`[API Stripe Create Subscription] Found existing Stripe customer ${stripeCustomerId} for user ${userId}`);
    }

    // Get default payment method from user preferences
    const defaultPaymentMethod = userPrefData?.paymentMethods?.find(pm => pm.isDefault);

    if (!defaultPaymentMethod?.stripePaymentMethodId) {
      console.error(`[API Stripe Create Subscription] User ${userId} does not have a default payment method set.`);
      return NextResponse.json({ error: 'No default payment method found. Please add or set a default payment method in your settings.' }, { status: 400 });
    }

    // Set the default payment method for the customer's invoices on Stripe
    try {
      await stripe.customers.update(stripeCustomerId, {
        invoice_settings: {
          default_payment_method: defaultPaymentMethod.stripePaymentMethodId,
        },
      });
      console.log(`[API Stripe Create Subscription] Set default payment method ${defaultPaymentMethod.stripePaymentMethodId} for customer ${stripeCustomerId}`);
    } catch (updateCustomerError: any) {
      console.error(`[API Stripe Create Subscription] Error updating Stripe customer ${stripeCustomerId} with default payment method:`, updateCustomerError);
      return NextResponse.json({ error: `Failed to set default payment method on Stripe: ${updateCustomerError.message}` }, { status: 500 });
    }

    // Create the subscription
    const subscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete', // CORRECTED VALUE
      expand: ['latest_invoice.payment_intent'],
      // trial_period_days: priceId === 'YOUR_STRIPE_PRICE_ID_PRO' ? 7 : undefined, // Example: Add trial for specific plans
    });
    console.log(`[API Stripe Create Subscription] Stripe subscription created with ID: ${subscription.id}, Status: ${subscription.status}`);

    const subscriptionUpdateData: Partial<UserPreference> = {
      stripeCustomerId: stripeCustomerId,
      stripeSubscriptionId: subscription.id,
      activeStripePriceId: priceId,
      stripeSubscriptionStatus: subscription.status,
      stripeSubscriptionCurrentPeriodEnd: subscription.current_period_end,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (userCreatedNewStripeCustomer || !userPrefDoc.exists) {
      subscriptionUpdateData.createdAt = FieldValue.serverTimestamp();
      subscriptionUpdateData.userId = userId; // Make sure userId is set on creation
      // Set default notification preferences if creating the document
      subscriptionUpdateData.notifyOnNewConnectionRequest = true;
      subscriptionUpdateData.notifyOnConnectionAccepted = true;
      subscriptionUpdateData.notifyOnNewMessage = true;
      subscriptionUpdateData.notifyOnReply = true;
      subscriptionUpdateData.notifyOnMention = true;
      subscriptionUpdateData.notifyOnPlatformUpdates = true;
      subscriptionUpdateData.favoriteSectorCodes = [];
      subscriptionUpdateData.paymentMethods = userPrefData?.paymentMethods || []; // Carry over payment methods if any existed (edge case)
      await userPreferencesRef.set(subscriptionUpdateData);
      console.log(`[API Stripe Create Subscription] Created userPreferences for ${userId} with subscription data.`);
    } else {
      await userPreferencesRef.update(subscriptionUpdateData);
      console.log(`[API Stripe Create Subscription] Updated userPreferences for ${userId} with subscription data.`);
    }

    // If the subscription status is 'incomplete', it means the first payment might require customer action (e.g., 3D Secure).
    // The client_secret of the PaymentIntent from the latest_invoice can be used to confirm the payment on the client-side.
    let clientSecret = null;
    if (subscription.status === 'incomplete' && subscription.latest_invoice && typeof subscription.latest_invoice === 'object' && subscription.latest_invoice.payment_intent && typeof subscription.latest_invoice.payment_intent === 'object') {
      clientSecret = subscription.latest_invoice.payment_intent.client_secret;
    }


    return NextResponse.json({
      success: true,
      message: `Subscription initiated. Status: ${subscription.status}.`,
      subscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      clientSecret: clientSecret, // Send client_secret if payment confirmation is needed
    });

  } catch (error: any) {
    console.error('[API Stripe Create Subscription] General Error in POST handler:', error);
    let errorMessage = 'Failed to create subscription.';
    let statusCode = 500;

    if (error instanceof Stripe.errors.StripeError) {
      console.error('[API Stripe Create Subscription] Stripe Error:', error.code, error.message);
      errorMessage = error.message;
      if (error.statusCode) statusCode = error.statusCode;
    } else {
       console.error('[API Stripe Create Subscription] Unknown error type:', error);
       errorMessage = error.message || 'An unexpected server error occurred.';
    }
    return NextResponse.json({ error: errorMessage, stripeErrorCode: error.code, details: error.message }, { status: statusCode });
  }
}
    
    