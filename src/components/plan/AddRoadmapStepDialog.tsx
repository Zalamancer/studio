
// src/components/plan/AddRoadmapStepDialog.tsx
"use client";

import React from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from 'lucide-react';

const addRoadmapStepSchema = z.object({
  title: z.string().min(1, "Title is required.").max(100, "Title cannot exceed 100 characters."),
  type: z.enum(['Main Category/Phase', 'Sub-category/Task'], {
    required_error: "Step type is required.",
  }),
});

export type AddRoadmapStepFormData = z.infer<typeof addRoadmapStepSchema>;

interface AddRoadmapStepDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: AddRoadmapStepFormData) => void;
  isSubmitting: boolean;
  parentStepTitle?: string | null;
  isSubStep?: boolean;
  dialogTitle?: string;
}

export const AddRoadmapStepDialog: React.FC<AddRoadmapStepDialogProps> = ({
  isOpen,
  onOpenChange,
  onSubmit,
  isSubmitting,
  parentStepTitle,
  isSubStep,
  dialogTitle,
}) => {
  const form = useForm<AddRoadmapStepFormData>({
    resolver: zodResolver(addRoadmapStepSchema),
    defaultValues: {
      title: '',
      type: isSubStep ? 'Sub-category/Task' : 'Main Category/Phase',
    },
  });

  React.useEffect(() => {
    if (isOpen) {
      form.reset({
        title: '',
        type: isSubStep ? 'Sub-category/Task' : 'Main Category/Phase',
      });
    }
  }, [isOpen, isSubStep, form]);

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
            <Label htmlFor="title">Step Title <span className="text-destructive">*</span></Label>
            <Input id="title" {...form.register('title')} placeholder="e.g., Market Research, Phase 1 Kickoff" disabled={isSubmitting} />
            {form.formState.errors.title && (
              <p className="text-xs text-destructive mt-1">{form.formState.errors.title.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="type">Step Type <span className="text-destructive">*</span></Label>
            <Controller
              name="type"
              control={form.control}
              render={({ field }) => (
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                  disabled={isSubmitting || isSubStep}
                >
                  <SelectTrigger id="type">
                    <SelectValue placeholder="Select step type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Main Category/Phase">Main Category/Phase</SelectItem>
                    <SelectItem value="Sub-category/Task">Sub-category/Task</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.type && (
              <p className="text-xs text-destructive mt-1">{form.formState.errors.type.message}</p>
            )}
          </div>
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
    