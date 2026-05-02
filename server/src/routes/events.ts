import express, { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest, ApiResponse, PaginatedResponse } from '../types';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

interface CreateEventBody {
  title: string;
  description: string;
  location: string;
  eventDate: string;
  eventTime: string;
  spots: number;
  eventType: string;
}

interface EventsQuery {
  page?: string;
  pageSize?: string;
  eventType?: string;
  location?: string;
}

interface ApplyEventBody {
  message?: string;
}

interface RespondApplicationBody {
  status: 'APPROVED' | 'REJECTED';
}

router.get('/', async (req: express.Request, res: Response) => {
  try {
    const {
      page = '1',
      pageSize = '20',
      eventType,
      location,
    } = req.query as EventsQuery;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSizeNum = Math.max(1, Math.min(100, parseInt(pageSize) || 20));

    const where: any = {};

    if (eventType) {
      where.eventType = eventType.toUpperCase();
    }
    if (location) {
      where.location = {
        contains: location,
        mode: 'insensitive',
      };
    }

    const total = await prisma.event.count({ where });
    const totalPages = Math.ceil(total / pageSizeNum);

    const events = await prisma.event.findMany({
      where,
      skip: (pageNum - 1) * pageSizeNum,
      take: pageSizeNum,
      include: {
        organizer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        applications: {
          select: {
            id: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const eventData = events.map((event) => ({
      ...event,
      applicationCount: event.applications.length,
      applications: undefined,
    }));

    return res.status(200).json({
      success: true,
      data: {
        data: eventData,
        total,
        page: pageNum,
        pageSize: pageSizeNum,
        totalPages,
      },
    } as ApiResponse<PaginatedResponse<any>>);
  } catch (error) {
    console.error('List events error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to list events',
    } as ApiResponse);
  }
});

router.get('/:id', async (req: express.Request, res: Response) => {
  try {
    const { id } = req.params;

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        organizer: {
          select: {
            id: true,
            name: true,
            email: true,
            bio: true,
            gender: true,
            city: true,
          },
        },
        applications: {
          include: {
            applicant: {
              select: {
                id: true,
                name: true,
                email: true,
                gender: true,
                city: true,
              },
            },
          },
        },
      },
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Event not found',
      } as ApiResponse);
    }

    return res.status(200).json({
      success: true,
      data: event,
    } as ApiResponse);
  } catch (error) {
    console.error('Get event error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get event',
    } as ApiResponse);
  }
});

router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      } as ApiResponse);
    }

    const { title, description, location, eventDate, eventTime, spots, eventType } = req.body as CreateEventBody;

    if (!title || !description || !location || !eventDate || !eventTime || !spots || !eventType) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required',
      } as ApiResponse);
    }

    if (spots < 1) {
      return res.status(400).json({
        success: false,
        error: 'Spots must be at least 1',
      } as ApiResponse);
    }

    const event = await prisma.event.create({
      data: {
        title,
        description,
        location,
        eventDate,
        eventTime,
        spots,
        eventType: eventType.toUpperCase() as any,
        organizerId: req.user.id,
      },
      include: {
        organizer: {
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
      data: event,
    } as ApiResponse);
  } catch (error) {
    console.error('Create event error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create event',
    } as ApiResponse);
  }
});

router.post('/:id/apply', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      } as ApiResponse);
    }

    const { id } = req.params;
    const { message } = req.body as ApplyEventBody;

    const event = await prisma.event.findUnique({
      where: { id },
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Event not found',
      } as ApiResponse);
    }

    const existingApplication = await prisma.eventApplication.findUnique({
      where: {
        eventId_applicantId: {
          eventId: id,
          applicantId: req.user.id,
        },
      },
    });

    if (existingApplication) {
      return res.status(400).json({
        success: false,
        error: 'You have already applied to this event',
      } as ApiResponse);
    }

    const approvedCount = await prisma.eventApplication.count({
      where: {
        eventId: id,
        status: 'APPROVED',
      },
    });

    if (approvedCount >= event.spots) {
      return res.status(400).json({
        success: false,
        error: 'Event is full',
      } as ApiResponse);
    }

    const application = await prisma.eventApplication.create({
      data: {
        message: message || '',
        eventId: id,
        applicantId: req.user.id,
      },
      include: {
        applicant: {
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
      data: application,
    } as ApiResponse);
  } catch (error) {
    console.error('Apply to event error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to apply to event',
    } as ApiResponse);
  }
});

router.put('/:id/applications/:appId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      } as ApiResponse);
    }

    const { id, appId } = req.params;
    const { status } = req.body as RespondApplicationBody;

    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Valid status (APPROVED or REJECTED) is required',
      } as ApiResponse);
    }

    const event = await prisma.event.findUnique({
      where: { id },
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Event not found',
      } as ApiResponse);
    }

    if (event.organizerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Only the event organizer can respond to applications',
      } as ApiResponse);
    }

    const application = await prisma.eventApplication.findUnique({
      where: { id: appId },
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        error: 'Application not found',
      } as ApiResponse);
    }

    if (application.eventId !== id) {
      return res.status(400).json({
        success: false,
        error: 'Application does not belong to this event',
      } as ApiResponse);
    }

    if (status === 'APPROVED') {
      const approvedCount = await prisma.eventApplication.count({
        where: {
          eventId: id,
          status: 'APPROVED',
        },
      });

      if (approvedCount >= event.spots) {
        return res.status(400).json({
          success: false,
          error: 'Event is full, cannot approve more applications',
        } as ApiResponse);
      }
    }

    const updatedApplication = await prisma.eventApplication.update({
      where: { id: appId },
      data: { status },
      include: {
        applicant: {
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
      data: updatedApplication,
    } as ApiResponse);
  } catch (error) {
    console.error('Respond to application error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to respond to application',
    } as ApiResponse);
  }
});

export default router;
