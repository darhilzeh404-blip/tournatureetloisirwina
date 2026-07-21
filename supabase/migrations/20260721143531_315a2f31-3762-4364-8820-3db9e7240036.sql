ALTER TABLE public.catalog_vehicles
  DROP CONSTRAINT catalog_vehicles_category_id_fkey,
  ADD CONSTRAINT catalog_vehicles_category_id_fkey
    FOREIGN KEY (category_id)
    REFERENCES public.catalog_vehicle_categories(id)
    ON DELETE RESTRICT;