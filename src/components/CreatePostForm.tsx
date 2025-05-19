
// src/components/CreatePostForm.tsx
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Loader2, Upload, XCircle, ImageDown, User, AtSign } from 'lucide-react';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import imageCompression from 'browser-image-compression';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { getSuggestibleUsers } from '@/services/connectionService'; // For real user suggestions
import type { UserProfileBasic } from '@/types/connection';
import { generateAnonymousName } from '@/lib/pseudonymUtils';

// Local getInitials function for this component
const getInitials = (displayNameOrUid: string | undefined | null): string => {
    if (!displayNameOrUid) return '?';
    const nameToProcess = displayNameOrUid.startsWith('@') ? displayNameOrUid.substring(1) : displayNameOrUid;

    const pseudonymRegex = /^[A-Z][a-z]+[A-Z][a-z]+[0-9]{3}$/;
    if (pseudonymRegex.test(nameToProcess)) {
        const match = nameToProcess.match(/^([A-Z])[a-z]+([A-Z])/);
        if (match && match[1] && match[2]) return match[1] + match[2];
        if (match && match[1]) return match[1];
    }
    const names = nameToProcess.split(' ').filter(Boolean);
    if (names.length === 0) return '?';
    if (names.length === 1) return names[0].substring(0, 1).toUpperCase();
    return (names[0].substring(0, 1) + names[names.length - 1].substring(0, 1)).toUpperCase();
};


const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/gif"];

const postFormSchema = z.object({
  question: z.string().min(10, "Question must be at least 10 characters long.").max(200, "Question cannot exceed 200 characters."),
  description: z.string().optional(),
  tags: z.array(z.string()).min(1, "Please select at least one tag."),
  sector: z.string().min(1, "Please select a sector."),
  subSector: z.string().optional(),
  industry: z.string().optional(),
  image: z.instanceof(File).optional().nullable()
    .refine(file => !file || file.size <= MAX_FILE_SIZE_BYTES, `Max image size is 2MB.`)
    .refine(
      file => !file || ACCEPTED_IMAGE_TYPES.includes(file.type),
      "Only .jpg, .jpeg, .png and .gif formats are supported."
    ),
});

type PostFormValues = z.infer<typeof postFormSchema>;

export interface CreatePostFormData {
  question: string;
  description?: string;
  tags: string[];
  sector: string;
  subSector?: string;
  industry?: string;
  imageFile?: File | null;
  mentionedUserIds: string[];
}

export interface Industry {
  name: string;
  code: string;
}

export interface SubSector {
  name: string;
  code: string;
  industries: Industry[];
}

export interface SectorWithSubSectors {
  name: string;
  code: string;
  description?: string;
  subSectors: SubSector[];
}

interface CreatePostFormProps {
  onSubmit: (data: CreatePostFormData) => void;
  availableTags: string[];
  detailedSectorsData: SectorWithSubSectors[];
  isSubmitting: boolean;
  currentUserId: string | null;
}

