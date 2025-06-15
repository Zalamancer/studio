
"use client";

import React, { useState, useEffect, useRef } from 'react';
// Removed useForm and zodResolver as react-hook-form is no longer used
// Removed * as z
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
// Removed Form, FormControl, FormField, FormItem, FormMessage from ui/form
import { Label } from '@/components/ui/label'; // Keep Label if used for title/category
import { Loader2, Save, Send, ImageUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils'; // For conditional class names

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

// No Zod schema or form data type needed as react-hook-form is removed

const CreateNewsArticlePage = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [storyContent, setStoryContent] = useState(""); // For the contentEditable div
  const [isSubmitting, setIsSubmitting] = useState(false); // For publish button state

  const contentEditableRef = useRef<HTMLDivElement>(null);

  // Placeholder for cover image input
  const coverImageInputRef = useRef<HTMLInputElement>(null);

  const handlePublish = async () => {
    if (!user) {
      toast({ variant: "destructive", title: "Not Authenticated" });
      return;
    }
    if (!title.trim()) {
      toast({ variant: "destructive", title: "Title Required", description: "Please enter a title for your article." });
      return;
    }
    if (!category) {
      toast({ variant: "destructive", title: "Category Required", description: "Please select a category." });
      return;
    }
    if (!storyContent.trim()) { // Check content from the div
      toast({ variant: "destructive", title: "Content Required", description: "Please write your story." });
      return;
    }

    setIsSubmitting(true);
    console.log("Publishing Article Data:", {
      title: title.trim(),
      category,
      storyContent: storyContent, // Or contentEditableRef.current?.innerHTML if you prefer direct DOM read
    });
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    toast({ title: "Article Submitted (Placeholder)", description: `"${title.trim()}" published.` });
    setIsSubmitting(false);
    // Reset fields
    setTitle("");
    setCategory("");
    setStoryContent("");
    if (contentEditableRef.current) {
      contentEditableRef.current.innerHTML = ""; // Clear the div
    }
  };
  
  // Function to handle input from contentEditable div
  const handleContentEditableInput = (event: React.FormEvent<HTMLDivElement>) => {
    const newContent = event.currentTarget.innerHTML;
    setStoryContent(newContent);
  };


  if (authLoading) return <div className="container mx-auto p-4 md:p-8 flex justify-center items-center min-h-[calc(100vh-10rem)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  if (!user) return <div className="container mx-auto p-4 md:p-8 text-center min-h-[calc(100vh-10rem)] flex flex-col justify-center items-center"><p className="text-lg font-semibold text-foreground">Please log in to create news.</p><Button onClick={() => router.push('/login')} className="mt-4">Log In</Button></div>;

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <div className="max-w-3xl mx-auto space-y-0 relative">
        {/* Header controls */}
        <div className="flex items-center justify-end gap-x-3 gap-y-2 mb-6 flex-wrap">
          <div className="flex items-center gap-2 mr-auto">
            {/* Category Select */}
            <div className="space-y-1">
              <Select onValueChange={setCategory} value={category} disabled={isSubmitting}>
                <SelectTrigger className="text-xs py-1.5 h-9 w-auto min-w-[140px] sm:w-[160px] focus-visible:ring-0 focus-visible:ring-offset-0">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {newsCategories.map((cat) => (
                    <SelectItem key={cat} value={cat} className="text-sm">{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!category && <p className="text-xs text-destructive sm:hidden">Category is required.</p>}
            </div>
            {/* Cover Image Button (Placeholder) */}
            <Button type="button" variant="outline" size="sm" onClick={() => coverImageInputRef.current?.click()} disabled={isSubmitting} className="text-xs py-1.5 h-9">
              <ImageUp className="mr-1.5 h-3.5 w-3.5" />
              <span className="hidden sm:inline">Cover Image</span>
              <span className="sm:hidden">Image</span>
            </Button>
            <Input id="article-image-input-header" type="file" accept="image/*" className="hidden" ref={coverImageInputRef} disabled={isSubmitting} />
          </div>
          {/* Action Buttons */}
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
        {!category && <p className="text-center text-sm mb-2 text-destructive hidden sm:block">Please select a category.</p>}


        {/* Title Field */}
        <div className="relative mb-8">
          <Input
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isSubmitting}
            className="text-4xl lg:text-5xl font-bold border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-0 placeholder:text-muted-foreground/50 h-auto py-2"
          />
          {!title.trim() && <p className="text-xs text-destructive mt-1">Title is required.</p>}
        </div>

        {/* ContentEditable Div for Story */}
        <div
          ref={contentEditableRef}
          contentEditable="true"
          onInput={handleContentEditableInput}
          data-placeholder="Tell your story..." // Placeholder via CSS
          className={cn(
            "w-full rounded-md border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-0 placeholder:text-muted-foreground/50 py-2 font-normal text-start no-underline tracking-normal whitespace-normal break-words normal-case min-h-[100px]", // min-h-[100px] to give some initial space
            "focus:outline-none", // Remove default focus outline on contentEditable
            // Apply styles from previous Textarea
            "border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-0 placeholder:text-muted-foreground/50 py-2 font-normal text-start no-underline tracking-normal whitespace-normal break-words normal-case"
          )}
          style={{
            fontFamily: "medium-content-sans-serif-font, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Oxygen, Ubuntu, Cantarell, \"Open Sans\", \"Helvetica Neue\", sans-serif",
            fontSize: "20px",
            lineHeight: "28px",
            color: "rgba(0, 0, 0, 0.84)", // This is black, consider theme variable later if needed
            // Height will be auto-adjusted by browser based on content due to no explicit height and overflow settings
          }}
          // Role and ARIA attributes for accessibility (basic example)
          role="textbox"
          aria-multiline="true"
          aria-label="News article content"
        />
         {!storyContent.trim() && <p className="text-xs text-destructive mt-1">Story content is required.</p>}


        {/* CSS for contentEditable placeholder */}
        <style jsx global>{`
          div[contentEditable="true"][data-placeholder]:empty:before {
            content: attr(data-placeholder);
            color: hsl(var(--muted-foreground) / 0.5);
            pointer-events: none; /* Ensure placeholder doesn't interfere with clicks */
            display: block; /* Ensures it takes up space */
          }
          .dark div[contentEditable="true"][data-placeholder]:empty:before {
            color: hsl(var(--muted-foreground) / 0.5); /* Adjust placeholder color for dark mode if needed */
          }
        `}</style>

      </div>
    </div>
  );
};

export default CreateNewsArticlePage;
