
// src/components/CreatePostForm.tsx
"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
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
  FormDescription
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import { DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Loader2, Upload, XCircle, ImageDown, FileText, HandHelping, DollarSign, CalendarDays, AtSign, Briefcase, Info, Sparkles, User } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { getSuggestibleUsers } from '@/services/connectionService';
import type { UserProfileBasic } from '@/types/connection';
import { generateAnonymousName, getInitials } from '@/lib/pseudonymUtils';
import { format } from "date-fns";
import type { SectorWithSubSectors, SubSector, Industry } from '@/components/layout/MainLayout';

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/gif"];

const postFormSchemaBase = z.object({
  requestType: z.enum(['post', 'help_request'], {
    required_error: "You must select a post type.",
  }),
  question: z.string().min(10, "Question must be at least 10 characters long.").max(200, "Question cannot exceed 200 characters."),
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
  // Fields for 'post' type
  description: z.string().optional(),
  // Fields for 'help_request' type
  descriptionDetails: z.string().optional(),
  descriptionTried: z.string().optional(),
  descriptionOutcome: z.string().optional(),
  maxBudget: z.string().transform(val => val === '' ? undefined : val).pipe(z.coerce.number().nonnegative("Budget must be a non-negative number.").optional()),
  deadline: z.date().optional().nullable(),
});

const postFormSchema = postFormSchemaBase.superRefine((data, ctx) => {
  if (data.requestType === 'post') {
    if (!data.description || data.description.trim().length < 10) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Description must be at least 10 characters for a general post.",
        path: ['description'],
      });
    }
  } else if (data.requestType === 'help_request') {
    if (!data.descriptionDetails || data.descriptionDetails.trim().length < 10) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Problem details must be at least 10 characters for a help request.",
        path: ['descriptionDetails'],
      });
    }
  }
});


export type CreatePostFormValues = z.infer<typeof postFormSchema>;

export interface CreatePostFormData extends Omit<CreatePostFormValues, 'image' | 'maxBudget'> {
  imageFile?: File | null;
  mentionedUserIds?: string[];
  maxBudget?: number;
}

export interface CreatePostFormProps {
  onSubmit: (data: CreatePostFormData) => void;
  availableTags: string[];
  detailedSectorsData: SectorWithSubSectors[];
  isSubmitting: boolean;
  currentUserId: string | null;
  onDialogClose?: () => void;
}


