// src/components/TagsInput.tsx
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, PlusCircle, Tag, Loader2 } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { searchTags } from '@/services/tagService'; // Assuming you have this
import type { ClientTag } from '@/types/tag';
import { cn } from '@/lib/utils';

interface TagsInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
  disabled?: boolean;
  error?: string | null;
  label?: string;
  onPublishAttempt?: boolean; // To trigger validation styling if form was submitted
}

export const TagsInput: React.FC<TagsInputProps> = ({
  value = [],
  onChange,
  placeholder = "Add tags...",
  maxTags,
  disabled,
  error,
  label,
  onPublishAttempt
}) => {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<ClientTag[]>([]);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (inputValue.trim().length > 0) {
        setIsLoadingSuggestions(true);
        try {
          const fetchedTags = await searchTags(inputValue.trim(), 5);
          // Filter out tags already selected by the user for this article
          const currentSelectedLowercase = value.map(tag => tag.toLowerCase());
          setSuggestions(fetchedTags.filter(tag => !currentSelectedLowercase.includes(tag.nameLowercase)));
        } catch (err) {
          // console.error("Failed to fetch tag suggestions:", err);
          setSuggestions([]);
        } finally {
          setIsLoadingSuggestions(false);
        }
      } else {
        setSuggestions([]);
      }
    };

    const debounceTimer = setTimeout(() => {
      fetchSuggestions();
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [inputValue, value]); // Added value to dependency array

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    if (e.target.value.trim().length > 0) {
      setIsPopoverOpen(true);
    } else {
      setIsPopoverOpen(false);
    }
  };

  const addTag = useCallback((tagToAdd: string) => {
    const trimmedTag = tagToAdd.trim();
    if (trimmedTag && !value.map(t => t.toLowerCase()).includes(trimmedTag.toLowerCase())) {
      if (maxTags && value.length >= maxTags) {
        // Optionally show a toast or message
        return;
      }
      onChange([...value, trimmedTag]);
    }
    setInputValue('');
    setIsPopoverOpen(false);
    setSuggestions([]);
  }, [value, onChange, maxTags]);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (inputValue.trim()) {
        addTag(inputValue);
      }
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      onChange(value.slice(0, -1));
    } else if (e.key === 'Escape') {
      setIsPopoverOpen(false);
    }
  };

  const removeTag = (tagToRemove: string) => {
    onChange(value.filter(tag => tag !== tagToRemove));
  };
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isPopoverOpen &&
        popoverContentRef.current &&
        !popoverContentRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsPopoverOpen(false);
      }
    };
    if (isPopoverOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPopoverOpen]);


  return (
    <div className="space-y-2">
      {label && <Label htmlFor="tags-input" className="text-sm font-medium">{label} {error && <span className="text-destructive">*</span>}</Label>}
      <Popover open={isPopoverOpen && (suggestions.length > 0 || (inputValue.trim() && !isLoadingSuggestions))} onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger asChild>
          <div
            className={cn(
              "flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-background p-2 min-h-[40px] focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
              disabled && "cursor-not-allowed opacity-50",
              (onPublishAttempt && error) && "border-destructive ring-destructive"
            )}
            onClick={() => inputRef.current?.focus()}
          >
            {value.map((tag) => (
              <Badge key={tag} variant="secondary" className="py-0.5 text-xs font-normal">
                {tag}
                {!disabled && (
                  <button
                    type="button"
                    className="ml-1.5 rounded-full outline-none focus:ring-1 focus:ring-ring"
                    onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
                    aria-label={`Remove ${tag}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </Badge>
            ))}
            <Input
              ref={inputRef}
              id="tags-input"
              type="text"
              placeholder={value.length === 0 ? placeholder : ""}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleInputKeyDown}
              onFocus={() => setIsPopoverOpen(inputValue.trim().length > 0 && (suggestions.length > 0 || (inputValue.trim() && !isLoadingSuggestions)))}
              disabled={disabled || (maxTags !== undefined && value.length >= maxTags)}
              className="flex-grow h-auto p-0 border-0 shadow-none focus-visible:ring-0 bg-transparent text-sm min-w-[100px]"
            />
          </div>
        </PopoverTrigger>
        <PopoverContent
          ref={popoverContentRef}
          className="w-[--radix-popover-trigger-width] p-1 max-h-48 overflow-y-auto"
          side="bottom"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()} // Prevent stealing focus
        >
          {isLoadingSuggestions ? (
             <div className="flex items-center justify-center p-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5"/> Loading...
             </div>
          ) : suggestions.length > 0 ? (
            suggestions.map((tag) => (
              <Button
                key={tag.id}
                variant="ghost"
                size="sm"
                className="w-full justify-start text-xs h-auto py-1.5 px-2"
                onClick={() => addTag(tag.name)}
                onMouseDown={(e) => e.preventDefault()} 
              >
                <Tag className="h-3.5 w-3.5 mr-1.5 text-muted-foreground"/>
                {tag.name} <span className="ml-auto text-muted-foreground text-[10px]">({tag.usageCount})</span>
              </Button>
            ))
          ) : (
            inputValue.trim() && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-xs h-auto py-1.5 px-2 text-primary"
                onClick={() => addTag(inputValue)}
                onMouseDown={(e) => e.preventDefault()}
              >
                <PlusCircle className="h-3.5 w-3.5 mr-1.5"/> Create new tag &quot;{inputValue.trim()}&quot;
              </Button>
            )
          )}
        </PopoverContent>
      </Popover>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
};
