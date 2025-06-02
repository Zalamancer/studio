// src/components/messaging/GroupInfoSheet.tsx
"use client";

import React, { useState, useCallback } from 'react';
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
import { Loader2, Users, User, UserPlus, Edit, LogOut, ShieldCheck, ShieldAlert, ShieldQuestion, Trash2 } from 'lucide-react';
import type { ClientConversation } from '@/types/messaging';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchUserProfileBasic } from '@/services/connectionService';
import type { UserProfileBasic } from '@/types/connection';
import { getInitials, generateAnonymousName } from '@/lib/pseudonymUtils';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  removeMemberFromGroup,
  leaveGroup,
  promoteToAdmin,
  demoteAdmin,
  transferGroupOwnership,
} from '@/services/messagingService';
import { EditGroupDialog } from './EditGroupDialog';
import { AddMembersDialog } from './AddMembersDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle as AlertDialogPrimitiveTitle,
} from "@/components/ui/alert-dialog";

interface GroupInfoSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: ClientConversation | null;
  currentUserId: string | null;
}

const Skeleton: React.FC<{className?: string}> = ({ className }) => <div className={cn("bg-muted animate-pulse rounded", className)} />;

const MemberListItem: React.FC<{
  memberId: string;
  isOwner: boolean;
  isAdmin: boolean;
  isCurrentUserAdmin: boolean;
  isCurrentUserManager: boolean; // True if current user is owner OR admin and target is not owner
  isCurrentUserOwner: boolean;
  conversationId: string;
  onAction: () => void; // Callback to refetch group info
}> = ({ memberId, isOwner, isAdmin, isCurrentUserAdmin, isCurrentUserManager, isCurrentUserOwner, conversationId, onAction }) => {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState<string | null>(null); // 'remove', 'promote', 'demote', 'transfer'
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);

  const { data: memberProfile, isLoading } = useQuery<UserProfileBasic | null>({
    queryKey: ['userProfileBasic', memberId, 'groupInfoSheetMember'],
    queryFn: () => fetchUserProfileBasic(memberId),
    enabled: !!memberId,
    staleTime: Infinity,
  });

  const handleRemoveMember = async () => {
    if (!currentUser || !isCurrentUserManager || memberId === currentUser.uid || isOwner) return; // Owner check again for safety
    setIsProcessing('remove');
    try {
      await removeMemberFromGroup(conversationId, currentUser.uid, memberId);
      toast({ title: "Member Removed" });
      onAction();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error Removing Member", description: error.message });
    } finally {
      setIsProcessing(null);
    }
  };

  const handlePromote = async () => {
    if (!currentUser || !isCurrentUserOwner || isOwner || isAdmin) return;
    setIsProcessing('promote');
    try {
      await promoteToAdmin(conversationId, currentUser.uid, memberId);
      toast({ title: "Admin Promoted" });
      onAction();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error Promoting Admin", description: error.message });
    } finally {
      setIsProcessing(null);
    }
  };

  const handleDemote = async () => {
    if (!currentUser || !isCurrentUserOwner || isOwner || !isAdmin) return;
    setIsProcessing('demote');
    try {
      await demoteAdmin(conversationId, currentUser.uid, memberId);
      toast({ title: "Admin Demoted" });
      onAction();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error Demoting Admin", description: error.message });
    } finally {
      setIsProcessing(null);
    }
  };

  const handleTransferOwnership = async () => {
    if (!currentUser || !isCurrentUserOwner || isOwner) return;
    setIsProcessing('transfer');
    try {
      await transferGroupOwnership(conversationId, currentUser.uid, memberId);
      toast({ title: "Ownership Transferred", description: "You are now a regular admin." });
      onAction();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error Transferring Ownership", description: error.message });
    } finally {
      setIsProcessing(null);
      setShowTransferConfirm(false);
    }
  };

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
    <>
      <div className="flex items-center justify-between gap-3 p-2 hover:bg-muted/50 rounded-md group/memberitem">
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
        
        {isOwner && <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-semibold">Owner</span>}
        {isAdmin && !isOwner && <span className="px-1.5 py-0.5 rounded-full bg-primary/70 text-primary-foreground text-[10px] font-semibold">Admin</span>}

        {/* Management Actions */}
        {currentUser && currentUser.uid !== memberId && (
          <>
            {/* Only show remove button for non-admin members when current user is admin */}
            {isCurrentUserManager && !isOwner && !isAdmin && (
              <Button variant="ghost" size="icon" className="h-6 w-6 p-1 opacity-0 group-hover/memberitem:opacity-100 focus-visible:opacity-100 text-destructive hover:text-destructive" onClick={handleRemoveMember} disabled={!!isProcessing} title="Remove Member">
                {isProcessing === 'remove' ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Trash2 className="h-3.5 w-3.5"/>}
              </Button>
            )}
            
            {/* Admin management actions (only for owner) */}
            {isCurrentUserOwner && !isOwner && (
              <>
                {isAdmin ? (
                  <>
                    <Button variant="ghost" size="icon" className="h-6 w-6 p-1 opacity-0 group-hover/memberitem:opacity-100 focus-visible:opacity-100 text-orange-600 hover:text-orange-700" onClick={handleDemote} disabled={!!isProcessing} title="Demote Admin">
                      {isProcessing === 'demote' ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <ShieldAlert className="h-3.5 w-3.5"/>}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 p-1 opacity-0 group-hover/memberitem:opacity-100 focus-visible:opacity-100 text-purple-600 hover:text-purple-700" onClick={() => setShowTransferConfirm(true)} disabled={!!isProcessing} title="Transfer Ownership">
                      {isProcessing === 'transfer' ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <ShieldQuestion className="h-3.5 w-3.5"/>}
                    </Button>
                  </>
                ) : (
                  <Button variant="ghost" size="icon" className="h-6 w-6 p-1 opacity-0 group-hover/memberitem:opacity-100 focus-visible:opacity-100 text-green-600 hover:text-green-700" onClick={handlePromote} disabled={!!isProcessing} title="Promote to Admin">
                    {isProcessing === 'promote' ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <ShieldCheck className="h-3.5 w-3.5"/>}
                  </Button>
                )}
              </>
            )}
          </>
        )}
      </div>

      <AlertDialog open={showTransferConfirm} onOpenChange={setShowTransferConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogPrimitiveTitle>Transfer Group Ownership?</AlertDialogPrimitiveTitle>
            <AlertDialogDescription>
              Are you sure you want to transfer ownership to {memberProfile?.displayName || generateAnonymousName(memberId)}? 
              You will become a regular admin and no longer have owner privileges.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowTransferConfirm(false)} disabled={!!isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleTransferOwnership}
              disabled={!!isProcessing}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isProcessing === 'transfer' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Transfer Ownership
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};


