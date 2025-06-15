
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
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
  style: React.CSSProperties;
  toolbarRef: React.RefObject<HTMLDivElement>;
}

const ToolbarComponent: React.FC<ToolbarComponentProps> = ({
  toolbarRef,
  isFormatMenuOpen,
  onPlusClick,
  onFormatAction,
  style,
}) => {
  return (
    <div
      ref={toolbarRef}
      style={style}
      className={cn("flex items-center gap-x-0.5 bg-card p-0.5 rounded-full border border-border shadow-lg")}
      data-toolbar-button="true"
      onMouseDown={(e) => e.preventDefault()}
    >
      {!isFormatMenuOpen ? (
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={onPlusClick} title="Show formatting options" data-toolbar-button="true" onMouseDown={(e) => e.preventDefault()}>
          <PlusCircle className="h-5 w-5" />
        </Button>
      ) : (
        <>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={onPlusClick} title="Close Menu" data-toolbar-button="true" onMouseDown={(e) => e.preventDefault()}><X className="h-5 w-5" /></Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => onFormatAction('Image')} title="Add Image URL" data-toolbar-button="true" onMouseDown={(e) => e.preventDefault()}><ImageIcon className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => onFormatAction('Upload')} title="Upload Image (Placeholder)" data-toolbar-button="true" onMouseDown={(e) => e.preventDefault()}><UploadCloud className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => onFormatAction('Video')} title="Add Video URL" data-toolbar-button="true" onMouseDown={(e) => e.preventDefault()}><PlayCircle className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => onFormatAction('Embed')} title="Embed Content" data-toolbar-button="true" onMouseDown={(e) => e.preventDefault()}><CodeIcon className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => onFormatAction('Code Block')} title="Code Block" data-toolbar-button="true" onMouseDown={(e) => e.preventDefault()}><Braces className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => onFormatAction('Separator')} title="Add Separator" data-toolbar-button="true" onMouseDown={(e) => e.preventDefault()}><Minus className="h-4 w-4" /></Button>
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
  const [cursorPosition, setCursorPosition] = useState(0);
  const [toolbarStyle, setToolbarStyle] = useState<React.CSSProperties>({ display: 'none' });

  const formRef = useRef<HTMLFormElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const titleWrapperRef = useRef<HTMLDivElement>(null);
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const contentWrapperRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const form = useForm<ArticleFormData>({
    resolver: zodResolver(articleSchema),
    defaultValues: { title: "", content: "", category: "" },
  });

  const titleValueFromForm = form.watch('title');
  const contentValueFromForm = form.watch('content');

  const getCurrentLineText = useCallback((textarea: HTMLTextAreaElement, currentCursorPos: number): string => {
    const text = textarea.value;
    if (!text) return "";

    let lineStart = text.lastIndexOf('\n', currentCursorPos - 1) + 1;
    let lineEnd = text.indexOf('\n', currentCursorPos);
    if (lineEnd === -1) lineEnd = text.length;

    return text.substring(lineStart, lineEnd);
  }, []);

  const calculateCursorLineYOffset = useCallback((fieldElement: HTMLTextAreaElement | HTMLInputElement, currentCursorPosition: number): string => {
    if (!fieldElement) return '50%';

    const computedStyle = window.getComputedStyle(fieldElement);
    let lineHeight = parseFloat(computedStyle.lineHeight);
    if (isNaN(lineHeight) || lineHeight <= 0) {
      const fontSize = parseFloat(computedStyle.fontSize) || 16; // Default font size if not found
      lineHeight = fontSize * 1.4; // Common multiplier for line height
    }
    const paddingTop = parseFloat(computedStyle.paddingTop) || 0;

    if (fieldElement.value === '' || currentCursorPosition === 0) {
      return `${paddingTop + lineHeight / 2}px`;
    }

    const textUptoCursor = fieldElement.value.substring(0, currentCursorPosition);
    const lineNumber = (textUptoCursor.match(/\n/g) || []).length;
    const lineY = paddingTop + (lineNumber * lineHeight) + (lineHeight / 2);

    const relativeY = Math.max(lineHeight / 2, Math.min(lineY, fieldElement.offsetHeight - lineHeight / 2));
    return `${relativeY}px`;
  }, []);

  const updateToolbarPosition = useCallback(() => {
    requestAnimationFrame(() => {
      const newStyle: React.CSSProperties = { display: 'none', position: 'absolute', zIndex: 50 };
      const formEl = formRef.current;
      const titleWrapperEl = titleWrapperRef.current;
      const titleInputEl = titleInputRef.current;
      const contentWrapperEl = contentWrapperRef.current;
      const contentTextareaEl = contentTextareaRef.current;

      let titleIsEmpty = false;
      if (focusedField === 'title' && titleInputEl) {
          titleIsEmpty = titleInputEl.value.trim() === '';
      }

      let contentLineIsEmpty = false;
      if (focusedField === 'content' && contentTextareaEl) {
          const currentLine = getCurrentLineText(contentTextareaEl, cursorPosition);
          contentLineIsEmpty = currentLine.trim() === '';
      }
      
      if (focusedField === 'title' && titleIsEmpty && titleWrapperEl && formEl) {
        const wrapperRect = titleWrapperEl.getBoundingClientRect();
        const formRect = formEl.getBoundingClientRect();
        newStyle.top = `${wrapperRect.top - formRect.top + wrapperRect.height / 2}px`;
        newStyle.left = `${wrapperRect.left - formRect.left - 50}px`; // e.g. 50px to the left
        newStyle.transform = 'translateY(-50%)';
        newStyle.display = 'flex';
      } else if (focusedField === 'content' && contentLineIsEmpty && contentWrapperEl && contentTextareaEl && formEl) {
        const wrapperRect = contentWrapperEl.getBoundingClientRect();
        const formRect = formEl.getBoundingClientRect();
        const calculatedTopOffsetPx = parseFloat(calculateCursorLineYOffset(contentTextareaEl, cursorPosition));
        
        newStyle.top = `${wrapperRect.top - formRect.top + calculatedTopOffsetPx}px`;
        newStyle.left = `${wrapperRect.left - formRect.left - 50}px`; // e.g. 50px to the left
        newStyle.transform = 'translateY(-50%)'; // Center toolbar vertically against cursor line
        newStyle.display = 'flex';
      }
      setToolbarStyle(newStyle);
    });
  }, [focusedField, cursorPosition, titleValueFromForm, contentValueFromForm, getCurrentLineText, calculateCursorLineYOffset]);

  useEffect(() => {
    updateToolbarPosition();
  }, [focusedField, isFormatMenuOpen, cursorPosition, titleValueFromForm, contentValueFromForm, updateToolbarPosition]);

  const handleFocus = (field: 'title' | 'content') => {
    console.log('[FocusDebug] Field focused:', field);
    setFocusedField(field);
    setIsFormatMenuOpen(false); // Close format menu on field change
    if (field === 'content' && contentTextareaRef.current) {
      setCursorPosition(contentTextareaRef.current.selectionStart || 0);
    }
  };

  const handleBlur = (fieldToBlur: 'title' | 'content') => {
    queueMicrotask(() => {
      const activeElement = document.activeElement;
      const isFocusStillWithinToolbar = toolbarRef.current?.contains(activeElement as Node);

      if (isFocusStillWithinToolbar) {
        console.log(`[BlurDebug] Toolbar interaction detected for ${fieldToBlur}. Keeping focus.`);
        if (fieldToBlur === 'title' && titleInputRef.current) titleInputRef.current.focus();
        else if (fieldToBlur === 'content' && contentTextareaRef.current) contentTextareaRef.current.focus();
      } else {
        console.log(`[BlurDebug] Field blurred, and not a toolbar click: ${fieldToBlur}`);
        if (focusedField === fieldToBlur) { // Only reset if the blurred field was indeed the focused one
          setFocusedField(null);
          setIsFormatMenuOpen(false);
        }
      }
    });
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
        setCursorPosition(newCursorPos);
      });
    }
  };

  const handleFormatButtonClick = (action: string) => {
    if (focusedField === 'title' && titleInputRef.current) {
      toast({ title: "Action Not Applicable", description: `Cannot apply "${action}" to title.`, variant: "default" });
      setIsFormatMenuOpen(false);
      titleInputRef.current?.focus();
      return;
    }
    if (focusedField === 'content' && contentTextareaRef.current) {
      switch (action) {
        case 'Image': { const url = window.prompt("Enter image URL:"); if (url) insertTextIntoContent(`\n![Image Alt Text](${url})\n`); break; }
        case 'Upload': { toast({ title: "Placeholder", description: "File upload needs server setup." }); insertTextIntoContent(`\n![Placeholder Image](path/to/image.jpg)\n`); break; }
        case 'Video': { const url = window.prompt("Enter video URL:"); if (url) insertTextIntoContent(`\n[Watch Video: ${url}](${url})\n`); break; }
        case 'Embed': { const code = window.prompt("Paste embed code:"); if (code) insertTextIntoContent(`\n${code}\n`); break; }
        case 'Code Block': { insertTextIntoContent("\n```\nYour code here\n```\n"); break; }
        case 'Separator': insertTextIntoContent("\n---\n"); break;
        default: toast({ title: "Action", description: `${action} clicked.` });
      }
      contentTextareaRef.current.focus();
      handleContentInteraction(); // Update cursor position after insert
    }
    setIsFormatMenuOpen(false); // Close menu after action
  };

  const handleToggleFormatMenu = () => {
    setIsFormatMenuOpen(prev => !prev);
    if (focusedField === 'title') titleInputRef.current?.focus();
    else if (focusedField === 'content') contentTextareaRef.current?.focus();
  };

  const onSubmit = async (data: ArticleFormData) => {
    if (!user) { toast({ variant: "destructive", title: "Not Authenticated" }); return; }
    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API call
    toast({ title: "Article Submitted (Placeholder)", description: `"${data.title}" saved.` });
    setIsSubmitting(false);
    form.reset();
    setFocusedField(null); setIsFormatMenuOpen(false); setCursorPosition(0);
  };

  if (authLoading) return <div className="container mx-auto p-4 md:p-8 flex justify-center items-center min-h-[calc(100vh-10rem)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  if (!user) return <div className="container mx-auto p-4 md:p-8 text-center min-h-[calc(100vh-10rem)] flex flex-col justify-center items-center"><p className="text-lg font-semibold text-foreground">Please log in to create news.</p><Button onClick={() => router.push('/login')} className="mt-4">Log In</Button></div>;

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <Form {...form}>
        <form ref={formRef} onSubmit={form.handleSubmit(onSubmit)} className="max-w-3xl mx-auto space-y-0 relative">
          {/* Toolbar is a single instance, positioned relative to the form */}
          <ToolbarComponent
              toolbarRef={toolbarRef}
              isFormatMenuOpen={isFormatMenuOpen}
              onPlusClick={handleToggleFormatMenu}
              onFormatAction={handleFormatButtonClick}
              style={toolbarStyle}
          />
          <div className="flex items-center justify-end gap-x-3 gap-y-2 mb-6 flex-wrap">
            <div className="flex items-center gap-2 mr-auto">
              <FormField control={form.control} name="category" render={({ field }) => ( <FormItem><Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting}><FormControl><SelectTrigger className="text-xs py-1.5 h-9 w-auto min-w-[140px] sm:w-[160px] focus-visible:ring-0 focus-visible:ring-offset-0"><SelectValue placeholder="Category" /></SelectTrigger></FormControl><SelectContent>{newsCategories.map((category) => ( <SelectItem key={category} value={category} className="text-sm">{category}</SelectItem>))}</SelectContent></Select><FormMessage className="sm:hidden text-xs" /></FormItem>)} />
              <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('article-image-input-header')?.click()} disabled={isSubmitting} className="text-xs py-1.5 h-9"><ImageUp className="mr-1.5 h-3.5 w-3.5" /> <span className="hidden sm:inline">Cover Image</span><span className="sm:hidden">Image</span></Button><Input id="article-image-input-header" type="file" accept="image/*" className="hidden" disabled={isSubmitting}/>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => console.log("Save Draft clicked. Data:", form.getValues())} disabled={isSubmitting} className="text-xs py-1.5 h-9 rounded-full"><Save className="mr-1.5 h-3.5 w-3.5" /> Save Draft</Button>
              <Button type="submit" disabled={isSubmitting} className="text-xs py-1.5 bg-green-600 hover:bg-green-700 text-white h-9 rounded-full">{isSubmitting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}Publish</Button>
            </div>
          </div>
          <FormField control={form.control} name="category" render={() => <FormItem><FormMessage className="text-center text-sm mb-2 hidden sm:block" /></FormItem>} />

          <div className="relative" ref={titleWrapperRef}>
            <FormField control={form.control} name="title" render={({ field }) => ( <FormItem className="mb-8"><FormControl><Input ref={titleInputRef} placeholder="Title" {...field} onChange={(e) => { field.onChange(e); }} onFocus={() => handleFocus('title')} onBlurCapture={() => handleBlur('title')} disabled={isSubmitting} className="text-4xl lg:text-5xl font-bold border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-0 placeholder:text-muted-foreground/50 h-auto py-2"/></FormControl><FormMessage /></FormItem>)} />
          </div>

          <div className="relative" ref={contentWrapperRef}>
            <FormField control={form.control} name="content" render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea
                    ref={contentTextareaRef}
                    placeholder="Tell your story..."
                    className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-0 min-h-[300px] resize-y placeholder:text-muted-foreground/50 py-2 font-normal text-start no-underline tracking-normal whitespace-normal break-words normal-case"
                    style={{ fontFamily: 'medium-content-sans-serif-font, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif', fontSize: '20px', lineHeight: '28px', color: 'rgba(0, 0, 0, 0.84)' }}
                    {...field}
                    onChange={(e) => { field.onChange(e); handleContentInteraction(); }}
                    onFocus={() => handleFocus('content')}
                    onBlurCapture={() => handleBlur('content')}
                    onKeyUp={handleContentInteraction}
                    onMouseUp={handleContentInteraction}
                    onClick={handleContentInteraction}
                    disabled={isSubmitting}
                    value={contentValueFromForm} // Controlled component
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

