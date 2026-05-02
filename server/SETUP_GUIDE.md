# Aura Dating Server - Setup & Deployment Guide

## Quick Start (5 minutes)

### Prerequisites
- Node.js 16+ installed
- PostgreSQL database running
- npm or yarn package manager

### 1. Install Dependencies
```bash
cd /sessions/inspiring-sweet-turing/AuraDatingMobile/server
npm install
```

### 2. Verify Environment Configuration
The `.env` file is already configured. Check that it contains:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/auradating?schema=public"
JWT_SECRET="aura-dating-jwt-secret-2026"
PORT=3001
NODE_ENV="development"
```

### 3. Set Up Database
```bash
# Generate Prisma client
npm run prisma:generate

# Push schema to database
npm run prisma:push
```

### 4. Start Development Server
```bash
npm run dev
```

Server will be available at `http://localhost:3001`

### 5. Test the Server
```bash
# Health check
curl http://localhost:3001/health

# Should respond with:
# {"success":true,"data":{"message":"Server is running"}}
```

---

## Project Structure Explained

```
server/
├── src/
│   ├── index.ts                    # Main Express app & server setup
│   │   └── Configures CORS, middleware, routes, error handling
│   │
│   ├── lib/
│   │   └── prisma.ts              # Prisma singleton client
│   │       └── Ensures single DB connection instance
│   │
│   ├── middleware/
│   │   └── auth.ts                # JWT authentication
│   │       ├── generateToken()    # Create JWT tokens
│   │       ├── verifyToken()      # Verify tokens
│   │       └── authMiddleware     # Express middleware for protected routes
│   │
│   ├── routes/                    # All API endpoints
│   │   ├── auth.ts                # POST /register, /login, GET /me
│   │   ├── profile.ts             # User profile management
│   │   ├── members.ts             # Browse members/discover
│   │   ├── social.ts              # Send/receive interests
│   │   ├── proposals.ts           # Date proposals & counter-offers
│   │   └── events.ts              # Event creation & applications
│   │
│   └── types/
│       └── index.ts               # TypeScript interfaces & types
│
├── prisma/
│   └── schema.prisma              # Database schema (Prisma ORM)
│
├── uploads/                       # Profile photo storage
│
├── .env                           # Environment variables
├── .gitignore                     # Git ignore rules
├── package.json                   # Dependencies & scripts
├── tsconfig.json                  # TypeScript configuration
│
├── README.md                      # Full documentation
├── API_REFERENCE.md              # Quick API reference
└── SETUP_GUIDE.md               # This file
```

---

## Environment Variables Explained

| Variable | Value | Purpose |
|----------|-------|---------|
| DATABASE_URL | PostgreSQL connection string | Connect to database |
| JWT_SECRET | Secret key for token signing | Secure JWT tokens |
| PORT | 3001 | Server port |
| NODE_ENV | development/production | Environment mode |

### Changing Environment Variables

Edit `.env`:
```bash
# Change port if 3001 is in use
PORT=3002

# Change JWT secret for production (use a secure random string)
JWT_SECRET="your-very-secure-random-string-here"

# Change to production database
DATABASE_URL="postgresql://user:pass@prod-db.example.com:5432/auradating"
```

Then restart the server.

---

## Database Setup

### PostgreSQL Installation

**macOS (Homebrew):**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Ubuntu/Linux:**
```bash
sudo apt-get install postgresql postgresql-contrib
sudo service postgresql start
```

**Windows:**
Download from https://www.postgresql.org/download/windows/

### Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE auradating;

# Create user (if needed)
CREATE USER postgres WITH PASSWORD 'postgres';

# Grant privileges
ALTER ROLE postgres WITH SUPERUSER;

# Exit
\q
```

### Verify Connection

```bash
# Test connection
psql -U postgres -d auradating -h localhost

