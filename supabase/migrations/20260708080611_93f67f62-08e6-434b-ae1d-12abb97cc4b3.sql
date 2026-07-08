
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_wallet_transactions;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_wallets;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vtc_wallets;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vtc_wallet_transactions;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vtc_recharge_requests;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

ALTER TABLE public.driver_wallets REPLICA IDENTITY FULL;
ALTER TABLE public.driver_wallet_transactions REPLICA IDENTITY FULL;
ALTER TABLE public.vtc_wallets REPLICA IDENTITY FULL;
ALTER TABLE public.vtc_wallet_transactions REPLICA IDENTITY FULL;
ALTER TABLE public.vtc_recharge_requests REPLICA IDENTITY FULL;
