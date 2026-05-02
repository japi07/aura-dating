export const API_URL = 'http://localhost:3001/api';

export const API_ENDPOINTS = {
  // Auth
  LOGIN: '/auth/login',
  REGISTER: '/auth/register',
  REFRESH: '/auth/refresh',

  // Profile
  GET_PROFILE: '/profile',
  UPDATE_PROFILE: '/profile/update',
  UPLOAD_PHOTO: '/profile/upload-photo',

  // Members
  GET_MEMBERS: '/members',
  GET_MEMBER: '/members/:userId',

  // Social
  SEND_INTEREST: '/social/send-interest',
  GET_INTERESTS: '/social/interests',
  RESPOND_TO_INTEREST: '/social/respond-interest',

  // Proposals
  CREATE_PROPOSAL: '/proposals/create',
  GET_PROPOSALS: '/proposals',
  RESPOND_TO_PROPOSAL: '/proposals/respond',

  // Events
  GET_EVENTS: '/events',
  GET_EVENT: '/events/:eventId',
  CREATE_EVENT: '/events/create',
  APPLY_TO_EVENT: '/events/:eventId/apply',
} as const;
