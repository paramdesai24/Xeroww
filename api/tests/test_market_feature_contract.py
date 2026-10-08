"""Focused tests for the Spark-to-warehouse market feature contract."""

from copy import deepcopy
from datetime import UTC

import pytest
from pydantic import ValidationError

from api.warehouse.market_features import (
    FEATURE_CONTRACT_VERSION,
    MarketFeatureRecord,
    extract_feature_batch_id,
)

SOURCE_FILE = "/opt/spark/output/features/batch_id=116/part-00000-example-c000.json"


@pytest.fixture
def spark_feature() -> dict:
    return {
        "window_start": "2026-10-06T17:02:00.000Z",
        "window_end": "2026-10-06T17:07:00.000Z",
        "symbol": "RELIANCE.NS",
        "source": "yahoo",
        "observation_count": 5,
        "log_return": 0.026286657446119903,
        "rolling_return": 0.0,
        "rolling_volatility": 0.0,
        "relative_volume": 1.0,
        "kafka_partitions": [4],
        "max_kafka_offset": 2001,
    }


def build_record(payload: dict, **overrides) -> MarketFeatureRecord:
    metadata = {
        "source_file": SOURCE_FILE,
        "source_file_sha256": "a" * 64,
        "load_id": "load-batch-116",
        **overrides,
    }
    return MarketFeatureRecord.from_spark_json(payload, **metadata)


def test_valid_real_world_batch_116_record(spark_feature):
    record = build_record(spark_feature)

    assert record.feature_contract_version == FEATURE_CONTRACT_VERSION
    assert record.feature_batch_id == 116
    assert record.symbol == "RELIANCE.NS"
    assert record.kafka_partitions == (4,)
    assert record.logical_window_key == "60c9fbbaae3baa07597bd4e9e09da02cf4fe6e66a3b1ad5477cabb96ad15decb"
    assert record.record_key == "566917e3e6f3a76fb044100732d52d46901684ef86123ad6a7f9677210a33c50"


def test_timestamps_are_normalized_to_utc(spark_feature):
    spark_feature["window_start"] = "2026-10-06T22:32:00+05:30"
    spark_feature["window_end"] = "2026-10-06T22:37:00+05:30"

    record = build_record(spark_feature)

    assert record.window_start.isoformat() == "2026-10-06T17:02:00+00:00"
    assert record.window_end.isoformat() == "2026-10-06T17:07:00+00:00"
    assert record.window_start.tzinfo is UTC


def test_nullable_feature_fields_are_preserved(spark_feature):
    spark_feature["rolling_return"] = None
    spark_feature["rolling_volatility"] = None
    spark_feature["relative_volume"] = None

    record = build_record(spark_feature)

    assert record.rolling_return is None
    assert record.rolling_volatility is None
    assert record.relative_volume is None


@pytest.mark.parametrize("field", ["log_return", "rolling_return", "rolling_volatility", "relative_volume"])
def test_nan_is_rejected(spark_feature, field):
    spark_feature[field] = float("nan")

    with pytest.raises(ValidationError, match="must be finite"):
        build_record(spark_feature)


@pytest.mark.parametrize("value", [float("inf"), float("-inf")])
def test_infinity_is_rejected(spark_feature, value):
    spark_feature["log_return"] = value

    with pytest.raises(ValidationError, match="must be finite"):
        build_record(spark_feature)


@pytest.mark.parametrize("value", ["not-a-timestamp", "2026-10-06T17:02:00"])
def test_malformed_or_timezone_free_timestamp_is_rejected(spark_feature, value):
    spark_feature["window_start"] = value

    with pytest.raises(ValidationError, match="timestamp"):
        build_record(spark_feature)


def test_negative_observation_count_is_rejected(spark_feature):
    spark_feature["observation_count"] = -1

    with pytest.raises(ValidationError):
        build_record(spark_feature)


@pytest.mark.parametrize("value", [None, "0,1", [], [0, -1], [0, "1"], [0, 0]])
def test_invalid_kafka_partitions_are_rejected(spark_feature, value):
    spark_feature["kafka_partitions"] = value

    with pytest.raises(ValidationError, match="kafka_partitions"):
        build_record(spark_feature)


@pytest.mark.parametrize("field,value", [("max_kafka_offset", -1), ("max_kafka_offset", 1.5)])
def test_invalid_max_kafka_offset_is_rejected(spark_feature, field, value):
    spark_feature[field] = value

    with pytest.raises(ValidationError):
        build_record(spark_feature)


def test_keys_are_deterministic_and_partition_order_independent(spark_feature):
    first_payload = deepcopy(spark_feature)
    second_payload = deepcopy(spark_feature)
    first_payload["kafka_partitions"] = [4, 1, 3]
    second_payload["kafka_partitions"] = [3, 4, 1]

    first = build_record(first_payload)
    second = build_record(second_payload)

    assert first.kafka_partitions == (1, 3, 4)
    assert first.logical_window_key == second.logical_window_key
    assert first.record_key == second.record_key


def test_feature_revision_changes_record_key_not_logical_window_key(spark_feature):
    first = build_record(deepcopy(spark_feature))
    revised_payload = deepcopy(spark_feature)
    revised_payload["observation_count"] = 6
    revised_payload["max_kafka_offset"] = 2002
    revised = build_record(revised_payload)

    assert first.logical_window_key == revised.logical_window_key
    assert first.record_key != revised.record_key


def test_equivalent_utc_instants_have_identical_logical_window_key(spark_feature):
    first = build_record(deepcopy(spark_feature))
    shifted = deepcopy(spark_feature)
    shifted["window_start"] = "2026-10-06T22:32:00+05:30"
    shifted["window_end"] = "2026-10-06T22:37:00+05:30"
    second = build_record(shifted)

    assert first.logical_window_key == second.logical_window_key


@pytest.mark.parametrize(
    "path,expected",
    [
        (SOURCE_FILE, 116),
        (r"C:\\spark\\features\\batch_id=87\\part-00000.json", 87),
    ],
)
def test_feature_batch_id_extraction(path, expected):
    assert extract_feature_batch_id(path) == expected


@pytest.mark.parametrize(
    "path",
    [
        "/opt/spark/output/features/part-00000.json",
        "/opt/spark/output/features/batch_id=-1/part-00000.json",
        "/opt/spark/output/features/batch_id=abc/part-00000.json",
    ],
)
def test_invalid_feature_batch_path_is_rejected(path):
    with pytest.raises(ValueError, match="batch_id"):
        extract_feature_batch_id(path)


def test_explicit_feature_batch_id_must_match_source_path(spark_feature):
    with pytest.raises(ValidationError, match="must match"):
        build_record(spark_feature, feature_batch_id=87)
