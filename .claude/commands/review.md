# Code Review

Perform a comprehensive code review of the specified files or recent changes.

## Target

$ARGUMENTS specifies what to review:
- A file path: Review that specific file
- A directory: Review all files in directory
- "changes" or "diff": Review uncommitted changes
- "pr" or "branch": Review current branch vs main

## Review Checklist

### 1. Code Quality
- [ ] Clear, descriptive naming
- [ ] Functions are focused and reasonably sized
- [ ] No obvious code smells or anti-patterns
- [ ] Components follow React best practices

### 2. Error Handling
- [ ] Errors are handled appropriately
- [ ] Error messages are helpful
- [ ] No silent failures
- [ ] API errors shown to user appropriately

### 3. Security
- [ ] No hardcoded secrets or credentials
- [ ] Input validation where needed
- [ ] SQL queries use parameterized statements
- [ ] Authentication/authorization checks present

### 4. Performance
- [ ] No obvious performance issues
- [ ] Database queries are efficient
- [ ] No unnecessary re-renders in React
- [ ] Images properly optimized

### 5. Testing
- [ ] Tests exist for new backend functionality
- [ ] Tests cover edge cases
- [ ] Tests are readable and maintainable

## Output Format

Provide findings organized by severity:

### Critical
Issues that must be fixed before merge.

### Important
Issues that should be addressed.

### Suggestions
Optional improvements and nitpicks.

### Highlights
Things done well worth noting.

---

End with a summary and overall recommendation.
