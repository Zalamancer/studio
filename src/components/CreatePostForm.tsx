// src/components/CreatePostForm.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Loader2 } from 'lucide-react';

// Define the shape of a single industry
interface Industry {
  name: string;
  code: string;
}

// Define the shape of a single sub-sector with industries
interface SubSector {
  name: string;
  code: string;
  industries: Industry[];
}

// Define the shape of a single sector with sub-sectors
export interface SectorWithSubSectors {
  name: string;
  code: string;
  subSectors: SubSector[];
}

// Zod schema update
const postFormSchema = z.object({
  question: z.string().min(10, "Question must be at least 10 characters long.").max(200, "Question cannot exceed 200 characters."),
  description: z.string().optional(),
  tags: z.array(z.string()).min(1, "Please select at least one tag."),
  sector: z.string().min(1, "Please select a sector."),
  subSector: z.string().optional(),
  industry: z.string().optional(), // Industry is optional
});

type PostFormValues = z.infer<typeof postFormSchema>;

export interface CreatePostFormData {
  question: string;
  description?: string;
  tags: string[];
  sector: string; // Main sector code
  subSector?: string; // Sub-sector code, optional
  industry?: string; // Industry code, optional
}

interface CreatePostFormProps {
  onSubmit: (data: CreatePostFormData) => void;
  availableTags: string[];
  detailedSectorsData: SectorWithSubSectors[];
  isSubmitting: boolean;
}

export const CreatePostForm: React.FC<CreatePostFormProps> = ({ onSubmit, availableTags, detailedSectorsData, isSubmitting }) => {
  const form = useForm<PostFormValues>({
    resolver: zodResolver(postFormSchema),
    defaultValues: {
      question: "",
      description: "",
      tags: [],
      sector: "",
      subSector: "",
      industry: "", // Default empty industry
    },
  });

  const [currentSubSectors, setCurrentSubSectors] = useState<SubSector[]>([]);
  const [currentIndustries, setCurrentIndustries] = useState<Industry[]>([]);

  const selectedSectorCode = form.watch("sector");
  const selectedSubSectorCode = form.watch("subSector");

  useEffect(() => {
    if (selectedSectorCode) {
      const selectedMainSector = detailedSectorsData.find(s => s.code === selectedSectorCode);
      setCurrentSubSectors(selectedMainSector?.subSectors || []);
      form.resetField("subSector");
      form.resetField("industry");
      setCurrentIndustries([]); // Also clear industries when main sector changes
    } else {
      setCurrentSubSectors([]);
      setCurrentIndustries([]);
      form.resetField("subSector");
      form.resetField("industry");
    }
  }, [selectedSectorCode, detailedSectorsData, form]);

  useEffect(() => {
    if (selectedSubSectorCode) {
      const selectedSub = currentSubSectors.find(ss => ss.code === selectedSubSectorCode);
      setCurrentIndustries(selectedSub?.industries || []);
      form.resetField("industry");
    } else {
      setCurrentIndustries([]);
      form.resetField("industry");
    }
  }, [selectedSubSectorCode, currentSubSectors, form]);

  const handleSubmit = (values: PostFormValues) => {
    const submitData: CreatePostFormData = {
        question: values.question,
        description: values.description,
        tags: values.tags,
        sector: values.sector,
        subSector: values.subSector,
        industry: values.industry,
    };
    onSubmit(submitData);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="question"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Question / Need</FormLabel>
              <FormControl>
                <Input placeholder="e.g., How to improve B2B lead generation?" {...field} disabled={isSubmitting} />
              </FormControl>
              <FormDescription>
                Keep it concise and clear.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Provide more context or details about your question or need..."
                  className="resize-y min-h-[100px]"
                  {...field}
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="sector"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sector</FormLabel>
              <Select
                onValueChange={(value) => {
                  field.onChange(value);
                }}
                defaultValue={field.value}
                disabled={isSubmitting}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a main sector" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {detailedSectorsData.map((sector) => (
                    <SelectItem key={sector.code} value={sector.code}>
                      {sector.name} ({sector.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                Choose the primary sector for your post.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="subSector"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sub-sector (Optional)</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value}
                disabled={isSubmitting || currentSubSectors.length === 0}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={currentSubSectors.length > 0 ? "Select a sub-sector" : "No sub-sectors available"} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {currentSubSectors.map((sub) => (
                    <SelectItem key={sub.code} value={sub.code}>
                      {sub.name} ({sub.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                Choose a specific sub-sector if applicable.
              </FormDescription>
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
              <Select
                onValueChange={field.onChange}
                value={field.value}
                disabled={isSubmitting || currentIndustries.length === 0}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={currentIndustries.length > 0 ? "Select an industry" : "No industries available"} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {currentIndustries.map((industry) => (
                    <SelectItem key={industry.code} value={industry.code}>
                      {industry.name} ({industry.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                Choose a specific industry if applicable.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="tags"
          render={() => (
            <FormItem>
              <div className="mb-4">
                <FormLabel className="text-base">Tags</FormLabel>
                <FormDescription>
                  Select relevant tags for your post (select at least one).
                </FormDescription>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {availableTags.map((tag) => (
                  <FormField
                    key={tag}
                    control={form.control}
                    name="tags"
                    render={({ field }) => {
                      return (
                        <FormItem
                          key={tag}
                          className="flex flex-row items-start space-x-3 space-y-0"
                        >
                          <FormControl>
                            <Checkbox
                              checked={field.value?.includes(tag)}
                              onCheckedChange={(checked) => {
                                return checked
                                  ? field.onChange([...(field.value || []), tag])
                                  : field.onChange(
                                      (field.value || []).filter(
                                        (value) => value !== tag
                                      )
                                    )
                              }}
                              disabled={isSubmitting}
                            />
                          </FormControl>
                          <FormLabel className="font-normal">
                            {tag}
                          </FormLabel>
                        </FormItem>
                      )
                    }}
                  />
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <DialogFooter className="pt-4">
            <DialogClose asChild>
                 <Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Posting...
                    </>
                 ) : (
                    'Submit Post'
                 )}
            </Button>
        </DialogFooter>
      </form>
    </Form>
  );
};
