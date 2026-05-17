import axios, { AxiosInstance } from 'axios';
import { API_URL, API_ENDPOINTS } from '@/constants/api';
import { useAuthStore } from '@/store/auth';

let apiClient: AxiosInstance | null = null;

export const getApiClient = (): AxiosInstance => {
  if (!apiClient) {
    apiClient = axios.create({
      baseURL: API_URL,
      timeout: 10000,
    });

    apiClient.interceptors.request.use(
      async (config) => {
        const token = useAuthStore.getState().token;
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    apiClient.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          useAuthStore.getState().logout();
        }
        return Promise.reject(error);
      }
    );
  }

  return apiClient;
};

export const resetApiClient = () => {
  apiClient = null;
};

// Auth API
export const authApi = {
  login: async (email: string, password: string) => {
    const client = getApiClient();
    const response = await client.post(API_ENDPOINTS.LOGIN, { email, password });
    return response.data;
  },

  register: async (data: {
    name: string;
    email: string;
    password: string;
    birthday: string;
    gender: string;
    genderInterest: string;
    city: string;
    bio?: string;
    interests?: string[];
  }) => {
    const client = getApiClient();
    const response = await client.post(API_ENDPOINTS.REGISTER, data);
    return response.data;
  },
};

// Profile API
export const profileApi = {
  getProfile: async () => {
    const client = getApiClient();
    const response = await client.get(API_ENDPOINTS.GET_PROFILE);
    return response.data;
  },

  updateProfile: async (data: Partial<{
    name: string;
    bio: string;
    birthday: string;
    gender: string;
    genderInterest: string;
    city: string;
    interests: string[];
    drinking?: string;
    smoking?: string;
    languages?: string[];
    instagram?: string;
  }>) => {
    const client = getApiClient();
    const response = await client.post(API_ENDPOINTS.UPDATE_PROFILE, data);
    return response.data;
  },

  uploadPhoto: async (formData: FormData) => {
    const client = getApiClient();
    const response = await client.post(API_ENDPOINTS.UPLOAD_PHOTO, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};

// Members API
export const membersApi = {
  getMembers: async (filters?: {
    ageMin?: number;
    ageMax?: number;
    city?: string;
    limit?: number;
    offset?: number;
  }) => {
    const client = getApiClient();
    const response = await client.get(API_ENDPOINTS.GET_MEMBERS, { params: filters });
    return response.data;
  },

  getMember: async (userId: string) => {
    const client = getApiClient();
    const endpoint = API_ENDPOINTS.GET_MEMBER.replace(':userId', userId);
    const response = await client.get(endpoint);
    return response.data;
  },
};

// Social API
export const socialApi = {
  sendInterest: async (recipientId: string, message?: string) => {
    const client = getApiClient();
    const response = await client.post(API_ENDPOINTS.SEND_INTEREST, {
      recipientId,
      message,
    });
    return response.data;
  },

  getInterests: async () => {
    const client = getApiClient();
    const response = await client.get(API_ENDPOINTS.GET_INTERESTS);
    return response.data;
  },

  respondToInterest: async (interestId: string, action: 'accept' | 'decline') => {
    const client = getApiClient();
    const response = await client.post(API_ENDPOINTS.RESPOND_TO_INTEREST, {
      interestId,
      action,
    });
    return response.data;
  },
};

// Proposals API
export const proposalsApi = {
  createProposal: async (data: {
    recipientId: string;
    message: string;
    dateType: string;
    preferredDate: string;
    preferredTime: string;
    restaurantChoice?: string;
    alternativePlan?: string;
    paymentArrangement: string;
  }) => {
    const client = getApiClient();
    const response = await client.post(API_ENDPOINTS.CREATE_PROPOSAL, data);
    return response.data;
  },

  getProposals: async () => {
    const client = getApiClient();
    const response = await client.get(API_ENDPOINTS.GET_PROPOSALS);
    return response.data;
  },

  respondToProposal: async (proposalId: string, action: 'accept' | 'decline') => {
    const client = getApiClient();
    const response = await client.post(API_ENDPOINTS.RESPOND_TO_PROPOSAL, {
      proposalId,
      action,
    });
    return response.data;
  },
};

// Events API
export const eventsApi = {
  getEvents: async (filters?: {
    type?: string;
    city?: string;
    limit?: number;
    offset?: number;
  }) => {
    const client = getApiClient();
    const response = await client.get(API_ENDPOINTS.GET_EVENTS, { params: filters });
    return response.data;
  },

  getEvent: async (eventId: string) => {
    const client = getApiClient();
    const endpoint = API_ENDPOINTS.GET_EVENT.replace(':eventId', eventId);
    const response = await client.get(endpoint);
    return response.data;
  },

  createEvent: async (data: {
    title: string;
    description: string;
    location: string;
    date: string;
    time: string;
    eventType: string;
    maxSpots: number;
  }) => {
    const client = getApiClient();
    const response = await client.post(API_ENDPOINTS.CREATE_EVENT, data);
    return response.data;
  },

  applyToEvent: async (eventId: string) => {
    const client = getApiClient();
    const endpoint = API_ENDPOINTS.APPLY_TO_EVENT.replace(':eventId', eventId);
    const response = await client.post(endpoint);
    return response.data;
  },
};

// ─── Verification API ────────────────────────────────────────────────
//
// Real human-verification flow: the user uploads a selfie + a short
// liveness video. The backend pipes both to a vendor (Persona, Onfido,
// AWS Rekognition, etc.) for face-match + spoof detection. The endpoint
// returns either `verified`, `rejected`, or `pending` (manual review).
//
// If the backend is unreachable, the calling code falls back to
// "pending review" mode so the user isn't blocked.
// ─────────────────────────────────────────────────────────────────────

export type VerificationStatus = 'unverified' | 'submitting' | 'pending' | 'verified' | 'rejected';

export interface VerificationSubmitResult {
  status: 'verified' | 'pending' | 'rejected';
  verificationId: string;
  /** Reviewed at, or null if pending */
  reviewedAt?: string;
  /** Reason if rejected */
  reason?: string;
  /** Estimated review time when status is pending */
  estimatedReviewMinutes?: number;
}

export const verificationApi = {
  /**
   * Upload selfie + liveness video for human verification.
   * Backend runs face-match + liveness detection and returns a verdict.
   * Includes upload progress so the UI can show it.
   */
  submit: async (
    args: {
      photoUri: string;
      videoUri: string;
      videoDurationSec?: number;
    },
    onProgress?: (pct: number) => void,
  ): Promise<VerificationSubmitResult> => {
    const client = getApiClient();
    const formData = new FormData();
    formData.append('photo', {
      uri: args.photoUri,
      name: 'selfie.jpg',
      type: 'image/jpeg',
    } as any);
    formData.append('video', {
      uri: args.videoUri,
      name: 'liveness.mp4',
      type: 'video/mp4',
    } as any);
    if (args.videoDurationSec) {
      formData.append('videoDurationSec', String(args.videoDurationSec));
    }

    const response = await client.post('/verification/submit', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      // Larger timeout because uploads can be slow on mobile networks
      timeout: 60000,
      onUploadProgress: (e) => {
        if (e.total && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
      },
    });
    return response.data;
  },

  /**
   * Poll current verification status. Used while the user is in 'pending'
   * state (after a successful submit but before manual review completes).
   */
  status: async (): Promise<{ status: VerificationStatus; reason?: string }> => {
    const client = getApiClient();
    const response = await client.get('/verification/status');
    return response.data;
  },
};
