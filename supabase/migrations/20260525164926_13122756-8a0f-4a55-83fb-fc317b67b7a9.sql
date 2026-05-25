ALTER TABLE public.medicines
  ADD COLUMN IF NOT EXISTS purchase_price NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS selling_price NUMERIC NOT NULL DEFAULT 0;

UPDATE public.medicines SET selling_price = unit_price WHERE selling_price = 0;