// src/components/messaging/EditGroupDialog.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
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
import { Loader2, Edit } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { updateGroupDetails } from '@/services/messagingService';
import type { ClientConversation } from '@/types/messaging';

const editGroupSchema = z.object({
  groupName: z.string().min(3, "Group name must be at least 3 characters.").max(50, "Group name cannot exceed 50 characters."),
  // groupAvatarUrl: z.string().url("Please enter a valid URL for the avatar.").optional().or(z.literal('')), // Placeholder for now
});

type EditGroupFormData = z.infer<typeof editGroupSchema>;

interface EditGroupDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: ClientConversation;
  onGroupUpdated: () => void;
}

export const EditGroupDialog: React.FC<EditGroupDialogProps> = ({
  isOpen,
  onOpenChange,
  conversation,
  onGroupUpdated,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<EditGroupFormData>({
    resolver: zodResolver(editGroupSchema),
    defaultValues: {
      groupName: conversation.groupName || '',
      // groupAvatarUrl: conversation.groupAvatarUrl || '',
    },
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({
        groupName: conversation.groupName || '',
        // groupAvatarUrl: conversation.groupAvatarUrl || '',
      });
    }
  }, [isOpen, conversation, form]);

  const onSubmit = async (data: EditGroupFormData) => {
    if (!user) {
      toast({ variant: "destructive", title: "Authentication Error", description: "You must be logged in." });
      return;
    }
    if (conversation.type !== 'group' || !conversation.adminIds.includes(user.uid)) {
      toast({ variant: "destructive", title: "Permission Denied", description: "Only group admins can edit details." });
      return;
    }

    setIsSubmitting(true);
    try {
      await updateGroupDetails(conversation.id, user.uid, {
        groupName: data.groupName,
        // groupAvatarUrl: data.groupAvatarUrl || null, // Send null if empty string
      });
      toast({ title: "Group Updated!", description: `Group "${data.groupName}" details saved.` });
      onGroupUpdated();
      onOpenChange(false);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Failed to Update Group", description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Edit className="h-5 w-5 text-primary" />Edit Group Details</DialogTitle>
          <DialogDescription>Update the name or avatar for your group.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="groupName">Group Name <span className="text-destructive">*</span></Label>
            <Input
              id="groupName"
              {...form.register('groupName')}
              placeholder="Enter new group name"
              disabled={isSubmitting}
            />
            {form.formState.errors.groupName && (
              <p className="text-xs text-destructive">{form.formState.errors.groupName.message}</p>
            )}
          </div>
          {/* Placeholder for avatar URL input - full upload is complex for now */}
          {/*
          <div className="space-y-2">
            <Label htmlFor="groupAvatarUrl">Group Avatar URL (Optional)</Label>
            <Input
              id="groupAvatarUrl"
              {...form.register('groupAvatarUrl')}
              placeholder="https://example.com/avatar.png"
              disabled={isSubmitting}
            />
            {form.formState.errors.groupAvatarUrl && (
              <p className="text-xs text-destructive">{form.formState.errors.groupAvatarUrl.message}</p>
            )}
          </div>
          */}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
