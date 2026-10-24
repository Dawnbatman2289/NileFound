/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * NileFound Production Database Schema & Supabase RLS Policies
 * Mapped to the official engineering design specification.
 */

export const NILEFOUND_SQL_SCHEMA = `-- ==============================================================================
-- NileFound: Campus Lost & Found System Database Schema (PostgreSQL 15 / Supabase)
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Locations Table (Nile Learning City Master Reference)
CREATE TABLE IF NOT EXISTS public.locations (
    id SERIAL PRIMARY KEY,
    building_name VARCHAR(100) UNIQUE NOT NULL,
    cluster_zone VARCHAR(50) DEFAULT 'main_campus',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Official Nile University Locations
INSERT INTO public.locations (building_name, cluster_zone) VALUES
('Ubangi House (STEM Laboratories & Environmental Sciences)', 'stem_cluster'),
('Limpopo Bay (Faculty of Law & Postgraduate Studies)', 'admin_law_cluster'),
('Niger House (Faculty of Arts & Social Sciences)', 'admin_law_cluster'),
('Nile House (Registry, Bursary, ICT & Security Admin)', 'admin_law_cluster'),
('Volta Academic Building', 'stem_cluster'),
('Congo House', 'stem_cluster'),
('Central Nile Library (Ground & 1st Floor)', 'academic_cluster'),
('Nile Student Centre & Student Services Centre (Room 101)', 'admin_law_cluster'),
('Male Hostel Block A (Undergraduate)', 'residential_cluster'),
('Male Hostel Block B', 'residential_cluster'),
('Female Hostel Block A', 'residential_cluster'),
('Female Hostel Block B', 'residential_cluster'),
('Picnic Arena & Food Court', 'student_cluster'),
('Sports Complex & Football Pitch', 'student_cluster'),
('Main Campus Gate Security Post', 'security_cluster')
ON CONFLICT (building_name) DO NOTHING;

-- 3. Users Profile Table (Extends auth.users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20),
    role VARCHAR(20) DEFAULT 'student' CHECK (role IN ('student', 'staff', 'admin', 'security')),
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Items Table (Main Lost & Found Registry)
CREATE TABLE IF NOT EXISTS public.items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type VARCHAR(10) NOT NULL CHECK (type IN ('LOST', 'FOUND')),
    category VARCHAR(50) NOT NULL,
    title VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    location_id INT REFERENCES public.locations(id) ON DELETE SET NULL,
    location_text VARCHAR(150),
    date_event TIMESTAMPTZ NOT NULL,
    holding_type VARCHAR(30) DEFAULT 'WITH_FINDER' CHECK (holding_type IN ('WITH_FINDER', 'DROPPED_AT_SECURITY', 'STUDENT_AFFAIRS', 'LIBRARY_DESK')),
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CLAIM_PENDING', 'VERIFIED', 'RETURNED', 'EXPIRED')),
    photo_url TEXT,
    is_sensitive BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Verification Questions Table (Private Anti-Theft Attribute)
CREATE TABLE IF NOT EXISTS public.verification_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID UNIQUE NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    answer_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Claims Table (Claim Submissions & Approvals)
CREATE TABLE IF NOT EXISTS public.claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    claimant_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    submitted_answer TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    match_score NUMERIC(5,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES public.users(id)
);

-- ==============================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- Locations: Publicly readable for campus building dropdowns
CREATE POLICY "Locations are publicly readable" 
ON public.locations FOR SELECT 
TO public 
USING (true);

-- Items Policy: Active items viewable by authenticated users
CREATE POLICY "Public items are viewable by authenticated users" 
ON public.items FOR SELECT 
TO authenticated 
USING (status IN ('ACTIVE', 'CLAIM_PENDING', 'VERIFIED', 'RETURNED'));

-- Items Insert: Authenticated user can report an item
CREATE POLICY "Users can report items" 
ON public.items FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = reporter_id);

-- Items Update: Reporter or Admin can update item
CREATE POLICY "Reporters and Admins can update items" 
ON public.items FOR UPDATE 
TO authenticated 
USING (
    reporter_id = auth.uid() 
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true))
);

-- Verification Questions: Private to reporter and Admin
CREATE POLICY "Verification questions private to reporter and admin" 
ON public.verification_questions FOR SELECT 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.items 
        WHERE items.id = verification_questions.item_id 
        AND (
            items.reporter_id = auth.uid() 
            OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true))
        )
    )
);

-- Claims Policy: Viewable by claimant, item reporter, or admin
CREATE POLICY "Claims viewable by claimant, item reporter, and admin" 
ON public.claims FOR SELECT 
TO authenticated 
USING (
    claimant_id = auth.uid() 
    OR EXISTS (
        SELECT 1 FROM public.items 
        WHERE items.id = claims.item_id AND items.reporter_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true))
);

-- User Profiles: Protect phone numbers and private PII under NDPA 2023
CREATE POLICY "Users read own profile" 
ON public.users FOR SELECT 
TO authenticated 
USING (
    id = auth.uid() 
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true))
);
`;
