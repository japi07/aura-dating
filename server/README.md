# Aura Dating Mobile Server

A complete Node.js/Express API backend for the Aura Dating mobile application. Connects to PostgreSQL via Prisma ORM and provides all necessary endpoints for user authentication, profile management, member browsing, and dating/event features.

## Project Structure

```
server/
├── src/
│   ├── index.ts                 # Express server setup
│   ├── lib/
│   │   └── prisma.ts           # Prisma client singleton
│   ├── middleware/
│   │   └── auth.ts             # JWT authentication middleware
│   ├── routes/
│   │   ├── auth.ts             # Authentication routes
│   │   ├── profile.ts          # User profile routes
│   │   ├── members.ts          # Member browsing routes
│   │   ├── social.ts           # Interest management routes
│   │   ├── proposals.ts        # Date proposal routes
│   │   └── events.ts           # Event management routes
│   └── types/
│       └── index.ts            # TypeScript type definitions
├── prisma/
│   └── schema.prisma           # Prisma database schema
├── uploads/                    # Photo uploads directory
├── .env                        # Environment variables
├── .gitignore                  # Git ignore file
├── package.json                # Dependencies
└── tsconfig.json               # TypeScript config
```

## Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables (already configured in `.env`):
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/auradating?schema=public"
JWT_SECRET="aura-dating-jwt-secret-2026"
PORT=3001
NODE_ENV="development"
```

3. Set up the database:
```bash
npx prisma generate
npx prisma db push
```

4. Start the development server:
```bash
npm run dev
```

The server will run on `http://localhost:3001`

## Available Scripts

- `npm run dev` - Start development server with hot reload (nodemon)
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Run production build
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:push` - Push schema to database

## API Endpoints

### Authentication Routes (`/api/auth`)

#### Register
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword",
  "city": "New York"
}

Response: { success: true, data: { token, user } }
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword"
}

Response: { success: true, data: { token, user } }
```

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <token>

Response: { success: true, data: { user profile } }
```

### Profile Routes (`/api/profile`)

#### Get User Profile
```http
GET /api/profile/:userId
```

#### Update Profile
```http
PUT /api/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "John Doe",
  "gender": "MALE",
  "genderInterest": "FEMALE",
  "bio": "Looking for serious relationships",
  "height": 180,
  "occupation": "Software Engineer",
  "interests": ["travel", "cooking"],
  "dateTypes": ["DRESSING_UP", "GROUP_DATE"],
  "eventInterests": ["DINNER_PARTY", "DRINKS"],
  ...
}
```

#### Upload Photo
```http
POST /api/profile/photo
Authorization: Bearer <token>
Content-Type: multipart/form-data

Form data:
- photo: <file>

Response: { success: true, data: { photo object } }
```

#### Mark Profile Complete
```http
PUT /api/profile/complete
Authorization: Bearer <token>

Response: { success: true, data: { updated user } }
```

### Members Routes (`/api/members`)

#### List Members
```http
GET /api/members?page=1&pageSize=20&gender=FEMALE&city=New%20York&genderInterest=MALE

Query Parameters:
- page: Page number (default: 1)
- pageSize: Items per page (default: 20, max: 100)
- gender: Filter by gender (MALE/FEMALE)
- city: Filter by city (case-insensitive)
- genderInterest: Filter by gender interest (MALE/FEMALE)

Response: { success: true, data: { data: [], total, page, pageSize, totalPages } }
```

#### Get Member Detail
```http
GET /api/members/:userId

Response: { success: true, data: { member profile with all photos } }
```

### Social/Interest Routes (`/api`)

#### Send Interest
```http
POST /api/interests
Authorization: Bearer <token>
Content-Type: application/json

{
  "toUserId": "user-id"
}

Response: { success: true, data: { interest object } }
```

#### Get Received Interests
```http
GET /api/interests/received
Authorization: Bearer <token>

Response: { success: true, data: [interests] }
```

#### Get Sent Interests
```http
GET /api/interests/sent
Authorization: Bearer <token>

Response: { success: true, data: [interests] }
```

#### Respond to Interest
```http
PUT /api/interests/:id/respond
Authorization: Bearer <token>
Content-Type: application/json

{
  "accept": true
}

Response: { success: true, data: { interest, mutualInterest } }
```

### Proposals Routes (`/api/proposals`)

#### Create Date Proposal
```http
POST /api/proposals
Authorization: Bearer <token>
Content-Type: application/json

