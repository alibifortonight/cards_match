# Word Match Game - Setup Guide

This guide will help you set up the Word Match Game application on your local machine.

## Prerequisites

- Node.js (v16 or later)
- npm (v7 or later)
- A Supabase account and project

## Environment Setup

1. Create a `.env.local` file in the root directory with the following variables:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Replace `your_supabase_url` and `your_supabase_anon_key` with your actual Supabase project URL and anon key.

## Database Setup

1. Run the SQL in `database_schema.sql` in your Supabase SQL editor to set up the tables and relationships.
2. Run the SQL in `supabase/migrations/20250313_start_game_procedure.sql` to create the stored procedure for starting games.

## Installing Dependencies

Run the following command to install all necessary dependencies:

```bash
npm install
```

## Running the Application

Start the development server:

```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

## Application Structure

- `/pages` - Next.js pages and API routes
- `/lib` - Utility functions and classes
- `/hooks` - React hooks for managing state and interactions
- `/data` - JSON data files
- `/styles` - CSS and styling files
- `/public` - Static assets
- `/supabase` - Supabase Edge Functions and migrations

## Game Flow

1. Users start at the home page where they can create or join a game
2. After creating/joining, they're redirected to the lobby where they wait for other players
3. The host can start the game when at least 2 players have joined
4. Players take turns submitting words based on the current topic and round type
5. Scores are calculated after each round
6. The player with the highest score at the end wins

## Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `NEXT_PUBLIC_APP_URL`: The URL where your application is running (default: http://localhost:3000)
