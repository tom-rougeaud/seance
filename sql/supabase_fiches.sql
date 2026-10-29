-- ════════════════════════════════════════════════════════════════════
--  FICHES · séances & séquences de maths — schéma Supabase (v1)
--  À exécuter UNE FOIS dans Supabase › SQL Editor › New query › Run.
--  Ne touche à aucune table existante (progress, profiles, fm_*, lm_*, mm_*, fls*).
--  Toutes les tables ont le préfixe fs_ ; chaque ligne appartient à un compte (RLS).
-- ════════════════════════════════════════════════════════════════════

-- ── utilitaire : date de dernière modification ──────────────────────
create or replace function public.fs_touch() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ── réglages (une ligne par compte) ─────────────────────────────────
create table if not exists public.fs_settings (
  user_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ── classes ─────────────────────────────────────────────────────────
create table if not exists public.fs_classes (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nom            text not null check (char_length(nom) between 1 and 80),
  niveau_id      text not null check (niveau_id in ('pm','cap','bp2','bp1','bpt')),
  groupement     text check (groupement is null or groupement in ('A','B','C','1','2')),
  avec_pc        boolean not null default true,      -- spécialité avec physique-chimie ?
  poursuite      boolean not null default false,     -- programme complémentaire (Tle)
  metier         text not null default '',           -- ancrage métier (ex. relation client)
  annee_scolaire text not null,                      -- ex. 2026-2027
  couleur        text not null default '#2B4C7E',
  creneaux       jsonb not null default '[]'::jsonb, -- [{jour:1..5, debut:'08:00', duree:120}]
  notes          text not null default '',
  archive        boolean not null default false,
  ordre          integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ── séquences ───────────────────────────────────────────────────────
create table if not exists public.fs_sequences (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  class_id    uuid not null references public.fs_classes(id) on delete cascade,
  ordre       integer not null default 0,
  titre       text not null default '',
  statut      text not null default 'brouillon' check (statut in ('brouillon','prete','en_cours','faite')),
  date_debut  date,
  date_fin    date,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── séances ─────────────────────────────────────────────────────────
create table if not exists public.fs_seances (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  class_id      uuid not null references public.fs_classes(id) on delete cascade,
  sequence_id   uuid references public.fs_sequences(id) on delete set null,
  jumelle_id    uuid references public.fs_seances(id) on delete set null, -- séance jumelle (autre demi-groupe)
  ordre         integer not null default 0,
  titre         text not null default '',
  type          text not null default 'cours' check (type in
                ('cours','activite','exercices','automatismes','evaluation','revision','ap','projet','dm','autre')),
  modalite      text not null default 'classe' check (modalite in
                ('classe','demi_groupe','demi_groupes_paralleles','co_intervention','salle_info','autre')),
  groupe        text check (groupe is null or groupe in ('G1','G2')),
  duree_min     integer not null default 55 check (duree_min between 0 and 600),
  date_prevue   date,
  date_realisee date,
  statut        text not null default 'a_faire' check (statut in ('a_faire','prete','faite','annulee','reportee')),
  data          jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── éléments du référentiel liés à une séance ou une séquence ───────
create table if not exists public.fs_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  class_id    uuid not null references public.fs_classes(id) on delete cascade,
  parent_type text not null check (parent_type in ('seance','sequence')),
  parent_id   uuid not null,
  kind        text not null check (kind in ('o','k','a','p')), -- objectif, connaissance, automatisme, perso
  ref_id      text not null,                                   -- identifiant du référentiel (ou perso)
  txt         text not null default '',                        -- texte au moment du cochage
  niveau      text not null default 'entrainement' check (niveau in ('decouverte','entrainement','maitrise','evaluation')),
  created_at  timestamptz not null default now()
);

-- ── éléments ajoutés / renommés / masqués par l'enseignant(e) ───────
create table if not exists public.fs_ref_perso (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  action      text not null check (action in ('add','rename','hide')),
  niveau_id   text not null,
  chapitre_id text,             -- null = niveau entier (ex. automatisme perso)
  kind        text not null check (kind in ('o','k','a','chapitre')),
  ref_id      text,             -- cible pour rename / hide ; identifiant propre pour add
  domaine     text,             -- pour un chapitre perso
  txt         text not null default '',
  ordre       integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── ressources (PDF, liens, vidéos, images, fichiers) ───────────────
create table if not exists public.fs_ressources (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type         text not null check (type in ('pdf','lien','video','image','casier','fichier')),
  titre        text not null default '',
  url          text,                      -- lien externe
  storage_path text,                      -- chemin dans le bucket fiches-ressources
  mime         text,
  taille       bigint not null default 0,
  tags         text[] not null default '{}',
  note         text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint fs_ressources_source check (url is not null or storage_path is not null)
);

create table if not exists public.fs_attachments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  parent_type  text not null check (parent_type in ('seance','sequence')),
  parent_id    uuid not null,
  ressource_id uuid not null references public.fs_ressources(id) on delete cascade,
  usage        text not null default 'prof' check (usage in ('prof','eleve','projete','dm','evaluation')),
  ordre        integer not null default 0,
  note         text not null default '',
  created_at   timestamptz not null default now()
);

-- ── calendrier (vacances, fériés, PFMP, examens…) ───────────────────
create table if not exists public.fs_calendrier (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  annee_scolaire text not null,
  class_id       uuid references public.fs_classes(id) on delete cascade, -- null = toutes les classes
  type           text not null default 'autre' check (type in ('vacances','ferie','pfmp','examen','sortie','autre')),
  label          text not null default '',
  debut          date not null,
  fin            date not null,
  created_at     timestamptz not null default now(),
  constraint fs_calendrier_ordre check (fin >= debut)
);

-- ── statut forcé à la main dans la progression ──────────────────────
create table if not exists public.fs_progress_override (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  class_id         uuid not null references public.fs_classes(id) on delete cascade,
  ref_id           text not null,
  statut           smallint not null check (statut between 0 and 3), -- 0 non commencé · 1 en cours · 2 en révision · 3 maîtrisé
  date_realisation date,
  note             text not null default '',
  updated_at       timestamptz not null default now(),
  unique (user_id, class_id, ref_id)
);

-- ── modèles de séance / de séquence ─────────────────────────────────
create table if not exists public.fs_modeles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('seance','sequence')),
  titre       text not null default '',
  niveau_id   text,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── index ───────────────────────────────────────────────────────────
create index if not exists fs_classes_user       on public.fs_classes(user_id, annee_scolaire);
create index if not exists fs_sequences_class    on public.fs_sequences(class_id, ordre);
create index if not exists fs_seances_class      on public.fs_seances(class_id, date_prevue);
create index if not exists fs_seances_seq        on public.fs_seances(sequence_id, ordre);
create index if not exists fs_seances_user_date  on public.fs_seances(user_id, date_prevue);
create index if not exists fs_items_parent       on public.fs_items(parent_type, parent_id);
create index if not exists fs_items_class_ref     on public.fs_items(class_id, ref_id);
create index if not exists fs_attach_parent      on public.fs_attachments(parent_type, parent_id);
create index if not exists fs_attach_ressource   on public.fs_attachments(ressource_id);
create index if not exists fs_calendrier_user    on public.fs_calendrier(user_id, annee_scolaire);
create index if not exists fs_refperso_user      on public.fs_ref_perso(user_id, niveau_id);

-- ── dates de modification automatiques ──────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['fs_settings','fs_classes','fs_sequences','fs_seances','fs_ref_perso','fs_ressources','fs_progress_override','fs_modeles'] loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.fs_touch()', t, t);
  end loop;
end $$;

-- ── sécurité : chaque compte ne voit et ne modifie que ses lignes ───
do $$
declare t text;
begin
  foreach t in array array['fs_settings','fs_classes','fs_sequences','fs_seances','fs_items','fs_ref_perso',
                           'fs_ressources','fs_attachments','fs_calendrier','fs_progress_override','fs_modeles'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t||'_own', t);
    execute format($p$create policy %I on public.%I for all to authenticated
                      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))$p$, t||'_own', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- ── remplace d'un coup les éléments cochés d'une séance / séquence ──
create or replace function public.fs_set_items(p_parent_type text, p_parent_id uuid, p_class_id uuid, p_items jsonb)
returns integer language plpgsql security invoker set search_path = public as $$
declare n integer;
begin
  if p_parent_type not in ('seance','sequence') then raise exception 'parent_type invalide'; end if;
  delete from fs_items where parent_type = p_parent_type and parent_id = p_parent_id and user_id = auth.uid();
  insert into fs_items (class_id, parent_type, parent_id, kind, ref_id, txt, niveau)
  select p_class_id, p_parent_type, p_parent_id,
         coalesce(e->>'kind','p'), coalesce(e->>'ref',''), left(coalesce(e->>'txt',''), 600),
         coalesce(nullif(e->>'niveau',''),'entrainement')
  from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) e;
  get diagnostics n = row_count;
  return n;