{
  "toUserId": "user-id",
  "message": "Would you like to grab dinner?",
  "dateType": "DRESSING_UP",
  "restaurantChoice": "Italian restaurant downtown",
  "preferredDate": "2026-04-15",
  "preferredTime": "19:00",
  "paymentArrangement": "MAN_COVERS"
}

Response: { success: true, data: { proposal object } }
```

#### Get Received Proposals
```http
GET /api/proposals/received
Authorization: Bearer <token>

Response: { success: true, data: [proposals] }
```

#### Get Sent Proposals
```http
GET /api/proposals/sent
Authorization: Bearer <token>

Response: { success: true, data: [proposals] }
```

#### Respond to Proposal
```http
PUT /api/proposals/:id/respond
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "ACCEPTED",
  "counterDate": "2026-04-16",
  "counterTime": "20:00"
}

Response: { success: true, data: { updated proposal } }
```

### Events Routes (`/api/events`)

#### List Events
```http
GET /api/events?page=1&pageSize=20&eventType=DINNER_PARTY&location=New%20York

Query Parameters:
- page: Page number (default: 1)
- pageSize: Items per page (default: 20, max: 100)
- eventType: Filter by event type
- location: Filter by location (case-insensitive)

Response: { success: true, data: { data: [], total, page, pageSize, totalPages } }
```

#### Get Event Detail
```http
GET /api/events/:id

Response: { success: true, data: { event object with applications } }
```

#### Create Event
```http
POST /api/events
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Wine Tasting Night",
  "description": "Join us for an evening of fine wines",
  "location": "Manhattan",
  "eventDate": "2026-04-20",
  "eventTime": "19:00",
  "spots": 12,
  "eventType": "DRINKS"
}

Response: { success: true, data: { event object } }
```

#### Apply to Event
```http
POST /api/events/:id/apply
Authorization: Bearer <token>
Content-Type: application/json

{
  "message": "I'd love to join this event!"
}

Response: { success: true, data: { application object } }
```

#### Respond to Event Application
```http
PUT /api/events/:id/applications/:appId
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "APPROVED"
}

Response: { success: true, data: { updated application } }
```

## Authentication

All protected routes require a JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

Tokens are returned on successful login/register and expire after 30 days.

## Response Format

All API responses follow a consistent format:

Success:
```json
{
  "success": true,
  "data": { ... }
}
```

Error:
```json
{
  "success": false,
  "error": "Error message"
}
```

## HTTP Status Codes

- 200: Successful GET/PUT request
- 201: Successful POST request
- 400: Bad request (validation error)
- 401: Unauthorized (missing/invalid token)
- 403: Forbidden (insufficient permissions)
- 404: Not found
- 500: Server error

## Database Models

The database includes the following models:
- **User** - User accounts with profile information
- **Photo** - User profile photos
- **Interest** - Interest expressions between users
- **DateProposal** - Date proposals with counter offers
- **Event** - Dating events/gatherings
- **EventApplication** - Applications to events
- **Availability** - User availability calendar slots
- **FeedbackResponse** - User feedback/testing data

## File Upload

Profile photos are uploaded to the `/uploads` directory and served as static files. Maximum file size is 5MB. Supported formats: JPEG, PNG, GIF, WebP.

## Security Features

- Password hashing with bcryptjs
- JWT token authentication
- CORS enabled for development
- Input validation on all endpoints
- Proper error handling with status codes
- Protected routes require authentication

## Development Notes

- The server runs in development mode by default (set in `.env`)
- Prisma queries include logging in development
- TypeScript strict mode is enabled
- All routes handle errors with try/catch blocks
- Timestamps are automatically managed for all models

## Production Deployment

Before deploying to production:

1. Update `.env` with production database URL
2. Change JWT_SECRET to a secure random value
3. Disable CORS for all origins (configure specific origins)
4. Run `npm run build` to create production build
5. Use `npm start` to run the production server
6. Ensure PostgreSQL database is properly configured
7. Set `NODE_ENV=production`

## Troubleshooting

**Database Connection Error**
- Ensure PostgreSQL is running
- Check DATABASE_URL in `.env`
- Run `npx prisma db push` to sync schema

**Port Already in Use**
- Change PORT in `.env` to an available port
- Or kill the process using port 3001

**Prisma Client Not Found**
- Run `npm install`
- Run `npx prisma generate`

**Photo Upload Issues**
- Ensure `/uploads` directory exists and is writable
- Check file size (max 5MB)
- Verify file format is supported
