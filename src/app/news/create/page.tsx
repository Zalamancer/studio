
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

// Toolbar Component for visual debugging
const ToolbarComponentVisualDebug: React.FC<{
  focusedField: 'title' | 'content' | null;
  isFormatMenuOpen: boolean;
  onPlusClick: () => void;
  onFormatAction: (action: string) => void;
  toolbarRef: React.RefObject<HTMLDivElement>;
}> = ({ focusedField, isFormatMenuOpen, onPlusClick, onFormatAction, toolbarRef }) => {
  if (!focusedField) {
    console.log('[ToolbarDebug] Not rendering: focusedField is null.');
    return null;
  }

  let toolbarPositionClass = '';
  if (focusedField === 'title') {
    toolbarPositionClass = 'top-1/2 -translate-y-1/2 left-[-45px]'; // Position left of title
  } else if (focusedField === 'content') {
    toolbarPositionClass = 'top-2 left-[-45px]'; // Position top-left of content area
  }
  
  const style: React.CSSProperties = {
    position: 'absolute',
    zIndex: 50,
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    backgroundColor: 'hsl(var(--background))',
    padding: '2px',
    borderRadius: '9999px',
    border: '1px solid hsl(var(--border))',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  };

  const showPlusButtonTrigger = focusedField !== null && !isFormatMenuOpen;
  const showExpandedFormatMenu = focusedField !== null && isFormatMenuOpen;
  
  console.log('[ToolbarDebug] Rendering Toolbar. FocusedField:', focusedField, 'isFormatMenuOpen:', isFormatMenuOpen, "Applied Style:", style, "Position Class:", toolbarPositionClass);
  console.log('[ToolbarDebug] showPlusButtonTrigger:', showPlusButtonTrigger, 'showExpandedFormatMenu:', showExpandedFormatMenu);


  if (!showPlusButtonTrigger && !showExpandedFormatMenu) {
      console.log('[ToolbarDebug] Toolbar is hidden based on showPlusButtonTrigger and showExpandedFormatMenu states.');
      return null;
  }


  return (
    <div
      ref={toolbarRef}
      className={cn('absolute flex items-center gap-0.5 bg-background p-0.5 rounded-full border shadow-md', toolbarPositionClass)}
      style={{zIndex: 50}} // Keep zIndex high
    >
      {showPlusButtonTrigger && (
         <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full"
            onClick={onPlusClick}
            onMouseDown={(e) => e.preventDefault()}
          >
            <PlusCircle className="h-5 w-5" />
          </Button>
      )}
      
      {showExpandedFormatMenu && (
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full"
            onClick={onPlusClick} // This will toggle isFormatMenuOpen to false
            onMouseDown={(e) => e.preventDefault()}
          >
            <X className="h-5 w-5" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => onFormatAction('Image')} title="Add Image" onMouseDown={(e) => e.preventDefault()}><ImageIcon className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => onFormatAction('Upload')} title="Upload from device" onMouseDown={(e) => e.preventDefault()}><UploadCloud className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => onFormatAction('Video')} title="Add Video" onMouseDown={(e) => e.preventDefault()}><PlayCircle className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => onFormatAction('Embed')} title="Embed" onMouseDown={(e) => e.preventDefault()}><CodeIcon className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => onFormatAction('Code Block')} title="Code Block" onMouseDown={(e) => e.preventDefault()}><Braces className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => onFormatAction('Separator')} title="Add Separator" onMouseDown={(e) => e.preventDefault()}><Minus className="h-4 w-4" /></Button>
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
  
  const titleInputRef = useRef<HTMLInputElement>(null);
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

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

  const handleFocus = (field: 'title' | 'content') => {
    console.log('[FocusDebug] Field focused:', field);
    setFocusedField(field);
  };
  
  const handleBlur = (fieldToBlur: 'title' | 'content') => {
    setTimeout(() => {
      const activeElementIsToolbarButton = toolbarRef.current?.contains(document.activeElement);
      if (activeElementIsToolbarButton) {
        console.log('[BlurDebug] Blur prevented: Focus moved to toolbar for field:', fieldToBlur);
        if (fieldToBlur === 'title' && titleInputRef.current) titleInputRef.current.focus();
        else if (fieldToBlur === 'content' && contentTextareaRef.current) contentTextareaRef.current.focus();
        return; 
      }
      if (focusedField === fieldToBlur) { 
        console.log('[BlurDebug] Field blurred:', fieldToBlur, 'New active element:', document.activeElement);
        setFocusedField(null);
        setIsFormatMenuOpen(false);
      }
    }, 100);
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
      });
    }
  };

  const handleFormatButtonClick = (action: string) => {
    console.log('[FormatButtonClick] Action:', action, 'FocusedField:', focusedField);
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
    } else if (focusedField !== 'title') {
      toast({ title: "No Field Focused", description: "Please focus on the content area to apply formatting." });
    }
    setIsFormatMenuOpen(false);
  };
  
  const handleToggleFormatMenu = () => {
      console.log('[ToggleFormatMenu] Current isFormatMenuOpen:', isFormatMenuOpen);
      setIsFormatMenuOpen(prev => !prev);
      if (focusedField === 'title' && titleInputRef.current) titleInputRef.current.focus();
      else if (focusedField === 'content' && contentTextareaRef.current) contentTextareaRef.current.focus();
  };

  const onSubmit = async (data: ArticleFormData) => {
    if (!user) { toast({ variant: "destructive", title: "Not Authenticated", description: "You must be logged in." }); return; }
    setIsSubmitting(true); console.log("Submitting Article Data (Placeholder):", data); await new Promise(resolve => setTimeout(resolve, 1500));
    toast({ title: "Article Submitted (Placeholder)", description: `"${data.title}" would be processed.` });
    setIsSubmitting(false); form.reset(); setFocusedField(null); setIsFormatMenuOpen(false);
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
          
          <div className="relative">
            <ToolbarComponentVisualDebug focusedField={focusedField} isFormatMenuOpen={isFormatMenuOpen} onPlusClick={handleToggleFormatMenu} onFormatAction={handleFormatButtonClick} toolbarRef={toolbarRef} />
            <FormField control={form.control} name="title" render={({ field }) => ( <FormItem className="mb-8"><FormControl><Input ref={node => { field.ref(node); (titleInputRef as React.MutableRefObject<HTMLInputElement | null>).current = node; }} placeholder="Title" {...field} value={titleValueFromForm} onChange={(e) => form.setValue('title', e.target.value)} onFocus={() => handleFocus('title')} onBlur={() => handleBlur('title')} disabled={isSubmitting} className="text-4xl lg:text-5xl font-bold border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-0 placeholder:text-muted-foreground/50 h-auto py-2"/></FormControl><FormMessage /></FormItem>)} />
          </div>

          <div className="relative">
            <ToolbarComponentVisualDebug focusedField={focusedField} isFormatMenuOpen={isFormatMenuOpen} onPlusClick={handleToggleFormatMenu} onFormatAction={handleFormatButtonClick} toolbarRef={toolbarRef} />
            <FormField control={form.control} name="content" render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea
                    ref={node => { field.ref(node); (contentTextareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = node; }}
                    placeholder="Tell your story..."
                    className={cn(
                      "text-xl border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-0 min-h-[300px] resize-y placeholder:text-muted-foreground/50 py-2",
                      // Tailwind classes for direct style application
                      "text-[20px] leading-[28px] font-normal text-start no-underline tracking-normal break-words normal-case"
                    )}
                    style={{
                      fontFamily: 'medium-content-sans-serif-font, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif',
                      color: 'rgba(0, 0, 0, 0.84)',
                      // wordSpacing and whiteSpace are default, textTransform none is covered by normal-case
                    }}
                    {...field}
                    value={contentValueFromForm}
                    onChange={(e) => form.setValue('content', e.target.value)}
                    onFocus={() => handleFocus('content')}
                    onBlur={() => handleBlur('content')}
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

