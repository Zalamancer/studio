
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
import { Loader2, Save, Send, ImageUp, PlusCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

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

const TOOLBAR_HEIGHT = 36; 
const TOOLBAR_WIDTH_WITH_OFFSET = 60; 

interface InlineToolbarProps {
  style: React.CSSProperties;
}

const InlineToolbar: React.FC<InlineToolbarProps> = ({ style }) => {
  return (
    <div
      style={style}
      className="bg-card border p-1 rounded-md shadow-lg flex items-center space-x-1"
    >
      <button
        onMouseDown={(e) => e.preventDefault()} // Prevent focus loss from contentEditable
        className="p-1.5 hover:bg-muted rounded focus:outline-none focus:ring-1 focus:ring-primary"
        aria-label="Add element"
        title="Add element"
      >
        <PlusCircle className="h-5 w-5 text-primary" />
      </button>
    </div>
  );
};

const CreateNewsArticlePage = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const isMobileHook = useIsMobile(); // Renamed to avoid conflict if isMobile var is used

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [storyContent, setStoryContent] = useState("<p><br></p>"); // Start with an empty paragraph

  const [publishAttempted, setPublishAttempted] = useState(false);
  const [titleError, setTitleError] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [storyError, setStoryError] = useState("");

  const formWrapperRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const coverImageInputRef = useRef<HTMLInputElement>(null); // Added for cover image

  const [focusedField, setFocusedField] = useState<'title' | 'content' | null>(null);
  const [toolbarStyle, setToolbarStyle] = useState<React.CSSProperties>({ display: 'none', position: 'absolute', zIndex: 50 });

  // Get current block element (like <p> or <div>) containing the selection
  const getCurrentBlockElement = (): HTMLElement | null => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !contentEditableRef.current) {
      return null;
    }
    let node = selection.focusNode;
    while (node && node !== contentEditableRef.current) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        const displayStyle = window.getComputedStyle(element).display;
        if (displayStyle === 'block' || element.tagName === 'P' || element.tagName === 'DIV') {
          // Ensure it's a direct child or a common block element used for paragraphs
          if (contentEditableRef.current.contains(element)) {
            return element;
          }
        }
      }
      node = node.parentNode;
    }
    // If no block found, but contentEditable is focused and empty, consider contentEditable itself
    if (contentEditableRef.current && contentEditableRef.current.textContent?.trim() === "" && document.activeElement === contentEditableRef.current) {
      return contentEditableRef.current;
    }
    return null;
  };
  
  const calculateAndUpdateToolbarStyle = useCallback(() => {
    requestAnimationFrame(() => {
      const formEl = formWrapperRef.current;
      const titleEl = titleInputRef.current;
      const contentEl = contentEditableRef.current;
      const newToolbarStyle: React.CSSProperties = { display: 'none', position: 'absolute', zIndex: 50 };

      if (!formEl) {
        setToolbarStyle(newToolbarStyle);
        return;
      }
      const formRect = formEl.getBoundingClientRect();

      if (focusedField === 'title' && titleEl) {
        if (title.trim() === '') {
          const titleRect = titleEl.getBoundingClientRect();
          newToolbarStyle.top = `${Math.max(0, titleRect.top - formRect.top + (titleRect.height / 2) - (TOOLBAR_HEIGHT / 2))}px`;
          newToolbarStyle.left = `${Math.max(0, titleRect.left - formRect.left - TOOLBAR_WIDTH_WITH_OFFSET)}px`;
          newToolbarStyle.display = 'flex';
        }
      } else if (focusedField === 'content' && contentEl) {
        const currentBlock = getCurrentBlockElement();
        if (currentBlock && currentBlock.textContent?.trim() === "") {
           // If it's the contentEditable div itself and it's empty
          if (currentBlock === contentEl && (contentEl.innerHTML.toLowerCase() === "<p><br></p>" || contentEl.innerHTML.trim() === "" || contentEl.textContent?.trim() === "")) {
            const contentRect = contentEl.getBoundingClientRect();
            const paddingTop = parseFloat(window.getComputedStyle(contentEl).paddingTop) || 0;
            const firstLineApproxY = paddingTop + 14; // Approx half of a line-height
            newToolbarStyle.top = `${Math.max(0, (contentRect.top - formRect.top) + firstLineApproxY - (TOOLBAR_HEIGHT / 2))}px`;
          } else if (currentBlock !== contentEl) { // An actual child <p> or <div>
            const blockRect = currentBlock.getBoundingClientRect();
            newToolbarStyle.top = `${Math.max(0, (blockRect.top - formRect.top) + (blockRect.height / 2) - (TOOLBAR_HEIGHT / 2))}px`;
          } else {
            // Fallback if currentBlock is contentEl but not matching the empty condition above, don't show.
            setToolbarStyle(newToolbarStyle); // ensures display: none
            return;
          }
          const contentRectForLeft = contentEl.getBoundingClientRect(); // For consistent left positioning
          newToolbarStyle.left = `${Math.max(0, contentRectForLeft.left - formRect.left - TOOLBAR_WIDTH_WITH_OFFSET)}px`;
          newToolbarStyle.display = 'flex';
        }
      }
      setToolbarStyle(newToolbarStyle);
    });
  }, [focusedField, title, storyContent]); // Removed getCurrentBlockElement from deps as it's now internal

  useEffect(() => {
    calculateAndUpdateToolbarStyle();
  }, [focusedField, title, storyContent, calculateAndUpdateToolbarStyle]); // Recalculate when relevant states change

  const handleFocus = useCallback((field: 'title' | 'content') => {
    setFocusedField(field);
  }, []);

  const handleBlur = useCallback(() => {
    queueMicrotask(() => {
      if (toolbarRef.current && toolbarRef.current.contains(document.activeElement)) return;
      if (titleInputRef.current && titleInputRef.current === document.activeElement) return;
      if (contentEditableRef.current && contentEditableRef.current === document.activeElement) return;
      setFocusedField(null);
    });
  }, []);

  const handleContentEditableInput = useCallback((event: React.SyntheticEvent<HTMLDivElement>) => {
    const currentHTML = event.currentTarget.innerHTML;
    setStoryContent(currentHTML);
    if (publishAttempted) {
      if (event.currentTarget.textContent?.trim() || /<img|<figure|<video/i.test(currentHTML)) {
        setStoryError("");
      } else {
        setStoryError("Story content is required.");
      }
    }
  }, [publishAttempted]);

  // Sync storyContent state back to contentEditable div's innerHTML when it changes
  useEffect(() => {
    if (contentEditableRef.current && contentEditableRef.current.innerHTML !== storyContent) {
      contentEditableRef.current.innerHTML = storyContent;
    }
  }, [storyContent]);


  const handleContentKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      // Attempt to insert a paragraph. Browsers might insert <p> or <div>.
      // This is a basic attempt; robust editors use more complex logic.
      document.execCommand('insertParagraph', false, null); 
      
      // After command, ensure focus is correctly set and state is updated
      if (contentEditableRef.current) {
        // A slight delay might be needed for the DOM to update after execCommand
        setTimeout(() => {
          handleContentEditableInput({ currentTarget: contentEditableRef.current } as any);
          calculateAndUpdateToolbarStyle(); // Recalculate toolbar position
        }, 0);
      }
    }
  };

  const validateFields = useCallback(() => {
    let isValid = true;
    if (!title.trim()) { setTitleError("Title is required."); isValid = false; } else { setTitleError(""); }
    if (!category) { setCategoryError("Category is required."); isValid = false; } else { setCategoryError(""); }
    if (!contentEditableRef.current?.textContent?.trim() && !/<img|<figure|<video/i.test(storyContent)) {
      setStoryError("Story content is required."); isValid = false;
    } else { setStoryError(""); }
    return isValid;
  }, [title, category, storyContent]);

  const handlePublish = () => {
    setPublishAttempted(true);
    if (!validateFields()) {
      if (!title.trim() && titleInputRef.current) titleInputRef.current.focus();
      else if (!category) { /* Error shown */ }
      else if (contentEditableRef.current && storyError) contentEditableRef.current.focus();
      return;
    }
    console.log("Publishing Article:", { title: title.trim(), category, storyContent });
    toast({ title: "Article Submitted (Placeholder)", description: `"${title.trim()}" published.` });
    
    setTitle(""); setCategory("");
    setStoryContent("<p><br></p>"); // Reset to initial empty paragraph structure
    if (contentEditableRef.current) contentEditableRef.current.innerHTML = "<p><br></p>"; // Also manually set div

    setPublishAttempted(false); setTitleError(""); setCategoryError(""); setStoryError("");
  };

  useEffect(() => {
    const div = contentEditableRef.current;
    if (div && div.innerHTML !== storyContent) {
        // Ensure focus and cursor position are preserved if possible, though this can be tricky
        const selection = window.getSelection();
        const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
        let originalStartOffset = range?.startOffset;
        let originalStartContainer = range?.startContainer;

        div.innerHTML = storyContent; // This is the line causing the cursor jump if not handled

        // Attempt to restore selection
        if (range && originalStartContainer && originalStartOffset !== undefined && div.contains(originalStartContainer)) {
            try {
                const newRange = document.createRange();
                newRange.setStart(originalStartContainer, Math.min(originalStartOffset, originalStartContainer.textContent?.length || 0));
                newRange.collapse(true);
                selection?.removeAllRanges();
                selection?.addRange(newRange);
            } catch (e) {
                // console.warn("Could not restore selection after content update", e);
            }
        } else if (div.firstChild) { // Fallback: place cursor at end of content
            try {
                const newRange = document.createRange();
                newRange.selectNodeContents(div);
                newRange.collapse(false); // false for end
                selection?.removeAllRanges();
                selection?.addRange(newRange);
            } catch (e) {
                 // console.warn("Could not set selection to end after content update", e);
            }
        }
    }
  }, [storyContent]);


  if (authLoading) return <div className="container mx-auto p-4 md:p-8 flex justify-center items-center min-h-[calc(100vh-10rem)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  if (!user) return <div className="container mx-auto p-4 md:p-8 text-center min-h-[calc(100vh-10rem)] flex flex-col justify-center items-center"><p className="text-lg font-semibold text-foreground">Please log in to create news.</p><Button onClick={() => router.push('/login')} className="mt-4">Log In</Button></div>;

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <div ref={formWrapperRef} className="max-w-3xl mx-auto space-y-0 relative">
        <div ref={toolbarRef}>
          <InlineToolbar style={toolbarStyle} />
        </div>
        
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
              {publishAttempted && categoryError && <p className="text-xs text-destructive mt-1">{categoryError}</p>}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => coverImageInputRef.current?.click()} className="text-xs py-1.5 h-9">
              <ImageUp className="mr-1.5 h-3.5 w-3.5" />
              <span className="hidden sm:inline">Cover Image</span>
              <span className="sm:hidden">Image</span>
            </Button>
            <Input id="article-image-input-header" type="file" accept="image/*" className="hidden" ref={coverImageInputRef} />
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => console.log("Save Draft clicked")} className="text-xs py-1.5 h-9 rounded-full">
              <Save className="mr-1.5 h-3.5 w-3.5" /> Save Draft
            </Button>
            <Button type="button" onClick={handlePublish} className="text-xs py-1.5 bg-green-600 hover:bg-green-700 text-white h-9 rounded-full">
              <Send className="mr-1.5 h-3.5 w-3.5" /> Publish
            </Button>
          </div>
        </div>

        <div className="relative mb-4"> {/* titleWrapperRef was removed, positioning via titleInputRef directly */}
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
            onFocus={() => handleFocus('title')}
            onBlur={handleBlur}
            className="text-4xl lg:text-5xl font-bold border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-0 placeholder:text-muted-foreground/50 h-auto py-2"
            autoComplete="off"
          />
          {publishAttempted && titleError && <p className="text-xs text-destructive mt-1">{titleError}</p>}
        </div>
        
        <div className="relative"> {/* contentWrapperRef was removed */}
          <div
            ref={contentEditableRef}
            contentEditable={true}
            onInput={handleContentEditableInput}
            onFocus={() => handleFocus('content')}
            onBlur={handleBlur}
            onKeyDown={handleContentKeyDown} // Added for Enter key handling
            onClick={calculateAndUpdateToolbarStyle} // Added to help reposition toolbar on click
            onKeyUp={calculateAndUpdateToolbarStyle} // Added to help reposition toolbar after typing/deleting
            data-placeholder="Tell your story..."
            className={cn(
              "w-full rounded-md border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-0 placeholder:text-muted-foreground/50 py-2 font-normal text-start no-underline tracking-normal whitespace-pre-wrap break-words normal-case",
              "focus:outline-none min-h-[150px]" // Ensure min-height
            )}
            style={{
              fontFamily: "medium-content-sans-serif-font, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Oxygen, Ubuntu, Cantarell, \"Open Sans\", \"Helvetica Neue\", sans-serif",
              fontSize: "20px",
              lineHeight: "28px",
              color: "hsl(var(--foreground))",
            }}
            role="textbox"
            aria-multiline="true"
            aria-label="News article content"
            dangerouslySetInnerHTML={{ __html: storyContent }} // Manage content via state
          />
        </div>
        {publishAttempted && storyError && <p className="text-xs text-destructive mt-1">{storyError}</p>}
        
        <style jsx global>{`
          div[contentEditable="true"][data-placeholder]:empty:before,
          div[contentEditable="true"][data-placeholder]:where(:not(:has(*:not(br)))):before {
            content: attr(data-placeholder);
            color: hsl(var(--muted-foreground) / 0.5);
            pointer-events: none; /* Important */
            display: block; /* Ensures it takes up space if the div is empty */
            position: absolute; /* To position it over the contentEditable area */
            top: 0.5rem; /* Adjust as needed based on py-2 */
            left: 0; /* Adjust as needed based on px-0 */
          }
        `}</style>
      </div>
    </div>
  );
};

export default CreateNewsArticlePage;

