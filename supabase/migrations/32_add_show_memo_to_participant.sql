-- 32_add_show_memo_to_participant.sql
ALTER TABLE public.transactions ADD COLUMN show_memo_to_participant BOOLEAN DEFAULT FALSE;
