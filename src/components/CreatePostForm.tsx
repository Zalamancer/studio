// src/components/CreatePostForm.tsx
"use client";

import React from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Import Select components
import { DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Loader2 } from 'lucide-react';

// Define Zod schema for validation, now including sector
const postFormSchema = z.object({
  question: z.string().min(10, "Question must be at least 10 characters long.").max(200, "Question cannot exceed 200 characters."),
  description: z.string().optional(),
  tags: z.array(z.string()).min(1, "Please select at least one tag."),
  sector: z.string().min(1, "Please select a sector."), // Sector is now mandatory
});

type PostFormValues = z.infer<typeof postFormSchema>;

// Define the shape of the data the form outputs
export interface CreatePostFormData {
  question: string;
  description?: string;
  tags: string[];
  sector: string; // Include sector here
}

interface CreatePostFormProps {
  onSubmit: (data: CreatePostFormData) => void;
  availableTags: string[];
  availableSectors: string[]; // Add prop for available sectors
  isSubmitting: boolean;
}

export const CreatePostForm: React.FC<CreatePostFormProps> = ({ onSubmit, availableTags, availableSectors, isSubmitting }) => {
  const form = useForm<PostFormValues>({
    resolver: zodResolver(postFormSchema),
    defaultValues: {
      question: "",
      description: "",
      tags: [],
      sector: "", // Default empty sector
    },
  });

  const handleSubmit = (values: PostFormValues) => {
    const submitData: CreatePostFormData = {
        question: values.question,
        description: values.description,
        tags: values.tags,
        sector: values.sector, // Pass the sector from form values
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
              <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a sector" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {availableSectors.map((sectorName) => (
                    <SelectItem key={sectorName} value={sectorName}>
                      {sectorName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                Choose the sector most relevant to your post.
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
