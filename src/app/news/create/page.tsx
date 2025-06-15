
// src/app/news/create/page.tsx
"use client";

import React, { useState, useEffect, useRef } from 'react'; // Added useRef
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, Save, Send, ImageUp, PlusCircle, X, Image as ImageIcon, UploadCloud, PlayCircle, Code as CodeIcon, Braces, Minus } from 'lucide-react'; // Added new icons
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

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
  // imageFile: typeof window === 'undefined' ? z.any() : z.instanceof(File).optional(), // Image file handling for backend
});

type ArticleFormData = z.infer<typeof articleSchema>;

const CreateNewsArticlePage = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [focusedField, setFocusedField] = useState<'title' | 'content' | null>(null);
  const [isFormatMenuOpen, setIsFormatMenuOpen] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null); // Ref for the toolbar itself

  const form = useForm<ArticleFormData>({
    resolver: zodResolver(articleSchema),
    defaultValues: {
      title: "",
      content: "",
      category: "",
    },
  });

  const handleFocus = (field: 'title' | 'content') => {
    const value = form.getValues(field);
    if (value.trim() === '') {
      setFocusedField(field);
    } else {
      setFocusedField(null); // Don't show + if field is not empty on focus
      setIsFormatMenuOpen(false);
    }
  };

  const handleBlur = (field: 'title' | 'content') => {
    // Delay hiding to allow clicks on the toolbar
    setTimeout(() => {
      // Check if the new focused element is part of our toolbar
      if (toolbarRef.current && toolbarRef.current.contains(document.activeElement)) {
        return; // Don't hide if a toolbar button was clicked
      }
      if (!isFormatMenuOpen) {
        setFocusedField(null);
      }
    }, 150);
  };
  
  const handleInputChange = (field: 'title' | 'content', value: string) => {
    if (value.trim() === '' && document.activeElement === (field === 'title' ? titleInputRef.current : contentTextareaRef.current) ) {
      setFocusedField(field);
    } else if (value.trim() !== '' && !isFormatMenuOpen) {
      setFocusedField(null);
    }
  };


  const handleFormatButtonClick = (action: string) => {
    console.log(`${action} clicked for ${focusedField}`);
    // Placeholder: In a real editor, this would insert markdown/HTML or update editor state
    toast({ title: "Action (Placeholder)", description: `${action} for ${focusedField}`});
    setIsFormatMenuOpen(false);
    // Optionally, refocus the editor field:
    // if (focusedField === 'title' && titleInputRef.current) titleInputRef.current.focus();
    // if (focusedField === 'content' && contentTextareaRef.current) contentTextareaRef.current.focus();
  };

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
    form.reset();
    setFocusedField(null);
    setIsFormatMenuOpen(false);
  };
  
  const getToolbarPositionClass = () => {
    if (focusedField === 'title') return "top-2 left-[-50px] sm:left-[-55px]"; // Adjust as needed
    if (focusedField === 'content') return "top-2 left-[-50px] sm:left-[-55px]"; // Adjust as needed
    return "hidden"; // Should not happen if focusedField is null
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
          
          <div className="flex items-center justify-between gap-x-3 gap-y-2 mb-6 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <Controller
                name="category"
                control={form.control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting}>
                    <SelectTrigger className="text-xs py-1.5 h-9 w-auto min-w-[140px] sm:w-[160px] focus-visible:ring-0 focus-visible:ring-offset-0">
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
               {form.formState.errors.category && (
                 <p className="text-xs text-destructive mt-1 sm:hidden">{form.formState.errors.category.message}</p>
               )}
              <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('article-image-input-header')?.click()} disabled={isSubmitting} className="text-xs py-1.5 h-9">
                  <ImageUp className="mr-1.5 h-3.5 w-3.5" /> <span className="hidden sm:inline">Cover Image</span><span className="sm:hidden">Image</span>
              </Button>
              <Input id="article-image-input-header" type="file" accept="image/*" className="hidden" disabled={isSubmitting}/>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <Button type="button" variant="outline" onClick={() => console.log("Save Draft clicked. Data:", form.getValues())} disabled={isSubmitting} className="text-xs py-1.5 h-9 rounded-full">
                  <Save className="mr-1.5 h-3.5 w-3.5" /> Save Draft
              </Button>
              <Button type="submit" disabled={isSubmitting} className="text-xs py-1.5 bg-green-600 hover:bg-green-700 text-white h-9 rounded-full">
                {isSubmitting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
                Publish
              </Button>
            </div>
          </div>
          {form.formState.errors.category && form.formState.isSubmitted && (
            <FormItem><FormMessage className="text-center text-sm mb-2" /></FormItem>
          )}

          <div className="relative">
            {(focusedField === 'title' && form.getValues('title').trim() === '' || (focusedField === 'title' && isFormatMenuOpen)) && (
              <div ref={toolbarRef} className={cn("absolute flex items-center gap-0.5 bg-background p-0.5 rounded-full border shadow-md z-10", getToolbarPositionClass())}>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => setIsFormatMenuOpen(!isFormatMenuOpen)}>
                  {isFormatMenuOpen ? <X className="h-4 w-4" /> : <PlusCircle className="h-4 w-4" />}
                </Button>
                {isFormatMenuOpen && (
                  <>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => handleFormatButtonClick('Image')} title="Add Image"><ImageIcon className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => handleFormatButtonClick('Upload')} title="Upload from device"><UploadCloud className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => handleFormatButtonClick('Video')} title="Add Video"><PlayCircle className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => handleFormatButtonClick('Embed')} title="Embed"><CodeIcon className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => handleFormatButtonClick('Code Block')} title="Code Block"><Braces className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => handleFormatButtonClick('Separator')} title="Add Separator"><Minus className="h-4 w-4" /></Button>
                  </>
                )}
              </div>
            )}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem className="mb-8">
                  <FormControl>
                    <Input 
                      ref={node => { field.ref(node); (titleInputRef as React.MutableRefObject<HTMLInputElement | null>).current = node; }}
                      placeholder="Title" 
                      {...field} 
                      onChange={(e) => { field.onChange(e); handleInputChange('title', e.target.value); }}
                      onFocus={() => handleFocus('title')}
                      onBlur={() => handleBlur('title')}
                      disabled={isSubmitting} 
                      className="text-4xl lg:text-5xl font-bold border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-0 placeholder:text-muted-foreground/50 h-auto py-2"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="relative">
            {(focusedField === 'content' && form.getValues('content').trim() === '' || (focusedField === 'content' && isFormatMenuOpen)) && (
                 <div ref={toolbarRef} className={cn("absolute flex items-center gap-0.5 bg-background p-0.5 rounded-full border shadow-md z-10", getToolbarPositionClass())}>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => setIsFormatMenuOpen(!isFormatMenuOpen)}>
                  {isFormatMenuOpen ? <X className="h-4 w-4" /> : <PlusCircle className="h-4 w-4" />}
                </Button>
                {isFormatMenuOpen && (
                  <>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => handleFormatButtonClick('Image')} title="Add Image"><ImageIcon className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => handleFormatButtonClick('Upload')} title="Upload from device"><UploadCloud className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => handleFormatButtonClick('Video')} title="Add Video"><PlayCircle className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => handleFormatButtonClick('Embed')} title="Embed"><CodeIcon className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => handleFormatButtonClick('Code Block')} title="Code Block"><Braces className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => handleFormatButtonClick('Separator')} title="Add Separator"><Minus className="h-4 w-4" /></Button>
                  </>
                )}
              </div>
            )}
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      ref={node => { field.ref(node); (contentTextareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = node; }}
                      placeholder="Tell your story..."
                      className="text-base border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-0 min-h-[300px] resize-y placeholder:text-muted-foreground/50 py-2"
                      {...field}
                      onChange={(e) => { field.onChange(e); handleInputChange('content', e.target.value); }}
                      onFocus={() => handleFocus('content')}
                      onBlur={() => handleBlur('content')}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </form>
      </Form>
    </div>
  );
};

export default CreateNewsArticlePage;

