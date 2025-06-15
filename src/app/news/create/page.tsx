
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, Save, Send, ImageUp } from 'lucide-react';
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

const CreateNewsArticlePage = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [storyContent, setStoryContent] = useState(""); // Manages innerHTML of the contentEditable div
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [publishAttempted, setPublishAttempted] = useState(false);
  const [titleError, setTitleError] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [storyError, setStoryError] = useState("");

  const contentEditableRef = useRef<HTMLDivElement>(null);
  const coverImageInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null); // Ref for title input

  const validateFields = useCallback(() => {
    let isValid = true;
    if (!title.trim()) {
      setTitleError("Title is required.");
      isValid = false;
    } else {
      setTitleError("");
    }

    if (!category) {
      setCategoryError("Category is required.");
      isValid = false;
    } else {
      setCategoryError("");
    }

    const currentStoryText = contentEditableRef.current?.textContent || "";
    const currentStoryHTML = contentEditableRef.current?.innerHTML || "";
    // A basic check for non-textual content like images. More complex checks might be needed for other block elements.
    const hasNonTextualContent = /<img[^>]*>/.test(currentStoryHTML);

    if (currentStoryText.trim() === '' && !hasNonTextualContent) {
      setStoryError("Story content is required.");
      isValid = false;
    } else {
      setStoryError("");
    }
    return isValid;
  }, [title, category, contentEditableRef]);


  const handlePublish = () => {
    setPublishAttempted(true);
    if (!validateFields()) {
        // Optionally focus the first error field
        if (!title.trim() && titleInputRef.current) titleInputRef.current.focus();
        else if (!category) { /* No easy way to focus select */ }
        else if (contentEditableRef.current && (contentEditableRef.current.textContent || "").trim() === '') contentEditableRef.current.focus();
        return;
    }

    setIsSubmitting(true);
    // Use contentEditableRef.current.innerHTML for the actual content to publish
    const finalStoryContent = contentEditableRef.current?.innerHTML || "";
    console.log("Publishing Article Data:", {
      title: title.trim(),
      category,
      storyContent: finalStoryContent,
    });

    new Promise(resolve => setTimeout(resolve, 1500)).then(() => {
      toast({ title: "Article Submitted (Placeholder)", description: `"${title.trim()}" published.` });
      setIsSubmitting(false);
      // Reset fields
      setTitle("");
      setCategory("");
      setStoryContent(""); // Update state
      if (contentEditableRef.current) {
        contentEditableRef.current.innerHTML = ""; // Explicitly clear the div
      }
      setPublishAttempted(false);
      setTitleError("");
      setCategoryError("");
      setStoryError("");
    });
  };

  const handleContentEditableInput = (event: React.FormEvent<HTMLDivElement>) => {
    const newContent = event.currentTarget.innerHTML;
    setStoryContent(newContent); // Keep state in sync with innerHTML
    if (publishAttempted) { // Clear error on input if publish was attempted
      const textContent = event.currentTarget.textContent || "";
      const hasNonTextualContent = /<img[^>]*>/.test(newContent);
      if (textContent.trim() !== '' || hasNonTextualContent) {
        setStoryError("");
      } else {
        setStoryError("Story content is required.");
      }
    }
  };
  
  // Auto-adjust height of contentEditable div
  useEffect(() => {
    if (contentEditableRef.current) {
      contentEditableRef.current.style.height = 'auto'; // Reset height to get accurate scrollHeight
      // Add a small buffer (e.g., 2px) to scrollHeight if needed for exact fit, depends on box-sizing
      contentEditableRef.current.style.height = `${contentEditableRef.current.scrollHeight}px`;
    }
  }, [storyContent]); // Re-run when storyContent (innerHTML) changes

  if (authLoading) return <div className="container mx-auto p-4 md:p-8 flex justify-center items-center min-h-[calc(100vh-10rem)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  if (!user) return <div className="container mx-auto p-4 md:p-8 text-center min-h-[calc(100vh-10rem)] flex flex-col justify-center items-center"><p className="text-lg font-semibold text-foreground">Please log in to create news.</p><Button onClick={() => router.push('/login')} className="mt-4">Log In</Button></div>;

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <div className="max-w-3xl mx-auto space-y-0 relative">
        <div className="flex items-center justify-end gap-x-3 gap-y-2 mb-6 flex-wrap">
          <div className="flex items-center gap-2 mr-auto">
            <div className="space-y-1">
              <Select
                onValueChange={(value) => {
                  setCategory(value);
                  if (publishAttempted) {
                    if (value) setCategoryError("");
                    else setCategoryError("Category is required.");
                  }
                }}
                value={category}
                disabled={isSubmitting}
              >
                <SelectTrigger className="text-xs py-1.5 h-9 w-auto min-w-[140px] sm:w-[160px] focus-visible:ring-0 focus-visible:ring-offset-0">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {newsCategories.map((cat) => (
                    <SelectItem key={cat} value={cat} className="text-sm">{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {publishAttempted && categoryError && !isMobile && <p className="text-xs text-destructive hidden sm:block">{categoryError}</p>}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => coverImageInputRef.current?.click()} disabled={isSubmitting} className="text-xs py-1.5 h-9">
              <ImageUp className="mr-1.5 h-3.5 w-3.5" />
              <span className="hidden sm:inline">Cover Image</span>
              <span className="sm:hidden">Image</span>
            </Button>
            <Input id="article-image-input-header" type="file" accept="image/*" className="hidden" ref={coverImageInputRef} disabled={isSubmitting} />
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => console.log("Save Draft clicked. Data:", {title, category, storyContent})} disabled={isSubmitting} className="text-xs py-1.5 h-9 rounded-full">
              <Save className="mr-1.5 h-3.5 w-3.5" /> Save Draft
            </Button>
            <Button type="button" onClick={handlePublish} disabled={isSubmitting} className="text-xs py-1.5 bg-green-600 hover:bg-green-700 text-white h-9 rounded-full">
              {isSubmitting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
              Publish
            </Button>
          </div>
        </div>
        {publishAttempted && categoryError && isMobile && <p className="text-center text-sm mb-2 text-destructive sm:hidden">{categoryError}</p>}
        {!publishAttempted && !category && <p className="text-center text-sm mb-2 text-destructive hidden sm:block">Category is required for publishing.</p>}


        <div className="relative mb-4">
          <Input
            ref={titleInputRef}
            placeholder="Title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (publishAttempted) {
                if (e.target.value.trim()) setTitleError("");
                else setTitleError("Title is required.");
              }
            }}
            disabled={isSubmitting}
            className="text-4xl lg:text-5xl font-bold border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-0 placeholder:text-muted-foreground/50 h-auto py-2"
            autoComplete="off"
          />
          {publishAttempted && titleError && <p className="text-xs text-destructive mt-1">{titleError}</p>}
        </div>

        <div
          ref={contentEditableRef}
          contentEditable={!isSubmitting}
          onInput={handleContentEditableInput}
          data-placeholder="Tell your story..."
          className={cn(
            "w-full rounded-md border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-0 placeholder:text-muted-foreground/50 py-2 font-normal text-start no-underline tracking-normal whitespace-normal break-words normal-case overflow-y-hidden min-h-0",
            "focus:outline-none",
            // Apply styles from previous Textarea
            "py-2 font-normal text-start no-underline tracking-normal whitespace-normal break-words normal-case"
          )}
          style={{
            fontFamily: "medium-content-sans-serif-font, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Oxygen, Ubuntu, Cantarell, \"Open Sans\", \"Helvetica Neue\", sans-serif",
            fontSize: "20px",
            lineHeight: "28px",
            color: "hsl(var(--foreground))", // Use theme variable
            minHeight: "28px", // Start with roughly one line height
          }}
          role="textbox"
          aria-multiline="true"
          aria-label="News article content"
          // No value prop, content is managed via innerHTML and storyContent state
        />
        {publishAttempted && storyError && <p className="text-xs text-destructive mt-1">{storyError}</p>}
        <style jsx global>{`
          div[contentEditable="true"][data-placeholder]:empty:before {
            content: attr(data-placeholder);
            color: hsl(var(--muted-foreground) / 0.5);
            pointer-events: none;
            display: block;
          }
        `}</style>
      </div>
    </div>
  );
};

export default CreateNewsArticlePage;
