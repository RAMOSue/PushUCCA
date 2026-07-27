export type InventoryUnit = {
  id: string | number;
  unit_number?: string | null;
  size?: string | null;
  status?: string | null;
};

export type InventoryItem = {
  id: string | number;
  name: string;
  category?: string | null;
  collection_group?: string | null;
  description?: string | null;
  image_url?: string | null;
  quantity?: number | null;
  qty_small?: number | null;
  qty_medium?: number | null;
  qty_large?: number | null;
  units?: InventoryUnit[];
  garment_type?: string | null;
  accessory_type?: string | null;
  instrument_type?: string | null;
};

export type InventoryRecommendation = {
  inventory_item_id: string | number;
  performance_title?: string | null;
  start_time?: string | null;
};