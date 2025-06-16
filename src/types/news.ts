
// src/types/news.ts
import type { Timestamp, FieldValue } from 'firebase/firestore';

export type NewsArticleStatus = 'draft' | 'published';

export interface NewsArticle {
  id: string;
  userId: string; 
  title: string;
  category: string;
  content: string; 
  coverImageUrl?: string | null;
  status: NewsArticleStatus;
  createdAt: Timestamp | FieldValue; 
  updatedAt: Timestamp | FieldValue; 
  publishedAt?: Timestamp | FieldValue | null;

  // Fields from Post type (now part of NewsArticle)
  commentCount?: number;
  descriptionDetails?: string | null; // Was required in Post, now optional for News
  descriptionOutcome?: string | null;
  descriptionTried?: string | null;
  imageUrls?: string[];
  maxBudget?: number | null;
  deadline?: Timestamp | FieldValue | null; // Allow FieldValue for serverTimestamp
  mentionedUserIds?: string[];
  naicsCode?: string | null;
  question?: string | null; // Was required in Post, now optional general title for News
  ratingScore?: number;
  requestType?: string | null; // 'post' or 'help_request' or null if not applicable
  sector?: string | null;
  subSector?: string | null;
  industry?: string | null;
  tags?: string[] | null;
}

export type NewNewsArticleData = Omit<NewsArticle, 'id' | 'createdAt' | 'updatedAt' | 'publishedAt'> & {
  createdAt?: FieldValue;
  updatedAt?: FieldValue;
  publishedAt?: FieldValue | null;
  // Ensure all optional Post fields are optional here too, defaults handled in service
  commentCount?: number;
  descriptionDetails?: string | null;
  descriptionOutcome?: string | null;
  descriptionTried?: string | null;
  imageUrls?: string[];
  maxBudget?: number | null;
  deadline?: Date | FieldValue | null; // Form might send Date, service converts to Timestamp or FieldValue
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
  // Include optional Post fields that might be updated if the UI supports it for News
  'tags' | 'sector' | 'subSector' | 'industry' | 'naicsCode' | 'requestType' | 'question' |
  'descriptionDetails' | 'descriptionTried' | 'descriptionOutcome' | 'maxBudget' | 'deadline' |
  'imageUrls' | 'mentionedUserIds'
>> & {
  updatedAt?: FieldValue; // Should always be serverTimestamp on update
  publishedAt?: FieldValue | Timestamp | null; // Allow explicit update or nullification
};


export interface ClientNewsArticle extends Omit<NewsArticle, 'createdAt' | 'updatedAt' | 'publishedAt' | 'deadline'> {
  createdAt: number; // Milliseconds
  updatedAt: number; // Milliseconds
  publishedAt?: number | null; // Milliseconds
  deadline?: number | null; // Milliseconds
}
