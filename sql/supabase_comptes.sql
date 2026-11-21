-- ════════════════════════════════════════════════════════════════════
--  COMPTES · pseudo, mot de passe, suppression — complément du schéma Fiches (v1)
--  Auteur : Tom Rougeaud  ·  Licence : CC BY-NC 4.0
--  Réalisé avec l’aide de l’IA : Claude Sonnet 5.5 (Anthropic)
--  À exécuter UNE FOIS dans Supabase › SQL Editor › New query › Run (rejouable sans risque).
--  Prérequis : la table public.profiles (id uuid → auth.users, nom, etablissement, created_at)
--  et la fonction public.delete_user() existent déjà dans le projet.
--  Ne touche à aucun compte existant.
-- ════════════════════════════════════════════════════════════════════

-- ── 1) Pseudo de connexion (facultatif : les comptes avec e-mail restent valides) ──
alter table public.profiles add column if not exists pseudo text;
alter table public.profiles drop constraint if exists profiles_pseudo_format;
alter table public.profiles add constraint profiles_pseudo_format
  check (pseudo is null or pseudo ~ '^[a-z0-9_-]{3,20}$');        -- 3 à 20 caractères : a-z, 0-9, - et _
create unique index if not exists profiles_pseudo_unique
  on public.profiles (lower(pseudo)) where pseudo is not null;   -- un pseudo = un seul compte

-- ── 2) Vérification de disponibilité en temps réel : renvoie seulement vrai ou faux ──
create or replace function public.pseudo_disponible(p text)
returns boolean
language plpgsql
stable
security definer                              -- droits élevés : nécessaire pour lire la liste des comptes
set search_path = public, auth, pg_temp       -- fixe les schémas utilisés (protège d’un détournement)
as $$
declare v text := lower(btrim(coalesce(p, '')));   -- pseudo nettoyé : minuscules, sans espaces autour
begin
  if v !~ '^[a-z0-9_-]{3,20}$' then return false; end if;                          -- format imposé
  if v in ('admin','administrateur','prof','professeur','tom','moderateur','support','root','claude') then return false; end if; -- noms réservés
  if exists (select 1 from public.profiles where lower(pseudo) = v) then return false; end if;                                   -- déjà pris
  if exists (select 1 from auth.users where lower(email) = v || '@pseudo.invalid') then return false; end if;                    -- e-mail technique déjà utilisé
  return true;
end $$;
revoke execute on function public.pseudo_disponible(text) from public;
grant execute on function public.pseudo_disponible(text) to anon, authenticated;   -- appelée avant même de se connecter

-- ── 3) Création automatique du profil, avec recopie du pseudo choisi à l’inscription ──
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles(id, pseudo)
  values (new.id, nullif(lower(btrim(new.raw_user_meta_data->>'pseudo')), ''));
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;  -- déclencheur : jamais appelable depuis l’API

-- ── 4) Garde-fou : le pseudo ne change plus une fois posé, et les noms réservés restent interdits ──
create or replace function public.profiles_garde_pseudo()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and old.pseudo is not null and new.pseudo is distinct from old.pseudo then
    raise exception 'Le pseudo ne peut pas être modifié.';
  end if;
  if new.pseudo is not null and new.pseudo in
     ('admin','administrateur','prof','professeur','tom','moderateur','support','root','claude')
     and (tg_op = 'INSERT' or new.pseudo is distinct from old.pseudo) then
    raise exception 'Ce pseudo est réservé.';
  end if;
  return new;
end $$;
revoke execute on function public.profiles_garde_pseudo() from public, anon, authenticated;
drop trigger if exists profiles_garde_pseudo_trg on public.profiles;
create trigger profiles_garde_pseudo_trg before insert or update on public.profiles
  for each row execute function public.profiles_garde_pseudo();

-- ── 5) Suppression de son propre compte : réservée aux personnes connectées ──
alter function public.delete_user() set search_path = public, pg_temp;
revoke execute on function public.delete_user() from public, anon;
grant execute on function public.delete_user() to authenticated;

-- ── 6) Compte propriétaire : reconnu ici, côté base, et non plus par une liste dans le code public ──
--  ⚠ Remplacez ADRESSE_DU_COMPTE_PROPRIETAIRE par votre adresse AVANT d’exécuter ce script,
--  et ne publiez jamais ce fichier une fois l’adresse renseignée.
create or replace function public.est_proprietaire()
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce((auth.jwt() ->> 'email') = 'ADRESSE_DU_COMPTE_PROPRIETAIRE', false);
$$;
revoke execute on function public.est_proprietaire() from public, anon;
grant execute on function public.est_proprietaire() to authenticated;
