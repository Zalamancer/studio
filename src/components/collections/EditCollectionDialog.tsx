
// src/components/collections/EditCollectionDialog.tsx
"use client";

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateCollectionDetails } from '@/services/collectionService';
import type { ClientCollection } from '@/types/collection';

interface EditCollectionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  collectionToEdit: ClientCollection | null;
  onCollectionUpdated: () => void;
}

const editCollectionSchema = z.object({
  name: z.string().min(1, "Collection name is required.").max(100, "Name cannot exceed 100 characters."),
  description: z.string().max(500, "Description cannot exceed 500 characters.").optional(),
});

type EditCollectionFormData = z.infer<typeof editCollectionSchema>;

export const EditCollectionDialog: React.FC<EditCollectionDialogProps> = ({
  isOpen,
  onOpenChange,
  collectionToEdit,
  onCollectionUpdated,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<EditCollectionFormData>({
    resolver: zodResolver(editCollectionSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  useEffect(() => {
    if (collectionToEdit && isOpen) {
      form.reset({
        name: collectionToEdit.name,
        description: collectionToEdit.description || '',
      });
    }
  }, [collectionToEdit, isOpen, form]);

  const mutation = useMutation({
    mutationFn: (data: EditCollectionFormData) => {
      if (!user || !collectionToEdit) throw new Error("User not authenticated or collection not specified.");
      return updateCollectionDetails(collectionToEdit.id, user.uid, {
        name: data.name,
        description: data.description || undefined,
      });
    },
    onSuccess: () => {
      toast({ title: "Collection Updated", description: "Your collection details have been saved." });
      onCollectionUpdated();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Update Failed", description: error.message });
    },
  });

  const onSubmit = (data: EditCollectionFormData) => {
    mutation.mutate(data);
  };

  if (!collectionToEdit) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Collection</DialogTitle>
          <DialogDescription>Update the name and description of your collection.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
          <div>
            <Label htmlFor="name">Name <span className="text-destructive">*</span></Label>
            <Input id="name" {...form.register('name')} disabled={mutation.isPending} />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive mt-1">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              {...form.register('description')}
              rows={3}
              placeholder="Briefly describe what this collection is about..."
              disabled={mutation.isPending}
            />
            {form.formState.errors.description && (
              <p className="text-xs text-destructive mt-1">{form.formState.errors.description.message}</p>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={mutation.isPending}>Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

    