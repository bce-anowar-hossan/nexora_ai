begin;

-- DEV-007 customer and order changes must also be recorded.
do $block$
declare
  target_table text;
  target_tables text[] := array[
    'customers',
    'orders',
    'order_items'
  ];
begin
  foreach target_table in array target_tables loop
    if to_regclass(format('public.%I', target_table)) is not null then
      execute format(
        'drop trigger if exists capture_company_audit on public.%I',
        target_table
      );

      execute format(
        'create trigger capture_company_audit
         after insert or update or delete on public.%I
         for each row execute function public.capture_company_audit_log()',
        target_table
      );
    end if;
  end loop;
end;
$block$;

commit;
