
// src/app/subscription/page.tsx
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2, AlertTriangle, Info } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUserPreferences } from '@/services/userPreferenceService';
import type { UserPreference } from '@/types/userPreferences';
import Link from 'next/link'; // Added for linking to payment settings
import { cn } from '@/lib/utils';

// IMPORTANT: Replace these with your actual Stripe Price IDs
const STRIPE_PRICE_ID_BASIC = 'YOUR_STRIPE_PRICE_ID_BASIC'; // e.g., price_1Pxxxxxxx...
const STRIPE_PRICE_ID_PRO = 'YOUR_STRIPE_PRICE_ID_PRO';
const STRIPE_PRICE_ID_ENTERPRISE = 'YOUR_STRIPE_PRICE_ID_ENTERPRISE'; // Usually handled via "Contact Sales"

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
    stripePriceId: STRIPE_PRICE_ID_BASIC, // Assign your actual Price ID
  },
  {
    id: 'pro',
    name: "Pro",
    price: "$15",
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
    stripePriceId: STRIPE_PRICE_ID_PRO, // Assign your actual Price ID
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
    stripePriceId: STRIPE_PRICE_ID_ENTERPRISE, // May not be applicable if "Contact Sales"
  },
];

const SubscriptionPage = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isProcessingSubscription, setIsProcessingSubscription] = useState<string | null>(null); // Store plan ID being processed

  const { data: userPreferences, isLoading: isLoadingPreferences, error: preferencesError } = useQuery<UserPreference | null>({
    queryKey: ['userPreferences', user?.uid],
    queryFn: () => user ? getUserPreferences(user.uid) : Promise.resolve(null),
    enabled: !!user,
  });

  const activeSubscriptionPriceId = userPreferences?.activeStripePriceId;
  const hasDefaultPaymentMethod = useMemo(() => {
    return userPreferences?.paymentMethods?.some(pm => pm.isDefault) ?? false;
  }, [userPreferences]);

  const createSubscriptionMutation = useMutation({
    mutationFn: async (priceId: string) => {
      if (!user) throw new Error("User not authenticated.");
      if (!userPreferences?.stripeCustomerId) throw new Error("Stripe customer ID not found.");
      if (!hasDefaultPaymentMethod) throw new Error("No default payment method set. Please add or set a default payment method in your settings.");

      const idToken = await user.getIdToken();
      const response = await fetch('/api/stripe/create-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ userId: user.uid, priceId }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || `Failed to create subscription (status: ${response.status})`);
      }
      return result;
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Subscription Successful!",
        description: data.message || `You are now subscribed. Status: ${data.subscriptionStatus}`,
      });
      queryClient.invalidateQueries({ queryKey: ['userPreferences', user?.uid] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Subscription Failed",
        description: error.message,
      });
    },
    onSettled: () => {
      setIsProcessingSubscription(null);
    }
  });

  const handleSubscribe = (planId: string, stripePriceId: string) => {
    if (!user) {
      toast({ variant: "destructive", title: "Not Logged In", description: "Please log in to subscribe." });
      return;
    }
    if (!hasDefaultPaymentMethod) {
      toast({
        variant: "destructive",
        title: "Payment Method Required",
        description: (
          <span>
            Please add a default payment method in your{' '}
            <Link href="/settings/payment-method" className="underline text-primary hover:text-primary/80">
              payment settings
            </Link>
            {' '}before subscribing.
          </span>
        ),
        duration: 7000,
      });
      return;
    }
    if (stripePriceId.startsWith('YOUR_STRIPE_PRICE_ID_')) {
      toast({
        variant: "destructive",
        title: "Configuration Needed",
        description: `Stripe Price ID for plan "${planId}" is not configured. Please contact support or check application setup.`,
        duration: 7000,
      });
      return;
    }

    setIsProcessingSubscription(planId);
    createSubscriptionMutation.mutate(stripePriceId);
  };

  if (authLoading || (isLoadingPreferences && user)) {
    return (
      <div className="container mx-auto p-4 md:p-8 flex justify-center items-center min-h-[300px]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (preferencesError) {
      return (
          <div className="container mx-auto p-4 md:p-8 text-center">
              <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
              <p className="text-lg font-semibold text-destructive">Error Loading Preferences</p>
              <p className="text-muted-foreground mt-2">{preferencesError.message}</p>
              <p className="text-xs text-muted-foreground mt-1">Please try refreshing the page.</p>
          </div>
      );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
          Choose Your Plan
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Select the subscription plan that best fits your business collaboration needs.
        </p>
        {userPreferences?.stripeSubscriptionStatus && (
          <div className={cn("mt-4 p-3 rounded-md text-sm",
            userPreferences.stripeSubscriptionStatus === 'active' && "bg-green-100 text-green-700 border border-green-200",
            userPreferences.stripeSubscriptionStatus === 'trialing' && "bg-blue-100 text-blue-700 border border-blue-200",
            (userPreferences.stripeSubscriptionStatus === 'past_due' || userPreferences.stripeSubscriptionStatus === 'unpaid') && "bg-red-100 text-red-700 border border-red-200",
            userPreferences.stripeSubscriptionStatus === 'canceled' && "bg-yellow-100 text-yellow-700 border border-yellow-200"
          )}>
            Current Status: <strong className="font-semibold">{userPreferences.stripeSubscriptionStatus.replace('_', ' ')}</strong>
            {userPreferences.stripeSubscriptionCurrentPeriodEnd && (
              <span>
                {userPreferences.stripeSubscriptionStatus === 'active' || userPreferences.stripeSubscriptionStatus === 'trialing' ? ' until ' : ' ended on '}
                {new Date(userPreferences.stripeSubscriptionCurrentPeriodEnd * 1000).toLocaleDateString()}
              </span>
            )}
          </div>
        )}
      </div>

      {!user && (
          <Card className="max-w-2xl mx-auto mb-8 p-6 text-center bg-muted/30 border-border shadow-sm">
              <Info className="mx-auto h-8 w-8 text-primary mb-3"/>
              <p className="font-medium text-foreground">Please Log In or Sign Up</p>
              <p className="text-sm text-muted-foreground mt-1">
                  You need to be logged in to manage your subscriptions.
              </p>
              <div className="mt-4 flex justify-center gap-3">
                  <Button asChild variant="default" size="sm"><Link href="/login">Log In</Link></Button>
                  <Button asChild variant="outline" size="sm"><Link href="/signup">Sign Up</Link></Button>
              </div>
          </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {plans.map((plan) => {
          const isCurrentPlan = activeSubscriptionPriceId === plan.stripePriceId;
          const isProcessingThisPlan = isProcessingSubscription === plan.id;

          if (!user && plan.id !== 'basic') return null; // Show only basic plan if not logged in

          return (
            <Card
              key={plan.id}
              className={cn(
                "flex flex-col shadow-lg rounded-lg border",
                isCurrentPlan ? 'border-primary ring-2 ring-primary' : 'border-border'
              )}
            >
              <CardHeader className="pb-4 bg-muted/30 rounded-t-lg">
                <CardTitle className="text-xl font-semibold text-foreground">{plan.name}</CardTitle>
                <CardDescription className="text-muted-foreground h-10">{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow pt-6">
                <div className="mb-6">
                  <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.frequency}</span>
                </div>
                <ul className="space-y-3 text-sm">
                  {plan.features.map((feature, fIndex) => (
                    <li key={fIndex} className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                {plan.id === 'enterprise' ? (
                  <Button className="w-full" asChild>
                    <a href="mailto:sales@anonycollab.com?subject=Enterprise Plan Inquiry">Contact Sales</a>
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    variant={isCurrentPlan ? 'outline' : 'default'}
                    disabled={isCurrentPlan || isProcessingThisPlan || !user}
                    onClick={() => handleSubscribe(plan.id, plan.stripePriceId)}
                  >
                    {isProcessingThisPlan ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    {isCurrentPlan ? "Current Plan" : plan.buttonText}
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>
       {!user && (
          <p className="text-center text-xs text-muted-foreground mt-8">
            Basic plan is free. Log in or sign up to explore premium features.
          </p>
       )}
       {user && !hasDefaultPaymentMethod && !plans.find(p => p.stripePriceId === activeSubscriptionPriceId && p.price === "$0") && (
         <Card className="max-w-2xl mx-auto mt-8 p-4 text-center bg-yellow-50 border-yellow-200 shadow-sm">
           <Info className="mx-auto h-6 w-6 text-yellow-600 mb-2"/>
           <p className="font-medium text-yellow-700 text-sm">
             To subscribe to a paid plan, please{' '}
             <Link href="/settings/payment-method" className="underline hover:text-yellow-800 font-semibold">
               add a default payment method
             </Link>
             {' '}to your account.
           </p>
         </Card>
       )}
       {user && STRIPE_PRICE_ID_BASIC.startsWith('YOUR_STRIPE_PRICE_ID_') && (
          <div className="mt-8 text-center p-4 bg-orange-100 border border-orange-200 rounded-md max-w-2xl mx-auto">
            <AlertTriangle className="mx-auto h-6 w-6 text-orange-600 mb-2" />
            <p className="text-sm text-orange-700 font-medium">Developer Notice:</p>
            <p className="text-xs text-orange-600">
              Please replace placeholder Stripe Price IDs (e.g., <code>YOUR_STRIPE_PRICE_ID_PRO</code>) in <code>src/app/subscription/page.tsx</code> with your actual Price IDs from your Stripe dashboard for subscriptions to work.
            </p>
          </div>
        )}

    </div>
  );
};

export default SubscriptionPage;
