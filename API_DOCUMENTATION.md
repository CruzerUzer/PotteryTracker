# PotteryTracker API Documentation

## Base URL
```
http://localhost:3001/api
```

## Authentication

All endpoints except `/auth/register` and `/auth/login` require authentication via session cookies.

## Endpoints

### Authentication

#### POST /api/auth/register
Register a new user.

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:** `201 Created`
```json
{
  "id": 1,
  "username": "string",
  "message": "User created successfully"
}
```

#### POST /api/auth/login
Login user.

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:** `200 OK`
```json
{
  "id": 1,
  "username": "string",
  "message": "Login successful"
}
```

#### POST /api/auth/logout
Logout user.

**Response:** `200 OK`
```json
{
  "message": "Logout successful"
}
```

#### GET /api/auth/me
Get current authenticated user.

**Response:** `200 OK`
```json
{
  "id": 1,
  "username": "string"
}
```

### Phases

#### GET /api/phases
Get all phases for the authenticated user.

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "user_id": 1,
    "name": "På tork",
    "display_order": 0,
    "created_at": "2024-01-01T00:00:00.000Z"
  }
]
```

#### POST /api/phases
Create a new phase.

**Request Body:**
```json
{
  "name": "string",
  "display_order": 0
}
```

**Response:** `201 Created`

#### PUT /api/phases/:id
Update a phase.

**Request Body:**
```json
{
  "name": "string",
  "display_order": 0
}
```

**Response:** `200 OK`

#### DELETE /api/phases/:id
Delete a phase.

**Response:** `200 OK`

### Materials

#### GET /api/materials
Get all materials for the authenticated user.

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "user_id": 1,
    "name": "Clay A",
    "type": "clay",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
]
```

#### POST /api/materials
Create a new material.

**Request Body:**
```json
{
  "name": "string",
  "type": "clay" | "glaze" | "other"
}
```

**Response:** `201 Created`

#### PUT /api/materials/:id
Update a material.

**Request Body:**
```json
{
  "name": "string",
  "type": "clay" | "glaze" | "other"
}
```

**Response:** `200 OK`

#### DELETE /api/materials/:id
Delete a material.

**Response:** `200 OK`

### Pieces

#### GET /api/pieces
Get all pieces for the authenticated user.

**Query Parameters:**
- `phase_id` (optional): Filter by phase
- `material_id` (optional): Filter by material
- `search` (optional): Search by name or description
- `date_from` (optional): Filter by creation date from (YYYY-MM-DD)
- `date_to` (optional): Filter by creation date to (YYYY-MM-DD)
- `done` (optional): Filter by done status (true/false)

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "user_id": 1,
    "name": "Vase",
    "description": "Beautiful vase",
    "current_phase_id": 1,
    "phase_name": "På tork",
    "done": 0,
    "material_count": 2,
    "image_count": 3,
    "latest_image_id": 5,
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
]
```

#### GET /api/pieces/:id
Get a specific piece with materials and images.

**Response:** `200 OK`
```json
{
  "id": 1,
  "name": "Vase",
  "description": "Beautiful vase",
  "current_phase_id": 1,
  "phase_name": "På tork",
  "materials": [
    {
      "id": 1,
      "name": "Clay A",
      "type": "clay"
    }
  ],
  "images": [
    {
      "id": 1,
      "piece_id": 1,
      "phase_id": 1,
      "phase_name": "På tork",
      "filename": "1234567890.jpg",
      "original_filename": "photo.jpg",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### POST /api/pieces
Create a new piece.

**Request Body:**
```json
{
  "name": "string (required)",
  "description": "string (optional)",
  "current_phase_id": 1 (optional),
  "material_ids": [1, 2] (optional)
}
```

**Response:** `201 Created`

#### PUT /api/pieces/:id
Update a piece.

**Request Body:**
```json
{
  "name": "string (required)",
  "description": "string (optional)",
  "current_phase_id": 1 (optional),
  "material_ids": [1, 2] (optional)
}
```

**Response:** `200 OK`

#### PATCH /api/pieces/:id/phase
Move piece to a different phase.

**Request Body:**
```json
{
  "phase_id": 2
}
```

**Response:** `200 OK`

#### DELETE /api/pieces/:id
Delete a piece.

**Response:** `200 OK`

### Images

#### POST /api/pieces/:id/images
Upload an image for a piece.

**Request:** `multipart/form-data`
- `image`: File (required)
- `phase_id`: Number (required)

**Response:** `201 Created`
```json
{
  "id": 1,
  "piece_id": 1,
  "phase_id": 1,
  "filename": "1234567890.jpg",
  "original_filename": "photo.jpg"
}
```

#### GET /api/pieces/:id/images
Get all images for a piece.

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "piece_id": 1,
    "phase_id": 1,
    "phase_name": "På tork",
    "filename": "1234567890.jpg",
    "original_filename": "photo.jpg",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
]
```

#### GET /api/images/:id/file
Serve image file.

**Query Parameters:**
- `thumbnail` (optional): Set to `true` to get thumbnail version

**Response:** `200 OK` (image file)

#### DELETE /api/images/:id
Delete an image.

**Response:** `200 OK`

### Export

#### GET /api/export/pieces
Export pieces as CSV or JSON.

**Query Parameters:**
- `format`: `csv` or `json` (default: `json`)

**Response:** `200 OK` (file download)

#### GET /api/export/stats
Get statistics and reports.

**Response:** `200 OK`
```json
{
  "summary": {
    "total_pieces": 10,
    "done_pieces": 3,
    "in_progress_pieces": 7,
    "phases_in_use": 4,
    "materials_in_use": 5,
    "total_images": 25
  },
  "piecesByPhase": [
    {
      "phase_name": "På tork",
      "count": 5
    }
  ],
  "piecesByMaterialType": [
    {
      "type": "clay",
      "count": 8
    }
  ],
  "generatedAt": "2024-01-01T00:00:00.000Z"
}
```

## Error Responses

All endpoints may return error responses in the following format:

**400 Bad Request**
```json
{
  "error": "Error message"
}
```

**401 Unauthorized**
```json
{
  "error": "Authentication required"
}
```

**404 Not Found**
```json
{
  "error": "Resource not found"
}
```

**409 Conflict**
```json
{
  "error": "Resource already exists"
}
```

**500 Internal Server Error**
```json
{
  "error": "Internal server error"
}
```




