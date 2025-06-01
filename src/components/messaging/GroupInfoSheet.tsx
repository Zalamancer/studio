// src/components/messaging/GroupInfoSheet.tsx
"use client";

import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Users, User, Link as LinkIcon, AlertTriangle } from 'lucide-react';
import type { ClientConversation } from '@/types/messaging';
import { useQuery } from '@tanstack/react-query';
import { fetchUserProfileBasic } from '@/services/connectionService';
import type { UserProfileBasic } from '@/types/connection';
import { getInitials, generateAnonymousName } from '@/lib/pseudonymUtils';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface GroupInfoSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: ClientConversation | null;
  currentUserId: string | null;
}

const MemberListItem: React.FC<{ memberId: string; isOwner: boolean; isAdmin: boolean; }> = ({ memberId, isOwner, isAdmin }) => {
  const { data: memberProfile, isLoading } = useQuery<UserProfileBasic | null>({
    queryKey: ['userProfileBasic', memberId, 'groupInfoSheet'],
    queryFn: () => fetchUserProfileBasic(memberId),
    enabled: !!memberId,
    staleTime: Infinity,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 p-2">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="space-y-1">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-2 w-16" />
        </div>
      </div>
    );
  }

  if (!memberProfile) {
    return (
      <div className="flex items-center gap-3 p-2">
        <Avatar className="h-8 w-8"><AvatarFallback>?</AvatarFallback></Avatar>
        <span className="text-sm text-muted-foreground">User not found ({memberId.substring(0,6)}...)</span>
      </div>
    );
  }

  const displayName = memberProfile.displayName || generateAnonymousName(memberId);

  return (
    <div className="flex items-center justify-between gap-3 p-2 hover:bg-muted/50 rounded-md">
      <Link href={`/profile/${memberId}`} passHref className="flex items-center gap-3 flex-grow min-w-0">
        <Avatar className="h-8 w-8 cursor-pointer">
          <AvatarImage src={memberProfile.avatarUrl} alt={displayName} />
          <AvatarFallback className="text-xs bg-secondary text-secondary-foreground">
            {getInitials(displayName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-grow min-w-0">
          <p className="text-sm font-medium text-foreground truncate cursor-pointer hover:underline">{displayName}</p>
          {memberProfile.companyName && memberProfile.companyName.toLowerCase() !== displayName.toLowerCase() && (
            <p className="text-xs text-muted-foreground truncate">{memberProfile.companyName}</p>
          )}
        </div>
      </Link>
      <div className="flex-shrink-0 text-xs">
        {isOwner && <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-semibold">Owner</span>}
        {isAdmin && !isOwner && <span className="px-1.5 py-0.5 rounded-full bg-primary/70 text-primary-foreground text-[10px] font-semibold">Admin</span>}
      </div>
    </div>
  );
};

const Skeleton: React.FC<{className?: string}> = ({ className }) => <div className={cn("bg-muted animate-pulse rounded", className)} />;


export const GroupInfoSheet: React.FC<GroupInfoSheetProps> = ({ isOpen, onOpenChange, conversation, currentUserId }) => {
  if (!conversation || conversation.type !== 'group') {
    return null;
  }

  const groupName = conversation.groupName || 'Group Chat';
  const groupAvatar = conversation.groupAvatarUrl;
  const memberIds = conversation.participants || [];
  const ownerId = conversation.ownerId;
  const adminIds = conversation.adminIds || [];

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-[350px] sm:w-[400px] p-0 flex flex-col" side="right">
        <SheetHeader className="p-4 border-b space-y-1 text-left">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={groupAvatar} alt={groupName} />
              <AvatarFallback className="bg-secondary text-secondary-foreground">
                <Users className="h-5 w-5" />
              </AvatarFallback>
            </Avatar>
            <div>
                <SheetTitle className="text-lg">{groupName}</SheetTitle>
                <SheetDescription className="text-xs">{memberIds.length} {memberIds.length === 1 ? 'member' : 'members'}</SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground mb-1">Members</h4>
            {memberIds.length > 0 ? (
              memberIds.map(memberId => (
                <MemberListItem
                  key={memberId}
                  memberId={memberId}
                  isOwner={memberId === ownerId}
                  isAdmin={adminIds.includes(memberId)}
                />
              ))
            ) : (
              <p className="text-xs text-muted-foreground text-center py-4">No members in this group.</p>
            )}
          </div>
        </ScrollArea>
        <SheetFooter className="p-4 border-t">
           {/* Placeholder for future actions like "Add Member" or "Leave Group" */}
           <Button variant="outline" size="sm" disabled>Manage Group (Soon)</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
