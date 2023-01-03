import { LoadDictElement } from 'di-why/build/src/DiContainer';
import GraphUserModel from '../models/GraphUserModel';

const loadDictElement: LoadDictElement<GraphUserModel> = {
  constructible: GraphUserModel,
  locateDeps: {
    driver: 'neo4jDriver',
  },
};
export default loadDictElement;
