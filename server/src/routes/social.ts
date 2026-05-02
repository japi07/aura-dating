import express, { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

interface SendInterestBody {
  toUserId: string;
}

interface RespondInterestBody {
  accept: boolean;
}

router.post('/interests', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      } as ApiResponse);
    }

    const { toUserId } = req.body as SendInterestBody;

    if (!toUserId) {
      return res.status(400).json({
        success: false,
        error: 'toUserId is required',
      } as ApiResponse);
    }

    if (toUserId === req.user.id) {
      return res.status(400).json({
        success: false,
        error: 'Cannot send interest to yourself',
      } as ApiResponse);
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: toUserId },
    });

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: 'Target user not found',
      } as ApiResponse);
    }

    const existingInterest = await prisma.interest.findUnique({
      where: {
        fromUserId_toUserId: {
          fromUserId: req.user.id,
          toUserId,
        },
      },
    });

    if (existingInterest) {
      return res.status(400).json({
        success: false,
        error: 'Interest already sent to this user',
      } as ApiResponse);
    }

    const interest = await prisma.interest.create({
      data: {
        fromUserId: req.user.id,
        toUserId,
      },
      include: {
        from: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        to: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return res.status(201).json({
      success: true,
      data: interest,
    } as ApiResponse);
  } catch (error) {
    console.error('Send interest error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to send interest',
    } as ApiResponse);
  }
});

router.get('/interests/received', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      } as ApiResponse);
    }

    const interests = await prisma.interest.findMany({
      where: { toUserId: req.user.id },
      include: {
        from: {
          select: {
            id: true,
            name: true,
            email: true,
            gender: true,
            city: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      data: interests,
    } as ApiResponse);
  } catch (error) {
    console.error('Get received interests error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get received interests',
    } as ApiResponse);
  }
});

router.get('/interests/sent', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      } as ApiResponse);
    }

    const interests = await prisma.interest.findMany({
      where: { fromUserId: req.user.id },
      include: {
        to: {
          select: {
            id: true,
            name: true,
            email: true,
            gender: true,
            city: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      data: interests,
    } as ApiResponse);
  } catch (error) {
    console.error('Get sent interests error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get sent interests',
    } as ApiResponse);
  }
});

router.put('/interests/:id/respond', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      } as ApiResponse);
    }

    const { id } = req.params;
    const { accept } = req.body as RespondInterestBody;

    const interest = await prisma.interest.findUnique({
      where: { id },
    });

    if (!interest) {
      return res.status(404).json({
        success: false,
        error: 'Interest not found',
      } as ApiResponse);
    }

    if (interest.toUserId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'You can only respond to interests sent to you',
      } as ApiResponse);
    }

    if (!accept) {
      await prisma.interest.delete({
        where: { id },
      });

      return res.status(200).json({
        success: true,
        data: { message: 'Interest declined' },
      } as ApiResponse);
    }

    // Accept interest - check if there's a mutual interest
    const mutualInterest = await prisma.interest.findUnique({
      where: {
        fromUserId_toUserId: {
          fromUserId: interest.toUserId,
          toUserId: interest.fromUserId,
        },
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        interest,
        mutualInterest: !!mutualInterest,
      },
    } as ApiResponse);
  } catch (error) {
    console.error('Respond to interest error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to respond to interest',
    } as ApiResponse);
  }
});

export default router;
