
// src/app/api/stripe/save-payment-method/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import Stripe from 'stripe';
import { authAdmin as firebaseAuthAdmin } from '@/lib/firebase/auth-admin'; // Using Admin SDK for auth verification
import { dbAdmin } from '@/lib/firebase/auth-admin'; // Correct import for dbAdmin
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

    // Ensure the UID from the token matches the userId in the request body
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
      paymentMethods: updatedPaymentMethodsNonDefault,
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
    } else if (error.message && error.message.includes('doesn\'t exist')) { 
        errorMessage = 'User profile not found. Cannot save payment method.';
        statusCode = 404;
    }
    
    console.error('Full error object passed to client:', JSON.stringify(error, Object.getOwnPropertyNames(error)));

    return NextResponse.json({ error: errorMessage, stripeErrorCode: error.code }, { status: statusCode });
  }
}
