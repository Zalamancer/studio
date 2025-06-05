
// src/components/plan/AddRoadmapStepDialog.tsx
"use client";

import React from 'react';
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
// Select components removed as type field is removed
import { Loader2 } from 'lucide-react';

const addRoadmapStepSchema = z.object({
  title: z.string().min(1, "Title is required.").max(100, "Title cannot exceed 100 characters."),
  // type field removed from schema
});

export type AddRoadmapStepFormData = z.infer<typeof addRoadmapStepSchema>;

interface AddRoadmapStepDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: AddRoadmapStepFormData) => void;
  isSubmitting: boolean;
  parentStepTitle?: string | null;
  // isSubStep prop is no longer meaningful
  dialogTitle?: string; 
}

export const AddRoadmapStepDialog: React.FC<AddRoadmapStepDialogProps> = ({
  isOpen,
  onOpenChange,
  onSubmit,
  isSubmitting,
  parentStepTitle,
  dialogTitle,
}) => {
  const form = useForm<AddRoadmapStepFormData>({
    resolver: zodResolver(addRoadmapStepSchema),
    defaultValues: {
      title: '',
      // type field removed from defaultValues
    },
  });

  React.useEffect(() => {
    if (isOpen) {
      form.reset({
        title: '',
        // type field removed from reset
      });
    }
  }, [isOpen, form]);

  const effectiveDialogTitle = dialogTitle ||
    (parentStepTitle
      ? `Add Sub-step to "${parentStepTitle}"`
      : "Add New Roadmap Step");

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{effectiveDialogTitle}</DialogTitle>
          <DialogDescription>
            Define a new step for your collaboration plan.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
          <div>
            <Label htmlFor="dialog-step-title">Step Title <span className="text-destructive">*</span></Label>
            <Input id="dialog-step-title" {...form.register('title')} placeholder="e.g., Market Research, Phase 1 Kickoff" disabled={isSubmitting} />
            {form.formState.errors.title && (
              <p className="text-xs text-destructive mt-1">{form.formState.errors.title.message}</p>
            )}
          </div>
          {/* Step Type Select and its Controller removed */}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Step
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
