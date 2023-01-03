import { LoadDictElement } from "di-why/build/src/DiContainer";
import { Telegraf } from 'telegraf';

const loadDictElement: LoadDictElement<Telegraf> = {
  factory: function ({ env }) {
    return new Telegraf(env.TELEGRAM_API_TOKEN);
  },
  after: function ({ me }) {
    process.once('SIGINT', () => me.stop('SIGINT'))
    process.once('SIGTERM', () => me.stop('SIGTERM'))
  },
  locateDeps: {
    env: 'env',
  }
}

export default loadDictElement;