export const CreatePostForm: React.FC<CreatePostFormProps> = ({
  onSubmit,
  availableTags,
  detailedSectorsData,
  isSubmitting,
  currentUserId,
  onDialogClose,
}) => {
  const form = useForm<CreatePostFormValues>({
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

  // State for @mentions in the general description field
  const [descriptionMentionQuery, setDescriptionMentionQuery] = useState('');
  const [showDescriptionSuggestions, setShowDescriptionSuggestions] = useState(false);
  const [debouncedDescriptionQuery, setDebouncedDescriptionQuery] = useState('');
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const descriptionSuggestionsPopoverRef = useRef<HTMLDivElement>(null);

  // State for @mentions in the "Problem Details" field (for help requests)
  const [problemDetailsMentionQuery, setProblemDetailsMentionQuery] = useState('');
  const [showProblemDetailsSuggestions, setShowProblemDetailsSuggestions] = useState(false);
  const [debouncedProblemDetailsQuery, setDebouncedProblemDetailsQuery] = useState('');
  const problemDetailsTextareaRef = useRef<HTMLTextAreaElement>(null);
  const problemDetailsSuggestionsPopoverRef = useRef<HTMLDivElement>(null);

  const [selectedMentionedUserIds, setSelectedMentionedUserIds] = useState<Set<string>>(new Set());

  const requestType = form.watch("requestType");
  const activeMentionQuery = requestType === 'post' ? debouncedDescriptionQuery : debouncedProblemDetailsQuery;


  const resetForm = useCallback(() => {
    form.reset({
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
    });
    setImagePreviewUrl(null);
    setSelectedImageFile(null);
    setOriginalTooLargeFile(null);
    setShowCompressionDialog(false);
    setCurrentSubSectors([]);
    setCurrentIndustries([]);
    setDescriptionMentionQuery(''); setShowDescriptionSuggestions(false);
    setProblemDetailsMentionQuery(''); setShowProblemDetailsSuggestions(false);
    setSelectedMentionedUserIds(new Set());
    form.setValue("requestType", "post"); // Explicitly reset requestType
  }, [form]);

  useEffect(() => {
    const handleDialogClose = () => {
      if (onDialogClose) {
        resetForm();
      }
    };
    // This effect is tricky because onDialogClose itself might not change reference.
    // It's better if the parent component calls resetForm when it closes the dialog.
    // For now, assume onDialogClose is stable or not directly tied to form reset here.
    return () => {
      // Potentially call resetForm if onDialogClose prop indicates unmount/close
    };
  }, [onDialogClose, resetForm]);


  const selectedSectorCode = form.watch("sector");
  useEffect(() => {
    if (selectedSectorCode) {
      const selectedMainSector = detailedSectorsData.find(s => s.code === selectedSectorCode);
      setCurrentSubSectors(selectedMainSector?.subSectors || []);
      form.setValue("subSector", "", { shouldValidate: false });
      form.setValue("industry", "", { shouldValidate: false });
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
      form.setValue("industry", "", { shouldValidate: false });
    } else {
      setCurrentIndustries([]);
    }
  }, [selectedSubSectorCode, currentSubSectors, form]);

  // Debounce for general description mention query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedDescriptionQuery(descriptionMentionQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [descriptionMentionQuery]);

  // Debounce for problem details mention query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedProblemDetailsQuery(problemDetailsMentionQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [problemDetailsMentionQuery]);

  const { data: suggestibleUsers = [], isLoading: isLoadingSuggestibleUsers } = useQuery<UserProfileBasic[]>({
    queryKey: ['suggestibleUsersForCreatePost', activeMentionQuery, currentUserId],
    queryFn: () => getSuggestibleUsers(activeMentionQuery, activeMentionQuery ? 10 : 25),
    enabled: (showDescriptionSuggestions || showProblemDetailsSuggestions) && !!currentUserId,
  });

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    form.setValue("image", null); // Reset form value first
    setSelectedImageFile(null);
    setOriginalTooLargeFile(null);
    setImagePreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (file) {
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        toast({ variant: "destructive", title: "Invalid File Type", description: "Please select a JPG, PNG, GIF, or WebP image." });
        return;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setOriginalTooLargeFile(file);
        setShowCompressionDialog(true);
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
      const compressedFile = await imageCompression(originalTooLargeFile, { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true });
      setSelectedImageFile(compressedFile);
      form.setValue("image", compressedFile);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreviewUrl(reader.result as string);
      reader.readAsDataURL(compressedFile);
      toast({ title: "Image Compressed", description: "Proceed with upload." });
    } catch (error) {
      console.error("Image compression error:", error);
      toast({ variant: "destructive", title: "Compression Failed", description: "Could not compress. Try a smaller file." });
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
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const evaluateMentionState = useCallback((text: string, cursorPosition: number, setQuery: (q: string) => void, setShowSuggestionsBool: (s: boolean) => void) => {
    console.log("[CreatePostForm] evaluateMentionState - Text:", text, "Cursor:", cursorPosition);
    let activeQuery = null;
    const textBeforeCursor = text.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex > -1 && (lastAtIndex === 0 || /\s|^$/.test(textBeforeCursor.charAt(lastAtIndex - 1)))) {
      const potentialQuery = textBeforeCursor.substring(lastAtIndex + 1);
      if (!/\s/.test(potentialQuery) && !/\\n/.test(potentialQuery)) { // Corrected regex for newline
        activeQuery = potentialQuery;
      }
    }
    setQuery(activeQuery !== null ? activeQuery : '');
    setShowSuggestionsBool(activeQuery !== null);
    console.log("[CreatePostForm] evaluateMentionState - Active Query:", activeQuery);
  }, []);


  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    form.setValue("description", value, { shouldValidate: true, shouldDirty: true });
    if (descriptionTextareaRef.current) {
      evaluateMentionState(value, descriptionTextareaRef.current.selectionStart || 0, setDescriptionMentionQuery, setShowDescriptionSuggestions);
    }
  };

  const handleDescriptionFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    evaluateMentionState(e.target.value, e.target.selectionStart || 0, setDescriptionMentionQuery, setShowDescriptionSuggestions);
  };

  const handleProblemDetailsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    form.setValue("descriptionDetails", value, { shouldValidate: true, shouldDirty: true });
    if (problemDetailsTextareaRef.current) {
      evaluateMentionState(value, problemDetailsTextareaRef.current.selectionStart || 0, setProblemDetailsMentionQuery, setShowProblemDetailsSuggestions);
    }
  };
  
  const handleProblemDetailsFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    evaluateMentionState(e.target.value, e.target.selectionStart || 0, setProblemDetailsMentionQuery, setShowProblemDetailsSuggestions);
  };


  const handleSelectSuggestion = useCallback((profile: UserProfileBasic, querySetter: (q:string)=>void, showSetter: (s:boolean)=>void, fieldName: keyof CreatePostFormValues, textareaRef: React.RefObject<HTMLTextAreaElement>) => {
    if (!textareaRef.current || !profile.mentionName) return;
    const currentValue = form.getValues(fieldName) as string || "";
    const cursorPosition = textareaRef.current.selectionStart || 0;
    const textBeforeCursor = currentValue.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex > -1) {
      const textBeforeMention = currentValue.substring(0, lastAtIndex);
      const textAfterCursor = currentValue.substring(cursorPosition);
      const newText = `${textBeforeMention}@${profile.mentionName} ${textAfterCursor}`;
      form.setValue(fieldName, newText, { shouldValidate: true, shouldDirty: true });
      setSelectedMentionedUserIds(prev => new Set(prev).add(profile.userId));
      const newCursorPosition = textBeforeMention.length + `@${profile.mentionName} `.length;
      setTimeout(() => {
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(newCursorPosition, newCursorPosition);
      }, 0);
    }
    showSetter(false);
    querySetter('');
  }, [form, setSelectedMentionedUserIds]);

  const handleSelectDescriptionSuggestion = (profile: UserProfileBasic) => {
    handleSelectSuggestion(profile, setDescriptionMentionQuery, setShowDescriptionSuggestions, "description", descriptionTextareaRef);
  };

  const handleSelectProblemDetailsSuggestion = (profile: UserProfileBasic) => {
    handleSelectSuggestion(profile, setProblemDetailsMentionQuery, setShowProblemDetailsSuggestions, "descriptionDetails", problemDetailsTextareaRef);
  };


  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showDescriptionSuggestions && descriptionSuggestionsPopoverRef.current && !descriptionSuggestionsPopoverRef.current.contains(event.target as Node) && descriptionTextareaRef.current && !descriptionTextareaRef.current.contains(event.target as Node)) {
        if (showDescriptionSuggestions) setShowDescriptionSuggestions(false);
      }
      if (showProblemDetailsSuggestions && problemDetailsSuggestionsPopoverRef.current && !problemDetailsSuggestionsPopoverRef.current.contains(event.target as Node) && problemDetailsTextareaRef.current && !problemDetailsTextareaRef.current.contains(event.target as Node)) {
        if (showProblemDetailsSuggestions) setShowProblemDetailsSuggestions(false);
      }
    };
    if (showDescriptionSuggestions || showProblemDetailsSuggestions) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDescriptionSuggestions, showProblemDetailsSuggestions]);


  const filteredSuggestions = useMemo(() => {
    const show = requestType === 'post' ? showDescriptionSuggestions : showProblemDetailsSuggestions;
    if (!show) return [];
    if (isLoadingSuggestibleUsers) return [{ userId: 'loading-desc', mentionName: 'loading-desc', displayName: 'Loading users...' } as UserProfileBasic];
    
    let source = suggestibleUsers.filter(p => p.userId !== currentUserId && !!p.mentionName);
    const query = requestType === 'post' ? debouncedDescriptionQuery : debouncedProblemDetailsQuery;

    if (query.trim() === '') {
        return source.slice(0, 5);
    }
    const queryLower = query.toLowerCase();
    const filtered = source.filter(p =>
        p.mentionName.toLowerCase().includes(queryLower) ||
        (p.displayName && p.displayName.toLowerCase().includes(queryLower)) ||
        (p.companyName && p.companyName.toLowerCase().includes(queryLower))
    );
    if (filtered.length === 0 && query.trim() !== '') {
        return [{ userId: 'no-match-desc', mentionName: 'no-match-desc', displayName: `No users matching "@${query}"` } as UserProfileBasic];
    }
     if (filtered.length === 0) {
        return [{ userId: 'no-users-desc', mentionName: 'no-users-desc', displayName: 'No users to suggest.' } as UserProfileBasic];
    }
    return filtered.slice(0,10);
  }, [suggestibleUsers, isLoadingSuggestibleUsers, currentUserId, showDescriptionSuggestions, debouncedDescriptionQuery, showProblemDetailsSuggestions, debouncedProblemDetailsQuery, requestType]);


  const handleSubmitForm = (values: CreatePostFormValues) => {
    console.log("[CreatePostForm] Values submitted:", JSON.stringify(values, null, 2));
    
    const finalMentionedUids = Array.from(selectedMentionedUserIds);
    
    const submitData: CreatePostFormData = {
      ...values,
      imageFile: selectedImageFile,
      mentionedUserIds: finalMentionedUids,
      maxBudget: values.maxBudget,
      description: values.requestType === 'post' ? values.description : undefined,
      descriptionDetails: values.requestType === 'help_request' ? values.descriptionDetails : undefined,
      descriptionTried: values.requestType === 'help_request' ? values.descriptionTried : undefined,
      descriptionOutcome: values.requestType === 'help_request' ? values.descriptionOutcome : undefined,
    };
    onSubmit(submitData);
    if (onDialogClose) {
        onDialogClose();
    }
    // resetForm(); // Reset form handled by parent dialog onOpenChange
  };

  const [activeDescTab, setActiveDescTab] = useState("details");

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
                    <div className="flex items-center gap-3">
                        <Button
                            type="button"
                            variant={field.value === 'post' ? 'default' : 'outline'}
                            onClick={() => field.onChange('post')}
                            className={cn("flex-1 py-2.5 text-sm rounded-md shadow-sm transition-all duration-150 ease-in-out",
                                field.value === 'post' ? "ring-2 ring-primary ring-offset-2" : "hover:bg-muted/70"
                            )}
                            disabled={isSubmitting}
                        >
                            <FileText className="mr-2 h-4 w-4"/> General Post
                        </Button>
                        <Button
                            type="button"
                            variant={field.value === 'help_request' ? 'default' : 'outline'}
                            onClick={() => field.onChange('help_request')}
                            className={cn("flex-1 py-2.5 text-sm rounded-md shadow-sm transition-all duration-150 ease-in-out",
                                field.value === 'help_request' ? "ring-2 ring-primary ring-offset-2" : "hover:bg-muted/70"
                            )}
                            disabled={isSubmitting}
                        >
                           <HandHelping className="mr-2 h-4 w-4"/> Request Help
                        </Button>
                    </div>
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
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <div className="flex-grow flex flex-col space-y-2">
                <Label className="text-base font-semibold text-foreground">Description <span className="text-destructive">*</span></Label>
                {requestType === 'post' ? (
                     <FormField control={form.control} name="description" render={({ field }) => (
                        <FormItem className="flex-grow flex flex-col">
                            <FormLabel className="sr-only">Description</FormLabel>
                             <Popover open={showDescriptionSuggestions && filteredSuggestions.length > 0 && !['loading-desc', 'no-users-desc', 'no-match-desc'].includes(filteredSuggestions[0]?.userId)} onOpenChange={(open) => { setShowDescriptionSuggestions(open); if (!open) setDescriptionMentionQuery('');}}>
                                <PopoverTrigger asChild>
                                    <FormControl>
                                        <Textarea placeholder="Provide more context or details... (@mention users)" className="flex-grow resize-y min-h-[200px] flex-1 border rounded-md p-3" {...field} ref={descriptionTextareaRef} value={field.value || ''} onChange={handleDescriptionChange} onFocus={handleDescriptionFocus} onBlurCapture={() => setTimeout(() => { if (descriptionSuggestionsPopoverRef.current && !descriptionSuggestionsPopoverRef.current.contains(document.activeElement as Node) && descriptionTextareaRef.current !== document.activeElement) { if (showDescriptionSuggestions) setShowDescriptionSuggestions(false);}}, 150)} disabled={isSubmitting}/>
                                    </FormControl>
                                </PopoverTrigger>
                                 <PopoverContent ref={descriptionSuggestionsPopoverRef} className="w-[--radix-popover-trigger-width] p-1 mt-1 max-h-48 overflow-y-auto" side="bottom" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                                    {filteredSuggestions.map(profile => {
                                        const displayableName = profile.actualDisplayName || profile.companyName || profile.mentionName;
                                        const showSecondaryName = (profile.actualDisplayName || profile.companyName) && (profile.actualDisplayName || profile.companyName)!.toLowerCase() !== profile.mentionName.toLowerCase();
                                        return (
                                            ['loading-desc', 'no-users-desc', 'no-match-desc'].includes(profile.userId) ? (
                                                <div key={profile.userId} className="p-2 text-center text-xs text-muted-foreground">{profile.displayName}</div>
                                            ) : (
                                                <Button key={profile.userId} variant="ghost" size="sm" className="w-full justify-start h-auto px-2 py-1 text-xs" onMouseDown={(e) => e.preventDefault()} onClick={() => handleSelectDescriptionSuggestion(profile)}>
                                                    <Avatar className="h-5 w-5 mr-2"><AvatarImage src={profile.avatarUrl} alt={profile.mentionName} /><AvatarFallback className="text-xs">{getInitials(profile.mentionName)}</AvatarFallback></Avatar>
                                                    <div className="flex flex-col items-start">
                                                        {showSecondaryName && (<span className="font-medium text-foreground">{displayableName}</span>)}
                                                        <span className={cn("text-muted-foreground", !showSecondaryName && "font-medium text-foreground")}>@{profile.mentionName}</span>
                                                    </div>
                                                </Button>
                                            )
                                        );
                                    })}
                                </PopoverContent>
                            </Popover>
                            <FormMessage className="text-xs" />
                        </FormItem>
                     )} />
                ) : (
                    <Tabs value={activeDescTab} onValueChange={setActiveDescTab} className="w-full flex-grow flex flex-col">
                        <TabsList className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground w-full">
                            <TabsTrigger value="details" className="tab-trigger flex-1">Problem Details <span className="text-destructive ml-0.5">*</span></TabsTrigger>
                            <TabsTrigger value="tried" className="tab-trigger flex-1">What I've Tried</TabsTrigger>
                            <TabsTrigger value="outcome" className="tab-trigger flex-1">Expected Outcome</TabsTrigger>
                        </TabsList>
                        <TabsContent value="details" className="tab-content flex-grow flex flex-col">
                            <FormField control={form.control} name="descriptionDetails" render={({ field }) => (
                              <FormItem className="flex-grow flex flex-col">
                                <FormLabel className="sr-only">Problem Details</FormLabel>
                                <Popover open={showProblemDetailsSuggestions && filteredSuggestions.length > 0 && !['loading-desc', 'no-users-desc', 'no-match-desc'].includes(filteredSuggestions[0]?.userId)} onOpenChange={(open) => { setShowProblemDetailsSuggestions(open); if (!open) setProblemDetailsMentionQuery('');}}>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                            <Textarea placeholder="Describe the specific problem or need... (@mention users)" className="flex-grow resize-y min-h-[120px] flex-1 border-0 p-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none" {...field} ref={problemDetailsTextareaRef} value={field.value || ''} onChange={handleProblemDetailsChange} onFocus={handleProblemDetailsFocus} onBlurCapture={() => setTimeout(() => { if (problemDetailsSuggestionsPopoverRef.current && !problemDetailsSuggestionsPopoverRef.current.contains(document.activeElement as Node) && problemDetailsTextareaRef.current !== document.activeElement) { if (showProblemDetailsSuggestions) setShowProblemDetailsSuggestions(false);}}, 150)} disabled={isSubmitting}/>
                                        </FormControl>
                                    </PopoverTrigger>
                                     <PopoverContent ref={problemDetailsSuggestionsPopoverRef} className="w-[--radix-popover-trigger-width] p-1 mt-1 max-h-48 overflow-y-auto" side="bottom" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                                        {filteredSuggestions.map(profile => {
                                            const displayableName = profile.actualDisplayName || profile.companyName || profile.mentionName;
                                            const showSecondaryName = (profile.actualDisplayName || profile.companyName) && (profile.actualDisplayName || profile.companyName)!.toLowerCase() !== profile.mentionName.toLowerCase();
                                            return (
                                                ['loading-desc', 'no-users-desc', 'no-match-desc'].includes(profile.userId) ? (
                                                    <div key={profile.userId} className="p-2 text-center text-xs text-muted-foreground">{profile.displayName}</div>
                                                ) : (
                                                    <Button key={profile.userId} variant="ghost" size="sm" className="w-full justify-start h-auto px-2 py-1 text-xs" onMouseDown={(e) => e.preventDefault()} onClick={() => handleSelectProblemDetailsSuggestion(profile)}>
                                                        <Avatar className="h-5 w-5 mr-2"><AvatarImage src={profile.avatarUrl} alt={profile.mentionName} /><AvatarFallback className="text-xs">{getInitials(profile.mentionName)}</AvatarFallback></Avatar>
                                                        <div className="flex flex-col items-start">
                                                            {showSecondaryName && (<span className="font-medium text-foreground">{displayableName}</span>)}
                                                            <span className={cn("text-muted-foreground", !showSecondaryName && "font-medium text-foreground")}>@{profile.mentionName}</span>
                                                        </div>
                                                    </Button>
                                                )
                                            );
                                        })}
                                    </PopoverContent>
                                </Popover>
                                <FormMessage className="text-xs" />
                              </FormItem>
                            )} />
                        </TabsContent>
                        <TabsContent value="tried" className="tab-content flex-grow flex flex-col"><FormField control={form.control} name="descriptionTried" render={({ field }) => (<FormItem className="flex-grow flex flex-col"><FormLabel className="sr-only">What I've Tried</FormLabel><FormControl><Textarea placeholder="Solutions or approaches you've already attempted (optional)..." className="flex-grow resize-y min-h-[120px] flex-1 border-0 p-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none" value={field.value || ''} onChange={field.onChange} disabled={isSubmitting} /></FormControl><FormMessage className="text-xs" /></FormItem>)} /></TabsContent>
                        <TabsContent value="outcome" className="tab-content flex-grow flex flex-col"><FormField control={form.control} name="descriptionOutcome" render={({ field }) => (<FormItem className="flex-grow flex flex-col"><FormLabel className="sr-only">Expected Outcome</FormLabel><FormControl><Textarea placeholder="Ideal result or solution you're looking for (optional)?" className="flex-grow resize-y min-h-[120px] flex-1 border-0 p-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none" value={field.value || ''} onChange={field.onChange} disabled={isSubmitting} /></FormControl><FormMessage className="text-xs" /></FormItem>)} /></TabsContent>
                    </Tabs>
                )}
            </div>

            <FormField control={form.control} name="image" render={() => (
              <FormItem>
                <FormLabel>Image (Optional)</FormLabel>
                <FormControl><Input type="file" accept="image/png, image/jpeg, image/gif, image/webp" ref={fileInputRef} onChange={handleImageChange} className="hidden" disabled={isSubmitting || isCompressing} /></FormControl>
                <div className="mt-2 flex items-center gap-4">
                  <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isSubmitting || isCompressing}> {isCompressing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4 w-4" />} {imagePreviewUrl ? "Change Image" : "Upload Image"} </Button>
                  {imagePreviewUrl && (<Button type="button" variant="ghost" size="sm" onClick={handleRemoveImage} disabled={isSubmitting || isCompressing}><XCircle className="mr-2 h-4 w-4 text-destructive" /> Remove</Button>)}
                </div>
                {imagePreviewUrl && (<div className="mt-4 border rounded-md p-2 relative aspect-video max-w-sm mx-auto"><Image src={imagePreviewUrl} alt="Preview" fill style={{objectFit:"contain"}} className="rounded-md" data-ai-hint="user upload"/></div>)}
                <FormDescription>Max 2MB. JPG, PNG, GIF, WebP accepted.</FormDescription>
                <FormMessage className="text-xs" />
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
                <FormDescription>Choose the primary sector for your post.</FormDescription>
                <FormMessage className="text-xs" />
              </FormItem>
            )} />
            <FormField control={form.control} name="subSector" render={({ field }) => (
              <FormItem>
                <FormLabel>Sub-sector (Optional)</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ""} disabled={isSubmitting || currentSubSectors.length === 0}>
                  <FormControl><SelectTrigger><SelectValue placeholder={currentSubSectors.length > 0 ? "Select a sub-sector" : "No sub-sectors available"} /></SelectTrigger></FormControl>
                  <SelectContent>{currentSubSectors.map(sub => (<SelectItem key={sub.code} value={sub.code}>{sub.name} ({sub.code})</SelectItem>))}</SelectContent>
                </Select>
                <FormDescription>Choose a specific sub-sector if applicable.</FormDescription>
                <FormMessage className="text-xs" />
              </FormItem>
            )} />
            <FormField control={form.control} name="industry" render={({ field }) => (
              <FormItem>
                <FormLabel>Industry (Optional)</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ""} disabled={isSubmitting || currentIndustries.length === 0}>
                  <FormControl><SelectTrigger><SelectValue placeholder={currentIndustries.length > 0 ? "Select an industry" : "No industries available"} /></SelectTrigger></FormControl>
                  <SelectContent>{currentIndustries.map(ind => (<SelectItem key={ind.code} value={ind.code}>{ind.name} ({ind.code})</SelectItem>))}</SelectContent>
                </Select>
                <FormDescription>Choose a specific industry if applicable.</FormDescription>
                <FormMessage className="text-xs" />
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
                        <FormControl>
                            <Checkbox checked={field.value?.includes(tag)} onCheckedChange={checked => checked ? field.onChange([...(field.value || []), tag]) : field.onChange((field.value || []).filter(v => v !== tag))} disabled={isSubmitting} />
                        </FormControl>
                        <FormLabel className="font-normal text-sm">{tag}</FormLabel>
                      </FormItem>
                    )} />
                  ))}
                </div>
                <FormMessage className="text-xs" />
              </FormItem>
            )} />

            {requestType === 'help_request' && (
              <>
                <FormField control={form.control} name="maxBudget" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1 text-base font-semibold text-foreground"><DollarSign className="h-4 w-4 text-green-600" />Maximum Budget (Optional)</FormLabel>
                    <FormControl><Input type="text" placeholder="e.g., 500 (USD)" {...field} value={field.value === undefined ? '' : String(field.value)} onChange={e => { const val = e.target.value; if (/^\d*\.?\d*$/.test(val) || val === "") field.onChange(val === '' ? undefined : val);}} disabled={isSubmitting} /></FormControl>
                    <FormMessage className="text-xs" />
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
                    <FormMessage className="text-xs" />
                  </FormItem>
                )} />
              </>
            )}
          </div>
        </div>

        <DialogFooter className="pt-8 md:col-span-2">
            {onDialogClose && (<DialogClose asChild><Button type="button" variant="outline" onClick={resetForm} disabled={isSubmitting || isCompressing || isLoadingSuggestibleUsers}>Cancel</Button></DialogClose>)}
            <Button type="submit" disabled={isSubmitting || isCompressing || (isLoadingSuggestibleUsers && (showDescriptionSuggestions || showProblemDetailsSuggestions))}>
                {(isSubmitting || isCompressing || (isLoadingSuggestibleUsers && (showDescriptionSuggestions || showProblemDetailsSuggestions)) ) ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {isCompressing ? "Processing..." : "Submitting..."}</>) : ('Submit Post')}
            </Button>
        </DialogFooter>
      </form>
       <AlertDialog open={showCompressionDialog} onOpenChange={setShowCompressionDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Image Too Large</AlertDialogTitle>
              <AlertDialogDescription>
                The selected image exceeds 2MB ({(originalTooLargeFile?.size ? originalTooLargeFile.size / (1024 * 1024) : 0).toFixed(2)}MB).
                Would you like to compress it to fit? Compression may slightly reduce quality.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => { setSelectedImageFile(null); setOriginalTooLargeFile(null); setImagePreviewUrl(null); if (fileInputRef.current) fileInputRef.current.value = ''; setShowCompressionDialog(false); }}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleCompressAndSetImage} className="bg-primary hover:bg-primary/90"><ImageDown className="mr-2 h-4 w-4" /> Compress Image</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </Form>
  );
};
