
// src/components/RequestHelpForm.tsx
"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { Loader2, Upload, XCircle, ImageDown, CalendarDays, AtSign } from 'lucide-react';
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
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { getSuggestibleUsers } from '@/services/connectionService';
import type { UserProfileBasic } from '@/types/connection';
import { generateAnonymousName, getInitials as getSharedInitials } from '@/lib/pseudonymUtils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

const getInitials = (name: string | undefined | null): string => {
    return getSharedInitials(name);
};


const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/gif"];

const requestHelpFormSchema = z.object({
  question: z.string().min(10, "Question must be at least 10 characters long.").max(200, "Question cannot exceed 200 characters."),
  descriptionDetails: z.string().min(20, { message: "Problem details must be at least 20 characters." }),
  descriptionTried: z.string().optional(),
  descriptionOutcome: z.string().optional(),
  tags: z.array(z.string()).min(1, "Please select at least one tag."),
  sector: z.string().min(1, "Please select a sector."),
  subSector: z.string().optional(),
  industry: z.string().optional(),
  paymentAmount: z.coerce.number({ invalid_type_error: "Must be a number" }).positive({ message: "Amount must be positive" }).optional(),
  deadline: z.date().optional(),
  image: z.instanceof(File).optional().nullable()
    .refine(file => !file || file.size <= MAX_FILE_SIZE_BYTES, `Max image size is 2MB.`)
    .refine(
      file => !file || ACCEPTED_IMAGE_TYPES.includes(file.type),
      "Only .jpg, .jpeg, .png and .gif formats are supported."
    ),
});

export interface RequestHelpFormData {
  question: string;
  descriptionDetails: string; // Now mandatory
  descriptionTried?: string;
  descriptionOutcome?: string;
  tags: string[];
  sector: string;
  subSector?: string;
  industry?: string;
  paymentAmount?: number;
  deadline?: Date;
  imageFile?: File | null;
  mentionedUserIds: string[];
}

interface RequestHelpFormProps {
  onSubmit: (data: RequestHelpFormData) => void;
  availableTags: string[];
  detailedSectorsData: SectorWithSubSectors[];
  isSubmitting: boolean;
  currentUserId: string | null;
}

