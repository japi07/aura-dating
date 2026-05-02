import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    gender: string | null;
    city: string;
    profileComplete: boolean;
  };
}

export interface RegisterResponse {
  token: string;
  user: {
    id: string;
    email: string;
  };
}

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  gender: string | null;
  genderInterest: string | null;
  city: string;
  lookingFor: string | null;
  dateTypes: string[];
  eventInterests: string[];
  bio: string | null;
  height: number | null;
  occupation: string | null;
  interests: string[];
  drinking: string | null;
  smoking: string | null;
  languages: string[];
  instagram: string | null;
  birthday: Date | null;
  profileComplete: boolean;
  photos: Array<{
    id: string;
    url: string;
    isMain: boolean;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemberListItem {
  id: string;
  name: string | null;
  gender: string | null;
  city: string;
  age?: number;
  height: number | null;
  occupation: string | null;
  bio: string | null;
  mainPhoto?: {
    id: string;
    url: string;
  };
  profileComplete: boolean;
}

export interface MemberDetail extends UserProfile {
  photos: Array<{
    id: string;
    url: string;
    isMain: boolean;
  }>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
