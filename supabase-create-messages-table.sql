
-- Create messages table for direct messaging between users
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id VARCHAR(255) NOT NULL,
  recipient_id VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  message_type VARCHAR(50) DEFAULT 'text',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON public.messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(sender_id, recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON public.messages(recipient_id, is_read) WHERE is_read = FALSE;

-- Enable Row Level Security
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Create policies for messages
-- Users can read their own messages (sent or received)
CREATE POLICY "Users can read their own messages"
  ON public.messages
  FOR SELECT
  USING (
    auth.uid()::text = sender_id OR 
    auth.uid()::text = recipient_id
  );

-- Users can insert messages they are sending
CREATE POLICY "Users can send messages"
  ON public.messages
  FOR INSERT
  WITH CHECK (auth.uid()::text = sender_id);

-- Users can update messages they received (mark as read)
CREATE POLICY "Users can mark received messages as read"
  ON public.messages
  FOR UPDATE
  USING (auth.uid()::text = recipient_id)
  WITH CHECK (auth.uid()::text = recipient_id);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION update_messages_updated_at();
