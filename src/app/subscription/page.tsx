
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
} from "@/components/ui/alert-dialog";

// IMPORTANT: Replace these with your actual Stripe Price IDs
const STRIPE_PRICE_ID_BASIC = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_BASIC || 'price_1RV7QGECOZ6g59IdgnVnLOrP';
const STRIPE_PRICE_ID_PRO = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO || 'price_1RV7R8ECOZ6g59IdKXGKogOZ';
const STRIPE_PRICE_ID_ENTERPRISE = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_ENTERPRISE || 'price_1RV7RVECOZ6g59Idkhydnj0c';

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
    price: "$15", // Updated Price
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
    price: "$50", // Updated Price
    frequency: "/month", // Updated Frequency
    description: "Tailored solutions for large teams.",
    features: [
      "All Pro features",
      "Dedicated account manager",
      "Custom integrations",
      "Enhanced security options",
      "Team management tools",
    ],
    buttonText: "Get Enterprise", // Updated Button Text
    stripePriceId: STRIPE_PRICE_ID_ENTERPRISE,
  },
];

const SubscriptionPage = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [processingPlanId, setProcessingPlanId] = useState<string | null>(null);
  const [confirmingPlan, setConfirmingPlan] = useState<(typeof plans[0]) | null>(null);

  const { data: userPreferences, isLoading: isLoadingPreferences, error: preferencesError } = useQuery<UserPreference | null>({
    queryKey: ['userPreferences', user?.uid],
    queryFn: () => user ? getUserPreferences(user.uid) : Promise.resolve(null),
    enabled: !!user,
  });

  const activeSubscriptionPriceId = userPreferences?.activeStripePriceId;
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
      const response = await fetch('/api/stripe/create-subscription', {
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

  const handleOpenConfirmation = (plan: typeof plans[0]) => {
    if (plan.stripePriceId.startsWith('YOUR_STRIPE_PRICE_ID_')) {
        toast({
            variant: "destructive",
            title: "Configuration Needed",
            description: `Stripe Price ID for "${plan.name}" plan is not set. Please contact support or administrator.`,
            duration: 7000,
        });
        return;
    }
    setConfirmingPlan(plan);
  };

  const handleSubscribeConfirmed = () => {
    if (!confirmingPlan || !user) return;
    if (confirmingPlan.id !== 'basic' && confirmingPlan.id !== 'enterprise' && !hasDefaultPaymentMethod) {
      toast({ variant: "destructive", title: "Payment Method Required", description: (<span>Please add a default payment method in your <Link href="/settings/payment-method" className="underline text-primary hover:text-primary/80">payment settings</Link>.</span>), duration: 7000 });
      setConfirmingPlan(null);
      return;
    }
    setProcessingPlanId(confirmingPlan.id);
    createOrUpdateSubscriptionMutation.mutate(confirmingPlan.stripePriceId);
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
          const isPendingCancellation = activeSubscriptionPriceId === plan.stripePriceId && isEffectivelySubscribed && willCancelAtPeriodEnd;

          let buttonText = plan.buttonText;
          if (isCurrentActivePlan) {
            buttonText = "Current Plan";
          } else if (isPendingCancellation) {
            buttonText = "Re-activate Plan";
          } else if (activeSubscriptionPriceId && activeSubscriptionPriceId !== STRIPE_PRICE_ID_BASIC && plan.id === 'basic') {
             buttonText = "Downgrade to Basic";
          } else if (activeSubscriptionPriceId && plan.id !== 'basic' && plan.stripePriceId !== activeSubscriptionPriceId) {
             const currentPlanIndex = plans.findIndex(p => p.stripePriceId === activeSubscriptionPriceId);
             const targetPlanIndex = plans.findIndex(p => p.stripePriceId === plan.stripePriceId);
             if (currentPlanIndex > -1 && targetPlanIndex > -1) { 
                 if (targetPlanIndex > currentPlanIndex) buttonText = `Upgrade to ${plan.name}`;
                 else if (targetPlanIndex < currentPlanIndex) buttonText = `Downgrade to ${plan.name}`;
             }
          }

          if (!user && plan.id !== 'basic') return null; 

          return (
            <Card key={plan.id} className={cn("flex flex-col shadow-lg rounded-lg border", 
                isCurrentActivePlan ? 'border-primary ring-2 ring-primary' : 
                isPendingCancellation ? 'border-yellow-500 ring-2 ring-yellow-500 opacity-80' : 'border-border'
            )}>
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
                 <Button
                    className="w-full"
                    variant={(isCurrentActivePlan || isFreeBasicAndNoSub) ? 'outline' : 'default'}
                    disabled={isCurrentActivePlan || isFreeBasicAndNoSub || isProcessingThisPlan || !user || createOrUpdateSubscriptionMutation.isPending || (plan.id === 'enterprise' && plan.buttonText === 'Contact Sales') /* Disable direct sub for contact sales variant */}
                    onClick={() => {
                        if (plan.id === 'enterprise' && plan.buttonText === 'Contact Sales') {
                            window.location.href = 'mailto:sales@anonycollab.com?subject=Enterprise Plan Inquiry';
                        } else {
                            handleOpenConfirmation(plan);
                        }
                    }}
                  >
                    {isProcessingThisPlan ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {buttonText}
                  </Button>
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
       {user && (STRIPE_PRICE_ID_PRO.startsWith('YOUR_STRIPE_PRICE_ID_') || STRIPE_PRICE_ID_BASIC.startsWith('YOUR_STRIPE_PRICE_ID_') || STRIPE_PRICE_ID_ENTERPRISE.startsWith('YOUR_STRIPE_PRICE_ID_')) && (
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
              <AlertDialogTitle>Confirm Plan Change: {confirmingPlan.name}</AlertDialogTitle>
              <AlertDialogDescription>
                You are about to {activeSubscriptionPriceId && activeSubscriptionPriceId !== STRIPE_PRICE_ID_BASIC && activeSubscriptionPriceId !== confirmingPlan.stripePriceId ? (plans.findIndex(p => p.stripePriceId === confirmingPlan.stripePriceId) > plans.findIndex(p => p.stripePriceId === activeSubscriptionPriceId) ? 'upgrade' : 'downgrade') : 'subscribe'} to the <strong>{confirmingPlan.name}</strong> plan
                at <strong>{confirmingPlan.price}{confirmingPlan.frequency}</strong>.
                {confirmingPlan.id !== 'basic' && confirmingPlan.id !== 'enterprise' && ' Your default payment method will be charged.'}
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
    </div>
  );
};

export default SubscriptionPage;

