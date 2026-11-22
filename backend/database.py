from pathlib import Path
from sqlite3 import Connection

from alembic.config import Config
from sqlalchemy import create_engine, event


# Alembic과 애플리케이션이 같은 SQLite 파일을 사용
config_path = Path(__file__).resolve().with_name("alembic.ini")
database_url = Config(config_path).get_main_option("sqlalchemy.url")

if not database_url:
    raise RuntimeError("alembic.ini에 sqlalchemy.url이 설정되어 있지 않습니다.")

engine = create_engine(database_url, connect_args={"autocommit": False})


@event.listens_for(engine, "connect")
def enable_foreign_keys(dbapi_connection: Connection, _connection_record: object) -> None:
    """
    새 SQLite 연결이 생성될 때마다 외래 키 검사 활성화
    """
    previous_autocommit = dbapi_connection.autocommit

    # SQLite는 트랜잭션 안에서 외래 키 검사 설정을 바꿀 수 있음
    dbapi_connection.autocommit = True
    try:
        dbapi_connection.execute("PRAGMA foreign_keys=ON").close()
    finally:
        dbapi_connection.autocommit = previous_autocommit