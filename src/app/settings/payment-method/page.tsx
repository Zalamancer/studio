
// src/app/settings/payment-method/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PlusCircle, CreditCard, Loader2, Trash2, AlertTriangle, Star } from 'lucide-react'; // Added Star
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
import { getUserPreferences, updateUserPreferences } from '@/services/userPreferenceService';
import type { SavedPaymentMethod, UserPreference, UpdateUserPreferencesData } from '@/types/userPreferences';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
let stripePromise: ReturnType<typeof loadStripe> | null = null;

if (stripePublishableKey) {
  stripePromise = loadStripe(stripePublishableKey);
} else {
  console.error("Stripe publishable key is not set in environment variables (NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY). Payment functionality will be disabled.");
}

const cardElementOptions = {
  style: {
    base: {
      fontSize: '16px',
      color: 'hsl(var(--foreground))',
      '::placeholder': {
        color: 'hsl(var(--muted-foreground))',
      },
      iconColor: 'hsl(var(--primary))',
    },
    invalid: {
      color: 'hsl(var(--destructive))',
      iconColor: 'hsl(var(--destructive))',
    },
  },
  classes: {
    base: 'stripe-element-base', // Custom class for base styling
    focus: 'stripe-element-focus', // Custom class for focus styling
    invalid: 'stripe-element-invalid', // Custom class for invalid state
    complete: 'stripe-element-complete', // Custom class for complete state
  }
};

const PaymentForm: React.FC<{ onPaymentMethodSaved: () => void; onCancel?: () => void }> = ({ onPaymentMethodSaved, onCancel }) => {
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

    if (!stripe || !elements) {
      setError("Stripe.js has not loaded yet.");
      setIsProcessing(false);
      return;
    }

    if (!user) {
      setError("User not authenticated. Please log in.");
      setIsProcessing(false);
      toast({ variant: "destructive", title: "Authentication Error", description: "You must be logged in to save a payment method."});
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
        email: user.email || undefined,
        name: user.displayName || undefined, // Include user's name if available
      },
    });

    if (stripeError) {
      console.error("Stripe error creating PaymentMethod:", stripeError);
      setError(stripeError.message || "An unexpected error occurred with Stripe.");
      setIsProcessing(false);
      return;
    }

    if (paymentMethod) {
      console.log("Client: PaymentMethod created:", paymentMethod);
      let responseBodyText = ""; 
      try {
        const idToken = await user.getIdToken();
        const response = await fetch('/api/stripe/save-payment-method', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
          },
          body: JSON.stringify({ paymentMethodId: paymentMethod.id, userId: user.uid }),
        });

        let result;
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          result = await response.json();
        } else {
          responseBodyText = await response.text();
          console.error("Received non-JSON response from server. Content type:", contentType);
          console.error("Response text (first 500 chars):", responseBodyText.substring(0, 500));
          throw new Error(`Server returned non-JSON response. Status: ${response.status}. Check server logs.`);
        }

        if (!response.ok) {
          const errorText = result.error || `Failed to save payment method. Server responded with status ${response.status}. Response: ${JSON.stringify(result).substring(0,200)}`;
          throw new Error(errorText);
        }

        toast({ title: "Success", description: result.message || "Payment method saved successfully!" });
        elements.getElement(CardNumberElement)?.clear();
        elements.getElement(CardExpiryElement)?.clear();
        elements.getElement(CardCvcElement)?.clear();
        onPaymentMethodSaved();
      } catch (backendError: any) {
        console.error("Backend error saving PaymentMethod:", backendError);
        let displayError = backendError.message || "Could not save payment method to your account.";
        if (responseBodyText && displayError.includes("non-JSON response")) {
          displayError += ` Server Response Preview: ${responseBodyText.substring(0,100)}...`;
        }
        setError(displayError);
        toast({ variant: "destructive", title: "Save Failed", description: displayError });
      }
    }
    setIsProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="cardNumber">Card Number</Label>
        <div className="p-3 border border-input rounded-md bg-background stripe-element-container">
          <CardNumberElement id="cardNumber" options={cardElementOptions} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="cardExpiry">Expiration Date</Label>
          <div className="p-3 border border-input rounded-md bg-background stripe-element-container">
            <CardExpiryElement id="cardExpiry" options={cardElementOptions} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cardCvc">CVC</Label>
          <div className="p-3 border border-input rounded-md bg-background stripe-element-container">
            <CardCvcElement id="cardCvc" options={cardElementOptions} />
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-col sm:flex-row gap-2 pt-2">
        <Button type="submit" disabled={!stripe || isProcessing} className="w-full sm:w-auto">
          {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
          Save Card
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isProcessing} className="w-full sm:w-auto">
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
};


