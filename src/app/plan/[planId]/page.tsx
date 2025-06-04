
// src/app/plan/[planId]/page.tsx
"use client";

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getPlanById } from '@/services/planService';
import type { ClientPlan } from '@/types/plan';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, Brain, CalendarDays, Tag, Briefcase, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { generateAnonymousName } from '@/lib/pseudonymUtils';
import Link from 'next/link';
import { IS_VALID_FIREBASE_UID_REGEX } from '@/lib/utils';
import { Badge } from '@/components/ui/badge'; // Added import for Badge

const ViewPlanPage = () => {
  const params = useParams();
  const planId = params?.planId as string | undefined;
  const router = useRouter();
  const { user: currentUser, loading: authLoading } = useAuth();

  const isPlanIdValidUid = React.useMemo(() => {
    if (!planId) return false;
    return IS_VALID_FIREBASE_UID_REGEX.test(planId) || planId.length === 20; // Firestore IDs are typically 20 chars
  }, [planId]);

  const { data: plan, isLoading, error } = useQuery<ClientPlan | null, Error>({
    queryKey: ['plan', planId],
    queryFn: async () => {
      if (!planId || !isPlanIdValidUid) {
        console.warn(`[ViewPlanPage] Invalid planId '${planId}', aborting fetch.`);
        return null;
      }
      return getPlanById(planId);
    },
    enabled: !!planId && isPlanIdValidUid && !authLoading, // Fetch only if planId is valid and auth is resolved
  });

  if (authLoading || (isLoading && isPlanIdValidUid)) {
    return (
      <div className="container mx-auto p-4 md:p-8 flex justify-center items-center min-h-[calc(100vh-8rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!planId || !isPlanIdValidUid) {
     return (
      <div className="container mx-auto p-4 md:p-8 text-center">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <AlertTriangle className="mx-auto h-10 w-10 text-destructive mb-2" />
            <CardTitle>Invalid Plan ID</CardTitle>
            <CardDescription>The plan identifier in the URL is not valid.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/')}>Go to Homepage</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4 md:p-8 text-center">
        <Card className="max-w-md mx-auto">
          <CardHeader>
             <AlertTriangle className="mx-auto h-10 w-10 text-destructive mb-2" />
            <CardTitle>Error Loading Plan</CardTitle>
            <CardDescription>{error.message || "Could not load the collaboration plan."}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.back()}>Go Back</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isLoading && !plan) {
    return (
      <div className="container mx-auto p-4 md:p-8 text-center">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <Brain className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
            <CardTitle>Plan Not Found</CardTitle>
            <CardDescription>The collaboration plan you are looking for does not exist or you may not have permission to view it.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/')}>Go to Homepage</Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // If plan is still loading but we passed the initial isLoading check (e.g. due to auth state change)
  if (!plan) {
    return (
      <div className="container mx-auto p-4 md:p-8 flex justify-center items-center min-h-[calc(100vh-8rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }


  const isOwner = currentUser?.uid === plan.ownerId;
  const ownerDisplayName = generateAnonymousName(plan.ownerId); // In a real app, fetch this

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Card className="max-w-3xl mx-auto shadow-xl">
        <CardHeader className="bg-gradient-to-r from-primary/10 to-secondary/10 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Brain className="h-8 w-8 text-primary" />
              <div>
                <CardTitle className="text-2xl font-bold text-foreground">{plan.name}</CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  Collaboration Plan
                </CardDescription>
              </div>
            </div>
             {isOwner && <Badge variant="outline" className="text-xs">You are the owner</Badge>}
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div>
              <Label className="font-semibold text-foreground flex items-center gap-1.5"><User className="h-4 w-4 text-muted-foreground"/>Owner</Label>
              <Link href={`/profile/${plan.ownerId}`} className="block text-primary hover:underline truncate">
                {ownerDisplayName}
              </Link>
            </div>
            <div>
              <Label className="font-semibold text-foreground flex items-center gap-1.5"><CalendarDays className="h-4 w-4 text-muted-foreground"/>Created</Label>
              <p className="text-muted-foreground">{new Date(plan.createdAt).toLocaleDateString()}</p>
            </div>
            <div>
              <Label className="font-semibold text-foreground flex items-center gap-1.5"><Briefcase className="h-4 w-4 text-muted-foreground"/>Sector</Label>
              <p className="text-muted-foreground">{plan.sector}</p>
            </div>
            {plan.subSector && (
              <div>
                <Label className="font-semibold text-foreground">Sub-Sector</Label>
                <p className="text-muted-foreground">{plan.subSector}</p>
              </div>
            )}
            {plan.industry && (
              <div>
                <Label className="font-semibold text-foreground">Industry</Label>
                <p className="text-muted-foreground">{plan.industry}</p>
              </div>
            )}
            {plan.naicsCode && (
               <div>
                <Label className="font-semibold text-foreground flex items-center gap-1.5"><Tag className="h-4 w-4 text-muted-foreground"/>NAICS Code</Label>
                <p className="text-muted-foreground">{plan.naicsCode}</p>
              </div>
            )}
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-foreground mb-3">Collaboration Space</h3>
            <div className="p-6 bg-muted/50 rounded-md text-center">
              <p className="text-muted-foreground">
                Whiteboard functionality will be integrated here soon.
              </p>
              <Button variant="outline" className="mt-4" disabled>Coming Soon</Button>
            </div>
          </div>

        </CardContent>
      </Card>
    </div>
  );
};

export default ViewPlanPage;
