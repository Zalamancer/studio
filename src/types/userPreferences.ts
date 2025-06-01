
// src/types/userPreferences.ts
import type { Timestamp } from 'firebase/firestore';

export interface SavedPaymentMethod {
  stripePaymentMethodId: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault?: boolean;
}

export interface UserPreference {
  userId: string;
  favoriteSectorCodes?: string[];
  notifyOnReply?: boolean;
  notifyOnMention?: boolean;
  notifyOnNewConnectionRequest?: boolean;
  notifyOnConnectionAccepted?: boolean;
  notifyOnNewMessage?: boolean;
  notifyOnPlatformUpdates?: boolean;

  // Stripe Subscription Fields
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  activeStripePriceId?: string | null;
  stripeSubscriptionStatus?: string | null; // e.g., 'active', 'trialing', 'past_due', 'canceled', 'incomplete'
  stripeSubscriptionCurrentPeriodEnd?: number | null; // Unix timestamp (seconds)
  stripeSubscriptionWillCancelAtPeriodEnd?: boolean | null; // Custom flag to indicate user requested cancellation

  paymentMethods?: SavedPaymentMethod[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type UpdateUserPreferencesData = Omit<Partial<UserPreference>, 'userId' | 'createdAt'> & {
  updatedAt?: Timestamp;
};
    