const PaymentMethodSettingsPage = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);

  const { data: userPreferences, isLoading: isLoadingPreferences, refetch: refetchPreferences } = useQuery<UserPreference | null>({
    queryKey: ['userPreferences', user?.uid],
    queryFn: () => user ? getUserPreferences(user.uid) : Promise.resolve(null),
    enabled: !!user,
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: ({ userIdToUpdate, dataToUpdate }: { userIdToUpdate: string, dataToUpdate: UpdateUserPreferencesData }) => {
      return updateUserPreferences(userIdToUpdate, dataToUpdate);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userPreferences', user?.uid] });
      toast({ title: "Success", description: "Payment method settings updated." });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Update Failed", description: error.message });
    },
  });


  const handlePaymentMethodSaved = () => {
    setShowAddForm(false);
    refetchPreferences();
  };

  const handleRemovePaymentMethod = async (paymentMethodIdToRemove: string) => {
    if (!user || !userPreferences) return;
    const updatedPaymentMethods = (userPreferences.paymentMethods || []).filter(
      pm => pm.stripePaymentMethodId !== paymentMethodIdToRemove
    );
    // If the removed card was default, and there are other cards, make the first one default.
    const wasDefault = (userPreferences.paymentMethods || []).find(pm => pm.stripePaymentMethodId === paymentMethodIdToRemove)?.isDefault;
    if (wasDefault && updatedPaymentMethods.length > 0 && !updatedPaymentMethods.some(pm => pm.isDefault)) {
        updatedPaymentMethods[0].isDefault = true;
    }
    updatePreferencesMutation.mutate({
        userIdToUpdate: user.uid,
        dataToUpdate: { paymentMethods: updatedPaymentMethods }
    });
  };

  const handleSetDefault = async (paymentMethodIdToSetDefault: string) => {
     if (!user || !userPreferences) return;
     const updatedPaymentMethods = (userPreferences.paymentMethods || []).map(pm => ({
         ...pm,
         isDefault: pm.stripePaymentMethodId === paymentMethodIdToSetDefault,
     }));
     updatePreferencesMutation.mutate({
         userIdToUpdate: user.uid,
         dataToUpdate: { paymentMethods: updatedPaymentMethods }
     });
  };

  if (authLoading || (isLoadingPreferences && user)) {
    return (
      <Card className="shadow-md border-border">
        <CardHeader><CardTitle>Payment Method Settings</CardTitle></CardHeader>
        <CardContent className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-2 text-muted-foreground">Loading settings...</p>
        </CardContent>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card className="shadow-md border-border">
        <CardHeader><CardTitle>Access Denied</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground">Please log in to manage payment methods.</p></CardContent>
      </Card>
    );
  }

  if (!stripePublishableKey || !stripePromise) {
    return (
      <Card className="shadow-md border-border">
        <CardHeader>
          <CardTitle>Payment Settings Unavailable</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center text-center p-6 bg-destructive/10 border border-destructive/30 rounded-lg">
            <AlertTriangle className="h-10 w-10 text-destructive mb-3" />
            <p className="font-semibold text-destructive-foreground">Stripe configuration is missing.</p>
            <p className="text-sm text-muted-foreground mt-1">
              The Stripe publishable key is not set in the application environment.
              Please contact support or ensure your `.env.local` file is correctly configured
              with `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
            </p>
          </div>
        </CardContent>
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
          <div>
            <h3 className="text-lg font-medium mb-3 text-foreground">Saved Payment Methods</h3>
            {isLoadingPreferences ? (
                <div className="flex items-center justify-center p-4"> <Loader2 className="h-6 w-6 animate-spin"/> </div>
            ) : savedMethods.length > 0 ? (
              <div className="space-y-4">
                {savedMethods.map((method) => (
                  <Card key={method.stripePaymentMethodId} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between bg-muted/20 border rounded-lg gap-3 sm:gap-4">
                    <div className="flex items-center gap-3 flex-grow min-w-0">
                      <CreditCard className="h-7 w-7 text-primary flex-shrink-0" />
                      <div className="overflow-hidden">
                        <p className="font-medium text-foreground truncate">{method.brand} ending in {method.last4}</p>
                        <p className="text-xs text-muted-foreground">Expires {String(method.expMonth).padStart(2, '0')}/{method.expYear}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-center mt-2 sm:mt-0 flex-shrink-0">
                      {method.isDefault && (
                        <Badge variant="default" className="text-xs h-auto py-0.5 px-2 bg-primary/80">
                          <Star className="h-3 w-3 mr-1 fill-current" /> Default
                        </Badge>
                      )}
                      {!method.isDefault && (
                        <Button variant="outline" size="xs" onClick={() => handleSetDefault(method.stripePaymentMethodId)} disabled={updatePreferencesMutation.isPending}>
                          {updatePreferencesMutation.isPending && updatePreferencesMutation.variables?.dataToUpdate.paymentMethods?.find(pm => pm.stripePaymentMethodId === method.stripePaymentMethodId)?.isDefault ? <Loader2 className="h-3 w-3 animate-spin mr-1"/> : <Star className="h-3 w-3 mr-1"/>}
                          Set Default
                        </Button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="xs" className="text-destructive hover:text-destructive hover:bg-destructive/10" disabled={updatePreferencesMutation.isPending}>
                             <Trash2 className="h-3 w-3 sm:mr-1"/> <span className="hidden sm:inline">Remove</span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Payment Method?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to remove {method.brand} ending in {method.last4}?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel disabled={updatePreferencesMutation.isPending}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleRemovePaymentMethod(method.stripePaymentMethodId)}
                              className="bg-destructive hover:bg-destructive/90"
                              disabled={updatePreferencesMutation.isPending}
                            >
                             {updatePreferencesMutation.isPending && updatePreferencesMutation.variables?.dataToUpdate.paymentMethods?.every(pm => pm.stripePaymentMethodId !== method.stripePaymentMethodId) ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : null}
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              !showAddForm && (
                <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-md bg-muted/30">
                  You have no saved payment methods.
                </p>
              )
            )}
          </div>

          {showAddForm ? (
            <div className="pt-6 border-t mt-6">
              <h3 className="text-lg font-medium mb-4 text-foreground">Add New Card</h3>
              <PaymentForm
                onPaymentMethodSaved={handlePaymentMethodSaved}
                onCancel={() => setShowAddForm(false)}
              />
            </div>
          ) : (
            <div className="flex justify-start pt-4">
              <Button onClick={() => setShowAddForm(true)} variant="default">
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Payment Method
              </Button>
            </div>
          )}

          <p className="text-xs text-muted-foreground pt-4 border-t mt-6">
            Your payment information is handled securely by Stripe. We do not store your full card details on our servers.
          </p>
        </CardContent>
      </Card>
      <style jsx global>{`
        .stripe-element-container {
          // Base container styling
          // background-color: hsl(var(--input)); // Example: match input background
        }
        .stripe-element-base {
          // Style for the Stripe Element itself
        }
        .stripe-element-focus {
          // Style when the Stripe Element is focused
          // box-shadow: 0 0 0 2px hsl(var(--ring)); // Example: match focus ring
        }
        .stripe-element-invalid {
          // Style for invalid input in Stripe Element
          // border-color: hsl(var(--destructive));
        }
        .stripe-element-complete {
          // Style when input is considered complete by Stripe
        }
      `}</style>
    </Elements>
  );
};

export default PaymentMethodSettingsPage;
