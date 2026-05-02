import express, { Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiResponse, MemberListItem, MemberDetail, PaginatedResponse } from '../types';

const router = express.Router();

interface MembersQuery {
  page?: string;
  pageSize?: string;
  gender?: string;
  city?: string;
  genderInterest?: string;
}

router.get('/', async (req: express.Request, res: Response) => {
  try {
    const {
      page = '1',
      pageSize = '20',
      gender,
      city,
      genderInterest,
    } = req.query as MembersQuery;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSizeNum = Math.max(1, Math.min(100, parseInt(pageSize) || 20));

    const where: any = {
      profileComplete: true,
    };

    if (gender) {
      where.gender = gender.toUpperCase();
    }
    if (city) {
      where.city = {
        contains: city,
        mode: 'insensitive',
      };
    }
    if (genderInterest) {
      where.genderInterest = genderInterest.toUpperCase();
    }

    const total = await prisma.user.count({ where });
    const totalPages = Math.ceil(total / pageSizeNum);

    const users = await prisma.user.findMany({
      where,
      skip: (pageNum - 1) * pageSizeNum,
      take: pageSizeNum,
      include: {
        photos: {
          where: { isMain: true },
          take: 1,
        },
      },
    });

    const members: MemberListItem[] = users.map((user) => {
      const age = user.birthday
        ? Math.floor((new Date().getTime() - new Date(user.birthday).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
        : undefined;

      return {
        id: user.id,
        name: user.name,
        gender: user.gender,
        city: user.city,
        age,
        height: user.height,
        occupation: user.occupation,
        bio: user.bio,
        mainPhoto: user.photos.length > 0 ? user.photos[0] : undefined,
        profileComplete: user.profileComplete,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        data: members,
        total,
        page: pageNum,
        pageSize: pageSizeNum,
        totalPages,
      },
    } as ApiResponse<PaginatedResponse<MemberListItem>>);
  } catch (error) {
    console.error('List members error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to list members',
    } as ApiResponse);
  }
});

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
        error: 'Member not found',
      } as ApiResponse);
    }

    if (!user.profileComplete) {
      return res.status(404).json({
        success: false,
        error: 'Member profile is not complete',
      } as ApiResponse);
    }

    const memberDetail: MemberDetail = {
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
    };

    return res.status(200).json({
      success: true,
      data: memberDetail,
    } as ApiResponse<MemberDetail>);
  } catch (error) {
    console.error('Get member detail error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get member details',
    } as ApiResponse);
  }
});

export default router;
