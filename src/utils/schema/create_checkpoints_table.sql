-- Create the checkpoints table
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