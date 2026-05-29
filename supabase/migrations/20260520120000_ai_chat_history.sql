-- AI-Chat-Historie: server-side Speicherung
CREATE TABLE IF NOT EXISTS public.ai_chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  title text,
  message_count int NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS ai_chat_sessions_updated_at_idx
  ON public.ai_chat_sessions (updated_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.ai_chat_sessions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  tool_names jsonb
);

CREATE INDEX IF NOT EXISTS ai_chat_messages_session_idx
  ON public.ai_chat_messages (session_id, created_at ASC);

CREATE INDEX IF NOT EXISTS ai_chat_messages_content_search_idx
  ON public.ai_chat_messages USING gin (to_tsvector('german', content));

CREATE OR REPLACE FUNCTION public.touch_ai_chat_session()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.ai_chat_sessions
  SET updated_at = now(),
      message_count = COALESCE(message_count, 0) + 1
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ai_chat_messages_touch_session ON public.ai_chat_messages;
CREATE TRIGGER ai_chat_messages_touch_session
  AFTER INSERT ON public.ai_chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_ai_chat_session();

ALTER TABLE public.ai_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;
