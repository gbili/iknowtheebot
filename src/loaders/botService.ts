import { LoadDictElement } from "di-why/build/src/DiContainer";
import BotService from "../services/BotService";
import { BotServiceInterface } from "../types";
import { Env } from "./env";

const loadDictElement: LoadDictElement<BotServiceInterface> = {
  before: async ({ deps, serviceLocator }) => {
    const env = await serviceLocator.get<Env>('env');
    const botId = parseInt(env.TELEGRAM_API_TOKEN.split(':')[0]);
    const considerAdminsRoot = env.ROOT_TIER === 'admin';
    return {
      ...deps,
      botId,
      considerAdminsRoot,
    };
  },
  constructible: BotService,
  locateDeps: {
    bot: 'bot',
    models: {
      UserModel: 'UserModel',
      graphUserModel: 'graphUserModel',
    },
  },
};

export default loadDictElement;