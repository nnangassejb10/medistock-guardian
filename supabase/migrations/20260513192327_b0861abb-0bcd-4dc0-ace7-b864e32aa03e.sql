
-- Enum for roles
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'pharmacien', 'medecin', 'gestionnaire_stock', 'caissier');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name VARCHAR(150) NOT NULL DEFAULT '',
  email VARCHAR(150) UNIQUE NOT NULL,
  phone VARCHAR(20),
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles (separate table - security best practice)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Security definer function to check role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper: get primary role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY CASE role
    WHEN 'super_admin' THEN 1
    WHEN 'admin' THEN 2
    WHEN 'pharmacien' THEN 3
    WHEN 'gestionnaire_stock' THEN 4
    WHEN 'medecin' THEN 5
    WHEN 'caissier' THEN 6
  END
  LIMIT 1
$$;

-- Categories
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  color VARCHAR(20) NOT NULL DEFAULT '#1E40AF',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Suppliers
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  contact_name VARCHAR(100),
  phone VARCHAR(20),
  email VARCHAR(100),
  address TEXT,
  country VARCHAR(80),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Medicines
CREATE TABLE public.medicines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  description TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  expiration_date DATE NOT NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  lot_number VARCHAR(100),
  location VARCHAR(100),
  min_threshold INTEGER NOT NULL DEFAULT 10,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_medicines_category ON public.medicines(category_id);
CREATE INDEX idx_medicines_expiration ON public.medicines(expiration_date);

-- Stock movements
CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_id UUID REFERENCES public.medicines(id) ON DELETE CASCADE NOT NULL,
  movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('entree','sortie','ajustement','inventaire')),
  quantity INTEGER NOT NULL,
  quantity_before INTEGER NOT NULL,
  quantity_after INTEGER NOT NULL,
  unit_price DECIMAL(12,2),
  reason TEXT,
  reference VARCHAR(100),
  performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_movements_medicine ON public.stock_movements(medicine_id);
CREATE INDEX idx_movements_created ON public.stock_movements(created_at DESC);

-- Audit logs
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  table_name VARCHAR(100),
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_user ON public.audit_logs(user_id);
CREATE INDEX idx_audit_created ON public.audit_logs(created_at DESC);

-- Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(30) NOT NULL DEFAULT 'info' CHECK (type IN ('info','warning','danger','success')),
  is_read BOOLEAN NOT NULL DEFAULT false,
  related_medicine_id UUID REFERENCES public.medicines(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Login history
CREATE TABLE public.login_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  ip_address VARCHAR(45),
  user_agent TEXT,
  success BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger: auto profile + first user becomes super_admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INTEGER;
  assigned_role app_role;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );

  SELECT COUNT(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN
    assigned_role := 'super_admin';
  ELSE
    assigned_role := 'medecin';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: update medicine quantity on stock movement
CREATE OR REPLACE FUNCTION public.apply_stock_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_qty INTEGER;
  new_qty INTEGER;
BEGIN
  SELECT quantity INTO current_qty FROM public.medicines WHERE id = NEW.medicine_id FOR UPDATE;
  IF current_qty IS NULL THEN
    RAISE EXCEPTION 'Médicament introuvable';
  END IF;

  IF NEW.movement_type = 'entree' THEN
    new_qty := current_qty + NEW.quantity;
  ELSIF NEW.movement_type = 'sortie' THEN
    IF current_qty < NEW.quantity THEN
      RAISE EXCEPTION 'Stock insuffisant (disponible: %, demandé: %)', current_qty, NEW.quantity;
    END IF;
    new_qty := current_qty - NEW.quantity;
  ELSIF NEW.movement_type IN ('ajustement','inventaire') THEN
    new_qty := NEW.quantity;
  END IF;

  NEW.quantity_before := current_qty;
  NEW.quantity_after := new_qty;

  UPDATE public.medicines SET quantity = new_qty, updated_at = now() WHERE id = NEW.medicine_id;

  -- Alerte rupture
  IF new_qty <= (SELECT min_threshold FROM public.medicines WHERE id = NEW.medicine_id) THEN
    INSERT INTO public.notifications (user_id, title, message, type, related_medicine_id)
    SELECT p.id,
      'Stock faible',
      'Le médicament ' || m.name || ' atteint son seuil minimal (' || new_qty || ' unités)',
      'warning',
      m.id
    FROM public.medicines m
    CROSS JOIN public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE m.id = NEW.medicine_id
      AND ur.role IN ('super_admin','admin','pharmacien','gestionnaire_stock');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_apply_stock_movement
  BEFORE INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.apply_stock_movement();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_medicines_updated BEFORE UPDATE ON public.medicines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;

-- RLS: Profiles
CREATE POLICY "Authenticated can view profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins update any profile" ON public.profiles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

-- RLS: user_roles
CREATE POLICY "Authenticated view roles" ON public.user_roles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- RLS: categories (everyone read, admin/pharmacien write)
CREATE POLICY "Authenticated view categories" ON public.categories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff manage categories" ON public.categories
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'pharmacien'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'pharmacien'));

-- RLS: suppliers
CREATE POLICY "Authenticated view suppliers" ON public.suppliers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff manage suppliers" ON public.suppliers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'pharmacien'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'pharmacien'));

-- RLS: medicines
CREATE POLICY "Authenticated view medicines" ON public.medicines
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff insert medicines" ON public.medicines
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'pharmacien'));
CREATE POLICY "Staff update medicines" ON public.medicines
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'pharmacien') OR public.has_role(auth.uid(),'gestionnaire_stock'));
CREATE POLICY "Admins delete medicines" ON public.medicines
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

-- RLS: stock_movements
CREATE POLICY "Authenticated view movements" ON public.stock_movements
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff create movements" ON public.stock_movements
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'pharmacien') OR public.has_role(auth.uid(),'gestionnaire_stock')
    OR (public.has_role(auth.uid(),'medecin') AND movement_type = 'sortie')
  );

-- RLS: audit logs (admin only read)
CREATE POLICY "Admins view audit" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "System inserts audit" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- RLS: notifications
CREATE POLICY "Users view own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "System inserts notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);

-- RLS: login_history
CREATE POLICY "Admins view login history" ON public.login_history
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin') OR auth.uid() = user_id);
CREATE POLICY "System inserts login" ON public.login_history
  FOR INSERT TO authenticated WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.medicines;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_movements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Seed categories
INSERT INTO public.categories (name, color) VALUES
  ('Antibiotiques', '#3B82F6'),
  ('Analgésiques', '#10B981'),
  ('Antipaludéens', '#F59E0B'),
  ('Vitamines', '#8B5CF6'),
  ('Antiviraux', '#EF4444'),
  ('Antiseptiques', '#06B6D4'),
  ('Matériel médical', '#64748B');

-- Seed suppliers
INSERT INTO public.suppliers (name, contact_name, phone, email, country) VALUES
  ('PharmaGabon SA', 'Jean Mboumba', '+241 01 23 45 67', 'contact@pharmagabon.ga', 'Gabon'),
  ('MediAfrique', 'Marie Ondo', '+241 02 34 56 78', 'info@mediafrique.com', 'Cameroun'),
  ('Sanofi Distrib', 'Paul Nguema', '+241 03 45 67 89', 'sanofi@distrib.fr', 'France');
