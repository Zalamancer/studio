
// src/app/api/stripe/save-payment-method/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import Stripe from 'stripe';
import { authAdmin as firebaseAuthAdmin } from '@/lib/firebase/auth-admin'; // Using Admin SDK for auth verification
import { dbAdmin as adminDb } from '@/lib/firebase/auth-admin'; // CORRECTED: Import dbAdmin and alias it as adminDb
import { FieldValue } from 'firebase-admin/firestore';

// Initialize Stripe with your secret key.
// IMPORTANT: Store your secret key in .env.local and DO NOT expose it on the client.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20', // Use the latest API version
});

export async function POST(request: NextRequest) {
  try {
    const { paymentMethodId, userId } = await request.json();

    if (!paymentMethodId || !userId) {
      return NextResponse.json({ error: 'Missing paymentMethodId or userId' }, { status: 400 });
    }

    // --- IMPORTANT: AUTHENTICATION & AUTHORIZATION ---
    // In a real production app, you MUST verify that the 'userId' making this request
    // is authorized to save a payment method for THEIR OWN account.
    // Typically, the client would send a Firebase ID token in the Authorization header.
    // Example:
    // const idToken = request.headers.get('Authorization')?.split('Bearer ')[1];
    // if (!idToken || !firebaseAuthAdmin) {
    //   console.error('[API Stripe Save] Unauthorized: Missing ID token or Firebase Admin Auth not initialized.');
    //   return NextResponse.json({ error: 'Unauthorized - Missing token or auth admin error' }, { status: 401 });
    // }
    // let decodedToken;
    // try {
    //   decodedToken = await firebaseAuthAdmin.verifyIdToken(idToken);
    // } catch (authError: any) {
    //   console.error('[API Stripe Save] Firebase Auth Error verifying ID token:', authError.message);
    //   return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    // }
    // // Ensure the UID from the token matches the userId in the request body
    // if (decodedToken.uid !== userId) {
    //   console.error(`[API Stripe Save] Forbidden: Token UID (${decodedToken.uid}) does not match request userId (${userId}).`);
    //   return NextResponse.json({ error: 'Forbidden - User ID mismatch' }, { status: 403 });
    // }
    // console.log(`[API Stripe Save] Request authorized for user: ${userId}`);
    // --- END OF AUTHENTICATION & AUTHORIZATION EXAMPLE ---


    if (!adminDb) {
        console.error('[API Stripe Save] Firestore Admin SDK (adminDb) is not initialized. Cannot access userPreferences.');
        return NextResponse.json({ error: 'Server configuration error - Firestore not available.' }, { status: 500 });
    }

    const userPreferencesRef = adminDb.collection('userPreferences').doc(userId);
    const userPrefDoc = await userPreferencesRef.get();
    let stripeCustomerId = userPrefDoc.exists ? userPrefDoc.data()?.stripeCustomerId : null;

    if (!stripeCustomerId) {
      // You might want to include user's email or name when creating the customer
      // Fetch email from Firebase Auth using admin.auth().getUser(userId) if needed
      const userAuthRecord = firebaseAuthAdmin ? await firebaseAuthAdmin.getUser(userId) : null;
      const customer = await stripe.customers.create({
        email: userAuthRecord?.email || undefined, // Use email from Auth if available
        name: userAuthRecord?.displayName || undefined, // Use displayName from Auth if available
        metadata: {
          firebaseUID: userId,
        },
      });
      stripeCustomerId = customer.id;
      await userPreferencesRef.set({ stripeCustomerId, userId, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      console.log(`[API Stripe Save] Created Stripe customer ${stripeCustomerId} for user ${userId}`);
    } else {
      console.log(`[API Stripe Save] Found existing Stripe customer ${stripeCustomerId} for user ${userId}`);
    }

    const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
      customer: stripeCustomerId,
    });

    // Optional: Set as default payment method for subscriptions
    // await stripe.customers.update(stripeCustomerId, {
    //   invoice_settings: {
    //     default_payment_method: paymentMethod.id,
    //   },
    // });

    const existingPaymentMethods = userPrefDoc.exists && Array.isArray(userPrefDoc.data()?.paymentMethods) ? userPrefDoc.data()?.paymentMethods : [];
    
    // Ensure all existing are not default before adding the new one as default
    const updatedPaymentMethodsNonDefault = existingPaymentMethods.map(pm => ({ ...pm, isDefault: false }));

    const newSavedPaymentMethod = {
      stripePaymentMethodId: paymentMethod.id,
      brand: paymentMethod.card?.brand || 'Unknown',
      last4: paymentMethod.card?.last4 || '0000',
      expMonth: paymentMethod.card?.exp_month || 0,
      expYear: paymentMethod.card?.exp_year || 0,
      isDefault: true, // Newest card is default
    };
    updatedPaymentMethodsNonDefault.push(newSavedPaymentMethod);

    await userPreferencesRef.update({
      paymentMethods: updatedPaymentMethodsNonDefault, // Save the array with the new default
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`[API Stripe Save] Payment method ${paymentMethodId} attached to customer ${stripeCustomerId} for user ${userId} and saved to Firestore.`);
    return NextResponse.json({
      success: true,
      message: 'Payment method saved successfully!',
      customerId: stripeCustomerId,
      savedPaymentMethod: newSavedPaymentMethod,
    });

  } catch (error: any) {
    console.error('[API Stripe Save] General Error:', error);
    let errorMessage = 'Failed to save payment method.';
    let statusCode = 500;

    if (error instanceof Stripe.errors.StripeError) {
        errorMessage = error.message;
        if (error.statusCode) {
            statusCode = error.statusCode;
        }
    } else if (error.message && error.message.includes('Firebase Admin SDK initialization error')) {
        errorMessage = 'Server configuration error. Please try again later.';
    } else if (error.message && error.message.includes('doesn\'t exist')) { // Catch specific Firestore "doesn't exist" if relevant
        errorMessage = 'User profile not found. Cannot save payment method.';
        statusCode = 404;
    }
    
    // Log the full error structure for better debugging on the server
    console.error('Full error object passed to client:', JSON.stringify(error, Object.getOwnPropertyNames(error)));

    return NextResponse.json({ error: errorMessage, stripeErrorCode: error.code }, { status: statusCode });
  }
}
