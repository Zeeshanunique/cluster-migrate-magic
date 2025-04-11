# Supabase Database Setup Guide

This guide will walk you through setting up the required database tables for the KubeMigrate application in Supabase.

## Prerequisites

1. A [Supabase](https://supabase.com) account
2. A new or existing Supabase project

## Step 1: Access SQL Editor

1. Navigate to your Supabase project dashboard
2. Click on "SQL Editor" in the left sidebar
3. Click "New Query" to create a new SQL script

## Step 2: Create Clusters Table

Copy and paste the following SQL into the editor and run it:

```sql
CREATE TABLE IF NOT EXISTS public.clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('single', 'multi')),
  status TEXT NOT NULL CHECK (status IN ('running', 'pending', 'failed')),
  nodes INTEGER NOT NULL DEFAULT 1,
  region TEXT NOT NULL,
  version TEXT NOT NULL,
  owner_id UUID NOT NULL,
  kubeconfig TEXT,
  aws_account_id TEXT,
  aws_role_arn TEXT
);

-- Add RLS (Row Level Security) policy
ALTER TABLE public.clusters ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to select their own clusters
CREATE POLICY select_own_clusters ON public.clusters
  FOR SELECT USING (auth.uid() = owner_id);

-- Create policy to allow users to insert their own clusters
CREATE POLICY insert_own_clusters ON public.clusters
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Create policy to allow users to update their own clusters
CREATE POLICY update_own_clusters ON public.clusters
  FOR UPDATE USING (auth.uid() = owner_id);

-- Create policy to allow users to delete their own clusters
CREATE POLICY delete_own_clusters ON public.clusters
  FOR DELETE USING (auth.uid() = owner_id);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS clusters_owner_id_idx ON public.clusters (owner_id);
CREATE INDEX IF NOT EXISTS clusters_status_idx ON public.clusters (status);

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clusters TO authenticated;
```

## Step 3: Create Checkpoints Table

After the clusters table is created, create the checkpoints table by copying and running this SQL:

```sql
CREATE TABLE IF NOT EXISTS public.checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('completed', 'in-progress', 'pending', 'failed')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  clusterId UUID REFERENCES public.clusters(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL
);

-- Add RLS (Row Level Security) policy
ALTER TABLE public.checkpoints ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to select their own checkpoints
CREATE POLICY select_own_checkpoints ON public.checkpoints
  FOR SELECT USING (auth.uid() = owner_id);

-- Create policy to allow users to insert their own checkpoints
CREATE POLICY insert_own_checkpoints ON public.checkpoints
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Create policy to allow users to update their own checkpoints
CREATE POLICY update_own_checkpoints ON public.checkpoints
  FOR UPDATE USING (auth.uid() = owner_id);

-- Create policy to allow users to delete their own checkpoints
CREATE POLICY delete_own_checkpoints ON public.checkpoints
  FOR DELETE USING (auth.uid() = owner_id);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS checkpoints_owner_id_idx ON public.checkpoints (owner_id);
CREATE INDEX IF NOT EXISTS checkpoints_clusterId_idx ON public.checkpoints (clusterId);
CREATE INDEX IF NOT EXISTS checkpoints_status_idx ON public.checkpoints (status);

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checkpoints TO authenticated;
```

## Step 4: Verify Table Creation

1. Go to the "Table Editor" in your Supabase dashboard
2. You should see both `clusters` and `checkpoints` tables listed
3. Click on each table to verify that the columns and constraints are correctly set up

## Step 5: Set Up Environment Variables

Create or update the `.env` file in your project's root directory with your Supabase credentials:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

You can find these values in your Supabase project settings under "API" > "Project API Keys".

## Troubleshooting

If you encounter any errors during the table creation process:

- Check that the SQL syntax is valid for your Supabase version
- Ensure that the `clusters` table exists before creating the `checkpoints` table (due to the foreign key reference)
- Verify that Row Level Security (RLS) is correctly configured for both tables

For any persistent issues, please refer to the [Supabase documentation](https://supabase.com/docs) or create an issue in the project repository. 