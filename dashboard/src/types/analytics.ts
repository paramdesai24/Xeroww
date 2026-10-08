export interface AnalyticalFeatureRecord {
  record_key: string;
  logical_window_key: string;
  feature_contract_version: number;
  window_start: string;
  window_end: string;
  symbol: string;
  source: string;
  observation_count: number;
  log_return: number;
  rolling_return: number | null;
  rolling_volatility: number | null;
  relative_volume: number | null;
  kafka_partitions: number[];
  max_kafka_offset: number;
  feature_batch_id: number;
  source_file: string;
  source_file_sha256: string;
  load_id: string;
  warehouse_ingested_at: string;
}

export interface AnalyticalFeatureResponse {
  symbol: string;
  start_time: string;
  end_time: string;
  count: number;
  data: AnalyticalFeatureRecord[];
}
