-- Create the profiles table
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  plan TEXT NOT NULL DEFAULT 'Seedling' CHECK (plan IN ('Seedling', 'Gardener', 'Botanist')),
  usage_count INTEGER NOT NULL DEFAULT 0,
  last_reset_month INTEGER NOT NULL DEFAULT EXTRACT(MONTH FROM CURRENT_DATE),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own profile
CREATE POLICY "Users can view own profile" 
  ON public.profiles 
  FOR SELECT 
  USING (auth.uid() = id);

-- Policy: Users can insert their own profile
-- This is necessary because the frontend explicitly inserts a row if it doesn't exist
CREATE POLICY "Users can insert own profile" 
  ON public.profiles 
  FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Policy: Users can update their own profile
-- This is necessary because the frontend updates usage_count after an identification
CREATE POLICY "Users can update own profile" 
  ON public.profiles 
  FOR UPDATE 
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
