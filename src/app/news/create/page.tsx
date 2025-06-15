
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
});

type ArticleFormData = z.infer<typeof articleSchema>;

const CreateNewsArticlePage = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [focusedField, setFocusedField] = useState<'title' | 'content' | null>(null);
  const [isFormatMenuOpen, setIsFormatMenuOpen] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [toolbarStyle, setToolbarStyle] = useState<React.CSSProperties>({ display: 'none', position: 'absolute' });

  const titleInputRef = useRef<HTMLInputElement>(null);
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null); // Will be conditionally assigned

  const form = useForm<ArticleFormData>({
    resolver: zodResolver(articleSchema),
    defaultValues: {
      title: "",
      content: "",
      category: "",
    },
  });

  const titleValueFromForm = form.watch('title');
  const contentValueFromForm = form.watch('content');

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

  const calculateCursorLineYOffset = useCallback((element: HTMLTextAreaElement | HTMLInputElement): number => {
    if (!element) return 0;

    if (element.tagName.toLowerCase() === 'input') {
      return element.offsetHeight / 2; // Center of the input
    }

    const textarea = element as HTMLTextAreaElement;
    const currentCursorPos = textarea.selectionStart || 0;
    const textBeforeCursor = textarea.value.substring(0, currentCursorPos);
    const lineNumber = (textBeforeCursor.match(/\n/g) || []).length;

    const computedStyle = window.getComputedStyle(textarea);
    let lineHeight = parseFloat(computedStyle.lineHeight);
    const paddingTop = parseFloat(computedStyle.paddingTop) || 0;

    if (isNaN(lineHeight) || lineHeight <= 0) {
      const fontSize = parseFloat(computedStyle.fontSize);
      lineHeight = !isNaN(fontSize) && fontSize > 0 ? fontSize * 1.4 : 20; // Estimate line height
    }
    return paddingTop + (lineNumber * lineHeight) + (lineHeight / 2); // Y pos to the middle of the current line
  }, []);

  const updateToolbarPosition = useCallback(() => {
    const newStyle: React.CSSProperties = { display: 'none', position: 'absolute', zIndex: 50 };
    const titleIsEmpty = titleValueFromForm.trim() === '';
    const contentLineIsEmpty = isCurrentLineEmptyInTextarea(contentValueFromForm, cursorPosition);

    const shouldShowPlusTrigger = !isFormatMenuOpen && focusedField && (
      (focusedField === 'title' && titleIsEmpty) ||
      (focusedField === 'content' && contentLineIsEmpty)
    );
    const shouldShowExpandedToolbarItself = focusedField && isFormatMenuOpen;
    const shouldToolbarBeVisibleAtAll = shouldShowPlusTrigger || shouldShowExpandedToolbarItself;

    if (shouldToolbarBeVisibleAtAll) {
      newStyle.display = 'flex';
      if (focusedField === 'title' && titleInputRef.current) {
        const fieldRect = titleInputRef.current.getBoundingClientRect();
        const parentRect = titleInputRef.current.parentElement?.getBoundingClientRect(); // div.relative
        if (parentRect) {
            newStyle.top = `${fieldRect.height / 2}px`; // Center of input
            newStyle.left = `-50px`; // 50px to the left of the input's wrapper
            newStyle.transform = 'translateY(-50%)';
        } else {
            newStyle.display = 'none';
        }
      } else if (focusedField === 'content' && contentTextareaRef.current) {
        const parentRect = contentTextareaRef.current.parentElement?.getBoundingClientRect(); // div.relative
        if (parentRect) {
            const verticalOffset = calculateCursorLineYOffset(contentTextareaRef.current);
            newStyle.top = `${verticalOffset}px`;
            newStyle.left = `-50px`; // 50px to the left of the textarea's wrapper
            newStyle.transform = 'translateY(-50%)';
        } else {
            newStyle.display = 'none';
        }
      } else {
        newStyle.display = 'none';
      }
    }
    
    console.log('[ToolbarDebug]', {
        focusedField, isFormatMenuOpen, cursorPosition,
        titleValueFromFormIsEmpty: titleIsEmpty,
        contentValueFromFormLineIsEmpty: contentLineIsEmpty,
        shouldShowPlusTrigger, shouldShowExpandedToolbarItself, shouldToolbarBeVisibleAtAll,
        calculatedStyle: newStyle,
    });

    setToolbarStyle(newStyle);
  }, [
    focusedField, isFormatMenuOpen, cursorPosition,
    titleValueFromForm, contentValueFromForm,
    isCurrentLineEmptyInTextarea, calculateCursorLineYOffset
  ]);

  useEffect(() => {
    updateToolbarPosition();
  }, [updateToolbarPosition]); // updateToolbarPosition is memoized and its deps cover changes


  const handleFocus = (field: 'title' | 'content') => {
    setFocusedField(field);
    if (field === 'content' && contentTextareaRef.current) {
      setCursorPosition(contentTextareaRef.current.selectionStart || 0);
    }
    // No need to call updateToolbarPosition here, useEffect will catch focusedField change
  };
  
  const handleBlur = (fieldToBlur: 'title' | 'content') => {
    setTimeout(() => {
      const activeToolbarRef = fieldToBlur === 'title' ? titleToolbarRef.current : contentToolbarRef.current;
      const activeElementIsToolbarButton = activeToolbarRef?.contains(document.activeElement);
      
      if (activeElementIsToolbarButton) {
        if (fieldToBlur === 'title' && titleInputRef.current) titleInputRef.current.focus();
        else if (fieldToBlur === 'content' && contentTextareaRef.current) contentTextareaRef.current.focus();
        return;
      }
      
      if (focusedField === fieldToBlur) { // Only nullify if it's still the currently focused one
        setFocusedField(null);
        setIsFormatMenuOpen(false); // Always close menu on blur if not interacting with toolbar
      }
    }, 100); // A small delay can help with immediate re-focus or toolbar clicks
  };
  
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    form.setValue('title', e.target.value, { shouldValidate: true, shouldDirty: true });
    // updateToolbarPosition will be called via useEffect watching titleValueFromForm
  };
  
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    form.setValue('content', newText, { shouldValidate: true, shouldDirty: true });
    if (contentTextareaRef.current) {
      setCursorPosition(contentTextareaRef.current.selectionStart || 0);
    }
    // updateToolbarPosition will be called via useEffect watching contentValueFromForm & cursorPosition
  };

  const handleContentKeyUpOrMouseUp = () => {
    if (contentTextareaRef.current) {
      const newCursorPos = contentTextareaRef.current.selectionStart || 0;
      if (newCursorPos !== cursorPosition) {
        setCursorPosition(newCursorPos); 
      }
    }
    // updateToolbarPosition will be called via useEffect watching cursorPosition
  };

  const insertTextIntoContent = (textToInsert: string) => {
    if (contentTextareaRef.current) {
      const textarea = contentTextareaRef.current;
      const start = textarea.selectionStart || 0;
      const end = textarea.selectionEnd || 0;
      const currentValue = form.getValues('content');
      const newValue = currentValue.substring(0, start) + textToInsert + currentValue.substring(end);
      
      form.setValue('content', newValue, { shouldValidate: true, shouldDirty: true });
      setCursorPosition(start + textToInsert.length); // Update cursor position state
      
      requestAnimationFrame(() => { // Defer focus and selection update
        textarea.focus();
        textarea.setSelectionRange(start + textToInsert.length, start + textToInsert.length);
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
          const start = textarea.selectionStart || 0;
          const end = textarea.selectionEnd || 0;
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
    setIsFormatMenuOpen(false);
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
    setCursorPosition(0);
  };
  
  const titleFieldIsEmpty = titleValueFromForm.trim() === '';
  const contentFieldLineIsEmpty = isCurrentLineEmptyInTextarea(contentValueFromForm, cursorPosition);

  const showPlusButtonTrigger = !isFormatMenuOpen && focusedField && (
    (focusedField === 'title' && titleFieldIsEmpty) ||
    (focusedField === 'content' && contentFieldLineIsEmpty)
  );

  const showExpandedFormatMenu = focusedField && isFormatMenuOpen;

  const titleToolbarRef = useRef<HTMLDivElement>(null);
  const contentToolbarRef = useRef<HTMLDivElement>(null);


  const ToolbarComponent = ({ onPlusClick }: { onPlusClick: () => void }) => (
    <div
      style={toolbarStyle}
      className="flex items-center gap-0.5 bg-background p-0.5 rounded-full border shadow-md"
    >
      {(showPlusButtonTrigger || showExpandedFormatMenu) && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full"
          onClick={onPlusClick}
          onMouseDown={(e) => e.preventDefault()}
        >
          {isFormatMenuOpen ? <X className="h-5 w-5" /> : <PlusCircle className="h-5 w-5" />}
        </Button>
      )}
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
  );

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
        <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-3xl mx-auto space-y-0">
          
          <div className="flex items-center justify-end gap-x-3 gap-y-2 mb-6 flex-wrap">
            {/* Category and Image Upload moved here */}
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
                {form.formState.errors.category && form.formState.isSubmitted && (
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
          {form.formState.errors.category && form.formState.isSubmitted && !form.formState.errors.category.ref?.closest('sm:hidden') && (
            <FormItem><FormMessage className="text-center text-sm mb-2" /></FormItem>
          )}
          
          <div className="relative"> 
            {focusedField === 'title' && (
              <div ref={titleToolbarRef}>
                <ToolbarComponent onPlusClick={() => {
                  setIsFormatMenuOpen(prev => !prev);
                  if(titleInputRef.current) titleInputRef.current.focus();
                }} />
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
                      value={titleValueFromForm}
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

          <div className="relative"> 
            {focusedField === 'content' && (
               <div ref={contentToolbarRef}>
                  <ToolbarComponent onPlusClick={() => {
                    setIsFormatMenuOpen(prev => !prev);
                    if(contentTextareaRef.current) contentTextareaRef.current.focus();
                  }} />
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
                      className="text-xl border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-0 min-h-[300px] resize-y placeholder:text-muted-foreground/50 py-2"
                      {...field}
                      value={contentValueFromForm}
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
    
