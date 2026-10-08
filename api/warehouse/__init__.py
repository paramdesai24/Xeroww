"""Typed contracts for analytical warehouse ingestion."""

from api.warehouse.analytics_repository import (
    DEFAULT_FEATURE_QUERY_LIMIT,
    MAX_FEATURE_QUERY_LIMIT,
    AnalyticsRepositoryError,
    ConnectorWarehouseQueryClient,
    InvalidAnalyticsQueryError,
    MalformedWarehouseRowError,
    MarketFeatureAnalyticsRepository,
    MarketFeatureAnalyticsRow,
    WarehouseQueryClient,
    WarehouseQueryError,
    WarehouseUnavailableError,
    normalize_analytics_symbol,
    normalize_analytics_time,
    validate_analytics_time_range,
    validate_feature_query_limit,
)
from api.warehouse.feature_batches import (
    FeatureBatchValidationError,
    ValidatedFeatureBatch,
    ValidatedSourceFile,
    validate_feature_batch,
)
from api.warehouse.ingestion import (
    BeginLoadRequest,
    InMemoryWarehouseIngestion,
    LoadSnapshot,
    LoadState,
    MergeAccounting,
    WarehouseIngestionProtocol,
    WarehouseLifecycleError,
    WarehouseLoadHandle,
)
from api.warehouse.market_features import (
    FEATURE_CONTRACT_VERSION,
    MarketFeatureRecord,
    extract_feature_batch_id,
)
from api.warehouse.snowflake_config import (
    SnowflakeConfig,
    SnowflakeConfigurationError,
)
from api.warehouse.snowflake_ingestion import (
    SnowflakeLoadCollisionError,
    SnowflakeWarehouseIngestion,
)

__all__ = [
    "DEFAULT_FEATURE_QUERY_LIMIT",
    "FEATURE_CONTRACT_VERSION",
    "MAX_FEATURE_QUERY_LIMIT",
    "AnalyticsRepositoryError",
    "BeginLoadRequest",
    "ConnectorWarehouseQueryClient",
    "FeatureBatchValidationError",
    "InMemoryWarehouseIngestion",
    "InvalidAnalyticsQueryError",
    "LoadSnapshot",
    "LoadState",
    "MalformedWarehouseRowError",
    "MarketFeatureAnalyticsRepository",
    "MarketFeatureAnalyticsRow",
    "MarketFeatureRecord",
    "MergeAccounting",
    "SnowflakeConfig",
    "SnowflakeConfigurationError",
    "SnowflakeLoadCollisionError",
    "SnowflakeWarehouseIngestion",
    "ValidatedFeatureBatch",
    "ValidatedSourceFile",
    "WarehouseIngestionProtocol",
    "WarehouseLifecycleError",
    "WarehouseLoadHandle",
    "WarehouseQueryClient",
    "WarehouseQueryError",
    "WarehouseUnavailableError",
    "extract_feature_batch_id",
    "normalize_analytics_symbol",
    "normalize_analytics_time",
    "validate_analytics_time_range",
    "validate_feature_batch",
    "validate_feature_query_limit",
]
