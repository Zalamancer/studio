
// src/app/plan/[planId]/PlanHeader.tsx
"use client";

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { generateAnonymousName } from '@/lib/pseudonymUtils';
import { ChevronLeft, Save, History, Info, PlusCircle, AlertTriangle } from 'lucide-react';
import type { ClientPlan } from '@/types/plan';
import type { UserProfileBasic } from '@/types/connection';
import { cn } from '@/lib/utils';

interface PlanHeaderProps {
  planData: ClientPlan | null;
  ownerProfile: UserProfileBasic | null;
  isLoadingOwnerProfile: boolean;
  canEditPlan: boolean;
  onSavePlan: () => void;
  isSavingPlan: boolean;
  onOpenHistory: () => void;
  onOpenInfo: () => void;
  onInitiateAddNode: () => void;
  diffTargetActive: boolean;
}

export const PlanHeader: React.FC<PlanHeaderProps> = ({
  planData,
  ownerProfile,
  isLoadingOwnerProfile,
  canEditPlan,
  onSavePlan,
  isSavingPlan,
  onOpenHistory,
  onOpenInfo,
  onInitiateAddNode,
  diffTargetActive,
}) => {
  const router = useRouter();

  return (
    <div className="border-b bg-card sticky top-0 z-30 h-16 flex-shrink-0">
      <div className="container mx-auto px-4 max-w-screen-2xl h-full flex items-center justify-between">
        {/* Back Button and Plan Title/Owner */}
        <div className="flex items-center gap-2 flex-grow min-w-0">
          <Button variant="ghost" size="icon" onClick={() => router.push('/discover')} className="h-8 w-8 flex-shrink-0">
            <ChevronLeft className="h-5 w-5" />
            <span className="sr-only">Back to Discover</span>
          </Button>
          <div className="flex-grow min-w-0">
            <h1 className="text-md md:text-lg font-semibold truncate" title={planData?.name}>
              {planData?.name || 'Loading Plan...'}
            </h1>
            {ownerProfile && (
              <p className="text-xs text-muted-foreground truncate">
                By: <Link href={`/profile/${ownerProfile.userId}`} className="hover:underline">{ownerProfile.displayName || generateAnonymousName(ownerProfile.userId)}</Link>
              </p>
            )}
            {isLoadingOwnerProfile && !ownerProfile && <p className="text-xs text-muted-foreground">Loading owner...</p>}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          {planData && canEditPlan && !diffTargetActive && (
            <Button onClick={onSavePlan} size="sm" className="h-8 px-2 text-xs sm:h-9 sm:px-3 sm:text-sm" disabled={isSavingPlan}>
              <Save className="mr-1 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" /> {isSavingPlan ? 'Saving...' : 'Save Plan'}
            </Button>
          )}
          {diffTargetActive && (
            <Button variant="destructive" size="sm" onClick={onOpenHistory} className="h-8 px-2 text-xs sm:h-9 sm:px-3 sm:text-sm">
              <AlertTriangle className="mr-1 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" /> Exit Diff
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onOpenHistory} className="h-8 px-2 text-xs sm:h-9 sm:px-3 sm:text-sm">
            <History className="mr-1 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">History</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenInfo}
            className="h-8 px-2 text-xs sm:h-9 sm:px-3 sm:text-sm"
          >
            <Info className="mr-1 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" /> Info
          </Button>
          {planData && canEditPlan && !diffTargetActive && (
            <Button variant="default" size="sm" onClick={onInitiateAddNode} className="h-8 px-2 text-xs sm:h-9 sm:px-3 sm:text-sm">
              <PlusCircle className="mr-1 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Add Step</span><span className="sm:hidden">Add</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
PlanHeader.displayName = 'PlanHeader';
