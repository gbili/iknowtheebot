import { LoadDictElement } from "di-why/build/src/DiContainer";
import BotService from "../services/BotService";
import { BotServiceInterface } from "../types";

const loadDictElement: LoadDictElement<BotServiceInterface> = {
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