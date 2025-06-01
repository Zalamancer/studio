
// src/app/settings/payment-method/page.tsx
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PlusCircle, CreditCard, Loader2, Trash2, AlertTriangle, Star, CheckCircle, XCircle, Info } from 'lucide-react'; // Added Info icon
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
import Link from 'next/link'; // For linking to subscription page

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
let stripePromise: ReturnType<typeof loadStripe> | null = null;

if (stripePublishableKey) {
  stripePromise = loadStripe(stripePublishableKey);
} else {
  console.error("Stripe publishable key is not set in environment variables (NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY). Payment functionality will be disabled.");
}

// Define the plans array here
const STRIPE_PRICE_ID_BASIC = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_BASIC || 'YOUR_STRIPE_PRICE_ID_BASIC';
const STRIPE_PRICE_ID_PRO = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO || 'YOUR_STRIPE_PRICE_ID_PRO';
const STRIPE_PRICE_ID_ENTERPRISE = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_ENTERPRISE || 'YOUR_STRIPE_PRICE_ID_ENTERPRISE';

const plans = [
  {
    id: 'basic',
    name: "Basic",
    stripePriceId: STRIPE_PRICE_ID_BASIC,
  },
  {
    id: 'pro',
    name: "Pro",
    stripePriceId: STRIPE_PRICE_ID_PRO,
  },
  {
    id: 'enterprise',
    name: "Enterprise",
    stripePriceId: STRIPE_PRICE_ID_ENTERPRISE,
  },
];


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
    base: 'stripe-element-base',
    focus: 'stripe-element-focus',
    invalid: 'stripe-element-invalid',
    complete: 'stripe-element-complete',
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
        name: user.displayName || undefined,
      },
    });

    if (stripeError) {
      console.error("Stripe error creating PaymentMethod:", stripeError);
      setError(stripeError.message || "An unexpected error occurred with Stripe.");
      setIsProcessing(false);
      return;
    }

    if (paymentMethod) {
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
          throw new Error(`Server returned non-JSON response. Status: ${response.status}.`);
        }

        if (!response.ok) {
          const errorText = result.error || `Failed to save payment method. Server responded with status ${response.status}.`;
          throw new Error(errorText);
        }

        toast({ title: "Success", description: result.message || "Payment method saved successfully!" });
        elements.getElement(CardNumberElement)?.clear();
        elements.getElement(CardExpiryElement)?.clear();
        elements.getElement(CardCvcElement)?.clear();
        onPaymentMethodSaved();
      } catch (backendError: any) {
        let displayError = backendError.message || "Could not save payment method to your account.";
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
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  const [processingAction, setProcessingAction] = useState<string | null>(null); // 'cancel', 'setDefault', 'remove'

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
    onError: (error: Error) => toast({ variant: "destructive", title: "Update Failed", description: error.message }),
    onSettled: () => setProcessingAction(null),
  });

  const cancelSubscriptionMutation = useMutation({
    mutationFn: async (subscriptionIdToCancel: string) => {
      if (!user || !subscriptionIdToCancel) throw new Error("User or subscription ID missing.");
      const idToken = await user.getIdToken();
      const response = await fetch('/api/stripe/cancel-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ userId: user.uid, subscriptionId: subscriptionIdToCancel }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Failed to cancel subscription (status: ${response.status})`);
      return result;
    },
    onSuccess: (data) => {
      toast({ title: "Subscription Cancellation", description: data.message || "Your subscription is set to cancel at the end of the current period." });
      queryClient.invalidateQueries({ queryKey: ['userPreferences', user?.uid] });
    },
    onError: (error: Error) => toast({ variant: "destructive", title: "Cancellation Failed", description: error.message }),
    onSettled: () => {
      setProcessingAction(null);
      setShowCancelConfirmation(false);
    }
  });

  const handlePaymentMethodSaved = () => {
    setShowAddForm(false);
    refetchPreferences();
  };

  const handleRemovePaymentMethod = async (paymentMethodIdToRemove: string) => {
    if (!user || !userPreferences) return;
    setProcessingAction(`remove-${paymentMethodIdToRemove}`);
    let updatedPaymentMethods = (userPreferences.paymentMethods || []).filter(
      pm => pm.stripePaymentMethodId !== paymentMethodIdToRemove
    );
    const removedCardWasDefault = userPreferences.paymentMethods?.find(pm => pm.stripePaymentMethodId === paymentMethodIdToRemove)?.isDefault;
    if (removedCardWasDefault && updatedPaymentMethods.length > 0) {
      const isAnyDefaultRemaining = updatedPaymentMethods.some(pm => pm.isDefault);
      if (!isAnyDefaultRemaining) {
        updatedPaymentMethods = updatedPaymentMethods.map((pm, index) => ({ ...pm, isDefault: index === 0 }));
      }
    }
    updatePreferencesMutation.mutate({ userIdToUpdate: user.uid, dataToUpdate: { paymentMethods: updatedPaymentMethods } });
  };

  const handleSetDefault = async (paymentMethodIdToSetDefault: string) => {
     if (!user || !userPreferences) return;
     setProcessingAction(`setDefault-${paymentMethodIdToSetDefault}`);
     const updatedPaymentMethods = (userPreferences.paymentMethods || []).map(pm => ({
         ...pm, isDefault: pm.stripePaymentMethodId === paymentMethodIdToSetDefault,
     }));
     updatePreferencesMutation.mutate({ userIdToUpdate: user.uid, dataToUpdate: { paymentMethods: updatedPaymentMethods } });
  };

  const handleCancelSubscriptionConfirmed = () => {
    if (!userPreferences?.stripeSubscriptionId) {
        toast({ variant: "destructive", title: "Error", description: "No active subscription ID found." });
        return;
    }
    setProcessingAction('cancel');
    cancelSubscriptionMutation.mutate(userPreferences.stripeSubscriptionId);
  };

  if (authLoading || (isLoadingPreferences && user)) {
    return (
      <Card className="shadow-md border-border">
        <CardHeader><CardTitle>Payment & Subscription</CardTitle></CardHeader>
        <CardContent className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Loading settings...</p>
        </CardContent>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card className="shadow-md border-border">
        <CardHeader><CardTitle>Access Denied</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground">Please log in to manage payment methods and subscriptions.</p></CardContent>
      </Card>
    );
  }

  if (!stripePromise && stripePublishableKey) { // Only show if key was intended to be there
    return (
        <Card className="shadow-md border-border">
            <CardHeader><CardTitle>Payment Settings Unavailable</CardTitle></CardHeader>
            <CardContent>
                <div className="flex flex-col items-center justify-center text-center p-6 bg-destructive/10 border border-destructive/30 rounded-lg">
                    <AlertTriangle className="h-10 w-10 text-destructive mb-3" />
                    <p className="font-semibold text-destructive-foreground">Stripe.js failed to load.</p>
                    <p className="text-sm text-muted-foreground mt-1">Please check your internet connection or browser console for errors.</p>
                </div>
            </CardContent>
        </Card>
    );
  }


  const savedMethods = userPreferences?.paymentMethods || [];
  const currentSub = userPreferences;
  const isSubscribedToPaidPlan = currentSub?.stripeSubscriptionId && currentSub?.activeStripePriceId !== STRIPE_PRICE_ID_BASIC;


  return (
    <Elements stripe={stripePromise}>
      <Card className="shadow-md border-border">
        <CardHeader>
          <CardTitle>Payment & Subscription</CardTitle>
          <CardDescription>Manage payment methods and your current subscription plan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Subscription Management Section */}
          <div>
            <h3 className="text-lg font-medium mb-4 text-foreground">Your Subscription</h3>
            {isLoadingPreferences ? (
                <div className="flex items-center justify-center p-4"> <Loader2 className="h-6 w-6 animate-spin"/> </div>
            ) : currentSub && currentSub.stripeSubscriptionId ? (
                <div className="p-4 border rounded-lg bg-muted/30 space-y-2">
                    <p className="text-sm">
                        <strong className="text-foreground">Current Plan:</strong> {plans.find(p => p.stripePriceId === currentSub.activeStripePriceId)?.name || currentSub.activeStripePriceId || 'Unknown'}
                    </p>
                    <p className="text-sm">
                        <strong className="text-foreground">Status:</strong> <span className={cn(currentSub.stripeSubscriptionStatus === 'active' && !currentSub.stripeSubscriptionWillCancelAtPeriodEnd && "text-green-600", currentSub.stripeSubscriptionStatus === 'active' && currentSub.stripeSubscriptionWillCancelAtPeriodEnd && "text-yellow-600")}>{currentSub.stripeSubscriptionStatus?.replace('_', ' ')}</span>
                        {currentSub.stripeSubscriptionWillCancelAtPeriodEnd && currentSub.stripeSubscriptionCurrentPeriodEnd && (
                            <span className="text-yellow-600"> (Cancels on {new Date(currentSub.stripeSubscriptionCurrentPeriodEnd * 1000).toLocaleDateString()})</span>
                        )}
                        {!currentSub.stripeSubscriptionWillCancelAtPeriodEnd && currentSub.stripeSubscriptionStatus === 'active' && currentSub.stripeSubscriptionCurrentPeriodEnd &&(
                            <span className="text-muted-foreground"> (Renews on {new Date(currentSub.stripeSubscriptionCurrentPeriodEnd * 1000).toLocaleDateString()})</span>
                        )}
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2 pt-2">
                        <Button variant="outline" size="sm" asChild>
                            <Link href="/subscription">Change Plan</Link>
                        </Button>
                        {isSubscribedToPaidPlan && !currentSub.stripeSubscriptionWillCancelAtPeriodEnd && (
                            <Button variant="destructive" size="sm" onClick={() => setShowCancelConfirmation(true)} disabled={processingAction === 'cancel' || cancelSubscriptionMutation.isPending}>
                                {processingAction === 'cancel' || cancelSubscriptionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5"/> : <XCircle className="h-4 w-4 mr-1.5"/>}
                                Cancel Subscription
                            </Button>
                        )}
                    </div>
                </div>
            ) : (
                <div className="p-4 border rounded-lg bg-muted/30 text-center">
                    <p className="text-sm text-muted-foreground">You are currently on the Basic (Free) plan.</p>
                    <Button variant="link" asChild className="text-sm p-0 h-auto mt-1"><Link href="/subscription">View Plans & Upgrade</Link></Button>
                </div>
            )}
          </div>

          <hr className="border-border" />

          {/* Payment Methods Section */}
          <div>
            <h3 className="text-lg font-medium mb-4 text-foreground">Saved Payment Methods</h3>
            {isLoadingPreferences ? (
                <div className="flex items-center justify-center p-4"> <Loader2 className="h-6 w-6 animate-spin"/> </div>
            ) : savedMethods.length > 0 ? (
              <div className="space-y-4">
                {savedMethods.map((method) => (
                  <div key={method.stripePaymentMethodId} className="border rounded-lg p-4 shadow-sm bg-card hover:shadow-md transition-shadow">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div className="w-full sm:w-auto sm:max-w-xs flex-shrink-0 bg-gradient-to-br from-primary/80 to-primary/60 text-primary-foreground p-4 rounded-md shadow-lg aspect-[1.586/1] flex flex-col justify-between">
                        <div className="flex justify-between items-start"><p className="font-semibold text-sm opacity-90">{method.brand.toUpperCase()}</p><div className="h-6 w-8 bg-gray-300/50 rounded-sm"></div></div>
                        <div className="mt-auto"><p className="text-lg tracking-wider font-mono opacity-90">•••• •••• •••• {method.last4}</p><div className="flex justify-between text-xs opacity-80 mt-1"><span>EXPIRES</span><span>{String(method.expMonth).padStart(2, '0')}/{String(method.expYear).slice(-2)}</span></div></div>
                      </div>
                      <div className="flex flex-col items-start sm:items-end gap-2 mt-3 sm:mt-0 flex-grow">
                        {method.isDefault ? (
                          <div className="inline-flex items-center gap-1.5 text-sm font-medium text-green-600 bg-green-100 px-2.5 py-1 rounded-full"><CheckCircle className="h-4 w-4" /> Default</div>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => handleSetDefault(method.stripePaymentMethodId)} disabled={processingAction === `setDefault-${method.stripePaymentMethodId}` || updatePreferencesMutation.isPending}>
                            {processingAction === `setDefault-${method.stripePaymentMethodId}` ? <Loader2 className="h-4 w-4 animate-spin mr-1.5"/> : <Star className="h-4 w-4 mr-1.5"/>}Set as Default
                          </Button>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" disabled={processingAction === `remove-${method.stripePaymentMethodId}` || updatePreferencesMutation.isPending}><Trash2 className="h-4 w-4 mr-1.5"/>Remove Card</Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Remove Payment Method?</AlertDialogTitle><AlertDialogDescription>Are you sure you want to remove {method.brand} ending in {method.last4}?</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel disabled={processingAction === `remove-${method.stripePaymentMethodId}`}>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleRemovePaymentMethod(method.stripePaymentMethodId)} className="bg-destructive hover:bg-destructive/90" disabled={processingAction === `remove-${method.stripePaymentMethodId}`}>{processingAction === `remove-${method.stripePaymentMethodId}` ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : null}Remove</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              !showAddForm && (<p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-md bg-muted/30">You have no saved payment methods.</p>)
            )}
          </div>

          {showAddForm ? (
            <div className="pt-6 border-t mt-6">
              <h3 className="text-lg font-medium mb-4 text-foreground">Add New Card</h3>
              <PaymentForm onPaymentMethodSaved={handlePaymentMethodSaved} onCancel={() => setShowAddForm(false)} />
            </div>
          ) : (
            <div className="flex justify-start pt-4">
              <Button onClick={() => setShowAddForm(true)} variant="default"><PlusCircle className="mr-2 h-4 w-4" /> Add New Payment Method</Button>
            </div>
          )}

          <p className="text-xs text-muted-foreground pt-4 border-t mt-6">
            Your payment information is handled securely by Stripe. We do not store your full card details on our servers.
          </p>
        </CardContent>
      </Card>

      {/* Cancel Subscription Confirmation Dialog */}
      {showCancelConfirmation && userPreferences?.stripeSubscriptionId && (
        <AlertDialog open={showCancelConfirmation} onOpenChange={setShowCancelConfirmation}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Cancel Subscription?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to cancel your current plan?
                        It will remain active until the end of the current billing period
                        ({userPreferences.stripeSubscriptionCurrentPeriodEnd ? new Date(userPreferences.stripeSubscriptionCurrentPeriodEnd * 1000).toLocaleDateString() : 'N/A'}).
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setShowCancelConfirmation(false)} disabled={processingAction === 'cancel'}>Keep Subscription</AlertDialogCancel>
                    <AlertDialogAction onClick={handleCancelSubscriptionConfirmed} disabled={processingAction === 'cancel'} className="bg-destructive hover:bg-destructive/90">
                        {processingAction === 'cancel' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                        Yes, Cancel at Period End
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      )}

      <style jsx global>{`.stripe-element-container{/* styles as needed */} .stripe-element-base{} .stripe-element-focus{} .stripe-element-invalid{} .stripe-element-complete{}`}</style>
    </Elements>
  );
};

export default PaymentMethodSettingsPage;
