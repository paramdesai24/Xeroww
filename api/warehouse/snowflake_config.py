"""Optional environment configuration for Snowflake warehouse loading."""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from pathlib import Path

_IDENTIFIER = re.compile(r"^[A-Za-z_][A-Za-z0-9_$]*$")


class SnowflakeConfigurationError(ValueError):
    """Raised when the explicitly invoked Snowflake loader is misconfigured."""


def _enabled(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes", "on"}


def quote_identifier(value: str) -> str:
    """Validate and quote a dotted Snowflake object identifier."""
    parts = value.split(".")
    if not parts or any(not _IDENTIFIER.fullmatch(part) for part in parts):
        raise SnowflakeConfigurationError(f"Invalid Snowflake identifier: {value!r}")
    return ".".join(f'"{part.upper()}"' for part in parts)


@dataclass(frozen=True)
class SnowflakeConfig:
    enabled: bool
    account: str = ""
    user: str = ""
    password: str = field(default="", repr=False)
    private_key_path: str = ""
    private_key_passphrase: str = field(default="", repr=False)
    warehouse: str = ""
    database: str = ""
    schema: str = "ANALYTICS"
    role: str = ""
    feature_table: str = "FACT_MARKET_FEATURES"
    batch_table: str = "FEATURE_INGESTION_BATCHES"
    feature_view: str = "LATEST_MARKET_FEATURES"

    @classmethod
    def from_env(cls) -> SnowflakeConfig:
        return cls(
            enabled=_enabled(os.getenv("SNOWFLAKE_ENABLED", "false")),
            account=os.getenv("SNOWFLAKE_ACCOUNT", "").strip(),
            user=os.getenv("SNOWFLAKE_USER", "").strip(),
            password=os.getenv("SNOWFLAKE_PASSWORD", ""),
            private_key_path=os.getenv("SNOWFLAKE_PRIVATE_KEY_PATH", "").strip(),
            private_key_passphrase=os.getenv("SNOWFLAKE_PRIVATE_KEY_PASSPHRASE", ""),
            warehouse=os.getenv("SNOWFLAKE_WAREHOUSE", "").strip(),
            database=os.getenv("SNOWFLAKE_DATABASE", "").strip(),
            schema=os.getenv("SNOWFLAKE_SCHEMA", "ANALYTICS").strip(),
            role=os.getenv("SNOWFLAKE_ROLE", "").strip(),
            feature_table=os.getenv(
                "SNOWFLAKE_FEATURE_TABLE", "FACT_MARKET_FEATURES"
            ).strip(),
            batch_table=os.getenv(
                "SNOWFLAKE_BATCH_TABLE", "FEATURE_INGESTION_BATCHES"
            ).strip(),
            feature_view=os.getenv(
                "SNOWFLAKE_FEATURE_VIEW", "LATEST_MARKET_FEATURES"
            ).strip(),
        )

    def validate_for_connection(self) -> None:
        if not self.enabled:
            raise SnowflakeConfigurationError(
                "Snowflake loading is disabled; set SNOWFLAKE_ENABLED=true to invoke it"
            )
        required = {
            "SNOWFLAKE_ACCOUNT": self.account,
            "SNOWFLAKE_USER": self.user,
            "SNOWFLAKE_WAREHOUSE": self.warehouse,
            "SNOWFLAKE_DATABASE": self.database,
            "SNOWFLAKE_SCHEMA": self.schema,
            "SNOWFLAKE_ROLE": self.role,
        }
        missing = sorted(name for name, value in required.items() if not value)
        if missing:
            raise SnowflakeConfigurationError(
                f"Missing required Snowflake configuration: {', '.join(missing)}"
            )
        if bool(self.password) == bool(self.private_key_path):
            raise SnowflakeConfigurationError(
                "Configure exactly one Snowflake authentication method: password or private key"
            )
        if self.private_key_path and not Path(self.private_key_path).is_file():
            raise SnowflakeConfigurationError(
                "SNOWFLAKE_PRIVATE_KEY_PATH does not exist"
            )
        self.validate_identifiers()

    def validate_identifiers(self) -> None:
        for identifier in (
            self.warehouse,
            self.database,
            self.schema,
            self.role,
            self.feature_table,
            self.batch_table,
            self.feature_view,
        ):
            quote_identifier(identifier)

    @property
    def feature_table_sql(self) -> str:
        return quote_identifier(f"{self.database}.{self.schema}.{self.feature_table}")

    @property
    def batch_table_sql(self) -> str:
        return quote_identifier(f"{self.database}.{self.schema}.{self.batch_table}")

    @property
    def feature_view_sql(self) -> str:
        return quote_identifier(f"{self.database}.{self.schema}.{self.feature_view}")

    def connection_parameters(self) -> dict[str, object]:
        self.validate_for_connection()
        parameters: dict[str, object] = {
            "account": self.account,
            "user": self.user,
            "warehouse": self.warehouse,
            "database": self.database,
            "schema": self.schema,
            "role": self.role,
            "autocommit": False,
        }
        if self.private_key_path:
            parameters.update(
                {
                    "authenticator": "SNOWFLAKE_JWT",
                    "private_key_file": self.private_key_path,
                }
            )
            if self.private_key_passphrase:
                parameters["private_key_file_pwd"] = self.private_key_passphrase
        else:
            parameters["password"] = self.password
        return parameters
