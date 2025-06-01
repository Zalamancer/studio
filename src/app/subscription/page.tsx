
// src/app/subscription/page.tsx
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2, AlertTriangle, Info, XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUserPreferences } from '@/services/userPreferenceService';
import type { UserPreference } from '@/types/userPreferences';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"; // Removed AlertDialogTrigger as it will be manually controlled

// IMPORTANT: Replace these with your actual Stripe Price IDs
const STRIPE_PRICE_ID_BASIC = 'price_1RV7QGECOZ6g59IdgnVnLOrP'; // Example for a free/default plan
const STRIPE_PRICE_ID_PRO = 'price_1RV7R8ECOZ6g59IdKXGKogOZ';
const STRIPE_PRICE_ID_ENTERPRISE = 'price_1RV7RVECOZ6g59Idkhydnj0c'; // Usually "Contact Sales" or a specific high-tier price

const plans = [
  {
    id: 'basic',
    name: "Basic",
    price: "$0",
    frequency: "/month",
    description: "Get started with essential features.",
    features: [
      "View posts",
      "Limited connections",
      "Basic messaging",
    ],
    buttonText: "Current Plan",
    stripePriceId: STRIPE_PRICE_ID_BASIC,
  },
  {
    id: 'pro',
    name: "Pro",
    price: "$15", // Example price
    frequency: "/month",
    description: "Unlock advanced features for collaboration.",
    features: [
      "All Basic features",
      "Unlimited connections",
      "Priority support",
      "Advanced search filters",
      "Detailed business profiles",
    ],
    buttonText: "Upgrade to Pro",
    stripePriceId: STRIPE_PRICE_ID_PRO,
  },
  {
    id: 'enterprise',
    name: "Enterprise",
    price: "Custom",
    frequency: "",
    description: "Tailored solutions for large teams.",
    features: [
      "All Pro features",
      "Dedicated account manager",
      "Custom integrations",
      "Enhanced security options",
      "Team management tools",
    ],
    buttonText: "Contact Sales",
    stripePriceId: STRIPE_PRICE_ID_ENTERPRISE, // Placeholder if contact sales
  },
];

