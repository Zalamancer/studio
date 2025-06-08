
// src/app/discover/page.tsx
"use client";

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { getRecentPlans } from '@/services/planService';
import type { ClientPlan } from '@/types/plan';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Loader2, AlertTriangle, Brain, MapPin, Layers } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

const DiscoverPage = () => {
  const { data: plans, isLoading, error } = useQuery<ClientPlan[], Error>({
    queryKey: ['recentPlans'],
    queryFn: () => getRecentPlans(12), // Fetch up to 12 recent plans
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const calculateNodeCounts = (plan: ClientPlan) => {
    const numNodes = plan.roadmap?.length || 0;
    const numSubNodes = plan.roadmap?.reduce((acc, step) => acc + (step.subSteps?.length || 0), 0) || 0;
    return { numNodes, numSubNodes };
  };

  return (
    <div className="container mx-auto p-4 md:p-6 min-h-screen">
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground flex items-center">
          <Brain className="mr-3 h-8 w-8 text-primary" />
          Discover Collaboration Plans
        </h1>
        <p className="text-lg text-muted-foreground mt-1">
          Explore recent collaboration plans created by the community.
        </p>
      </header>

      {isLoading && (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="ml-3 text-muted-foreground">Loading recent plans...</p>
        </div>
      )}

      {error && (
        <div className="text-destructive flex flex-col items-center gap-2 text-sm p-6 bg-destructive/5 rounded-md justify-center border border-destructive/20">
          <AlertTriangle className="h-8 w-8 flex-shrink-0" />
          <p className="font-semibold">Error Loading Plans</p>
          <p>{error.message || "An unexpected error occurred."}</p>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="mt-2">
            Try Again
          </Button>
        </div>
      )}

      {!isLoading && !error && plans && plans.length === 0 && (
        <div className="text-center py-10">
          <Layers className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium text-muted-foreground">No collaboration plans found yet.</p>
          <p className="text-sm text-muted-foreground mt-1">Be the first to create one!</p>
           <Button asChild className="mt-4">
            <Link href="/plan/create">Create a Plan</Link>
          </Button>
        </div>
      )}

      {!isLoading && !error && plans && plans.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const { numNodes, numSubNodes } = calculateNodeCounts(plan);
            return (
              <Card key={plan.id} className="flex flex-col shadow-md hover:shadow-lg transition-shadow duration-200 rounded-lg border-border">
                <CardHeader className="pb-3">
                  <Link href={`/plan/${plan.id}`} className="group">
                    <CardTitle className="text-lg font-semibold text-primary group-hover:underline line-clamp-2">
                      {plan.name}
                    </CardTitle>
                  </Link>
                  {plan.description && (
                    <CardDescription className="text-xs text-muted-foreground line-clamp-2 h-8">
                      {plan.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="flex-grow space-y-2 text-sm pt-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-primary/70" />
                      Sector:
                    </span>
                    <span className="font-medium text-foreground truncate">{plan.sector || 'N/A'}</span>
                  </div>
                   {plan.industry && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                           {/* Using Layers as a generic industry icon */}
                           <Layers className="h-3.5 w-3.5 text-primary/70" /> 
                            Industry:
                        </span>
                        <span className="font-medium text-foreground truncate">{plan.industry}</span>
                    </div>
                   )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-primary/70" />
                      Nodes:
                    </span>
                    <span className="font-medium text-foreground">{numNodes}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                     <span className="flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5 text-primary/70 opacity-70" />
                        Sub-nodes:
                     </span>
                    <span className="font-medium text-foreground">{numSubNodes}</span>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between items-center pt-3 border-t mt-auto">
                  <p className="text-xs text-muted-foreground">
                    Created: {formatDistanceToNow(new Date(plan.createdAt), { addSuffix: true })}
                  </p>
                  <Link
                    href={`/plan/${plan.id}`}
                    className={cn(buttonVariants({ variant: "outline", size: "xs" }), "h-7 px-2 text-xs")}
                  >
                    View Plan
                  </Link>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DiscoverPage;
