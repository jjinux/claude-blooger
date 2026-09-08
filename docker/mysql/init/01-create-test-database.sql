-- MYSQL_DATABASE already created blooger_dev and granted it to `blooger`.
-- The test database needs the same treatment.
CREATE DATABASE IF NOT EXISTS blooger_test
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

GRANT ALL PRIVILEGES ON blooger_test.* TO 'blooger'@'%';
FLUSH PRIVILEGES;
