alter policy owner_boards on public.boards
 using ((select auth.uid())=user_id and (select auth.uid())='30485ccc-d3cf-4618-b78f-d864368baf35'::uuid)
 with check ((select auth.uid())=user_id and (select auth.uid())='30485ccc-d3cf-4618-b78f-d864368baf35'::uuid);
alter policy owner_cards on public.cards
 using ((select auth.uid())=user_id and (select auth.uid())='30485ccc-d3cf-4618-b78f-d864368baf35'::uuid)
 with check ((select auth.uid())=user_id and (select auth.uid())='30485ccc-d3cf-4618-b78f-d864368baf35'::uuid);
