// src/components/messaging/AddMembersDialog.tsx
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, UserPlus, Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { getSuggestibleUsers } from '@/services/connectionService';
import type { UserProfileBasic } from '@/types/connection';
import { addMembersToGroup } from '@/services/messagingService';
import { getInitials, generateAnonymousName } from '@/lib/pseudonymUtils';
import type { ClientConversation } from '@/types/messaging';
import { cn } from '@/lib/utils';

const addMembersSchema = z.object({
  selectedMemberIds: z.array(z.string()).min(1, "Please select at least one member to add."),
});

type AddMembersFormData = z.infer<typeof addMembersSchema>;

interface AddMembersDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: ClientConversation;
  onMembersAdded: () => void;
}

export const AddMembersDialog: React.FC<AddMembersDialogProps> = ({
  isOpen,
  onOpenChange,
  conversation,
  onMembersAdded,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  const form = useForm<AddMembersFormData>({
    resolver: zodResolver(addMembersSchema),
    defaultValues: {
      selectedMemberIds: [],
    },
  });

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const { data: suggestibleUsers = [], isLoading: isLoadingUsers } = useQuery<UserProfileBasic[]>({
    queryKey: ['suggestibleUsersForAddMembers', debouncedSearchTerm, user?.uid, conversation.id],
    queryFn: () => user ? getSuggestibleUsers(debouncedSearchTerm, 20) : Promise.resolve([]),
    enabled: !!user && isOpen,
  });

  const availableUsersToInvite = useMemo(() => {
    // Filter out current group members and the current user
    return suggestibleUsers.filter(u => u.userId !== user?.uid && !conversation.participants.includes(u.userId));
  }, [suggestibleUsers, user?.uid, conversation.participants]);

  const onSubmit = async (data: AddMembersFormData) => {
    if (!user) {
      toast({ variant: "destructive", title: "Authentication Error", description: "You must be logged in." });
      return;
    }
    if (conversation.type !== 'group' || !conversation.adminIds.includes(user.uid)) {
      toast({ variant: "destructive", title: "Permission Denied", description: "Only group admins can add members." });
      return;
    }

    setIsSubmitting(true);
    try {
      await addMembersToGroup(conversation.id, user.uid, data.selectedMemberIds);
      toast({ title: "Members Added!", description: `${data.selectedMemberIds.length} member(s) added to the group.` });
      onMembersAdded();
      form.reset();
      onOpenChange(false);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Failed to Add Members", description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  useEffect(() => {
    if (!isOpen) {
      form.reset();
      setSearchTerm('');
      setDebouncedSearchTerm('');
    }
  }, [isOpen, form]);


  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md md:max-w-lg p-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-primary" />Add Members to "{conversation.groupName || 'Group'}"</DialogTitle>
          <DialogDescription>Search and select users to invite to this group chat.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>Select Users to Add <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Input
                  type="search"
                  placeholder="Search users by name or @mentionName..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                  disabled={isSubmitting}
                />
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
              <ScrollArea className="h-48 mt-2 rounded-md border p-2">
                {isLoadingUsers ? (
                  <div className="flex justify-center items-center h-full">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : availableUsersToInvite.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    {debouncedSearchTerm ? `No users found matching "${debouncedSearchTerm}" that are not already in the group.` : "No new users available to invite."}
                  </p>
                ) : (
                  <div className="space-y-1">
                    {availableUsersToInvite.map((member) => (
                      <Controller
                        key={member.userId}
                        name="selectedMemberIds"
                        control={form.control}
                        render={({ field }) => {
                          const isChecked = field.value?.includes(member.userId);
                          return (
                            <div
                              className={cn(
                                "flex items-center space-x-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors",
                                isChecked && "bg-muted"
                              )}
                            >
                              <Checkbox
                                id={`add-member-${member.userId}`}
                                checked={isChecked}
                                onCheckedChange={(checkedParam) => {
                                  const isNowChecked = typeof checkedParam === 'boolean' ? checkedParam : false;
                                  const currentSelectedIds = field.value || [];
                                  let newSelectedIds;
                                  if (isNowChecked) {
                                    newSelectedIds = [...currentSelectedIds, member.userId];
                                  } else {
                                    newSelectedIds = currentSelectedIds.filter((id) => id !== member.userId);
                                  }
                                  field.onChange(newSelectedIds);
                                }}
                                className="flex-shrink-0"
                                disabled={isSubmitting}
                                aria-label={`Select ${member.displayName || member.mentionName}`}
                              />
                              <Avatar className="h-7 w-7">
                                <AvatarImage src={member.avatarUrl} alt={member.displayName || member.mentionName} />
                                <AvatarFallback className="text-xs bg-secondary text-secondary-foreground">
                                  {getInitials(member.displayName || member.mentionName)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-grow min-w-0">
                                <Label htmlFor={`add-member-${member.userId}`} className="text-sm font-normal text-foreground truncate cursor-pointer">
                                  {member.displayName || member.mentionName || generateAnonymousName(member.userId)}
                                </Label>
                                {member.companyName && member.displayName !== member.companyName && (
                                  <p className="text-xs text-muted-foreground truncate">{member.companyName}</p>
                                )}
                              </div>
                            </div>
                          );
                        }}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
              {form.formState.errors.selectedMemberIds && (
                <p className="text-xs text-destructive">{form.formState.errors.selectedMemberIds.message}</p>
              )}
            </div>
          </div>
          <DialogFooter className="p-6 pt-4 border-t">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting || isLoadingUsers}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Add Members
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

