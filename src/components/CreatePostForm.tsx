
// src/components/CreatePostForm.tsx
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Loader2, Upload, XCircle, ImageDown, CalendarDays, AtSign, DollarSign, Briefcase, FileText, HelpCircle } from 'lucide-react';
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
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { getSuggestibleUsers } from '@/services/connectionService';
import type { UserProfileBasic } from '@/types/connection';
import { generateAnonymousName, getInitials } from '@/lib/pseudonymUtils';
import { format } from "date-fns";
import type { SectorWithSubSectors, SubSector, Industry } from '@/components/layout/MainLayout';

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/gif"];

const postFormSchema = z.object({
  requestType: z.enum(['post', 'help_request'], {
    required_error: "You must select a post type.",
  }),
  question: z.string().min(10, "Question must be at least 10 characters long.").max(200, "Question cannot exceed 200 characters."),
  // General description (for 'post' type)
  description: z.string().optional(),
  // Tabbed descriptions (for 'help_request' type)
  descriptionDetails: z.string().optional(),
  descriptionTried: z.string().optional(),
  descriptionOutcome: z.string().optional(),
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
  maxBudget: z.string().transform(val => val === '' ? undefined : val).pipe(z.coerce.number().positive("Budget must be a positive number.").optional()),
  deadline: z.date().optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.requestType === 'post' && (!data.description || data.description.trim().length < 10)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Description must be at least 10 characters for a general post.",
      path: ["description"],
    });
  }
  if (data.requestType === 'help_request' && (!data.descriptionDetails || data.descriptionDetails.trim().length < 20)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Problem details must be at least 20 characters for a help request.",
      path: ["descriptionDetails"],
    });
  }
});

export interface CreatePostFormData extends Omit<z.infer<typeof postFormSchema>, 'maxBudget' | 'image'> {
  imageFile?: File | null;
  mentionedUserIds?: string[];
  maxBudget?: number; // Ensure maxBudget is number here after Zod coercion
}

export interface CreatePostFormProps {
  onSubmit: (data: CreatePostFormData) => void;
  availableTags: string[];
  detailedSectorsData: SectorWithSubSectors[];
  isSubmitting: boolean;
  currentUserId: string | null;
  onDialogClose?: () => void; // For resetting form when dialog closes
}


