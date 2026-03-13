-- Create e1xp_rewards table
CREATE TABLE IF NOT EXISTS public.e1xp_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  amount TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  claimed BOOLEAN DEFAULT false,
  claimed_at TIMESTAMP WITH TIME ZONE,
  reminder_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_e1xp_rewards_user_id ON public.e1xp_rewards(user_id);

-- Create index on claimed status
CREATE INDEX IF NOT EXISTS idx_e1xp_rewards_claimed ON public.e1xp_rewards(claimed);

-- Enable RLS
ALTER TABLE public.e1xp_rewards ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to read their own rewards
CREATE POLICY "Users can read their own e1xp rewards"
  ON public.e1xp_rewards
  FOR SELECT
  USING (true);

-- Create policy to allow service role to insert/update
CREATE POLICY "Service role can manage e1xp rewards"
  ON public.e1xp_rewards
  FOR ALL
  USING (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_e1xp_rewards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_e1xp_rewards_updated_at
  BEFORE UPDATE ON public.e1xp_rewards
  FOR EACH ROW
  EXECUTE FUNCTION update_e1xp_rewards_updated_at();
