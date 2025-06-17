// src/components/TagsInput.tsx
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
// Label import removed as it's not directly used for the input field in this design
import { X, PlusCircle, Search, Loader2 } from 'lucide-react'; // Changed Tag to Search
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
// ScrollArea removed as PopoverContent is typically scrollable by default if content overflows
import { searchTags } from '@/services/tagService';
import type { ClientTag } from '@/types/tag';
import { cn } from '@/lib/utils';

interface TagsInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
  disabled?: boolean;
  error?: string | null;
  label?: string | undefined; // Label is optional as per previous update
  onPublishAttempt?: boolean;
  className?: string;
}

export const TagsInput: React.FC<TagsInputProps> = ({
  value = [],
  onChange,
  placeholder = "Search or add tags...",
  maxTags,
  disabled,
  error,
  label, // Keep label prop if needed elsewhere, but not rendered by default in this version
  onPublishAttempt,
  className, // Added for layout flexibility
}) => {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<ClientTag[]>([]);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverContentRef = useRef<HTMLDivElement>(null);
  const [focusedSuggestionIndex, setFocusedSuggestionIndex] = useState(-1);


  useEffect(() => {
    const fetchSuggestions = async () => {
      if (inputValue.trim().length > 0) {
        setIsLoadingSuggestions(true);
        try {
          const fetchedTags = await searchTags(inputValue.trim(), 5);
          const currentSelectedLowercase = value.map(tag => tag.toLowerCase());
          setSuggestions(fetchedTags.filter(tag => !currentSelectedLowercase.includes(tag.nameLowercase)));
        } catch (err) {
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
    }, 200);

    return () => clearTimeout(debounceTimer);
  }, [inputValue, value]);

  const addTag = useCallback((tagToAdd: string) => {
    const trimmedTag = tagToAdd.trim();
    if (trimmedTag && (value.length === 0 || !value.map(t => t.toLowerCase()).includes(trimmedTag.toLowerCase()))) {
      if (maxTags && value.length >= maxTags) return;
      onChange([...value, trimmedTag]);
    }
    setInputValue('');
    setIsPopoverOpen(false);
    setSuggestions([]);
    setFocusedSuggestionIndex(-1);
    inputRef.current?.focus();
  }, [value, onChange, maxTags]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newInputValue = e.target.value;
    setInputValue(newInputValue);
    if (newInputValue.trim().length > 0) {
      setIsPopoverOpen(true);
      setFocusedSuggestionIndex(-1);
    } else {
      setIsPopoverOpen(false);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const showCreateOption = inputValue.trim() && !isLoadingSuggestions && !suggestions.some(s => s.name.toLowerCase() === inputValue.trim().toLowerCase());
      if (focusedSuggestionIndex >= 0 && focusedSuggestionIndex < suggestions.length && suggestions[focusedSuggestionIndex]) {
        addTag(suggestions[focusedSuggestionIndex].name);
      } else if (showCreateOption && focusedSuggestionIndex === suggestions.length) { // "Create new" option is selected
        addTag(inputValue);
      } else if (inputValue.trim()) { // No suggestion selected, create from input value
        addTag(inputValue);
      }
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      onChange(value.slice(0, -1));
    } else if (e.key === 'Escape') {
      setIsPopoverOpen(false);
      setFocusedSuggestionIndex(-1);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const createNewOptionPresent = inputValue.trim() && !isLoadingSuggestions && !suggestions.some(s => s.name.toLowerCase() === inputValue.trim().toLowerCase());
      const totalOptions = suggestions.length + (createNewOptionPresent ? 1 : 0);
      if (totalOptions > 0) {
        let nextIndex = focusedSuggestionIndex;
        if (e.key === 'ArrowDown') {
          nextIndex = (nextIndex + 1) % totalOptions;
        } else {
          nextIndex = (nextIndex - 1 + totalOptions) % totalOptions;
        }
        setFocusedSuggestionIndex(nextIndex);
      }
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
      (!inputRef.current || !inputRef.current.contains(event.target as Node))
    ) {
      setIsPopoverOpen(false);
    }
  };
    if (isPopoverOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isPopoverOpen]);

  const showCreateNewOption = inputValue.trim() && !isLoadingSuggestions && !suggestions.some(s => s.name.toLowerCase() === inputValue.trim().toLowerCase());
  const hasSuggestionsOrCanCreate = suggestions.length > 0 || showCreateNewOption || isLoadingSuggestions;


  return (
    <div className={cn("space-y-1", className)}>
      {label && <label htmlFor="tags-input-field" className="text-xs font-medium text-muted-foreground">{label} {error && <span className="text-destructive">*</span>}</label>}
      <Popover open={isPopoverOpen && hasSuggestionsOrCanCreate} onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger asChild>
          <div
            className={cn(
              "flex items-center flex-wrap gap-1.5 rounded-md border border-input bg-background p-1.5 min-h-[36px] focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0",
              disabled && "cursor-not-allowed opacity-50",
              (onPublishAttempt && error) && "border-destructive ring-1 ring-destructive"
            )}
          >
            {value.map((tag) => (
              <Badge key={tag} variant="secondary" className="py-0.5 text-xs font-normal">
                {tag}
                {!disabled && (
                  <button
                    type="button"
                    className="ml-1 rounded-full outline-none focus:ring-1 focus:ring-ring"
                    onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
                    aria-label={`Remove ${tag}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </Badge>
            ))}
          </div>
        </PopoverTrigger>
        <PopoverContent
          ref={popoverContentRef}
          className="w-[--radix-popover-trigger-width] p-1 mt-1 max-h-48 overflow-y-auto"
          side="bottom"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {isLoadingSuggestions ? (
             <div className="flex items-center justify-center p-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5"/> Loading...
             </div>
          ) : (
            <>
              {suggestions.map((tag, index) => (
                <Button
                  key={tag.id}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "w-full justify-start text-xs h-auto py-1.5 px-2",
                    focusedSuggestionIndex === index && "bg-accent"
                  )}
                  onClick={() => addTag(tag.name)}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setFocusedSuggestionIndex(index)}
                >
                  <Search className="h-3.5 w-3.5 mr-1.5 text-muted-foreground"/> {/* Changed Tag to Search */}
                  {tag.name} <span className="ml-auto text-muted-foreground text-[10px]">({tag.usageCount})</span>
                </Button>
              ))}
              {showCreateNewOption && (
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "w-full justify-start text-xs h-auto py-1.5 px-2 text-primary",
                     focusedSuggestionIndex === suggestions.length && "bg-accent"
                  )}
                  onClick={() => addTag(inputValue)}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setFocusedSuggestionIndex(suggestions.length)}
                >
                  <PlusCircle className="h-3.5 w-3.5 mr-1.5"/> Create new tag &quot;{inputValue.trim()}&quot;
                </Button>
              )}
              {!isLoadingSuggestions && suggestions.length === 0 && !showCreateNewOption && inputValue.trim() && (
                 <p className="p-2 text-center text-xs text-muted-foreground">No existing tags found. Press Enter to create.</p>
              )}
            </>
          )}
        </PopoverContent>
      </Popover>
      {error && <p className="text-xs text-destructive mt-0.5">{error}</p>}
    </div>
  );
};
