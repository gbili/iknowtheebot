import DiContainer from "di-why";

import bot from './bot';
import botService from "./botService";
import env from './env';
import loggerDict, { logger } from "./logger";
import { mysqlReqLoader } from 'mysql-oh-wait-utils';
import UserModel from "./UserModel";
import neo4jDriver from './neo4jDriver';
import graphUserModel from './graphUserModel';

const injectionDict = {
  bot,
  botService,
  env,
  graphUserModel,
  logger: loggerDict,
  mysqlReq: mysqlReqLoader,
  neo4jDriver,
  UserModel,
};

const di = new DiContainer({ logger, load: injectionDict });

export default di;