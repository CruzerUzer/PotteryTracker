# Add Component

Create a new React component following PotteryTracker patterns.

## Arguments

$ARGUMENTS should contain the component name (e.g., "NewComponent" or "FeatureName").

## Process

### Step 1: Analyze Existing Patterns

Look at existing components in `/frontend/src/components/` for:
- File structure and naming
- Import patterns
- How they use Radix UI components
- How they integrate with API service
- How they handle loading/error states

### Step 2: Create Component

Create the component file at `/frontend/src/components/$ARGUMENTS.jsx`:

1. Import necessary dependencies:
   - React hooks as needed
   - UI components from `./ui/`
   - Icons from `lucide-react`
   - API functions from `../services/api`

2. Follow existing patterns:
   - Use Tailwind CSS for styling
   - Use Radix UI primitives for interactive elements
   - Handle loading states with appropriate UI
   - Handle errors gracefully

### Step 3: Integration

After creating:
1. Import and use in appropriate parent component
2. Add any necessary API endpoints in backend if needed
3. Test the component manually

### Step 4: Verification

- Verify frontend still builds: `cd frontend && npm run build`
- Test the new component in browser
