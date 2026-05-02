import express, { Response } from 'express';
import bcryptjs from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest, ApiResponse, LoginResponse, RegisterResponse } from '../types';
import { generateToken, authMiddleware } from '../middleware/auth';

const router = express.Router();

interface RegisterBody {
  email: string;
  password: string;
  city?: string;
}

interface LoginBody {
  email: string;
  password: string;
}

router.post('/register', async (req: express.Request, res: Response) => {
  try {
    const { email, password, city } = req.body as RegisterBody;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
      } as ApiResponse);
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User with this email already exists',
      } as ApiResponse);
    }

    const hashedPassword = await bcryptjs.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        city: city || '',
      },
    });

    const token = generateToken(user.id, user.email);

    return res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
        },
      },
    } as ApiResponse<RegisterResponse>);
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to register user',
    } as ApiResponse);
  }
});

router.post('/login', async (req: express.Request, res: Response) => {
  try {
    const { email, password } = req.body as LoginBody;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
      } as ApiResponse);
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      } as ApiResponse);
    }

    const passwordMatch = await bcryptjs.compare(password, user.passwordHash);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      } as ApiResponse);
    }

    const token = generateToken(user.id, user.email);

    return res.status(200).json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          gender: user.gender,
          city: user.city,
          profileComplete: user.profileComplete,
        },
      },
    } as ApiResponse<LoginResponse>);
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to login',
    } as ApiResponse);
  }
});

router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      } as ApiResponse);
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
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
    } as ApiResponse);
  } catch (error) {
    console.error('Get me error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get user profile',
    } as ApiResponse);
  }
});

export default router;
