# Seed Data

This directory contains seed data that will be automatically loaded when initializing a fresh database installation.

## Contents

- `seed-data.sql` - SQL statements to insert all data for the Test user (phases, materials, pieces, images, relationships)
- `uploads/` - Sample image files that will be copied to the uploads directory
- `uploads/thumbnails/` - Thumbnail versions of the images

## How It Works

When you run `npm run init-db`, the initialization script will:

1. Create the database schema
2. Create the default "Test" user (username: Test, password: Test)
3. Create default phases
4. **Automatically import this seed data** if it exists

This means new installations will have sample pieces, materials, and images already in place.

## Updating Seed Data

If you want to update the seed data with new pieces from the Test user:

1. Make sure you have pieces added to the Test user account in your local database
2. Run the export script:
   ```bash
   npm run export-seed
   ```
3. This will:
   - Export all Test user data to `seed-data.sql`
   - Copy all image files to `seed/uploads/`
   - Copy all thumbnails to `seed/uploads/thumbnails/`
4. Commit and push the updated seed data to the repository

## Manual Seed Import

If you want to import seed data into an existing database (without reinitializing):

```bash
npm run seed-db
```

This is useful if you want to add the sample data to an existing installation.

