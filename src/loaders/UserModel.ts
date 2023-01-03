import { UserModel } from '../models';
import { LoadDictElement } from 'di-why/build/src/DiContainer';
import { createStarEvents } from 'swiss-army-knifey';
import MysqlReq from 'mysql-oh-wait';

const loadDictElement: LoadDictElement<typeof UserModel> = {
  async before({ serviceLocator, el, deps }) {
    const re = await serviceLocator.get<MysqlReq>('mysqlReq');
    console.log(re.getConnectionConfig());
  },
  injectable: UserModel,
  deps: {
    events: createStarEvents(),
  },
  locateDeps: {
    requestor: 'mysqlReq',
  },
};
export default loadDictElement;
