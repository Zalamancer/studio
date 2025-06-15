// src/app/news/create/page.tsx
"use client";

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, ArrowLeft, ImageUp, BookOpen, Save, Send } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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
  title: z.string().min(5, "Title must be at least 5 characters long.").max(150, "Title cannot exceed 150 characters."),
  content: z.string().min(50, "Article content must be at least 50 characters long."),
  category: z.string().min(1, "Please select a category for the article."),
  // imageFile: typeof window === 'undefined' ? z.any() : z.instanceof(File).optional(), // Optional file upload
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

  // const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
  //   const file = event.target.files?.[0];
  //   if (file) {
  //     form.setValue("imageFile", file);
  //     const reader = new FileReader();
  //     reader.onloadend = () => setImagePreview(reader.result as string);
  //     reader.readAsDataURL(file);
  //   } else {
  //     form.setValue("imageFile", undefined);
  //     setImagePreview(null);
  //   }
  // };

  const onSubmit = async (data: ArticleFormData) => {
    if (!user) {
      toast({ variant: "destructive", title: "Not Authenticated", description: "You must be logged in." });
      return;
    }
    setIsSubmitting(true);
    console.log("Submitting Article Data (Placeholder):", data);
    // Placeholder for actual submission logic (e.g., to Firestore)
    // In a real app, you would handle image upload separately here.
    await new Promise(resolve => setTimeout(resolve, 1500));

    toast({
      title: "Article Submitted (Placeholder)",
      description: `"${data.title}" would be processed.`,
    });
    // form.reset(); // Reset form after successful submission
    // setImagePreview(null);
    setIsSubmitting(false);
    // router.push('/news'); // Optionally redirect
  };

  if (authLoading) {
    return (
      <div className="container mx-auto p-4 md:p-8 flex justify-center items-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    // router.push('/login'); // Redirect if not logged in
    return (
        <div className="container mx-auto p-4 md:p-8 text-center min-h-[calc(100vh-10rem)] flex flex-col justify-center items-center">
            <p className="text-lg font-semibold text-foreground">Please log in to create a news article.</p>
            <Button onClick={() => router.push('/login')} className="mt-4">Log In</Button>
        </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <div className="mb-6">
        <Button variant="outline" size="sm" asChild>
          <Link href="/news">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to News
          </Link>
        </Button>
      </div>

      <header className="max-w-3xl mx-auto text-center mb-10">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center justify-center">
          <BookOpen className="mr-3 h-7 w-7 text-primary" /> Write New Article
        </h1>
        <p className="text-muted-foreground mt-2">
          Share your insights, updates, or announcements with the AnonyCollab community.
        </p>
      </header>

      <div className="max-w-3xl mx-auto">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Article Title <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input placeholder="Enter a catchy and informative title" {...field} disabled={isSubmitting} />
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
                  <FormLabel>Article Content <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Start writing your article here... Markdown is not yet supported."
                      className="min-h-[300px] resize-y"
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
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category <span className="text-destructive">*</span></FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {newsCategories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Placeholder for Image Upload - Full functionality requires backend & storage */}
            <div className="space-y-2">
              <Label htmlFor="article-image">Cover Image (Optional)</Label>
              <Input
                id="article-image"
                type="file"
                accept="image/png, image/jpeg, image/gif, image/webp"
                // onChange={handleImageChange}
                disabled={isSubmitting}
                className="text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
              />
              <FormDescription>Upload an image to accompany your article (max 2MB).</FormDescription>
              {/* {imagePreview && (
                <div className="mt-2 border rounded-md p-2">
                  <img src={imagePreview} alt="Preview" className="max-h-40 rounded-md object-contain" />
                </div>
              )} */}
            </div>
            
            <div className="flex justify-end gap-3 pt-6">
                <Button type="button" variant="outline" onClick={() => console.log("Save Draft clicked. Data:", form.getValues())} disabled={isSubmitting}>
                    <Save className="mr-2 h-4 w-4" /> Save Draft (Placeholder)
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Publish Article (Placeholder)
                </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default CreateNewsArticlePage;
