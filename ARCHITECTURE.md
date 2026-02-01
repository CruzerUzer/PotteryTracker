# PotteryTracker - Architecture & Design

## Recommended Tech Stack

### Backend
- **Node.js with Express.js**
  - Why: Mature ecosystem, beginner-friendly, excellent documentation
  - Easy to deploy and extend
  - Great for REST APIs

### Frontend
- **React with Vite**
  - Why: Modern, fast development experience
  - Simple component structure
  - Easy to understand and extend

### Database
- **SQLite**
  - Why: Zero configuration, file-based, perfect for local development
  - Can easily migrate to PostgreSQL later if needed
  - No separate database server required

### File Storage
- **File System (local directory)**
  - Why: Simple and realistic for MVP
  - Images stored in `uploads/` directory
  - Database stores file paths/references

## Database Schema

### Tables

#### 1. `phases`
Stores the lifecycle phases (e.g., "På tork", "Skröjbränd", etc.)
- `id` (INTEGER PRIMARY KEY)
- `name` (TEXT NOT NULL UNIQUE)
- `display_order` (INTEGER) - for sorting phases in UI
- `created_at` (TEXT) - ISO 8601 timestamp

#### 2. `materials`
Stores materials (clays, glazes, etc.)
- `id` (INTEGER PRIMARY KEY)
- `name` (TEXT NOT NULL)
- `type` (TEXT NOT NULL) - 'clay', 'glaze', 'other'
- `created_at` (TEXT)

#### 3. `ceramic_pieces`
Main table for ceramic pieces
- `id` (INTEGER PRIMARY KEY)
- `name` (TEXT NOT NULL)
- `description` (TEXT)
- `current_phase_id` (INTEGER) - FOREIGN KEY to phases(id)
- `created_at` (TEXT)
- `updated_at` (TEXT)

#### 4. `piece_materials`
Junction table for many-to-many relationship between pieces and materials
- `id` (INTEGER PRIMARY KEY)
- `piece_id` (INTEGER) - FOREIGN KEY to ceramic_pieces(id)
- `material_id` (INTEGER) - FOREIGN KEY to materials(id)
- UNIQUE(piece_id, material_id)

#### 5. `piece_images`
Stores image references for ceramic pieces
- `id` (INTEGER PRIMARY KEY)
- `piece_id` (INTEGER) - FOREIGN KEY to ceramic_pieces(id)
- `phase_id` (INTEGER) - FOREIGN KEY to phases(id) - phase when image was taken
- `filename` (TEXT NOT NULL) - stored filename
- `original_filename` (TEXT) - original upload filename
- `created_at` (TEXT)

### Relationships
- ceramic_pieces → phases (many-to-one)
- ceramic_pieces ↔ materials (many-to-many via piece_materials)
- ceramic_pieces → piece_images (one-to-many)

## REST API Endpoints

### Phases
- `GET /api/phases` - Get all phases
- `POST /api/phases` - Create a new phase
- `PUT /api/phases/:id` - Update a phase
- `DELETE /api/phases/:id` - Delete a phase

### Materials
- `GET /api/materials` - Get all materials
- `POST /api/materials` - Create a new material
- `PUT /api/materials/:id` - Update a material
- `DELETE /api/materials/:id` - Delete a material

### Ceramic Pieces
- `GET /api/pieces` - Get all pieces (optional query: ?phase_id=X)
- `GET /api/pieces/:id` - Get a specific piece with materials and images
- `POST /api/pieces` - Create a new piece
- `PUT /api/pieces/:id` - Update a piece
- `DELETE /api/pieces/:id` - Delete a piece
- `PATCH /api/pieces/:id/phase` - Move piece to a different phase
  - Body: `{ phase_id: number }`

### Images
- `POST /api/pieces/:id/images` - Upload image for a piece
  - Multipart form data: file, phase_id
- `GET /api/pieces/:id/images` - Get all images for a piece
- `GET /api/images/:id` - Get image file (serve from file system)
- `DELETE /api/images/:id` - Delete an image

## Project Structure

```
PotteryTracker/
├── backend/
│   ├── server.js              # Express server entry point
│   ├── package.json
│   ├── database/
│   │   ├── init.js            # Database initialization
│   │   └── schema.sql         # SQL schema
│   ├── routes/
│   │   ├── phases.js
│   │   ├── materials.js
│   │   ├── pieces.js
│   │   └── images.js
│   ├── middleware/
│   │   └── upload.js          # Multer config for file uploads
│   └── uploads/               # Image storage directory
│
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   ├── components/
│   │   │   ├── PieceList.jsx
│   │   │   ├── PieceForm.jsx
│   │   │   ├── PieceDetail.jsx
│   │   │   ├── PhaseManager.jsx
│   │   │   ├── MaterialManager.jsx
│   │   │   └── ImageUpload.jsx
│   │   ├── services/
│   │   │   └── api.js         # API client functions
│   │   └── styles/
│   │       └── App.css
│
├── README.md
└── ARCHITECTURE.md

```

