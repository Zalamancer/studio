
// src/app/subscription/page.tsx
"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';

// Example subscription plans (replace with actual data)
const plans = [
  {
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
    isCurrent: true, // Example: Mark one as current
  },
  {
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
    isCurrent: false,
  },
  {
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
    isCurrent: false,
  },
];

const SubscriptionPage = () => {
  // Add logic here to fetch user's current subscription status if needed
  // const { user } = useAuth(); // Example if auth context is needed

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
          Choose Your Plan
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Select the subscription plan that best fits your business collaboration needs.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
        {plans.map((plan, index) => (
          <Card key={index} className={`flex flex-col shadow-lg rounded-lg border ${plan.isCurrent ? 'border-primary ring-2 ring-primary' : 'border-border'}`}>
            <CardHeader className="pb-4 bg-muted/30 rounded-t-lg">
              <CardTitle className="text-2xl font-semibold text-foreground">{plan.name}</CardTitle>
              <CardDescription className="text-muted-foreground h-10">{plan.description}</CardDescription> {/* Fixed height for alignment */}
            </CardHeader>
            <CardContent className="flex-grow pt-6">
              <div className="mb-6">
                <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                <span className="text-muted-foreground">{plan.frequency}</span>
              </div>
              <ul className="space-y-3 text-sm">
                {plan.features.map((feature, fIndex) => (
                  <li key={fIndex} className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                variant={plan.isCurrent ? 'outline' : 'default'}
                disabled={plan.isCurrent}
                // Add onClick handler for upgrades/contact
                onClick={() => console.log(`Selected plan: ${plan.name}`)}
              >
                {plan.buttonText}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default SubscriptionPage;
