import di from './loaders';
import { BotServiceInterface } from './types';

try {
  (async function () {
    try {

      const botService = await di.get<BotServiceInterface>('botService');
      botService.run();

    } catch (err) {
      throw err;
    }
  })();
} catch (err) {
  throw err;
}