const SubscriptionPage = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [processingPlanId, setProcessingPlanId] = useState<string | null>(null);
  const [confirmingPlan, setConfirmingPlan] = useState<(typeof plans[0]) | null>(null);
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);

  const { data: userPreferences, isLoading: isLoadingPreferences, error: preferencesError } = useQuery<UserPreference | null>({
    queryKey: ['userPreferences', user?.uid],
    queryFn: () => user ? getUserPreferences(user.uid) : Promise.resolve(null),
    enabled: !!user,
  });

  const activeSubscriptionPriceId = userPreferences?.activeStripePriceId;
  const currentActiveSubscriptionId = userPreferences?.stripeSubscriptionId;
  const currentSubscriptionStatus = userPreferences?.stripeSubscriptionStatus;
  const willCancelAtPeriodEnd = userPreferences?.stripeSubscriptionWillCancelAtPeriodEnd;

  const hasDefaultPaymentMethod = useMemo(() => {
    return userPreferences?.paymentMethods?.some(pm => pm.isDefault) ?? false;
  }, [userPreferences]);

  const createOrUpdateSubscriptionMutation = useMutation({
    mutationFn: async (priceId: string) => {
      if (!user) throw new Error("User not authenticated.");
      if (priceId !== STRIPE_PRICE_ID_BASIC && !hasDefaultPaymentMethod) {
         throw new Error("No default payment method set. Please add or set a default payment method in your settings.");
      }

      const idToken = await user.getIdToken();
      const response = await fetch('/api/stripe/create-subscription', { // Endpoint handles both create and update
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ userId: user.uid, priceId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Failed to process subscription (status: ${response.status})`);
      return result;
    },
    onSuccess: (data) => {
      toast({ title: "Subscription Processed!", description: data.message || `Subscription status: ${data.subscriptionStatus}` });
      queryClient.invalidateQueries({ queryKey: ['userPreferences', user?.uid] });
    },
    onError: (error: Error) => toast({ variant: "destructive", title: "Subscription Failed", description: error.message }),
    onSettled: () => {
        setProcessingPlanId(null);
        setConfirmingPlan(null);
    },
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
      toast({ title: "Subscription Cancellation", description: data.message || "Your subscription cancellation has been processed." });
      queryClient.invalidateQueries({ queryKey: ['userPreferences', user?.uid] });
    },
    onError: (error: Error) => toast({ variant: "destructive", title: "Cancellation Failed", description: error.message }),
    onSettled: () => {
      setProcessingPlanId(null);
      setShowCancelConfirmation(false);
    }
  });

  const handleOpenConfirmation = (plan: typeof plans[0]) => {
    setConfirmingPlan(plan);
  };

  const handleSubscribeConfirmed = () => {
    if (!confirmingPlan || !user) return;
    if (confirmingPlan.stripePriceId.startsWith('YOUR_STRIPE_PRICE_ID_') && confirmingPlan.id !== 'basic') {
      toast({ variant: "destructive", title: "Configuration Needed", description: `Stripe Price ID for plan "${confirmingPlan.name}" is not configured.` });
      setConfirmingPlan(null);
      return;
    }
    if (confirmingPlan.id !== 'basic' && !hasDefaultPaymentMethod) {
      toast({ variant: "destructive", title: "Payment Method Required", description: (<span>Please add a default payment method in your <Link href="/settings/payment-method" className="underline text-primary hover:text-primary/80">payment settings</Link>.</span>), duration: 7000 });
      setConfirmingPlan(null);
      return;
    }
    setProcessingPlanId(confirmingPlan.id);
    createOrUpdateSubscriptionMutation.mutate(confirmingPlan.stripePriceId);
  };

  const handleCancelSubscriptionConfirmed = () => {
    if (!currentActiveSubscriptionId) {
        toast({ variant: "destructive", title: "Error", description: "No active subscription ID found to cancel." });
        setShowCancelConfirmation(false);
        return;
    }
    setProcessingPlanId('cancel_current');
    cancelSubscriptionMutation.mutate(currentActiveSubscriptionId);
  };

  if (authLoading || (isLoadingPreferences && user)) {
    return <div className="container mx-auto p-8 flex justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
  }
  if (preferencesError) {
    return <div className="container mx-auto p-8 text-center text-destructive">Error loading preferences: {preferencesError.message}</div>;
  }

  const isEffectivelySubscribed = currentSubscriptionStatus === 'active' || currentSubscriptionStatus === 'trialing';

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">Choose Your Plan</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Select the subscription plan that best fits your collaboration needs.</p>
        {userPreferences?.stripeSubscriptionId && (
          <div className={cn("mt-4 p-3 rounded-md text-sm max-w-lg mx-auto",
            (currentSubscriptionStatus === 'active' || currentSubscriptionStatus === 'trialing') && !willCancelAtPeriodEnd && "bg-green-100 text-green-700 border border-green-200",
            (currentSubscriptionStatus === 'active' || currentSubscriptionStatus === 'trialing') && willCancelAtPeriodEnd && "bg-yellow-100 text-yellow-700 border border-yellow-200",
            (currentSubscriptionStatus === 'past_due' || currentSubscriptionStatus === 'unpaid') && "bg-red-100 text-red-700 border border-red-200",
            currentSubscriptionStatus === 'canceled' && "bg-gray-100 text-gray-700 border border-gray-200" // For fully canceled
          )}>
            Current Status: <strong className="font-semibold">{currentSubscriptionStatus?.replace('_', ' ')}</strong>
            {userPreferences.stripeSubscriptionCurrentPeriodEnd && (
              <span>
                {willCancelAtPeriodEnd
                  ? ` (Cancels on ${new Date(userPreferences.stripeSubscriptionCurrentPeriodEnd * 1000).toLocaleDateString()})`
                  : (currentSubscriptionStatus === 'active' || currentSubscriptionStatus === 'trialing')
                  ? ` (Renews on ${new Date(userPreferences.stripeSubscriptionCurrentPeriodEnd * 1000).toLocaleDateString()})`
                  : (currentSubscriptionStatus === 'canceled'
                    ? ` (Ended on ${new Date(userPreferences.stripeSubscriptionCurrentPeriodEnd * 1000).toLocaleDateString()})`
                    : ` (Valid until ${new Date(userPreferences.stripeSubscriptionCurrentPeriodEnd * 1000).toLocaleDateString()})`)
                }
              </span>
            )}
             {isEffectivelySubscribed && currentActiveSubscriptionId && userPreferences.activeStripePriceId !== STRIPE_PRICE_ID_BASIC && !willCancelAtPeriodEnd && (
              <Button 
                variant="link" 
                size="sm" 
                className="text-xs text-destructive hover:text-destructive/80 h-auto p-0 ml-2 align-baseline"
                onClick={() => setShowCancelConfirmation(true)}
                disabled={processingPlanId === 'cancel_current' || cancelSubscriptionMutation.isPending}
              >
                {processingPlanId === 'cancel_current' || cancelSubscriptionMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1"/> : <XCircle className="h-3 w-3 mr-1"/>}
                Cancel Subscription
              </Button>
            )}
          </div>
        )}
      </div>

      {!user && (
          <Card className="max-w-md mx-auto mb-8 p-4 text-center bg-muted/30 border-border">
              <Info className="mx-auto h-6 w-6 text-primary mb-2"/>
              <p className="font-medium text-foreground text-sm">Please Log In or Sign Up</p>
              <p className="text-xs text-muted-foreground mt-0.5">You need to be logged in to manage subscriptions.</p>
              <div className="mt-3 flex justify-center gap-2">
                  <Button asChild variant="default" size="xs"><Link href="/login">Log In</Link></Button>
                  <Button asChild variant="outline" size="xs"><Link href="/signup">Sign Up</Link></Button>
              </div>
          </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {plans.map((plan) => {
          const isCurrentActivePlan = activeSubscriptionPriceId === plan.stripePriceId && isEffectivelySubscribed && !willCancelAtPeriodEnd;
          const isProcessingThisPlan = processingPlanId === plan.id;
          const isFreeBasicAndNoSub = plan.id === 'basic' && (!isEffectivelySubscribed || activeSubscriptionPriceId === STRIPE_PRICE_ID_BASIC || willCancelAtPeriodEnd);


          let buttonText = plan.buttonText;
          if (isCurrentActivePlan) buttonText = "Current Plan";
          else if (activeSubscriptionPriceId && activeSubscriptionPriceId !== STRIPE_PRICE_ID_BASIC && plan.id === 'basic') {
             buttonText = "Downgrade to Basic";
          } else if (activeSubscriptionPriceId && plan.id !== 'basic' && plan.stripePriceId !== activeSubscriptionPriceId) {
             const currentPlanIndex = plans.findIndex(p => p.stripePriceId === activeSubscriptionPriceId);
             const targetPlanIndex = plans.findIndex(p => p.stripePriceId === plan.stripePriceId);
             if (targetPlanIndex > currentPlanIndex) buttonText = `Upgrade to ${plan.name}`;
             else if (targetPlanIndex < currentPlanIndex) buttonText = `Downgrade to ${plan.name}`;
          }


          if (!user && plan.id !== 'basic') return null; 

          return (
            <Card key={plan.id} className={cn("flex flex-col shadow-lg rounded-lg border", isCurrentActivePlan ? 'border-primary ring-2 ring-primary' : 'border-border')}>
              <CardHeader className="pb-4 bg-muted/30 rounded-t-lg">
                <CardTitle className="text-xl font-semibold text-foreground">{plan.name}</CardTitle>
                <CardDescription className="text-muted-foreground h-10">{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow pt-6">
                <div className="mb-6"><span className="text-4xl font-bold text-foreground">{plan.price}</span><span className="text-muted-foreground">{plan.frequency}</span></div>
                <ul className="space-y-3 text-sm">
                  {plan.features.map((feature, fIndex) => (
                    <li key={fIndex} className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" /><span className="text-muted-foreground">{feature}</span></li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                {plan.id === 'enterprise' ? (
                  <Button className="w-full" asChild><a href="mailto:sales@anonycollab.com?subject=Enterprise Plan Inquiry">Contact Sales</a></Button>
                ) : (
                  <Button
                    className="w-full"
                    variant={(isCurrentActivePlan || isFreeBasicAndNoSub) ? 'outline' : 'default'}
                    disabled={isCurrentActivePlan || isFreeBasicAndNoSub || isProcessingThisPlan || !user || createOrUpdateSubscriptionMutation.isPending || cancelSubscriptionMutation.isPending || willCancelAtPeriodEnd}
                    onClick={() => handleOpenConfirmation(plan)}
                  >
                    {isProcessingThisPlan ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {buttonText}
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>
      
      {user && !hasDefaultPaymentMethod && (!activeSubscriptionPriceId || activeSubscriptionPriceId === STRIPE_PRICE_ID_BASIC) && (
         <Card className="max-w-md mx-auto mt-8 p-3 text-center bg-yellow-50 border-yellow-200 shadow-sm">
           <Info className="mx-auto h-5 w-5 text-yellow-600 mb-1.5"/>
           <p className="font-medium text-yellow-700 text-xs">
             To subscribe to a paid plan, please{' '}
             <Link href="/settings/payment-method" className="underline hover:text-yellow-800 font-semibold">
               add a default payment method
             </Link>.
           </p>
         </Card>
       )}
       {user && (STRIPE_PRICE_ID_PRO.startsWith('YOUR_STRIPE_PRICE_ID_') || STRIPE_PRICE_ID_BASIC.startsWith('YOUR_STRIPE_PRICE_ID_')) && (
          <div className="mt-6 text-center p-3 bg-orange-100 border border-orange-200 rounded-md max-w-xl mx-auto">
            <AlertTriangle className="mx-auto h-5 w-5 text-orange-600 mb-1" />
            <p className="text-xs text-orange-700 font-medium">Developer Notice:</p>
            <p className="text-xs text-orange-600">
              Replace placeholder Stripe Price IDs in <code>src/app/subscription/page.tsx</code> with actual IDs from Stripe for subscriptions to work.
            </p>
          </div>
        )}

      {confirmingPlan && (
        <AlertDialog open={!!confirmingPlan} onOpenChange={(open) => !open && setConfirmingPlan(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Subscription: {confirmingPlan.name}</AlertDialogTitle>
              <AlertDialogDescription>
                You are about to {activeSubscriptionPriceId && activeSubscriptionPriceId !== STRIPE_PRICE_ID_BASIC && activeSubscriptionPriceId !== confirmingPlan.stripePriceId ? (plans.findIndex(p => p.stripePriceId === confirmingPlan.stripePriceId) > plans.findIndex(p => p.stripePriceId === activeSubscriptionPriceId) ? 'upgrade' : 'downgrade') : 'subscribe'} to the <strong>{confirmingPlan.name}</strong> plan
                at <strong>{confirmingPlan.price}{confirmingPlan.frequency}</strong>.
                {confirmingPlan.id !== 'basic' && ' Your default payment method will be charged.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirmingPlan(null)} disabled={createOrUpdateSubscriptionMutation.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleSubscribeConfirmed} disabled={createOrUpdateSubscriptionMutation.isPending}>
                {createOrUpdateSubscriptionMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {showCancelConfirmation && (
        <AlertDialog open={showCancelConfirmation} onOpenChange={setShowCancelConfirmation}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Cancel Subscription?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to cancel your current subscription?
                        It will remain active until the end of the current billing period
                        (<strong>{userPreferences?.stripeSubscriptionCurrentPeriodEnd ? new Date(userPreferences.stripeSubscriptionCurrentPeriodEnd * 1000).toLocaleDateString() : 'N/A'}</strong>).
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setShowCancelConfirmation(false)} disabled={cancelSubscriptionMutation.isPending}>Keep Subscription</AlertDialogCancel>
                    <AlertDialogAction 
                        onClick={handleCancelSubscriptionConfirmed} 
                        disabled={cancelSubscriptionMutation.isPending}
                        className="bg-destructive hover:bg-destructive/90"
                    >
                        {cancelSubscriptionMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                        Yes, Cancel at Period End
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
};

export default SubscriptionPage;
    