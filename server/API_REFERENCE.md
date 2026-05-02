# Aura Dating API Quick Reference

## Base URL
```
http://localhost:3001
```

## Authentication Header (for protected routes)
```
Authorization: Bearer <JWT_TOKEN>
```

---

## Authentication

| Method | Endpoint | Protected | Description |
|--------|----------|-----------|-------------|
| POST | `/api/auth/register` | No | Register new user |
| POST | `/api/auth/login` | No | Login user |
| GET | `/api/auth/me` | Yes | Get current user profile |

---

## Profile Management

| Method | Endpoint | Protected | Description |
|--------|----------|-----------|-------------|
| GET | `/api/profile/:userId` | No | Get user profile |
| PUT | `/api/profile` | Yes | Update own profile |
| POST | `/api/profile/photo` | Yes | Upload profile photo |
| PUT | `/api/profile/complete` | Yes | Mark profile as complete |

---

## Members & Discovery

| Method | Endpoint | Protected | Description |
|--------|----------|-----------|-------------|
| GET | `/api/members` | No | List all members (paginated) |
| GET | `/api/members/:userId` | No | Get member details |

**Query Parameters for /api/members:**
- `page` - Page number (default: 1)
- `pageSize` - Items per page (default: 20)
- `gender` - Filter by gender (MALE/FEMALE)
- `city` - Filter by city
- `genderInterest` - Filter by gender interest

---

## Social & Interests

| Method | Endpoint | Protected | Description |
|--------|----------|-----------|-------------|
| POST | `/api/interests` | Yes | Send interest to user |
| GET | `/api/interests/received` | Yes | Get interests received |
| GET | `/api/interests/sent` | Yes | Get interests sent |
| PUT | `/api/interests/:id/respond` | Yes | Accept/decline interest |

---

## Date Proposals

| Method | Endpoint | Protected | Description |
|--------|----------|-----------|-------------|
| POST | `/api/proposals` | Yes | Create date proposal |
| GET | `/api/proposals/received` | Yes | Get received proposals |
| GET | `/api/proposals/sent` | Yes | Get sent proposals |
| PUT | `/api/proposals/:id/respond` | Yes | Accept/decline proposal |

---

## Events

| Method | Endpoint | Protected | Description |
|--------|----------|-----------|-------------|
| GET | `/api/events` | No | List events (paginated) |
| GET | `/api/events/:id` | No | Get event details |
| POST | `/api/events` | Yes | Create event |
| POST | `/api/events/:id/apply` | Yes | Apply to event |
| PUT | `/api/events/:id/applications/:appId` | Yes | Respond to application |

**Query Parameters for /api/events:**
- `page` - Page number (default: 1)
- `pageSize` - Items per page (default: 20)
- `eventType` - Filter by event type
- `location` - Filter by location

---

## Request/Response Examples

### Register
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "city": "New York"
  }'
```

### Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

### Get Current User (Protected)
```bash
curl -X GET http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Update Profile (Protected)
```bash
curl -X PUT http://localhost:3001/api/profile \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "gender": "MALE",
    "bio": "Looking for serious relationships",
    "height": 180
  }'
```

### Upload Photo (Protected)
```bash
curl -X POST http://localhost:3001/api/profile/photo \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -F "photo=@/path/to/photo.jpg"
```

### List Members
```bash
curl "http://localhost:3001/api/members?page=1&pageSize=20&gender=FEMALE&city=New%20York"
```

### Send Interest (Protected)
```bash
curl -X POST http://localhost:3001/api/interests \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "toUserId": "user123"
  }'
```

### Create Proposal (Protected)
```bash
curl -X POST http://localhost:3001/api/proposals \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "toUserId": "user123",
    "message": "Would you like to grab dinner?",
    "dateType": "DRESSING_UP",
    "preferredDate": "2026-04-15",
    "preferredTime": "19:00"
  }'
```

### Create Event (Protected)
```bash
curl -X POST http://localhost:3001/api/events \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Wine Tasting",
    "description": "Fine wines from around the world",
    "location": "Manhattan",
    "eventDate": "2026-04-20",
    "eventTime": "19:00",
    "spots": 12,
    "eventType": "DRINKS"
  }'
```

### Apply to Event (Protected)
```bash
curl -X POST http://localhost:3001/api/events/event123/apply \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I would love to attend!"
  }'
```

---

## Enums

### Gender
- `MALE`
- `FEMALE`

### DateType
- `DRESSING_UP`
- `GROUP_DATE`
- `TRENDY_GIRLY`

### EventType
- `DINNER_PARTY`
- `DRINKS`
- `ACTIVITY`
- `CULTURAL`
- `WELLNESS`
- `OUTDOOR`

### ProposalStatus
- `PENDING`
- `ACCEPTED`
- `DECLINED`

### ApplicationStatus
- `PENDING`
- `APPROVED`
- `REJECTED`

### PaymentArrangement
- `MAN_COVERS`
- `SPLIT`
- `EACH_PAYS_OWN`

### DrinkingPreference
- `NEVER`
- `SOCIALLY`
- `REGULARLY`

### SmokingPreference
- `NEVER`
- `SOCIALLY`
- `REGULARLY`

---

## Response Format

### Success Response
```json
{
  "success": true,
  "data": {
    "id": "user123",
    "email": "user@example.com",
    ...
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

---

## Status Codes

- `200` - OK (GET, PUT successful)
- `201` - Created (POST successful)
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Server Error

---

## Common Errors

| Status | Error | Cause |
|--------|-------|-------|
| 400 | Missing or invalid authorization header | No Bearer token |
| 401 | Invalid or expired token | Token is invalid or expired |
| 400 | User with this email already exists | Email already registered |
| 401 | Invalid email or password | Wrong credentials |
| 404 | User not found | Invalid user ID |
| 400 | Cannot send interest to yourself | fromUserId === toUserId |
| 400 | Interest already sent to this user | Duplicate interest |
| 400 | Proposal already exists with this user | One proposal per user pair |
| 400 | You have already applied to this event | Duplicate application |
| 400 | Event is full | No more spots available |

---

## Development Server

Start with:
```bash
npm run dev
```

Server runs on `http://localhost:3001` with hot-reload enabled.

Build for production:
```bash
npm run build
npm start
```
