import express, { Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest, ApiResponse, UserProfile } from '../types';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

interface UpdateProfileBody {
  name?: string;
  gender?: string;
  genderInterest?: string;
  city?: string;
  bio?: string;
  height?: number;
  occupation?: string;
  interests?: string[];
  lookingFor?: string;
  drinking?: string;
  smoking?: string;
  languages?: string[];
  instagram?: string;
  birthday?: string;
  dateTypes?: string[];
  eventInterests?: string[];
}

router.get('/:userId', async (req: express.Request, res: Response) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        photos: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      } as ApiResponse);
    }

    return res.status(200).json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        gender: user.gender,
        genderInterest: user.genderInterest,
        city: user.city,
        lookingFor: user.lookingFor,
        dateTypes: user.dateTypes,
        eventInterests: user.eventInterests,
        bio: user.bio,
        height: user.height,
        occupation: user.occupation,
        interests: user.interests,
        drinking: user.drinking,
        smoking: user.smoking,
        languages: user.languages,
        instagram: user.instagram,
        birthday: user.birthday,
        profileComplete: user.profileComplete,
        photos: user.photos,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    } as ApiResponse<UserProfile>);
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get profile',
    } as ApiResponse);
  }
});

router.put('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      } as ApiResponse);
    }

    const {
      name,
      gender,
      genderInterest,
      city,
      bio,
      height,
      occupation,
      interests,
      lookingFor,
      drinking,
      smoking,
      languages,
      instagram,
      birthday,
      dateTypes,
      eventInterests,
    } = req.body as UpdateProfileBody;

    const updateData: any = {};

    if (name !== undefined) updateData.name = name;
    if (gender !== undefined) updateData.gender = gender;
    if (genderInterest !== undefined) updateData.genderInterest = genderInterest;
    if (city !== undefined) updateData.city = city;
    if (bio !== undefined) updateData.bio = bio;
    if (height !== undefined) updateData.height = height;
    if (occupation !== undefined) updateData.occupation = occupation;
    if (interests !== undefined) updateData.interests = interests;
    if (lookingFor !== undefined) updateData.lookingFor = lookingFor;
    if (drinking !== undefined) updateData.drinking = drinking;
    if (smoking !== undefined) updateData.smoking = smoking;
    if (languages !== undefined) updateData.languages = languages;
    if (instagram !== undefined) updateData.instagram = instagram;
    if (birthday !== undefined) updateData.birthday = birthday ? new Date(birthday) : null;
    if (dateTypes !== undefined) updateData.dateTypes = dateTypes;
    if (eventInterests !== undefined) updateData.eventInterests = eventInterests;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      include: {
        photos: true,
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        gender: user.gender,
        genderInterest: user.genderInterest,
        city: user.city,
        lookingFor: user.lookingFor,
        dateTypes: user.dateTypes,
        eventInterests: user.eventInterests,
        bio: user.bio,
        height: user.height,
        occupation: user.occupation,
        interests: user.interests,
        drinking: user.drinking,
        smoking: user.smoking,
        languages: user.languages,
        instagram: user.instagram,
        birthday: user.birthday,
        profileComplete: user.profileComplete,
        photos: user.photos,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    } as ApiResponse<UserProfile>);
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update profile',
    } as ApiResponse);
  }
});

router.post('/photo', authMiddleware, upload.single('photo'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      } as ApiResponse);
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file provided',
      } as ApiResponse);
    }

    const photoUrl = `/uploads/${req.file.filename}`;
    const existingPhotos = await prisma.photo.findMany({
      where: { userId: req.user.id },
    });

    const isMain = existingPhotos.length === 0;

    const photo = await prisma.photo.create({
      data: {
        url: photoUrl,
        isMain,
        userId: req.user.id,
      },
    });

    return res.status(201).json({
      success: true,
      data: photo,
    } as ApiResponse);
  } catch (error) {
    console.error('Upload photo error:', error);

    if (req.file) {
      fs.unlink(path.join(uploadDir, req.file.filename), (err) => {
        if (err) console.error('Failed to delete uploaded file:', err);
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to upload photo',
    } as ApiResponse);
  }
});

router.put('/complete', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      } as ApiResponse);
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        profileComplete: true,
      },
      include: {
        photos: true,
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        gender: user.gender,
        genderInterest: user.genderInterest,
        city: user.city,
        lookingFor: user.lookingFor,
        dateTypes: user.dateTypes,
        eventInterests: user.eventInterests,
        bio: user.bio,
        height: user.height,
        occupation: user.occupation,
        interests: user.interests,
        drinking: user.drinking,
        smoking: user.smoking,
        languages: user.languages,
        instagram: user.instagram,
        birthday: user.birthday,
        profileComplete: user.profileComplete,
        photos: user.photos,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    } as ApiResponse<UserProfile>);
  } catch (error) {
    console.error('Complete profile error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to mark profile as complete',
    } as ApiResponse);
  }
});

export default router;
