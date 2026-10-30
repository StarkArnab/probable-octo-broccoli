\set ON_ERROR_STOP on
begin;
-- Invoker privileges are intentional: the assertions must exercise SET ROLE.
create function public.expect_sql(label text, statement text, expected_state text, expected_rows bigint default null)
returns void language plpgsql security invoker as $$
declare actual_rows bigint; actual_state text := '00000';
begin
 begin
  execute statement;
  get diagnostics actual_rows = row_count;
 exception when others then
  get stacked diagnostics actual_state = returned_sqlstate;
 end;
 if actual_state <> expected_state then
  raise exception '%: expected SQLSTATE %, got %', label, expected_state, actual_state;
 end if;
 if expected_state = '00000' and expected_rows is not null and actual_rows <> expected_rows then
  raise exception '%: expected % rows, got %', label, expected_rows, actual_rows;
 end if;
 raise notice 'PASS: %', label;
end $$;
-- Seed both ownership domains as admin; all assertions below run without bypass.
insert into boards(id,user_id,name) values
 ('10000000-0000-0000-0000-000000000001','30485ccc-d3cf-4618-b78f-d864368baf35','Owner'),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','Other');
insert into cards(id,board_id,user_id,title) select
 ('20000000-0000-0000-0000-00000000000' || row_number() over(order by name))::uuid,id,user_id,name from boards;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"30485ccc-d3cf-4618-b78f-d864368baf35","email":"changed-owner@example.test"}',true);
select expect_sql('owner reads boards','select * from boards','00000',1);
select expect_sql('owner reads cards','select * from cards','00000',1);
select expect_sql('owner inserts board',$q$insert into boards(id,user_id,name) values ('10000000-0000-0000-0000-000000000003',auth.uid(),'Temporary')$q$,'00000',1);
select expect_sql('owner inserts card',$q$insert into cards(board_id,user_id,title) values ('10000000-0000-0000-0000-000000000003',auth.uid(),'Temporary')$q$,'00000',1);
select expect_sql('owner updates board',$q$update boards set description='updated' where name='Temporary'$q$,'00000',1);
select expect_sql('owner updates card',$q$update cards set title='Updated' where title='Temporary'$q$,'00000',1);
select expect_sql('owner deletes card',$q$delete from cards where title='Updated'$q$,'00000',1);
select expect_sql('owner deletes board',$q$delete from boards where name='Temporary'$q$,'00000',1);

-- Both USING (visibility) and WITH CHECK (new row ownership) matter.
do $$ declare t text; begin
 foreach t in array array['boards','cards'] loop
  perform expect_sql('owner cannot read foreign '||t,format('select * from %I where user_id <> auth.uid()',t),'00000',0);
  perform expect_sql('owner cannot update foreign '||t,format('update %I set user_id=auth.uid() where user_id <> auth.uid()',t),'00000',0);
  perform expect_sql('owner cannot delete foreign '||t,format('delete from %I where user_id <> auth.uid()',t),'00000',0);
  perform expect_sql('owner cannot reassign '||t,format('update %I set user_id=%L where user_id=auth.uid()',t,'00000000-0000-0000-0000-000000000002'),'42501');
 end loop;
end $$;
select expect_sql('forged board owner',$q$insert into boards(user_id,name) values ('00000000-0000-0000-0000-000000000002','Forged')$q$,'42501');
select expect_sql('forged card owner',$q$insert into cards(board_id,user_id,title) values ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','Forged')$q$,'42501');
select expect_sql('composite FK rejects insert across board owners',$q$insert into cards(board_id,user_id,title) values ('10000000-0000-0000-0000-000000000002',auth.uid(),'Mismatch')$q$,'23503');
select expect_sql('composite FK rejects moving card across board owners',$q$update cards set board_id='10000000-0000-0000-0000-000000000002' where user_id=auth.uid()$q$,'23503');

-- Spoof the legacy permitted email: migration 002 must bind the fixed UUID.
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000002","email":"rockarnab367@gmail.com"}',true);
do $$ declare t text; begin
 foreach t in array array['boards','cards'] loop
  perform expect_sql('nonowner reads '||t,format('select * from %I',t),'00000',0);
  perform expect_sql('nonowner updates '||t,format('update %I set user_id=user_id',t),'00000',0);
  perform expect_sql('nonowner deletes '||t,format('delete from %I',t),'00000',0);
 end loop;
end $$;
select expect_sql('nonowner inserts own board',$q$insert into boards(user_id,name) values (auth.uid(),'No')$q$,'42501');
select expect_sql('nonowner inserts own card',$q$insert into cards(board_id,user_id,title) values ('10000000-0000-0000-0000-000000000002',auth.uid(),'No')$q$,'42501');
select expect_sql('nonowner forges owner board',$q$insert into boards(user_id,name) values ('30485ccc-d3cf-4618-b78f-d864368baf35','No')$q$,'42501');
select expect_sql('nonowner forges owner card',$q$insert into cards(board_id,user_id,title) values ('10000000-0000-0000-0000-000000000001','30485ccc-d3cf-4618-b78f-d864368baf35','No')$q$,'42501');

set local role anon;
select set_config('request.jwt.claims','{}',true);
do $$ declare t text; begin
 foreach t in array array['boards','cards'] loop
  perform expect_sql('anonymous SELECT grant '||t,format('select * from %I',t),'42501');
  perform expect_sql('anonymous UPDATE grant '||t,format('update %I set user_id=user_id',t),'42501');
  perform expect_sql('anonymous DELETE grant '||t,format('delete from %I',t),'42501');
  perform expect_sql('anonymous INSERT grant '||t,format('insert into %I default values',t),'42501');
 end loop;
end $$;
-- Independently prove RLS still denies anon if table grants are later added.
reset role;
grant select,insert,update,delete on boards,cards to anon;
set local role anon;
do $$ declare t text; begin
 foreach t in array array['boards','cards'] loop
  perform expect_sql('anonymous RLS SELECT '||t,format('select * from %I',t),'00000',0);
  perform expect_sql('anonymous RLS UPDATE '||t,format('update %I set user_id=user_id',t),'00000',0);
  perform expect_sql('anonymous RLS DELETE '||t,format('delete from %I',t),'00000',0);
 end loop;
end $$;
select expect_sql('anonymous RLS INSERT board',$q$insert into boards(user_id,name) values ('30485ccc-d3cf-4618-b78f-d864368baf35','No')$q$,'42501');
select expect_sql('anonymous RLS INSERT card',$q$insert into cards(board_id,user_id,title) values ('10000000-0000-0000-0000-000000000001','30485ccc-d3cf-4618-b78f-d864368baf35','No')$q$,'42501');
rollback;
