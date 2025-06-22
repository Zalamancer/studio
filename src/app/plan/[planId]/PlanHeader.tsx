// src/app/plan/[planId]/PlanHeader.tsx
"use client";

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { generateAnonymousName, getInitials } from '@/lib/pseudonymUtils';
import { ChevronLeft, History, Info, AlertTriangle, PlusCircle } from 'lucide-react';
import type { ClientPlan } from '@/types/plan';
import type { UserProfileBasic } from '@/types/connection';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PlanHeaderProps {
  planData: ClientPlan | null;
  ownerProfile: UserProfileBasic | null;
  isLoadingOwnerProfile: boolean;
  canEditPlan: boolean;
  onOpenHistory: () => void;
  onOpenInfo: () => void;
  onOpenPermissions: () => void; // New prop for permissions dialog
  diffTargetActive: boolean;
  activeViewers: UserProfileBasic[];
}

export const PlanHeader: React.FC<PlanHeaderProps> = ({
  planData,
  ownerProfile,
  isLoadingOwnerProfile,
  canEditPlan,
  onOpenHistory,
  onOpenInfo,
  onOpenPermissions, // New prop
  diffTargetActive,
  activeViewers,
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
          {activeViewers.length > 0 && (
            <div className="flex items-center -space-x-2">
              {activeViewers.slice(0, 3).map(viewer => (
                <TooltipProvider key={viewer.userId} delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Avatar className="h-7 w-7 border-2 border-background cursor-pointer">
                        <AvatarImage src={viewer.avatarUrl} alt={viewer.displayName} />
                        <AvatarFallback className="text-xs">{getInitials(viewer.displayName)}</AvatarFallback>
                      </Avatar>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{viewer.displayName} is viewing</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
              {activeViewers.length > 3 && (
                <div className="h-7 w-7 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-medium border-2 border-background z-10">
                  +{activeViewers.length - 3}
                </div>
              )}
            </div>
          )}

          {canEditPlan && (
            <Button variant="outline" size="icon" onClick={onOpenPermissions} className="h-8 w-8 ml-2" title="Manage Permissions">
              <PlusCircle className="h-4 w-4" />
              <span className="sr-only">Manage Permissions</span>
            </Button>
          )}

          <div className="h-6 w-px bg-border mx-1"></div>

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
        </div>
      </div>
    </div>
  );
};
PlanHeader.displayName = 'PlanHeader';
