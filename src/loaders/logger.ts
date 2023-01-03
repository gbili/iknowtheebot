import Logger, { logger } from 'saylo'
import { LoadDictElement, GetInstanceType } from 'di-why/build/src/DiContainer';

export { logger };

const loadDictElement: LoadDictElement<GetInstanceType<typeof Logger>> = {
  before: function ({ deps }) {
    const { env } = deps;
    return {
      ...deps,
      log: Boolean(env.LOGGER_LOG && env.LOGGER_LOG == '1'),
      debug: Boolean(env.LOGGER_DEBUG && env.LOGGER_DEBUG == '1'),
    };
  },
  constructible: Logger,
  locateDeps: {
    env: 'env',
  },
};

export default loadDictElement;