## Design Decisions

1. **SQLite over PostgreSQL**: Simpler setup, no external dependencies. Can migrate later if needed.
2. **File-based image storage**: Simple and realistic. In production, could use cloud storage (S3, etc.).
3. **REST over GraphQL**: Simpler for beginners, easier to understand and debug.
4. **Phase-based image association**: Images are tagged with the phase they represent, providing a visual history.
5. **Separate backend/frontend**: Clear separation of concerns, can be deployed independently later.

---

## Architecture Diagrams

Visual diagrams of the system architecture and key user flows using Mermaid.

### System Architecture

```mermaid
flowchart TB
    subgraph Frontend["Frontend (React + Vite) :3000"]
        UI[UI Components]
        CTX["Contexts: Auth/Theme"]
        API[api.js Service]
    end

    subgraph Backend["Backend (Express) :3001"]
        MW["Middleware: Auth/Upload"]
        RT[Routes]
        subgraph Routes
            AUTH["auth"]
            PIECES["pieces"]
            PHASES["phases"]
            LOCS["locations"]
            MATS["materials"]
            IMGS["images"]
            EXP["export"]
            ADM["admin"]
        end
    end

    subgraph Storage
        DB[("SQLite database.db")]
        FILES["uploads/images"]
    end

    UI --> CTX
    CTX --> API
    API -->|HTTP + Session Cookie| MW
    MW --> RT
    RT --> DB
    RT --> FILES
```

### Database Entity Relationship

```mermaid
erDiagram
    users ||--o{ phases : has
    users ||--o{ locations : has
    users ||--o{ materials : has
    users ||--o{ ceramic_pieces : owns
    users ||--o{ user_archives : has
    users ||--o{ password_reset_tokens : has

    ceramic_pieces }o--|| phases : "in phase"
    ceramic_pieces }o--o| locations : "at location"
    ceramic_pieces ||--o{ piece_images : has
    ceramic_pieces ||--o{ piece_materials : has

    piece_materials }o--|| materials : references
    piece_images }o--|| phases : "taken at"

    users {
        int id PK
        string username UK
        string password_hash
        bool is_admin
        datetime last_login
        bool must_change_password
    }

    phases {
        int id PK
        int user_id FK
        string name
        int display_order
    }

    locations {
        int id PK
        int user_id FK
        string name
        int display_order
    }

    materials {
        int id PK
        int user_id FK
        string name
        string type
    }

    ceramic_pieces {
        int id PK
        int user_id FK
        string name
        string description
        int current_phase_id FK
        int current_location_id FK
        bool done
    }

    piece_images {
        int id PK
        int piece_id FK
        int phase_id FK
        string filename
    }

    piece_materials {
        int id PK
        int piece_id FK
        int material_id FK
    }
```

### Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant B as Backend
    participant DB as Database

    rect rgb(230, 245, 255)
        note right of U: Registration
        U->>F: Enter username/password
        F->>B: POST /api/auth/register
        B->>DB: Check registration enabled
        B->>DB: Check username available
        B->>DB: Create user (bcrypt hash)
        B->>DB: Create 4 default phases
        B-->>F: Set session cookie
        F-->>U: Redirect to Kanban
    end

    rect rgb(255, 245, 230)
        note right of U: Login
        U->>F: Enter credentials
        F->>B: POST /api/auth/login
        B->>DB: Find user by username
        B->>B: bcrypt.compare password
        B->>DB: Update last_login
        B-->>F: Set session cookie + user info
        F->>F: AuthContext stores user
        F-->>U: Redirect to Kanban
    end

    rect rgb(245, 255, 230)
        note right of U: Protected Request
        U->>F: Access /pieces
        F->>B: GET /api/pieces (with cookie)
        B->>B: requireAuth middleware
        B->>DB: SELECT WHERE user_id = ?
        B-->>F: User's pieces only
        F-->>U: Display pieces
    end
```

### Create Piece Flow

```mermaid
sequenceDiagram
    participant U as User
    participant PF as PieceForm
    participant API as api.js
    participant B as Backend
    participant DB as Database

    U->>PF: Navigate to /pieces/new

    par Load Form Data
        PF->>API: phasesAPI.getAll()
        API->>B: GET /api/phases
        B->>DB: SELECT phases WHERE user_id
        B-->>PF: phases[]
    and
        PF->>API: locationsAPI.getAll()
        API->>B: GET /api/locations
        B-->>PF: locations[]
    and
        PF->>API: materialsAPI.getAll()
        API->>B: GET /api/materials
        B-->>PF: materials[]
    end

    PF-->>U: Display form with options

    U->>PF: Fill name, select phase/materials
    U->>PF: Submit

    PF->>API: piecesAPI.create(data)
    API->>B: POST /api/pieces
    B->>DB: Validate phase/location ownership
    B->>DB: INSERT ceramic_pieces
    B->>DB: INSERT piece_materials (each)
    B-->>API: new piece
    API-->>PF: success
    PF-->>U: Redirect to /kanban
