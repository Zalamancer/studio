
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
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form'; // FormLabel removed as it's not used directly now
import { Loader2, Save, Send, ImageUp, PlusCircle, X, Image as ImageIcon, UploadCloud, PlayCircle, Code as CodeIcon, Braces, Minus } from 'lucide-react';
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
  const [toolbarStyle, setToolbarStyle] = useState<React.CSSProperties>({ display: 'none', position: 'absolute', zIndex: 10 });


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
    // console.log(`updateToolbarPosition called. focusedField: ${focusedField}, isFormatMenuOpen: ${isFormatMenuOpen}, cursorPosition: ${cursorPosition}`);
    const newStyle: React.CSSProperties = { display: 'none', position: 'absolute', zIndex: 50 }; // Increased z-index

    const titleValue = form.getValues('title');
    const contentValue = form.getValues('content');
    const titleIsEmpty = typeof titleValue === 'string' ? titleValue.trim() === '' : true;
    const contentLineIsEmpty = isCurrentLineEmptyInTextarea(contentValue, cursorPosition);
    
    // console.log(`titleIsEmpty: ${titleIsEmpty} (value: "${titleValue}")`);
    // console.log(`contentLineIsEmpty: ${contentLineIsEmpty} (value: "${contentValue.substring(0,10)}...", cursor: ${cursorPosition})`);


    const showPlusButtonTrigger = !isFormatMenuOpen && focusedField && (
      (focusedField === 'title' && titleIsEmpty) ||
      (focusedField === 'content' && contentLineIsEmpty)
    );
    const showExpandedFormatMenu = focusedField && isFormatMenuOpen;

    if (showPlusButtonTrigger || showExpandedFormatMenu) {
      newStyle.display = 'flex';
      // console.log("Toolbar display set to flex.");

      if (focusedField === 'title' && titleInputRef.current && titleInputRef.current.parentElement) {
        const wrapper = titleInputRef.current.parentElement;
        newStyle.left = `${wrapper.offsetLeft - 50}px`; // 50px to the left of the wrapper
        newStyle.top = `${wrapper.offsetTop + wrapper.offsetHeight / 2}px`;
        newStyle.transform = 'translateY(-50%)';
        // console.log(`Title toolbar position: left=${newStyle.left}, top=${newStyle.top}`);
      } else if (focusedField === 'content' && contentTextareaRef.current && contentTextareaRef.current.parentElement) {
        const textarea = contentTextareaRef.current;
        const wrapper = textarea.parentElement;
        const computedStyle = window.getComputedStyle(textarea);
        
        let lineHeight = parseFloat(computedStyle.lineHeight);
        if (isNaN(lineHeight) || lineHeight <= 0) {
            const fontSize = parseFloat(computedStyle.fontSize);
            lineHeight = !isNaN(fontSize) && fontSize > 0 ? fontSize * 1.4 : 20; // Fallback
            // console.log(`Content lineHeight fallback: ${lineHeight}px (fontSize: ${fontSize}px)`);
        }
        const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
        
        const currentLineNumber = (textarea.value.substring(0, cursorPosition).match(/\n/g) || []).length;
        const topOffset = (currentLineNumber * lineHeight) + paddingTop;

        newStyle.left = `${wrapper.offsetLeft - 50}px`; // 50px to the left of the wrapper
        newStyle.top = `${wrapper.offsetTop + topOffset}px`;
        newStyle.transform = 'translateY(-50%)'; // Adjust for vertical centering of the toolbar itself
        // console.log(`Content toolbar position: left=${newStyle.left}, top=${newStyle.top} (line: ${currentLineNumber}, offset: ${topOffset})`);
      } else {
        // console.log("Could not calculate position: ref or parentElement missing.");
        newStyle.display = 'none'; // Hide if refs aren't ready
      }
    } else {
      // console.log("Toolbar display set to none.");
    }
    setToolbarStyle(newStyle);
  }, [form, cursorPosition, isFormatMenuOpen, focusedField, isCurrentLineEmptyInTextarea]);

  useEffect(() => {
    updateToolbarPosition();
  }, [focusedField, isFormatMenuOpen, cursorPosition, updateToolbarPosition]); // Removed form.watch() for performance


  const handleFocus = (field: 'title' | 'content') => {
    // console.log(`Focus on: ${field}`);
    setFocusedField(field);
    if (field === 'content' && contentTextareaRef.current) {
      setCursorPosition(contentTextareaRef.current.selectionStart || 0);
    }
    // updateToolbarPosition will be called by useEffect
  };

  const handleBlur = (fieldToBlur: 'title' | 'content') => {
    // console.log(`Blur from: ${fieldToBlur}`);
    setTimeout(() => {
      if (toolbarRef.current && toolbarRef.current.contains(document.activeElement)) {
        // console.log("Blur event: Focus moved to toolbar, not hiding.");
        return; // Focus moved to the toolbar itself, don't hide
      }
      // console.log(`Blur event: Focus moved outside. isFormatMenuOpen: ${isFormatMenuOpen}, current focusedField: ${focusedField}`);
      // Only reset focusedField if the menu is closed AND the blur is from the field that was actually focused
      if (!isFormatMenuOpen && focusedField === fieldToBlur) { 
        // console.log("Setting focusedField to null");
        setFocusedField(null);
      }
    }, 100); // Delay to allow toolbar button clicks to register
  };
  
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    form.setValue('title', e.target.value, { shouldValidate: true, shouldDirty: true });
    updateToolbarPosition(); // Call directly on change for responsiveness
  };
  
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    form.setValue('content', newText, { shouldValidate: true, shouldDirty: true });
    if (contentTextareaRef.current) {
        setCursorPosition(contentTextareaRef.current.selectionStart || 0);
    }
    updateToolbarPosition(); // Call directly on change
  };

  const handleContentKeyUpOrMouseUp = () => {
    if (contentTextareaRef.current) {
        const newCursorPos = contentTextareaRef.current.selectionStart || 0;
        if (newCursorPos !== cursorPosition) {
            setCursorPosition(newCursorPos); // This will trigger useEffect -> updateToolbarPosition
        } else {
            updateToolbarPosition(); // If cursor didn't move but content might affect line emptiness (e.g. pasting)
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
      
      // Ensure cursor position state is updated and textarea re-focused
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        setCursorPosition(newCursorPos); // Explicitly update state
        // updateToolbarPosition(); // updateToolbarPosition will be called by useEffect watching cursorPosition or by handleContentChange if it's triggered
      });
    }
  };

  const handleFormatButtonClick = (action: string) => {
    // console.log(`Format button clicked: ${action}, focusedField: ${focusedField}`);
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
      contentTextareaRef.current.focus(); // Re-focus after action
    } else {
      toast({ title: "No Field Focused", description: "Please focus on the content area to apply formatting." });
    }
    setIsFormatMenuOpen(false);
    // updateToolbarPosition(); // Called by useEffect when isFormatMenuOpen changes
  };

  const onSubmit = async (data: ArticleFormData) => {
    if (!user) {
      toast({ variant: "destructive", title: "Not Authenticated", description: "You must be logged in." });
      return;
    }
    setIsSubmitting(true);
    console.log("Submitting Article Data (Placeholder):", data); // Placeholder
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
    // updateToolbarPosition(); // Called by useEffect
  };
  
  const titleValueFromForm = form.watch('title');
  const contentValueFromForm = form.watch('content');

  const shouldShowPlusButton = !isFormatMenuOpen && focusedField && (
    (focusedField === 'title' && titleValueFromForm.trim() === '') ||
    (focusedField === 'content' && isCurrentLineEmptyInTextarea(contentValueFromForm, cursorPosition))
  );

  const shouldShowExpandedMenu = focusedField && isFormatMenuOpen;

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
        <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-3xl mx-auto space-y-0 relative">
          
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
          
          <div ref={toolbarRef} style={toolbarStyle} className="flex items-center gap-0.5 bg-background p-0.5 rounded-full border shadow-md">
             <Button 
                type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" 
                onClick={() => setIsFormatMenuOpen(prev => !prev)}
                onMouseDown={(e) => e.preventDefault()}
             >
              {isFormatMenuOpen ? <X className="h-5 w-5" /> : <PlusCircle className="h-5 w-5" />}
            </Button>
            {shouldShowExpandedMenu && (
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