export const CreatePostForm: React.FC<CreatePostFormProps> = ({
  onSubmit,
  availableTags,
  detailedSectorsData,
  isSubmitting,
  currentUserId,
  onDialogClose,
}) => {
  const form = useForm<z.infer<typeof postFormSchema>>({
    resolver: zodResolver(postFormSchema),
    defaultValues: {
      requestType: 'post',
      question: "",
      description: "",
      descriptionDetails: "",
      descriptionTried: "",
      descriptionOutcome: "",
      tags: [],
      sector: "",
      subSector: "",
      industry: "",
      image: null,
      maxBudget: undefined,
      deadline: undefined,
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

  // State for @mention in general description
  const [descriptionMentionQuery, setDescriptionMentionQuery] = useState('');
  const [showDescriptionSuggestions, setShowDescriptionSuggestions] = useState(false);
  const [debouncedDescriptionQuery, setDebouncedDescriptionQuery] = useState('');
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const descriptionSuggestionsPopoverRef = useRef<HTMLDivElement>(null);
  const [selectedDescriptionMentionedUserIds, setSelectedDescriptionMentionedUserIds] = useState<Set<string>>(new Set());

  // State for @mention in problem details (help request)
  const [problemDetailsMentionQuery, setProblemDetailsMentionQuery] = useState('');
  const [showProblemDetailsSuggestions, setShowProblemDetailsSuggestions] = useState(false);
  const [debouncedProblemDetailsQuery, setDebouncedProblemDetailsQuery] = useState('');
  const problemDetailsTextareaRef = useRef<HTMLTextAreaElement>(null);
  const problemDetailsSuggestionsPopoverRef = useRef<HTMLDivElement>(null);
  const [selectedProblemDetailsMentionedUserIds, setSelectedProblemDetailsMentionedUserIds] = useState<Set<string>>(new Set());

  const requestType = form.watch("requestType");

  // Debounce active mention query
  const activeRawQuery = requestType === 'help_request' ? problemDetailsMentionQuery : descriptionMentionQuery;
  useEffect(() => {
    const handler = setTimeout(() => {
      if (requestType === 'help_request') {
        setDebouncedProblemDetailsQuery(activeRawQuery);
      } else {
        setDebouncedDescriptionQuery(activeRawQuery);
      }
    }, 300);
    return () => {
      clearTimeout(handler);
    };
  }, [activeRawQuery, requestType]);

  const debouncedActiveQuery = requestType === 'help_request' ? debouncedProblemDetailsQuery : debouncedDescriptionQuery;
  const showActiveSuggestions = requestType === 'help_request' ? showProblemDetailsSuggestions : showDescriptionSuggestions;

  const { data: suggestibleUsers = [], isLoading: isLoadingSuggestibleUsers } = useQuery<UserProfileBasic[]>({
    queryKey: ['suggestibleUsersForCreatePost', debouncedActiveQuery, currentUserId, requestType],
    queryFn: () => getSuggestibleUsers(debouncedActiveQuery, debouncedActiveQuery ? 10 : 25),
    enabled: showActiveSuggestions && !!currentUserId,
  });


  // Form reset when dialog closes (if onDialogClose is provided)
  useEffect(() => {
    if (onDialogClose) { // Simple check if the prop exists
      form.reset();
      setImagePreviewUrl(null);
      setSelectedImageFile(null);
      setOriginalTooLargeFile(null);
      setShowCompressionDialog(false);
      setCurrentSubSectors([]);
      setCurrentIndustries([]);
      // Reset mention states
      setDescriptionMentionQuery(''); setShowDescriptionSuggestions(false); setSelectedDescriptionMentionedUserIds(new Set());
      setProblemDetailsMentionQuery(''); setShowProblemDetailsSuggestions(false); setSelectedProblemDetailsMentionedUserIds(new Set());
    }
  }, [form, onDialogClose]); // Assuming onDialogClose changes when dialog is opened/closed, or add isCreatePostOpen if passed


  const selectedSectorCode = form.watch("sector");
  useEffect(() => {
    if (selectedSectorCode) {
      const selectedMainSector = detailedSectorsData.find(s => s.code === selectedSectorCode);
      setCurrentSubSectors(selectedMainSector?.subSectors || []);
      form.setValue("subSector", "", { shouldValidate: true });
      form.setValue("industry", "", { shouldValidate: true });
      setCurrentIndustries([]);
    } else {
      setCurrentSubSectors([]);
      setCurrentIndustries([]);
    }
  }, [selectedSectorCode, detailedSectorsData, form]);

  const selectedSubSectorCode = form.watch("subSector");
  useEffect(() => {
    if (selectedSubSectorCode) {
      const selectedSub = currentSubSectors.find(ss => ss.code === selectedSubSectorCode);
      setCurrentIndustries(selectedSub?.industries || []);
      form.setValue("industry", "", { shouldValidate: true });
    } else {
      setCurrentIndustries([]);
    }
  }, [selectedSubSectorCode, currentSubSectors, form]);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    form.setValue("image", null, { shouldValidate: true }); 
    setSelectedImageFile(null); 
    setOriginalTooLargeFile(null); 
    setImagePreviewUrl(null);

    if (file) {
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        toast({ variant: "destructive", title: "Invalid File Type", description: "Please select a JPG, PNG, or GIF image." });
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setOriginalTooLargeFile(file);
        setShowCompressionDialog(true);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      setSelectedImageFile(file);
      form.setValue("image", file, { shouldValidate: true });
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
      const compressedFile = await imageCompression(originalTooLargeFile, { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true });
      setSelectedImageFile(compressedFile);
      form.setValue("image", compressedFile, { shouldValidate: true });
      const reader = new FileReader();
      reader.onloadend = () => setImagePreviewUrl(reader.result as string);
      reader.readAsDataURL(compressedFile);
      toast({ title: "Image Compressed", description: "Proceed with upload." });
    } catch (error) {
      console.error("Image compression error:", error);
      toast({ variant: "destructive", title: "Compression Failed", description: "Could not compress. Try a smaller file." });
      if (fileInputRef.current) fileInputRef.current.value = "";
      form.setValue("image", null, { shouldValidate: true });
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
    form.setValue("image", null, { shouldValidate: true });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmitForm = (values: z.infer<typeof postFormSchema>) => {
    const mentionedUserIds = requestType === 'help_request' 
      ? Array.from(selectedProblemDetailsMentionedUserIds)
      : Array.from(selectedDescriptionMentionedUserIds);

    const submitData: CreatePostFormData = {
      ...values,
      maxBudget: values.maxBudget, // Already a number or undefined from Zod transform
      imageFile: selectedImageFile,
      mentionedUserIds,
    };
    onSubmit(submitData);
    // Form reset is now handled by useEffect watching onDialogClose or a similar prop from MainLayout
  };

  const evaluateMentionState = useCallback((text: string, cursorPosition: number, type: 'description' | 'problemDetails') => {
    console.log("[CreatePostForm] evaluateMentionState - Text:", text, "Cursor:", cursorPosition, "Type:", type);
    let activeQuery = null;
    const textBeforeCursor = text.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex > -1 && (lastAtIndex === 0 || /\s|^$/.test(textBeforeCursor.charAt(lastAtIndex - 1)))) {
      const potentialQuery = textBeforeCursor.substring(lastAtIndex + 1);
      if (!/\s/.test(potentialQuery) && !/\n/.test(potentialQuery)) { // Check for newline as well
        activeQuery = potentialQuery;
      }
    }

    if (type === 'description') {
      setDescriptionMentionQuery(activeQuery !== null ? activeQuery : '');
      setShowDescriptionSuggestions(activeQuery !== null);
      console.log("[CreatePostForm] Description Mention - Query:", activeQuery, "Show:", activeQuery !== null);
    } else {
      setProblemDetailsMentionQuery(activeQuery !== null ? activeQuery : '');
      setShowProblemDetailsSuggestions(activeQuery !== null);
      console.log("[CreatePostForm] Problem Details Mention - Query:", activeQuery, "Show:", activeQuery !== null);
    }
  }, []);


  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>, fieldOnChange: (value: string) => void, type: 'description' | 'problemDetails') => {
    const value = e.target.value;
    fieldOnChange(value);
    const textareaRef = type === 'description' ? descriptionTextareaRef : problemDetailsTextareaRef;
    if (textareaRef.current) {
      evaluateMentionState(value, textareaRef.current.selectionStart || 0, type);
    }
  };

  const handleDescriptionFocus = (e: React.FocusEvent<HTMLTextAreaElement>, type: 'description' | 'problemDetails') => {
    if (e.target) {
      evaluateMentionState(e.target.value, e.target.selectionStart || 0, type);
    }
  };

  const handleSelectSuggestion = (profile: UserProfileBasic, type: 'description' | 'problemDetails') => {
    const textareaRef = type === 'description' ? descriptionTextareaRef : problemDetailsTextareaRef;
    const currentFieldValue = type === 'description' ? form.getValues("description") : form.getValues("descriptionDetails");
    const fieldName = type === 'description' ? "description" : "descriptionDetails";
    const setSelectedMentionIds = type === 'description' ? setSelectedDescriptionMentionedUserIds : setSelectedProblemDetailsMentionedUserIds;
    const setShowSuggestionsFn = type === 'description' ? setShowDescriptionSuggestions : setShowProblemDetailsSuggestions;
    const setMentionQueryFn = type === 'description' ? setDescriptionMentionQuery : setProblemDetailsMentionQuery;

    if (!textareaRef.current || !profile.mentionName) return;

    const currentValue = currentFieldValue || "";
    const cursorPosition = textareaRef.current.selectionStart || 0;
    const textBeforeCursor = currentValue.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex > -1) {
      const textBeforeMention = currentValue.substring(0, lastAtIndex);
      const textAfterCursor = currentValue.substring(cursorPosition);
      const newText = `${textBeforeMention}@${profile.mentionName} ${textAfterCursor}`;
      form.setValue(fieldName, newText, { shouldValidate: true, shouldDirty: true });
      setSelectedMentionIds(prev => new Set(prev).add(profile.userId));
      const newCursorPosition = textBeforeMention.length + `@${profile.mentionName} `.length;
      setTimeout(() => {
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(newCursorPosition, newCursorPosition);
      }, 0);
    }
    setShowSuggestionsFn(false);
    setMentionQueryFn('');
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showDescriptionSuggestions && descriptionSuggestionsPopoverRef.current && !descriptionSuggestionsPopoverRef.current.contains(event.target as Node) && descriptionTextareaRef.current && !descriptionTextareaRef.current.contains(event.target as Node)) {
        setShowDescriptionSuggestions(false);
      }
      if (showProblemDetailsSuggestions && problemDetailsSuggestionsPopoverRef.current && !problemDetailsSuggestionsPopoverRef.current.contains(event.target as Node) && problemDetailsTextareaRef.current && !problemDetailsTextareaRef.current.contains(event.target as Node)) {
        setShowProblemDetailsSuggestions(false);
      }
    };
    if (showDescriptionSuggestions || showProblemDetailsSuggestions) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDescriptionSuggestions, showProblemDetailsSuggestions]);

  const filteredSuggestions = useMemo(() => {
    if (!showActiveSuggestions) return [];
    if (isLoadingSuggestibleUsers) return [{ userId: 'loading-form', displayName: 'Loading users...', mentionName: 'loading-form' } as UserProfileBasic];
    
    let source = suggestibleUsers.filter(p => p.userId !== currentUserId && !!p.mentionName);
    if (debouncedActiveQuery.trim() === '') {
      source = source.slice(0, 5); // Show top 5 if no query
    } else {
      const queryLower = debouncedActiveQuery.toLowerCase();
      source = source.filter(p => 
        p.mentionName.toLowerCase().includes(queryLower) || 
        (p.displayName && p.displayName.toLowerCase().includes(queryLower))
      );
      source = source.slice(0,10);
    }
    if (source.length === 0 && debouncedActiveQuery.trim() !== '') return [{ userId: 'no-match-form', displayName: `No users matching "@${debouncedActiveQuery}"`, mentionName: 'no-match-form' } as UserProfileBasic];
    if (source.length === 0) return [{ userId: 'no-users-form', displayName: 'No users to suggest.', mentionName: 'no-users-form' } as UserProfileBasic];
    return source;
  }, [showActiveSuggestions, isLoadingSuggestibleUsers, suggestibleUsers, currentUserId, debouncedActiveQuery]);


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmitForm)} className="space-y-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 p-1">
          {/* Left Column */}
          <div className="space-y-6 flex flex-col">
            <FormField
              control={form.control}
              name="requestType"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel className="text-base font-semibold text-foreground">What kind of post is this? <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={(value) => {
                        field.onChange(value);
                        // Reset description fields when type changes
                        form.setValue("description", "");
                        form.setValue("descriptionDetails", "");
                        form.setValue("descriptionTried", "");
                        form.setValue("descriptionOutcome", "");
                        form.trigger(); // Re-validate form
                      }}
                      defaultValue={field.value}
                      className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4"
                      disabled={isSubmitting}
                    >
                      <FormItem className="flex items-center space-x-2">
                        <FormControl><RadioGroupItem value="post" id="type-post-dialog" /></FormControl>
                        <FormLabel htmlFor="type-post-dialog" className="font-normal flex items-center gap-1.5"><FileText className="h-4 w-4 text-muted-foreground"/> General Post / Question</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-2">
                        <FormControl><RadioGroupItem value="help_request" id="type-help-dialog" /></FormControl>
                        <FormLabel htmlFor="type-help-dialog" className="font-normal flex items-center gap-1.5"><HelpCircle className="h-4 w-4 text-muted-foreground"/> Request Help from Others</FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="question"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Question / Need <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input placeholder="e.g., Seeking expertise in B2B marketing automation" {...field} disabled={isSubmitting} /></FormControl>
                  <FormDescription>Keep it concise and clear (max 200 characters).</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {requestType === 'post' && (
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="flex-grow flex flex-col">
                    <FormLabel>Description <span className="text-destructive">*</span></FormLabel>
                     <Popover open={showDescriptionSuggestions && filteredSuggestions.length > 0 && !['loading-form', 'no-users-form', 'no-match-form'].includes(filteredSuggestions[0]?.userId)} onOpenChange={(open) => {setShowDescriptionSuggestions(open); if(!open) setDescriptionMentionQuery('');}}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Textarea
                            placeholder="Provide more context or details... (@mention users)"
                            className="flex-grow resize-y min-h-[120px] flex-1"
                            {...field}
                            ref={descriptionTextareaRef}
                            value={field.value || ''}
                            onChange={(e) => handleDescriptionChange(e, field.onChange, 'description')}
                            onFocus={(e) => handleDescriptionFocus(e, 'description')}
                            onBlurCapture={() => setTimeout(() => { if (descriptionSuggestionsPopoverRef.current && !descriptionSuggestionsPopoverRef.current.contains(document.activeElement as Node) && descriptionTextareaRef.current !== document.activeElement) { setShowDescriptionSuggestions(false);}}, 150)}
                            disabled={isSubmitting}
                          />
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent ref={descriptionSuggestionsPopoverRef} className="w-[--radix-popover-trigger-width] p-1 mt-1 max-h-48 overflow-y-auto" side="bottom" align="start" onOpenAutoFocus={(e)=>e.preventDefault()}>
                        {filteredSuggestions.map(profile => {
                            const displayableName = profile.actualDisplayName || profile.companyName;
                            const showSecondaryNameLine = displayableName && profile.mentionName && displayableName.toLowerCase() !== profile.mentionName.toLowerCase();
                            return (
                                ['loading-form', 'no-users-form', 'no-match-form'].includes(profile.userId) ? (
                                 <div key={profile.userId} className="p-2 text-center text-xs text-muted-foreground">{profile.displayName}</div>
                                ) : (
                                <Button key={profile.userId} variant="ghost" size="sm" className="w-full justify-start h-auto px-2 py-1 text-xs" onMouseDown={(e)=>e.preventDefault()} onClick={() => handleSelectSuggestion(profile, 'description')}>
                                    <Avatar className="h-5 w-5 mr-2"><AvatarImage src={profile.avatarUrl} alt={profile.mentionName} /><AvatarFallback className="text-xs">{getInitials(profile.mentionName)}</AvatarFallback></Avatar>
                                    <div className="flex flex-col items-start">
                                    {showSecondaryNameLine && (<span className="font-medium text-foreground">{displayableName}</span>)}
                                    <span className={cn("text-muted-foreground", !showSecondaryNameLine && "font-medium text-foreground")}>@{profile.mentionName}</span>
                                    </div>
                                </Button>
                                )
                            );
                        })}
                      </PopoverContent>
                    </Popover>
                    <FormDescription>Provide more context (min 10 characters).</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {requestType === 'help_request' && (
              <div className="flex-grow flex flex-col space-y-2">
                <Label className="text-base font-semibold text-foreground">Describe Your Request <span className="text-destructive">*</span></Label>
                <Tabs defaultValue="details" className="w-full flex-grow flex flex-col">
                  <TabsList className="grid w-full grid-cols-3 bg-transparent p-0 border-b-2 border-border rounded-none h-auto">
                    <TabsTrigger value="details" className={cn("text-xs px-3 py-2.5 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none rounded-none data-[state=active]:bg-primary/5 hover:bg-muted/50 focus-visible:ring-0 focus-visible:ring-offset-0", form.getFieldState("descriptionDetails").invalid && "data-[state=inactive]:border-b-2 data-[state=inactive]:border-destructive")}>Problem Details <span className="text-destructive ml-0.5">*</span></TabsTrigger>
                    <TabsTrigger value="tried" className="text-xs px-3 py-2.5 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none rounded-none data-[state=active]:bg-primary/5 hover:bg-muted/50 focus-visible:ring-0 focus-visible:ring-offset-0">What I've Tried</TabsTrigger>
                    <TabsTrigger value="outcome" className="text-xs px-3 py-2.5 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none rounded-none data-[state=active]:bg-primary/5 hover:bg-muted/50 focus-visible:ring-0 focus-visible:ring-offset-0">Expected Outcome</TabsTrigger>
                  </TabsList>
                  <TabsContent value="details" className="mt-0 flex-grow flex flex-col border border-border border-t-0 rounded-b-md p-3 shadow-inner bg-background min-h-[150px]">
                    <FormField control={form.control} name="descriptionDetails" render={({ field }) => (
                      <FormItem className="flex-grow flex flex-col">
                        <FormLabel className="sr-only">Problem Details</FormLabel>
                        <Popover open={showProblemDetailsSuggestions && filteredSuggestions.length > 0 && !['loading-form', 'no-users-form', 'no-match-form'].includes(filteredSuggestions[0]?.userId)} onOpenChange={(open) => {setShowProblemDetailsSuggestions(open); if(!open) setProblemDetailsMentionQuery('');}}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Textarea placeholder="Describe the specific problem or need... (@mention users)" className="flex-grow resize-y min-h-[120px] flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 shadow-none" {...field} ref={problemDetailsTextareaRef} value={field.value || ''} onChange={(e) => handleDescriptionChange(e, field.onChange, 'problemDetails')} onFocus={(e) => handleDescriptionFocus(e, 'problemDetails')} onBlurCapture={() => setTimeout(() => { if (problemDetailsSuggestionsPopoverRef.current && !problemDetailsSuggestionsPopoverRef.current.contains(document.activeElement as Node) && problemDetailsTextareaRef.current !== document.activeElement) { setShowProblemDetailsSuggestions(false);}}, 150)} disabled={isSubmitting}/>
                            </FormControl>
                          </PopoverTrigger>
                           <PopoverContent ref={problemDetailsSuggestionsPopoverRef} className="w-[--radix-popover-trigger-width] p-1 mt-1 max-h-48 overflow-y-auto" side="bottom" align="start" onOpenAutoFocus={(e)=>e.preventDefault()}>
                            {filteredSuggestions.map(profile => {
                                const displayableName = profile.actualDisplayName || profile.companyName;
                                const showSecondaryNameLine = displayableName && profile.mentionName && displayableName.toLowerCase() !== profile.mentionName.toLowerCase();
                                return (
                                    ['loading-form', 'no-users-form', 'no-match-form'].includes(profile.userId) ? (
                                     <div key={profile.userId} className="p-2 text-center text-xs text-muted-foreground">{profile.displayName}</div>
                                    ) : (
                                    <Button key={profile.userId} variant="ghost" size="sm" className="w-full justify-start h-auto px-2 py-1 text-xs" onMouseDown={(e)=>e.preventDefault()} onClick={() => handleSelectSuggestion(profile, 'problemDetails')}>
                                        <Avatar className="h-5 w-5 mr-2"><AvatarImage src={profile.avatarUrl} alt={profile.mentionName} /><AvatarFallback className="text-xs">{getInitials(profile.mentionName)}</AvatarFallback></Avatar>
                                        <div className="flex flex-col items-start">
                                        {showSecondaryNameLine && (<span className="font-medium text-foreground">{displayableName}</span>)}
                                        <span className={cn("text-muted-foreground", !showSecondaryNameLine && "font-medium text-foreground")}>@{profile.mentionName}</span>
                                        </div>
                                    </Button>
                                    )
                                );
                            })}
                          </PopoverContent>
                        </Popover>
                        <FormDescription>Min 20 characters.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </TabsContent>
                  <TabsContent value="tried" className="mt-0 flex-grow flex flex-col border border-border border-t-0 rounded-b-md p-3 shadow-inner bg-background min-h-[150px]"><FormField control={form.control} name="descriptionTried" render={({ field }) => (<FormItem className="flex-grow flex flex-col"><FormLabel className="sr-only">What I've Tried</FormLabel><FormControl><Textarea placeholder="Describe solutions or approaches you've already attempted (optional)..." className="flex-grow resize-y min-h-[120px] flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 shadow-none" {...field} value={field.value || ''} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>)} /></TabsContent>
                  <TabsContent value="outcome" className="mt-0 flex-grow flex flex-col border border-border border-t-0 rounded-b-md p-3 shadow-inner bg-background min-h-[150px]"><FormField control={form.control} name="descriptionOutcome" render={({ field }) => (<FormItem className="flex-grow flex flex-col"><FormLabel className="sr-only">Expected Outcome</FormLabel><FormControl><Textarea placeholder="What is the ideal result or solution you're looking for (optional)?" className="flex-grow resize-y min-h-[120px] flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 shadow-none" {...field} value={field.value || ''} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>)} /></TabsContent>
                </Tabs>
              </div>
            )}

            <FormField control={form.control} name="image" render={() => (
              <FormItem>
                <FormLabel>Image (Optional)</FormLabel>
                <FormControl><Input type="file" accept="image/png, image/jpeg, image/gif" ref={fileInputRef} onChange={handleImageChange} className="hidden" disabled={isSubmitting || isCompressing} /></FormControl>
                <div className="mt-2 flex items-center gap-4">
                  <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isSubmitting || isCompressing}> {isCompressing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4 w-4" />} {imagePreviewUrl ? "Change Image" : "Upload Image"} </Button>
                  {imagePreviewUrl && (<Button type="button" variant="ghost" size="sm" onClick={handleRemoveImage} disabled={isSubmitting || isCompressing}><XCircle className="mr-2 h-4 w-4 text-destructive" /> Remove</Button>)}
                </div>
                {imagePreviewUrl && (<div className="mt-4 border rounded-md p-2 relative aspect-video max-w-sm mx-auto"><Image src={imagePreviewUrl} alt="Preview" fill style={{objectFit:"contain"}} className="rounded-md" data-ai-hint="uploaded content"/></div>)}
                <FormDescription>Max 2MB. JPG, PNG, GIF accepted.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <FormField control={form.control} name="sector" render={({ field }) => (
              <FormItem>
                <FormLabel>Sector <span className="text-destructive">*</span></FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select a main sector" /></SelectTrigger></FormControl>
                  <SelectContent>{detailedSectorsData.map(sector => (<SelectItem key={sector.code} value={sector.code}>{sector.name} ({sector.code})</SelectItem>))}</SelectContent>
                </Select>
                <FormDescription>Choose the primary sector for your post.</FormDescription><FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="subSector" render={({ field }) => (
              <FormItem>
                <FormLabel>Sub-sector (Optional)</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ""} disabled={isSubmitting || currentSubSectors.length === 0}>
                  <FormControl><SelectTrigger><SelectValue placeholder={currentSubSectors.length > 0 ? "Select a sub-sector" : "No sub-sectors available"} /></SelectTrigger></FormControl>
                  <SelectContent>{currentSubSectors.map(sub => (<SelectItem key={sub.code} value={sub.code}>{sub.name} ({sub.code})</SelectItem>))}</SelectContent>
                </Select>
                <FormDescription>Choose a specific sub-sector if applicable.</FormDescription><FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="industry" render={({ field }) => (
              <FormItem>
                <FormLabel>Industry (Optional)</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ""} disabled={isSubmitting || currentIndustries.length === 0}>
                  <FormControl><SelectTrigger><SelectValue placeholder={currentIndustries.length > 0 ? "Select an industry" : "No industries available"} /></SelectTrigger></FormControl>
                  <SelectContent>{currentIndustries.map(ind => (<SelectItem key={ind.code} value={ind.code}>{ind.name} ({ind.code})</SelectItem>))}</SelectContent>
                </Select>
                <FormDescription>Choose a specific industry if applicable.</FormDescription><FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="tags" render={() => (
              <FormItem>
                <FormLabel className="text-base font-semibold text-foreground">Tags <span className="text-destructive">*</span></FormLabel>
                <FormDescription>Select relevant tags (select at least one).</FormDescription>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                  {availableTags.map(tag => (
                    <FormField key={tag} control={form.control} name="tags" render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                        <FormControl><Checkbox checked={field.value?.includes(tag)} onCheckedChange={checked => checked ? field.onChange([...(field.value || []), tag]) : field.onChange((field.value || []).filter(v => v !== tag))} disabled={isSubmitting} /></FormControl>
                        <FormLabel className="font-normal text-sm">{tag}</FormLabel>
                      </FormItem>
                    )} />
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )} />

            {requestType === 'help_request' && (
              <>
                <FormField control={form.control} name="maxBudget" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1 text-base font-semibold text-foreground"><DollarSign className="h-4 w-4 text-green-600" />Maximum Budget (Optional)</FormLabel>
                    <FormControl><Input type="text" placeholder="e.g., 500 (USD)" {...field} value={field.value === undefined ? '' : String(field.value)} onChange={e => { const val = e.target.value; if (/^\d*\.?\d*$/.test(val) || val === "") field.onChange(val === '' ? undefined : val);}} disabled={isSubmitting} /></FormControl>
                    <FormDescription>Specify the maximum amount you're willing to offer.</FormDescription><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="deadline" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="flex items-center gap-1 text-base font-semibold text-foreground"><CalendarDays className="h-4 w-4 text-muted-foreground" />Deadline (Optional)</FormLabel>
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
                                    <span>{field.value && field.value instanceof Date ? format(field.value, "PPP") : "Pick a date"}</span>
                                    <CalendarDays className="h-4 w-4 opacity-50" />
                                </span>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={field.value || undefined}
                                onSelect={field.onChange}
                                disabled={date => date < new Date(new Date().setDate(new Date().getDate() -1)) || isSubmitting}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                    <FormDescription>Set a deadline for when you need the help by.</FormDescription><FormMessage />
                  </FormItem>
                )} />
              </>
            )}
          </div>
        </div>

        <DialogFooter className="pt-8 md:col-span-2">
            {onDialogClose && (<DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting || isCompressing || isLoadingSuggestibleUsers}>Cancel</Button></DialogClose>)}
            <Button type="submit" disabled={isSubmitting || isCompressing || isLoadingSuggestibleUsers}>
                {(isSubmitting || isCompressing) ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {isCompressing ? "Processing..." : "Submitting..."}</>) : (requestType === 'help_request' ? 'Submit Help Request' : 'Submit Post')}
            </Button>
        </DialogFooter>
      </form>

      <AlertDialog open={showCompressionDialog} onOpenChange={setShowCompressionDialog}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Image Too Large</AlertDialogTitle><AlertDialogDescription>The selected image exceeds {MAX_FILE_SIZE_BYTES / (1024*1024)}MB. Compress it?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel onClick={() => { if (fileInputRef.current) fileInputRef.current.value = ""; setOriginalTooLargeFile(null);}}>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleCompressAndSetImage} className="bg-primary hover:bg-primary/90"><ImageDown className="mr-2 h-4 w-4"/>Compress Image</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Form>
  );
};