export const RequestHelpForm: React.FC<RequestHelpFormProps> = ({ onSubmit, availableTags, detailedSectorsData, isSubmitting, currentUserId }) => {
  const form = useForm<z.infer<typeof requestHelpFormSchema>>({
    resolver: zodResolver(requestHelpFormSchema),
    defaultValues: {
      question: "",
      descriptionDetails: "",
      descriptionTried: "",
      descriptionOutcome: "",
      tags: [],
      sector: "",
      subSector: "",
      industry: "",
      paymentAmount: undefined,
      deadline: undefined,
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

  // State for @mention in Problem Details tab
  const [descriptionDetailsMentionQuery, setDescriptionDetailsMentionQuery] = useState('');
  const [showDescriptionDetailsSuggestions, setShowDescriptionDetailsSuggestions] = useState(false);
  const [debouncedDescriptionDetailsQuery, setDebouncedDescriptionDetailsQuery] = useState('');
  const descriptionDetailsTextareaRef = useRef<HTMLTextAreaElement>(null);
  const descriptionDetailsSuggestionsPopoverRef = useRef<HTMLDivElement>(null);
  const [selectedMentionedUserIds, setSelectedMentionedUserIds] = useState<Set<string>>(new Set());


  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedDescriptionDetailsQuery(descriptionDetailsMentionQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [descriptionDetailsMentionQuery]);


  const { data: suggestibleUsers = [], isLoading: isLoadingSuggestibleUsers } = useQuery<UserProfileBasic[]>({
    queryKey: ['suggestibleUsersForHelpRequest', debouncedDescriptionDetailsQuery, currentUserId],
    queryFn: () => getSuggestibleUsers(debouncedDescriptionDetailsQuery, debouncedDescriptionDetailsQuery ? 10 : 25),
    enabled: showDescriptionDetailsSuggestions && !!currentUserId,
    staleTime: 1000 * 60 * 1,
    retry: 1,
  });

  const selectedSectorCode = form.watch("sector");
  const selectedSubSectorCode = form.watch("subSector");

  useEffect(() => {
    if (selectedSectorCode) {
      const selectedMainSector = detailedSectorsData.find(s => s.code === selectedSectorCode);
      setCurrentSubSectors(selectedMainSector?.subSectors || []);
      form.resetField("subSector", { defaultValue: "" });
      form.resetField("industry", { defaultValue: "" });
      setCurrentIndustries([]);
    } else {
      setCurrentSubSectors([]);
      setCurrentIndustries([]);
      form.resetField("subSector", { defaultValue: "" });
      form.resetField("industry", { defaultValue: "" });
    }
  }, [selectedSectorCode, detailedSectorsData, form]);

  useEffect(() => {
    if (selectedSubSectorCode) {
      const selectedSub = currentSubSectors.find(ss => ss.code === selectedSubSectorCode);
      setCurrentIndustries(selectedSub?.industries || []);
      form.resetField("industry", { defaultValue: "" });
    } else {
      setCurrentIndustries([]);
      form.resetField("industry", { defaultValue: "" });
    }
  }, [selectedSubSectorCode, currentSubSectors, form]);


  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    form.setValue("image", null);
    setSelectedImageFile(null);
    setOriginalTooLargeFile(null);
    setImagePreviewUrl(null);

    if (file) {
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        toast({ variant: "destructive", title: "Invalid File Type", description: "Please select a JPG, PNG, or GIF image." });
        if (fileInputRef.current) fileInputRef.current.value = "";
        form.setValue("image", null);
        return;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setOriginalTooLargeFile(file);
        setShowCompressionDialog(true);
        if (fileInputRef.current) fileInputRef.current.value = "";
        form.setValue("image", null);
        return;
      }
      setSelectedImageFile(file);
      form.setValue("image", file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreviewUrl(reader.result as string);
      reader.readAsDataURL(file);
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
      console.error("[RequestHelpForm] Image compression error:", error);
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

  const handleSubmitForm = (values: z.infer<typeof requestHelpFormSchema>) => {
    const submitData: RequestHelpFormData = {
        question: values.question,
        descriptionDetails: values.descriptionDetails,
        descriptionTried: values.descriptionTried,
        descriptionOutcome: values.descriptionOutcome,
        tags: values.tags,
        sector: values.sector,
        subSector: values.subSector,
        industry: values.industry,
        paymentAmount: values.paymentAmount,
        deadline: values.deadline,
        imageFile: selectedImageFile,
        mentionedUserIds: Array.from(selectedMentionedUserIds),
    };
    onSubmit(submitData);
    setSelectedMentionedUserIds(new Set());
    setDescriptionDetailsMentionQuery('');
    setShowDescriptionDetailsSuggestions(false);
    form.reset(); 
    setImagePreviewUrl(null);
    setSelectedImageFile(null);
  };

  const evaluateMentionState = useCallback((text: string, cursorPosition: number) => {
    let activeQuery = null;
    const textBeforeCursor = text.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex > -1 && (lastAtIndex === 0 || /\s|^$/.test(textBeforeCursor.charAt(lastAtIndex - 1)))) {
        const potentialQuery = textBeforeCursor.substring(lastAtIndex + 1);
        if (!/\s/.test(potentialQuery) && !/\n/.test(potentialQuery)) {
            activeQuery = potentialQuery;
        }
    }
    setDescriptionDetailsMentionQuery(activeQuery || '');
    setShowDescriptionDetailsSuggestions(activeQuery !== null);
  }, [setDescriptionDetailsMentionQuery, setShowDescriptionDetailsSuggestions]);


  const handleDescriptionDetailsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    form.setValue("descriptionDetails", value);
    if (descriptionDetailsTextareaRef.current) {
        evaluateMentionState(value, descriptionDetailsTextareaRef.current.selectionStart || 0);
    }
  };

  const handleDescriptionDetailsFocus = () => {
    if (descriptionDetailsTextareaRef.current) {
        evaluateMentionState(descriptionDetailsTextareaRef.current.value, descriptionDetailsTextareaRef.current.selectionStart || 0);
    }
  };
  
  const handleSelectDescriptionDetailsSuggestion = (profile: UserProfileBasic) => {
    if (!descriptionDetailsTextareaRef.current || !profile.mentionName) return;
    const currentValue = form.getValues("descriptionDetails") || "";
    const cursorPosition = descriptionDetailsTextareaRef.current.selectionStart || 0;
    const textBeforeCursor = currentValue.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex > -1) {
        const textBeforeMention = currentValue.substring(0, lastAtIndex);
        const textAfterCursor = currentValue.substring(cursorPosition);
        const mentionToInsert = profile.mentionName; 
        const newText = `${textBeforeMention}@${mentionToInsert} ${textAfterCursor}`;
        
        form.setValue("descriptionDetails", newText, { shouldValidate: true, shouldDirty: true });
        setSelectedMentionedUserIds(prev => new Set(prev).add(profile.userId));
        
        const newCursorPosition = textBeforeMention.length + `@${mentionToInsert} `.length;
        setTimeout(() => {
            descriptionDetailsTextareaRef.current?.focus();
            descriptionDetailsTextareaRef.current?.setSelectionRange(newCursorPosition, newCursorPosition);
        }, 0);
    }
    setShowDescriptionDetailsSuggestions(false);
    setDescriptionDetailsMentionQuery('');
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (
            showDescriptionDetailsSuggestions &&
            descriptionDetailsSuggestionsPopoverRef.current &&
            !descriptionDetailsSuggestionsPopoverRef.current.contains(event.target as Node) &&
            descriptionDetailsTextareaRef.current &&
            !descriptionDetailsTextareaRef.current.contains(event.target as Node)
        ) {
            if(showDescriptionDetailsSuggestions) setShowDescriptionDetailsSuggestions(false);
        }
    };
    if (showDescriptionDetailsSuggestions) {
        document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDescriptionDetailsSuggestions]);

  useEffect(() => {
    if (!form.formState.isDirty && !form.formState.isSubmitting) {
      setSelectedMentionedUserIds(new Set());
    }
  }, [form.formState.isDirty, form.formState.isSubmitting]);

 const filteredDescriptionSuggestions = useMemo(() => {
    if (!showDescriptionDetailsSuggestions) return [];
    if (isLoadingSuggestibleUsers) return [{ userId: 'loading-desc', actualDisplayName: 'Loading users...', mentionName: 'loading-desc' } as UserProfileBasic];
    
    const profilesSource = suggestibleUsers.filter(p => p.userId !== currentUserId && !!p.mentionName);
    let results: UserProfileBasic[];

    if (debouncedDescriptionDetailsQuery.trim() === '') {
        results = profilesSource.slice(0, 25); 
    } else {
        const queryLower = debouncedDescriptionDetailsQuery.toLowerCase();
        results = profilesSource.filter(
            p => p.mentionName.toLowerCase().includes(queryLower) ||
                 (p.actualDisplayName && p.actualDisplayName.toLowerCase().includes(queryLower)) ||
                 (p.companyName && p.companyName.toLowerCase().includes(queryLower))
        ).slice(0, 10);
    }
    if (results.length === 0 && debouncedDescriptionDetailsQuery.trim() !== '') {
        return [{ userId: 'no-match-desc', actualDisplayName: `No users matching "@${debouncedDescriptionDetailsQuery}"`, mentionName:'no-match-desc' } as UserProfileBasic];
    }
    if (results.length === 0) {
        return [{ userId: 'no-users-desc', actualDisplayName: 'No users to suggest for this context.', mentionName: 'no-users-desc' } as UserProfileBasic];
    }
    return results;
  }, [debouncedDescriptionDetailsQuery, suggestibleUsers, isLoadingSuggestibleUsers, showDescriptionDetailsSuggestions, currentUserId]);


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmitForm)} className="space-y-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 p-1">
          <div className="space-y-6 flex flex-col">
            <FormField
              control={form.control}
              name="question"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Question / Need <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., How to improve B2B lead generation?" {...field} disabled={isSubmitting} />
                  </FormControl>
                  <FormDescription>Keep it concise and clear.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Tabs defaultValue="details" className="w-full flex-grow flex flex-col">
              <TabsList className="grid w-full grid-cols-3 bg-background border-b-2 border-border p-0 h-auto rounded-none">
                <TabsTrigger value="details" className="text-xs px-2 py-2.5 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none rounded-none data-[state=active]:bg-primary/5 hover:bg-muted/50">
                  Problem Details <span className="text-destructive ml-1">*</span>
                </TabsTrigger>
                <TabsTrigger value="tried" className="text-xs px-2 py-2.5 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none rounded-none data-[state=active]:bg-primary/5 hover:bg-muted/50">
                  What I've Tried
                </TabsTrigger>
                <TabsTrigger value="outcome" className="text-xs px-2 py-2.5 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none rounded-none data-[state=active]:bg-primary/5 hover:bg-muted/50">
                  Expected Outcome
                </TabsTrigger>
              </TabsList>
              <TabsContent value="details" className="mt-0 flex-grow flex flex-col border border-t-0 rounded-b-md p-3">
                <FormField
                  control={form.control}
                  name="descriptionDetails"
                  render={({ field }) => (
                    <FormItem className="flex-grow flex flex-col">
                      {/* <FormLabel>Detailed Description <span className="text-destructive">*</span></FormLabel> */}
                      <Popover
                        open={showDescriptionDetailsSuggestions && filteredDescriptionSuggestions.length > 0 && (filteredDescriptionSuggestions[0]?.userId !== 'loading-desc' && filteredDescriptionSuggestions[0]?.userId !== 'no-users-desc' && filteredDescriptionSuggestions[0]?.userId !== 'no-match-desc')}
                        onOpenChange={(isOpen) => {
                            setShowDescriptionDetailsSuggestions(isOpen);
                            if (!isOpen) setDescriptionDetailsMentionQuery('');
                        }}
                      >
                        <PopoverTrigger asChild>
                          <FormControl className="flex-grow">
                            <Textarea
                              placeholder="Provide full details about the problem or need... (@mention users)"
                              className="resize-y min-h-[150px] flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 shadow-none"
                              {...field}
                              ref={(e) => {
                                field.ref(e);
                                descriptionDetailsTextareaRef.current = e;
                              }}
                              onChange={handleDescriptionDetailsChange}
                              onFocus={handleDescriptionDetailsFocus}
                              onBlurCapture={() => setTimeout(() => {
                                if (descriptionDetailsSuggestionsPopoverRef.current && !descriptionDetailsSuggestionsPopoverRef.current.contains(document.activeElement as Node) && descriptionDetailsTextareaRef.current !== document.activeElement) {
                                  setShowDescriptionDetailsSuggestions(false);
                                }
                              }, 150)}
                              disabled={isSubmitting}
                            />
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent
                            ref={descriptionDetailsSuggestionsPopoverRef}
                            className="w-[--radix-popover-trigger-width] p-1 mt-1 max-h-48 overflow-y-auto"
                            side="bottom"
                            align="start"
                            onOpenAutoFocus={(e) => e.preventDefault()}
                          >
                           {filteredDescriptionSuggestions.map(profile => {
                                const displayableName = profile.actualDisplayName || profile.companyName;
                                const showSecondaryNameLine = displayableName && profile.mentionName && displayableName.toLowerCase() !== profile.mentionName.toLowerCase();
                                
                                return (
                                    profile.userId === 'loading-desc' || profile.userId === 'no-users-desc' || profile.userId === 'no-match-desc' ? (
                                        <div key={profile.userId} className="p-2 text-center text-xs text-muted-foreground">
                                            {profile.actualDisplayName}
                                        </div>
                                    ) : (
                                        <Button
                                            key={profile.userId}
                                            variant="ghost"
                                            size="sm"
                                            className="w-full justify-start h-auto px-2 py-1 text-xs"
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => handleSelectDescriptionDetailsSuggestion(profile)}
                                        >
                                            <Avatar className="h-5 w-5 mr-2">
                                                <AvatarImage src={profile.avatarUrl} alt={profile.mentionName} />
                                                <AvatarFallback className="text-xs">{getInitials(profile.mentionName)}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col items-start">
                                                {showSecondaryNameLine && (
                                                    <span className="font-medium text-foreground">{displayableName}</span>
                                                )}
                                                <span className={cn("text-muted-foreground", !showSecondaryNameLine && "font-medium text-foreground")}>
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
              </TabsContent>
              <TabsContent value="tried" className="mt-0 flex-grow flex flex-col border border-t-0 rounded-b-md p-3">
                <FormField
                  control={form.control}
                  name="descriptionTried"
                  render={({ field }) => (
                    <FormItem className="flex-grow flex flex-col">
                      {/* <FormLabel>What You've Tried (Optional)</FormLabel> */}
                      <FormControl className="flex-grow">
                        <Textarea
                          placeholder="Describe any solutions or approaches you've already attempted..."
                          className="resize-y min-h-[150px] flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 shadow-none"
                          {...field}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>
              <TabsContent value="outcome" className="mt-0 flex-grow flex flex-col border border-t-0 rounded-b-md p-3">
                <FormField
                  control={form.control}
                  name="descriptionOutcome"
                  render={({ field }) => (
                    <FormItem className="flex-grow flex flex-col">
                      {/* <FormLabel>Expected Outcome (Optional)</FormLabel> */}
                      <FormControl className="flex-grow">
                        <Textarea
                          placeholder="What is the ideal result or solution you're looking for?"
                          className="resize-y min-h-[150px] flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 shadow-none"
                          {...field}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>
            </Tabs>

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
                      <Image src={imagePreviewUrl} alt="Preview" fill style={{objectFit:"contain"}} className="rounded-md" data-ai-hint="uploaded image"/>
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
                  <FormLabel>Sector <span className="text-destructive">*</span></FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting}>
                    <SelectTrigger><SelectValue placeholder="Select a main sector" /></SelectTrigger>
                    <SelectContent>
                      {detailedSectorsData.map((sector) => (
                        <SelectItem key={sector.code} value={sector.code}>{sector.name} ({sector.code})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                    <SelectTrigger>
                      <SelectValue placeholder={currentSubSectors.length > 0 ? "Select a sub-sector" : "No sub-sectors available"} />
                    </SelectTrigger>
                    <SelectContent>
                      {currentSubSectors.map((sub) => (
                        <SelectItem key={sub.code} value={sub.code}>{sub.name} ({sub.code})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                    <SelectTrigger>
                      <SelectValue placeholder={currentIndustries.length > 0 ? "Select an industry" : "No industries available"} />
                    </SelectTrigger>
                    <SelectContent>
                      {currentIndustries.map((industry) => (
                        <SelectItem key={industry.code} value={industry.code}>{industry.name} ({industry.code})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="paymentAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Amount / Budget (Optional)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="e.g., 500" 
                      {...field}
                      value={field.value === undefined || field.value === null || isNaN(Number(field.value)) ? '' : String(field.value)}
                      onChange={e => {
                        const value = e.target.value;
                        field.onChange(value === '' ? undefined : parseFloat(value));
                      }}
                      disabled={isSubmitting} 
                    />
                  </FormControl>
                  <FormDescription>Enter a numeric value (e.g., USD).</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="deadline"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Deadline (Optional)</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                        disabled={isSubmitting}
                        type="button" 
                      >
                        <span className="flex items-center justify-between w-full">
                          <span>
                            {field.value && field.value instanceof Date ? format(field.value, "PPP") : "Pick a date"}
                          </span>
                          <CalendarDays className="h-4 w-4 opacity-50" />
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                        disabled={(date) => date < new Date(new Date().setDate(new Date().getDate() -1))}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tags"
              render={() => (
                <FormItem>
                  <FormLabel className="text-base">Tags <span className="text-destructive">*</span></FormLabel>
                  <FormDescription>Select relevant tags (select at least one).</FormDescription>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                    {availableTags.map((tag) => (
                      <FormField
                        key={tag}
                        control={form.control}
                        name="tags"
                        render={({ field }) => (
                          <FormItem key={tag} className="flex flex-row items-center space-x-2 space-y-0">
                            <Checkbox
                                checked={field.value?.includes(tag)}
                                onCheckedChange={(checked) =>
                                  checked
                                    ? field.onChange([...(field.value || []), tag])
                                    : field.onChange((field.value || []).filter(value => value !== tag))
                                }
                                disabled={isSubmitting}
                            />
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
                        {isCompressing ? "Compressing..." : "Submitting Request..."}
                    </>
                 ) : (
                    'Submit Help Request'
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
