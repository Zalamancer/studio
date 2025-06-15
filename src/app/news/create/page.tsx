
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormMessage, FormLabel } from '@/components/ui/form';
import { Loader2, Save, Send, ImageUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

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

// Updated schema: removed content
const articleSchema = z.object({
  title: z.string().min(1, "Title cannot be empty.").max(150, "Title cannot exceed 150 characters."),
  category: z.string().min(1, "Please select a category for the article."),
});

type ArticleFormData = z.infer<typeof articleSchema>;

const CreateNewsArticlePage = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Refs for title field (if toolbar interaction was desired for it, but toolbar is removed)
  // const titleWrapperRef = useRef<HTMLDivElement>(null);
  // const titleInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<ArticleFormData>({
    resolver: zodResolver(articleSchema),
    // Updated defaultValues: removed content
    defaultValues: { title: "", category: "" },
  });

  // titleValueFromForm can still be useful for other logic if needed
  // const titleValueFromForm = form.watch('title');

  const onSubmit = async (data: ArticleFormData) => {
    if (!user) {
      toast({ variant: "destructive", title: "Not Authenticated" });
      return;
    }
    setIsSubmitting(true);
    console.log("Submitting Article Data (Title & Category only):", data);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    toast({ title: "Article Submitted (Placeholder)", description: `"${data.title}" saved.` });
    setIsSubmitting(false);
    // Updated form.reset: removed content
    form.reset({ title: "", category: "" });
  };

  if (authLoading) return <div className="container mx-auto p-4 md:p-8 flex justify-center items-center min-h-[calc(100vh-10rem)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  if (!user) return <div className="container mx-auto p-4 md:p-8 text-center min-h-[calc(100vh-10rem)] flex flex-col justify-center items-center"><p className="text-lg font-semibold text-foreground">Please log in to create news.</p><Button onClick={() => router.push('/login')} className="mt-4">Log In</Button></div>;

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <Form {...form}>
        {/* Removed formRef as toolbar positioning logic is gone */}
        <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-3xl mx-auto space-y-0 relative">
          {/* ToolbarComponent and its state/logic removed */}

          {/* Header controls */}
          <div className="flex items-center justify-end gap-x-3 gap-y-2 mb-6 flex-wrap">
            <div className="flex items-center gap-2 mr-auto">
              {/* Category Select */}
              <FormField control={form.control} name="category" render={({ field }) => ( <FormItem><Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting}><FormControl><SelectTrigger className="text-xs py-1.5 h-9 w-auto min-w-[140px] sm:w-[160px] focus-visible:ring-0 focus-visible:ring-offset-0"><SelectValue placeholder="Category" /></SelectTrigger></FormControl><SelectContent>{newsCategories.map((category) => ( <SelectItem key={category} value={category} className="text-sm">{category}</SelectItem>))}</SelectContent></Select><FormMessage className="sm:hidden text-xs" /></FormItem>)} />
              {/* Cover Image Button (Placeholder) */}
              <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('article-image-input-header')?.click()} disabled={isSubmitting} className="text-xs py-1.5 h-9"><ImageUp className="mr-1.5 h-3.5 w-3.5" /> <span className="hidden sm:inline">Cover Image</span><span className="sm:hidden">Image</span></Button><Input id="article-image-input-header" type="file" accept="image/*" className="hidden" disabled={isSubmitting}/>
            </div>
            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => console.log("Save Draft clicked. Data:", form.getValues())} disabled={isSubmitting} className="text-xs py-1.5 h-9 rounded-full"><Save className="mr-1.5 h-3.5 w-3.5" /> Save Draft</Button>
              <Button type="submit" disabled={isSubmitting} className="text-xs py-1.5 bg-green-600 hover:bg-green-700 text-white h-9 rounded-full">{isSubmitting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}Publish</Button>
            </div>
          </div>
          {/* Category Form Message (Desktop) */}
          <FormField control={form.control} name="category" render={() => <FormItem><FormMessage className="text-center text-sm mb-2 hidden sm:block" /></FormItem>} />

          {/* Title Field */}
          {/* Removed titleWrapperRef as toolbar logic is gone */}
          <div className="relative">
            <FormField control={form.control} name="title" render={({ field }) => ( <FormItem className="mb-8"><FormControl><Input 
            // Removed titleInputRef and focus/blur/interaction handlers for toolbar
            placeholder="Title" {...field} disabled={isSubmitting} className="text-4xl lg:text-5xl font-bold border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-0 placeholder:text-muted-foreground/50 h-auto py-2"/></FormControl><FormMessage /></FormItem>)} />
          </div>

          {/* Content Field and its wrapper REMOVED */}
          {/* 
          <div className="relative" ref={contentWrapperRef}>
            <FormField control={form.control} name="content" render={({ field }) => ( ... )} />
          </div> 
          */}

        </form>
      </Form>
    </div>
  );
};

export default CreateNewsArticlePage;
