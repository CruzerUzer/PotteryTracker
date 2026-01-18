# Add API Endpoint

Create a new backend API endpoint following PotteryTracker patterns.

## Arguments

$ARGUMENTS should contain the endpoint description (e.g., "GET /api/stats" or "user statistics endpoint").

## Process

### Step 1: Analyze Existing Patterns

Look at existing routes in `/backend/routes/` for:
- Route structure and organization
- How they use the database
- Authentication middleware usage
- Error handling patterns
- Response formats

### Step 2: Determine Location

Decide if this belongs in:
- Existing route file (if related to pieces, phases, materials, etc.)
- New route file (if it's a new domain)

### Step 3: Create/Update Route

1. Add the route handler with:
   - Proper HTTP method
   - Authentication middleware if needed (`authenticateToken`)
   - Input validation
   - Database query with parameterized SQL
   - Proper error handling with try/catch
   - Consistent response format

2. If new file, register it in `server.js`:
   ```javascript
   import newRoutes from './routes/new.js';
   app.use('/api/new', newRoutes);
   ```

### Step 4: Add Tests

Create tests in `/backend/__tests__/` following existing patterns:
- Test happy path
- Test authentication requirements
- Test error cases

### Step 5: Verification

```bash
cd backend && npm test
```

Test the endpoint manually with curl or browser dev tools.
