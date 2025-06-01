
// src/app/api/stripe/save-payment-method/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import Stripe from 'stripe';
import { authAdmin as firebaseAuthAdmin, dbAdmin } from '@/lib/firebase/auth-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { SavedPaymentMethod } from '@/types/userPreferences'; // Import the type

export const runtime = 'nodejs';

// Initialize Stripe with your secret key.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20',
});

export async function POST(request: NextRequest) {
  console.log('[API Stripe Save] Received POST request.');
  try {
    const { paymentMethodId, userId } = await request.json();
    console.log(`[API Stripe Save] Parsed request body - paymentMethodId: ${paymentMethodId}, userId: ${userId}`);

    if (!paymentMethodId || !userId) {
      console.error('[API Stripe Save] Error: Missing paymentMethodId or userId in request.');
      return NextResponse.json({ error: 'Missing paymentMethodId or userId' }, { status: 400 });
    }

    // --- AUTHENTICATION & AUTHORIZATION ---
    const idToken = request.headers.get('Authorization')?.split('Bearer ')[1];
    if (!idToken) {
      console.error('[API Stripe Save] Unauthorized: Missing ID token.');
      return NextResponse.json({ error: 'Unauthorized - Missing token' }, { status: 401 });
    }
    if (!firebaseAuthAdmin) {
        console.error('[API Stripe Save] Firebase Admin Auth not initialized on server.');
        return NextResponse.json({ error: 'Server configuration error - Auth admin not available.' }, { status: 500 });
    }

    let decodedToken;
    try {
      decodedToken = await firebaseAuthAdmin.verifyIdToken(idToken);
    } catch (authError: any) {
      console.error('[API Stripe Save] Firebase Auth Error verifying ID token:', authError.message);
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    if (decodedToken.uid !== userId) {
      console.error(`[API Stripe Save] Forbidden: Token UID (${decodedToken.uid}) does not match request userId (${userId}).`);
      return NextResponse.json({ error: 'Forbidden - User ID mismatch' }, { status: 403 });
    }
    console.log(`[API Stripe Save] Request authorized for user: ${userId}`);
    // --- END OF AUTHENTICATION & AUTHORIZATION ---


    if (!dbAdmin) {
        console.error('[API Stripe Save] Firestore Admin SDK (dbAdmin) is not initialized. Cannot access userPreferences.');
        return NextResponse.json({ error: 'Server configuration error - Firestore not available.' }, { status: 500 });
    }

    const userPreferencesRef = dbAdmin.collection('userPreferences').doc(userId);
    const userPrefDoc = await userPreferencesRef.get();
    let stripeCustomerId = userPrefDoc.exists ? userPrefDoc.data()?.stripeCustomerId : null;
    let userCreatedNewStripeCustomer = false;

    if (!stripeCustomerId) {
      const userAuthRecord = await firebaseAuthAdmin.getUser(userId);
      const customer = await stripe.customers.create({
        email: userAuthRecord?.email || undefined,
        name: userAuthRecord?.displayName || undefined,
        metadata: {
          firebaseUID: userId,
        },
      });
      stripeCustomerId = customer.id;
      userCreatedNewStripeCustomer = true;
      console.log(`[API Stripe Save] Created Stripe customer ${stripeCustomerId} for user ${userId}`);
    } else {
      console.log(`[API Stripe Save] Found existing Stripe customer ${stripeCustomerId} for user ${userId}`);
    }

    const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
      customer: stripeCustomerId,
    });
    console.log(`[API Stripe Save] Stripe PaymentMethod pm_id: ${paymentMethod.id} attached to customer: ${stripeCustomerId}`);

    const existingPaymentMethodsRaw = userPrefDoc.exists ? userPrefDoc.data()?.paymentMethods : [];
    console.log(`[API Stripe Save] DEBUG: Fetched existingPaymentMethodsRaw from Firestore:`, JSON.stringify(existingPaymentMethodsRaw));
    const existingPaymentMethods: SavedPaymentMethod[] = Array.isArray(existingPaymentMethodsRaw) ? existingPaymentMethodsRaw : [];
    console.log(`[API Stripe Save] DEBUG: Parsed existingPaymentMethods (ensure it's an array):`, JSON.stringify(existingPaymentMethods));
    
    const updatedPaymentMethodsNonDefault = existingPaymentMethods.map((pm: SavedPaymentMethod) => ({
      ...pm,
      isDefault: false,
    }));

    const newSavedPaymentMethod: SavedPaymentMethod = {
      stripePaymentMethodId: paymentMethod.id,
      brand: paymentMethod.card?.brand || 'Unknown',
      last4: paymentMethod.card?.last4 || '0000',
      expMonth: paymentMethod.card?.exp_month || 0,
      expYear: paymentMethod.card?.exp_year || 0,
      isDefault: true, 
    };
    updatedPaymentMethodsNonDefault.push(newSavedPaymentMethod);
    console.log(`[API Stripe Save] DEBUG: Array of payment methods to be saved to Firestore:`, JSON.stringify(updatedPaymentMethodsNonDefault, null, 2));
    
    const dataToSet: any = {
      paymentMethods: updatedPaymentMethodsNonDefault,
      stripeCustomerId: stripeCustomerId, // Ensure stripeCustomerId is always included
      updatedAt: FieldValue.serverTimestamp(),
      userId: userId, // Include userId, especially if creating the doc for the first time (rules might need it)
    };

    if (userCreatedNewStripeCustomer || !userPrefDoc.exists()) {
        dataToSet.createdAt = FieldValue.serverTimestamp(); // Add createdAt if new doc or new customer was created
        console.log(`[API Stripe Save] Adding 'createdAt' field because it's a new document or new Stripe customer.`);
    }

    console.log(`[API Stripe Save] Attempting to SET Firestore userPreferences for user ${userId} with dataToSet:`, JSON.stringify(dataToSet, null, 2));
    await userPreferencesRef.set(dataToSet, { merge: true }); // Use set with merge:true
    console.log(`[API Stripe Save] Firestore userPreferences document for user ${userId} created/updated successfully.`);

    return NextResponse.json({
      success: true,
      message: 'Payment method saved successfully!',
      customerId: stripeCustomerId,
      savedPaymentMethod: newSavedPaymentMethod,
    });

  } catch (error: any) {
    console.error('[API Stripe Save] General Error in POST handler:', error);
    let errorMessage = 'Failed to save payment method.';
    let statusCode = 500;

    if (error instanceof Stripe.errors.StripeError) {
        console.error('[API Stripe Save] Stripe Error:', error.code, error.message);
        errorMessage = error.message;
        if (error.statusCode) {
            statusCode = error.statusCode;
        }
    } else if (error.code && (String(error.code).startsWith('firestore/') || String(error.code).startsWith('functions/'))) {
        console.error(`[API Stripe Save] Firebase specific error: Code: ${error.code}, Message: ${error.message}`);
        errorMessage = `Failed to update payment preferences: ${error.message}`;
    } else if (error.message && error.message.includes('Firebase Admin SDK initialization error')) {
        console.error('[API Stripe Save] Firebase Admin SDK init error detected.');
        errorMessage = 'Server configuration error. Please try again later.';
    } else {
        console.error('[API Stripe Save] Unknown error structure:', error);
    }
    
    console.error('Full error object passed to client:', JSON.stringify(error, Object.getOwnPropertyNames(error)));

    return NextResponse.json({ error: errorMessage, stripeErrorCode: error.code, details: error.message }, { status: statusCode });
  }
}
    
    