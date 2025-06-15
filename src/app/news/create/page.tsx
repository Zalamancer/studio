
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

interface ToolbarComponentProps {
  isFormatMenuOpen: boolean;
  onPlusClick: () => void;
  onFormatAction: (action: string) => void;
  style: React.CSSProperties; // To control position and visibility
  toolbarRef: React.RefObject<HTMLDivElement>;
}

const ToolbarComponent: React.FC<ToolbarComponentProps> = ({
  isFormatMenuOpen,
  onPlusClick,
  onFormatAction,
  style,
  toolbarRef,
}) => {
  return (
    <div
      ref={toolbarRef}
      style={style}
      className={cn(
        "absolute flex items-center gap-x-0.5 bg-card p-0.5 rounded-full border border-border shadow-lg z-50"
      )}
      onMouseDown={(e) => e.preventDefault()} // Prevent input blur when toolbar button is clicked
      data-toolbar-button="true" // Add custom attribute for blur check
    >
      {!isFormatMenuOpen ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full"
          onClick={onPlusClick}
          title="Show formatting options"
        >
          <PlusCircle className="h-5 w-5" />
        </Button>
      ) : (
        <>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={onPlusClick} title="Close Menu"><X className="h-5 w-5" /></Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => onFormatAction('Image')} title="Add Image URL"><ImageIcon className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => onFormatAction('Upload')} title="Upload Image (Placeholder)"><UploadCloud className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => onFormatAction('Video')} title="Add Video URL"><PlayCircle className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => onFormatAction('Embed')} title="Embed Content"><CodeIcon className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => onFormatAction('Code Block')} title="Code Block"><Braces className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => onFormatAction('Separator')} title="Add Separator"><Minus className="h-4 w-4" /></Button>
        </>
      )}
    </div>
  );
};