```

### Image Upload Flow

```mermaid
sequenceDiagram
    participant U as User
    participant IU as ImageUpload
    participant B as Backend
    participant Sharp as Sharp
    participant FS as File System
    participant DB as Database

    U->>IU: Select image file
    U->>IU: Select phase
    U->>IU: Click upload

    IU->>B: POST /api/pieces/:id/images (FormData)

    B->>B: Multer receives file
    B->>Sharp: optimizeImage()
    Sharp->>Sharp: Resize to max 1920px
    Sharp->>Sharp: Create 200px thumbnail
    Sharp->>FS: Save original + thumbnail

    B->>DB: Validate piece belongs to user
    B->>DB: INSERT piece_images
    B-->>IU: { id, filename, thumbnail }

    IU-->>U: Display new thumbnail
```

### Kanban Drag & Drop Flow

```mermaid
sequenceDiagram
    participant U as User
    participant KV as KanbanView
    participant API as api.js
    participant B as Backend
    participant DB as Database

    U->>KV: Load /kanban

    par Load Board Data
        KV->>API: piecesAPI.getAll()
        API-->>KV: pieces[]
    and
        KV->>API: phasesAPI.getAll()
        API-->>KV: phases[]
    and
        KV->>API: locationsAPI.getAll()
        API-->>KV: locations[]
    end

    KV->>KV: Render grid (phases x locations)
    KV-->>U: Display Kanban board

    U->>KV: Drag piece card
    U->>KV: Drop on new cell

    KV->>KV: Optimistic state update

    alt Phase changed
        KV->>API: piecesAPI.updatePhase(id, phaseId)
        API->>B: PATCH /api/pieces/:id/phase
        B->>DB: UPDATE ceramic_pieces
        B->>DB: Check if final phase -> set done=1
        B-->>KV: updated piece
    end

    alt Location changed
        KV->>API: piecesAPI.updateLocation(id, locId)
        API->>B: PATCH /api/pieces/:id/location
        B->>DB: UPDATE ceramic_pieces
        B-->>KV: updated piece
    end

    KV-->>U: Card in new position
```

### Export/Import Archive Flow

```mermaid
sequenceDiagram
    participant U as User
    participant ED as ExportData
    participant B as Backend
    participant DB as Database
    participant FS as File System

    rect rgb(230, 245, 255)
        note right of U: Export Archive
        U->>ED: Click Export Archive
        U->>ED: Choose encryption (optional)
        ED->>B: POST /api/export/archive
        B->>DB: Fetch all user data
        B->>FS: Copy user images
        B->>B: Create ZIP archive
        alt Encrypted
            B->>B: AES-256-GCM encrypt
        end
        B->>FS: Save archive
        B-->>ED: { filename, downloadUrl }
        ED-->>U: Download link
    end

    rect rgb(255, 245, 230)
        note right of U: Import Archive
        U->>ED: Select archive file
        U->>ED: Enter password (if encrypted)
        ED->>B: POST /api/export/import
        B->>B: Extract/decrypt ZIP
        B->>DB: Validate & insert phases
        B->>DB: Validate & insert locations
        B->>DB: Validate & insert materials
        B->>DB: Insert pieces with mappings
        B->>FS: Copy images
        B-->>ED: { imported counts }
        ED-->>U: Success summary
    end
```

### Component Architecture

```mermaid
flowchart TB
    subgraph App
        Router[React Router]
        Auth[AuthContext]
        Theme[ThemeContext]
    end

    subgraph Views
        Login[LoginPage]
        Kanban[KanbanView]
        List[PieceList]
        Detail[PieceDetail]
        Settings[SettingsPage]
        Admin[AdminPanel]
    end

    subgraph Components
        PF[PieceForm]
        PC[PieceCard]
        IU[ImageUpload]
        IG[ImageGallery]
        WM[WorkflowManager]
        MM[MaterialManager]
        LM[LocationManager]
        ED[ExportData]
    end

    subgraph Services
        API[api.js]
    end

    Router --> Views
    Auth --> Views
    Theme --> Views

    Kanban --> PC
    Kanban --> IG
    Detail --> PF
    Detail --> IU
    Detail --> IG
    Settings --> WM
    Settings --> MM
    Settings --> LM
    Settings --> ED

    Views --> API
    Components --> API
```
