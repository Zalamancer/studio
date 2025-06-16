// src/types/news.ts
import type { Timestamp, FieldValue } from 'firebase/firestore';

export type NewsArticleStatus = 'draft' | 'published';

export interface NewsArticle {
  id: string;
  userId: string;
  title: string;
  category: string;
  content: string; // Live content if status is 'published'
  draftContent?: string | null; // Work-in-progress content if status is 'published' and hasUnpublishedChanges is true
  hasUnpublishedChanges?: boolean; // Flag to indicate if draftContent differs from live content
  coverImageUrl?: string | null;
  status: NewsArticleStatus;
  createdAt: Timestamp | FieldValue;
  updatedAt: Timestamp | FieldValue;
  publishedAt?: Timestamp | FieldValue | null;

  // Fields from Post type (now part of NewsArticle)
  commentCount?: number;
  descriptionDetails?: string | null;
  descriptionOutcome?: string | null;
  descriptionTried?: string | null;
  imageUrls?: string[];
  maxBudget?: number | null;
  deadline?: Timestamp | FieldValue | null;
  mentionedUserIds?: string[];
  naicsCode?: string | null;
  question?: string | null;
  ratingScore?: number;
  requestType?: string | null;
  sector?: string | null;
  subSector?: string | null;
  industry?: string | null;
  tags?: string[] | null;
}

export type NewNewsArticleData = Omit<NewsArticle, 'id' | 'createdAt' | 'updatedAt' | 'publishedAt' | 'draftContent' | 'hasUnpublishedChanges'> & {
  createdAt?: FieldValue;
  updatedAt?: FieldValue;
  publishedAt?: FieldValue | null;
  draftContent?: string | null; // Initialize as null
  hasUnpublishedChanges?: boolean; // Initialize as false
  commentCount?: number;
  descriptionDetails?: string | null;
  descriptionOutcome?: string | null;
  descriptionTried?: string | null;
  imageUrls?: string[];
  maxBudget?: number | null;
  deadline?: Date | FieldValue | null;
  mentionedUserIds?: string[];
  naicsCode?: string | null;
  question?: string | null;
  ratingScore?: number;
  requestType?: string | null;
  sector?: string | null;
  subSector?: string | null;
  industry?: string | null;
  tags?: string[] | null;
};

// For updates, only certain fields should be updatable, plus updatedAt and potentially publishedAt
export type UpdateNewsArticleData = Partial<Pick<NewsArticle,
  'title' | 'category' | 'content' | 'status' | 'coverImageUrl' |
  'draftContent' | 'hasUnpublishedChanges' | // Added new fields
  'tags' | 'sector' | 'subSector' | 'industry' | 'naicsCode' | 'requestType' | 'question' |
  'descriptionDetails' | 'descriptionTried' | 'descriptionOutcome' | 'maxBudget' | 'deadline' |
  'imageUrls' | 'mentionedUserIds'
>> & {
  updatedAt?: FieldValue;
  publishedAt?: FieldValue | Timestamp | null;
};


export interface ClientNewsArticle extends Omit<NewsArticle, 'createdAt' | 'updatedAt' | 'publishedAt' | 'deadline' | 'draftContent' | 'hasUnpublishedChanges'> {
  createdAt: number; // Milliseconds
  updatedAt: number; // Milliseconds
  publishedAt?: number | null; // Milliseconds
  deadline?: number | null; // Milliseconds
  draftContent?: string | null; // Add to client type
  hasUnpublishedChanges?: boolean; // Add to client type
}
