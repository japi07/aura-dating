import express, { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

interface CreateProposalBody {
  toUserId: string;
  message: string;
  dateType?: string;
  restaurantChoice?: string;
  alternativePlan?: string;
  preferredDate?: string;
  preferredTime?: string;
  paymentArrangement?: string;
}

interface RespondProposalBody {
  status: 'ACCEPTED' | 'DECLINED';
  counterDate?: string;
  counterTime?: string;
}

router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      } as ApiResponse);
    }

    const {
      toUserId,
      message,
      dateType,
      restaurantChoice,
      alternativePlan,
      preferredDate,
      preferredTime,
      paymentArrangement,
    } = req.body as CreateProposalBody;

    if (!toUserId || !message) {
      return res.status(400).json({
        success: false,
        error: 'toUserId and message are required',
      } as ApiResponse);
    }

    if (toUserId === req.user.id) {
      return res.status(400).json({
        success: false,
        error: 'Cannot send proposal to yourself',
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

    const existingProposal = await prisma.dateProposal.findUnique({
      where: {
        fromUserId_toUserId: {
          fromUserId: req.user.id,
          toUserId,
        },
      },
    });

    if (existingProposal) {
      return res.status(400).json({
        success: false,
        error: 'Proposal already exists with this user',
      } as ApiResponse);
    }

    const proposal = await prisma.dateProposal.create({
      data: {
        message,
        dateType: (dateType || undefined) as any,
        restaurantChoice: restaurantChoice || undefined,
        alternativePlan: alternativePlan || undefined,
        preferredDate: preferredDate || undefined,
        preferredTime: preferredTime || undefined,
        paymentArrangement: (paymentArrangement || undefined) as any,
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
      data: proposal,
    } as ApiResponse);
  } catch (error) {
    console.error('Create proposal error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create proposal',
    } as ApiResponse);
  }
});

router.get('/received', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      } as ApiResponse);
    }

    const proposals = await prisma.dateProposal.findMany({
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
      data: proposals,
    } as ApiResponse);
  } catch (error) {
    console.error('Get received proposals error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get received proposals',
    } as ApiResponse);
  }
});

router.get('/sent', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      } as ApiResponse);
    }

    const proposals = await prisma.dateProposal.findMany({
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
      data: proposals,
    } as ApiResponse);
  } catch (error) {
    console.error('Get sent proposals error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get sent proposals',
    } as ApiResponse);
  }
});

router.put('/:id/respond', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      } as ApiResponse);
    }

    const { id } = req.params;
    const { status, counterDate, counterTime } = req.body as RespondProposalBody;

    if (!status || !['ACCEPTED', 'DECLINED'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Valid status (ACCEPTED or DECLINED) is required',
      } as ApiResponse);
    }

    const proposal = await prisma.dateProposal.findUnique({
      where: { id },
    });

    if (!proposal) {
      return res.status(404).json({
        success: false,
        error: 'Proposal not found',
      } as ApiResponse);
    }

    if (proposal.toUserId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'You can only respond to proposals sent to you',
      } as ApiResponse);
    }

    const updateData: any = { status };

    if (status === 'ACCEPTED' && counterDate && counterTime) {
      updateData.counterDate = counterDate;
      updateData.counterTime = counterTime;
    }

    const updatedProposal = await prisma.dateProposal.update({
      where: { id },
      data: updateData,
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

    return res.status(200).json({
      success: true,
      data: updatedProposal,
    } as ApiResponse);
  } catch (error) {
    console.error('Respond to proposal error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to respond to proposal',
    } as ApiResponse);
  }
});

export default router;
