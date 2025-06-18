
// src/types/news.ts
import type { Timestamp, FieldValue } from 'firebase/firestore';

export type NewsArticleStatus = 'draft' | 'published';

export interface NewsArticle {
  id: string;
  userId: string;
  title: string;
  tags?: string[] | null;
  content: string;
  draftContent?: string | null;
  hasUnpublishedChanges?: boolean;
  coverImageUrl?: string | null;
  status: NewsArticleStatus;
  createdAt: Timestamp | FieldValue;
  updatedAt: Timestamp | FieldValue;
  publishedAt?: Timestamp | FieldValue | null;

  likeCount?: number;
  likedBy?: string[];

  // Fields from Post type (now part of NewsArticle)
  commentCount?: number; // This will count comments in newsArticles/{id}/newsComments
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
}

export type NewNewsArticleData = Omit<NewsArticle, 'id' | 'createdAt' | 'updatedAt' | 'publishedAt' | 'draftContent' | 'hasUnpublishedChanges' | 'likeCount' | 'likedBy'> & {
  createdAt?: FieldValue;
  updatedAt?: FieldValue;
  publishedAt?: FieldValue | null;
  draftContent?: string | null;
  hasUnpublishedChanges?: boolean;
  likeCount?: number; // Initialize to 0
  likedBy?: string[]; // Initialize to []
  commentCount?: number; // Initialize to 0
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

export type UpdateNewsArticleData = Partial<Pick<NewsArticle,
  'title' | 'content' | 'status' | 'coverImageUrl' |
  'draftContent' | 'hasUnpublishedChanges' |
  'tags' | 'sector' | 'subSector' | 'industry' | 'naicsCode' | 'requestType' | 'question' |
  'descriptionDetails' | 'descriptionTried' | 'descriptionOutcome' | 'maxBudget' | 'deadline' |
  'imageUrls' | 'mentionedUserIds' | 'likeCount' | 'likedBy' // Added likeCount and likedBy
>> & {
  updatedAt?: FieldValue;
  publishedAt?: FieldValue | Timestamp | null;
};


export interface ClientNewsArticle extends Omit<NewsArticle, 'createdAt' | 'updatedAt' | 'publishedAt' | 'deadline' | 'draftContent' | 'hasUnpublishedChanges'> {
  createdAt: number; // Milliseconds
  updatedAt: number; // Milliseconds
  publishedAt?: number | null; // Milliseconds
  deadline?: number | null; // Milliseconds
  draftContent?: string | null;
  hasUnpublishedChanges?: boolean;
  tags?: string[] | null;
  likeCount?: number;
  likedBy?: string[];
}
