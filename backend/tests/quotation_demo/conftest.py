import pytest


@pytest.fixture
def quotation_database(temporary_database):
    with temporary_database("quotations") as database:
        yield database
