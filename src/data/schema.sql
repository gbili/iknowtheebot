SET foreign_key_checks = 0;
DROP TABLE IF EXISTS `User`;
CREATE TABLE IF NOT EXISTS `User` (
  `UUID` VARCHAR(255) NOT NULL,
  `id` BIGINT SIGNED,
  `username` VARCHAR(255),
  `first_name` VARCHAR(255),
  `last_name` VARCHAR(255),
  `is_bot` BOOLEAN NOT NULL DEFAULT 0,
  PRIMARY KEY (`UUID`),
  UNIQUE INDEX `id_index` (`id`),
  UNIQUE INDEX `username_index` (`username`)
);

DROP TABLE IF EXISTS `Users_to_Chats`;
CREATE TABLE IF NOT EXISTS `Users_to_Chats` (
  `ID` INT NOT NULL AUTO_INCREMENT,
  `userUUID` VARCHAR(255) NOT NULL,
  `chatId` BIGINT SIGNED NOT NULL,
  `status` VARCHAR(15) NOT NULL,
  PRIMARY KEY (`ID`),
  FOREIGN KEY (`userUUID`)
    REFERENCES `User` (`UUID`)
    ON DELETE CASCADE,
  UNIQUE (`userUUID`, `chatId`)
);