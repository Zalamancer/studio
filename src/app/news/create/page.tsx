
// src/app/news/create/page.tsx
"use client";

import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form'; // Added Controller
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
// Label removed as it's not used directly for top-bar elements, FormLabel is used within FormField
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, Save, Send, ImageUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils'; // Added cn for conditional styling

const newsCategories = [
  "Collaborative Ventures",
  "Financial Insights",
  "Political & Regulatory",
  "New Opportunities",
  "Events",
  "Platform Updates",
  "Industry Analysis",
  "Case Studies",
];

const articleSchema = z.object({
  title: z.string().min(1, "Title cannot be empty.").max(150, "Title cannot exceed 150 characters."),
  content: z.string().min(1, "Article content cannot be empty."),
  category: z.string().min(1, "Please select a category for the article."),
  // imageFile: typeof window === 'undefined' ? z.any() : z.instanceof(File).optional(),
});

type ArticleFormData = z.infer<typeof articleSchema>;

const CreateNewsArticlePage = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  // const [imagePreview, setImagePreview] = useState<string | null>(null);

  const form = useForm<ArticleFormData>({
    resolver: zodResolver(articleSchema),
    defaultValues: {
      title: "",
      content: "",
      category: "",
      // imageFile: undefined,
    },
  });

  const onSubmit = async (data: ArticleFormData) => {
    if (!user) {
      toast({ variant: "destructive", title: "Not Authenticated", description: "You must be logged in." });
      return;
    }
    setIsSubmitting(true);
    console.log("Submitting Article Data (Placeholder):", data);
    await new Promise(resolve => setTimeout(resolve, 1500));

    toast({
      title: "Article Submitted (Placeholder)",
      description: `"${data.title}" would be processed.`,
    });
    setIsSubmitting(false);
  };

  if (authLoading) {
    return (
      <div className="container mx-auto p-4 md:p-8 flex justify-center items-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
        <div className="container mx-auto p-4 md:p-8 text-center min-h-[calc(100vh-10rem)] flex flex-col justify-center items-center">
            <p className="text-lg font-semibold text-foreground">Please log in to create a news article.</p>
            <Button onClick={() => router.push('/login')} className="mt-4">Log In</Button>
        </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-3xl mx-auto space-y-8">
          
          <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
            {/* Left side: Category and Image */}
            <div className="flex items-center gap-3 flex-wrap">
              <Controller
                name="category"
                control={form.control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting}>
                    <SelectTrigger className="text-xs py-1.5 h-9 w-auto min-w-[150px] sm:w-[180px] focus-visible:ring-0 focus-visible:ring-offset-0">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {newsCategories.map((category) => (
                        <SelectItem key={category} value={category} className="text-sm">
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
               {/* FormMessage for category can be added here if needed, or rely on global form error summary */}
               {form.formState.errors.category && !isSubmitting && (
                 <p className="text-xs text-destructive mt-1 sm:hidden">{form.formState.errors.category.message}</p> // Show on mobile if needed
               )}


              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('article-image-input-header')?.click()} disabled={isSubmitting} className="text-xs py-1.5 h-9">
                    <ImageUp className="mr-1.5 h-3.5 w-3.5" /> Upload Image
                </Button>
                <Input
                    id="article-image-input-header"
                    type="file"
                    accept="image/png, image/jpeg, image/gif, image/webp"
                    // onChange={handleImageChange} - keep this commented out if not implementing preview
                    disabled={isSubmitting}
                    className="hidden"
                />
                {/* Image preview logic can be added here if needed */}
              </div>
            </div>

            {/* Right side: Save and Publish */}
            <div className="flex items-center gap-2 ml-auto"> {/* ml-auto to push to the right */}
              <Button type="button" variant="outline" onClick={() => console.log("Save Draft clicked. Data:", form.getValues())} disabled={isSubmitting} className="text-xs py-1.5 h-9 rounded-full">
                  <Save className="mr-1.5 h-3.5 w-3.5" /> Save Draft
              </Button>
              <Button type="submit" disabled={isSubmitting} className="text-xs py-1.5 bg-green-600 hover:bg-green-700 text-white h-9 rounded-full">
                {isSubmitting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
                Publish
              </Button>
            </div>
          </div>
          {/* Display category error prominently if form submitted and error exists and it's not being fixed in the header */}
          {form.formState.errors.category && form.formState.isSubmitted && (
            <FormItem> 
              <FormMessage className="text-center text-sm mb-2" /> 
            </FormItem>
          )}


          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem className="mb-8">
                <FormControl>
                  <Input 
                    placeholder="Title" 
                    {...field} 
                    disabled={isSubmitting} 
                    className="text-4xl lg:text-5xl font-bold border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-0 placeholder:text-muted-foreground/50 h-auto py-2"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="content"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea
                    placeholder="Tell your story..."
                    className="text-xl border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-0 min-h-[300px] resize-y placeholder:text-muted-foreground/50 py-2"
                    {...field}
                    disabled={isSubmitting}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {/* Category and Image sections are removed from here as they are moved to the top */}
        </form>
      </Form>
    </div>
  );
};

export default CreateNewsArticlePage;

