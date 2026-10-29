set client_min_messages = warning;
insert into auth.users(id) values ('11111111-1111-1111-1111-111111111111'),('22222222-2222-2222-2222-222222222222');
grant select,insert,update,delete on all tables in schema public to authenticated;
grant select,insert,update,delete on all tables in schema storage to authenticated;
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
insert into fs_classes(nom,niveau_id,annee_scolaire) values ('2MRCU','bp2','2026-2027') returning id \gset a_
insert into fs_sequences(class_id,titre) values (:'a_id','Proportionnalité') returning id \gset s_
insert into fs_seances(class_id,sequence_id,titre) values (:'a_id',:'s_id','Séance 1') returning id \gset e_
select fs_set_items('seance',:'e_id',:'a_id','[{"kind":"o","ref":"bp2.fonc.o1","txt":"Exploiter","niveau":"decouverte"},{"kind":"p","ref":"perso1","txt":"Mon item"}]'::jsonb) as nb_items;
select fs_set_items('seance',:'e_id',:'a_id','[{"kind":"o","ref":"bp2.fonc.o2","txt":"Autre"}]'::jsonb) as nb_items_apres_remplacement;
select count(*) as items_user1 from fs_items;
insert into storage.objects(bucket_id,name) values ('fiches-ressources','11111111-1111-1111-1111-111111111111/cours.pdf');
-- user 2 : ne voit rien
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
select (select count(*) from fs_classes) as classes_vues_par_user2, (select count(*) from fs_seances) as seances_vues_user2, (select count(*) from fs_items) as items_vus_user2;
-- user 2 tente d'écrire au nom de user 1 -> doit être refusé
do $$ declare refuse boolean := false; begin
  begin insert into fs_classes(nom,niveau_id,annee_scolaire,user_id) values ('intrus','pm','2026-2027','11111111-1111-1111-1111-111111111111');
  exception when others then refuse := true; end;
  if not refuse then raise exception 'FAILLE : écriture usurpée (classe)'; end if;
  refuse := false;
  begin insert into storage.objects(bucket_id,name) values ('fiches-ressources','11111111-1111-1111-1111-111111111111/intrus.pdf');
  exception when others then refuse := true; end;
  if not refuse then raise exception 'FAILLE : stockage usurpé'; end if;
  refuse := false;
end $$;
-- user 1 : effacement complet
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
insert into fs_ressources(type,titre,storage_path) values ('pdf','Cours','11111111-1111-1111-1111-111111111111/cours.pdf');
select fs_effacer_mes_donnees() as chemins_a_supprimer;
select (select count(*) from fs_classes) c,(select count(*) from fs_seances) s,(select count(*) from fs_items) i,(select count(*) from fs_ressources) r;
-- anon : aucun accès
reset role; set role anon;
do $$ declare refuse boolean := false; begin begin perform 1 from fs_classes; exception when insufficient_privilege then refuse := true; end; if not refuse then raise exception 'FAILLE anon'; end if; end $$;

select 'TOUS LES TESTS RLS PASSENT' as resultat;
