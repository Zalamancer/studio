
// src/components/plan/CreatePlanForm.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Brain, Eye, Lock, Users, Link as LinkIcon, ShieldQuestion } from 'lucide-react';
import type { SectorWithSubSectors, SubSector, Industry } from '@/components/layout/MainLayout';
import type { PlanVisibility, PlanEditability } from '@/types/plan';

const planFormSchema = z.object({
  name: z.string().min(3, "Plan name must be at least 3 characters.").max(100, "Plan name cannot exceed 100 characters."),
  sector: z.string().min(1, "Please select a sector."),
  subSector: z.string().optional(),
  industry: z.string().optional(),
  visibility: z.custom<PlanVisibility>(val => ['private', 'unlisted', 'public'].includes(val as string), {
    message: "Please select a visibility option.",
  }),
  editability: z.custom<PlanEditability>(val => ['owner_only', 'collaborators'].includes(val as string), {
    message: "Please select an editability option.",
  }),
});

export interface CreatePlanFormData extends z.infer<typeof planFormSchema> {
  // No extra fields needed beyond what Zod defines
}

export interface CreatePlanFormProps {
  onSubmit: (data: CreatePlanFormData) => Promise<void>;
  detailedSectorsData: SectorWithSubSectors[];
  isSubmitting: boolean;
  currentUserId: string;
}

export const CreatePlanForm: React.FC<CreatePlanFormProps> = ({
  onSubmit,
  detailedSectorsData,
  isSubmitting,
  currentUserId,
}) => {
  const form = useForm<z.infer<typeof planFormSchema>>({
    resolver: zodResolver(planFormSchema),
    defaultValues: {
      name: "",
      sector: "",
      subSector: "",
      industry: "",
      visibility: 'private', // Default to private
      editability: 'owner_only', // Default to owner only
    },
  });

  const [currentSubSectors, setCurrentSubSectors] = useState<SubSector[]>([]);
  const [currentIndustries, setCurrentIndustries] = useState<Industry[]>([]);

  const selectedSectorCode = form.watch("sector");
  useEffect(() => {
    if (selectedSectorCode) {
      const selectedMainSector = detailedSectorsData.find(s => s.code === selectedSectorCode);
      setCurrentSubSectors(selectedMainSector?.subSectors || []);
      form.setValue("subSector", "", { shouldValidate: true });
      form.setValue("industry", "", { shouldValidate: true });
      setCurrentIndustries([]);
    } else {
      setCurrentSubSectors([]);
      setCurrentIndustries([]);
    }
  }, [selectedSectorCode, detailedSectorsData, form]);

  const selectedSubSectorCode = form.watch("subSector");
  useEffect(() => {
    if (selectedSubSectorCode) {
      const selectedSub = currentSubSectors.find(ss => ss.code === selectedSubSectorCode);
      setCurrentIndustries(selectedSub?.industries || []);
      form.setValue("industry", "", { shouldValidate: true });
    } else {
      setCurrentIndustries([]);
    }
  }, [selectedSubSectorCode, currentSubSectors, form]);

  const handleFormSubmit = async (values: z.infer<typeof planFormSchema>) => {
    await onSubmit(values);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Plan Name <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <Input placeholder="e.g., Q4 Marketing Strategy, New Product Launch Plan" {...field} disabled={isSubmitting} />
              </FormControl>
              <FormDescription>Give your collaboration plan a clear and concise name.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="sector"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sector <span className="text-destructive">*</span></FormLabel>
              <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="Select a main sector" /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {detailedSectorsData.map(sector => (
                    <SelectItem key={sector.code} value={sector.code}>{sector.name} ({sector.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>Choose the primary sector this plan relates to.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="subSector"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sub-Sector (Optional)</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || ""} disabled={isSubmitting || currentSubSectors.length === 0}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder={currentSubSectors.length > 0 ? "Select a sub-sector" : "Select sector first"} /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {currentSubSectors.map(sub => (
                    <SelectItem key={sub.code} value={sub.code}>{sub.name} ({sub.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>Further specify the sub-sector if applicable.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="industry"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Industry (Optional)</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || ""} disabled={isSubmitting || currentIndustries.length === 0}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder={currentIndustries.length > 0 ? "Select an industry" : "Select sub-sector first"} /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {currentIndustries.map(ind => (
                    <SelectItem key={ind.code} value={ind.code}>{ind.name} ({ind.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>Choose the specific industry if applicable.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="visibility"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-1.5">
                <ShieldQuestion className="h-4 w-4 text-muted-foreground" /> Plan Visibility <span className="text-destructive">*</span>
              </FormLabel>
              <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="Who can see this plan?" /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="private">
                    <div className="flex items-center gap-2"><Lock className="h-4 w-4" /> Private (Only you)</div>
                  </SelectItem>
                  <SelectItem value="unlisted">
                     <div className="flex items-center gap-2"><LinkIcon className="h-4 w-4" /> Unlisted (Anyone with the link can view)</div>
                  </SelectItem>
                  <SelectItem value="public">
                     <div className="flex items-center gap-2"><Eye className="h-4 w-4" /> Public (Anyone can discover and view)</div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>Control who can find and view your plan.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="editability"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-muted-foreground" /> Who Can Edit? <span className="text-destructive">*</span>
              </FormLabel>
              <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="Who can edit this plan?" /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="owner_only">
                     <div className="flex items-center gap-2"><User className="h-4 w-4" /> Owner Only (Just you)</div>
                  </SelectItem>
                  <SelectItem value="collaborators">
                     <div className="flex items-center gap-2"><Users className="h-4 w-4" /> Specific Collaborators (You can invite others later)</div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                Determine editing permissions. If 'Specific Collaborators', you will be the initial editor.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating Plan...</>) : (<><Brain className="mr-2 h-4 w-4" /> Create Plan</>)}
          </Button>
        </div>
      </form>
    </Form>
  );
};
