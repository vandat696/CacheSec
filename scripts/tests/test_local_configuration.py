import unittest

from scripts.local_configuration import quotation_environment


class LocalConfigurationTests(unittest.TestCase):
    def setUp(self):
        self.app = {
            "QUOTATION_DATABASE_URL": "postgresql://dev:p%40ss@127.0.0.1:5544/demo?application_name=quotation",
            "QUOTATION_FIXTURE_READER_TOKEN": "reader-test-only-" + "r" * 32,
            "QUOTATION_FIXTURE_OPERATOR_TOKEN": "operator-test-only-" + "o" * 32,
            "CONTROL_TEST_WORKER_TOKEN": "must-never-be-copied",
        }
        self.database = {
            "POSTGRES_USER": "dev",
            "POSTGRES_PASSWORD": "p@ss",
            "POSTGRES_DB": "demo",
            "POSTGRES_PORT": "5544",
        }

    def test_only_local_host_changes_and_only_app_credentials_are_copied(self):
        values = quotation_environment(self.app, self.database)
        self.assertEqual(
            values["QUOTATION_DATABASE_URL"],
            "postgresql://dev:p%40ss@db:5432/demo?application_name=quotation",
        )
        self.assertEqual(
            set(values),
            {
                "QUOTATION_DATABASE_URL",
                "QUOTATION_FIXTURE_READER_TOKEN",
                "QUOTATION_FIXTURE_OPERATOR_TOKEN",
            },
        )
        self.assertEqual(
            values["QUOTATION_FIXTURE_READER_TOKEN"], self.app["QUOTATION_FIXTURE_READER_TOKEN"]
        )
        self.assertIn("127.0.0.1", self.app["QUOTATION_DATABASE_URL"])

    def test_unrelated_hosts_credentials_databases_and_ports_fail_without_echoing_secrets(self):
        for url in (
            "postgresql://dev:p%40ss@external.invalid:5544/demo",
            "postgresql://dev:wrong@127.0.0.1:5544/demo",
            "postgresql://dev:p%40ss@127.0.0.1:5544/other",
            "postgresql://dev:p%40ss@127.0.0.1:5432/demo",
        ):
            with (
                self.subTest(url=url),
                self.assertRaisesRegex(ValueError, "Configure the local quotation DSN") as failure,
            ):
                quotation_environment(self.app | {"QUOTATION_DATABASE_URL": url}, self.database)
            self.assertNotIn("p@ss", str(failure.exception))
            self.assertNotIn(url, str(failure.exception))

    def test_missing_duplicate_or_multiline_tokens_fail_closed(self):
        for replacement in (
            None,
            "short",
            self.app["QUOTATION_FIXTURE_READER_TOKEN"],
            "x" * 32 + "\nINJECT=value",
        ):
            with self.subTest(replacement=replacement), self.assertRaises(ValueError):
                quotation_environment(
                    self.app | {"QUOTATION_FIXTURE_OPERATOR_TOKEN": replacement}, self.database
                )


if __name__ == "__main__":
    unittest.main()
