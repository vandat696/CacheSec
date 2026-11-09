import pytest


@pytest.fixture
def control_database(temporary_database):
    with temporary_database("control") as database:
        yield database
