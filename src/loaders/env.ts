import { LoadDictElement } from 'di-why/build/src/DiContainer';
import 'dotenv/config';
import { hasKeyOrThrow } from 'swiss-army-knifey';

const TELEGRAM_API_TOKEN = 'TELEGRAM_API_TOKEN';
const NEO4J_PORT_BOLT = 'NEO4J_PORT_BOLT';
const NEO4J_HOST = 'NEO4J_HOST';
const ROOT_TIER = 'ROOT_TIER';


export type Env = {
  TELEGRAM_API_TOKEN: string;
  NEO4J_PORT_BOLT: string;
  NEO4J_HOST: string;
  ROOT_TIER: string;
  [k: string]: string;
}

hasKeyOrThrow(process.env, TELEGRAM_API_TOKEN);
hasKeyOrThrow(process.env, NEO4J_PORT_BOLT);
hasKeyOrThrow(process.env, NEO4J_HOST);
hasKeyOrThrow(process.env, ROOT_TIER);

const env: Env = {
  ...process.env,
  [TELEGRAM_API_TOKEN]: process.env.TELEGRAM_API_TOKEN || 'this value is never assigned because hasKeyOrThrow would throw before',
  [NEO4J_PORT_BOLT]: process.env.NEO4J_PORT_BOLT || 'this value is never assigned because hasKeyOrThrow would throw before',
  [NEO4J_HOST]: process.env.NEO4J_HOST || 'this value is never assigned because hasKeyOrThrow would throw before',
  [ROOT_TIER]: process.env.ROOT_TIER || 'this value is never assigned because hasKeyOrThrow would throw before',
}

const loadDictElement: LoadDictElement<Env> = {
  instance: env,
}

export default loadDictElement;