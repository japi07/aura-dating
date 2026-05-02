import express from 'express';
import cors from 'cors';
import path from 'path';
import authRoutes from './routes/auth';
import profileRoutes from './routes/profile';
import membersRoutes from './routes/members';
import socialRoutes from './routes/social';
import proposalsRoutes from './routes/proposals';
import eventsRoutes from './routes/events';
import { ApiResponse } from './types';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/members', membersRoutes);
app.use('/api', socialRoutes);
app.use('/api/proposals', proposalsRoutes);
app.use('/api/events', eventsRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: { message: 'Server is running' },
  } as ApiResponse);
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  } as ApiResponse);
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);

  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
  } as ApiResponse);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