end $$;

-- ── effacement complet des données de l'application (RGPD) ──────────
-- Renvoie les chemins de fichiers à supprimer dans le Storage (fait par l'appli).
create or replace function public.fs_effacer_mes_donnees()
returns text[] language plpgsql security invoker set search_path = public as $$
declare chemins text[];
begin
  select coalesce(array_agg(storage_path), '{}') into chemins
    from fs_ressources where user_id = auth.uid() and storage_path is not null;
  delete from fs_attachments        where user_id = auth.uid();
  delete from fs_items              where user_id = auth.uid();
  delete from fs_progress_override  where user_id = auth.uid();
  delete from fs_calendrier         where user_id = auth.uid();
  delete from fs_seances            where user_id = auth.uid();
  delete from fs_sequences          where user_id = auth.uid();
  delete from fs_ressources         where user_id = auth.uid();
  delete from fs_modeles            where user_id = auth.uid();
  delete from fs_ref_perso          where user_id = auth.uid();
  delete from fs_classes            where user_id = auth.uid();
  delete from fs_settings           where user_id = auth.uid();
  return chemins;
end $$;

grant execute on function public.fs_set_items(text, uuid, uuid, jsonb) to authenticated;
grant execute on function public.fs_effacer_mes_donnees() to authenticated;
revoke execute on function public.fs_set_items(text, uuid, uuid, jsonb) from anon, public;
revoke execute on function public.fs_effacer_mes_donnees() from anon, public;

-- ── stockage des PDF / images / fichiers (bucket privé) ─────────────
insert into storage.buckets (id, name, public, file_size_limit)
values ('fiches-ressources', 'fiches-ressources', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;

drop policy if exists fs_storage_select on storage.objects;
drop policy if exists fs_storage_insert on storage.objects;
drop policy if exists fs_storage_update on storage.objects;
drop policy if exists fs_storage_delete on storage.objects;
create policy fs_storage_select on storage.objects for select to authenticated
  using (bucket_id = 'fiches-ressources' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy fs_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'fiches-ressources' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy fs_storage_update on storage.objects for update to authenticated
  using (bucket_id = 'fiches-ressources' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy fs_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'fiches-ressources' and (storage.foldername(name))[1] = (select auth.uid())::text);
