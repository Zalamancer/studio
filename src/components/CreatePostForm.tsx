
// src/components/CreatePostForm.tsx
"use client";

import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea"; // Assuming you have Textarea component
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
import type { Post } from '@/types/post';
import { DialogFooter, DialogClose } from "@/components/ui/dialog"; // Import DialogFooter and DialogClose

// Define Zod schema for validation
const postFormSchema = z.object({
  question: z.string().min(10, "Question must be at least 10 characters long.").max(200, "Question cannot exceed 200 characters."),
  description: z.string().optional(), // Optional detailed description
  tags: z.array(z.string()).min(1, "Please select at least one tag."),
});

type PostFormValues = z.infer<typeof postFormSchema>;

interface CreatePostFormProps {
  onSubmit: (data: Omit<Post, 'id' | 'createdAt' | 'sector' | 'businessType' | 'safetyIndicator' | 'ratingScore' | 'stockGraphData'>) => void;
  availableTags: string[];
}

export const CreatePostForm: React.FC<CreatePostFormProps> = ({ onSubmit, availableTags }) => {
  const form = useForm<PostFormValues>({
    resolver: zodResolver(postFormSchema),
    defaultValues: {
      question: "",
      description: "",
      tags: [],
    },
  });

  const handleSubmit = (values: PostFormValues) => {
    onSubmit(values);
    form.reset(); // Reset form after submission
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
                <Input placeholder="e.g., How to improve B2B lead generation?" {...field} />
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
                  className="resize-y min-h-[100px]" // Allow vertical resize
                  {...field}
                />
              </FormControl>
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
                                  ? field.onChange([...field.value, tag])
                                  : field.onChange(
                                      field.value?.filter(
                                        (value) => value !== tag
                                      )
                                    )
                              }}
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
              <FormMessage /> {/* Display error if no tags selected */}
            </FormItem>
          )}
        />

        <DialogFooter className="pt-4">
            <DialogClose asChild>
               <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Posting...' : 'Submit Post'}
            </Button>
        </DialogFooter>
      </form>
    </Form>
  );
};