# Should connect successfully
# Type \q to exit
```

### Push Schema

```bash
npm run prisma:push
```

This will:
1. Sync the Prisma schema with PostgreSQL
2. Create all tables and relationships
3. Set up constraints and indexes

---

## Development Workflow

### File Structure & Hot Reload

```bash
# Start dev server with auto-reload
npm run dev

# Watches all changes in src/ directory
# Automatically restarts when files are saved
```

### Making Changes

1. Edit TypeScript files in `src/`
2. Server automatically restarts
3. No need to manually restart

### Common Development Tasks

**Add a new route:**
1. Create file in `src/routes/new-feature.ts`
2. Export router from the file
3. Import and mount in `src/index.ts`:
```typescript
import newFeatureRoutes from './routes/new-feature';
app.use('/api/feature', newFeatureRoutes);
```
4. Server hot-reloads automatically

**Modify database schema:**
1. Edit `prisma/schema.prisma`
2. Run `npm run prisma:push` to sync
3. Prisma client auto-generates types

**Update environment variables:**
1. Edit `.env`
2. Restart dev server (`Ctrl+C` then `npm run dev`)

---

## Build & Deployment

### Build for Production

```bash
# Compile TypeScript to JavaScript
npm run build

# Creates ./dist/ directory with compiled code
```

### Run Production Build

```bash
# Start production server
npm start

# Runs compiled JavaScript from ./dist/
```

### Production Checklist

Before deploying to production:

1. **Update `.env` for production:**
   ```
   NODE_ENV=production
   DATABASE_URL=<production-database-url>
   JWT_SECRET=<secure-random-string>
   PORT=<production-port>
   ```

2. **Generate Prisma client:**
   ```bash
   npm run prisma:generate
   ```

3. **Run database migrations:**
   ```bash
   npm run prisma:push
   ```

4. **Build application:**
   ```bash
   npm run build
   ```

5. **Verify build:**
   ```bash
   npm start
   ```

6. **Test endpoints:**
   ```bash
   curl http://localhost:PORT/health
   ```

### Deployment Platforms

**Heroku:**
```bash
# Create Procfile with:
# web: npm start

heroku create your-app-name
heroku addons:create heroku-postgresql:standard-0
git push heroku main
```

**AWS EC2:**
```bash
# Install Node.js and PostgreSQL on EC2
# Clone repository
# Install dependencies: npm install
# Build: npm run build
# Use PM2 for process management: npm i -g pm2
# Start: pm2 start npm --name "aura-dating" -- start
```

**Docker:**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["npm", "start"]
```

---

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 3001
lsof -i :3001

# Kill the process
kill -9 <PID>

# Or change PORT in .env
PORT=3002
```

### Database Connection Error

**Error:** `can't reach database server`

```bash
# 1. Check PostgreSQL is running
sudo service postgresql status

# 2. Verify DATABASE_URL in .env
# 3. Test connection with psql
psql -U postgres -d auradating -h localhost

# 4. Check user permissions
```

### Prisma Client Not Found

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Generate Prisma client
npm run prisma:generate
```

### JWT Token Errors

**Error:** `Invalid or expired token`

- Token expires after 30 days
- Need to login again to get new token
- Check JWT_SECRET is same as when token was issued

### Photo Upload Issues

```bash
# Check uploads directory exists
ls -la /sessions/inspiring-sweet-turing/AuraDatingMobile/server/uploads/

# Create if missing
mkdir -p /sessions/inspiring-sweet-turing/AuraDatingMobile/server/uploads

# Check permissions
chmod 755 /sessions/inspiring-sweet-turing/AuraDatingMobile/server/uploads
```

### TypeScript Compilation Errors

```bash
# Clear compiled files
rm -rf dist/

# Rebuild
npm run build

# Check for type errors
npx tsc --noEmit
```

---

## Testing the API

### Using cURL

```bash
# 1. Register user
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "city": "New York"
  }'

# 2. Copy the token from response

# 3. Login to get token
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'

