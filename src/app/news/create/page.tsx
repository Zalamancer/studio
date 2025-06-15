
// src/app/news/create/page.tsx
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { Form, FormControl, FormField, FormItem, FormMessage, FormLabel } from '@/components/ui/form';
import { Loader2, Save, Send, ImageUp, PlusCircle, X, Image as ImageIcon, UploadCloud, PlayCircle, Code as CodeIcon, Braces, Minus, Edit2 } from 'lucide-react';
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
  // imageFile: typeof window === 'undefined' ? z.any() : z.instanceof(File).optional(), // Placeholder
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
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [toolbarStyle, setToolbarStyle] = useState<React.CSSProperties>({ display: 'none' });

  const form = useForm<ArticleFormData>({
    resolver: zodResolver(articleSchema),
    defaultValues: {
      title: "",
      content: "",
      category: "",
    },
  });

  const isCurrentLineEmptyInTextarea = useCallback((text: string, currentCursorPos: number): boolean => {
    if (!text) return true;
    let lineStart = 0;
    for (let i = currentCursorPos - 1; i >= 0; i--) {
      if (text[i] === '\n') {
        lineStart = i + 1;
        break;
      }
    }
    let lineEnd = text.length;
    for (let i = currentCursorPos; i < text.length; i++) {
      if (text[i] === '\n') {
        lineEnd = i;
        break;
      }
    }
    const currentLineText = text.substring(lineStart, lineEnd);
    return currentLineText.trim() === '';
  }, []);

  const updateToolbarPosition = useCallback(() => {
    let style: React.CSSProperties = { display: 'none', position: 'absolute', zIndex: 10 };
    const titleIsEmpty = form.getValues('title').trim() === '';
    const contentLineIsEmpty = isCurrentLineEmptyInTextarea(form.getValues('content'), cursorPosition);
    const showPlusButton = (!isFormatMenuOpen && focusedField && (
      (focusedField === 'title' && titleIsEmpty) ||
      (focusedField === 'content' && contentLineIsEmpty)
    ));
    const showExpandedMenu = isFormatMenuOpen && focusedField;

    if (showPlusButton || showExpandedMenu) {
      style.display = 'flex';
      if (focusedField === 'title' && titleInputRef.current) {
        const inputRect = titleInputRef.current.getBoundingClientRect();
        const formRect = titleInputRef.current.closest('form')?.getBoundingClientRect();
        if (formRect) {
            // Position left of the input, vertically centered
            style.left = `${inputRect.left - formRect.left - 50}px`; // 50px to the left
            style.top = `${inputRect.top - formRect.top + inputRect.height / 2}px`;
            style.transform = 'translateY(-50%)';
        }
      } else if (focusedField === 'content' && contentTextareaRef.current) {
        const textarea = contentTextareaRef.current;
        const text = textarea.value;
        const currentLineNumber = (text.substring(0, cursorPosition).match(/\n/g) || []).length;
        
        const computedStyle = window.getComputedStyle(textarea);
        const lineHeight = parseFloat(computedStyle.lineHeight);
        const paddingTop = parseFloat(computedStyle.paddingTop);
        
        const formRect = textarea.closest('form')?.getBoundingClientRect();

        if (!isNaN(lineHeight) && !isNaN(paddingTop) && formRect) {
          const topOffset = (currentLineNumber * lineHeight) + paddingTop;
          style.top = `${textarea.offsetTop + topOffset}px`;
          style.left = `${textarea.offsetLeft - 50}px`; // 50px to the left
          style.transform = 'translateY(-50%)'; // Adjust vertical centering relative to line
        } else { // Fallback if computed styles are not available
            style.top = `${textarea.offsetTop + 2}px`; // Static fallback
            style.left = `${textarea.offsetLeft - 50}px`;
        }
      }
    }
    setToolbarStyle(style);
  }, [focusedField, isFormatMenuOpen, form, cursorPosition, isCurrentLineEmptyInTextarea]);


  useEffect(() => {
    updateToolbarPosition();
  }, [focusedField, isFormatMenuOpen, cursorPosition, form.watch('title'), form.watch('content'), updateToolbarPosition]);


  const handleFocus = (field: 'title' | 'content') => {
    setFocusedField(field);
    if (field === 'content' && contentTextareaRef.current) {
      setCursorPosition(contentTextareaRef.current.selectionStart || 0);
    }
    // No need to call updateToolbarPosition here, useEffect will catch it
  };

  const handleBlur = (field: 'title' | 'content') => {
    setTimeout(() => {
      if (toolbarRef.current && toolbarRef.current.contains(document.activeElement)) {
        return;
      }
      if (!isFormatMenuOpen && focusedField === field) { // Check if the blur is for the currently focused field
         setFocusedField(null);
      }
      // Do not set isFormatMenuOpen to false here, allow menu to stay open if a menu button was clicked
    }, 100); // Delay to allow toolbar button clicks
  };
  
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    form.setValue('title', e.target.value, { shouldValidate: true, shouldDirty: true });
    // updateToolbarPosition will be triggered by useEffect watching form.watch('title')
  };
  
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    form.setValue('content', newText, { shouldValidate: true, shouldDirty: true });
    if (contentTextareaRef.current) {
        setCursorPosition(contentTextareaRef.current.selectionStart || 0);
    }
    // updateToolbarPosition will be triggered by useEffect watching form.watch('content') and cursorPosition
  };

  const handleContentKeyUpOrMouseUp = () => {
    if (contentTextareaRef.current) {
        const newCursorPos = contentTextareaRef.current.selectionStart || 0;
        if (newCursorPos !== cursorPosition) { // Only update if cursor position actually changed
            setCursorPosition(newCursorPos);
        }
    }
  };

  const insertTextIntoContent = (textToInsert: string) => {
    if (contentTextareaRef.current) {
      const textarea = contentTextareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentValue = form.getValues('content');
      const newValue = currentValue.substring(0, start) + textToInsert + currentValue.substring(end);
      
      form.setValue('content', newValue, { shouldValidate: true, shouldDirty: true });
      const newCursorPos = start + textToInsert.length;
      setCursorPosition(newCursorPos); // Update cursor position state

      // Re-focus and set cursor position after state update
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      });
    }
  };

  const handleFormatButtonClick = (action: string) => {
    if (focusedField === 'title') {
      toast({ title: "Action Not Applicable", description: `Cannot apply "${action}" to the title field.`, variant: "default" });
      setIsFormatMenuOpen(false);
      titleInputRef.current?.focus();
      return;
    }

    if (focusedField === 'content' && contentTextareaRef.current) {
      switch (action) {
        case 'Image': {
          const url = window.prompt("Enter image URL:");
          if (url) insertTextIntoContent(`\n![Image Alt Text](${url})\n`);
          break;
        }
        case 'Upload': {
          toast({ title: "Placeholder Action", description: "Actual file upload requires further implementation. Inserting placeholder." });
          insertTextIntoContent(`\n![Uploaded Image Placeholder](path/to/image.jpg)\n`);
          break;
        }
        case 'Video': {
          const url = window.prompt("Enter video URL (e.g., YouTube, Vimeo):");
          if (url) insertTextIntoContent(`\n[Watch Video: ${url}](${url})\n`);
          break;
        }
        case 'Embed': {
          const embedCode = window.prompt("Paste embed code (e.g., iframe):");
          if (embedCode) insertTextIntoContent(`\n${embedCode}\n`);
          break;
        }
        case 'Code Block': {
          const textarea = contentTextareaRef.current;
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const selectedText = form.getValues('content').substring(start, end);
          if (selectedText) {
            insertTextIntoContent("```\n" + selectedText + "\n```");
          } else {
            insertTextIntoContent("\n```\nYour code here\n```\n");
          }
          break;
        }
        case 'Separator':
          insertTextIntoContent("\n---\n");
          break;
        default:
          toast({ title: "Action (Placeholder)", description: `${action} clicked for ${focusedField}` });
      }
      contentTextareaRef.current.focus();
    } else {
      toast({ title: "No Field Focused", description: "Please focus on the content area to apply formatting." });
    }
    setIsFormatMenuOpen(false); // Close menu after action
  };

  const onSubmit = async (data: ArticleFormData) => {
    if (!user) {
      toast({ variant: "destructive", title: "Not Authenticated", description: "You must be logged in." });
      return;
    }
    setIsSubmitting(true);
    // console.log("Submitting Article Data (Placeholder):", data); // Removed for brevity
    await new Promise(resolve => setTimeout(resolve, 1500));

    toast({
      title: "Article Submitted (Placeholder)",
      description: `"${data.title}" would be processed.`,
    });
    setIsSubmitting(false);
    form.reset(); 
    setFocusedField(null);
    setIsFormatMenuOpen(false);
    setCursorPosition(0);
  };
  
  const showPlusButtonTrigger = focusedField && !isFormatMenuOpen && (
    (focusedField === 'title' && form.getValues('title').trim() === '') ||
    (focusedField === 'content' && isCurrentLineEmptyInTextarea(form.getValues('content'), cursorPosition))
  );

  const showExpandedFormatMenu = focusedField && isFormatMenuOpen;


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
        <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-3xl mx-auto space-y-0 relative"> {/* Added relative here for toolbar */}
          
          <div className="flex items-center justify-end gap-x-3 gap-y-2 mb-6 flex-wrap">
            <div className="flex items-center gap-2 mr-auto">
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


            <div className="flex items-center gap-2"> 
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
          
          {/* Floating Toolbar - its content and visibility managed by state */}
          <div ref={toolbarRef} style={toolbarStyle} className="flex items-center gap-0.5 bg-background p-0.5 rounded-full border shadow-md">
             <Button 
                type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" 
                onClick={() => setIsFormatMenuOpen(prev => !prev)}
                onMouseDown={(e) => e.preventDefault()} // Prevent blur on input/textarea
             >
              {isFormatMenuOpen ? <X className="h-5 w-5" /> : <PlusCircle className="h-5 w-5" />}
            </Button>
            {showExpandedFormatMenu && (
              <>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => handleFormatButtonClick('Image')} title="Add Image" onMouseDown={(e) => e.preventDefault()}><ImageIcon className="h-4 w-4" /></Button>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => handleFormatButtonClick('Upload')} title="Upload from device" onMouseDown={(e) => e.preventDefault()}><UploadCloud className="h-4 w-4" /></Button>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => handleFormatButtonClick('Video')} title="Add Video" onMouseDown={(e) => e.preventDefault()}><PlayCircle className="h-4 w-4" /></Button>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => handleFormatButtonClick('Embed')} title="Embed" onMouseDown={(e) => e.preventDefault()}><CodeIcon className="h-4 w-4" /></Button>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => handleFormatButtonClick('Code Block')} title="Code Block" onMouseDown={(e) => e.preventDefault()}><Braces className="h-4 w-4" /></Button>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => handleFormatButtonClick('Separator')} title="Add Separator" onMouseDown={(e) => e.preventDefault()}><Minus className="h-4 w-4" /></Button>
              </>
            )}
          </div>

          <div className="relative"> {/* Container for Title Input */}
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
                      onChange={handleTitleChange}
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

          <div className="relative"> {/* Container for Content Textarea */}
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
                      onChange={handleContentChange}
                      onFocus={() => handleFocus('content')}
                      onBlur={() => handleBlur('content')}
                      onKeyUp={handleContentKeyUpOrMouseUp}
                      onMouseUp={handleContentKeyUpOrMouseUp}
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
