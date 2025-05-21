
// src/app/settings/payment-method/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PlusCircle, CreditCard, Loader2, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  loadStripe,
  type Stripe as StripeJs,
  type StripeElements as StripeElementsType,
  type StripeCardNumberElement
} from '@stripe/stripe-js';
import {
  Elements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { cn } from '@/lib/utils';
import { getUserPreferences, updateUserPreferences } from '@/services/userPreferenceService'; // Assuming this service handles updates
import type { SavedPaymentMethod, UserPreference } from '@/types/userPreferences';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

const cardElementOptions = {
  style: {
    base: {
      fontSize: '16px',
      color: 'hsl(var(--foreground))', // Use theme variable
      '::placeholder': {
        color: 'hsl(var(--muted-foreground))', // Use theme variable
      },
      iconColor: 'hsl(var(--primary))',
    },
    invalid: {
      color: 'hsl(var(--destructive))',
      iconColor: 'hsl(var(--destructive))',
    },
  },
  classes: {
    base: 'stripe-element-base', // Custom class for further global styling if needed
    focus: 'stripe-element-focus',
    invalid: 'stripe-element-invalid',
  }
};

const PaymentForm: React.FC<{ onPaymentMethodSaved: () => void }> = ({ onPaymentMethodSaved }) => {
  const stripe = useStripe();
  const elements = useElements();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsProcessing(true);
    setError(null);

    if (!stripe || !elements || !user) {
      setError("Stripe.js has not loaded yet, or user is not authenticated.");
      setIsProcessing(false);
      return;
    }

    const cardNumberElement = elements.getElement(CardNumberElement);
    if (!cardNumberElement) {
      setError("Card number element not found.");
      setIsProcessing(false);
      return;
    }

    const { error: stripeError, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardNumberElement,
      billing_details: {
        // name: user.displayName || undefined, // Optional: prefill user's name
        email: user.email || undefined, // Optional: prefill user's email
      },
    });

    if (stripeError) {
      console.error("Stripe error creating PaymentMethod:", stripeError);
      setError(stripeError.message || "An unexpected error occurred.");
      setIsProcessing(false);
      return;
    }

    if (paymentMethod) {
      console.log("Client: PaymentMethod created:", paymentMethod);
      try {
        const response = await fetch('/api/stripe/save-payment-method', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentMethodId: paymentMethod.id, userId: user.uid }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to save payment method to backend.');
        }

        toast({ title: "Success", description: "Payment method saved successfully!" });
        onPaymentMethodSaved(); // Callback to refetch preferences or update UI
        // Optionally clear card fields: elements.getElement(CardNumberElement)?.clear(); etc.
      } catch (backendError: any) {
        console.error("Backend error saving PaymentMethod:", backendError);
        setError(backendError.message || "Could not save payment method to your account.");
        toast({ variant: "destructive", title: "Save Failed", description: backendError.message || "Could not save payment method." });
      }
    }
    setIsProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="cardNumber">Card Number</Label>
        <div className="p-3 border rounded-md bg-background stripe-element-container">
          <CardNumberElement id="cardNumber" options={cardElementOptions} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="cardExpiry">Expiration Date</Label>
          <div className="p-3 border rounded-md bg-background stripe-element-container">
            <CardExpiryElement id="cardExpiry" options={cardElementOptions} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cardCvc">CVC</Label>
          <div className="p-3 border rounded-md bg-background stripe-element-container">
            <CardCvcElement id="cardCvc" options={cardElementOptions} />
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={!stripe || isProcessing} className="w-full sm:w-auto">
        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
        Save Card
      </Button>
    </form>
  );
};


