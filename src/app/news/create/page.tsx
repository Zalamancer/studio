
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
  style: React.CSSProperties; // For dynamic positioning
}

const ToolbarComponent: React.FC<ToolbarComponentProps> = ({
  isFormatMenuOpen,
  onPlusClick,
  onFormatAction,
  style,
}) => {
  return (
    <div
      style={style} // Apply dynamic style here
      className={cn(
        "flex items-center gap-x-0.5 bg-card p-0.5 rounded-full border border-border shadow-lg"
      )}
      onMouseDown={(e) => e.preventDefault()} // Prevent input blur on toolbar click
    >
      {!isFormatMenuOpen ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full"
          onClick={onPlusClick}
        >
          <PlusCircle className="h-5 w-5" />
        </Button>
      ) : (
        <>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={onPlusClick} title="Close Menu"><X className="h-5 w-5" /></Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => onFormatAction('Image')} title="Add Image"><ImageIcon className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => onFormatAction('Upload')} title="Upload from device"><UploadCloud className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => onFormatAction('Video')} title="Add Video"><PlayCircle className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => onFormatAction('Embed')} title="Embed"><CodeIcon className="h-4 w-4" /></Button>
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
  const [cursorPosition, setCursorPosition] = useState(0);
  const [toolbarStyle, setToolbarStyle] = useState<React.CSSProperties>({ display: 'none' });

  const titleInputRef = useRef<HTMLInputElement>(null);
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);

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

  const updateToolbarPosition = useCallback(() => {
    const newStyle: React.CSSProperties = {
      position: 'absolute',
      display: 'none',
      transform: 'translateY(-50%)',
      zIndex: 50,
      left: '-45px', // Default to the left, outside
    };

    if (focusedField === 'title' && titleInputRef.current) {
      newStyle.display = 'flex';
      newStyle.top = `${titleInputRef.current.offsetHeight / 2}px`;
    } else if (focusedField === 'content' && contentTextareaRef.current) {
      newStyle.display = 'flex';
      const textarea = contentTextareaRef.current;
      const currentText = textarea.value;
      const textUpToCursor = currentText.substring(0, cursorPosition);
      const currentLineNumber = textUpToCursor.split('\n').length;
      
      const computedStyle = window.getComputedStyle(textarea);
      let lineHeight = parseFloat(computedStyle.lineHeight);
      if (isNaN(lineHeight) || lineHeight === 0) {
        // Fallback: estimate based on font size or a common default
        const fontSize = parseFloat(computedStyle.fontSize);
        lineHeight = isNaN(fontSize) ? 28 : fontSize * 1.4; // 1.4 is a common multiplier
      }
      const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
      
      newStyle.top = `${paddingTop + ((currentLineNumber - 1) * lineHeight) + (lineHeight / 2)}px`;
    }
    
    // console.log('[ToolbarDebug] updateToolbarPosition:', { focusedField, cursorPosition, newStyle, contentVal: contentValueFromForm.substring(0,10) });
    setToolbarStyle(newStyle);
  }, [focusedField, cursorPosition, contentValueFromForm]); // titleValueFromForm not needed if visibility is just based on focus

  useEffect(() => {
    updateToolbarPosition();
  }, [focusedField, cursorPosition, isFormatMenuOpen, contentValueFromForm, updateToolbarPosition]);


  const handleFocus = (field: 'title' | 'content') => {
    // console.log(`[ToolbarDebug] Focus on: ${field}`);
    setFocusedField(field);
    if (field === 'content' && contentTextareaRef.current) {
      setCursorPosition(contentTextareaRef.current.selectionStart || 0);
    }
    // Reset isFormatMenuOpen when focus changes, unless it's already open from a click
    // This might be too aggressive, consider if toolbar should stay open when tabbing.
    // For now, let's keep it simple: focus means potential to show toolbar from scratch.
    if (!isFormatMenuOpen) { // Only reset if not explicitly opened
        setIsFormatMenuOpen(false);
    }
  };

  const handleBlur = (fieldToBlur: 'title' | 'content') => {
    // Delay hiding to allow clicks on toolbar buttons
    setTimeout(() => {
      // Check if the new focused element is part of *any* toolbar button
      const activeElementIsToolbarRelated = document.activeElement?.closest('[data-toolbar-button="true"]');
      if (!activeElementIsToolbarRelated) {
        if (focusedField === fieldToBlur) { // Ensure we are blurring the currently focused field
            // console.log(`[ToolbarDebug] Blur from: ${fieldToBlur}, new focus is NOT toolbar.`);
            setFocusedField(null);
            setIsFormatMenuOpen(false);
        }
      } else {
        // console.log(`[ToolbarDebug] Blur from: ${fieldToBlur}, but new focus IS toolbar. Keeping open.`);
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
    // console.log(`[ToolbarDebug] Format button clicked: ${action} for field: ${focusedField}`);
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
    setIsFormatMenuOpen(false);
  };
  
  const handleToggleFormatMenu = () => {
      // console.log(`[ToolbarDebug] Toggling format menu. Current state: ${isFormatMenuOpen}`);
      setIsFormatMenuOpen(prev => !prev);
      if (focusedField === 'title' && titleInputRef.current) titleInputRef.current.focus();
      else if (focusedField === 'content' && contentTextareaRef.current) contentTextareaRef.current.focus();
  };

  const onSubmit = async (data: ArticleFormData) => {
    if (!user) { toast({ variant: "destructive", title: "Not Authenticated", description: "You must be logged in." }); return; }
    setIsSubmitting(true);
    // console.log("Submitting article data:", data);
    await new Promise(resolve => setTimeout(resolve, 1500)); 
    toast({ title: "Article Submitted (Placeholder)", description: `"${data.title}" would be processed.` });
    setIsSubmitting(false);
    form.reset();
    setFocusedField(null);
    setIsFormatMenuOpen(false);
    setCursorPosition(0);
  };

  if (authLoading) return <div className="container mx-auto p-4 md:p-8 flex justify-center items-center min-h-[calc(100vh-10rem)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  if (!user) return <div className="container mx-auto p-4 md:p-8 text-center min-h-[calc(100vh-10rem)] flex flex-col justify-center items-center"><p className="text-lg font-semibold text-foreground">Please log in to create a news article.</p><Button onClick={() => router.push('/login')} className="mt-4">Log In</Button></div>;

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-3xl mx-auto space-y-0">
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
          
          <div className="relative"> {/* Wrapper for Title Input and its Toolbar */}
            {(focusedField === 'title') && (
              <ToolbarComponent
                isFormatMenuOpen={isFormatMenuOpen}
                onPlusClick={handleToggleFormatMenu}
                onFormatAction={handleFormatButtonClick}
                style={toolbarStyle}
              />
            )}
            <FormField control={form.control} name="title" render={({ field }) => ( <FormItem className="mb-8"><FormControl><Input ref={titleInputRef} placeholder="Title" {...field} value={titleValueFromForm} onChange={(e) => form.setValue('title', e.target.value)} onFocus={() => handleFocus('title')} onBlur={() => handleBlur('title')} disabled={isSubmitting} className="text-4xl lg:text-5xl font-bold border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-0 placeholder:text-muted-foreground/50 h-auto py-2"/></FormControl><FormMessage /></FormItem>)} />
          </div>

          <div className="relative"> {/* Wrapper for Content Textarea and its Toolbar */}
             {(focusedField === 'content') && (
              <ToolbarComponent
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
                    className={cn(
                      "border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-0 min-h-[300px] resize-y placeholder:text-muted-foreground/50 py-2",
                      "font-normal text-start no-underline tracking-normal whitespace-normal break-words normal-case"
                    )}
                    style={{
                      fontFamily: 'medium-content-sans-serif-font, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif',
                      fontSize: '20px',
                      lineHeight: '28px',
                      color: 'rgba(0, 0, 0, 0.84)',
                    }}
                    {...field}
                    value={contentValueFromForm} // Use watched value
                    onChange={(e) => {
                        form.setValue('content', e.target.value);
                        handleContentInteraction();
                    }}
                    onFocus={() => handleFocus('content')}
                    onBlur={() => handleBlur('content')}
                    onKeyUp={handleContentInteraction}
                    onMouseUp={handleContentInteraction}
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
    