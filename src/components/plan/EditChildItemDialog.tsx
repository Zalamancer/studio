
// src/components/plan/EditChildItemDialog.tsx
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
import type { ChildDataItem } from '@/types/plan'; // For originalItemData prop

const editChildItemSchema = z.object({
  title: z.string().min(1, "Title is required.").max(150, "Title cannot exceed 150 characters."),
  description: z.string().max(500, "Description cannot exceed 500 characters.").optional(),
});

export type EditChildItemFormData = z.infer<typeof editChildItemSchema>;

interface EditChildItemDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: EditChildItemFormData) => void;
  isSubmitting: boolean;
  dialogTitle: string;
  defaultTitle?: string;
  defaultDescription?: string;
  originalItemData?: ChildDataItem | null; // To pre-fill if editing
  onItemUpdated?: (updatedItem: ChildDataItem) => void; // Optional: for optimistic updates or if the dialog needs to communicate specific item details back
}

export const EditChildItemDialog: React.FC<EditChildItemDialogProps> = ({
  isOpen,
  onOpenChange,
  onSubmit,
  isSubmitting,
  dialogTitle,
  defaultTitle = '',
  defaultDescription = '',
  originalItemData,
  onItemUpdated,
}) => {
  const form = useForm<EditChildItemFormData>({
    resolver: zodResolver(editChildItemSchema),
    defaultValues: {
      title: defaultTitle,
      description: defaultDescription,
    },
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({
        title: originalItemData?.title || defaultTitle || '',
        description: originalItemData?.description || defaultDescription || '',
      });
    }
  }, [isOpen, originalItemData, defaultTitle, defaultDescription, form]);

  const handleFormSubmit = (data: EditChildItemFormData) => {
    onSubmit(data);
    // If onItemUpdated and originalItemData are provided, call it
    // This is useful if the dialog needs to pass back more than just title/desc,
    // or if the parent needs to know which item was specifically updated.
    if (onItemUpdated && originalItemData) {
        onItemUpdated({
            ...originalItemData,
            title: data.title,
            description: data.description || null,
        });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{dialogTitle || "Manage Item"}</DialogTitle>
          <DialogDescription>
            Provide details for this item.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-2">
          <div>
            <Label htmlFor="child-item-title">Title <span className="text-destructive">*</span></Label>
            <Input
              id="child-item-title"
              {...form.register('title')}
              placeholder="e.g., Research competitors, Draft V1"
              disabled={isSubmitting}
            />
            {form.formState.errors.title && (
              <p className="text-xs text-destructive mt-1">{form.formState.errors.title.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="child-item-description">Description (Optional)</Label>
            <Textarea
              id="child-item-description"
              {...form.register('description')}
              placeholder="Add more context or details..."
              rows={3}
              disabled={isSubmitting}
            />
            {form.formState.errors.description && (
              <p className="text-xs text-destructive mt-1">{form.formState.errors.description.message}</p>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => onOpenChange(false)}>Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Item
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
