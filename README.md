# VideoMaestro

VideoMaestro is a full-stack application designed to streamline YouTube video management, including channel management, video templates, analytics, and more. Built with a modern tech stack, it provides a robust interface for creators and managers to optimize their YouTube workflow.

## Features
- Channel management (add, edit, view channels)
- Video template creation and management
- Thumbnail and story template tools
- Analytics dashboard
- Background music and AI-powered services (OpenAI, ElevenLabs, etc.)
- File uploads and storage
- Modular, component-based frontend

## Project Structure
```
VideoMaestro/
  client/           # Frontend React app
    src/
      components/   # UI and feature components
      hooks/        # Custom React hooks
      lib/          # Utilities and query client
      pages/        # Page-level components
      index.css     # Global styles
      main.tsx      # App entry point
    index.html      # HTML template
  server/           # Backend API and services
    services/       # Service modules (OpenAI, YouTube, etc.)
    db.ts           # Database connection
    routes.ts       # API routes
    index.ts        # Server entry point
  shared/           # Shared code/schema
  uploads/          # Uploaded files
  output/           # Generated output files
  package.json      # Project metadata and scripts
  tsconfig.json     # TypeScript configuration
  tailwind.config.ts# Tailwind CSS config
  vite.config.ts    # Vite build config
```

## Getting Started

### Prerequisites
- Node.js (v16+ recommended)
- npm or yarn

### Installation
```bash
# Clone the repository
$ git clone <repo-url>
$ cd VideoMaestro

# Install dependencies
$ npm install
# or
$ yarn install
```

### Running the App

#### Development
```bash
# Start the backend (from project root)
$ npm run dev:server

# Start the frontend (from client directory)
$ cd client
$ npm run dev
```

#### Build for Production
```bash
# Build frontend
$ cd client
$ npm run build

# Build backend (if applicable)
$ cd ..
$ npm run build:server
```

### Environment Variables
Create an `.env` file in the root and configure as needed.

## Technologies Used
- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Backend:** Node.js, Express (or similar), TypeScript
- **Database:** (Configured in `server/db.ts`)
- **Other:** Drizzle ORM, OpenAI, ElevenLabs, Remotion, YouTube API

## Contributing
Contributions are welcome! Please open issues or submit pull requests for improvements and bug fixes.

## License
This project is licensed under the MIT License. 