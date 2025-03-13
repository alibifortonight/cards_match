-- Disable Row Level Security for development
-- In a production environment, you would want to create proper RLS policies instead

-- Disable RLS for games table
ALTER TABLE games DISABLE ROW LEVEL SECURITY;

-- Disable RLS for players table
ALTER TABLE players DISABLE ROW LEVEL SECURITY;

-- Disable RLS for rounds table
ALTER TABLE rounds DISABLE ROW LEVEL SECURITY;

-- Disable RLS for submissions table
ALTER TABLE submissions DISABLE ROW LEVEL SECURITY;

-- Disable RLS for round_scores table
ALTER TABLE round_scores DISABLE ROW LEVEL SECURITY;
