# KubeMigrate

KubeMigrate is a modern web application for managing Kubernetes cluster migrations.

## Database Setup

**Important:** Before using the application, you need to set up the Supabase database tables.

The application is currently configured to use mock data if the required database tables don't exist, but for the full functionality, please follow the [database setup guide](docs/setup/database.md).

## Features

- Single-to-Multi Cluster Migration
- Checkpoint management for migration progress tracking
- Support for various Kubernetes distributions
- AWS Integration for cloud-based clusters

## Getting Started

1. Clone this repository
2. Install dependencies: `npm install`
3. Set up your Supabase project and database tables as described in the [setup guide](docs/setup/database.md)
4. Create `.env` file with your Supabase credentials
5. Start the development server: `npm run dev`

## Technologies Used

- React with TypeScript
- Vite for fast development
- Supabase for backend and authentication
- ShadcnUI components for a modern, responsive UI
- TailwindCSS for styling
