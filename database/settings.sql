-- SKILLS (Done)
CREATE TABLE skills (
  id SERIAL PRIMARY KEY,
  category VARCHAR(100) NOT NULL,              -- e.g. "DevOps & Cloud", "Backend"
  name VARCHAR(100) NOT NULL,
  icon_slug VARCHAR(100),                      -- for devicon / simple-icons
  display_order INT DEFAULT 0,
  is_visible BOOLEAN DEFAULT true,
  UNIQUE(category, name)
);

-- WORK EXPERIENCE (Done)
CREATE TABLE experiences (
  id SERIAL PRIMARY KEY,
  company VARCHAR(255) NOT NULL,
  role VARCHAR(255) NOT NULL,
  employment_type VARCHAR(50),                 -- 'Full-time' | 'Contract' | etc.
  start_date DATE NOT NULL,
  end_date DATE,                               -- NULL = present
  description TEXT,
  location VARCHAR(255),
  company_logo_url TEXT,
  display_order INT DEFAULT 0,
  is_visible BOOLEAN DEFAULT true
);

-- PROJECTS (Done)
CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  short_description VARCHAR(500),
  long_description TEXT,
  thumbnail_url TEXT,
  live_url TEXT,
  github_url TEXT,
  tags TEXT[],                                 -- e.g. ARRAY['DevOps','AWS','Docker']
  category VARCHAR(100),                       -- 'DevOps' | 'Backend' | 'Full-Stack'
  is_featured BOOLEAN DEFAULT false,
  display_order INT DEFAULT 0,
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PROJECT IMAGES (Done)
CREATE TABLE project_images (
  id SERIAL PRIMARY KEY,
  project_id INT REFERENCES projects(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption VARCHAR(255),
  display_order INT DEFAULT 0
);

-- CERTIFICATIONS (Done)
CREATE TABLE certifications (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  issuer VARCHAR(255) NOT NULL,
  issued_date VARCHAR(20),                     -- e.g. "January 2023"
  expiry_date VARCHAR(20),                     -- e.g. "January 2026"
  credential_id VARCHAR(255),
  credential_url TEXT,
  pdf_url TEXT,                                -- GCS PDF URL
  badge_image_url TEXT,                        -- GCS image URL
  status VARCHAR(50) DEFAULT 'active',         -- 'active' | 'scheduled' | 'expired'
  display_order INT DEFAULT 0,
  is_visible BOOLEAN DEFAULT true
);

-- PUBLICATIONS / JOURNALS (Done)
CREATE TABLE publications (
  id SERIAL PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  journal_name VARCHAR(255),
  publisher VARCHAR(255),
  authors TEXT[], -- multiple authors supported
  author_linkedin_urls TEXT[], -- matching linkedin urls
  abstract TEXT,
  published_date DATE,
  doi VARCHAR(255),
  publication_url TEXT,
  pdf_url TEXT,                                -- GCS PDF URL
  thumbnail_url TEXT,
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  author_image_urls TEXT[],
  date_submitted DATE,
  date_final_revision DATE,
  date_accepted DATE,
  date_vor_online DATE,
  date_open_access DATE
);
-- ALTER TABLE publications ADD COLUMN author_image_urls TEXT[];
-- ALTER TABLE publications ADD COLUMN date_submitted DATE, ADD COLUMN date_final_revision DATE, ADD COLUMN date_accepted DATE, ADD COLUMN date_vor_online DATE, ADD COLUMN date_open_access DATE;

-- EDUCATION (Done)
CREATE TABLE education (
  id SERIAL PRIMARY KEY,
  institution VARCHAR(255) NOT NULL,
  degree VARCHAR(255) NOT NULL,
  field_of_study VARCHAR(255),
  start_year VARCHAR(10),
  end_year VARCHAR(10),
  cgpa VARCHAR(20),
  institution_logo_url TEXT,
  display_order INT DEFAULT 0,
  is_visible BOOLEAN DEFAULT true
);

-- TRAININGS (Done)
CREATE TABLE trainings (
  id SERIAL PRIMARY KEY,
  institute VARCHAR(255) NOT NULL,
  program_name VARCHAR(255) NOT NULL,
  start_date DATE,
  end_date DATE,
  certificate_url TEXT,
  is_visible BOOLEAN DEFAULT true
);

-- CONTACT MESSAGES (from visitors)
CREATE TABLE contact_messages (
  id SERIAL PRIMARY KEY,
  sender_name VARCHAR(255) NOT NULL,
  sender_email VARCHAR(255) NOT NULL,
  subject VARCHAR(500),
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AUDIT LOG
CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  admin_uid VARCHAR(128) NOT NULL,
  action VARCHAR(100) NOT NULL,               -- 'CREATE' | 'UPDATE' | 'DELETE'
  table_name VARCHAR(100) NOT NULL,
  record_id VARCHAR(100),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);