export const CreatePostForm: React.FC<CreatePostFormProps> = ({ onSubmit, availableTags, detailedSectorsData, isSubmitting, currentUserId }) => {
  const form = useForm<PostFormValues>({
    resolver: zodResolver(postFormSchema),
    defaultValues: {
      question: "",
      description: "",
      tags: [],
      sector: "",
      subSector: "",
      industry: "",
      image: null,
    },
  });
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentSubSectors, setCurrentSubSectors] = useState<SubSector[]>([]);
  const [currentIndustries, setCurrentIndustries] = useState<Industry[]>([]);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);

  const [isCompressing, setIsCompressing] = useState(false);
  const [originalTooLargeFile, setOriginalTooLargeFile] = useState<File | null>(null);
  const [showCompressionDialog, setShowCompressionDialog] = useState(false);

  const [descriptionMentionQuery, setDescriptionMentionQuery] = useState('');
  const [showDescriptionSuggestions, setShowDescriptionSuggestions] = useState(false);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const descriptionSuggestionsPopoverRef = useRef<HTMLDivElement>(null);
  const [selectedMentionedUserIds, setSelectedMentionedUserIds] = useState<Set<string>>(new Set());


  const { data: suggestibleUsers = [], isLoading: isLoadingSuggestibleUsers } = useQuery<UserProfileBasic[]>({
    queryKey: ['suggestibleUsersForCreatePost', descriptionMentionQuery],
    queryFn: () => getSuggestibleUsers(descriptionMentionQuery, descriptionMentionQuery ? 10 : 25),
    enabled: showDescriptionSuggestions,
    staleTime: 1000 * 60 * 1,
  });


  const selectedSectorCode = form.watch("sector");
  const selectedSubSectorCode = form.watch("subSector");

  useEffect(() => {
    if (selectedSectorCode) {
      const selectedMainSector = detailedSectorsData.find(s => s.code === selectedSectorCode);
      setCurrentSubSectors(selectedMainSector?.subSectors || []);
      form.resetField("subSector");
      form.resetField("industry");
      setCurrentIndustries([]);
    } else {
      setCurrentSubSectors([]);
      setCurrentIndustries([]);
      form.resetField("subSector");
      form.resetField("industry");
    }
  }, [selectedSectorCode, detailedSectorsData, form]);

  useEffect(() => {
    if (selectedSubSectorCode) {
      const selectedSub = currentSubSectors.find(ss => ss.code === selectedSubSectorCode);
      setCurrentIndustries(selectedSub?.industries || []);
      form.resetField("industry");
    } else {
      setCurrentIndustries([]);
      form.resetField("industry");
    }
  }, [selectedSubSectorCode, currentSubSectors, form]);

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        toast({ variant: "destructive", title: "Invalid File Type", description: "Please select a JPG, PNG, or GIF image." });
        if (fileInputRef.current) fileInputRef.current.value = "";
        form.setValue("image", null);
        setImagePreviewUrl(null);
        setSelectedImageFile(null);
        return;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setOriginalTooLargeFile(file);
        setShowCompressionDialog(true);
        if (fileInputRef.current) fileInputRef.current.value = "";
        form.setValue("image", null);
        setImagePreviewUrl(null);
        setSelectedImageFile(null);
        return;
      }
      setSelectedImageFile(file);
      form.setValue("image", file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreviewUrl(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      form.setValue("image", null); // Explicitly set to null if no file or selection cancelled
      setSelectedImageFile(null);
      setOriginalTooLargeFile(null);
      setImagePreviewUrl(null);
    }
  };

  const handleCompressAndSetImage = async () => {
    if (!originalTooLargeFile) return;
    setIsCompressing(true);
    setShowCompressionDialog(false);
    toast({ title: "Compressing image...", description: "Please wait." });
    try {
      const compressedFile = await imageCompression(originalTooLargeFile, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      });
      setSelectedImageFile(compressedFile);
      form.setValue("image", compressedFile);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreviewUrl(reader.result as string);
      reader.readAsDataURL(compressedFile);
      toast({ title: "Image Compressed", description: "Proceed with upload." });
    } catch (error) {
      console.error("[CreatePostForm] Image compression error:", error);
      toast({ variant: "destructive", title: "Compression Failed", description: "Could not compress image. Try a smaller file." });
      if (fileInputRef.current) fileInputRef.current.value = "";
      form.setValue("image", null);
      setImagePreviewUrl(null);
      setSelectedImageFile(null);
    } finally {
      setIsCompressing(false);
      setOriginalTooLargeFile(null);
    }
  };

  const handleRemoveImage = () => {
    setSelectedImageFile(null);
    setImagePreviewUrl(null);
    form.setValue("image", null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmitForm = (values: PostFormValues) => {
    const submitData: CreatePostFormData = {
        question: values.question,
        description: values.description,
        tags: values.tags,
        sector: values.sector,
        subSector: values.subSector,
        industry: values.industry,
        imageFile: selectedImageFile,
        mentionedUserIds: Array.from(selectedMentionedUserIds),
    };
    onSubmit(submitData);
    // Consider resetting selectedMentionedUserIds here or if the dialog fully closes
    // For now, it will persist if the dialog reopens without a full unmount.
  };

  const evaluateMentionState = useCallback((text: string, cursorPosition: number) => {
    console.log("[CreatePostForm] evaluateMentionState - Text:", text, "Cursor:", cursorPosition);
    let activeQuery = null;
    const textBeforeCursor = text.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex > -1 && (lastAtIndex === 0 || /\s|^$/.test(textBeforeCursor.charAt(lastAtIndex - 1)))) {
        const potentialQuery = textBeforeCursor.substring(lastAtIndex + 1);
        if (!/\s/.test(potentialQuery) && !/\n/.test(potentialQuery)) {
            activeQuery = potentialQuery;
        }
    }

    if (activeQuery !== null) {
        console.log("[CreatePostForm] evaluateMentionState - Active Query:", activeQuery);
        setDescriptionMentionQuery(activeQuery);
        setShowDescriptionSuggestions(true);
    } else {
        console.log("[CreatePostForm] evaluateMentionState - No Active Query, hiding suggestions.");
        // Only hide if not due to focus moving to popover
        if (descriptionSuggestionsPopoverRef.current && !descriptionSuggestionsPopoverRef.current.contains(document.activeElement)) {
            setShowDescriptionSuggestions(false);
        }
        // Always clear query if not active
        setDescriptionMentionQuery('');
    }
  }, [setDescriptionMentionQuery, setShowDescriptionSuggestions]);

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    form.setValue("description", value); // Update RHF state
    if (descriptionTextareaRef.current) {
        evaluateMentionState(value, descriptionTextareaRef.current.selectionStart || 0);
    }
  };

  const handleDescriptionFocus = () => {
    if (descriptionTextareaRef.current) {
        console.log("[CreatePostForm] Description field FOCUSED.");
        evaluateMentionState(descriptionTextareaRef.current.value, descriptionTextareaRef.current.selectionStart || 0);
    }
  };
  
  const handleSelectDescriptionSuggestion = (profile: UserProfileBasic) => {
    if (!descriptionTextareaRef.current) return;
    const currentValue = form.getValues("description") || "";
    const cursorPosition = descriptionTextareaRef.current.selectionStart || 0;
    const textBeforeCursor = currentValue.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex > -1) {
        const textBeforeMention = currentValue.substring(0, lastAtIndex);
        const textAfterCursor = currentValue.substring(cursorPosition);
        const mentionToInsert = profile.mentionName; // Use mentionName (ColorAnimalNumber)
        const newText = `${textBeforeMention}@${mentionToInsert} ${textAfterCursor}`;
        form.setValue("description", newText, { shouldValidate: true, shouldDirty: true });
        setSelectedMentionedUserIds(prev => new Set(prev).add(profile.userId)); // Store UID
        const newCursorPosition = textBeforeMention.length + `@${mentionToInsert} `.length;
        setTimeout(() => {
            descriptionTextareaRef.current?.focus();
            descriptionTextareaRef.current?.setSelectionRange(newCursorPosition, newCursorPosition);
        }, 0);
    }
    setShowDescriptionSuggestions(false);
    setDescriptionMentionQuery('');
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (
            showDescriptionSuggestions &&
            descriptionSuggestionsPopoverRef.current &&
            !descriptionSuggestionsPopoverRef.current.contains(event.target as Node) &&
            descriptionTextareaRef.current &&
            !descriptionTextareaRef.current.contains(event.target as Node)
        ) {
            console.log("[CreatePostForm] handleClickOutside: Hiding suggestions.");
            setShowDescriptionSuggestions(false);
        }
    };
    if (showDescriptionSuggestions) {
        document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDescriptionSuggestions]);

  const filteredDescriptionSuggestions = useMemo(() => {
    if (!showDescriptionSuggestions) return [];
    if (isLoadingSuggestibleUsers) return [{ userId: 'loading-desc', displayName: 'Loading users...', mentionName: 'loading-desc' } as UserProfileBasic];

    const profilesSource = suggestibleUsers.filter(p => p.userId !== currentUserId);

    if (descriptionMentionQuery.trim() === '' && profilesSource.length > 0) {
        return profilesSource;
    }
    if (profilesSource.length === 0) {
        return [{ userId: 'no-users-desc', displayName: 'No users to suggest.', mentionName: 'no-users-desc' } as UserProfileBasic];
    }

    const queryLower = descriptionMentionQuery.toLowerCase();
    const suggestions = profilesSource.filter(profile =>
        profile.mentionName.toLowerCase().includes(queryLower) || // Filter by mentionName (ColorAnimalNumber)
        (profile.actualDisplayName && profile.actualDisplayName.toLowerCase().includes(queryLower)) ||
        (profile.companyName && profile.companyName.toLowerCase().includes(queryLower))
    ).slice(0,10);

    return suggestions.length > 0 ? suggestions : [{ userId: 'no-match-desc', displayName: `No users matching "@${descriptionMentionQuery}"`, mentionName:'no-match-desc' } as UserProfileBasic];
  }, [descriptionMentionQuery, suggestibleUsers, isLoadingSuggestibleUsers, showDescriptionSuggestions, currentUserId]);

  useEffect(() => {
    if (!form.formState.isDirty && !form.formState.isSubmitting) {
      setSelectedMentionedUserIds(new Set());
    }
  }, [form.formState.isDirty, form.formState.isSubmitting]);


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmitForm)} className="space-y-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 p-1">
          <div className="space-y-6 flex flex-col">
            <FormField
              control={form.control}
              name="question"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Question / Need</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., How to improve B2B lead generation?" {...field} disabled={isSubmitting} />
                  </FormControl>
                  <FormDescription>Keep it concise and clear.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="flex-grow flex flex-col">
                  <FormLabel>Description (Optional)</FormLabel>
                  <Popover
                    open={showDescriptionSuggestions && filteredDescriptionSuggestions.length > 0 && (filteredDescriptionSuggestions[0]?.userId !== 'loading-desc' && filteredDescriptionSuggestions[0]?.userId !== 'no-users-desc' && filteredDescriptionSuggestions[0]?.userId !== 'no-match-desc')}
                    onOpenChange={(isOpen) => {
                      console.log("[CreatePostForm] Popover onOpenChange, isOpen:", isOpen);
                      setShowDescriptionSuggestions(isOpen);
                      if (!isOpen) setDescriptionMentionQuery(''); // Clear query when popover closes externally
                    }}
                  >
                    <PopoverTrigger asChild>
                      <FormControl className="flex-grow">
                        <Textarea
                          placeholder="Provide more context or details... (@mention users)"
                          className="resize-y min-h-[120px] flex-1"
                          {...field}
                          ref={(e) => {
                            field.ref(e);
                            descriptionTextareaRef.current = e;
                          }}
                          onChange={handleDescriptionChange}
                          onFocus={handleDescriptionFocus}
                          onBlur={() => setTimeout(() => {
                            if (descriptionSuggestionsPopoverRef.current && !descriptionSuggestionsPopoverRef.current.contains(document.activeElement as Node)) {
                                console.log("[CreatePostForm] Textarea BLUR, hiding suggestions.");
                                setShowDescriptionSuggestions(false);
                            }
                          }, 150)}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                    </PopoverTrigger>
                     <PopoverContent
                        ref={descriptionSuggestionsPopoverRef}
                        className="w-[--radix-popover-trigger-width] p-1 mt-1 max-h-48 overflow-y-auto"
                        side="top"
                        align="start"
                        onOpenAutoFocus={(e) => e.preventDefault()}
                     >
                        {filteredDescriptionSuggestions.map(profile => {
                           const displayableName = profile.actualDisplayName || profile.companyName;
                           const showSecondaryName = displayableName && displayableName !== profile.mentionName;
                           return (
                             profile.userId === 'loading-desc' || profile.userId === 'no-users-desc' || profile.userId === 'no-match-desc' ? (
                                <div key={profile.userId} className="p-2 text-center text-xs text-muted-foreground">
                                    {profile.displayName}
                                </div>
                             ) : (
                                <Button
                                    key={profile.userId}
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-start h-auto px-2 py-1 text-xs"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => handleSelectDescriptionSuggestion(profile)}
                                >
                                    <Avatar className="h-5 w-5 mr-2">
                                        <AvatarImage src={profile.avatarUrl} alt={profile.mentionName} />
                                        <AvatarFallback className="text-xs">{getInitials(profile.mentionName)}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col items-start">
                                        {showSecondaryName && (
                                            <span className="font-medium text-foreground">{displayableName}</span>
                                        )}
                                        <span className={cn("text-muted-foreground", !showSecondaryName && "font-medium text-foreground")}>
                                            @{profile.mentionName}
                                        </span>
                                    </div>
                                </Button>
                            )
                           );
                        })}
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

             <FormField
                control={form.control}
                name="image"
                render={() => (
                    <FormItem>
                        <FormLabel>Image (Optional)</FormLabel>
                        <FormControl>
                            <Input
                                type="file"
                                accept="image/png, image/jpeg, image/gif"
                                ref={fileInputRef}
                                onChange={handleImageChange}
                                className="hidden"
                                disabled={isSubmitting || isCompressing}
                            />
                        </FormControl>
                        <div className="mt-2 flex items-center gap-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isSubmitting || isCompressing}
                            >
                                {isCompressing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4 w-4" />}
                                {imagePreviewUrl ? "Change Image" : "Upload Image"}
                            </Button>
                            {imagePreviewUrl && (
                                <Button type="button" variant="ghost" size="sm" onClick={handleRemoveImage} disabled={isSubmitting || isCompressing}>
                                    <XCircle className="mr-2 h-4 w-4 text-destructive" /> Remove
                                </Button>
                            )}
                        </div>
                        {imagePreviewUrl && (
                            <div className="mt-4 border rounded-md p-2 relative aspect-video max-w-sm mx-auto">
                                <Image src={imagePreviewUrl} alt="Preview" layout="fill" objectFit="contain" className="rounded-md" data-ai-hint="uploaded image"/>
                            </div>
                        )}
                        <FormDescription>Max 2MB. JPG, PNG, GIF accepted.</FormDescription>
                        <FormMessage />
                    </FormItem>
                )}
             />
          </div>

          <div className="space-y-6">
            <FormField
              control={form.control}
              name="sector"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sector</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select a main sector" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {detailedSectorsData.map((sector) => (
                        <SelectItem key={sector.code} value={sector.code}>{sector.name} ({sector.code})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>Choose the primary sector for your post.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="subSector"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sub-sector (Optional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""} disabled={isSubmitting || currentSubSectors.length === 0}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={currentSubSectors.length > 0 ? "Select a sub-sector" : "No sub-sectors available"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {currentSubSectors.map((sub) => (
                        <SelectItem key={sub.code} value={sub.code}>{sub.name} ({sub.code})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>Choose a specific sub-sector if applicable.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="industry"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Industry (Optional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""} disabled={isSubmitting || currentIndustries.length === 0}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={currentIndustries.length > 0 ? "Select an industry" : "No industries available"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {currentIndustries.map((industry) => (
                        <SelectItem key={industry.code} value={industry.code}>{industry.name} ({industry.code})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>Choose a specific industry if applicable.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tags"
              render={() => (
                <FormItem>
                  <FormLabel className="text-base">Tags</FormLabel>
                  <FormDescription>Select relevant tags (select at least one).</FormDescription>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                    {availableTags.map((tag) => (
                      <FormField
                        key={tag}
                        control={form.control}
                        name="tags"
                        render={({ field }) => (
                          <FormItem key={tag} className="flex flex-row items-center space-x-2 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(tag)}
                                onCheckedChange={(checked) =>
                                  checked
                                    ? field.onChange([...(field.value || []), tag])
                                    : field.onChange((field.value || []).filter(value => value !== tag))
                                }
                                disabled={isSubmitting}
                              />
                            </FormControl>
                            <FormLabel className="font-normal text-sm">{tag}</FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <DialogFooter className="pt-8 md:col-span-2">
            <DialogClose asChild>
                 <Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting || isCompressing || isLoadingSuggestibleUsers}>
                {isSubmitting || isCompressing ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {isCompressing ? "Compressing..." : "Posting..."}
                    </>
                 ) : (
                    'Submit Post'
                 )}
            </Button>
        </DialogFooter>
      </form>

      <AlertDialog open={showCompressionDialog} onOpenChange={setShowCompressionDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Image Too Large</AlertDialogTitle>
            <AlertDialogDescription>
              The selected image exceeds {MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.
              Would you like to compress it? This may slightly reduce quality.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setOriginalTooLargeFile(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
              form.setValue("image", null);
              setImagePreviewUrl(null);
              setSelectedImageFile(null);
            }}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCompressAndSetImage} className="bg-primary hover:bg-primary/90">
              <ImageDown className="mr-2 h-4 w-4" /> Compress Image
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Form>
  );
};
