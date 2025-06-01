
// src/app/api/stripe/create-subscription/route.ts
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
  console.log('[API Stripe Create/Update Subscription] Received POST request.');
  try {
    const { userId, priceId } = await request.json();
    console.log(`[API Stripe Create/Update Subscription] Parsed request body - userId: ${userId}, priceId: ${priceId}`);

    if (!userId || !priceId) {
      console.error('[API Stripe Create/Update Subscription] Error: Missing userId or priceId.');
      return NextResponse.json({ error: 'Missing userId or priceId' }, { status: 400 });
    }

    const idToken = request.headers.get('Authorization')?.split('Bearer ')[1];
    if (!idToken) {
      console.error('[API Stripe Create/Update Subscription] Unauthorized: Missing ID token.');
      return NextResponse.json({ error: 'Unauthorized - Missing token' }, { status: 401 });
    }
    if (!firebaseAuthAdmin || !dbAdmin) {
      console.error('[API Stripe Create/Update Subscription] Firebase Admin not initialized.');
      return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
    }

    let decodedToken;
    try {
      decodedToken = await firebaseAuthAdmin.verifyIdToken(idToken);
    } catch (authError: any) {
      console.error('[API Stripe Create/Update Subscription] Firebase Auth Error verifying ID token:', authError.message);
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    if (decodedToken.uid !== userId) {
      console.error(`[API Stripe Create/Update Subscription] Forbidden: Token UID (${decodedToken.uid}) does not match request userId (${userId}).`);
      return NextResponse.json({ error: 'Forbidden - User ID mismatch' }, { status: 403 });
    }
    console.log(`[API Stripe Create/Update Subscription] Request authorized for user: ${userId}`);

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
      console.log(`[API Stripe Create/Update Subscription] Created Stripe customer ${stripeCustomerId} for user ${userId}`);
    } else {
      console.log(`[API Stripe Create/Update Subscription] Found existing Stripe customer ${stripeCustomerId} for user ${userId}`);
    }

    // Ensure default payment method is set on the customer for new subscriptions or if changing
    const defaultPaymentMethod = userPrefData?.paymentMethods?.find(pm => pm.isDefault);
    if (!defaultPaymentMethod?.stripePaymentMethodId && priceId !== process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_BASIC) { // Assuming Basic is free
      console.error(`[API Stripe Create/Update Subscription] User ${userId} does not have a default payment method for a paid plan.`);
      return NextResponse.json({ error: 'No default payment method found. Please add or set a default payment method in your settings.' }, { status: 400 });
    }

    if (defaultPaymentMethod?.stripePaymentMethodId) {
      try {
        await stripe.customers.update(stripeCustomerId, {
          invoice_settings: {
            default_payment_method: defaultPaymentMethod.stripePaymentMethodId,
          },
        });
        console.log(`[API Stripe Create/Update Subscription] Set default payment method ${defaultPaymentMethod.stripePaymentMethodId} for customer ${stripeCustomerId}`);
      } catch (updateCustomerError: any) {
        console.error(`[API Stripe Create/Update Subscription] Error updating Stripe customer ${stripeCustomerId} with default PM:`, updateCustomerError);
        // Continue if this fails, subscription creation might still work if Stripe has a PM
      }
    }

    let subscription;
    let message = "Subscription initiated.";
    let clientSecret = null;

    const existingSubscriptionId = userPrefData?.stripeSubscriptionId;
    const existingSubscriptionStatus = userPrefData?.stripeSubscriptionStatus;
    const isActiveOrTrialing = existingSubscriptionStatus === 'active' || existingSubscriptionStatus === 'trialing';

    if (existingSubscriptionId && isActiveOrTrialing) {
      console.log(`[API Stripe Create/Update Subscription] User ${userId} has an existing active/trialing subscription: ${existingSubscriptionId}. Attempting to update.`);
      const currentSubscription = await stripe.subscriptions.retrieve(existingSubscriptionId);
      if (!currentSubscription.items.data[0]?.id) {
        throw new Error('Existing subscription has no items to update.');
      }
      const currentSubscriptionItemId = currentSubscription.items.data[0].id;

      subscription = await stripe.subscriptions.update(existingSubscriptionId, {
        items: [{
          id: currentSubscriptionItemId, // ID of the existing subscription item to replace
          price: priceId, // New price ID
        }],
        proration_behavior: 'create_prorations', // Or 'none' or 'always_invoice'
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
      });
      message = "Subscription updated successfully.";
      console.log(`[API Stripe Create/Update Subscription] Stripe subscription ${subscription.id} updated. Status: ${subscription.status}`);
    } else {
      console.log(`[API Stripe Create/Update Subscription] No existing active subscription for user ${userId} or status is not active/trialing. Creating new subscription.`);
      subscription = await stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
        // trial_period_days: priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO ? 7 : undefined, // Example
      });
      message = "Subscription created successfully.";
      console.log(`[API Stripe Create/Update Subscription] New Stripe subscription created with ID: ${subscription.id}, Status: ${subscription.status}`);
    }

    const subscriptionUpdateData: Partial<UserPreference> = {
      stripeCustomerId: stripeCustomerId,
      stripeSubscriptionId: subscription.id,
      activeStripePriceId: priceId,
      stripeSubscriptionStatus: subscription.status,
      // Stripe returns current_period_end as a Unix timestamp (seconds)
      stripeSubscriptionCurrentPeriodEnd: subscription.current_period_end,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (userCreatedNewStripeCustomer || !userPrefDoc.exists) {
      subscriptionUpdateData.createdAt = FieldValue.serverTimestamp();
      subscriptionUpdateData.userId = userId;
      // Default notification preferences if creating the document
      subscriptionUpdateData.notifyOnNewConnectionRequest = true;
      subscriptionUpdateData.notifyOnConnectionAccepted = true;
      subscriptionUpdateData.notifyOnNewMessage = true;
      subscriptionUpdateData.notifyOnReply = true;
      subscriptionUpdateData.notifyOnMention = true;
      subscriptionUpdateData.notifyOnPlatformUpdates = true;
      subscriptionUpdateData.favoriteSectorCodes = userPrefData?.favoriteSectorCodes || [];
      subscriptionUpdateData.paymentMethods = userPrefData?.paymentMethods || [];
      await userPreferencesRef.set(subscriptionUpdateData);
      console.log(`[API Stripe Create/Update Subscription] Created userPreferences for ${userId} with subscription data.`);
    } else {
      await userPreferencesRef.update(subscriptionUpdateData);
      console.log(`[API Stripe Create/Update Subscription] Updated userPreferences for ${userId} with subscription data.`);
    }

    if (subscription.status === 'incomplete' && subscription.latest_invoice && typeof subscription.latest_invoice === 'object' && subscription.latest_invoice.payment_intent && typeof subscription.latest_invoice.payment_intent === 'object') {
      clientSecret = subscription.latest_invoice.payment_intent.client_secret;
    }

    return NextResponse.json({
      success: true,
      message: `${message} Status: ${subscription.status}.`,
      subscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      clientSecret: clientSecret,
    });

  } catch (error: any) {
    console.error('[API Stripe Create/Update Subscription] General Error in POST handler:', error);
    let errorMessage = 'Failed to process subscription.';
    let statusCode = 500;

    if (error instanceof Stripe.errors.StripeError) {
      console.error('[API Stripe Create/Update Subscription] Stripe Error:', error.code, error.message);
      errorMessage = error.message;
      if (error.statusCode) statusCode = error.statusCode;
    } else {
       console.error('[API Stripe Create/Update Subscription] Unknown error type:', error);
       errorMessage = error.message || 'An unexpected server error occurred.';
    }
    return NextResponse.json({ error: errorMessage, stripeErrorCode: error.code, details: error.message }, { status: statusCode });
  }
}
    