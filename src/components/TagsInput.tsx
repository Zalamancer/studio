
// src/components/TagsInput.tsx
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { X, PlusCircle, Tag, Loader2, Search } from 'lucide-react'; // Added Search
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  label?: string | undefined; // Made label optional
  onPublishAttempt?: boolean;
}

export const TagsInput: React.FC<TagsInputProps> = ({
  value = [],
  onChange,
  placeholder: initialPlaceholder = "Add tags...",
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
  const [isSearchActive, setIsSearchActive] = useState(false);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (inputValue.trim().length > 0) {
        setIsLoadingSuggestions(true);
        try {
          const fetchedTags = await searchTags(inputValue.trim(), 7); // Fetch more for search
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
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [inputValue, value]);

  const addTag = useCallback((tagToAdd: string) => {
    const trimmedTag = tagToAdd.trim();
    if (trimmedTag && !value.map(t => t.toLowerCase()).includes(trimmedTag.toLowerCase())) {
      if (maxTags && value.length >= maxTags) return;
      onChange([...value, trimmedTag]);
    }
    setInputValue('');
    setIsPopoverOpen(false);
    setSuggestions([]);
    if (isSearchActive) setIsSearchActive(false); // Exit search mode after adding a tag from search
  }, [value, onChange, maxTags, isSearchActive]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    if (e.target.value.trim().length > 0) {
      setIsPopoverOpen(true);
    } else {
      setIsPopoverOpen(false);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (inputValue.trim() && !isSearchActive) { // Only add tag directly if not in search mode
        addTag(inputValue);
      } else if (inputValue.trim() && isSearchActive && suggestions.length > 0) {
        // Optional: Add top suggestion on Enter in search mode
        // addTag(suggestions[0].name);
      }
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0 && !isSearchActive) {
      onChange(value.slice(0, -1));
    } else if (e.key === 'Escape') {
      setIsPopoverOpen(false);
      if (isSearchActive) setIsSearchActive(false);
    }
  };

  const removeTag = (tagToRemove: string) => {
    onChange(value.filter(tag => tag !== tagToRemove));
  };

  const toggleSearchMode = () => {
    setIsSearchActive(prev => {
      const newSearchState = !prev;
      if (!newSearchState) { // Exiting search mode
        setInputValue(''); // Clear input when exiting search
        setIsPopoverOpen(false);
      } else { // Entering search mode
         inputRef.current?.focus();
      }
      return newSearchState;
    });
  };
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isPopoverOpen && popoverContentRef.current && !popoverContentRef.current.contains(event.target as Node) && inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setIsPopoverOpen(false);
      }
    };
    if (isPopoverOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isPopoverOpen]);

  const currentPlaceholder = isSearchActive ? "Search existing tags..." : (value.length === 0 ? initialPlaceholder : "");

  return (
    <div className="space-y-1">
      {label && <Label htmlFor="tags-input" className="text-xs font-medium">{label} {error && <span className="text-destructive">*</span>}</Label>}
      <Popover open={isPopoverOpen && (suggestions.length > 0 || (inputValue.trim() && !isLoadingSuggestions && !isSearchActive))} onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger asChild>
          <div
            className={cn(
              "flex items-center gap-1.5 rounded-md border border-input bg-background p-1.5 min-h-[36px] focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0", // offset 0 for article page
              disabled && "cursor-not-allowed opacity-50",
              (onPublishAttempt && error) && "border-destructive ring-1 ring-destructive"
            )}
            onClick={() => inputRef.current?.focus()}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={(e) => { e.stopPropagation(); toggleSearchMode(); }}
              className={cn(
                "h-6 w-6 p-1 text-muted-foreground hover:text-foreground",
                isSearchActive && "text-primary"
              )}
              aria-label={isSearchActive ? "Close search" : "Search tags"}
            >
              {isSearchActive ? (
                <X className="h-4 w-4 transition-transform duration-300 ease-in-out rotate-90 scale-110" />
              ) : (
                <Search className="h-4 w-4 transition-transform duration-300 ease-in-out group-hover:rotate-[15deg]" />
              )}
            </Button>

            {!isSearchActive && value.map((tag) => (
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
            <Input
              ref={inputRef}
              id="tags-input"
              type="text"
              placeholder={currentPlaceholder}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleInputKeyDown}
              onFocus={() => setIsPopoverOpen(inputValue.trim().length > 0 && (suggestions.length > 0 || (inputValue.trim() && !isLoadingSuggestions)))}
              disabled={disabled || (maxTags !== undefined && value.length >= maxTags && !isSearchActive)}
              className={cn(
                "flex-grow h-auto p-0 border-0 shadow-none focus-visible:ring-0 bg-transparent text-xs",
                isSearchActive ? "pl-1" : "pl-1.5" // Adjust padding based on search mode
              )}
            />
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
            inputValue.trim() && !isSearchActive && ( // Only show "Create new" if not in search mode or search yields no results for creation
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
          {suggestions.length === 0 && inputValue.trim() && !isLoadingSuggestions && isSearchActive && (
            <p className="p-2 text-center text-xs text-muted-foreground">No tags found matching &quot;{inputValue.trim()}&quot;.</p>
          )}
        </PopoverContent>
      </Popover>
      {error && <p className="text-xs text-destructive mt-0.5">{error}</p>}
    </div>
  );
};
