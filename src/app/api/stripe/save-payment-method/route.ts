
// src/app/api/stripe/save-payment-method/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import Stripe from 'stripe';
import { authAdmin as firebaseAuthAdmin } from '@/lib/firebase/auth-admin'; // Using Admin SDK for auth verification, aliased to avoid conflict
import { dbAdmin } from '@/lib/firebase/auth-admin'; // Using Admin SDK for Firestore
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

    // In a real app, you'd get the userId from an authenticated session.
    // For this example, we're trusting the userId passed from the client.
    // In production, VERIFY THE USER'S AUTHENTICATION (e.g., using Firebase Admin SDK with a token).
    // For example, if you pass Firebase ID token in Authorization header:
    // const idToken = request.headers.get('Authorization')?.split('Bearer ')[1];
    // if (!idToken || !firebaseAuthAdmin) { // Check if firebaseAuthAdmin is initialized
    //   return NextResponse.json({ error: 'Unauthorized - Missing token or auth admin not initialized' }, { status: 401 });
    // }
    // let decodedToken;
    // try {
    //   decodedToken = await firebaseAuthAdmin.verifyIdToken(idToken);
    // } catch (authError) {
    //   console.error('[API] Firebase Auth Error verifying ID token:', authError);
    //   return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    // }
    // const currentUserId = decodedToken.uid;
    // if (currentUserId !== userId) {
    //    return NextResponse.json({ error: 'User ID mismatch' }, { status: 403 });
    // }


    if (!dbAdmin) {
        console.error('[API] Firestore Admin SDK (dbAdmin) is not initialized. Cannot access userPreferences.');
        return NextResponse.json({ error: 'Server configuration error - Firestore not available.' }, { status: 500 });
    }
    
    const userPreferencesRef = dbAdmin.collection('userPreferences').doc(userId);
    const userPrefDoc = await userPreferencesRef.get();
    let stripeCustomerId = userPrefDoc.exists ? userPrefDoc.data()?.stripeCustomerId : null;

    // 1. Find or Create a Stripe Customer associated with your Firebase user
    if (!stripeCustomerId) {
      // You might want to include user's email or name when creating the customer
      const customer = await stripe.customers.create({
        // email: firebaseUser.email, // Get from Firebase Auth user record if available via Admin SDK after token verification
        // name: firebaseUser.displayName,
        metadata: {
          firebaseUID: userId,
        },
      });
      stripeCustomerId = customer.id;
      // Save the stripeCustomerId to your user's profile in Firestore
      await userPreferencesRef.set({ stripeCustomerId, userId, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }

    // 2. Attach the PaymentMethod to the Customer
    const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
      customer: stripeCustomerId,
    });

    // 3. (Optional) Set it as the default payment method for the customer's subscriptions/invoices
    // await stripe.customers.update(stripeCustomerId, {
    //   invoice_settings: {
    //     default_payment_method: paymentMethod.id,
    //   },
    // });

    // 4. Store non-sensitive payment method details in Firestore for display
    const newSavedPaymentMethod = {
      stripePaymentMethodId: paymentMethod.id,
      brand: paymentMethod.card?.brand || 'Unknown',
      last4: paymentMethod.card?.last4 || '0000',
      expMonth: paymentMethod.card?.exp_month || 0,
      expYear: paymentMethod.card?.exp_year || 0,
      isDefault: true, // Or logic to determine if this is the default
    };

    // Ensure paymentMethods array exists and update it
    await userPreferencesRef.update({
      paymentMethods: FieldValue.arrayUnion(newSavedPaymentMethod), // Add to array
      updatedAt: FieldValue.serverTimestamp(),
    });


    console.log(`[API] Payment method ${paymentMethodId} attached to customer ${stripeCustomerId} for user ${userId}`);
    return NextResponse.json({
      success: true,
      message: 'Payment method saved successfully!',
      customerId: stripeCustomerId,
      savedPaymentMethod: newSavedPaymentMethod,
    });

  } catch (error: any) {
    console.error('[API] Stripe Save Payment Method Error:', error);
    // Don't expose detailed Stripe errors to the client in production unless safe (like card errors)
    let errorMessage = 'Failed to save payment method.';
    let statusCode = 500;

    if (error instanceof Stripe.errors.StripeError) {
        errorMessage = error.message; // Card errors are often safe to display
        if (error.statusCode) {
            statusCode = error.statusCode;
        }
    } else if (error.message && error.message.includes('Firebase Admin SDK initialization error')) {
        errorMessage = 'Server configuration error. Please try again later.';
    }
    // Log the full error for server-side debugging
    // In a real production environment, you'd use a more sophisticated logging system.
    console.error('Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error)));

    return NextResponse.json({ error: errorMessage, stripeErrorCode: error.code }, { status: statusCode });
  }
}
