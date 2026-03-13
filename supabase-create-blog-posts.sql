-- Blog posts for Showcase
create table if not exists blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  subtitle text,
  excerpt text,
  content text,
  cover_url text,
  category text,
  author_name text,
  status text not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists blog_posts_status_idx on blog_posts (status);
create index if not exists blog_posts_category_idx on blog_posts (category);
create index if not exists blog_posts_published_at_idx on blog_posts (published_at desc);