const CreateNewsArticlePage = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [focusedField, setFocusedField] = useState<'title' | 'content' | null>(null);
  const [isFormatMenuOpen, setIsFormatMenuOpen] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0); // For content textarea

  const titleInputRef = useRef<HTMLInputElement>(null);
  const titleWrapperRef = useRef<HTMLDivElement>(null);
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const contentWrapperRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const [toolbarStyle, setToolbarStyle] = useState<React.CSSProperties>({ display: 'none' });

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

  const getCurrentLineText = useCallback((text: string, cursorPos: number): string => {
    if (!text) return "";
    const textBeforeCursor = text.substring(0, cursorPos);
    const currentLineStart = textBeforeCursor.lastIndexOf('\n') + 1;
    const textAfterCursor = text.substring(cursorPos);
    let currentLineEnd = textAfterCursor.indexOf('\n');
    if (currentLineEnd === -1) {
      currentLineEnd = textAfterCursor.length;
    }
    currentLineEnd += cursorPos;
    return text.substring(currentLineStart, currentLineEnd);
  }, []);


  const calculateCursorLineYOffset = useCallback((fieldElement: HTMLInputElement | HTMLTextAreaElement, currentCursorPosition: number): number => {
    if (!fieldElement) return 0;

    const computedStyle = window.getComputedStyle(fieldElement);
    let lineHeight = parseFloat(computedStyle.lineHeight);
    const paddingTop = parseFloat(computedStyle.paddingTop) || 0;

    if (isNaN(lineHeight) || lineHeight <= 0) {
        const fontSize = parseFloat(computedStyle.fontSize) || 16; // Fallback font size
        lineHeight = fontSize * 1.4; // Common heuristic for line height
    }

    if (fieldElement.tagName === 'INPUT') { // Single line input (Title)
        return (fieldElement.offsetHeight / 2) + fieldElement.offsetTop; // Center of the input field
    }

    // For Textarea (Content)
    const textUptoCursor = fieldElement.value.substring(0, currentCursorPosition);
    const lineNumber = (textUptoCursor.match(/\n/g) || []).length;
    const yOffset = (lineNumber * lineHeight) + paddingTop + (lineHeight / 2);

    return yOffset + fieldElement.offsetTop;
  }, []);


  const updateToolbarPosition = useCallback(() => {
    let newStyle: React.CSSProperties = { display: 'none', position: 'absolute', zIndex: 50 };
    let fieldIsEmptyOrCurrentLineIsEmpty = false;
    let targetElementWrapper: HTMLDivElement | null = null;
    let targetFieldElement: HTMLInputElement | HTMLTextAreaElement | null = null;

    if (focusedField === 'title' && titleInputRef.current && titleWrapperRef.current) {
      targetElementWrapper = titleWrapperRef.current;
      targetFieldElement = titleInputRef.current;
      fieldIsEmptyOrCurrentLineIsEmpty = titleValueFromForm.trim() === '';
    } else if (focusedField === 'content' && contentTextareaRef.current && contentWrapperRef.current) {
      targetElementWrapper = contentWrapperRef.current;
      targetFieldElement = contentTextareaRef.current;
      const currentLineText = getCurrentLineText(contentValueFromForm, cursorPosition);
      fieldIsEmptyOrCurrentLineIsEmpty = currentLineText.trim() === '';
    }

    if (targetElementWrapper && targetFieldElement && fieldIsEmptyOrCurrentLineIsEmpty) {
      const wrapperRect = targetElementWrapper.getBoundingClientRect();
      const formRect = (targetElementWrapper.closest('form') || document.body).getBoundingClientRect();

      const relativeOffsetTop = wrapperRect.top - formRect.top + targetElementWrapper.scrollTop;
      const cursorLineY = calculateCursorLineYOffset(targetFieldElement, cursorPosition);
      
      newStyle.top = `${relativeOffsetTop + cursorLineY - (targetFieldElement.offsetTop) - 14}px`; // 14 is half of toolbar height (28px/2) approx
      newStyle.left = `${targetElementWrapper.offsetLeft - 45}px`; // Position to the left of wrapper
      newStyle.display = 'flex';
    }
    
    setToolbarStyle(newStyle);
  }, [focusedField, titleValueFromForm, contentValueFromForm, cursorPosition, calculateCursorLineYOffset, getCurrentLineText]);


  useEffect(() => {
    updateToolbarPosition();
  }, [focusedField, isFormatMenuOpen, cursorPosition, titleValueFromForm, contentValueFromForm, updateToolbarPosition]);


  const handleFocus = (field: 'title' | 'content') => {
    setFocusedField(field);
    if (field === 'content' && contentTextareaRef.current) {
      setCursorPosition(contentTextareaRef.current.selectionStart || 0);
    }
    setIsFormatMenuOpen(false); // Close format menu on new field focus
  };

  const handleBlur = (fieldToBlur: 'title' | 'content') => {
    setTimeout(() => {
      const activeElementIsToolbarButton = document.activeElement?.closest('[data-toolbar-button="true"]');
      if (!activeElementIsToolbarButton) {
        if (focusedField === fieldToBlur) {
            setFocusedField(null);
            setIsFormatMenuOpen(false);
        }
      }
    }, 0);
  };

  const handleContentInteraction = () => {
    if (contentTextareaRef.current) {
      setCursorPosition(contentTextareaRef.current.selectionStart || 0);
    }
  };

  const insertTextIntoContent = (textToInsert: string) => {
    if (contentTextareaRef.current) {
      const textarea = contentTextareaRef.current;
      const start = textarea.selectionStart ?? textarea.value.length;
      const end = textarea.selectionEnd ?? textarea.value.length;
      const currentValue = form.getValues('content');
      const newValue = currentValue.substring(0, start) + textToInsert + currentValue.substring(end);
      form.setValue('content', newValue, { shouldValidate: true, shouldDirty: true });
      
      const newCursorPos = start + textToInsert.length;
      requestAnimationFrame(() => { 
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        setCursorPosition(newCursorPos); // Update cursor position state
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
        case 'Image': { const url = window.prompt("Enter image URL:"); if (url) insertTextIntoContent(`\n![Image Alt Text](${url})\n`); break; }
        case 'Upload': { toast({ title: "Placeholder Action", description: "Actual file upload requires further implementation. Inserting placeholder." }); insertTextIntoContent(`\n![Uploaded Image Placeholder](path/to/image.jpg)\n`); break; }
        case 'Video': { const url = window.prompt("Enter video URL (e.g., YouTube, Vimeo):"); if (url) insertTextIntoContent(`\n[Watch Video: ${url}](${url})\n`); break; }
        case 'Embed': { const embedCode = window.prompt("Paste embed code (e.g., iframe):"); if (embedCode) insertTextIntoContent(`\n${embedCode}\n`); break; }
        case 'Code Block': { const textarea = contentTextareaRef.current; const start = textarea.selectionStart || 0; const end = textarea.selectionEnd || 0; const selectedText = form.getValues('content').substring(start, end); if (selectedText) insertTextIntoContent("```\n" + selectedText + "\n```"); else insertTextIntoContent("\n```\nYour code here\n```\n"); break; }
        case 'Separator': insertTextIntoContent("\n---\n"); break;
        default: toast({ title: "Action (Placeholder)", description: `${action} clicked for ${focusedField}` });
      }
      contentTextareaRef.current.focus();
    }
    setIsFormatMenuOpen(false); // Close menu after action
  };
  
  const handleToggleFormatMenu = () => {
      setIsFormatMenuOpen(prev => !prev);
      if (focusedField === 'title' && titleInputRef.current) titleInputRef.current.focus();
      else if (focusedField === 'content' && contentTextareaRef.current) contentTextareaRef.current.focus();
  };

  const onSubmit = async (data: ArticleFormData) => {
    if (!user) { toast({ variant: "destructive", title: "Not Authenticated", description: "You must be logged in." }); return; }
    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 1500)); 
    toast({ title: "Article Submitted (Placeholder)", description: `"${data.title}" would be processed.` });
    setIsSubmitting(false);
    form.reset();
    setFocusedField(null);
    setIsFormatMenuOpen(false);
    setCursorPosition(0);
    setToolbarStyle({ display: 'none' });
  };

  if (authLoading) return <div className="container mx-auto p-4 md:p-8 flex justify-center items-center min-h-[calc(100vh-10rem)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  if (!user) return <div className="container mx-auto p-4 md:p-8 text-center min-h-[calc(100vh-10rem)] flex flex-col justify-center items-center"><p className="text-lg font-semibold text-foreground">Please log in to create a news article.</p><Button onClick={() => router.push('/login')} className="mt-4">Log In</Button></div>;

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-3xl mx-auto space-y-0"> {/* Reduced space-y-8 to space-y-0 for closer field spacing initially */}
          {/* Header controls: Category, Cover Image, Save, Publish */}
          <div className="flex items-center justify-end gap-x-3 gap-y-2 mb-6 flex-wrap">
            <div className="flex items-center gap-2 mr-auto"> {/* Pushed to left */}
                <FormField control={form.control} name="category" render={({ field }) => ( <FormItem><Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting}><FormControl><SelectTrigger className="text-xs py-1.5 h-9 w-auto min-w-[140px] sm:w-[160px] focus-visible:ring-0 focus-visible:ring-offset-0"><SelectValue placeholder="Category" /></SelectTrigger></FormControl><SelectContent>{newsCategories.map((category) => ( <SelectItem key={category} value={category} className="text-sm">{category}</SelectItem>))}</SelectContent></Select><FormMessage className="sm:hidden text-xs" /></FormItem>)} />
                <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('article-image-input-header')?.click()} disabled={isSubmitting} className="text-xs py-1.5 h-9"><ImageUp className="mr-1.5 h-3.5 w-3.5" /> <span className="hidden sm:inline">Cover Image</span><span className="sm:hidden">Image</span></Button><Input id="article-image-input-header" type="file" accept="image/*" className="hidden" disabled={isSubmitting}/>
            </div>
            <div className="flex items-center gap-2"> {/* Kept to right */}
              <Button type="button" variant="outline" onClick={() => console.log("Save Draft clicked. Data:", form.getValues())} disabled={isSubmitting} className="text-xs py-1.5 h-9 rounded-full"><Save className="mr-1.5 h-3.5 w-3.5" /> Save Draft</Button>
              <Button type="submit" disabled={isSubmitting} className="text-xs py-1.5 bg-green-600 hover:bg-green-700 text-white h-9 rounded-full">{isSubmitting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}Publish</Button>
            </div>
          </div>
          <FormField control={form.control} name="category" render={() => <FormItem><FormMessage className="text-center text-sm mb-2 hidden sm:block" /></FormItem>} />
          
          {/* Title Field */}
          <div className="relative" ref={titleWrapperRef}>
            {focusedField === 'title' && (
                <ToolbarComponent
                    toolbarRef={toolbarRef}
                    isFormatMenuOpen={isFormatMenuOpen}
                    onPlusClick={handleToggleFormatMenu}
                    onFormatAction={handleFormatButtonClick}
                    style={toolbarStyle}
                />
            )}
            <FormField control={form.control} name="title" render={({ field }) => ( <FormItem className="mb-8"><FormControl><Input ref={titleInputRef} placeholder="Title" {...field} value={titleValueFromForm} onChange={(e) => form.setValue('title', e.target.value)} onFocus={() => handleFocus('title')} onBlur={() => handleBlur('title')} disabled={isSubmitting} className="text-4xl lg:text-5xl font-bold border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-0 placeholder:text-muted-foreground/50 h-auto py-2"/></FormControl><FormMessage /></FormItem>)} />
          </div>

          {/* Content Field */}
          <div className="relative" ref={contentWrapperRef}>
            {focusedField === 'content' && (
                 <ToolbarComponent
                    toolbarRef={toolbarRef}
                    isFormatMenuOpen={isFormatMenuOpen}
                    onPlusClick={handleToggleFormatMenu}
                    onFormatAction={handleFormatButtonClick}
                    style={toolbarStyle}
                 />
            )}
            <FormField control={form.control} name="content" render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea
                    ref={contentTextareaRef}
                    placeholder="Tell your story..."
                    className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-0 min-h-[300px] resize-y placeholder:text-muted-foreground/50 py-2 font-normal text-start no-underline tracking-normal whitespace-normal break-words normal-case"
                    style={{
                      fontFamily: 'medium-content-sans-serif-font, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif',
                      fontSize: '20px',
                      lineHeight: '28px',
                      color: 'rgba(0, 0, 0, 0.84)',
                    }}
                    {...field}
                    value={contentValueFromForm} // Use watched value for direct control
                    onChange={(e) => {
                        form.setValue('content', e.target.value); // Update form state
                        handleContentInteraction(); // Update cursor position state
                    }}
                    onFocus={() => handleFocus('content')}
                    onBlur={() => handleBlur('content')}
                    onKeyUp={handleContentInteraction} // For arrow keys, backspace, delete
                    onMouseUp={handleContentInteraction} // For mouse-based selection changes
                    onClick={handleContentInteraction} // For clicks that change cursor without key press
                    disabled={isSubmitting}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        </form>
      </Form>
    </div>
  );
};

export default CreateNewsArticlePage;
        