# 4. Use token for protected routes
curl -X GET http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Using Postman

1. Import API endpoints into Postman
2. Set environment variables:
   - `baseUrl`: `http://localhost:3001`
   - `token`: From login response
3. Test endpoints with pre-configured requests

### Using curl with Variable

```bash
# Set token as variable
TOKEN="your-jwt-token-here"

# Use in requests
curl -X GET http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

---

## Performance Optimization

### Database Connection Pooling

The Prisma client in `src/lib/prisma.ts` is a singleton, ensuring:
- Single database connection pool
- Efficient resource usage
- No connection leaks

### Caching Strategies

For frequently accessed data (like member list):

```typescript
// Add Redis caching layer
// Example: cache member list for 5 minutes
// Invalidate cache when profile updates
```

### Request Compression

Add gzip compression middleware:

```typescript
import compression from 'compression';
app.use(compression());
```

### Database Query Optimization

- Use `select` to fetch only needed fields
- Avoid N+1 queries with proper `include`
- Add database indexes for frequent filters

---

## Monitoring & Logging

### Access Logs

```bash
# All requests are logged to console in development
# Add Morgan middleware for HTTP logging in production

npm install morgan
```

### Database Logs

Prisma logs queries in development. View in console output.

### Error Tracking

Integrate with Sentry for production error tracking:

```bash
npm install @sentry/node
```

---

## Security Hardening

### 1. Update Dependencies Regularly

```bash
# Check for vulnerabilities
npm audit

# Update packages
npm audit fix
npm update
```

### 2. Use Environment Secrets

Never commit `.env` to version control. Use `.env.example`:

```bash
# Create example file
cp .env .env.example

# Edit .env.example with placeholder values
# Commit .env.example to git
# Add .env to .gitignore
```

### 3. Enable HTTPS in Production

```typescript
// Add SSL certificate handling
// Use environment variable for cert paths
```

### 4. Rate Limiting

```bash
npm install express-rate-limit
```

### 5. Input Validation

All routes validate inputs. Consider adding more robust validation:

```bash
npm install joi zod
```

---

## Useful Commands Reference

```bash
# Development
npm run dev                 # Start with hot-reload
npm run build              # Build TypeScript
npm start                  # Run production build

# Database
npm run prisma:generate    # Generate Prisma client
npm run prisma:migrate     # Run migrations
npm run prisma:push        # Sync schema with DB

# Utilities
npm audit                  # Check for vulnerabilities
npm audit fix             # Fix vulnerabilities
npm list                  # List all dependencies
npm outdated              # Check outdated packages
```

---

## Getting Help

### Documentation
- **README.md** - Full feature documentation
- **API_REFERENCE.md** - Quick API endpoint reference
- **Prisma Docs** - https://www.prisma.io/docs/
- **Express Docs** - https://expressjs.com/
- **PostgreSQL Docs** - https://www.postgresql.org/docs/

### Common Issues
See "Troubleshooting" section above

### Database Design
View `prisma/schema.prisma` for full data model

---

## Next Steps

1. **Local Development:**
   - Install dependencies: `npm install`
   - Set up database: `npm run prisma:push`
   - Start server: `npm run dev`

2. **Testing:**
   - Use cURL, Postman, or API_REFERENCE.md examples
   - Create test users and verify endpoints

3. **Mobile App Integration:**
   - Update API base URL in mobile app
   - Test authentication flow
   - Verify all endpoints work as expected

4. **Deployment:**
   - Choose platform (Heroku, AWS, etc.)
   - Update production `.env`
   - Deploy and monitor

---

## Additional Resources

- **Prisma ORM**: https://www.prisma.io/
- **Express.js**: https://expressjs.com/
- **PostgreSQL**: https://www.postgresql.org/
- **JWT Authentication**: https://jwt.io/
- **bcryptjs**: https://www.npmjs.com/package/bcryptjs

For questions or issues, check the troubleshooting section or consult the documentation files.