export const GroupInfoSheet: React.FC<GroupInfoSheetProps> = ({ isOpen, onOpenChange, conversation, currentUserId }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditGroupOpen, setIsEditGroupOpen] = useState(false);
  const [isAddMembersOpen, setIsAddMembersOpen] = useState(false);
  const [isLeavingGroup, setIsLeavingGroup] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const handleGroupUpdated = useCallback(() => {
    if (conversation && user) {
      queryClient.invalidateQueries({ queryKey: ['conversations', user.uid] });
      queryClient.invalidateQueries({ queryKey: ['groupChatDetails', conversation.id, 'messagingHeader'] });
    }
  }, [conversation, user, queryClient]);

  const handleLeaveGroup = async () => {
    if (!user || !conversation) return;
    setIsLeavingGroup(true);
    try {
      await leaveGroup(conversation.id, user.uid);
      toast({ title: "Left Group", description: `You have left "${conversation.groupName || 'the group'}".` });
      onOpenChange(false); 
      queryClient.invalidateQueries({ queryKey: ['conversations', user?.uid] });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Failed to Leave Group", description: error.message });
    } finally {
      setIsLeavingGroup(false);
      setShowLeaveConfirm(false);
    }
  };

  if (!conversation || conversation.type !== 'group' || !currentUserId) {
    return null;
  }

  const groupName = conversation.groupName || 'Group Chat';
  const groupAvatar = conversation.groupAvatarUrl;
  const memberIds = conversation.participants || [];
  const ownerId = conversation.ownerId;
  const adminIds = conversation.adminIds || [];
  const isCurrentUserOwner = ownerId === currentUserId;
  const isCurrentUserAdmin = adminIds.includes(currentUserId);

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent className="w-[350px] sm:w-[400px] p-0 flex flex-col" side="right">
          <SheetHeader className="p-4 border-b space-y-1 text-left">
            <div className="flex items-center justify-between">
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
                {isCurrentUserAdmin && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsEditGroupOpen(true)} title="Edit Group">
                        <Edit className="h-4 w-4" />
                    </Button>
                )}
            </div>
          </SheetHeader>
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-1">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-muted-foreground">Members</h4>
                {isCurrentUserAdmin && (
                  <Button variant="outline" size="xs" onClick={() => setIsAddMembersOpen(true)} className="h-7">
                    <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Add
                  </Button>
                )}
              </div>
              {memberIds.length > 0 ? (
                memberIds.map(memberId => (
                  <MemberListItem
                    key={memberId}
                    memberId={memberId}
                    isOwner={memberId === ownerId}
                    isAdmin={adminIds.includes(memberId)}
                    isCurrentUserAdmin={isCurrentUserAdmin}
                    isCurrentUserOwner={isCurrentUserOwner}
                    isCurrentUserManager={isCurrentUserAdmin && memberId !== ownerId} // Admins can manage non-owners
                    conversationId={conversation.id}
                    onAction={handleGroupUpdated}
                  />
                ))
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">No members in this group.</p>
              )}
            </div>
          </ScrollArea>
          <SheetFooter className="p-4 border-t">
            <Button
              variant="destructive"
              size="sm"
              className="w-full"
              onClick={() => setShowLeaveConfirm(true)}
              disabled={isLeavingGroup}
            >
              {isLeavingGroup ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : <LogOut className="h-4 w-4 mr-2"/>}
              Leave Group
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {isCurrentUserAdmin && (
        <EditGroupDialog
          isOpen={isEditGroupOpen}
          onOpenChange={setIsEditGroupOpen}
          conversation={conversation}
          onGroupUpdated={handleGroupUpdated}
        />
      )}
      {isCurrentUserAdmin && (
        <AddMembersDialog
          isOpen={isAddMembersOpen}
          onOpenChange={setIsAddMembersOpen}
          conversation={conversation}
          onMembersAdded={handleGroupUpdated}
        />
      )}
      <AlertDialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogPrimitiveTitle>Leave Group "{groupName}"?</AlertDialogPrimitiveTitle>
            <AlertDialogDescription>
              Are you sure you want to leave this group?
              {isCurrentUserOwner && adminIds.length === 1 && memberIds.length > 1 && " You are the only admin; consider promoting another member before leaving or the group may become unmanageable by admins."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowLeaveConfirm(false)} disabled={isLeavingGroup}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLeaveGroup}
              disabled={isLeavingGroup || (isCurrentUserOwner && adminIds.length === 1 && memberIds.length > 1 && memberIds.length > 1)} // Prevent owner leaving if sole admin and others present
              className="bg-destructive hover:bg-destructive/80"
            >
              {isLeavingGroup ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Leave Group
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