const PaymentMethodSettingsPage = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);

  const { data: userPreferences, isLoading: isLoadingPreferences } = useQuery<UserPreference | null>({
    queryKey: ['userPreferences', user?.uid],
    queryFn: () => user ? getUserPreferences(user.uid) : Promise.resolve(null),
    enabled: !!user,
  });

  // TODO: Implement remove and set default mutations
  // const removePaymentMethodMutation = useMutation(...)
  // const setDefaultPaymentMethodMutation = useMutation(...)

  const handlePaymentMethodSaved = () => {
    setShowAddForm(false);
    queryClient.invalidateQueries({ queryKey: ['userPreferences', user?.uid] });
  };

  const handleRemovePaymentMethod = async (paymentMethodId: string) => {
    // Placeholder for actual removal logic
    toast({ title: "Placeholder", description: `Would remove payment method ${paymentMethodId}` });
    // In a real app, call a backend API to remove the payment method from Stripe
    // and then update userPreferences in Firestore.
    // e.g., await removeStripePaymentMethod(userId, paymentMethodId);
    // queryClient.invalidateQueries({ queryKey: ['userPreferences', user?.uid] });
  };

  const handleSetDefault = async (paymentMethodId: string) => {
    // Placeholder
    toast({ title: "Placeholder", description: `Would set ${paymentMethodId} as default` });
    // In a real app, call a backend API to set this as default in Stripe
    // and update userPreferences in Firestore.
    // e.g., await setDefaultStripePaymentMethod(userId, paymentMethodId);
    // queryClient.invalidateQueries({ queryKey: ['userPreferences', user?.uid] });
  };

  if (authLoading || (isLoadingPreferences && user)) {
    return (
      <Card className="shadow-md border-border">
        <CardHeader><CardTitle>Payment Method Settings</CardTitle></CardHeader>
        <CardContent className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card className="shadow-md border-border">
        <CardHeader><CardTitle>Access Denied</CardTitle></CardHeader>
        <CardContent><p>Please log in to manage payment methods.</p></CardContent>
      </Card>
    );
  }

  const savedMethods = userPreferences?.paymentMethods || [];

  return (
    <Elements stripe={stripePromise}>
      <Card className="shadow-md border-border">
        <CardHeader>
          <CardTitle>Payment Method Settings</CardTitle>
          <CardDescription>
            Manage your saved payment methods. Add, remove, or update your payment details here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            {savedMethods.length > 0 ? (
              savedMethods.map((method) => (
                <Card key={method.stripePaymentMethodId} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between bg-muted/30 gap-2">
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-6 w-6 text-primary flex-shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">{method.brand} ending in {method.last4}</p>
                      <p className="text-xs text-muted-foreground">Expires {String(method.expMonth).padStart(2, '0')}/{method.expYear}</p>
                    </div>
                    {method.isDefault && (
                      <span className="ml-2 text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full self-center sm:self-auto">
                        Default
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 self-end sm:self-center">
                    {!method.isDefault && (
                      <Button variant="outline" size="xs" onClick={() => handleSetDefault(method.stripePaymentMethodId)}>
                        Set as Default
                      </Button>
                    )}
                    <Button variant="ghost" size="xs" className="text-destructive hover:text-destructive" onClick={() => handleRemovePaymentMethod(method.stripePaymentMethodId)}>
                      Remove
                    </Button>
                  </div>
                </Card>
              ))
            ) : (
              !showAddForm && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  You have no saved payment methods.
                </p>
              )
            )}
          </div>

          {showAddForm ? (
            <div className="pt-6 border-t">
              <h3 className="text-lg font-medium mb-4">Add New Card</h3>
              <PaymentForm onPaymentMethodSaved={handlePaymentMethodSaved} />
              <Button variant="outline" size="sm" onClick={() => setShowAddForm(false)} className="mt-4">
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex justify-start">
              <Button onClick={() => setShowAddForm(true)}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Payment Method
              </Button>
            </div>
          )}

          <p className="text-xs text-muted-foreground pt-4">
            Your payment information is handled securely by Stripe. We do not store your full card details.
          </p>
        </CardContent>
      </Card>
      {/* Basic Stripe element styling (can be moved to globals.css or a specific CSS module) */}
      <style jsx global>{`
        .stripe-element-container {
          // Add any specific container styling if needed
        }
        .StripeElement {
          // Base styles for Stripe Elements
          background-color: transparent;
          padding: 10px 12px;
          border-radius: var(--radius); // Use theme radius
          // border: 1px solid hsl(var(--input)); // Use theme input border
          box-shadow: none;
          transition: border-color .15s ease-in-out,box-shadow .15s ease-in-out;
        }
        .StripeElement--focus {
          // box-shadow: 0 0 0 0.2rem hsl(var(--ring) / 0.25);
          // border-color: hsl(var(--ring));
        }
        .StripeElement--invalid {
          border-color: hsl(var(--destructive));
        }
      `}</style>
    </Elements>
  );
};

export default PaymentMethodSettingsPage;
